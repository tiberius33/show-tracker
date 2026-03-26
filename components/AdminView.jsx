'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, getDocs, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { ChevronLeft, ChevronRight, User, Users, Search, Mail, Sparkles, Send, Eye, TrendingUp, Plus, Upload, Download, Check, RefreshCw, AlertTriangle, Trash2, Calendar, MapPin, Music, MessageSquare, X, Trophy, Database, Wrench, Megaphone } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import SetlistEditor from '@/components/SetlistEditor';
import Tip from '@/components/ui/Tip';
import AdminRoadmapCard from '@/components/AdminRoadmapCard';
import { formatDate, parseDate, artistColor, avgSongRating, parseCSV, parseImportDate, autoDetectMapping } from '@/lib/utils';
import { ROADMAP_CATEGORIES, IMPORT_FIELDS } from '@/lib/constants';
import { apiUrl } from '@/lib/api';
import AdminPopups from '@/components/AdminPopups';

export default
function AdminView() {
  const { shows, scanForMissingSetlists, setlistScanning, setlistScanProgress } = useApp();
  const [adminTab, setAdminTab] = useState('users'); // 'users' | 'guestTrials' | 'conversions' | 'referrals' | 'roadmap' | 'tools'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cacheEntries, setCacheEntries] = useState([]);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheClearArtist, setCacheClearArtist] = useState('');
  const [cacheStatus, setCacheStatus] = useState('');
  const [dupeCleanupLoading, setDupeCleanupLoading] = useState(false);
  const [dupeCleanupResult, setDupeCleanupResult] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userShows, setUserShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [selectedAdminShow, setSelectedAdminShow] = useState(null);
  const [showSortBy, setShowSortBy] = useState('date');
  const [showSearchTerm, setShowSearchTerm] = useState('');

  // Guest trials state
  const [guestSessions, setGuestSessions] = useState([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [guestDateFrom, setGuestDateFrom] = useState('');
  const [guestDateTo, setGuestDateTo] = useState('');
  const [bulkResetConfirm, setBulkResetConfirm] = useState(false);
  const [bulkResetting, setBulkResetting] = useState(false);
  const [bulkResetStatus, setBulkResetStatus] = useState('');

  // User filter state
  const [showOnlyConverted, setShowOnlyConverted] = useState(false);
  const [showOnlyInvited, setShowOnlyInvited] = useState(false);

  // Conversions tab state
  const [conversionSortBy, setConversionSortBy] = useState('conversionDate'); // 'conversionDate' | 'name' | 'email'

  // Referrals tab state
  const [allInvites, setAllInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [referralSortBy, setReferralSortBy] = useState('joinDate'); // 'joinDate' | 'name' | 'email' | 'inviter'

  // Email compose state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // null | 'success' | 'error'

  // Delete user state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null); // null | { id, firstName, email }
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Roadmap admin state
  // roadmapItems — Collection: roadmapItems/{itemId} — { title, description, status, category, voteCount, sourceFeedbackId, submitterUid, createdAt, updatedAt, publishedAt }
  // feedbackItems — Collection: feedback/{docId} — { type, category, message, submitterUid, submitterEmail, submitterName, status, roadmapItemId, createdAt }
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('other');
  const [savingItem, setSavingItem] = useState(false);
  const [roadmapSortBy, setRoadmapSortBy] = useState('date'); // 'date' | 'votes'
  const [notifyingItem, setNotifyingItem] = useState(null); // itemId being notified

  // Bulk import state
  const [bulkImportStep, setBulkImportStep] = useState('select-user'); // 'select-user' | 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'
  const [bulkImportTargetUser, setBulkImportTargetUser] = useState(null);
  const [bulkImportFileName, setBulkImportFileName] = useState('');
  const [bulkImportRawData, setBulkImportRawData] = useState([]);
  const [bulkImportHeaders, setBulkImportHeaders] = useState([]);
  const [bulkImportMapping, setBulkImportMapping] = useState({});
  const [bulkImportPreviewRows, setBulkImportPreviewRows] = useState([]);
  const [bulkImportProgress, setBulkImportProgress] = useState(null);
  const [bulkImportTargetShows, setBulkImportTargetShows] = useState([]);
  const [bulkImportLoadingShows, setBulkImportLoadingShows] = useState(false);
  const [bulkImportError, setBulkImportError] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
      const loadedUsers = profilesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        lastLogin: doc.data().lastLogin?.toDate?.() || new Date(),
        guestConvertedAt: doc.data().guestConvertedAt?.toDate?.() || null,
      }));
      setUsers(loadedUsers.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(apiUrl('/.netlify/functions/delete-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUid: deleteConfirmUser.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Deletion failed');
      setDeleteConfirmUser(null);
      // Remove from local list without a full reload
      setUsers(prev => prev.filter(u => u.id !== deleteConfirmUser.id));
      if (selectedUser?.id === deleteConfirmUser.id) setSelectedUser(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const loadGuestSessions = useCallback(async () => {
    setLoadingGuests(true);
    try {
      const snapshot = await getDocs(collection(db, 'guestSessions'));
      const sessions = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        startedAt: d.data().startedAt?.toDate?.() || new Date(),
        convertedAt: d.data().convertedAt?.toDate?.() || null,
      }));
      setGuestSessions(sessions.sort((a, b) => b.startedAt - a.startedAt));
    } catch (error) {
      console.error('Failed to load guest sessions:', error);
    } finally {
      setLoadingGuests(false);
    }
  }, []);

  const loadAllInvites = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const snapshot = await getDocs(collection(db, 'invites'));
      const invites = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        lastSentAt: d.data().lastSentAt?.toDate?.() || null,
      }));
      setAllInvites(invites);
    } catch (error) {
      console.error('Failed to load invites:', error);
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  const loadUserShows = useCallback(async (userId) => {
    setLoadingShows(true);
    try {
      const showsRef = collection(db, 'users', userId, 'shows');
      const snapshot = await getDocs(showsRef);
      const loadedShows = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserShows(loadedShows);
    } catch (error) {
      console.error('Failed to load user shows:', error);
      setUserShows([]);
    } finally {
      setLoadingShows(false);
    }
  }, []);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSelectedAdminShow(null);
    setShowSearchTerm('');
    setShowSortBy('date');
    loadUserShows(user.id);
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setUserShows([]);
    setSelectedAdminShow(null);
    setShowSearchTerm('');
    setShowEmailForm(false);
    setEmailSubject('');
    setEmailBody('');
    setEmailStatus(null);
  };

  const handleSendEmail = async () => {
    if (!selectedUser?.email || !emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    setEmailStatus(null);
    try {
      const res = await fetch(apiUrl('/.netlify/functions/send-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedUser.email,
          subject: emailSubject.trim(),
          html: emailBody.trim().replace(/\n/g, '<br />')
        })
      });
      if (res.ok) {
        setEmailStatus('success');
        setEmailSubject('');
        setEmailBody('');
        setTimeout(() => { setEmailStatus(null); setShowEmailForm(false); }, 2000);
      } else {
        setEmailStatus('error');
      }
    } catch {
      setEmailStatus('error');
    } finally {
      setEmailSending(false);
    }
  };

  // === ROADMAP ADMIN FUNCTIONS ===

  const loadRoadmapData = useCallback(async () => {
    setRoadmapLoading(true);
    try {
      const [itemsSnap, feedSnap] = await Promise.all([
        getDocs(collection(db, 'roadmapItems')),
        getDocs(collection(db, 'feedback')),
      ]);
      setRoadmapItems(
        itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      );
      setFeedbackItems(feedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load roadmap data:', err);
    } finally {
      setRoadmapLoading(false);
    }
  }, []);

  const publishRoadmapItem = async (item, targetStatus) => {
    setSavingItem(true);
    try {
      await updateDoc(doc(db, 'roadmapItems', item.id), {
        status: targetStatus,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Notify the original submitter
      if (item.submitterUid) {
        await addDoc(collection(db, 'notifications'), {
          uid: item.submitterUid,
          type: 'roadmap_published',
          message: 'Your feature idea was published to the roadmap!',
          itemId: item.id,
          itemTitle: item.title || '',
          read: false,
          createdAt: serverTimestamp(),
        });
        // Optional email notification (fire and forget)
        const linkedFeedback = feedbackItems.find(f => f.id === item.sourceFeedbackId);
        if (linkedFeedback?.submitterEmail) {
          fetch(apiUrl('/.netlify/functions/send-email'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: linkedFeedback.submitterEmail,
              subject: 'Your feature idea is on the MySetlists roadmap!',
              html: `<p>Hey ${linkedFeedback.submitterName || 'there'}!</p><p>Great news — your feature idea <strong>"${item.title}"</strong> has been added to the <a href="https://mysetlists.net/roadmap">public roadmap</a>!</p><p>Head over and see how the community votes on it. Thanks for helping make MySetlists better!</p>`,
            }),
          }).catch(() => {});
        }
      }
      setRoadmapItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: targetStatus, publishedAt: new Date() } : i
      ));
    } catch (err) {
      console.error('Failed to publish roadmap item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  const changeItemStatus = async (item, newStatus) => {
    try {
      const updates = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus !== 'draft' && !item.publishedAt ? { publishedAt: serverTimestamp() } : {}),
        ...(newStatus === 'shipped' ? { completedAt: serverTimestamp() } : {}),
      };
      await updateDoc(doc(db, 'roadmapItems', item.id), updates);
      setRoadmapItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus, ...(newStatus === 'shipped' ? { completedAt: new Date() } : {}) } : i));
    } catch (err) {
      console.error('Failed to change item status:', err);
    }
  };

  const sendCompletionNotifications = async (item) => {
    setNotifyingItem(item.id);
    try {
      const res = await fetch(apiUrl('/.netlify/functions/notify-roadmap-completion'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmapItemId: item.id,
          featureTitle: item.title,
          featureDescription: item.description || '',
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Notification send failed');
      await updateDoc(doc(db, 'roadmapItems', item.id), {
        notificationsSent: true,
        notificationsSentAt: serverTimestamp(),
      });
      setRoadmapItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, notificationsSent: true, notificationsSentAt: new Date() } : i
      ));
      alert(`Sent ${result.emailsSent || 0} notification email(s)!`);
    } catch (err) {
      console.error('Failed to send completion notifications:', err);
      alert('Failed to send notifications: ' + err.message);
    } finally {
      setNotifyingItem(null);
    }
  };

  const dismissRoadmapItem = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'roadmapItems', item.id));
      setRoadmapItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Failed to dismiss roadmap item:', err);
    }
  };

  const createRoadmapItem = async () => {
    if (!newItemTitle.trim()) return;
    setSavingItem(true);
    try {
      const ref = await addDoc(collection(db, 'roadmapItems'), {
        title: newItemTitle.trim(),
        description: newItemDesc.trim(),
        status: 'draft',
        category: newItemCategory,
        voteCount: 0,
        sourceFeedbackId: null,
        submitterUid: null,
        submitterEmail: null,
        contributors: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        publishedAt: null,
        completedAt: null,
        notificationsSent: false,
        notificationsSentAt: null,
      });
      setRoadmapItems(prev => [{
        id: ref.id,
        title: newItemTitle.trim(),
        description: newItemDesc.trim(),
        status: 'draft',
        category: newItemCategory,
        voteCount: 0,
        sourceFeedbackId: null,
        submitterUid: null,
        submitterEmail: null,
        contributors: [],
      }, ...prev]);
      setCreatingItem(false);
      setNewItemTitle('');
      setNewItemDesc('');
      setNewItemCategory('other');
    } catch (err) {
      console.error('Failed to create roadmap item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // === BULK IMPORT FUNCTIONS ===

  const loadBulkImportTargetShows = useCallback(async (userId) => {
    setBulkImportLoadingShows(true);
    try {
      const showsRef = collection(db, 'users', userId, 'shows');
      const snapshot = await getDocs(showsRef);
      setBulkImportTargetShows(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Failed to load target user shows:', error);
      setBulkImportTargetShows([]);
    } finally {
      setBulkImportLoadingShows(false);
    }
  }, []);

  const handleBulkImportSelectUser = (u) => {
    setBulkImportTargetUser(u);
    loadBulkImportTargetShows(u.id);
    setBulkImportStep('upload');
    setBulkImportError(null);
  };

  const handleBulkImportFile = async (file) => {
    setBulkImportFileName(file.name);
    setBulkImportError(null);
    const ext = file.name.split('.').pop().toLowerCase();

    let rows;
    if (ext === 'csv') {
      const text = await file.text();
      rows = parseCSV(text);
    } else if (ext === 'xlsx' || ext === 'xls') {
      try {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        rows = rows.map(row => row.map(cell => String(cell)));
      } catch (err) {
        setBulkImportError('Failed to read Excel file.');
        return;
      }
    } else {
      setBulkImportError('Unsupported file type. Use .csv, .xlsx, or .xls.');
      return;
    }

    if (rows.length < 2) {
      setBulkImportError('File must contain a header row and at least one data row.');
      return;
    }
    const hdrs = rows[0];
    const data = rows.slice(1).filter(row => row.some(cell => cell !== ''));
    if (data.length === 0) {
      setBulkImportError('No data rows found.');
      return;
    }
    setBulkImportHeaders(hdrs);
    setBulkImportRawData(data);
    setBulkImportMapping(autoDetectMapping(hdrs));
    setBulkImportStep('mapping');
  };

  const buildBulkImportPreview = useCallback(() => {
    return bulkImportRawData.map((row) => {
      const record = {};
      const errors = [];
      IMPORT_FIELDS.forEach(field => {
        const colIndex = bulkImportMapping[field.key];
        record[field.key] = colIndex !== undefined && colIndex !== '' ? (row[colIndex] || '') : '';
      });

      if (!record.artist) errors.push('Missing artist');
      if (!record.venue) errors.push('Missing venue');
      if (!record.date) errors.push('Missing date');

      let parsedDate = null;
      if (record.date) {
        parsedDate = parseImportDate(record.date);
        if (!parsedDate) errors.push('Invalid date');
      }

      let rating = null;
      if (record.rating) {
        const r = Number(record.rating);
        if (isNaN(r) || r < 1 || r > 10) errors.push('Rating must be 1-10');
        else rating = r;
      }

      const isDuplicate = parsedDate && bulkImportTargetShows.some(show =>
        show.artist?.toLowerCase() === record.artist?.toLowerCase() &&
        show.venue?.toLowerCase() === record.venue?.toLowerCase() &&
        show.date === parsedDate
      );

      return { raw: record, parsedDate, rating, errors, isDuplicate };
    });
  }, [bulkImportRawData, bulkImportMapping, bulkImportTargetShows]);

  const handleBulkImportExecute = async () => {
    const toImport = bulkImportPreviewRows.filter(r => r.errors.length === 0 && !r.isDuplicate);
    if (toImport.length === 0) return;

    setBulkImportStep('importing');
    setBulkImportProgress({ importing: true });
    setBulkImportError(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const shows = toImport.map(r => ({
        artist: r.raw.artist,
        venue: r.raw.venue,
        date: r.parsedDate,
        city: r.raw.city || '',
        country: r.raw.country || '',
        rating: r.rating || null,
        comment: r.raw.comment || '',
        tour: r.raw.tour || '',
      }));

      const res = await fetch(apiUrl('/.netlify/functions/admin-bulk-import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUid: bulkImportTargetUser.id, shows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');

      setBulkImportProgress({ imported: json.imported, duplicatesSkipped: json.duplicatesSkipped });
      setBulkImportStep('complete');
      setUsers(prev => prev.map(u =>
        u.id === bulkImportTargetUser.id
          ? { ...u, showCount: (u.showCount || 0) + json.imported }
          : u
      ));
    } catch (err) {
      setBulkImportError(err.message);
      setBulkImportProgress(null);
      setBulkImportStep('preview');
    }
  };

  const resetBulkImport = () => {
    setBulkImportStep('select-user');
    setBulkImportTargetUser(null);
    setBulkImportFileName('');
    setBulkImportRawData([]);
    setBulkImportHeaders([]);
    setBulkImportMapping({});
    setBulkImportPreviewRows([]);
    setBulkImportProgress(null);
    setBulkImportTargetShows([]);
    setBulkImportLoadingShows(false);
    setBulkImportError(null);
  };

  useEffect(() => {
    loadUsers();
    loadGuestSessions();
    loadAllInvites();
    loadRoadmapData();
  }, [loadUsers, loadGuestSessions, loadAllInvites, loadRoadmapData]);

  // Build set of converted user IDs for badge display
  const convertedUserIds = useMemo(() => {
    const ids = new Set();
    guestSessions.forEach(s => { if (s.converted && s.convertedUserId) ids.add(s.convertedUserId); });
    users.forEach(u => { if (u.convertedFromGuest) ids.add(u.id); });
    return ids;
  }, [users, guestSessions]);

  // Build invite lookup maps
  const inviteData = useMemo(() => {
    // Map: inviteeEmail (lowercase) -> accepted invite doc (who invited them)
    const invitedByMap = {}; // email -> { inviterUid, inviterName, inviterEmail, createdAt }
    // Map: inviterUid -> array of invite docs they sent
    const inviterMap = {};
    // Set of user IDs who joined via invite
    const invitedUserIds = new Set();

    allInvites.forEach(inv => {
      const email = (inv.inviteeEmail || '').toLowerCase();
      // Track accepted invites for "invited by" lookups
      if (inv.status === 'accepted' && email) {
        invitedByMap[email] = inv;
      }
      // Track all invites per inviter
      const uid = inv.inviterUid;
      if (uid) {
        if (!inviterMap[uid]) inviterMap[uid] = [];
        inviterMap[uid].push(inv);
      }
    });

    // Map invited emails to user IDs
    users.forEach(u => {
      const email = (u.email || '').toLowerCase();
      if (invitedByMap[email] || u.invitedByUid) {
        invitedUserIds.add(u.id);
      }
    });

    // Build inviter stats
    const inviterStats = {};
    Object.entries(inviterMap).forEach(([uid, invites]) => {
      const accepted = invites.filter(i => i.status === 'accepted');
      const acceptedEmails = new Set(accepted.map(i => (i.inviteeEmail || '').toLowerCase()));
      const invitees = users.filter(u => acceptedEmails.has((u.email || '').toLowerCase()));
      inviterStats[uid] = {
        totalSent: invites.length,
        totalAccepted: accepted.length,
        conversionRate: invites.length > 0 ? ((accepted.length / invites.length) * 100).toFixed(1) : '0.0',
        totalInviteeShows: invitees.reduce((acc, u) => acc + (u.showCount || 0), 0),
        totalInviteeSongs: invitees.reduce((acc, u) => acc + (u.songCount || 0), 0),
        invitees,
      };
    });

    // Build list of invited users with their inviter info
    const invitedUsers = users
      .filter(u => invitedUserIds.has(u.id))
      .map(u => {
        const email = (u.email || '').toLowerCase();
        const inv = invitedByMap[email];
        return {
          ...u,
          inviterUid: u.invitedByUid || inv?.inviterUid || null,
          inviterName: u.invitedByName || inv?.inviterName || null,
          inviterEmail: inv?.inviterEmail || null,
          inviteAcceptedAt: inv?.createdAt || null,
        };
      });

    // Inviter leaderboard
    const leaderboard = Object.entries(inviterStats)
      .map(([uid, stats]) => {
        const inviter = users.find(u => u.id === uid);
        return { uid, name: inviter?.displayName || inviter?.firstName || 'Unknown', email: inviter?.email || '', ...stats };
      })
      .filter(l => l.totalSent > 0)
      .sort((a, b) => b.totalAccepted - a.totalAccepted || b.totalSent - a.totalSent);

    return { invitedByMap, inviterMap, invitedUserIds, inviterStats, invitedUsers, leaderboard };
  }, [allInvites, users]);

  const sortedInvitedUsers = useMemo(() => {
    const sorted = [...inviteData.invitedUsers];
    if (referralSortBy === 'joinDate') sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    else if (referralSortBy === 'name') sorted.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
    else if (referralSortBy === 'email') sorted.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    else if (referralSortBy === 'inviter') sorted.sort((a, b) => (a.inviterName || '').localeCompare(b.inviterName || ''));
    return sorted;
  }, [inviteData.invitedUsers, referralSortBy]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (showOnlyConverted) return convertedUserIds.has(user.id);
    if (showOnlyInvited) return inviteData.invitedUserIds.has(user.id);
    return true;
  });

  const loadCacheStats = async () => {
    if (!auth.currentUser) return;
    setCacheLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(apiUrl('/.netlify/functions/cache-stats'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load cache stats');
      const { entries } = await res.json();
      setCacheEntries(entries);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setCacheLoading(false);
    }
  };

  const clearCache = async (by, name = null, key = null) => {
    if (by === 'all' && !window.confirm('Clear the entire setlist cache? All searches will hit the Setlist.fm API again until re-cached.')) return;
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const body = by === 'artist' ? { by: 'artist', name }
        : by === 'key' ? { key }
        : { by: 'all' };
      const res = await fetch(apiUrl('/.netlify/functions/clear-cache'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      setCacheStatus(`Cleared ${result.deleted} cache ${result.deleted === 1 ? 'entry' : 'entries'}.`);
      setTimeout(() => setCacheStatus(''), 4000);
      setCacheClearArtist('');
      loadCacheStats();
    } catch (error) {
      setCacheStatus(`Error: ${error.message}`);
      setTimeout(() => setCacheStatus(''), 4000);
    }
  };

  const totalStats = useMemo(() => ({
    totalUsers: users.length,
    totalShows: users.reduce((acc, u) => acc + (u.showCount || 0), 0),
    totalSongs: users.reduce((acc, u) => acc + (u.songCount || 0), 0),
    totalRated: users.reduce((acc, u) => acc + (u.ratedSongCount || 0), 0)
  }), [users]);

  const guestTrialStats = useMemo(() => {
    const total = guestSessions.length;
    const converted = guestSessions.filter(s => s.converted).length;
    const withShows = guestSessions.filter(s => (s.showsAdded || 0) > 0).length;
    const totalShowsAdded = guestSessions.reduce((acc, s) => acc + (s.showsAdded || 0), 0);
    return {
      total,
      converted,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0',
      withShows,
      totalShowsAdded,
    };
  }, [guestSessions]);

  // Guest sessions filtered by date range
  const filteredGuestSessions = useMemo(() => {
    if (!guestDateFrom && !guestDateTo) return guestSessions;
    return guestSessions.filter(s => {
      const started = s.startedAt;
      if (!started) return false;
      if (guestDateFrom) {
        const from = new Date(guestDateFrom + 'T00:00:00');
        if (started < from) return false;
      }
      if (guestDateTo) {
        const to = new Date(guestDateTo + 'T23:59:59');
        if (started > to) return false;
      }
      return true;
    });
  }, [guestSessions, guestDateFrom, guestDateTo]);

  const bulkResetGuestTrials = async () => {
    if (!guestDateFrom && !guestDateTo) return;
    setBulkResetting(true);
    setBulkResetStatus('');
    try {
      const sessionIds = filteredGuestSessions.map(s => s.id);
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(apiUrl('/.netlify/functions/admin-delete-guest-trials'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setBulkResetStatus(`Deleted ${data.deleted} trial(s). ${data.remaining} remaining.`);
      setBulkResetConfirm(false);
      await loadGuestSessions();
    } catch (err) {
      console.error('Bulk delete error:', err);
      setBulkResetStatus(`Error: ${err.message}`);
      setBulkResetConfirm(false);
    } finally {
      setBulkResetting(false);
      setTimeout(() => setBulkResetStatus(''), 5000);
    }
  };

  // Converted users — enriched with guest session data
  const convertedUsers = useMemo(() => {
    // Build a map of convertedUserId -> guestSession for quick lookup
    const sessionByUser = {};
    guestSessions.forEach(s => {
      if (s.converted && s.convertedUserId) {
        sessionByUser[s.convertedUserId] = s;
      }
    });

    // Users that have convertedFromGuest flag OR appear in a converted guest session
    const converted = users.filter(u => u.convertedFromGuest || sessionByUser[u.id]);
    return converted.map(u => {
      const session = sessionByUser[u.id];
      return {
        ...u,
        guestSessionId: u.guestSessionId || session?.id || null,
        guestConvertedAt: u.guestConvertedAt || session?.convertedAt || null,
        guestShowsAdded: u.guestShowsAdded ?? session?.showsAdded ?? 0,
        guestStartedAt: session?.startedAt || null,
      };
    });
  }, [users, guestSessions]);

  const sortedConvertedUsers = useMemo(() => {
    const sorted = [...convertedUsers];
    if (conversionSortBy === 'conversionDate') {
      sorted.sort((a, b) => (b.guestConvertedAt || 0) - (a.guestConvertedAt || 0));
    } else if (conversionSortBy === 'name') {
      sorted.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
    } else if (conversionSortBy === 'email') {
      sorted.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    }
    return sorted;
  }, [convertedUsers, conversionSortBy]);

  const sortedFilteredUserShows = useMemo(() => {
    let filtered = userShows.filter(show =>
      show.artist?.toLowerCase().includes(showSearchTerm.toLowerCase()) ||
      show.venue?.toLowerCase().includes(showSearchTerm.toLowerCase()) ||
      show.city?.toLowerCase().includes(showSearchTerm.toLowerCase())
    );
    return filtered.sort((a, b) => {
      if (showSortBy === 'date') return parseDate(b.date) - parseDate(a.date);
      if (showSortBy === 'artist') return (a.artist || '').localeCompare(b.artist || '');
      if (showSortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });
  }, [userShows, showSearchTerm, showSortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-secondary font-medium">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Shows Detail View */}
      {selectedUser ? (
        <>
          {/* Back button + User header */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToUsers}
              className="p-2 bg-hover hover:bg-hover rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-primary" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-amber flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-primary">
                  {selectedUser.displayName || selectedUser.firstName || 'Anonymous'}'s Shows
                </h2>
                <p className="text-sm text-secondary">{selectedUser.email}</p>
              </div>
            </div>
            {selectedUser.email && (
              <button
                onClick={() => { setShowEmailForm(!showEmailForm); setEmailStatus(null); }}
                className="ml-auto flex items-center gap-2 px-3 py-2 bg-hover hover:bg-hover rounded-xl text-sm font-medium text-secondary transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
            )}
          </div>

          {/* Inline email compose */}
          {showEmailForm && (
            <div className="bg-hover border border-subtle rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Mail className="w-4 h-4" />
                <span>To: {selectedUser.email}</span>
              </div>
              <input
                type="text"
                placeholder="Subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-4 py-2.5 bg-hover border border-subtle rounded-xl text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
              <textarea
                placeholder="Message body..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="w-full px-4 py-2.5 bg-hover border border-subtle rounded-xl text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-xl font-medium transition-all text-sm"
                >
                  {emailSending ? 'Sending...' : 'Send'}
                </button>
                <button
                  onClick={() => { setShowEmailForm(false); setEmailSubject(''); setEmailBody(''); setEmailStatus(null); }}
                  className="px-4 py-2 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                {emailStatus === 'success' && <span className="text-sm text-brand">Sent!</span>}
                {emailStatus === 'error' && <span className="text-sm text-danger">Failed to send. Check RESEND_API_KEY.</span>}
              </div>
            </div>
          )}

          {/* Conversion details panel */}
          {convertedUserIds.has(selectedUser.id) && (() => {
            // Find guest session data for this user
            const guestSession = guestSessions.find(s => s.convertedUserId === selectedUser.id);
            const convertedAt = selectedUser.guestConvertedAt || guestSession?.convertedAt;
            const guestStarted = guestSession?.startedAt;
            const guestShowsCount = selectedUser.guestShowsAdded ?? guestSession?.showsAdded ?? 0;
            const sessionId = selectedUser.guestSessionId || guestSession?.id;

            return (
              <div className="bg-brand-subtle border border-brand/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-brand" />
                  <h3 className="text-sm font-semibold text-brand uppercase tracking-wide">Converted from Guest</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted mb-1">Guest Started</div>
                    <div className="text-sm text-secondary font-medium">
                      {guestStarted?.toLocaleDateString?.() || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">Converted On</div>
                    <div className="text-sm text-secondary font-medium">
                      {convertedAt?.toLocaleDateString?.() || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">Shows as Guest</div>
                    <div className="text-sm text-brand font-bold">{guestShowsCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">Shows After Conversion</div>
                    <div className="text-sm text-brand font-bold">{(selectedUser.showCount || 0)}</div>
                  </div>
                </div>
                {sessionId && (
                  <div className="mt-3 pt-3 border-t border-brand/10">
                    <div className="text-xs text-muted">Guest Session ID: <span className="font-mono text-secondary">{sessionId}</span></div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Invite/Referral details panel */}
          {(() => {
            const isInvited = inviteData.invitedUserIds.has(selectedUser.id);
            const email = (selectedUser.email || '').toLowerCase();
            const inviteInfo = inviteData.invitedByMap[email];
            const inviterUid = selectedUser.invitedByUid || inviteInfo?.inviterUid;
            const inviterName = selectedUser.invitedByName || inviteInfo?.inviterName;
            const inviterEmail = selectedUser.invitedByEmail || inviteInfo?.inviterEmail;
            const sentInvites = inviteData.inviterMap[selectedUser.id] || [];
            const stats = inviteData.inviterStats[selectedUser.id];

            if (!isInvited && sentInvites.length === 0) return null;

            return (
              <div className="bg-amber/10 border border-amber/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-5 h-5 text-amber" />
                  <h3 className="text-sm font-semibold text-amber uppercase tracking-wide">Invitation & Referral Info</h3>
                </div>

                {/* Who invited this user */}
                {isInvited && (
                  <div className="mb-4">
                    <div className="text-xs text-muted mb-2">Invited By</div>
                    <div className="flex items-center gap-3 bg-hover rounded-xl p-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-amber flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-primary">{inviterName || 'Unknown'}</div>
                        <div className="text-xs text-muted">{inviterEmail || ''}</div>
                      </div>
                      {inviteInfo?.createdAt && (
                        <div className="ml-auto text-xs text-muted">
                          Invited {inviteInfo.createdAt.toLocaleDateString?.() || ''}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Who this user has invited */}
                {sentInvites.length > 0 && (
                  <div>
                    <div className="text-xs text-muted mb-2">
                      Invitations Sent ({sentInvites.length} total, {sentInvites.filter(i => i.status === 'accepted').length} accepted)
                    </div>
                    <div className="space-y-2">
                      {sentInvites.map(inv => {
                        const invitee = users.find(u => (u.email || '').toLowerCase() === (inv.inviteeEmail || '').toLowerCase());
                        return (
                          <div key={inv.id} className="flex items-center gap-3 bg-hover rounded-xl p-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${inv.status === 'accepted' ? 'bg-brand' : 'bg-hover'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-secondary truncate">
                                {invitee ? (invitee.firstName || invitee.displayName || inv.inviteeEmail) : inv.inviteeEmail}
                              </div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              inv.status === 'accepted' ? 'bg-brand-subtle text-brand' : 'bg-hover text-muted'
                            }`}>
                              {inv.status === 'accepted' ? 'Joined' : 'Pending'}
                            </span>
                            {invitee && (
                              <span className="text-xs text-muted">{invitee.showCount || 0} shows</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {stats && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-amber/10">
                        <div>
                          <div className="text-xs text-muted">Conversion Rate</div>
                          <div className="text-sm text-amber font-bold">{stats.conversionRate}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">Invitee Shows</div>
                          <div className="text-sm text-brand font-bold">{stats.totalInviteeShows}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">Invitee Songs</div>
                          <div className="text-sm text-amber font-bold">{stats.totalInviteeSongs}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">Rank</div>
                          <div className="text-sm text-brand font-bold">
                            #{inviteData.leaderboard.findIndex(l => l.uid === selectedUser.id) + 1 || '—'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* User stats summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Shows', value: selectedUser.showCount || 0 },
              { label: 'Songs', value: selectedUser.songCount || 0 },
              { label: 'Venues', value: selectedUser.venueCount || 0 },
              { label: 'Joined', value: selectedUser.createdAt?.toLocaleDateString?.() || 'Unknown', isDate: true },
            ].map(stat => (
              <div key={stat.label} className="bg-hover backdrop-blur-xl rounded-2xl p-4 border border-subtle">
                <div className="text-2xl font-bold text-brand">
                  {stat.isDate ? stat.value : stat.value.toLocaleString()}
                </div>
                <div className="text-xs font-medium text-secondary mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Search + Sort controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter shows by artist, venue, or city..."
                value={showSearchTerm}
                onChange={(e) => setShowSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-secondary">Sort:</span>
              {['date', 'artist', 'rating'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setShowSortBy(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    showSortBy === opt
                      ? 'bg-brand-subtle text-brand border border-brand/30'
                      : 'bg-hover text-secondary hover:bg-hover border border-subtle'
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Loading state */}
          {loadingShows && (
            <div className="flex items-center justify-center py-16">
              <div className="text-secondary font-medium">Loading shows...</div>
            </div>
          )}

          {/* Show cards */}
          {!loadingShows && (
            <div className="space-y-3">
              {sortedFilteredUserShows.map(show => {
                const songAvg = avgSongRating(show.setlist || []);
                return (
                  <div
                    key={show.id}
                    className="bg-hover rounded-2xl p-4 border border-subtle hover:bg-hover hover:border-active cursor-pointer transition-all"
                    onClick={() => setSelectedAdminShow(show)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium" style={{ color: artistColor(show.artist) }}>
                            {show.artist}
                          </span>
                          {show.isManual && (
                            <span className="text-xs bg-hover text-muted px-2 py-0.5 rounded-full">Manual</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Calendar className="w-3.5 h-3.5 text-muted" />
                          <span className="text-secondary">{formatDate(show.date)}</span>
                          <span className="text-muted">&middot;</span>
                          <MapPin className="w-3.5 h-3.5 text-muted" />
                          <span className="text-secondary">{show.venue}{show.city ? `, ${show.city}` : ''}</span>
                          <span className="text-muted">&middot;</span>
                          <Music className="w-3.5 h-3.5 text-muted" />
                          <span className="text-secondary">{(show.setlist || []).length} songs</span>
                        </div>
                        {show.tour && (
                          <div className="text-xs text-brand font-medium mt-1.5">Tour: {show.tour}</div>
                        )}
                        {show.comment && (
                          <div className="flex items-start gap-1.5 mt-1.5 text-xs text-secondary italic">
                            <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            {show.comment}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {show.rating && (
                            <span className="text-sm font-semibold text-brand">Show: {show.rating}/10</span>
                          )}
                          {songAvg && (
                            <span className="text-xs font-medium text-muted">Songs avg: {songAvg}/10</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 ml-3" />
                    </div>
                  </div>
                );
              })}

              {sortedFilteredUserShows.length === 0 && (
                <div className="text-center py-12 text-muted">
                  {showSearchTerm ? 'No shows match your filter' : 'This user has no shows'}
                </div>
              )}
            </div>
          )}

          {/* SetlistEditor modal for show detail (read-only) */}
          {selectedAdminShow && (
            <SetlistEditor
              show={{...selectedAdminShow, setlist: selectedAdminShow.setlist || []}}
              onAddSong={() => {}}
              onRateSong={() => {}}
              onCommentSong={() => {}}
              onDeleteSong={() => {}}
              onRateShow={() => {}}
              onCommentShow={() => {}}
              onBatchRate={() => {}}
              onClose={() => setSelectedAdminShow(null)}
            />
          )}
        </>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-primary">Admin Portal</h2>
            <button
              onClick={() => { loadUsers(); loadGuestSessions(); loadAllInvites(); loadRoadmapData(); }}
              className="px-4 py-2 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors text-sm"
            >
              Refresh
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setAdminTab('users')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'users'
                  ? 'bg-brand-subtle text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-hover border border-subtle'
              }`}
            >
              <Users className="w-4 h-4" />
              Users
            </button>
            <button
              onClick={() => setAdminTab('guestTrials')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'guestTrials'
                  ? 'bg-brand-subtle text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-hover border border-subtle'
              }`}
            >
              <Eye className="w-4 h-4" />
              Guest Trials
            </button>
            <button
              onClick={() => setAdminTab('conversions')}
              className={`relative shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'conversions'
                  ? 'bg-brand-subtle text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-hover border border-subtle'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Conversions
              {convertedUsers.length > 0 && (
                <span className="ml-1 bg-brand/30 text-brand text-[10px] font-bold px-1.5 py-0.5 rounded-full">{convertedUsers.length}</span>
              )}
            </button>
            <button
              onClick={() => setAdminTab('referrals')}
              className={`relative shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'referrals'
                  ? 'bg-brand-subtle text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-hover border border-subtle'
              }`}
            >
              <Send className="w-4 h-4" />
              Referrals
              {inviteData.invitedUsers.length > 0 && (
                <span className="ml-1 bg-brand/30 text-brand text-[10px] font-bold px-1.5 py-0.5 rounded-full">{inviteData.invitedUsers.length}</span>
              )}
            </button>
            <button
              onClick={() => setAdminTab('roadmap')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'roadmap'
                  ? 'bg-brand-subtle text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-hover border border-subtle'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Roadmap
            </button>
            <button
              onClick={() => setAdminTab('bulkImport')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'bulkImport'
                  ? 'bg-brand-subtle text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-hover border border-subtle'
              }`}
            >
              <Upload className="w-4 h-4" />
              Bulk Import
            </button>
            <button
              onClick={() => setAdminTab('tools')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'tools'
                  ? 'bg-brand-subtle text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-hover border border-subtle'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Tools
            </button>
            <button
              onClick={() => setAdminTab('popups')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminTab === 'popups'
                  ? 'bg-brand-subtle text-brand border border-brand/30'
                  : 'bg-hover text-secondary hover:bg-hover border border-subtle'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              Popups
            </button>
          </div>

          {/* Users Tab */}
          {adminTab === 'users' && (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: totalStats.totalUsers, color: 'from-amber to-amber' },
                  { label: 'Total Shows', value: totalStats.totalShows, color: 'from-brand to-amber' },
                  { label: 'Total Songs', value: totalStats.totalSongs, color: 'from-brand to-brand' },
                  { label: 'Songs Rated', value: totalStats.totalRated, color: 'from-amber to-danger' },
                ].map(stat => (
                  <div key={stat.label} className="bg-hover backdrop-blur-xl rounded-2xl p-5 border border-subtle">
                    <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                      {stat.value.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-secondary mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-hover border border-subtle rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted"
                  />
                </div>
                <button
                  onClick={() => { setShowOnlyConverted(!showOnlyConverted); setShowOnlyInvited(false); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                    showOnlyConverted
                      ? 'bg-brand-subtle text-brand border border-brand/30'
                      : 'bg-hover text-secondary hover:bg-hover border border-subtle'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Converted Only
                  {showOnlyConverted && convertedUserIds.size > 0 && (
                    <span className="text-[10px] font-bold bg-brand/30 px-1.5 py-0.5 rounded-full">{convertedUserIds.size}</span>
                  )}
                </button>
                <button
                  onClick={() => { setShowOnlyInvited(!showOnlyInvited); setShowOnlyConverted(false); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                    showOnlyInvited
                      ? 'bg-amber/20 text-amber border border-amber/30'
                      : 'bg-hover text-secondary hover:bg-hover border border-subtle'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Invited Only
                  {showOnlyInvited && inviteData.invitedUserIds.size > 0 && (
                    <span className="text-[10px] font-bold bg-amber/30 px-1.5 py-0.5 rounded-full">{inviteData.invitedUserIds.size}</span>
                  )}
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-hover border-b border-subtle">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">User</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden md:table-cell">Email</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Shows</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Songs</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden sm:table-cell">Venues</th>
                      <th className="text-right px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden lg:table-cell">Joined</th>
                      <th className="w-10"></th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-hover transition-colors cursor-pointer"
                        onClick={() => handleSelectUser(user)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              convertedUserIds.has(user.id) ? 'bg-gradient-to-br from-brand to-brand' :
                              inviteData.invitedUserIds.has(user.id) ? 'bg-gradient-to-br from-amber to-amber' :
                              'bg-gradient-to-br from-brand to-amber'
                            }`}>
                              {convertedUserIds.has(user.id) ? <Sparkles className="w-5 h-5 text-primary" /> :
                               inviteData.invitedUserIds.has(user.id) ? <Mail className="w-5 h-5 text-primary" /> :
                               <User className="w-5 h-5 text-primary" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-primary">{user.firstName || 'Anonymous'}</span>
                                {convertedUserIds.has(user.id) && (
                                  <span className="text-[10px] bg-brand-subtle text-brand px-1.5 py-0.5 rounded-full font-semibold">
                                    Converted
                                  </span>
                                )}
                                {inviteData.invitedUserIds.has(user.id) && (
                                  <span className="text-[10px] bg-amber/20 text-amber px-1.5 py-0.5 rounded-full font-semibold">
                                    Invited
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted md:hidden">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-secondary hidden md:table-cell">{user.email}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-brand-subtle text-brand px-2.5 py-1 rounded-full text-sm font-semibold">
                            {user.showCount || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-secondary">{user.songCount || 0}</td>
                        <td className="px-6 py-4 text-center text-secondary hidden sm:table-cell">{user.venueCount || 0}</td>
                        <td className="px-6 py-4 text-right text-muted text-sm hidden lg:table-cell">
                          {user.createdAt?.toLocaleDateString?.() || 'Unknown'}
                        </td>
                        <td className="px-2 py-4">
                          <ChevronRight className="w-4 h-4 text-muted" />
                        </td>
                        <td className="px-2 py-4">
                          <Tip text="Delete user">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmUser({ id: user.id, firstName: user.firstName || 'this user', email: user.email });
                              }}
                              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </Tip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredUsers.length === 0 && (
                  <div className="text-center py-12 text-muted">
                    {searchTerm ? 'No users match your search' : 'No users yet'}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Guest Trials Tab */}
          {adminTab === 'guestTrials' && (
            <>
              {/* Guest Trial Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Trials', value: guestTrialStats.total, color: 'from-amber to-amber' },
                  { label: 'Converted', value: guestTrialStats.converted, color: 'from-brand to-amber' },
                  { label: 'Conversion Rate', value: `${guestTrialStats.conversionRate}%`, color: 'from-brand to-brand' },
                  { label: 'Shows Added', value: guestTrialStats.totalShowsAdded, color: 'from-amber to-danger' },
                ].map(stat => (
                  <div key={stat.label} className="bg-hover backdrop-blur-xl rounded-2xl p-5 border border-subtle">
                    <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                    </div>
                    <div className="text-sm font-medium text-secondary mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Engaged Guests (added shows) */}
              <div className="bg-hover backdrop-blur-xl rounded-2xl p-5 border border-subtle">
                <div className="text-sm font-medium text-secondary mb-1">Engaged Guests</div>
                <div className="text-2xl font-bold text-brand">{guestTrialStats.withShows}</div>
                <div className="text-xs text-muted mt-1">Guests who added at least one show</div>
              </div>

              {/* Date Range Filter */}
              <div className="bg-hover backdrop-blur-xl rounded-2xl p-5 border border-subtle space-y-4">
                <div className="text-sm font-semibold text-secondary">Filter by Date Range</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">From</label>
                    <input type="date" value={guestDateFrom} onChange={e => setGuestDateFrom(e.target.value)}
                      className="w-full bg-base border border-subtle rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">To</label>
                    <input type="date" value={guestDateTo} onChange={e => setGuestDateTo(e.target.value)}
                      className="w-full bg-base border border-subtle rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {(guestDateFrom || guestDateTo) && (
                    <>
                      <span className="text-sm text-secondary">
                        Showing <span className="font-semibold text-brand">{filteredGuestSessions.length}</span> of {guestSessions.length} sessions
                      </span>
                      <button onClick={() => { setGuestDateFrom(''); setGuestDateTo(''); }}
                        className="text-xs text-muted hover:text-secondary underline">Clear filter</button>
                      <button onClick={() => setBulkResetConfirm(true)}
                        disabled={filteredGuestSessions.length === 0}
                        className="ml-auto inline-flex items-center gap-1.5 bg-danger/10 text-danger hover:bg-danger/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <Trash2 className="w-3 h-3" />
                        Bulk Delete ({filteredGuestSessions.length})
                      </button>
                    </>
                  )}
                </div>
                {bulkResetStatus && (
                  <div className={`text-sm font-medium ${bulkResetStatus.startsWith('Error') ? 'text-danger' : 'text-brand'}`}>
                    {bulkResetStatus}
                  </div>
                )}
              </div>

              {/* Bulk Reset Confirmation Dialog */}
              {bulkResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-base border border-subtle rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
                    <div className="flex items-center gap-2 text-danger">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="text-lg font-bold">Confirm Bulk Delete</span>
                    </div>
                    <p className="text-secondary text-sm">
                      This will permanently delete <span className="font-semibold text-primary">{filteredGuestSessions.length}</span> guest trial(s)
                      {guestDateFrom && ` from ${guestDateFrom}`}
                      {guestDateTo && ` to ${guestDateTo}`}.
                      These records will be removed from Firebase entirely.
                    </p>
                    <p className="text-danger text-xs font-medium">This action cannot be undone.</p>
                    {bulkResetStatus && bulkResetStatus.startsWith('Error') && (
                      <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-danger text-sm">{bulkResetStatus}</div>
                    )}
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => setBulkResetConfirm(false)} disabled={bulkResetting}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-primary transition-colors">
                        Cancel
                      </button>
                      <button onClick={bulkResetGuestTrials} disabled={bulkResetting}
                        className="inline-flex items-center gap-2 bg-danger text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-danger/90 transition-colors disabled:opacity-60">
                        {bulkResetting ? (
                          <>
                            <Trash2 className="w-4 h-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Delete {filteredGuestSessions.length} Sessions
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Guest Sessions Table */}
              {loadingGuests ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-secondary font-medium">Loading guest sessions...</div>
                </div>
              ) : (
                <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-hover border-b border-subtle">
                        <th className="text-left px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Started</th>
                        <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Shows Added</th>
                        <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Status</th>
                        <th className="text-right px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden md:table-cell">Converted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredGuestSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-hover transition-colors">
                          <td className="px-6 py-4 text-secondary text-sm">
                            {session.startedAt?.toLocaleDateString?.() || 'Unknown'}
                            <span className="text-muted ml-2 hidden sm:inline">
                              {session.startedAt?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) || ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${
                              (session.showsAdded || 0) > 0
                                ? 'bg-brand-subtle text-brand'
                                : 'bg-hover text-muted'
                            }`}>
                              {session.showsAdded || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {session.converted ? (
                              <span className="inline-flex items-center gap-1 bg-brand-subtle text-brand px-2.5 py-1 rounded-full text-xs font-semibold">
                                <Check className="w-3 h-3" />
                                Converted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-hover text-muted px-2.5 py-1 rounded-full text-xs font-semibold">
                                <Eye className="w-3 h-3" />
                                Browsing
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-muted text-sm hidden md:table-cell">
                            {session.convertedAt?.toLocaleDateString?.() || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredGuestSessions.length === 0 && (
                    <div className="text-center py-12 text-muted">
                      {(guestDateFrom || guestDateTo) ? 'No guest sessions in selected date range' : 'No guest trial sessions recorded yet'}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Conversions Tab */}
          {adminTab === 'conversions' && (
            <>
              {/* Conversion Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Converted', value: convertedUsers.length, color: 'from-brand to-amber' },
                  { label: 'Conversion Rate', value: `${guestTrialStats.conversionRate}%`, color: 'from-brand to-brand' },
                  { label: 'Guest Shows Added', value: convertedUsers.reduce((acc, u) => acc + (u.guestShowsAdded || 0), 0), color: 'from-amber to-amber' },
                  { label: 'Post-Conv Shows', value: convertedUsers.reduce((acc, u) => acc + (u.showCount || 0), 0), color: 'from-amber to-danger' },
                ].map(stat => (
                  <div key={stat.label} className="bg-hover backdrop-blur-xl rounded-2xl p-5 border border-subtle">
                    <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                    </div>
                    <div className="text-sm font-medium text-secondary mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Sort + Export controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-secondary">Sort by:</span>
                  {[
                    { id: 'conversionDate', label: 'Conversion Date' },
                    { id: 'name', label: 'Name' },
                    { id: 'email', label: 'Email' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setConversionSortBy(opt.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        conversionSortBy === opt.id
                          ? 'bg-brand-subtle text-brand border border-brand/30'
                          : 'bg-hover text-secondary hover:bg-hover border border-subtle'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const header = 'Name,Email,Conversion Date,Guest Shows,Total Shows,Guest Session ID\n';
                    const rows = sortedConvertedUsers.map(u =>
                      `"${u.displayName || u.firstName || ''}","${u.email || ''}","${u.guestConvertedAt?.toLocaleDateString?.() || ''}",${u.guestShowsAdded || 0},${u.showCount || 0},"${u.guestSessionId || ''}"`
                    ).join('\n');
                    const blob = new Blob([header + rows], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `converted-users-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-hover hover:bg-hover text-secondary rounded-xl text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              {/* Converted Users Table */}
              <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-hover border-b border-subtle">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">User</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden md:table-cell">Email</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Guest Shows</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Total Shows</th>
                      <th className="text-right px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden sm:table-cell">Converted</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedConvertedUsers.map(user => (
                      <tr
                        key={user.id}
                        className="hover:bg-hover transition-colors cursor-pointer"
                        onClick={() => handleSelectUser(user)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-primary">{user.displayName || user.firstName || 'Anonymous'}</div>
                              <div className="text-sm text-muted md:hidden">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-secondary hidden md:table-cell">{user.email}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${
                            (user.guestShowsAdded || 0) > 0
                              ? 'bg-amber-subtle text-amber'
                              : 'bg-hover text-muted'
                          }`}>
                            {user.guestShowsAdded || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-brand-subtle text-brand px-2.5 py-1 rounded-full text-sm font-semibold">
                            {user.showCount || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-muted text-sm hidden sm:table-cell">
                          {user.guestConvertedAt?.toLocaleDateString?.() || 'Unknown'}
                        </td>
                        <td className="px-2 py-4">
                          <ChevronRight className="w-4 h-4 text-muted" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {convertedUsers.length === 0 && (
                  <div className="text-center py-12 text-muted">
                    No converted guest users yet
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Referrals Tab */}
      {adminTab === 'referrals' && (
        <div className="space-y-6">
          {/* Referral Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Invites Sent', value: allInvites.length, color: 'from-amber to-amber' },
              { label: 'Accepted', value: allInvites.filter(i => i.status === 'accepted').length, color: 'from-brand to-amber' },
              { label: 'Acceptance Rate', value: allInvites.length > 0 ? `${((allInvites.filter(i => i.status === 'accepted').length / allInvites.length) * 100).toFixed(1)}%` : '0%', color: 'from-brand to-brand' },
              { label: 'Active Inviters', value: inviteData.leaderboard.length, color: 'from-amber to-danger' },
            ].map(stat => (
              <div key={stat.label} className="bg-hover backdrop-blur-xl rounded-2xl p-5 border border-subtle">
                <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </div>
                <div className="text-sm font-medium text-secondary mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Invited Users Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Invited Users ({sortedInvitedUsers.length})</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-secondary">Sort:</span>
                {[
                  { key: 'joinDate', label: 'Join Date' },
                  { key: 'name', label: 'Name' },
                  { key: 'inviter', label: 'Inviter' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setReferralSortBy(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      referralSortBy === opt.key
                        ? 'bg-brand-subtle text-brand border border-brand/30'
                        : 'bg-hover text-secondary hover:bg-hover border border-subtle'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-hover border-b border-subtle">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Invited User</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden md:table-cell">Email</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Invited By</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide">Shows</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden sm:table-cell">Songs</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedInvitedUsers.map(user => (
                    <tr
                      key={user.id}
                      className="hover:bg-hover transition-colors cursor-pointer"
                      onClick={() => handleSelectUser(user)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber to-amber flex items-center justify-center">
                            <Mail className="w-5 h-5 text-primary" />
                          </div>
                          <span className="font-medium text-primary">{user.firstName || user.displayName || 'Anonymous'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-secondary hidden md:table-cell">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-brand font-medium">{user.inviterName || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-brand-subtle text-brand px-2.5 py-1 rounded-full text-sm font-semibold">
                          {user.showCount || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-secondary hidden sm:table-cell">{user.songCount || 0}</td>
                      <td className="px-6 py-4 text-right text-muted text-sm hidden lg:table-cell">
                        {user.createdAt?.toLocaleDateString?.() || 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {sortedInvitedUsers.length === 0 && (
                <div className="text-center py-12 text-muted">
                  No users have joined via invitation yet
                </div>
              )}
            </div>
          </div>

          {/* Inviter Leaderboard */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                <Trophy className="w-5 h-5 text-brand" />
                Inviter Leaderboard
              </h3>
              <button
                onClick={() => {
                  const rows = [['Rank', 'Name', 'Email', 'Sent', 'Accepted', 'Rate', 'Invitee Shows', 'Invitee Songs']];
                  inviteData.leaderboard.forEach((l, i) => {
                    rows.push([i + 1, l.name, l.email, l.totalSent, l.totalAccepted, `${l.conversionRate}%`, l.totalInviteeShows, l.totalInviteeSongs]);
                  });
                  sortedInvitedUsers.forEach(u => {
                    rows.push(['', u.firstName || u.displayName || '', u.email || '', '', '', '', u.showCount || 0, u.songCount || 0, u.inviterName || '']);
                  });
                  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `referral-data-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-hover hover:bg-hover text-secondary rounded-xl text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            <div className="space-y-3">
              {inviteData.leaderboard.map((inviter, idx) => (
                <div
                  key={inviter.uid}
                  className="bg-hover border border-subtle rounded-2xl p-5 hover:bg-hover transition-colors cursor-pointer"
                  onClick={() => {
                    const user = users.find(u => u.id === inviter.uid);
                    if (user) handleSelectUser(user);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      idx === 0 ? 'bg-gradient-to-br from-brand to-brand text-on-dark' :
                      idx === 1 ? 'bg-gradient-to-br from-secondary to-muted text-primary' :
                      idx === 2 ? 'bg-gradient-to-br from-brand to-brand text-on-dark' :
                      'bg-hover text-secondary'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-primary">{inviter.name}</div>
                      <div className="text-sm text-muted">{inviter.email}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-amber">{inviter.totalSent}</div>
                        <div className="text-[10px] text-muted uppercase">Sent</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-brand">{inviter.totalAccepted}</div>
                        <div className="text-[10px] text-muted uppercase">Accepted</div>
                      </div>
                      <div className="hidden md:block">
                        <div className="text-lg font-bold text-brand">{inviter.conversionRate}%</div>
                        <div className="text-[10px] text-muted uppercase">Rate</div>
                      </div>
                      <div className="hidden md:block">
                        <div className="text-lg font-bold text-amber">{inviter.totalInviteeShows}</div>
                        <div className="text-[10px] text-muted uppercase">Invitee Shows</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted flex-shrink-0" />
                  </div>
                </div>
              ))}

              {inviteData.leaderboard.length === 0 && (
                <div className="text-center py-12 text-muted">
                  No inviters yet
                </div>
              )}
            </div>
          </div>

          {loadingInvites && (
            <div className="flex items-center justify-center py-8">
              <div className="text-secondary font-medium">Loading invite data...</div>
            </div>
          )}
        </div>
      )}

      {/* Roadmap Tab */}
      {adminTab === 'roadmap' && (
        <div className="space-y-6">
          {/* Header with New Item button + sort controls */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-lg font-semibold text-primary">Roadmap Items</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-secondary">Sort:</span>
                {[{ key: 'date', label: 'Newest' }, { key: 'votes', label: 'Most Votes' }].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setRoadmapSortBy(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      roadmapSortBy === opt.key
                        ? 'bg-brand-subtle text-brand border border-brand/30'
                        : 'bg-hover text-secondary border border-subtle hover:bg-hover'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCreatingItem(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-subtle hover:bg-brand/30 text-brand border border-brand/30 rounded-xl text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4" />
                New Item
              </button>
            </div>
          </div>

          {/* Create Item Form */}
          {creatingItem && (
            <div className="bg-hover border border-subtle rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-semibold text-primary">New Roadmap Item</h4>
              <input
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                placeholder="Title"
                className="w-full px-4 py-2.5 bg-hover border border-subtle rounded-xl text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
              <textarea
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full px-4 py-2.5 bg-hover border border-subtle rounded-xl text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none"
              />
              <select
                value={newItemCategory}
                onChange={e => setNewItemCategory(e.target.value)}
                className="w-full px-4 py-2.5 bg-hover border border-subtle rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {Object.entries(ROADMAP_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k} className="bg-surface">{v}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={createRoadmapItem}
                  disabled={!newItemTitle.trim() || savingItem}
                  className="px-4 py-2 bg-brand hover:bg-brand text-on-dark rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {savingItem ? 'Creating...' : 'Create Draft'}
                </button>
                <button
                  onClick={() => { setCreatingItem(false); setNewItemTitle(''); setNewItemDesc(''); setNewItemCategory('other'); }}
                  className="px-4 py-2 bg-hover hover:bg-hover text-secondary rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {roadmapLoading ? (
            <div className="text-center py-8 text-muted">Loading roadmap data...</div>
          ) : (
            <>
              {/* Drafts section */}
              {(() => {
                const drafts = roadmapItems.filter(i => i.status === 'draft');
                const sortedDrafts = roadmapSortBy === 'votes'
                  ? [...drafts].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
                  : drafts;
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">
                      Drafts ({drafts.length})
                    </h4>
                    <div className="space-y-3">
                      {sortedDrafts.map(item => (
                        <AdminRoadmapCard
                          key={item.id}
                          item={item}
                          onStatusChange={(status) => changeItemStatus(item, status)}
                          onPublish={(status) => publishRoadmapItem(item, status)}
                          onDismiss={() => dismissRoadmapItem(item)}
                          onNotify={() => sendCompletionNotifications(item)}
                          feedbackItems={feedbackItems}
                          saving={savingItem}
                          notifying={notifyingItem === item.id}
                        />
                      ))}
                      {drafts.length === 0 && (
                        <p className="text-muted text-sm py-2">No draft items</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Published sections by status */}
              {[
                { key: 'upnext',     label: 'Up Next'     },
                { key: 'inprogress', label: 'In Progress' },
                { key: 'shipped',    label: 'Shipped'     },
              ].map(({ key, label }) => {
                const statusItems = roadmapItems.filter(i => i.status === key);
                const sortedItems = roadmapSortBy === 'votes'
                  ? [...statusItems].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
                  : statusItems;
                return (
                  <div key={key}>
                    <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">
                      {label} ({statusItems.length})
                    </h4>
                    <div className="space-y-3">
                      {sortedItems.map(item => (
                        <AdminRoadmapCard
                          key={item.id}
                          item={item}
                          onStatusChange={(status) => changeItemStatus(item, status)}
                          onPublish={(status) => publishRoadmapItem(item, status)}
                          onDismiss={() => dismissRoadmapItem(item)}
                          onNotify={() => sendCompletionNotifications(item)}
                          feedbackItems={feedbackItems}
                          saving={savingItem}
                          notifying={notifyingItem === item.id}
                        />
                      ))}
                      {statusItems.length === 0 && (
                        <p className="text-muted text-sm py-2">None</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Bulk Import Tab */}
      {adminTab === 'bulkImport' && (
        <div className="space-y-6">
          {/* Step 1: Select User */}
          {bulkImportStep === 'select-user' && (
            <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-primary mb-1">Bulk Import Shows</h3>
              <p className="text-secondary text-sm mb-6">Select a user to import shows into their profile.</p>
              <div className="relative mb-4">
                <Search className="w-5 h-5 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-hover border border-subtle rounded-xl text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {users
                  .filter(u => {
                    const term = searchTerm.toLowerCase();
                    return !term || (u.displayName || '').toLowerCase().includes(term)
                      || (u.email || '').toLowerCase().includes(term)
                      || (u.firstName || '').toLowerCase().includes(term);
                  })
                  .map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleBulkImportSelectUser(u)}
                      className="w-full flex items-center gap-3 p-3 bg-hover hover:bg-hover border border-subtle rounded-xl text-left transition-all"
                    >
                      <div className="w-8 h-8 bg-brand-subtle rounded-full flex items-center justify-center text-brand text-sm font-bold flex-shrink-0">
                        {(u.firstName || u.displayName || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-primary font-medium text-sm truncate">{u.displayName || u.firstName || 'Anonymous'}</div>
                        <div className="text-muted text-xs truncate">{u.email}</div>
                      </div>
                      <div className="text-muted text-xs">{u.showCount || 0} shows</div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Step 2: Upload File */}
          {bulkImportStep === 'upload' && (
            <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6 p-3 bg-brand-subtle border border-brand/20 rounded-xl">
                <User className="w-5 h-5 text-brand" />
                <div>
                  <span className="text-primary font-medium text-sm">Importing for: </span>
                  <span className="text-brand font-medium text-sm">{bulkImportTargetUser?.displayName || bulkImportTargetUser?.firstName}</span>
                  <span className="text-muted text-xs ml-2">({bulkImportTargetUser?.email})</span>
                </div>
                <button onClick={resetBulkImport} className="ml-auto text-muted hover:text-primary text-xs">Change user</button>
              </div>
              {bulkImportLoadingShows ? (
                <div className="flex items-center justify-center py-12 text-muted">
                  <RefreshCw className="w-5 h-5 animate-spin mr-3" />
                  Loading existing shows for duplicate detection...
                </div>
              ) : (
                <>
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleBulkImportFile(f); }}
                    onClick={() => document.getElementById('bulk-import-file-input').click()}
                    className="border-2 border-dashed border-active hover:border-white/40 rounded-2xl p-12 text-center cursor-pointer transition-all"
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted" />
                    <p className="text-lg font-medium text-primary mb-2">Drag & drop your file here</p>
                    <p className="text-secondary mb-4">or click to browse</p>
                    <p className="text-muted text-sm">Supports .csv, .xlsx, .xls</p>
                    <input id="bulk-import-file-input" type="file" accept=".csv,.xlsx,.xls" onChange={e => { const f = e.target.files[0]; if (f) handleBulkImportFile(f); }} className="hidden" />
                  </div>
                  <p className="text-muted text-xs mt-3">Target user has {bulkImportTargetShows.length} existing show{bulkImportTargetShows.length !== 1 ? 's' : ''} (used for duplicate detection)</p>
                </>
              )}
              {bulkImportError && (
                <div className="mt-4 p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-danger text-sm">{bulkImportError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Column Mapping */}
          {bulkImportStep === 'mapping' && (
            <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6 p-3 bg-brand-subtle border border-brand/20 rounded-xl">
                <User className="w-5 h-5 text-brand" />
                <div>
                  <span className="text-primary font-medium text-sm">Importing for: </span>
                  <span className="text-brand font-medium text-sm">{bulkImportTargetUser?.displayName || bulkImportTargetUser?.firstName}</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-primary mb-2">Map Your Columns</h3>
              <p className="text-secondary text-sm mb-6">{bulkImportHeaders.length} columns detected from {bulkImportFileName} &middot; {bulkImportRawData.length} data row{bulkImportRawData.length !== 1 ? 's' : ''}</p>
              <div className="space-y-4 mb-8">
                {IMPORT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <label className="w-28 text-sm text-secondary flex items-center gap-1">
                      {field.label}{field.required && <span className="text-danger">*</span>}
                    </label>
                    <select
                      value={bulkImportMapping[field.key] !== undefined ? bulkImportMapping[field.key] : ''}
                      onChange={e => setBulkImportMapping(prev => ({ ...prev, [field.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      className="flex-1 px-4 py-2.5 bg-hover border border-subtle rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 [&>option]:bg-elevated"
                    >
                      <option value="">-- Skip --</option>
                      {bulkImportHeaders.map((h, i) => (<option key={i} value={i}>{h || `Column ${i + 1}`}</option>))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setBulkImportStep('upload')} className="px-5 py-2.5 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors">Back</button>
                <button
                  onClick={() => {
                    const missing = IMPORT_FIELDS.filter(f => f.required && bulkImportMapping[f.key] === undefined).map(f => f.label);
                    if (missing.length > 0) { setBulkImportError(`Map required columns: ${missing.join(', ')}`); return; }
                    setBulkImportError(null);
                    setBulkImportPreviewRows(buildBulkImportPreview());
                    setBulkImportStep('preview');
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-medium transition-all shadow-lg shadow-brand/20"
                >Preview Import</button>
              </div>
              {bulkImportError && (
                <div className="mt-4 p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-danger text-sm">{bulkImportError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Preview */}
          {bulkImportStep === 'preview' && (() => {
            const validRows = bulkImportPreviewRows.filter(r => r.errors.length === 0);
            const errorRows = bulkImportPreviewRows.filter(r => r.errors.length > 0);
            const duplicateRows = validRows.filter(r => r.isDuplicate);
            const importableRows = validRows.filter(r => !r.isDuplicate);
            return (
              <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6 p-3 bg-brand-subtle border border-brand/20 rounded-xl">
                  <User className="w-5 h-5 text-brand" />
                  <div>
                    <span className="text-primary font-medium text-sm">Importing for: </span>
                    <span className="text-brand font-medium text-sm">{bulkImportTargetUser?.displayName || bulkImportTargetUser?.firstName}</span>
                    <span className="text-muted text-xs ml-2">({bulkImportTargetUser?.email})</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">Review Import</h3>
                <p className="text-secondary text-sm mb-4">{bulkImportPreviewRows.length} rows from {bulkImportFileName}</p>
                <div className="flex flex-wrap gap-3 mb-6">
                  <span className="px-3 py-1.5 bg-brand-subtle text-brand rounded-lg text-sm font-medium">{importableRows.length} ready to import</span>
                  {errorRows.length > 0 && <span className="px-3 py-1.5 bg-danger/15 text-danger rounded-lg text-sm font-medium">{errorRows.length} with errors</span>}
                  {duplicateRows.length > 0 && <span className="px-3 py-1.5 bg-brand-subtle text-brand rounded-lg text-sm font-medium">{duplicateRows.length} duplicate{duplicateRows.length !== 1 ? 's' : ''} (will skip)</span>}
                </div>
                <div className="overflow-x-auto mb-6 max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-elevated/95">
                      <tr className="border-b border-subtle">
                        <th className="text-left px-3 py-2 text-secondary font-medium w-8">#</th>
                        <th className="text-left px-3 py-2 text-secondary font-medium">Artist</th>
                        <th className="text-left px-3 py-2 text-secondary font-medium">Venue</th>
                        <th className="text-left px-3 py-2 text-secondary font-medium">Date</th>
                        <th className="text-left px-3 py-2 text-secondary font-medium">City</th>
                        <th className="text-left px-3 py-2 text-secondary font-medium w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkImportPreviewRows.map((row, i) => (
                        <tr key={i} className={`border-b border-subtle ${row.errors.length > 0 ? 'bg-danger/5' : row.isDuplicate ? 'bg-brand/5' : ''}`}>
                          <td className="px-3 py-2 text-muted">{i + 1}</td>
                          <td className="px-3 py-2 text-secondary">{row.raw.artist || '—'}</td>
                          <td className="px-3 py-2 text-secondary">{row.raw.venue || '—'}</td>
                          <td className="px-3 py-2 text-secondary">{row.parsedDate ? formatDate(row.parsedDate) : <span className="text-danger">{row.raw.date || '—'}</span>}</td>
                          <td className="px-3 py-2 text-secondary">{row.raw.city || '—'}</td>
                          <td className="px-3 py-2">
                            {row.errors.length > 0 ? (
                              <Tip text={row.errors.join(', ')}><span className="text-danger text-xs flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Error</span></Tip>
                            ) : row.isDuplicate ? (
                              <span className="text-brand text-xs">Duplicate</span>
                            ) : (
                              <span className="text-brand text-xs"><Check className="w-4 h-4 inline" /></span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {bulkImportError && (
                  <div className="mb-4 p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-danger text-sm">{bulkImportError}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setBulkImportStep('mapping')} className="px-5 py-2.5 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors">Back</button>
                  <button
                    onClick={handleBulkImportExecute}
                    disabled={importableRows.length === 0}
                    className={`px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg ${importableRows.length > 0 ? 'bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary shadow-brand/20' : 'bg-hover text-muted cursor-not-allowed shadow-none'}`}
                  >
                    Import {importableRows.length} Show{importableRows.length !== 1 ? 's' : ''} for {(bulkImportTargetUser?.firstName || bulkImportTargetUser?.displayName || 'User').split(' ')[0]}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Step 5: Importing */}
          {bulkImportStep === 'importing' && (
            <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-brand-subtle rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="w-8 h-8 text-brand animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-primary mb-2">Importing Shows...</h3>
              <p className="text-secondary">Writing shows to {(bulkImportTargetUser?.firstName || bulkImportTargetUser?.displayName || 'user').split(' ')[0]}'s profile</p>
            </div>
          )}

          {/* Step 6: Complete */}
          {bulkImportStep === 'complete' && bulkImportProgress && (
            <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-brand-subtle rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-brand" />
              </div>
              <h3 className="text-lg font-semibold text-primary mb-2">Import Complete</h3>
              <div className="flex justify-center gap-6 mb-6">
                <div>
                  <div className="text-2xl font-bold text-brand">{bulkImportProgress.imported}</div>
                  <div className="text-xs text-secondary">Imported</div>
                </div>
                {bulkImportProgress.duplicatesSkipped > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-brand">{bulkImportProgress.duplicatesSkipped}</div>
                    <div className="text-xs text-secondary">Duplicates Skipped</div>
                  </div>
                )}
              </div>
              <p className="text-muted text-sm mb-6">Shows imported to {bulkImportTargetUser?.displayName || bulkImportTargetUser?.firstName}'s profile</p>
              <button onClick={resetBulkImport} className="px-5 py-2.5 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-medium transition-all shadow-lg shadow-brand/20">
                Import More
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tools Tab */}
      {adminTab === 'tools' && (
        <div className="space-y-6">
          <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-primary mb-1">Find Missing Setlists</h3>
            <p className="text-secondary text-sm mb-4">Scan all shows that are missing setlists and attempt to fetch them from Setlist.fm.</p>
            {shows.some(s => !s.setlist || s.setlist.length === 0) ? (
              <>
                <p className="text-muted text-sm mb-4">
                  {shows.filter(s => !s.setlist || s.setlist.length === 0).length} show{shows.filter(s => !s.setlist || s.setlist.length === 0).length !== 1 ? 's' : ''} missing setlists
                </p>
                <button
                  onClick={scanForMissingSetlists}
                  disabled={setlistScanning}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand to-amber text-on-dark rounded-xl font-medium transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${setlistScanning ? 'animate-spin' : ''}`} />
                  {setlistScanning ? 'Scanning...' : 'Find Missing Setlists'}
                </button>
                {setlistScanning && (
                  <div className="mt-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-primary font-medium text-sm">Scanning...</span>
                      <span className="text-secondary text-sm ml-auto">{setlistScanProgress.current} / {setlistScanProgress.total}</span>
                    </div>
                    <div className="w-full bg-hover rounded-full h-2">
                      <div
                        className="bg-amber h-2 rounded-full transition-all duration-300"
                        style={{ width: `${setlistScanProgress.total > 0 ? (setlistScanProgress.current / setlistScanProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    {setlistScanProgress.found > 0 && (
                      <p className="text-amber text-sm mt-2">{setlistScanProgress.found} setlist{setlistScanProgress.found !== 1 ? 's' : ''} found so far</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-brand text-sm">All shows have setlists!</p>
            )}
          </div>

          {/* Duplicate Show Cleanup */}
          <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-primary mb-1">Duplicate Show Cleanup</h3>
            <p className="text-secondary text-sm mb-4">Scan all users for duplicate shows (same artist + venue + date) and merge them.</p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setDupeCleanupLoading(true);
                  setDupeCleanupResult(null);
                  try {
                    const token = await auth.currentUser.getIdToken();
                    const res = await fetch(apiUrl('/.netlify/functions/admin-cleanup-duplicates'), {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ dryRun: true }),
                    });
                    const data = await res.json();
                    setDupeCleanupResult(data);
                  } catch (e) {
                    setDupeCleanupResult({ error: e.message });
                  }
                  setDupeCleanupLoading(false);
                }}
                disabled={dupeCleanupLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-subtle hover:bg-amber/30 text-amber border border-amber/30 rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                {dupeCleanupLoading ? 'Scanning...' : 'Dry Run (Preview)'}
              </button>
              <button
                onClick={async () => {
                  if (!confirm('This will permanently merge duplicate shows. Continue?')) return;
                  setDupeCleanupLoading(true);
                  setDupeCleanupResult(null);
                  try {
                    const token = await auth.currentUser.getIdToken();
                    const res = await fetch(apiUrl('/.netlify/functions/admin-cleanup-duplicates'), {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ dryRun: false }),
                    });
                    const data = await res.json();
                    setDupeCleanupResult(data);
                  } catch (e) {
                    setDupeCleanupResult({ error: e.message });
                  }
                  setDupeCleanupLoading(false);
                }}
                disabled={dupeCleanupLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Run Cleanup
              </button>
            </div>
            {dupeCleanupResult && (
              <div className="mt-4 bg-surface border border-subtle rounded-xl p-4 text-sm">
                {dupeCleanupResult.error ? (
                  <p className="text-danger">Error: {dupeCleanupResult.error}</p>
                ) : (
                  <>
                    <p className="text-primary font-medium mb-2">
                      {dupeCleanupResult.dryRun ? '🔍 Dry Run Results' : '✅ Cleanup Complete'}
                    </p>
                    <div className="space-y-1 text-secondary">
                      <p>Users scanned: {dupeCleanupResult.usersScanned}</p>
                      <p>Duplicates found: {dupeCleanupResult.duplicatesFound}</p>
                      <p>Duplicates {dupeCleanupResult.dryRun ? 'to merge' : 'merged'}: {dupeCleanupResult.duplicatesMerged}</p>
                    </div>
                    {dupeCleanupResult.details?.length > 0 && (
                      <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
                        {dupeCleanupResult.details.map((d, i) => (
                          <p key={i} className="text-xs text-muted">
                            {d.artist} @ {d.venue} ({d.date}) — {d.removedShowIds.length} duplicate{d.removedShowIds.length !== 1 ? 's' : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cache Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Database className="w-5 h-5 text-amber" />
            Setlist.fm Cache
          </h3>
          <button
            onClick={loadCacheStats}
            disabled={cacheLoading}
            className="px-4 py-2 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
          >
            {cacheLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Cached Searches', value: cacheEntries.length, color: 'from-amber to-amber' },
            { label: 'Active Entries', value: cacheEntries.filter(e => e.isActive).length, color: 'from-brand to-amber' },
            { label: 'Total Cache Hits', value: cacheEntries.reduce((a, e) => a + e.hitCount, 0), color: 'from-brand to-brand' },
          ].map(stat => (
            <div key={stat.label} className="bg-hover backdrop-blur-xl rounded-2xl p-4 border border-subtle">
              <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {stat.value.toLocaleString()}
              </div>
              <div className="text-xs font-medium text-secondary mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Artist name to clear from cache..."
            value={cacheClearArtist}
            onChange={e => setCacheClearArtist(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && cacheClearArtist.trim() && clearCache('artist', cacheClearArtist)}
            className="flex-1 px-4 py-2.5 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-amber/50 text-primary placeholder-muted text-sm"
          />
          <button
            onClick={() => clearCache('artist', cacheClearArtist)}
            disabled={!cacheClearArtist.trim()}
            className="px-4 py-2.5 bg-amber-subtle hover:bg-amber-subtle text-amber rounded-xl font-medium transition-colors text-sm disabled:opacity-40"
          >
            Clear Artist
          </button>
          <button
            onClick={() => clearCache('all')}
            className="px-4 py-2.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-xl font-medium transition-colors text-sm"
          >
            Clear All
          </button>
        </div>

        {cacheStatus && (
          <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${cacheStatus.startsWith('Error') ? 'bg-danger/20 text-danger' : 'bg-brand-subtle text-brand'}`}>
            {cacheStatus}
          </div>
        )}

        {cacheEntries.length > 0 && (
          <div className="bg-hover backdrop-blur-xl border border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-hover border-b border-subtle">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Artist</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide hidden sm:table-cell">Page</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Hits</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide hidden md:table-cell">TTL</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide hidden lg:table-cell">Expires</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cacheEntries.map(entry => (
                  <tr key={entry.key} className="hover:bg-hover transition-colors">
                    <td className="px-4 py-3 text-primary font-medium capitalize">{entry.artistName || '—'}</td>
                    <td className="px-4 py-3 text-secondary text-center hidden sm:table-cell">{entry.page}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-amber-subtle text-amber px-2 py-0.5 rounded-full text-xs font-semibold">{entry.hitCount}</span>
                    </td>
                    <td className="px-4 py-3 text-secondary text-center hidden md:table-cell">{entry.ttlHours}h</td>
                    <td className="px-4 py-3 text-muted text-center text-xs hidden lg:table-cell">{entry.expiresAt}</td>
                    <td className="px-4 py-3 text-center">
                      {entry.isActive
                        ? <span className="bg-brand-subtle text-brand px-2 py-0.5 rounded-full text-xs">Active</span>
                        : <span className="bg-hover text-muted px-2 py-0.5 rounded-full text-xs">Expired</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Tip text="Delete this entry">
                        <button
                          onClick={() => clearCache('key', null, entry.key)}
                          className="text-danger/50 hover:text-danger transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </Tip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cacheLoading && cacheEntries.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">
            No cache entries yet. Cache will populate as users search for setlists.
          </div>
        )}
      </div>

      {/* Popups Tab */}
      {adminTab === 'popups' && <AdminPopups />}

      {/* Delete User Confirmation Dialog */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-elevated border border-danger/30 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-danger/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-danger/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <h2 className="text-lg font-semibold text-primary">Delete User</h2>
            </div>
            <p className="text-secondary mb-2 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="text-primary font-medium">{deleteConfirmUser.firstName}</span>
              {deleteConfirmUser.email ? ` (${deleteConfirmUser.email})` : ''}?
            </p>
            <p className="text-secondary text-sm mb-6 leading-relaxed">
              This will delete their account, all shows, friend connections, show tags, and invites.{' '}
              <span className="text-danger font-medium">This cannot be undone.</span>
            </p>
            {deleteError && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 mb-4 text-sm text-danger">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteConfirmUser(null); setDeleteError(null); }}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-hover hover:bg-hover text-secondary rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-danger hover:bg-danger/80 text-primary rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleteLoading ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

