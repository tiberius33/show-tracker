// components/moderation/BlockedAccountsSection.jsx
//
// The "Blocked accounts" panel on the Profile page — the undo for a
// block, and the only place in the app that lists who you have blocked.
//
// It has to exist for the block feature to be legitimate: Guideline 1.2
// wants a way to block abusive users, and a block with no visible list
// and no way back is a trap rather than a control. It is also the only
// surface that reads `userBlocks` for display, which is why the profile
// lookups happen here rather than in AppContext — the list is a handful
// of documents fetched when someone opens this panel, not something worth
// keeping warm for every page load.

'use client';

import React, { useEffect, useState } from 'react';
import { ShieldOff, UserCheck } from 'lucide-react';
import { Card, Button, Avatar, Spinner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { loadBlockedProfiles } from '@/lib/moderation';

export default function BlockedAccountsSection() {
  const { blockedUserIds, unblockUser } = useApp();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState(null);

  useEffect(() => {
    if (blockedUserIds.length === 0) {
      setProfiles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadBlockedProfiles(blockedUserIds)
      .then((list) => { if (!cancelled) setProfiles(list); })
      .catch((err) => {
        console.error('[moderation] Failed to load blocked profiles:', err);
        // Fall back to bare uids rather than an error state: being unable
        // to show a name must not stop someone unblocking an account.
        if (!cancelled) setProfiles(blockedUserIds.map((uid) => ({ uid, displayName: 'Blocked account' })));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [blockedUserIds]);

  const handleUnblock = async (uid) => {
    setBusyUid(uid);
    try {
      await unblockUser(uid);
    } catch {
      // AppContext has already shown the toast.
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <Card padding="md" className="mt-6">
      <h3 className="text-lg font-semibold text-primary flex items-center gap-2 mb-1">
        <ShieldOff size={18} className="text-brand" />
        Blocked accounts
        {blockedUserIds.length > 0 && (
          <span className="text-muted font-normal text-sm">({blockedUserIds.length})</span>
        )}
      </h3>
      <p className="text-sm text-muted mb-4">
        You don’t see comments, photos, meetup messages or activity from anyone here, and
        you aren’t in each other’s friends list.
      </p>

      {loading ? (
        <div className="py-6"><Spinner size="sm" label="Loading…" /></div>
      ) : blockedUserIds.length === 0 ? (
        <p className="text-sm text-muted">
          You haven’t blocked anyone. You can block someone from the flag icon on any
          comment or photo, or from their profile.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 divide-y divide-subtle">
          {profiles.map((profile) => (
            <li key={profile.uid} className="flex items-center gap-3 py-3">
              <Avatar src={profile.photoURL} name={profile.displayName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-primary truncate">{profile.displayName}</div>
                {profile.handle && (
                  <div className="text-xs text-muted truncate">@{profile.handle}</div>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={UserCheck}
                loading={busyUid === profile.uid}
                onClick={() => handleUnblock(profile.uid)}
              >
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}

      {blockedUserIds.length > 0 && (
        <p className="text-xs text-muted mt-3">
          Unblocking doesn’t restore a friendship — send a friend request if you want to
          reconnect.
        </p>
      )}
    </Card>
  );
}
