'use client';

import React, { useState, useEffect } from 'react';
import { Check, Send, RefreshCw, TrendingUp } from 'lucide-react';
import { collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function FeedbackView({ user, onNavigate, unreadNotifications, onMarkRead }) {
  const [feedbackType, setFeedbackType] = useState('general'); // 'feature' | 'bug' | 'general'
  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Mark notifications read on mount (clears roadmap_published banner from badge)
  useEffect(() => {
    if (onMarkRead) onMarkRead();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roadmapNotifications = (unreadNotifications || []).filter(n => n.type === 'roadmap_published');

  const handleSubmit = async () => {
    if (!message.trim() || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Write to feedback collection
      const feedbackData = {
        type: feedbackType,
        category: feedbackType === 'feature' ? category : null,
        message: message.trim(),
        submitterUid: user.uid,
        submitterEmail: user.email || '',
        submitterName: (user.displayName || '').split(' ')[0] || 'Anonymous',
        status: 'linked',
        roadmapItemId: null,
        createdAt: serverTimestamp(),
      };
      const feedbackRef = await addDoc(collection(db, 'feedback'), feedbackData);

      // Auto-create a draft roadmap item for ALL feedback types
      const draftTitle = feedbackType === 'feature'
        ? message.trim().slice(0, 100)
        : `[${feedbackType === 'bug' ? 'Bug' : 'Feedback'}] ${message.trim().slice(0, 90)}`;
      const itemRef = await addDoc(collection(db, 'roadmapItems'), {
        title: draftTitle,
        description: message.trim(),
        status: 'draft',
        category: feedbackType === 'feature' ? category : 'other',
        voteCount: 0,
        sourceFeedbackId: feedbackRef.id,
        submitterUid: user.uid,
        submitterEmail: user.email || '',
        contributors: user.email ? [{ email: user.email, votedAt: new Date().toISOString(), notified: false }] : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        publishedAt: null,
        completedAt: null,
        notificationsSent: false,
        notificationsSentAt: null,
      });
      await updateDoc(feedbackRef, { roadmapItemId: itemRef.id, status: 'linked' });
      setSubmitted(true);
    } catch (err) {
      setSubmitError('Failed to submit. Please try again.');
      console.error('Feedback submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const FEEDBACK_TYPES = [
    { id: 'feature', label: 'Feature Request' },
    { id: 'bug',     label: 'Bug Report'      },
    { id: 'general', label: 'General Feedback' },
  ];

  const CATEGORIES = [
    { id: 'ui',     label: 'UI/Design'   },
    { id: 'social', label: 'Social'      },
    { id: 'data',   label: 'Data & Stats' },
    { id: 'search', label: 'Search'      },
    { id: 'other',  label: 'Other'       },
  ];

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-hover backdrop-blur-xl rounded-2xl border border-subtle p-8 text-center">
          <div className="w-12 h-12 bg-brand-subtle rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-brand" />
          </div>
          <h2 className="text-xl font-bold text-primary mb-2">Thanks for your feedback!</h2>
          <p className="text-secondary mb-6">
            Your feedback has been added to our review queue. Check the roadmap to see what's coming!
          </p>
          <button
            onClick={() => onNavigate && onNavigate('roadmap')}
            className="flex items-center gap-2 mx-auto mb-4 px-5 py-2.5 bg-gradient-to-r from-amber to-amber hover:from-amber hover:to-amber text-primary rounded-xl font-medium transition-all shadow-lg shadow-amber/20"
          >
            <TrendingUp className="w-4 h-4" />
            View Roadmap
          </button>
          <button
            onClick={() => { setSubmitted(false); setMessage(''); setFeedbackType('general'); setCategory('other'); }}
            className="text-muted hover:text-primary text-sm transition-colors"
          >
            Send more feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Roadmap notification banner */}
      {roadmapNotifications.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-brand-subtle border border-brand/30 rounded-2xl">
          <p className="text-brand text-sm font-medium mb-1">
            Your feature idea is on the roadmap!
          </p>
          <p className="text-secondary text-xs mb-2">
            "{roadmapNotifications[0].itemTitle}" -- check it out and see how the community votes on it.
          </p>
          <button
            onClick={() => onNavigate && onNavigate('roadmap')}
            className="text-xs text-brand hover:text-brand font-medium transition-colors"
          >
            View Roadmap &rarr;
          </button>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <h1 className="text-xl md:text-2xl font-bold text-primary">Send Feedback</h1>
        <button
          onClick={() => onNavigate && onNavigate('roadmap')}
          className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors mt-1"
        >
          <TrendingUp className="w-3 h-3" />
          View Roadmap
        </button>
      </div>
      <p className="text-secondary mb-8">We'd love to hear your thoughts, suggestions, or bug reports.</p>

      <div className="bg-hover backdrop-blur-xl rounded-2xl border border-subtle p-6 space-y-5">

        {/* Feedback type selector */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setFeedbackType(t.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  feedbackType === t.id
                    ? 'bg-brand-subtle text-brand border-brand/30'
                    : 'bg-hover text-secondary border-subtle hover:bg-hover'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category selector -- only for feature requests */}
        {feedbackType === 'feature' && (
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                    category === c.id
                      ? 'bg-amber-subtle text-amber border-amber/30'
                      : 'bg-hover text-secondary border-subtle hover:bg-hover'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message textarea */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">
            {feedbackType === 'feature' ? 'Describe your idea' : feedbackType === 'bug' ? 'What went wrong?' : 'Your Feedback'}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              feedbackType === 'feature' ? "What feature would make MySetlists better for you?" :
              feedbackType === 'bug' ? "What happened? What were you trying to do?" :
              "Tell us what you think..."
            }
            rows={6}
            className="w-full px-4 py-3 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted resize-none"
          />
        </div>

        {submitError && (
          <p className="text-danger text-sm">{submitError}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!message.trim() || submitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
        >
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? 'Sending...' : 'Send Feedback'}
        </button>
      </div>
    </div>
  );
}

export default FeedbackView;
