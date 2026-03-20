'use client';

import { useState } from 'react';
import { TrendingUp, Mail, Send, Check } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ROADMAP_CATEGORIES } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';

export default function AdminRoadmapCard({ item, onStatusChange, onPublish, onDismiss, onNotify, feedbackItems, saving, notifying }) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title || '');
  const [editDesc, setEditDesc] = useState(item.description || '');
  const [localSaving, setLocalSaving] = useState(false);

  const linkedFeedback = feedbackItems.find(f => f.id === item.sourceFeedbackId);
  const submitterEmail = item.submitterEmail || linkedFeedback?.submitterEmail || null;

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setLocalSaving(true);
    try {
      await updateDoc(doc(db, 'roadmapItems', item.id), {
        title: editTitle.trim(),
        description: editDesc.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch (err) {
      console.error('Failed to save edit:', err);
    } finally {
      setLocalSaving(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: 'draft',      label: 'Draft'       },
    { value: 'upnext',     label: 'Up Next'     },
    { value: 'inprogress', label: 'In Progress' },
    { value: 'shipped',    label: 'Shipped'     },
  ];

  return (
    <div className="bg-hover backdrop-blur-xl rounded-2xl border border-subtle p-4 space-y-3">
      {editing ? (
        <div className="space-y-2">
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 bg-hover border border-subtle rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            placeholder="Title"
          />
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-hover border border-subtle rounded-xl text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none"
            placeholder="Description (optional)"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || localSaving}
              className="px-3 py-1.5 bg-brand hover:bg-brand text-on-dark rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              {localSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditTitle(item.title || ''); setEditDesc(item.description || ''); }}
              className="px-3 py-1.5 bg-hover hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-primary font-medium text-sm leading-snug">{item.title}</p>
              {/* Submitter email */}
              {submitterEmail && (
                <p className="text-brand/70 text-xs mt-0.5 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {submitterEmail}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Prominent vote count */}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                (item.voteCount || 0) > 0
                  ? 'bg-amber-subtle text-amber border border-amber/30'
                  : 'text-muted bg-hover'
              }`}>
                {item.voteCount || 0} vote{item.voteCount !== 1 ? 's' : ''}
              </span>
              {item.category && ROADMAP_CATEGORIES[item.category] && (
                <span className="text-xs text-muted bg-hover px-2 py-0.5 rounded-full">
                  {ROADMAP_CATEGORIES[item.category]}
                </span>
              )}
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-muted hover:text-primary px-2 py-1 rounded-lg hover:bg-hover transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
          {item.description && item.description !== item.title && (
            <p className="text-secondary text-xs mt-1 leading-relaxed line-clamp-2">{item.description}</p>
          )}
          {linkedFeedback && (
            <p className="text-muted text-xs mt-1.5 italic">
              From feedback by {linkedFeedback.submitterName || 'user'}: &quot;{(linkedFeedback.message || '').slice(0, 80)}{linkedFeedback.message?.length > 80 ? '...' : ''}&quot;
            </p>
          )}
          {/* Submission date */}
          {item.createdAt && (
            <p className="text-muted/60 text-[10px] mt-1">
              Submitted {timeAgo(item.createdAt)}
            </p>
          )}
        </div>
      )}

      {/* Status controls */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-subtle">
        <select
          value={item.status}
          onChange={e => onStatusChange(e.target.value)}
          disabled={saving}
          className="px-3 py-1.5 bg-hover border border-subtle rounded-xl text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-surface text-primary">
              {opt.label}
            </option>
          ))}
        </select>

        {item.status === 'draft' && (
          <button
            onClick={() => onPublish('upnext')}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-subtle hover:bg-amber-subtle text-amber border border-amber/30 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
          >
            <TrendingUp className="w-3 h-3" />
            Publish &rarr; Up Next
          </button>
        )}

        {/* Send Notification Emails button for shipped items */}
        {item.status === 'shipped' && !item.notificationsSent && onNotify && (
          <button
            onClick={onNotify}
            disabled={notifying}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-subtle hover:bg-brand/30 text-brand border border-brand/30 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            {notifying ? 'Sending...' : 'Notify Users'}
          </button>
        )}
        {item.status === 'shipped' && item.notificationsSent && (
          <span className="flex items-center gap-1 px-3 py-1.5 text-brand/60 text-xs">
            <Check className="w-3 h-3" />
            Notified
          </span>
        )}

        <button
          onClick={onDismiss}
          disabled={saving}
          className="px-3 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-xl text-xs font-medium transition-colors ml-auto disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
