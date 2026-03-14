'use client';

import React, { useState } from 'react';
import { Check, Send, RefreshCw } from 'lucide-react';

function InviteView({ currentUserUid, currentUser, onSendInvite }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null); // null | 'success' | 'error' | string (error message)
  const [copyLabel, setCopyLabel] = useState('Copy');

  const inviteUrl = currentUserUid ? `https://mysetlists.net?ref=${currentUserUid}` : 'https://mysetlists.net';

  const handleInvite = async () => {
    if (!email.trim() || !currentUserUid || !onSendInvite) return;
    setSending(true);
    setSendStatus(null);
    const result = await onSendInvite(email.trim());
    setSending(false);
    if (result?.success) {
      setSendStatus('success');
      setEmail('');
    } else {
      setSendStatus(result?.error || 'error');
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Invite Friends</h1>
      <p className="text-white/60 mb-8">Share mysetlists.net with your concert-going friends.</p>

      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <label className="block text-sm font-medium text-white/70 mb-2">
          Friend's Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSendStatus(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
          placeholder="friend@example.com"
          className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 mb-4"
        />
        <button
          onClick={handleInvite}
          disabled={!email.trim() || sending}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
        >
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Sending...' : 'Send Invitation'}
        </button>

        {sendStatus === 'success' && (
          <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <Check className="w-4 h-4" />
            Invite sent! They'll get an email from mysetlists.net.
          </div>
        )}
        {sendStatus && sendStatus !== 'success' && (
          <div className="mt-3 text-rose-400 text-sm">
            {sendStatus === 'error'
              ? 'Something went wrong. Try copying the link below instead.'
              : sendStatus}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-medium text-white/70 mb-2">Or share this link:</h3>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white/60"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              setCopyLabel('Copied!');
              setTimeout(() => setCopyLabel('Copy'), 2000);
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm font-medium transition-colors"
          >
            {copyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InviteView;
