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
      <h1 className="text-xl md:text-2xl font-bold text-primary mb-2">Invite Friends</h1>
      <p className="text-secondary mb-8">Share mysetlists.net with your concert-going friends.</p>

      <div className="bg-hover backdrop-blur-xl rounded-2xl border border-subtle p-6">
        <label className="block text-sm font-medium text-secondary mb-2">
          Friend's Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSendStatus(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
          placeholder="friend@example.com"
          className="w-full px-4 py-3 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted mb-4"
        />
        <button
          onClick={handleInvite}
          disabled={!email.trim() || sending}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber text-primary rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
        >
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Sending...' : 'Send Invitation'}
        </button>

        {sendStatus === 'success' && (
          <div className="mt-3 flex items-center gap-2 text-brand text-sm font-medium">
            <Check className="w-4 h-4" />
            Invite sent! They'll get an email from mysetlists.net.
          </div>
        )}
        {sendStatus && sendStatus !== 'success' && (
          <div className="mt-3 text-danger text-sm">
            {sendStatus === 'error'
              ? 'Something went wrong. Try copying the link below instead.'
              : sendStatus}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-hover rounded-xl border border-subtle">
        <h3 className="text-sm font-medium text-secondary mb-2">Or share this link:</h3>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="flex-1 px-3 py-2 bg-hover border border-subtle rounded-lg text-sm text-secondary"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              setCopyLabel('Copied!');
              setTimeout(() => setCopyLabel('Copy'), 2000);
            }}
            className="px-4 py-2 bg-hover hover:bg-hover text-secondary rounded-lg text-sm font-medium transition-colors"
          >
            {copyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InviteView;
