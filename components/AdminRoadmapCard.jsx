'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ROADMAP_CATEGORIES } from '@/lib/constants';

export default function AdminRoadmapCard({ item, onStatusChange, onPublish, onDismiss, feedbackItems, saving }) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title || '');
  const [editDesc, setEditDesc] = useState(item.description || '');
  const [localSaving, setLocalSaving] = useState(false);

  const linkedFeedback = feedbackItems.find(f => f.id === item.sourceFeedbackId);

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
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 space-y-3">
      {editing ? (
        <div className="space-y-2">
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="Title"
          />
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
            placeholder="Description (optional)"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || localSaving}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              {localSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditTitle(item.title || ''); setEditDesc(item.description || ''); }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-white font-medium text-sm leading-snug">{item.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                {item.voteCount || 0} vote{item.voteCount !== 1 ? 's' : ''}
              </span>
              {item.category && ROADMAP_CATEGORIES[item.category] && (
                <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                  {ROADMAP_CATEGORIES[item.category]}
                </span>
              )}
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-white/40 hover:text-white/70 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
          {item.description && item.description !== item.title && (
            <p className="text-white/50 text-xs mt-1 leading-relaxed line-clamp-2">{item.description}</p>
          )}
          {linkedFeedback && (
            <p className="text-white/30 text-xs mt-1.5 italic">
              From feedback by {linkedFeedback.submitterName || 'user'}: &quot;{(linkedFeedback.message || '').slice(0, 80)}{linkedFeedback.message?.length > 80 ? '...' : ''}&quot;
            </p>
          )}
        </div>
      )}

      {/* Status controls */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/5">
        <select
          value={item.status}
          onChange={e => onStatusChange(e.target.value)}
          disabled={saving}
          className="px-3 py-1.5 bg-white/10 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
              {opt.label}
            </option>
          ))}
        </select>

        {item.status === 'draft' && (
          <button
            onClick={() => onPublish('upnext')}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
          >
            <TrendingUp className="w-3 h-3" />
            Publish → Up Next
          </button>
        )}

        <button
          onClick={onDismiss}
          disabled={saving}
          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-medium transition-colors ml-auto disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
