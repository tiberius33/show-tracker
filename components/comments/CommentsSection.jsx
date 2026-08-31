// components/comments/CommentsSection.jsx
//
// Comment thread for a concert, shown at the bottom of ShowDetailView.
// Threaded one level deep (top-level comments + replies), real-time via
// Firestore listener, sortable, likeable, and moderated (author or admin
// can delete). See lib/comments.js for the data model and why this is
// keyed by concert identity rather than any one user's private show doc.

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Heart, Trash2, CornerDownRight, Send } from 'lucide-react';
import { Card, Avatar, Button, Textarea, Tabs, Spinner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { subscribeComments, postComment, toggleCommentLike, deleteComment } from '@/lib/comments';
import { createEngagementNotification } from '@/lib/notifications';
import { logActivity } from '@/lib/activityFeed';
import { timeAgo } from '@/lib/utils';

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'liked', label: 'Most Liked' },
];

function CommentComposer({ onSubmit, placeholder, autoFocus, onCancel }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await onSubmit(text);
      setText('');
      if (onCancel) onCancel();
    } finally {
      setPosting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2 items-start">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={2}
        autoFocus={autoFocus}
        containerClassName="flex-1"
      />
      <div className="flex flex-col gap-1.5">
        <Button type="submit" size="sm" icon={Send} loading={posting} disabled={!text.trim()}>
          Post
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </form>
  );
}

function CommentRow({ comment, isReply, currentUid, canModerate, onReply, onLike, onDelete, replyOpen, onToggleReply }) {
  const liked = currentUid ? (comment.likedBy || []).includes(currentUid) : false;
  const likeCount = (comment.likedBy || []).length;
  const canDelete = currentUid && (comment.authorUid === currentUid || canModerate);

  return (
    <div className={`flex gap-3 ${isReply ? 'ml-10 mt-3' : 'py-4 border-b border-subtle last:border-0'}`}>
      <Avatar name={comment.authorName} size={isReply ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-sm text-primary">{comment.authorName}</span>
          <span className="text-xs text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-primary mt-0.5 whitespace-pre-wrap break-words">{comment.text}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <button
            type="button"
            onClick={() => onLike(comment)}
            disabled={!currentUid}
            className={`flex items-center gap-1 text-xs font-medium transition-colors ${
              liked ? 'text-danger' : 'text-muted hover:text-primary'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Heart size={13} fill={liked ? 'currentColor' : 'none'} />
            {likeCount > 0 && likeCount}
          </button>
          {!isReply && currentUid && (
            <button
              type="button"
              onClick={onToggleReply}
              className="flex items-center gap-1 text-xs font-medium text-muted hover:text-primary transition-colors"
            >
              <CornerDownRight size={13} /> Reply
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment)}
              className="flex items-center gap-1 text-xs font-medium text-muted hover:text-danger transition-colors ml-auto"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
        {replyOpen && (
          <div className="mt-2">
            <CommentComposer
              placeholder={`Reply to ${comment.authorName}…`}
              autoFocus
              onCancel={onToggleReply}
              onSubmit={(text) => onReply(comment, text)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentsSection({ show }) {
  const { user, isAdmin, guestMode, setToast, normalizeShowKey } = useApp();
  const concertKey = useMemo(() => (show ? normalizeShowKey(show) : null), [show, normalizeShowKey]);

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');
  const [replyOpenId, setReplyOpenId] = useState(null);

  useEffect(() => {
    // Reading showComments requires Firestore auth (see firestore.rules) —
    // a guest has no Firebase auth user at all, so subscribing would just
    // fail with permission-denied and leave the spinner stuck forever.
    // Skip the listener entirely rather than let that happen.
    if (!concertKey || !user || guestMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeComments(concertKey, (list) => {
      setComments(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [concertKey, user, guestMode]);

  const topLevel = useMemo(() => {
    const roots = comments.filter((c) => !c.parentId);
    const sorted = [...roots];
    if (sort === 'oldest') {
      sorted.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    } else if (sort === 'liked') {
      sorted.sort((a, b) => (b.likedBy?.length || 0) - (a.likedBy?.length || 0));
    } else {
      sorted.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    }
    return sorted;
  }, [comments, sort]);

  const repliesFor = (commentId) =>
    comments
      .filter((c) => c.parentId === commentId)
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

  const handlePost = async (text) => {
    try {
      await postComment(concertKey, user.uid, user.displayName || 'Anonymous', text);
      logActivity(user.uid, user.displayName, 'commented', {
        showId: show.id, artist: show.artist, venue: show.venue || null,
      });
    } catch (err) {
      setToast?.("Couldn't post your comment. Please try again.");
    }
  };

  const handleReply = async (parent, text) => {
    const authorName = user.displayName || 'Anonymous';
    try {
      await postComment(concertKey, user.uid, authorName, text, parent.id);
      createEngagementNotification(parent.authorUid, 'comment_reply', {
        concertKey, artist: show.artist, venue: show.venue, date: show.date,
        fromUid: user.uid, fromName: authorName,
        message: `${authorName} replied to your comment on ${show.artist}`,
      });
      logActivity(user.uid, authorName, 'commented', {
        showId: show.id, artist: show.artist, venue: show.venue || null,
      });
    } catch (err) {
      setToast?.("Couldn't post your reply. Please try again.");
    }
  };

  const handleLike = async (comment) => {
    if (!user) return;
    const alreadyLiked = (comment.likedBy || []).includes(user.uid);
    try {
      await toggleCommentLike(comment.id, user.uid, alreadyLiked);
      if (!alreadyLiked) {
        const likerName = user.displayName || 'Anonymous';
        createEngagementNotification(comment.authorUid, 'comment_like', {
          concertKey, artist: show.artist, venue: show.venue, date: show.date,
          fromUid: user.uid, fromName: likerName,
          message: `${likerName} liked your comment on ${show.artist}`,
        });
      }
    } catch (err) {
      setToast?.("Couldn't update your like. Please try again.");
    }
  };

  const handleDelete = async (comment) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteComment(comment.id);
    } catch (err) {
      setToast?.("Couldn't delete that comment. Please try again.");
    }
  };

  if (!concertKey) return null;

  return (
    <Card padding="md" className="mt-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <MessageSquare size={18} className="text-brand" />
          Comments {comments.length > 0 && <span className="text-muted font-normal text-sm">({comments.length})</span>}
        </h3>
        {topLevel.length > 1 && <Tabs value={sort} onChange={setSort} tabs={SORTS} className="border-b-0" />}
      </div>

      {user && !guestMode ? (
        <div className="mb-5">
          <CommentComposer placeholder="Share your thoughts on this show…" onSubmit={handlePost} />
        </div>
      ) : (
        <p className="text-sm text-muted mb-5">Sign in to see and join the discussion.</p>
      )}

      {!user || guestMode ? null : loading ? (
        <div className="py-8"><Spinner size="sm" label="Loading comments…" /></div>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">
          No comments yet — be the first to say something about this show.
        </p>
      ) : (
        <div>
          {topLevel.map((comment) => (
            <div key={comment.id}>
              <CommentRow
                comment={comment}
                currentUid={user?.uid}
                canModerate={isAdmin}
                onLike={handleLike}
                onDelete={handleDelete}
                onReply={handleReply}
                replyOpen={replyOpenId === comment.id}
                onToggleReply={() => setReplyOpenId(replyOpenId === comment.id ? null : comment.id)}
              />
              {repliesFor(comment.id).map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  isReply
                  currentUid={user?.uid}
                  canModerate={isAdmin}
                  onLike={handleLike}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
