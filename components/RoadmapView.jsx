'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, where, runTransaction, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ROADMAP_COLUMNS } from '@/lib/constants';
import RoadmapCard from '@/components/RoadmapCard';

function RoadmapView({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState({});     // { [itemId]: boolean }
  const [votingItemId, setVotingItemId] = useState(null);
  const [signInPrompt, setSignInPrompt] = useState(false);

  // Real-time listener for published roadmap items
  useEffect(() => {
    const q = query(
      collection(db, 'roadmapItems'),
      where('status', 'in', ['upnext', 'inprogress', 'shipped'])
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.log('Roadmap listener error:', err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load which items the current user has voted on
  useEffect(() => {
    if (!user || items.length === 0) {
      setUserVotes({});
      return;
    }
    Promise.all(
      items.map(item =>
        getDoc(doc(db, 'roadmapItems', item.id, 'voters', user.uid))
          .then(d => [item.id, d.exists()])
      )
    ).then(results => setUserVotes(Object.fromEntries(results)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, items.length]);

  // Top 3 most-voted item IDs (across all columns)
  const topThreeIds = new Set(
    [...items]
      .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
      .slice(0, 3)
      .map(i => i.id)
  );

  // Toggle vote -- uses runTransaction for atomic increment/decrement
  const handleVote = async (item) => {
    if (!user) { setSignInPrompt(true); return; }
    if (votingItemId) return;
    setVotingItemId(item.id);
    const itemRef = doc(db, 'roadmapItems', item.id);
    const voterRef = doc(db, 'roadmapItems', item.id, 'voters', user.uid);
    const hasVoted = !!userVotes[item.id];
    try {
      await runTransaction(db, async (tx) => {
        const voterSnap = await tx.get(voterRef);
        if (!hasVoted && !voterSnap.exists()) {
          tx.set(voterRef, { votedAt: serverTimestamp() });
          tx.update(itemRef, { voteCount: increment(1), updatedAt: serverTimestamp() });
        } else if (hasVoted && voterSnap.exists()) {
          tx.delete(voterRef);
          tx.update(itemRef, { voteCount: increment(-1), updatedAt: serverTimestamp() });
        }
      });
      setUserVotes(prev => ({ ...prev, [item.id]: !hasVoted }));
    } catch (err) {
      console.error('Vote error:', err);
    } finally {
      setVotingItemId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-primary mb-2 font-display">What's Coming to MySetlists</h1>
        <p className="text-secondary">Vote on features you want most -- the more votes, the higher it goes.</p>
      </div>

      {/* Sign-in prompt banner (for guests who click vote) */}
      {signInPrompt && (
        <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 bg-accent-amber-glow border border-accent-amber/30 rounded-2xl">
          <p className="text-accent-amber text-sm">Sign in to vote on features you want!</p>
          <button onClick={() => setSignInPrompt(false)} className="text-muted hover:text-primary transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted">Loading roadmap...</div>
      ) : (
        <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:gap-6">
          {ROADMAP_COLUMNS.map(col => {
            const colItems = items
              .filter(i => i.status === col.key)
              .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
            return (
              <div key={col.key}>
                {/* Column header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">{col.emoji}</span>
                  <h2 className={`font-bold text-base ${col.headerColor}`}>{col.label}</h2>
                  <span className="text-muted text-xs ml-auto">{colItems.length}</span>
                </div>
                {/* Cards */}
                <div className="space-y-3">
                  {colItems.map(item => (
                    <RoadmapCard
                      key={item.id}
                      item={item}
                      hasVoted={!!userVotes[item.id]}
                      isTopThree={topThreeIds.has(item.id)}
                      onVote={handleVote}
                      voting={votingItemId === item.id}
                      isLoggedIn={!!user}
                    />
                  ))}
                  {colItems.length === 0 && (
                    <p className="text-primary/25 text-sm py-4">Nothing here yet</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RoadmapView;
