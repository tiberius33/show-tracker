'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, RotateCcw } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { artistColor } from '@/lib/utils';

const DAILY_LIMIT = 10;
const MAX_HISTORY = 8;
const STORAGE_KEY = 'artist_ai_daily';

function getDailyUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: '', count: 0 };
    return JSON.parse(raw);
  } catch {
    return { date: '', count: 0 };
  }
}

function incrementDailyUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const usage = getDailyUsage();
  const count = usage.date === today ? usage.count + 1 : 1;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count }));
  } catch { /* ignore */ }
  return count;
}

function getRemainingQuestions() {
  const today = new Date().toISOString().slice(0, 10);
  const usage = getDailyUsage();
  if (usage.date !== today) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - usage.count);
}

const EXAMPLE_QUESTIONS = [
  "What's their most played song?",
  "When did they last play [song name]?",
  "Have I seen [song name] live?",
  "What songs haven't I heard yet?",
];

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

export default function ArtistAIChat({ artistName, mbid, userShows = [], onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(DAILY_LIMIT);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const color = artistColor(artistName);

  useEffect(() => {
    setRemaining(getRemainingQuestions());
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const question = text.trim();
    if (!question || loading || remaining <= 0) return;

    const userMsg = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    // Build conversation history (exclude the message we just added)
    const history = messages.slice(-MAX_HISTORY);

    try {
      const res = await fetch(apiUrl('/.netlify/functions/ask-artist-ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName,
          mbid,
          userQuestion: question,
          conversationHistory: history,
          userShows
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Something went wrong');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      const newRemaining = getRemainingQuestions();
      // Count was incremented on server call; decrement locally
      incrementDailyUsage();
      setRemaining(prev => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || 'Failed to get a response. Please try again.');
      // Remove the user message on error so they can retry
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  const atLimit = remaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full sm:max-w-lg flex flex-col bg-surface border border-subtle rounded-t-2xl sm:rounded-2xl shadow-2xl"
           style={{ maxHeight: '90vh', height: '90vh' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ backgroundColor: `${color}22` }}>
            <Sparkles className="w-4 h-4" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-primary text-sm leading-tight">
              Ask AI about {artistName}
            </h2>
            <p className="text-xs text-muted">
              {atLimit
                ? 'Daily limit reached. Try again tomorrow!'
                : `${remaining} question${remaining !== 1 ? 's' : ''} remaining today`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={clearChat} className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-secondary transition-colors" title="Clear chat">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-secondary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="space-y-4">
              <p className="text-sm text-secondary text-center">
                Ask anything about {artistName} — their tours, setlists, or your own show history.
              </p>
              <div className="space-y-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q.replace('[song name]', ''))}
                    disabled={atLimit}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-hover hover:bg-[rgba(255,255,255,0.08)] border border-subtle text-sm text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                     style={{ backgroundColor: `${color}22` }}>
                  <Sparkles className="w-3 h-3" style={{ color }} />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand/20 text-primary rounded-br-sm border border-brand/20'
                  : 'bg-hover text-primary rounded-bl-sm border border-subtle'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                   style={{ backgroundColor: `${color}22` }}>
                <Sparkles className="w-3 h-3" style={{ color }} />
              </div>
              <div className="bg-hover border border-subtle rounded-2xl rounded-bl-sm">
                <LoadingDots />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 text-center px-3 py-2 bg-red-500/10 rounded-xl border border-red-500/20">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Daily limit bar */}
        {!atLimit && (
          <div className="px-4 pt-0 pb-1 flex-shrink-0">
            <div className="w-full h-0.5 rounded-full bg-hover overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(remaining / DAILY_LIMIT) * 100}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-subtle">
          {atLimit ? (
            <div className="text-center py-3 text-sm text-muted">
              You&apos;ve used all 10 questions for today. Come back tomorrow!
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask about ${artistName}...`}
                rows={1}
                disabled={loading}
                className="flex-1 resize-none bg-hover border border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors disabled:opacity-50 leading-relaxed"
                style={{ minHeight: '40px', maxHeight: '100px' }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: color + '33', color }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-[10px] text-muted text-center mt-2">Powered by Claude AI</p>
        </div>
      </div>
    </div>
  );
}
