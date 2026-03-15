'use client';

import React from 'react';
import Link from 'next/link';
import {
  Music, Heart, Camera, Upload, Users, Star, BarChart3, ListMusic,
  Ticket, MapPin, Trophy, TrendingUp, Building2, User, ChevronRight,
} from 'lucide-react';
import Footer from './Footer';

const FEATURES = [
  {
    icon: Music,
    gradient: 'from-emerald-400 to-teal-500',
    title: 'Track Every Show',
    description: 'Log every concert, festival, and live performance. Rate songs, add notes, and build your personal concert history.',
  },
  {
    icon: Camera,
    gradient: 'from-violet-400 to-purple-500',
    title: 'Scan Ticket Stubs',
    description: 'Snap a photo of any ticket stub, wristband, or digital ticket. AI reads the details and adds the show instantly.',
  },
  {
    icon: Upload,
    gradient: 'from-blue-400 to-cyan-500',
    title: 'Import Your History',
    description: 'Bulk import from CSV or Excel. Search setlist.fm by artist to find and add shows with full setlists.',
  },
  {
    icon: ListMusic,
    gradient: 'from-emerald-400 to-green-500',
    title: 'Create Playlists',
    description: 'Turn any setlist into a Spotify or Apple Music playlist with one tap. Relive the show on your favorite platform.',
  },
  {
    icon: BarChart3,
    gradient: 'from-pink-400 to-rose-500',
    title: 'Discover Your Stats',
    description: 'See your top artists, most-visited venues, songs heard most, and detailed breakdowns by year.',
  },
  {
    icon: Users,
    gradient: 'from-amber-400 to-orange-500',
    title: 'Connect with Friends',
    description: 'Tag friends at shows, compare concert histories, share memories, and see community leaderboards.',
  },
];

export default function LandingPage({ onSignUp, onSignIn, onGuest, communityStats }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* ── Navigation Bar ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/logo.svg" alt="MySetlists" className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onSignUp}
              className="px-5 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-full transition-all shadow-lg shadow-emerald-500/25"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8 md:pt-20 md:pb-16 text-center">
        <img
          src="/logo.svg"
          alt="MySetlists"
          className="h-24 md:h-32 w-auto mx-auto mb-6 md:mb-8 drop-shadow-2xl"
        />
        <p className="text-lg md:text-xl text-white/70 mb-8 md:mb-10 max-w-xl mx-auto leading-relaxed px-4">
          Save setlists, rate songs, discover patterns in your concert history, and join a community of live music lovers.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onSignUp}
            className="inline-flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-full transition-all text-base md:text-lg font-semibold shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
          >
            <Music className="w-5 h-5" />
            Get Started Free
          </button>
          <button
            onClick={onGuest}
            className="inline-flex items-center gap-2 px-6 py-3 md:py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full transition-all text-base font-medium"
          >
            Try it First
          </button>
        </div>
        <p className="mt-4 text-sm text-white/40">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-white/60 hover:text-white/80 underline">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-white/60 hover:text-white/80 underline">Privacy Policy</Link>.
        </p>
        <div className="mt-5">
          <a
            href="https://buymeacoffee.com/phillipd"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-amber-400 transition-colors"
          >
            <Heart className="w-4 h-4" />
            Support this project
          </a>
        </div>
      </section>

      {/* ── Feature Grid ──────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Everything you need to track your live music life</h2>
        <p className="text-center text-white/50 mb-10 md:mb-14 max-w-lg mx-auto">
          From your first concert to your 500th, MySetlists keeps every show organized and meaningful.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6 hover:bg-white/[0.08] transition-all group"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 md:mb-14">Get started in 60 seconds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {[
            { step: '1', title: 'Add a show', desc: 'Search by artist, scan a ticket, or import a file.', icon: Ticket },
            { step: '2', title: 'Rate & remember', desc: 'Rate songs, leave notes, and tag friends who were there.', icon: Star },
            { step: '3', title: 'Discover insights', desc: 'See your stats, create playlists, and climb the leaderboards.', icon: TrendingUp },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400 font-bold text-xl">
                  {s.step}
                </div>
                <h3 className="font-semibold text-white mb-1.5">{s.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Community Stats (if available) ─────────────────────── */}
      {communityStats && (
        <section className="max-w-6xl mx-auto px-4 py-8 md:py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Community Highlights</h2>
            <p className="text-white/50">
              Join {communityStats.totalUsers || 0} concert-goers tracking {communityStats.totalShows || 0} shows
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Top Shows Attended */}
            <div className="bg-white/[0.06] backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:bg-white/[0.09] transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-semibold text-white/90 text-sm">Top Show-Goers</h4>
              </div>
              <div className="space-y-2.5">
                {(communityStats.topShowsAttended || []).slice(0, 5).map((u, i) => (
                  <div key={u.userId || i} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 text-right ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/40'}`}>
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-white/80 text-sm flex-1 truncate">{u.firstName}</span>
                    <span className="text-emerald-400 font-semibold text-sm">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Songs Rated */}
            <div className="bg-white/[0.06] backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:bg-white/[0.09] transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center">
                  <Star className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-semibold text-white/90 text-sm">Top Raters</h4>
              </div>
              <div className="space-y-2.5">
                {(communityStats.topSongsRated || []).slice(0, 5).map((u, i) => (
                  <div key={u.userId || i} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 text-right ${i === 0 ? 'text-pink-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-pink-600' : 'text-white/40'}`}>
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-white/80 text-sm flex-1 truncate">{u.firstName}</span>
                    <span className="text-pink-400 font-semibold text-sm">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Popular Songs */}
            <div className="bg-white/[0.06] backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:bg-white/[0.09] transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-semibold text-white/90 text-sm">Popular Songs</h4>
              </div>
              <div className="space-y-2.5">
                {(communityStats.topSongsBySightings || []).slice(0, 5).map((song, i) => (
                  <div key={song.songName || i} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 text-right ${i === 0 ? 'text-violet-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-violet-600' : 'text-white/40'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white/80 text-sm truncate">{song.songName}</div>
                      <div className="text-white/40 text-xs truncate">{song.artists?.join(', ')}</div>
                    </div>
                    <span className="text-violet-400 font-semibold text-xs whitespace-nowrap">{song.userCount} fans</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Venues Visited */}
            <div className="bg-white/[0.06] backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:bg-white/[0.09] transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-semibold text-white/90 text-sm">Venue Explorers</h4>
              </div>
              <div className="space-y-2.5">
                {(communityStats.topVenuesVisited || []).slice(0, 5).map((u, i) => (
                  <div key={u.userId || i} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 text-right ${i === 0 ? 'text-cyan-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-cyan-600' : 'text-white/40'}`}>
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-white/80 text-sm flex-1 truncate">{u.firstName}</span>
                    <span className="text-cyan-400 font-semibold text-sm">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-12 md:py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to track your concert journey?</h2>
        <p className="text-white/50 mb-8 max-w-md mx-auto">
          Free forever. No ads. Built by a fellow concert-goer.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onSignUp}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-full transition-all text-lg font-semibold shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
          >
            <Music className="w-5 h-5" />
            Create Free Account
          </button>
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2 px-6 py-4 text-white/60 hover:text-white transition-colors font-medium"
          >
            Already have an account? <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
