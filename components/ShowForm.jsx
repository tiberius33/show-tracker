'use client';

import React, { useState } from 'react';
import { Tag, ChevronDown, Check } from 'lucide-react';

function ShowForm({ onSubmit, onCancel, friends = [], onTagFriends }) {
  const [formData, setFormData] = useState({
    artist: '',
    venue: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [tagOpen, setTagOpen] = useState(false);
  const [selectedTagFriends, setSelectedTagFriends] = useState(new Set());

  const toggleTagFriend = (uid) => {
    setSelectedTagFriends(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.artist && formData.venue && formData.date) {
      await onSubmit(formData);
      if (selectedTagFriends.size > 0 && onTagFriends) {
        await onTagFriends(formData, [...selectedTagFriends]);
      }
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4 text-white">Add Show Manually</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Artist/Band"
          value={formData.artist}
          onChange={(e) => setFormData({...formData, artist: e.target.value})}
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
          required
        />
        <input
          type="text"
          placeholder="Venue"
          value={formData.venue}
          onChange={(e) => setFormData({...formData, venue: e.target.value})}
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
          required
        />
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white"
          required
        />
        {/* Tag Friends accordion (only for logged-in users with friends) */}
        {friends.length > 0 && (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setTagOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-sm"
            >
              <span className="flex items-center gap-2 text-white/70">
                <Tag className="w-4 h-4" />
                Tag friends at this show
                {selectedTagFriends.size > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                    {selectedTagFriends.size} selected
                  </span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${tagOpen ? 'rotate-180' : ''}`} />
            </button>
            {tagOpen && (
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                {friends.map(f => (
                  <label
                    key={f.friendUid}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      selectedTagFriends.has(f.friendUid)
                        ? 'bg-emerald-500/15 border border-emerald-500/30'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={selectedTagFriends.has(f.friendUid)} onChange={() => toggleTagFriend(f.friendUid)} />
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedTagFriends.has(f.friendUid) ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'}`}>
                      {selectedTagFriends.has(f.friendUid) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-white">{f.friendName || f.friendEmail}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/25">
            Add Show
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default ShowForm;
