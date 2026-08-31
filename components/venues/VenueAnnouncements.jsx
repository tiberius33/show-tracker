'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Card, Button, Textarea } from '@/components/ui';
import { subscribeVenueAnnouncements, addVenueAnnouncement } from '@/lib/venues';

function formatDate(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// isOwner: shows the composer for the verified venue representative.
// Read-only feed otherwise, shown on the venue detail page.
export default function VenueAnnouncements({ venueKey, isOwner, currentUser, venueName }) {
  const [announcements, setAnnouncements] = useState([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!venueKey) return;
    return subscribeVenueAnnouncements(venueKey, setAnnouncements);
  }, [venueKey]);

  const handlePost = async () => {
    if (!text.trim() || !currentUser) return;
    setPosting(true);
    try {
      await addVenueAnnouncement(venueKey, { text, authorUid: currentUser.uid, authorName: venueName });
      setText('');
    } catch (err) {
      console.error('Failed to post announcement:', err);
    }
    setPosting(false);
  };

  if (!announcements.length && !isOwner) return null;

  return (
    <Card variant="elevated" padding="lg">
      <h3 className="text-lg font-semibold text-primary flex items-center gap-2 mb-4">
        <Megaphone size={18} className="text-brand" /> Announcements
      </h3>

      {isOwner && (
        <div className="mb-4 space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} placeholder="Post an update — upcoming events, policy changes, facility info..." rows={3} />
          <Button variant="primary" size="sm" onClick={handlePost} loading={posting} disabled={posting || !text.trim()}>Post</Button>
        </div>
      )}

      {announcements.length === 0 ? (
        <p className="text-secondary text-sm">No announcements yet.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="border-l-2 border-brand pl-3">
              <p className="text-primary text-sm">{a.text}</p>
              <p className="text-muted text-xs mt-1">{formatDate(a.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
