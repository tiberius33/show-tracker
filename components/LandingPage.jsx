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
    gradient: 'from-accent-amber to-accent-teal',
    title: 'Track Every Show',
    description: 'Log every concert, festival, and live performance. Rate songs, add notes, and build your personal concert history.',
  },
  {
    icon: Camera,
    gradient: 'from-accent-teal to-accent-teal',
    title: 'Scan Ticket Stubs',
    description: 'Snap a photo of any ticket stub, wristband, or digital ticket. AI reads the details and adds the show instantly.',
  },
  {
    icon: Upload,
    gradient: 'from-accent-teal to-accent-teal',
    title: 'Import Your History',
    description: 'Bulk import from CSV or Excel. Search setlist.fm by artist to find and add shows with full setlists.',
  },
  {
    icon: ListMusic,
    gradient: 'from-accent-amber to-success',
    title: 'Create Playlists',
    description: 'Turn any setlist into a Spotify or Apple Music playlist with one tap. Relive the show on your favorite platform.',
  },
  {
    icon: BarChart3,
    gradient: 'from-danger to-danger',
    title: 'Discover Your Stats',
    description: 'See your top artists, most-visited venues, songs heard most, and detailed breakdowns by year.',
  },
  {
    icon: Users,
    gradient: 'from-accent-amber to-accent-amber',
    title: 'Connect with Friends',
    description: 'Tag friends at shows, compare concert histories, share memories, and see community leaderboards.',
  },
];

export default function LandingPage({ onSignUp, onSignIn, onGuest, communityStats }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-void via-surface to-void text-primary">
      {/* ── Navigation Bar ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-black/30 backdrop-blur-xl border-b border-subtle">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/logo.svg" alt="MySetlists" className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onSignUp}
              className="px-5 py-2 text-sm font-semibold bg-accent-amber hover:bg-accent-amber text-primary rounded-full transition-all shadow-lg shadow-accent-amber/20"
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
        <p className="text-lg md:text-xl text-secondary mb-8 md:mb-10 max-w-xl mx-auto leading-relaxed px-4">
          Save setlists, rate songs, discover patterns in your concert history, and join a community of live music lovers.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onSignUp}
            className="inline-flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-accent-amber to-accent-teal hover:from-accent-amber hover:to-accent-teal text-primary rounded-full transition-all text-base md:text-lg font-semibold shadow-xl shadow-accent-amber/20 hover:shadow-accent-amber/50 hover:scale-105"
          >
            <Music className="w-5 h-5" />
            Get Started Free
          </button>
          <button
            onClick={onGuest}
            className="inline-flex items-center gap-2 px-6 py-3 md:py-4 bg-highlight hover:bg-highlight border border-active text-primary rounded-full transition-all text-base font-medium"
          >
            Try it First
          </button>
        </div>
        <p className="mt-4 text-sm text-muted">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-secondary hover:text-primary underline">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-secondary hover:text-primary underline">Privacy Policy</Link>.
        </p>
        <div className="mt-5">
          <a
            href="https://buymeacoffee.com/phillipd"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-secondary hover:text-accent-amber transition-colors"
          >
            <Heart className="w-4 h-4" />
            Support this project
          </a>
        </div>
      </section>

      {/* ── Feature Grid ──────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 font-display">Everything you need to track your live music life</h2>
        <p className="text-center text-secondary mb-10 md:mb-14 max-w-lg mx-auto">
          From your first concert to your 500th, MySetlists keeps every show organized and meaningful.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-highlight backdrop-blur-sm border border-subtle rounded-2xl p-5 md:p-6 hover:bg-highlight transition-all group"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-primary mb-1.5 font-display">{f.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 md:mb-14 font-display">Get started in 60 seconds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {[
            { step: '1', title: 'Add a show', desc: 'Search by artist, scan a ticket, or import a file.', icon: Ticket },
            { step: '2', title: 'Rate & remember', desc: 'Rate songs, leave notes, and tag friends who were there.', icon: Star },
            { step: '3', title: 'Discover insights', desc: 'See your stats, create playlists, and climb the leaderboards.', icon: TrendingUp },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-full bg-accent-amber-glow border-2 border-accent-amber/30 flex items-center justify-center mx-auto mb-4 text-accent-amber font-bold text-xl">
                  {s.step}
                </div>
                <h3 className="font-semibold text-primary mb-1.5 font-display">{s.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Community Stats (if available) ─────────────────────── */}
      {communityStats && (
        <section className="max-w-6xl mx-auto px-4 py-8 md:py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2 font-display">Community Highlights</h2>
            <p className="text-secondary">
              Join {communityStats.totalUsers || 0} concert-goers tracking {communityStats.totalShows || 0} shows
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Top Shows Attended */}
            <div className="bg-highlight backdrop-blur-xl rounded-2xl p-5 border border-subtle hover:bg-highlight transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-amber to-accent-amber rounded-xl flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-primary text-sm">Top Show-Goers</h4>
              </div>
              <div className="space-y-2.5">
                {(communityStats.topShowsAttended || []).slice(0, 5).map((u, i) => (
                  <div key={u.userId || i} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 text-right ${i === 0 ? 'text-accent-amber' : i === 1 ? 'text-secondary' : i === 2 ? 'text-accent-amber' : 'text-muted'}`}>
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-amber to-accent-amber flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-secondary text-sm flex-1 truncate">{u.firstName}</span>
                    <span className="text-accent-amber font-semibold text-sm">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Songs Rated */}
            <div className="bg-highlight backdrop-blur-xl rounded-2xl p-5 border border-subtle hover:bg-highlight transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-danger to-danger rounded-xl flex items-center justify-center">
                  <Star className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-primary text-sm">Top Raters</h4>
              </div>
              <div className="space-y-2.5">
                {(communityStats.topSongsRated || []).slice(0, 5).map((u, i) => (
                  <div key={u.userId || i} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 text-right ${i === 0 ? 'text-accent-teal' : i === 1 ? 'text-secondary' : i === 2 ? 'text-accent-teal' : 'text-muted'}`}>
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-danger to-danger flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-secondary text-sm flex-1 truncate">{u.firstName}</span>
                    <span className="text-accent-teal font-semibold text-sm">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Popular Songs */}
            <div className="bg-highlight backdrop-blur-xl rounded-2xl p-5 border border-subtle hover:bg-highlight transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-teal to-accent-teal rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-primary text-sm">Popular Songs</h4>
              </div>
              <div className="space-y-2.5">
                {(communityStats.topSongsBySightings || []).slice(0, 5).map((song, i) => (
                  <div key={song.songName || i} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 text-right ${i === 0 ? 'text-accent-teal' : i === 1 ? 'text-secondary' : i === 2 ? 'text-accent-teal' : 'text-muted'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-secondary text-sm truncate">{song.songName}</div>
                      <div className="text-muted text-xs truncate">{song.artists?.join(', ')}</div>
                    </div>
                    <span className="text-accent-teal font-semibold text-xs whitespace-nowrap">{song.userCount} fans</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Venues Visited */}
            <div className="bg-highlight backdrop-blur-xl rounded-2xl p-5 border border-subtle hover:bg-highlight transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-teal to-accent-teal rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-primary text-sm">Venue Explorers</h4>
              </div>
              <div className="space-y-2.5">
                {(communityStats.topVenuesVisited || []).slice(0, 5).map((u, i) => (
                  <div key={u.userId || i} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 text-right ${i === 0 ? 'text-accent-teal' : i === 1 ? 'text-secondary' : i === 2 ? 'text-accent-teal/60' : 'text-muted'}`}>
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-teal to-accent-teal flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-secondary text-sm flex-1 truncate">{u.firstName}</span>
                    <span className="text-accent-teal font-semibold text-sm">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-12 md:py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 font-display">Ready to track your concert journey?</h2>
        <p className="text-secondary mb-8 max-w-md mx-auto">
          Free forever. No ads. Built by a fellow concert-goer.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onSignUp}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-accent-amber to-accent-teal hover:from-accent-amber hover:to-accent-teal text-primary rounded-full transition-all text-lg font-semibold shadow-xl shadow-accent-amber/20 hover:shadow-accent-amber/50 hover:scale-105"
          >
            <Music className="w-5 h-5" />
            Create Free Account
          </button>
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2 px-6 py-4 text-secondary hover:text-primary transition-colors font-medium"
          >
            Already have an account? <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
