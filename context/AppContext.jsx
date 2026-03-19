"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc,
  serverTimestamp, onSnapshot, query, where, addDoc, writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { formatDate, parseDate, extractFirstName } from '@/lib/utils';
import { ADMIN_EMAILS } from '@/lib/constants';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { apiUrl } from '@/lib/api';

// ── Helper: update the user's profile doc with current stats ────────────
async function updateUserProfile(user, shows = []) {
  if (!user) return;

  const profileRef = doc(db, 'userProfiles', user.uid);
  const uniqueVenues = new Set(shows.map(s => s.venue)).size;
  const totalSongs = shows.reduce((acc, s) => acc + s.setlist.length, 0);
  const ratedSongs = shows.reduce((acc, s) => acc + s.setlist.filter(song => song.rating).length, 0);

  const profileData = {
    odubleserId: user.uid,
    email: user.email,
    displayName: user.displayName || '',
    firstName: extractFirstName(user.displayName),
    photoURL: user.photoURL || '',
    lastLogin: serverTimestamp(),
    showCount: shows.length,
    songCount: totalSongs,
    ratedSongCount: ratedSongs,
    venueCount: uniqueVenues,
  };

  const existingProfile = await getDoc(profileRef);
  if (!existingProfile.exists()) {
    profileData.createdAt = serverTimestamp();
  }

  await setDoc(profileRef, profileData, { merge: true });
}

// ── Helper: rebuild community-wide leaderboard stats ────────────────────
async function updateCommunityStats() {
  try {
    const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
    const profiles = profilesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const allSongs = {};
    const allVenues = {};
    let totalShows = profiles.reduce((acc, p) => acc + (p.showCount || 0), 0);
    let totalSongs = profiles.reduce((acc, p) => acc + (p.songCount || 0), 0);

    for (const profile of profiles) {
      try {
        const showsSnapshot = await getDocs(collection(db, 'users', profile.id, 'shows'));
        const userShows = showsSnapshot.docs.map(d => d.data());

        for (const show of userShows) {
          const venueName = show.venue + (show.city ? `, ${show.city}` : '');
          if (!allVenues[venueName]) {
            allVenues[venueName] = { count: 0, artists: new Set() };
          }
          allVenues[venueName].count++;
          allVenues[venueName].artists.add(show.artist);

          const setlist = show.setlist || [];
          for (const song of setlist) {
            const songKey = song.name.toLowerCase().trim();
            if (!allSongs[songKey]) {
              allSongs[songKey] = { songName: song.name, users: new Set(), artists: new Set(), ratings: [] };
            }
            allSongs[songKey].users.add(profile.id);
            allSongs[songKey].artists.add(show.artist);
            if (song.rating) allSongs[songKey].ratings.push(song.rating);
          }
        }
      } catch (_) {
        // Permission denied for other users' shows — skip gracefully
      }
    }

    const topShowsAttended = [...profiles]
      .sort((a, b) => (b.showCount || 0) - (a.showCount || 0))
      .slice(0, 5)
      .map(p => ({ odubleserId: p.id, firstName: p.firstName, photoURL: p.photoURL, count: p.showCount || 0 }));

    const topSongsRated = [...profiles]
      .sort((a, b) => (b.ratedSongCount || 0) - (a.ratedSongCount || 0))
      .slice(0, 5)
      .map(p => ({ odubleserId: p.id, firstName: p.firstName, photoURL: p.photoURL, count: p.ratedSongCount || 0 }));

    const topVenuesVisited = [...profiles]
      .sort((a, b) => (b.venueCount || 0) - (a.venueCount || 0))
      .slice(0, 5)
      .map(p => ({ odubleserId: p.id, firstName: p.firstName, photoURL: p.photoURL, count: p.venueCount || 0 }));

    const topSongsBySightings = Object.values(allSongs)
      .map(s => ({ songName: s.songName, userCount: s.users.size, artists: [...s.artists].slice(0, 3) }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 5);

    const topSongsByRating = Object.values(allSongs)
      .filter(s => s.ratings.length >= 2)
      .map(s => ({
        songName: s.songName,
        avgRating: (s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(1),
        ratingCount: s.ratings.length,
        artists: [...s.artists].slice(0, 3),
      }))
      .sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating))
      .slice(0, 5);

    const topVenues = Object.entries(allVenues)
      .map(([name, data]) => ({ venueName: name, showCount: data.count, artistCount: data.artists.size }))
      .sort((a, b) => b.showCount - a.showCount)
      .slice(0, 5);

    const statsRef = doc(db, 'communityStats', 'global');
    await setDoc(statsRef, {
      updatedAt: serverTimestamp(),
      totalUsers: profiles.length,
      totalShows,
      totalSongs,
      topShowsAttended,
      topSongsRated,
      topVenuesVisited,
      topSongsBySightings,
      topSongsByRating,
      topVenues,
    });
  } catch (error) {
    console.error('Failed to update community stats:', error);
  }
}

// ── Context ─────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Core state ──────────────────────────────────────────────────────
  const [shows, setShows] = useState([]);
  const [activeView, setActiveView] = useState('shows');
  const [statsTab, setStatsTab] = useState('years');
  const [friendsInitialTab, setFriendsInitialTab] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('date');
  const [selectedArtist, setSelectedArtist] = useState(null);

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [localShowsToMigrate, setLocalShowsToMigrate] = useState([]);
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'signup' | 'forgot-password'
  const [guestMode, setGuestMode] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Onboarding tooltip state
  const [tooltipStep, setTooltipStep] = useState(0); // 0=hidden, 1=import, 2=scan

  useEffect(() => {
    if (!isLoading && user && activeView === 'shows') {
      const now = Date.now();
      const lastVisit = storage.get(STORAGE_KEYS.LAST_VISIT);
      const hasSeenTooltips = storage.get(STORAGE_KEYS.SEEN_TOOLTIPS);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      const shouldShow = !hasSeenTooltips || (lastVisit && (now - parseInt(lastVisit, 10)) > sevenDaysMs);

      if (shouldShow) {
        const timer = setTimeout(() => setTooltipStep(1), 800);
        storage.set(STORAGE_KEYS.LAST_VISIT, String(now));
        return () => clearTimeout(timer);
      }

      storage.set(STORAGE_KEYS.LAST_VISIT, String(now));
    }
  }, [isLoading, user, activeView]);

  const dismissTooltip = () => {
    setTooltipStep(0);
    storage.set(STORAGE_KEYS.SEEN_TOOLTIPS, '1');
    storage.set(STORAGE_KEYS.LAST_VISIT, String(Date.now()));
  };

  // ── Navigation ──────────────────────────────────────────────────────
  // In Next.js the active view is determined by the pathname.
  // navigateTo pushes a new route instead of setting ?view= query params.
  const navigateTo = (view) => {
    setActiveView(view);
    router.push('/' + view);
  };

  // Capture invite referral from URL param (?ref=uid) and persist in storage
  useEffect(() => {
    if (!searchParams) return;
    const refUid = searchParams.get('ref');
    if (refUid) {
      storage.set(STORAGE_KEYS.INVITE_REFERRER, refUid);
      // Clean ?ref from URL while keeping other params
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('ref');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
  }, [searchParams]);

  // Community stats
  const [communityStats, setCommunityStats] = useState(null);
  const [userRank, setUserRank] = useState(null);

  // Setlist scanning
  const [setlistScanning, setSetlistScanning] = useState(false);
  const [setlistScanProgress, setSetlistScanProgress] = useState({ current: 0, total: 0, found: 0 });

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Celebration animation
  const [showCelebration, setShowCelebration] = useState(false);

  // Friends feature state
  const [friends, setFriends] = useState([]);
  const [pendingFriendRequests, setPendingFriendRequests] = useState([]);
  const [sentFriendRequests, setSentFriendRequests] = useState([]);
  const [pendingShowTags, setPendingShowTags] = useState([]);
  const [tagFriendsShow, setTagFriendsShow] = useState(null);

  // Show Suggestions
  const [showSuggestions, setShowSuggestions] = useState([]);

  // Pending Invites
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteStats, setInviteStats] = useState(null);

  // Shared Memories
  const [memoriesShow, setMemoriesShow] = useState(null);
  const [sharedComments, setSharedComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Friend annotations for the currently selected show (main view)
  const [friendAnnotationsForShow, setFriendAnnotationsForShow] = useState(null);

  // In-app notifications
  const [unreadNotifications, setUnreadNotifications] = useState([]);

  // Admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Derived friends data
  const friendUids = useMemo(() => friends.map(f => f.friendUid), [friends]);

  // Derived suggestion state
  const myPendingSuggestions = showSuggestions.filter(s => s.responses?.[user?.uid] === 'pending' && s.overallStatus !== 'declined');
  const myConfirmedSuggestions = showSuggestions.filter(s => s.overallStatus === 'confirmed');

  const pendingNotificationCount = pendingFriendRequests.length + pendingShowTags.length + myPendingSuggestions.length + pendingInvites.length + unreadNotifications.length;
  const [upcomingShowsBadgeCount, setUpcomingShowsBadgeCount] = useState(null);

  // Post-signup welcome + pending tags
  const [welcomeState, setWelcomeState] = useState(null);
  const [pendingTagsForReview, setPendingTagsForReview] = useState([]);

  // Global toast notification
  const [toast, setToast] = useState(null);

  // Venue rating modal
  const [venueRatingShow, setVenueRatingShow] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Clear friendsInitialTab when navigating away from friends
  useEffect(() => {
    if (activeView !== 'friends') {
      setFriendsInitialTab(null);
    }
  }, [activeView]);

  // Listen for community stats (for login page)
  useEffect(() => {
    const statsRef = doc(db, 'communityStats', 'global');
    const unsubscribe = onSnapshot(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        setCommunityStats(snapshot.data());
      }
    }, (error) => {
      console.log('Community stats not available yet:', error.message);
    });

    return () => unsubscribe();
  }, []);

  // ── Load friends list ───────────────────────────────────────────────
  const loadFriends = useCallback(async () => {
    if (!user) return;
    try {
      const friendsRef = collection(db, 'users', user.uid, 'friends');
      const snapshot = await getDocs(friendsRef);
      setFriends(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  }, [user]);

  // Real-time listeners for friend requests and show tags
  useEffect(() => {
    if (!user || guestMode) return;

    loadFriends();

    // Incoming friend requests
    const qIncoming = query(collection(db, 'friendRequests'), where('to', '==', user.uid));
    const unsubIncoming = onSnapshot(qIncoming, (snapshot) => {
      setPendingFriendRequests(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => r.status === 'pending')
      );
    }, (error) => {
      console.log('Friend requests listener error:', error.message);
    });

    // Sent friend requests
    const qSent = query(collection(db, 'friendRequests'), where('from', '==', user.uid));
    const unsubSent = onSnapshot(qSent, (snapshot) => {
      setSentFriendRequests(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => r.status === 'pending')
      );
    }, (error) => {
      console.log('Sent requests listener error:', error.message);
    });

    // Incoming show tags
    const qTags = query(collection(db, 'showTags'), where('toUid', '==', user.uid));
    const unsubTags = onSnapshot(qTags, (snapshot) => {
      setPendingShowTags(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.status === 'pending')
      );
    }, (error) => {
      console.log('Show tags listener error:', error.message);
    });

    // Show suggestions
    const qSuggestions = query(collection(db, 'showSuggestions'), where('participants', 'array-contains', user.uid));
    const unsubSuggestions = onSnapshot(qSuggestions, (snapshot) => {
      setShowSuggestions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.log('Show suggestions listener error:', error.message);
    });

    // Pending invites this user has sent
    const qInvites = query(
      collection(db, 'invites'),
      where('inviterUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubInvites = onSnapshot(qInvites, (snapshot) => {
      setPendingInvites(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.log('Pending invites listener error:', error.message);
    });

    // In-app notifications
    const qNotifications = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      where('read', '==', false)
    );
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
      setUnreadNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.log('Notifications listener error:', error.message);
    });

    return () => {
      unsubIncoming();
      unsubSent();
      unsubTags();
      unsubSuggestions();
      unsubInvites();
      unsubNotifications();
    };
  }, [user, guestMode, loadFriends]);

  // ── Local data migration check ──────────────────────────────────────
  const checkForLocalData = useCallback(() => {
    try {
      const stored = storage.get(STORAGE_KEYS.LEGACY_SHOWS);
      if (stored) {
        const localShows = JSON.parse(stored);
        if (localShows && localShows.length > 0) {
          setLocalShowsToMigrate(localShows);
          setShowMigrationPrompt(true);
        }
      }
    } catch (error) {
      console.log('No local data to migrate');
    }
  }, []);

  // ── Rank calculation ────────────────────────────────────────────────
  const calculateUserRank = useCallback(async (userId) => {
    try {
      const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
      const profiles = profilesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = profiles.sort((a, b) => (b.showCount || 0) - (a.showCount || 0));
      const rank = sorted.findIndex(p => p.id === userId) + 1;
      setUserRank({ rank, total: profiles.length });
    } catch (error) {
      console.error('Failed to calculate rank:', error);
    }
  }, []);

  // ── Load shows from Firestore ───────────────────────────────────────
  const loadShows = useCallback(async (userId) => {
    setIsLoading(true);
    try {
      const showsRef = collection(db, 'users', userId, 'shows');
      const snapshot = await getDocs(showsRef);
      const loadedShows = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));
      setShows(loadedShows);

      if (auth.currentUser) {
        await updateUserProfile(auth.currentUser, loadedShows);
        updateCommunityStats();
        calculateUserRank(userId);
        runRetroactiveSuggestionScan().catch(() => {});
      }
    } catch (error) {
      console.error('Failed to load shows:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateUserRank]);

  // ── Guest shows (localStorage) ─────────────────────────────────────
  const loadGuestShows = useCallback(() => {
    try {
      const stored = storage.get(STORAGE_KEYS.GUEST_SHOWS);
      if (stored) {
        const guestShows = JSON.parse(stored);
        if (guestShows && guestShows.length > 0) {
          setShows(guestShows);
        }
      }
    } catch (error) {
      console.log('Failed to load guest shows:', error);
    }
    setIsLoading(false);
  }, []);

  const saveGuestShows = useCallback((showsToSave) => {
    try {
      storage.set(STORAGE_KEYS.GUEST_SHOWS, JSON.stringify(showsToSave));
    } catch (error) {
      console.log('Failed to save guest shows:', error);
    }
  }, []);

  // ── Auth state listener ─────────────────────────────────────────────
  useEffect(() => {
    // Safety timeout: if onAuthStateChanged never fires (e.g. IndexedDB hang
    // in WKWebView), stop showing the loading screen after 5 seconds
    const authTimeout = setTimeout(() => {
      setAuthLoading((prev) => {
        if (prev) console.warn('Auth state listener timed out — proceeding without auth');
        return false;
      });
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(authTimeout);
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        // Close auth modal when user signs in (belt-and-suspenders)
        setAuthModal(null);
        // Mark guest session as converted if the user was in guest mode
        try {
          const guestSessionId = storage.get(STORAGE_KEYS.GUEST_SESSION);
          if (guestSessionId) {
            let guestShowsAdded = 0;
            try {
              const guestSessionDoc = await getDoc(doc(db, 'guestSessions', guestSessionId));
              if (guestSessionDoc.exists()) {
                guestShowsAdded = guestSessionDoc.data().showsAdded || 0;
              }
            } catch (_) {}

            await updateDoc(doc(db, 'guestSessions', guestSessionId), {
              converted: true,
              convertedAt: serverTimestamp(),
              convertedUserId: currentUser.uid,
            });

            await setDoc(doc(db, 'userProfiles', currentUser.uid), {
              convertedFromGuest: true,
              guestSessionId: guestSessionId,
              guestConvertedAt: serverTimestamp(),
              guestShowsAdded: guestShowsAdded,
            }, { merge: true });

            storage.remove(STORAGE_KEYS.GUEST_SESSION);
          }
        } catch (error) {
          console.log('Failed to update guest session conversion:', error);
        }

        setGuestMode(false);
        checkForLocalData();

        // Also check for guest shows to migrate
        const guestStored = storage.get(STORAGE_KEYS.GUEST_SHOWS);
        if (guestStored) {
          const guestShows = JSON.parse(guestStored);
          if (guestShows && guestShows.length > 0) {
            setLocalShowsToMigrate(prev => [...prev, ...guestShows]);
            setShowMigrationPrompt(true);
          }
        }
        loadShows(currentUser.uid);
        loadInviteStats(currentUser.uid);

        // Auto-friend the user who invited them via referral link
        const referrerUid = storage.get(STORAGE_KEYS.INVITE_REFERRER);
        if (referrerUid && referrerUid !== currentUser.uid) {
          try {
            const existingFriend = await getDoc(doc(db, 'users', currentUser.uid, 'friends', referrerUid));
            if (!existingFriend.exists()) {
              const referrerProfile = await getDoc(doc(db, 'userProfiles', referrerUid));
              const referrerData = referrerProfile.exists() ? referrerProfile.data() : {};

              await setDoc(doc(db, 'users', currentUser.uid, 'friends', referrerUid), {
                friendUid: referrerUid,
                friendName: referrerData.displayName || referrerData.firstName || 'Friend',
                friendEmail: referrerData.email || '',
                friendPhotoURL: referrerData.photoURL || '',
                addedAt: serverTimestamp(),
              });

              await setDoc(doc(db, 'users', referrerUid, 'friends', currentUser.uid), {
                friendUid: currentUser.uid,
                friendName: currentUser.displayName || 'New Friend',
                friendEmail: currentUser.email || '',
                friendPhotoURL: currentUser.photoURL || '',
                addedAt: serverTimestamp(),
              });
            }
            storage.remove(STORAGE_KEYS.INVITE_REFERRER);
          } catch (err) {
            console.warn('Auto-friend from invite failed:', err);
            storage.remove(STORAGE_KEYS.INVITE_REFERRER);
          }
        }

        // ── Email-based invite lookup ─────────────────────────────────
        try {
          const inviteQuery = query(
            collection(db, 'invites'),
            where('inviteeEmail', '==', currentUser.email.toLowerCase()),
            where('status', '==', 'pending')
          );
          const inviteSnap = await getDocs(inviteQuery);
          if (!inviteSnap.empty) {
            const inviteDoc = inviteSnap.docs.sort((a, b) =>
              (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)
            )[0];
            const inviteData = inviteDoc.data();
            const { inviterUid, inviterName, inviterEmail } = inviteData;

            if (inviterUid && inviterUid !== currentUser.uid) {
              const existingFriend = await getDoc(doc(db, 'users', currentUser.uid, 'friends', inviterUid));
              if (!existingFriend.exists()) {
                const inviterProfile = await getDoc(doc(db, 'userProfiles', inviterUid));
                const inviterData = inviterProfile.exists() ? inviterProfile.data() : {};
                await setDoc(doc(db, 'users', currentUser.uid, 'friends', inviterUid), {
                  friendUid: inviterUid,
                  friendName: inviterData.displayName || inviterName || 'Friend',
                  friendEmail: inviterData.email || inviterEmail || '',
                  friendPhotoURL: inviterData.photoURL || '',
                  addedAt: serverTimestamp(),
                });
                await setDoc(doc(db, 'users', inviterUid, 'friends', currentUser.uid), {
                  friendUid: currentUser.uid,
                  friendName: currentUser.displayName || 'New Friend',
                  friendEmail: currentUser.email || '',
                  friendPhotoURL: currentUser.photoURL || '',
                  addedAt: serverTimestamp(),
                });
              }

              // Mark invite as accepted
              await setDoc(doc(db, 'invites', inviteDoc.id), { status: 'accepted' }, { merge: true });

              // Save invitedBy data on user profile
              await setDoc(doc(db, 'userProfiles', currentUser.uid), {
                invitedByUid: inviterUid,
                invitedByName: inviterName || '',
                invitedByEmail: inviterEmail || '',
                inviteAcceptedAt: serverTimestamp(),
              }, { merge: true });

              // Show welcome modal to the new user
              setWelcomeState({ inviterName: inviterName || 'your friend', inviterUid });

              // Notify inviter via email
              if (inviterEmail) {
                const newUserFirstName = (currentUser.displayName || 'Your friend').split(' ')[0];
                fetch(apiUrl('/api/send-email'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: inviterEmail,
                    subject: `${newUserFirstName} joined mysetlists.net via your invite!`,
                    html: `
                      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
                        <h2 style="color:#10b981">Your invite worked!</h2>
                        <p><strong>${currentUser.displayName || 'Your friend'}</strong> just joined mysetlists.net via your invite link — you're now friends on the app!</p>
                        <p style="margin:24px 0">
                          <a href="https://mysetlists.net" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                            Go to mysetlists.net →
                          </a>
                        </p>
                        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
                        <p style="color:#94a3b8;font-size:12px">mysetlists.net — track every show you've ever been to</p>
                      </div>
                    `,
                  }),
                }).catch(() => {});
              }
            }
          }
        } catch (err) {
          console.warn('Email invite lookup failed:', err);
        }

        // ── Pending email tags lookup ─────────────────────────────────
        try {
          const tagQuery = query(
            collection(db, 'pendingEmailTags'),
            where('toEmail', '==', currentUser.email.toLowerCase()),
            where('status', '==', 'pending')
          );
          const tagSnap = await getDocs(tagQuery);
          if (!tagSnap.empty) {
            setPendingTagsForReview(
              tagSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            );
          }
        } catch (err) {
          console.warn('Pending email tags lookup failed:', err);
        }

      } else if (guestMode) {
        loadGuestShows();
      } else {
        setShows([]);
        setIsLoading(false);
      }
    });

    return () => {
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, [checkForLocalData, loadShows, guestMode, loadGuestShows]);

  // ── Data migration ──────────────────────────────────────────────────
  const handleMigrateData = async () => {
    if (!user || localShowsToMigrate.length === 0) return;

    try {
      for (const show of localShowsToMigrate) {
        const showRef = doc(db, 'users', user.uid, 'shows', show.id);
        await setDoc(showRef, {
          ...show,
          createdAt: show.createdAt || serverTimestamp(),
          migratedFromLocal: true,
        });
      }
      storage.remove(STORAGE_KEYS.LEGACY_SHOWS);
      storage.remove(STORAGE_KEYS.GUEST_SHOWS);
      setShowMigrationPrompt(false);
      setLocalShowsToMigrate([]);
      loadShows(user.uid);
    } catch (error) {
      console.error('Failed to migrate data:', error);
      alert('Failed to migrate data. Please try again.');
    }
  };

  const handleSkipMigration = () => {
    setShowMigrationPrompt(false);
    setLocalShowsToMigrate([]);
  };

  // ── Auth handlers ───────────────────────────────────────────────────
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        alert('Login failed. Please try again.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShows([]);
      setSelectedShow(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const openAuthModal = (mode) => setAuthModal(mode);
  const closeAuthModal = () => setAuthModal(null);
  const switchAuthMode = (mode) => setAuthModal(mode);
  const handleAuthSuccess = () => setAuthModal(null);

  // ── Guest mode ──────────────────────────────────────────────────────
  const enterGuestMode = async () => {
    setGuestMode(true);
    loadGuestShows();

    try {
      let sessionId = storage.get(STORAGE_KEYS.GUEST_SESSION);
      if (!sessionId) {
        const sessionDoc = await addDoc(collection(db, 'guestSessions'), {
          startedAt: serverTimestamp(),
          converted: false,
          showsAdded: 0,
          userAgent: navigator.userAgent,
        });
        sessionId = sessionDoc.id;
        storage.set(STORAGE_KEYS.GUEST_SESSION, sessionId);
      }
    } catch (error) {
      console.log('Failed to track guest session:', error);
    }
  };

  // ── Show CRUD ───────────────────────────────────────────────────────
  const saveShow = async (updatedShow) => {
    if (guestMode) {
      const updatedShows = shows.map(s => s.id === updatedShow.id ? updatedShow : s);
      saveGuestShows(updatedShows);
      return;
    }
    if (!user) return;
    try {
      const showRef = doc(db, 'users', user.uid, 'shows', updatedShow.id);
      const { id, ...showData } = updatedShow;
      await setDoc(showRef, showData, { merge: true });
    } catch (error) {
      console.error('Failed to save show:', error);
    }
  };

  const addShow = async (showData) => {
    const showId = Date.now().toString();
    const newShow = {
      ...showData,
      id: showId,
      setlist: showData.setlist || [],
      createdAt: new Date().toISOString(),
      isManual: !showData.setlistfmId,
    };

    const isFirstShow = shows.length === 0;

    if (guestMode) {
      const updatedShows = [...shows, newShow];
      setShows(updatedShows);
      saveGuestShows(updatedShows);
      setShowForm(false);

      try {
        const sessionId = storage.get(STORAGE_KEYS.GUEST_SESSION);
        if (sessionId) {
          await updateDoc(doc(db, 'guestSessions', sessionId), { showsAdded: updatedShows.length });
        }
      } catch (error) {
        console.log('Failed to update guest session:', error);
      }

      if (isFirstShow) {
        setShowCelebration(true);
        setTimeout(() => {
          setShowCelebration(false);
          setShowGuestPrompt(true);
        }, 2000);
      }
      return showId;
    }

    if (!user) return null;

    try {
      const showRef = doc(db, 'users', user.uid, 'shows', showId);
      const { id, ...showDataWithoutId } = newShow;
      await setDoc(showRef, { ...showDataWithoutId, createdAt: serverTimestamp() });
      const updatedShows = [...shows, newShow];
      setShows(updatedShows);
      setShowForm(false);

      if (isFirstShow) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }

      await updateUserProfile(user, updatedShows);
      updateCommunityStats();
      calculateUserRank(user.uid, updatedShows.length);

      // Background suggestion check — non-blocking
      checkShowSuggestionsForNewShow(newShow).catch(() => {});

      return showId;
    } catch (error) {
      console.error('Failed to add show:', error);
      alert('Failed to add show. Please try again.');
      return null;
    }
  };

  const updateShowData = async (showId, updates) => {
    if (guestMode) {
      const updatedShows = shows.map(s => s.id === showId ? { ...s, ...updates } : s);
      setShows(updatedShows);
      saveGuestShows(updatedShows);
      return;
    }
    if (!user) return;
    try {
      const showRef = doc(db, 'users', user.uid, 'shows', showId);
      await updateDoc(showRef, updates);
      setShows(prev => prev.map(s => s.id === showId ? { ...s, ...updates } : s));
    } catch (error) {
      console.error('Failed to update show data:', error);
    }
  };

  // ── Setlist scanning ────────────────────────────────────────────────
  const scanForMissingSetlists = async () => {
    const showsWithoutSetlists = shows.filter(s => !s.setlist || s.setlist.length === 0);
    if (showsWithoutSetlists.length === 0) {
      alert('All your shows already have setlists!');
      return;
    }

    setSetlistScanning(true);
    setSetlistScanProgress({ current: 0, total: showsWithoutSetlists.length, found: 0 });
    let found = 0;

    const searchAndMatch = async (searchArtist, date, year) => {
      for (let page = 1; page <= 3; page++) {
        const params = new URLSearchParams({ artistName: searchArtist, year, p: String(page) });
        const response = await fetch(apiUrl(`/api/search-setlists?${params.toString()}`));
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.setlist || data.setlist.length === 0) return null;

        const match = data.setlist.find(s => {
          if (!s.eventDate) return false;
          const parts = s.eventDate.split('-');
          if (parts.length !== 3) return false;
          return `${parts[2]}-${parts[1]}-${parts[0]}` === date;
        });

        if (match) return match;
        if (data.setlist.length < 20) break;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return null;
    };

    const extractSongs = (match) => {
      const songs = [];
      let setIndex = 0;
      if (match.sets && match.sets.set) {
        match.sets.set.forEach(set => {
          if (set.song) {
            set.song.forEach(song => {
              songs.push({
                id: Date.now().toString() + Math.random(),
                name: song.name,
                cover: song.cover ? `${song.cover.name} cover` : null,
                setBreak: setIndex > 0 && set.song.indexOf(song) === 0
                  ? (set.encore ? `Encore${setIndex > 1 ? ` ${setIndex}` : ''}` : `Set ${setIndex + 1}`)
                  : (setIndex === 0 && set.song.indexOf(song) === 0 ? 'Main Set' : null),
              });
            });
          }
          setIndex++;
        });
      }
      return songs;
    };

    for (let i = 0; i < showsWithoutSetlists.length; i++) {
      const show = showsWithoutSetlists[i];
      try {
        if (!show.artist || !show.date) continue;
        const year = show.date.split('-')[0];

        let match = await searchAndMatch(show.artist, show.date, year);

        if (!match && show.artist.includes('&')) {
          await new Promise(resolve => setTimeout(resolve, 300));
          match = await searchAndMatch(show.artist.replace(/&/g, 'and'), show.date, year);
        }

        if (!match) {
          await new Promise(resolve => setTimeout(resolve, 300));
          if (show.artist.toLowerCase().startsWith('the ')) {
            match = await searchAndMatch(show.artist.substring(4), show.date, year);
          } else {
            match = await searchAndMatch('The ' + show.artist, show.date, year);
          }
        }

        if (match) {
          const songs = extractSongs(match);
          if (songs.length > 0) {
            const updates = { setlist: songs, setlistfmId: match.id, isManual: false };
            if (match.tour) updates.tour = match.tour.name;
            await updateShowData(show.id, updates);
            found++;
          }
        }
      } catch (err) {
        console.warn('Setlist scan error for', show.artist, err);
      }

      setSetlistScanProgress({ current: i + 1, total: showsWithoutSetlists.length, found });

      if (i < showsWithoutSetlists.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setSetlistScanning(false);
    if (found > 0) {
      alert(`Found ${found} new setlist${found !== 1 ? 's' : ''}!`);
    } else {
      alert('No new setlists found. Some shows may not have setlists on setlist.fm yet.');
    }
  };

  // ── Delete show ─────────────────────────────────────────────────────
  const deleteShow = async (showId) => {
    if (!window.confirm('Delete this show?')) return;

    if (guestMode) {
      const updatedShows = shows.filter(s => s.id !== showId);
      setShows(updatedShows);
      saveGuestShows(updatedShows);
      if (selectedShow?.id === showId) setSelectedShow(null);
      return;
    }

    if (!user) return;

    try {
      const showRef = doc(db, 'users', user.uid, 'shows', showId);
      await deleteDoc(showRef);
      const updatedShows = shows.filter(s => s.id !== showId);
      setShows(updatedShows);
      if (selectedShow?.id === showId) setSelectedShow(null);

      await updateUserProfile(user, updatedShows);
      updateCommunityStats();
      calculateUserRank(user.uid, updatedShows.length);
    } catch (error) {
      console.error('Failed to delete show:', error);
      alert('Failed to delete show. Please try again.');
    }
  };

  // === FRIEND FUNCTIONS ===

  const sendFriendRequest = async (targetUid, targetName, targetEmail) => {
    if (!user || targetUid === user.uid) {
      alert('You cannot send a friend request to yourself.');
      return;
    }

    try {
      const friendRef = doc(db, 'users', user.uid, 'friends', targetUid);
      const existingFriend = await getDoc(friendRef);
      if (existingFriend.exists()) {
        alert('You are already friends with this user.');
        return;
      }

      try {
        const allRequests = await getDocs(collection(db, 'friendRequests'));
        const pendingFromUs = allRequests.docs.find(d => {
          const data = d.data();
          return data.from === user.uid && data.to === targetUid && data.status === 'pending';
        });
        if (pendingFromUs) {
          alert('Friend request already sent.');
          return;
        }

        const pendingFromThem = allRequests.docs.find(d => {
          const data = d.data();
          return data.from === targetUid && data.to === user.uid && data.status === 'pending';
        });
        if (pendingFromThem) {
          await acceptFriendRequest(pendingFromThem.id);
          return;
        }
      } catch (readError) {
        console.log('Could not check existing requests, proceeding:', readError.message);
      }

      await addDoc(collection(db, 'friendRequests'), {
        from: user.uid,
        to: targetUid,
        fromName: user.displayName || 'Anonymous',
        fromEmail: user.email || '',
        toName: targetName || '',
        toEmail: targetEmail || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      alert('Friend request sent!');
    } catch (error) {
      console.error('Failed to send friend request:', error);
      alert('Failed to send friend request. Check the browser console for details — you may need to update Firestore security rules to allow the "friendRequests" collection.');
    }
  };

  const sendFriendRequestByEmail = async (email) => {
    if (!user) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail === user.email?.toLowerCase()) {
      alert('You cannot send a friend request to yourself.');
      return;
    }

    try {
      const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
      const matchingProfile = profilesSnapshot.docs.find(d =>
        d.data().email?.toLowerCase() === trimmedEmail
      );
      if (!matchingProfile) {
        alert('No user found with that email address. They may need to sign up first.');
        return;
      }
      await sendFriendRequest(matchingProfile.id, matchingProfile.data().displayName, matchingProfile.data().email);
    } catch (error) {
      console.error('Failed to find user or send request:', error);
      alert('Something went wrong. Check the browser console (F12) for details — this may be a Firestore permissions issue with new collections.');
    }
  };

  const acceptFriendRequest = async (requestId) => {
    if (!user) return;
    try {
      const reqRef = doc(db, 'friendRequests', requestId);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const reqData = reqSnap.data();

      await setDoc(reqRef, { status: 'accepted' }, { merge: true });

      const myFriendRef = doc(db, 'users', user.uid, 'friends', reqData.from);
      await setDoc(myFriendRef, {
        friendUid: reqData.from,
        friendName: reqData.fromName,
        friendEmail: reqData.fromEmail,
        friendPhotoURL: '',
        addedAt: serverTimestamp(),
      });

      const theirFriendRef = doc(db, 'users', reqData.from, 'friends', user.uid);
      await setDoc(theirFriendRef, {
        friendUid: user.uid,
        friendName: user.displayName || 'Anonymous',
        friendEmail: user.email || '',
        friendPhotoURL: user.photoURL || '',
        addedAt: serverTimestamp(),
      });

      await loadFriends();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      alert('Failed to accept friend request. Please try again.');
    }
  };

  const declineFriendRequest = async (requestId) => {
    try {
      const reqRef = doc(db, 'friendRequests', requestId);
      await setDoc(reqRef, { status: 'declined' }, { merge: true });
    } catch (error) {
      console.error('Failed to decline friend request:', error);
    }
  };

  const removeFriend = async (friendUid) => {
    if (!user) return;
    if (!window.confirm('Remove this friend?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'friends', friendUid));
      await deleteDoc(doc(db, 'users', friendUid, 'friends', user.uid));
      setFriends(prev => prev.filter(f => f.friendUid !== friendUid));
    } catch (error) {
      console.error('Failed to remove friend:', error);
    }
  };

  // === SHOW TAGGING FUNCTIONS ===

  const sanitizeShowForTag = (show) => ({
    artist: show.artist,
    venue: show.venue,
    date: show.date,
    city: show.city || '',
    tour: show.tour || '',
    setlistfmId: show.setlistfmId || null,
    isManual: show.isManual || false,
    setlist: (show.setlist || []).map(song => ({
      id: song.id,
      name: song.name,
    })),
  });

  const tagFriendsAtShow = async (show, selectedFriendUids) => {
    if (!user || selectedFriendUids.length === 0) return;
    const sanitizedShow = sanitizeShowForTag(show);
    try {
      const batch = writeBatch(db);
      for (const friendUid of selectedFriendUids) {
        const ref = doc(collection(db, 'showTags'));
        batch.set(ref, {
          fromUid: user.uid,
          fromName: user.displayName || 'Anonymous',
          toUid: friendUid,
          showData: sanitizedShow,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();

      const existingUids = show.taggedFriendUids || [];
      const mergedUids = [...new Set([...existingUids, ...selectedFriendUids])];
      const updatedShow = { ...show, taggedFriendUids: mergedUids };
      const updatedShows = shows.map(s => s.id === show.id ? updatedShow : s);
      setShows(updatedShows);
      await saveShow(updatedShow);

      setTagFriendsShow(null);
      setToast(`Tagged ${selectedFriendUids.length} friend${selectedFriendUids.length !== 1 ? 's' : ''} at ${show.artist}!`);
    } catch (error) {
      console.error('Failed to tag friends:', error);
      alert('Failed to tag friends. Please try again.');
    }
  };

  // === SHOWS TOGETHER ===

  const getShowsTogether = async (friendUid) => {
    const [mySnap, theirSnap] = await Promise.all([
      getDocs(collection(db, 'users', user.uid, 'shows')),
      getDocs(collection(db, 'users', friendUid, 'shows')),
    ]);
    const myShows = mySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const theirShows = theirSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const norm = s => (s || '').trim().toLowerCase();
    const key = s => s.setlistfmId || `${norm(s.artist)}|${norm(s.venue)}|${norm(s.date)}`;
    const theirMap = {};
    theirShows.forEach(s => { theirMap[key(s)] = s; });
    return myShows
      .filter(s => theirMap[key(s)])
      .map(s => ({ ...s, friendShow: theirMap[key(s)] }));
  };

  // === FRIEND ANNOTATIONS FOR SHOW VIEW ===
  const fetchFriendAnnotations = useCallback(async (show) => {
    if (!user || !show || guestMode) { setFriendAnnotationsForShow(null); return; }
    try {
      // Case 1: I was tagged in this show
      if (show.taggedByUid) {
        const friendUid = show.taggedByUid;
        const friendName = show.taggedBy || 'Friend';
        const snap = await getDocs(collection(db, 'users', friendUid, 'shows'));
        const norm = v => (v || '').trim().toLowerCase();
        const key = s => s.setlistfmId || `${norm(s.artist)}|${norm(s.venue)}|${norm(s.date)}`;
        const showKey = key(show);
        const friendShow = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(s => key(s) === showKey);
        if (friendShow) {
          setFriendAnnotationsForShow({ friendName, friendShow });
          return;
        }
      }

      // Case 2: I tagged friends in this show
      if (show.taggedFriendUids && show.taggedFriendUids.length > 0) {
        const norm = v => (v || '').trim().toLowerCase();
        const key = s => s.setlistfmId || `${norm(s.artist)}|${norm(s.venue)}|${norm(s.date)}`;
        const showKey = key(show);
        for (const friendUid of show.taggedFriendUids) {
          const friend = friends.find(f => f.friendUid === friendUid);
          if (!friend) continue;
          const snap = await getDocs(collection(db, 'users', friendUid, 'shows'));
          const friendShow = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(s => key(s) === showKey);
          if (friendShow && (friendShow.comment || friendShow.rating || friendShow.setlist?.some(s => s.comment || s.rating))) {
            setFriendAnnotationsForShow({ friendName: friend.name || friend.displayName || 'Friend', friendShow });
            return;
          }
        }
      }

      // Case 3: No tagging link — check all friends for a matching show with notes
      if (friends.length > 0) {
        const norm = v => (v || '').trim().toLowerCase();
        const key = s => s.setlistfmId || `${norm(s.artist)}|${norm(s.venue)}|${norm(s.date)}`;
        const showKey = key(show);
        for (const friend of friends) {
          const snap = await getDocs(collection(db, 'users', friend.friendUid, 'shows'));
          const friendShow = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(s => key(s) === showKey);
          if (friendShow && (friendShow.comment || friendShow.rating || friendShow.setlist?.some(s => s.comment || s.rating))) {
            setFriendAnnotationsForShow({ friendName: friend.name || friend.displayName || 'Friend', friendShow });
            return;
          }
        }
      }

      setFriendAnnotationsForShow(null);
    } catch (e) {
      console.error('Failed to fetch friend annotations:', e);
      setFriendAnnotationsForShow(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, guestMode, friends]);

  // Fetch friend annotations whenever a show is selected in the main view
  useEffect(() => {
    if (selectedShow && activeView === 'shows') {
      fetchFriendAnnotations(selectedShow);
    } else {
      setFriendAnnotationsForShow(null);
    }
  }, [selectedShow, activeView, fetchFriendAnnotations]);

  // === SHOW SUGGESTIONS ===

  const normalizeShowKey = (show) => {
    const norm = v => (v || '').trim().toLowerCase();
    return show.setlistfmId || `${norm(show.artist)}|${norm(show.venue)}|${norm(show.date)}`;
  };

  const buildSuggestionDocId = (uid1raw, uid2raw, showKey) => {
    const [uid1, uid2] = [uid1raw, uid2raw].sort();
    return `${uid1}_${uid2}_${showKey.replace(/[^a-z0-9]/g, '_').slice(0, 80)}`;
  };

  const createShowSuggestion = async (friendUid, friendName, show) => {
    if (!user) return;
    const showKey = normalizeShowKey(show);
    const [uid1, uid2] = [user.uid, friendUid].sort();
    const docId = buildSuggestionDocId(uid1, uid2, showKey);
    const ref = doc(db, 'showSuggestions', docId);
    try {
      const existing = await getDoc(ref);
      if (existing.exists()) return;
      const myName = user.displayName || 'Someone';
      const name1 = uid1 === user.uid ? myName : friendName;
      const name2 = uid2 === user.uid ? myName : friendName;
      await setDoc(ref, {
        participants: [uid1, uid2],
        names: { [uid1]: name1, [uid2]: name2 },
        showKey,
        showData: {
          artist: show.artist || '',
          venue: show.venue || '',
          date: show.date || '',
          city: show.city || '',
          setlistfmId: show.setlistfmId || null,
        },
        responses: { [uid1]: 'pending', [uid2]: 'pending' },
        overallStatus: 'pending',
        emailSentToUid: null,
        emailSentAt: null,
        lastViewedAt: { [uid1]: null, [uid2]: null },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to create show suggestion:', e);
    }
  };

  const checkShowSuggestionsForNewShow = async (newShow) => {
    if (!user || guestMode || friends.length === 0) return;
    const showKey = normalizeShowKey(newShow);
    for (const friend of friends) {
      try {
        const theirSnap = await getDocs(collection(db, 'users', friend.friendUid, 'shows'));
        const hasMatch = theirSnap.docs.some(d => {
          const s = d.data();
          return normalizeShowKey(s) === showKey;
        });
        if (hasMatch) {
          await createShowSuggestion(friend.friendUid, friend.friendName, newShow);
        }
      } catch (e) {
        console.error('Suggestion check error for friend:', friend.friendUid, e);
      }
    }
  };

  // Retroactive scan — runs once ever per user (localStorage flag).
  const runRetroactiveSuggestionScan = async () => {
    if (!user || guestMode || friends.length === 0 || shows.length === 0) return;
    const flagKey = `suggestionScan_${user.uid}`;
    if (storage.get(flagKey)) return;
    try {
      const existingSnap = await getDocs(
        query(collection(db, 'showSuggestions'), where('participants', 'array-contains', user.uid))
      );
      const existingIds = new Set(existingSnap.docs.map(d => d.id));
      for (const friend of friends) {
        try {
          const theirSnap = await getDocs(collection(db, 'users', friend.friendUid, 'shows'));
          const theirShows = theirSnap.docs.map(d => d.data());
          const theirKeySet = new Set(theirShows.map(s => normalizeShowKey(s)));
          for (const myShow of shows) {
            const showKey = normalizeShowKey(myShow);
            if (!theirKeySet.has(showKey)) continue;
            const docId = buildSuggestionDocId(user.uid, friend.friendUid, showKey);
            if (existingIds.has(docId)) continue;
            await createShowSuggestion(friend.friendUid, friend.friendName, myShow);
            existingIds.add(docId);
          }
        } catch (e) {
          console.error('Retroactive scan error for friend:', friend.friendUid, e);
        }
      }
      storage.set(flagKey, '1');
    } catch (e) {
      console.error('Retroactive suggestion scan failed:', e);
    }
  };

  const respondToSuggestion = async (suggestion, response) => {
    if (!user) return;
    const friendUid = suggestion.participants.find(uid => uid !== user.uid);
    const theirResponse = suggestion.responses?.[friendUid];
    let newOverallStatus;
    if (response === 'declined') {
      newOverallStatus = 'declined';
    } else if (theirResponse === 'confirmed') {
      newOverallStatus = 'confirmed';
    } else {
      newOverallStatus = 'partially_confirmed';
    }
    const ref = doc(db, 'showSuggestions', suggestion.id);
    try {
      await updateDoc(ref, {
        [`responses.${user.uid}`]: response,
        overallStatus: newOverallStatus,
        updatedAt: serverTimestamp(),
      });
      // Send email nudge when we confirm and friend hasn't responded yet
      if (response === 'confirmed' && theirResponse === 'pending' && !suggestion.emailSentToUid) {
        const friendData = friends.find(f => f.friendUid === friendUid);
        if (friendData?.friendEmail) {
          const friendName = suggestion.names?.[friendUid] || 'your friend';
          const { artist, venue, date } = suggestion.showData;
          await fetch(apiUrl('/api/send-email'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: friendData.friendEmail,
              subject: `${user.displayName || 'A friend'} thinks you were both at ${artist}!`,
              html: `<p>Hey ${friendName},</p><p><strong>${user.displayName || 'A friend'}</strong> confirmed they were at <strong>${artist}</strong> at ${venue} on ${date} — and thinks you might have been there too. Were you there together?</p><p><a href="https://mysetlists.net/friends">Open MySetlists to confirm or dismiss</a></p>`,
            }),
          });
          await updateDoc(ref, { emailSentToUid: friendUid, emailSentAt: serverTimestamp() });
        }
      }
    } catch (e) {
      console.error('Failed to respond to suggestion:', e);
    }
  };

  // === SHARED MEMORIES ===

  const loadSharedComments = async (suggestionId) => {
    setCommentsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'showSuggestions', suggestionId, 'comments'));
      const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      comments.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setSharedComments(comments);
    } catch (e) {
      console.error('Failed to load shared comments:', e);
    }
    setCommentsLoading(false);
  };

  const openMemories = async (suggestion) => {
    const show = shows.find(s => normalizeShowKey(s) === suggestion.showKey) ||
                 { artist: suggestion.showData.artist, venue: suggestion.showData.venue, date: suggestion.showData.date };
    setMemoriesShow({ suggestion, show });
    await loadSharedComments(suggestion.id);
    try {
      await updateDoc(doc(db, 'showSuggestions', suggestion.id), {
        [`lastViewedAt.${user.uid}`]: serverTimestamp(),
      });
    } catch (e) { /* non-critical */ }
  };

  const addSharedComment = async (suggestionId, text, suggestion) => {
    if (!user || !text.trim()) return;
    try {
      const commentRef = await addDoc(collection(db, 'showSuggestions', suggestionId, 'comments'), {
        authorUid: user.uid,
        authorName: user.displayName || 'Someone',
        text: text.trim().slice(0, 500),
        createdAt: serverTimestamp(),
        editedAt: null,
      });
      setSharedComments(prev => [...prev, {
        id: commentRef.id,
        authorUid: user.uid,
        authorName: user.displayName || 'Someone',
        text: text.trim().slice(0, 500),
        createdAt: { seconds: Date.now() / 1000 },
        editedAt: null,
      }]);
      // Email the other participant if they haven't been notified recently
      const otherUid = suggestion.participants.find(uid => uid !== user.uid);
      const otherLastViewed = suggestion.lastViewedAt?.[otherUid];
      const shouldEmail = !otherLastViewed;
      if (shouldEmail) {
        const friendData = friends.find(f => f.friendUid === otherUid);
        if (friendData?.friendEmail) {
          const { artist, date } = suggestion.showData;
          await fetch(apiUrl('/api/send-email'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: friendData.friendEmail,
              subject: `${user.displayName || 'A friend'} added a memory from ${artist}`,
              html: `<p><strong>${user.displayName || 'A friend'}</strong> added a comment to your shared memory of <strong>${artist}</strong> (${date}).</p><p><a href="https://mysetlists.net/friends">Open MySetlists to see and reply</a></p>`,
            }),
          });
        }
      }
    } catch (e) {
      console.error('Failed to add comment:', e);
    }
  };

  const editSharedComment = async (suggestionId, commentId, newText) => {
    try {
      await updateDoc(doc(db, 'showSuggestions', suggestionId, 'comments', commentId), {
        text: newText.trim().slice(0, 500),
        editedAt: serverTimestamp(),
      });
      setSharedComments(prev => prev.map(c => c.id === commentId ? { ...c, text: newText.trim(), editedAt: { seconds: Date.now() / 1000 } } : c));
    } catch (e) { console.error('Failed to edit comment:', e); }
  };

  const deleteSharedComment = async (suggestionId, commentId) => {
    try {
      await deleteDoc(doc(db, 'showSuggestions', suggestionId, 'comments', commentId));
      setSharedComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) { console.error('Failed to delete comment:', e); }
  };

  // ── Show tag accept / decline ───────────────────────────────────────
  const acceptShowTag = async (tagId) => {
    if (!user) return;
    try {
      const tagRef = doc(db, 'showTags', tagId);
      const tagSnap = await getDoc(tagRef);
      if (!tagSnap.exists()) return;
      const tagData = tagSnap.data();

      await addShow({
        ...tagData.showData,
        taggedBy: tagData.fromName,
        taggedByUid: tagData.fromUid,
      });

      await setDoc(tagRef, { status: 'accepted' }, { merge: true });
    } catch (error) {
      console.error('Failed to accept show tag:', error);
      alert('Failed to import tagged show. Please try again.');
    }
  };

  const declineShowTag = async (tagId) => {
    try {
      const tagRef = doc(db, 'showTags', tagId);
      await setDoc(tagRef, { status: 'declined' }, { merge: true });
    } catch (error) {
      console.error('Failed to decline show tag:', error);
    }
  };

  // Bulk accept all pending show tags + suggestions
  const bulkAcceptAll = async (tags, suggestions) => {
    const results = await Promise.allSettled([
      ...tags.map(tag => acceptShowTag(tag.id)),
      ...suggestions.map(s => respondToSuggestion(s, 'confirmed')),
    ]);
    const accepted = results.filter(r => r.status === 'fulfilled').length;
    setToast(`Accepted ${accepted} pending item${accepted !== 1 ? 's' : ''}`);
  };

  // Bulk accept pending items from a specific friend
  const bulkAcceptFromFriend = async (friendUid, tags, suggestions) => {
    const friendTags = tags.filter(t => t.fromUid === friendUid);
    const friendSuggestions = suggestions.filter(s => s.participants?.includes(friendUid));
    const results = await Promise.allSettled([
      ...friendTags.map(tag => acceptShowTag(tag.id)),
      ...friendSuggestions.map(s => respondToSuggestion(s, 'confirmed')),
    ]);
    const accepted = results.filter(r => r.status === 'fulfilled').length;
    setToast(`Accepted ${accepted} item${accepted !== 1 ? 's' : ''}`);
  };

  // Accept a pending email tag (new user confirming a show tagged before they joined)
  const acceptPendingEmailTag = async (tag) => {
    if (!user) return;
    try {
      await addShow({ ...tag.showData, taggedBy: tag.fromName, taggedByUid: tag.fromUid });
      await setDoc(doc(db, 'pendingEmailTags', tag.id), { status: 'accepted' }, { merge: true });
      if (tag.fromEmail) {
        const newUserFirstName = (user.displayName || 'Your friend').split(' ')[0];
        fetch(apiUrl('/api/send-email'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: tag.fromEmail,
            subject: `${newUserFirstName} confirmed they were at ${tag.showData.artist} with you!`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
                <h2 style="color:#10b981">They were there!</h2>
                <p><strong>${user.displayName || 'Your friend'}</strong> just confirmed they were at
                <strong>${tag.showData.artist}</strong>${tag.showData.venue ? ` at ${tag.showData.venue}` : ''}${tag.showData.date ? ` on ${formatDate(tag.showData.date)}` : ''} with you!</p>
                <p>The show has been added to their setlist history on mysetlists.net.</p>
                <p style="margin:24px 0">
                  <a href="https://mysetlists.net" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                    View their profile →
                  </a>
                </p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
                <p style="color:#94a3b8;font-size:12px">mysetlists.net — track every show you've ever been to</p>
              </div>
            `,
          }),
        }).catch(() => {});
      }
      setPendingTagsForReview(prev => prev.filter(t => t.id !== tag.id));
    } catch (error) {
      console.error('Failed to accept pending email tag:', error);
    }
  };

  const declinePendingEmailTag = async (tag) => {
    try {
      await setDoc(doc(db, 'pendingEmailTags', tag.id), { status: 'declined' }, { merge: true });
      setPendingTagsForReview(prev => prev.filter(t => t.id !== tag.id));
    } catch (error) {
      console.error('Failed to decline pending email tag:', error);
    }
  };

  // Tag a non-registered friend at a show and send them an invite email
  const tagFriendByEmail = async ({ name, email: toEmailRaw, message, show }) => {
    if (!user) return;
    const toEmail = toEmailRaw.trim().toLowerCase();
    const sanitizedShow = sanitizeShowForTag(show);
    try {
      await addDoc(collection(db, 'pendingEmailTags'), {
        fromUid: user.uid,
        fromName: user.displayName || 'Anonymous',
        fromEmail: user.email || '',
        toEmail,
        toName: name,
        showData: sanitizedShow,
        personalMessage: message || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      const inviterName = user.displayName || 'A friend';
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
          <h2 style="color:#10b981">${inviterName} tagged you in a show!</h2>
          <p><strong>${inviterName}</strong> saw <strong>${sanitizedShow.artist}</strong>${sanitizedShow.venue ? ` at ${sanitizedShow.venue}` : ''}${sanitizedShow.date ? ` on ${formatDate(sanitizedShow.date)}` : ''} and thinks you were there too!</p>
          ${message ? `<blockquote style="border-left:3px solid #10b981;padding-left:16px;color:#475569;font-style:italic;margin:16px 0">${message}</blockquote>` : ''}
          <p>Join mysetlists.net to confirm the show and add it to your concert history:</p>
          <p style="margin:24px 0">
            <a href="https://mysetlists.net?ref=${user.uid}" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Join mysetlists.net →
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">mysetlists.net — track every show you've ever been to</p>
        </div>
      `;
      await fetch(apiUrl('/api/send-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject: `${inviterName} tagged you in a show on mysetlists.net!`,
          html,
        }),
      });
    } catch (error) {
      console.error('Failed to tag friend by email:', error);
      throw error;
    }
  };

  // === NOTIFICATION MANAGEMENT ===

  const markNotificationsRead = useCallback(async () => {
    if (!user || unreadNotifications.length === 0) return;
    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit().catch(() => {});
  }, [user, unreadNotifications]);

  // === INVITE MANAGEMENT FUNCTIONS ===

  const loadInviteStats = async (uid) => {
    if (!uid) return;
    try {
      const snap = await getDocs(query(collection(db, 'invites'), where('inviterUid', '==', uid)));
      const docs = snap.docs.map(d => d.data());
      setInviteStats({
        total: docs.length,
        accepted: docs.filter(d => d.status === 'accepted').length,
      });
    } catch (err) {
      console.log('Failed to load invite stats:', err);
    }
  };

  const sendInvite = async (email) => {
    if (!user) return { error: 'Not signed in' };
    const toEmail = email.trim().toLowerCase();

    const existing = pendingInvites.find(inv => inv.inviteeEmail === toEmail);
    if (existing) {
      return { error: 'You already have a pending invite for this email. You can resend it from the Friends > Invites tab.' };
    }

    try {
      const inviterDisplayName = user.displayName || 'A friend';
      const inviteUrl = `https://mysetlists.net?ref=${user.uid}`;
      await addDoc(collection(db, 'invites'), {
        inviterUid: user.uid,
        inviterName: inviterDisplayName,
        inviterEmail: user.email || '',
        inviteeEmail: toEmail,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
          <h2 style="color:#10b981">Hey! ${inviterDisplayName} wants you to join mysetlists.net</h2>
          <p>${inviterDisplayName} has been tracking all their concerts on mysetlists.net \u2014 saving setlists, rating songs, and seeing their all-time stats. They think you'd love it too.</p>
          <p style="margin:24px 0">
            <a href="${inviteUrl}" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Join mysetlists.net \u2192
            </a>
          </p>
          <p style="color:#64748b;font-size:14px">When you sign up, you and ${inviterDisplayName} will automatically be friends on the app.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">mysetlists.net \u2014 track every show you've ever been to</p>
        </div>
      `;
      await fetch(apiUrl('/api/send-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject: `${inviterDisplayName} invited you to mysetlists.net!`,
          html,
        }),
      });
      loadInviteStats(user.uid);
      return { success: true };
    } catch (err) {
      console.error('Invite send failed:', err);
      return { error: 'Failed to send invite. Please try again.' };
    }
  };

  const resendInvite = async (invite) => {
    if (!user) return;
    const lastSent = invite.lastSentAt?.toMillis?.() ?? invite.createdAt?.toMillis?.() ?? 0;
    if (Date.now() - lastSent < 24 * 60 * 60 * 1000) {
      setToast('You can only resend to the same person once per 24 hours.');
      return false;
    }
    try {
      const inviterDisplayName = user.displayName || 'A friend';
      const inviteUrl = `https://mysetlists.net?ref=${user.uid}`;
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
          <h2 style="color:#10b981">Hey! ${inviterDisplayName} wants you to join mysetlists.net</h2>
          <p>${inviterDisplayName} has been tracking all their concerts on mysetlists.net \u2014 saving setlists, rating songs, and seeing their all-time stats. They think you'd love it too.</p>
          <p style="margin:24px 0">
            <a href="${inviteUrl}" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Join mysetlists.net \u2192
            </a>
          </p>
          <p style="color:#64748b;font-size:14px">When you sign up, you and ${inviterDisplayName} will automatically be friends on the app.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">mysetlists.net \u2014 track every show you've ever been to</p>
        </div>
      `;
      const res = await fetch(apiUrl('/api/send-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: invite.inviteeEmail,
          subject: `${inviterDisplayName} invited you to mysetlists.net!`,
          html,
        }),
      });
      if (!res.ok) throw new Error('Email send failed');
      await updateDoc(doc(db, 'invites', invite.id), { lastSentAt: serverTimestamp() });
      setToast(`Invite resent to ${invite.inviteeEmail}`);
      return true;
    } catch (err) {
      console.error('Resend invite failed:', err);
      setToast('Failed to resend invite. Please try again.');
      return false;
    }
  };

  const cancelInvite = async (inviteId) => {
    try {
      await deleteDoc(doc(db, 'invites', inviteId));
    } catch (err) {
      console.error('Cancel invite failed:', err);
      setToast('Failed to cancel invite. Please try again.');
    }
  };

  // ── Show / song rating & comment handlers ──────────────────────────
  const updateShowRating = async (showId, rating) => {
    const updatedShows = shows.map(show =>
      show.id === showId ? { ...show, rating } : show
    );
    setShows(updatedShows);
    if (selectedShow?.id === showId) {
      setSelectedShow(updatedShows.find(s => s.id === showId));
    }
    await saveShow(updatedShows.find(s => s.id === showId));
  };

  const updateShowComment = async (showId, comment) => {
    const updatedShows = shows.map(show =>
      show.id === showId ? { ...show, comment } : show
    );
    setShows(updatedShows);
    if (selectedShow?.id === showId) {
      setSelectedShow(updatedShows.find(s => s.id === showId));
    }
    await saveShow(updatedShows.find(s => s.id === showId));
  };

  const addSongToShow = async (showId, songData) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: [...show.setlist, {
            id: Date.now().toString(),
            ...songData,
            rating: null,
          }],
        };
      }
      return show;
    });
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  const updateSongRating = async (showId, songId, rating) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.map(song =>
            song.id === songId ? { ...song, rating } : song
          ),
        };
      }
      return show;
    });
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  const updateSongComment = async (showId, songId, comment) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.map(song =>
            song.id === songId ? { ...song, comment } : song
          ),
        };
      }
      return show;
    });
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  const batchRateUnrated = async (showId, rating) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.map(song =>
            song.rating ? song : { ...song, rating }
          ),
        };
      }
      return show;
    });
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  const deleteSong = async (showId, songId) => {
    const updatedShows = shows.map(show => {
      if (show.id === showId) {
        return {
          ...show,
          setlist: show.setlist.filter(s => s.id !== songId),
        };
      }
      return show;
    });
    const updatedShow = updatedShows.find(s => s.id === showId);
    setShows(updatedShows);
    setSelectedShow(updatedShow);
    await saveShow(updatedShow);
  };

  // ── Stats helpers ───────────────────────────────────────────────────
  const getSongStats = () => {
    const songMap = {};
    shows.forEach(show => {
      show.setlist.forEach(song => {
        if (!songMap[song.name]) {
          songMap[song.name] = { count: 0, ratings: [], shows: [] };
        }
        songMap[song.name].count++;
        if (song.rating) songMap[song.name].ratings.push(song.rating);
        songMap[song.name].shows.push({
          showId: show.id,
          songId: song.id,
          date: show.date,
          artist: show.artist,
          venue: show.venue,
          city: show.city,
          rating: song.rating,
          comment: song.comment,
        });
      });
    });
    return Object.entries(songMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgRating: data.ratings.length ?
          (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1) : null,
        shows: data.shows,
      }))
      .sort((a, b) => b.count - a.count);
  };

  const getArtistStats = () => {
    const artistMap = {};
    shows.forEach(show => {
      if (!artistMap[show.artist]) {
        artistMap[show.artist] = { count: 0, ratings: [], uniqueSongs: new Set() };
      }
      artistMap[show.artist].count++;
      show.setlist.forEach(song => artistMap[show.artist].uniqueSongs.add(song.name.toLowerCase().trim()));
      if (show.rating) artistMap[show.artist].ratings.push(show.rating);
    });
    return Object.entries(artistMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalSongs: data.uniqueSongs.size,
        avgRating: data.ratings.length ?
          (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1) : null,
      }))
      .sort((a, b) => b.count - a.count);
  };

  const getVenueStats = () => {
    const venueMap = {};
    shows.forEach(show => {
      const key = show.venue + (show.city ? `, ${show.city}` : '');
      if (!venueMap[key]) {
        venueMap[key] = { count: 0, artists: new Set() };
      }
      venueMap[key].count++;
      venueMap[key].artists.add(show.artist);
    });
    return Object.entries(venueMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        artists: data.artists.size,
      }))
      .sort((a, b) => b.count - a.count);
  };

  // === VENUE RATING HELPERS ===

  const normalizeVenueKey = (venue, city) =>
    `${(venue || '').trim().toLowerCase()}::${(city || '').trim().toLowerCase()}`;

  const getVenueRatings = async (venueKey) => {
    const snap = await getDocs(query(collection(db, 'venueRatings'), where('venueKey', '==', venueKey)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  const computeVenueAggregate = (ratings) => {
    if (!ratings.length) return null;
    const avg = arr => {
      const valid = arr.filter(v => v != null && v > 0);
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };
    return {
      count: ratings.length,
      overallAvg: avg(ratings.map(r => r.overallRating)),
      subAvgs: {
        soundQuality: avg(ratings.map(r => r.subRatings?.soundQuality)),
        sightlines: avg(ratings.map(r => r.subRatings?.sightlines)),
        atmosphere: avg(ratings.map(r => r.subRatings?.atmosphere)),
        accessibility: avg(ratings.map(r => r.subRatings?.accessibility)),
        foodDrinks: avg(ratings.map(r => r.subRatings?.foodDrinks)),
      },
    };
  };

  const getTopRatedShows = () => {
    return shows
      .filter(s => s.rating)
      .sort((a, b) => b.rating - a.rating || parseDate(b.date) - parseDate(a.date))
      .slice(0, 10);
  };

  // ── Share collection ────────────────────────────────────────────────
  const shareCollection = async () => {
    const ratedShows = shows.filter(s => s.rating);
    const avgShowRating = ratedShows.length
      ? (ratedShows.reduce((acc, s) => acc + s.rating, 0) / ratedShows.length).toFixed(1)
      : null;

    const totalSongs = shows.reduce((acc, show) => acc + (show.setlist?.length || 0), 0);

    // Find top artist
    const artistCounts = {};
    shows.forEach(s => { artistCounts[s.artist] = (artistCounts[s.artist] || 0) + 1; });
    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Try to create a persistent shareable link
    try {
      if (user && !guestMode) {
        const token = await user.getIdToken();
        const res = await fetch(apiUrl('/.netlify/functions/create-shared-collection'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            shows: shows.map(s => ({
              artist: s.artist,
              venue: s.venue,
              city: s.city || '',
              date: s.date || '',
              rating: s.rating || null,
              setlist: (s.setlist || []).map(song => ({ name: song.name, rating: song.rating || null })),
            })),
            stats: {
              totalShows: shows.length,
              totalSongs,
              topArtist,
              avgRating: avgShowRating,
            },
            ownerName: user.displayName || user.email?.split('@')[0] || 'A Fan',
          }),
        });

        if (res.ok) {
          const { url } = await res.json();
          await navigator.clipboard.writeText(url);
          setToast({ message: 'Share link copied to clipboard!', type: 'success' });
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to create shared collection, falling back to text share:', err);
    }

    // Fallback: copy text to clipboard
    const shareText = `My Concert Collection\n\n${shows.length} shows | ${totalSongs} songs${avgShowRating ? ` | Avg show rating: ${avgShowRating}/10` : ''}\n\nTop Songs:\n${getSongStats().slice(0, 5).map((s, i) => `${i + 1}. ${s.name} (${s.count}x)`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(shareText);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (error) {
      alert(shareText);
    }
  };

  // ── Derived / memoized data ─────────────────────────────────────────
  const importedIds = useMemo(() => new Set(shows.map(s => s.setlistfmId).filter(Boolean)), [shows]);

  const availableYears = useMemo(() => {
    const years = [...new Set(shows.map(s => {
      const d = parseDate(s.date);
      return d.getFullYear();
    }).filter(y => y > 1900))];
    return years.sort((a, b) => b - a);
  }, [shows]);

  const sortedFilteredShows = useMemo(() => {
    let filtered = shows.filter(show =>
      show.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      show.venue.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filterYear) {
      filtered = filtered.filter(show => {
        const d = parseDate(show.date);
        return d.getFullYear() === parseInt(filterYear);
      });
    }
    if (filterDate) {
      filtered = filtered.filter(show => show.date === filterDate);
    }
    return filtered.sort((a, b) => {
      if (sortBy === 'date') return parseDate(b.date) - parseDate(a.date);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });
  }, [shows, searchTerm, sortBy, filterYear, filterDate]);

  const artistGroups = useMemo(() => {
    const groups = {};
    sortedFilteredShows.forEach(show => {
      if (!groups[show.artist]) {
        groups[show.artist] = [];
      }
      groups[show.artist].push(show);
    });
    return Object.entries(groups).sort((a, b) => {
      if (sortBy === 'artist') return a[0].localeCompare(b[0]);
      if (sortBy === 'rating') {
        const avgA = a[1].filter(s => s.rating).reduce((acc, s, _, arr) => acc + s.rating / arr.length, 0) || 0;
        const avgB = b[1].filter(s => s.rating).reduce((acc, s, _, arr) => acc + s.rating / arr.length, 0) || 0;
        return avgB - avgA;
      }
      return b[1].length - a[1].length;
    });
  }, [sortedFilteredShows, sortBy]);

  const summaryStats = useMemo(() => {
    const uniqueSongs = new Set();
    shows.forEach(s => s.setlist.forEach(song => uniqueSongs.add(song.name.toLowerCase().trim())));
    const uniqueSongCount = uniqueSongs.size;

    const ratedShows = shows.filter(s => s.rating);
    const avgRating = ratedShows.length
      ? (ratedShows.reduce((a, s) => a + s.rating, 0) / ratedShows.length).toFixed(1)
      : null;
    const uniqueArtists = new Set(shows.map(s => s.artist)).size;
    const uniqueVenues = new Set(shows.map(s => s.venue)).size;
    return { totalSongs: uniqueSongCount, avgRating, uniqueArtists, uniqueVenues };
  }, [shows]);

  // ── Context value ───────────────────────────────────────────────────
  const value = {
    // Navigation
    router,
    pathname,
    searchParams,
    navigateTo,
    activeView,
    setActiveView,

    // Core state
    shows,
    setShows,
    showForm,
    setShowForm,
    selectedShow,
    setSelectedShow,
    searchTerm,
    setSearchTerm,
    filterYear,
    setFilterYear,
    filterDate,
    setFilterDate,
    availableYears,
    shareSuccess,
    setShareSuccess,
    isLoading,
    setIsLoading,
    sortBy,
    setSortBy,
    selectedArtist,
    setSelectedArtist,
    statsTab,
    setStatsTab,
    friendsInitialTab,
    setFriendsInitialTab,

    // Auth
    user,
    authLoading,
    authModal,
    setAuthModal,
    guestMode,
    setGuestMode,
    showGuestPrompt,
    setShowGuestPrompt,
    showMigrationPrompt,
    localShowsToMigrate,
    handleLogin,
    handleLogout,
    openAuthModal,
    closeAuthModal,
    switchAuthMode,
    handleAuthSuccess,
    enterGuestMode,
    handleMigrateData,
    handleSkipMigration,

    // Onboarding tooltips
    tooltipStep,
    setTooltipStep,
    dismissTooltip,

    // Admin
    isAdmin,

    // Community
    communityStats,
    userRank,

    // Setlist scanning
    setlistScanning,
    setSetlistScanning,
    setlistScanProgress,
    setSetlistScanProgress,
    scanForMissingSetlists,

    // Sidebar
    sidebarOpen,
    setSidebarOpen,

    // Celebration
    showCelebration,
    setShowCelebration,

    // Friends
    friends,
    setFriends,
    friendUids,
    loadFriends,
    pendingFriendRequests,
    sentFriendRequests,
    pendingShowTags,
    tagFriendsShow,
    setTagFriendsShow,
    sendFriendRequest,
    sendFriendRequestByEmail,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,

    // Show tagging
    tagFriendsAtShow,
    acceptShowTag,
    declineShowTag,
    bulkAcceptAll,
    bulkAcceptFromFriend,
    tagFriendByEmail,

    // Show suggestions
    showSuggestions,
    myPendingSuggestions,
    myConfirmedSuggestions,
    respondToSuggestion,
    normalizeShowKey,

    // Shared memories
    memoriesShow,
    setMemoriesShow,
    sharedComments,
    setSharedComments,
    commentsLoading,
    openMemories,
    addSharedComment,
    editSharedComment,
    deleteSharedComment,

    // Friend annotations
    friendAnnotationsForShow,
    fetchFriendAnnotations,

    // Shows together
    getShowsTogether,

    // Pending invites
    pendingInvites,
    inviteStats,
    sendInvite,
    resendInvite,
    cancelInvite,

    // Pending email tags
    pendingTagsForReview,
    setPendingTagsForReview,
    acceptPendingEmailTag,
    declinePendingEmailTag,

    // Notifications
    unreadNotifications,
    pendingNotificationCount,
    markNotificationsRead,
    upcomingShowsBadgeCount,
    setUpcomingShowsBadgeCount,

    // Welcome state
    welcomeState,
    setWelcomeState,

    // Toast
    toast,
    setToast,

    // Venue rating
    venueRatingShow,
    setVenueRatingShow,
    normalizeVenueKey,
    getVenueRatings,
    computeVenueAggregate,

    // Show CRUD
    saveShow,
    addShow,
    updateShowData,
    deleteShow,
    updateShowRating,
    updateShowComment,
    addSongToShow,
    updateSongRating,
    updateSongComment,
    batchRateUnrated,
    deleteSong,

    // Stats
    getSongStats,
    getArtistStats,
    getVenueStats,
    getTopRatedShows,
    shareCollection,

    // Derived data
    importedIds,
    sortedFilteredShows,
    artistGroups,
    summaryStats,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
