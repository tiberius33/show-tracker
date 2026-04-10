'use client';

import React, { useState } from 'react';
import { Search, Camera, BarChart3, Users, Music, Star, ChevronDown, ChevronUp, Ticket, Upload, Tag, BookOpen } from 'lucide-react';

const sections = [
  {
    id: 'adding-shows',
    icon: Search,
    title: 'Adding Shows',
    description: 'Two ways to build your show history',
    steps: [
      {
        heading: 'Search for a Show',
        body: 'Click "Search for a Show" in the sidebar or the button on the Shows page. Enter an artist name and optional year, venue, or city. Select the show from the results — the setlist is imported automatically from Setlist.fm.',
      },
      {
        heading: 'Scan / Import',
        body: 'Have ticket stubs or a spreadsheet? Use Scan / Import. Take a photo of your ticket stubs and AI will extract the show details. Or upload a CSV/Excel file to add dozens of shows at once.',
      },
    ],
  },
  {
    id: 'setlists-ratings',
    icon: Music,
    title: 'Setlists & Ratings',
    description: 'Rate shows and individual songs',
    steps: [
      {
        heading: 'View a Setlist',
        body: 'Click any show in your list to open it. If a setlist was imported from Setlist.fm you\'ll see every song played. Toggle play counts to see how many times you\'ve heard each song across all your shows.',
      },
      {
        heading: 'Rate Songs & Shows',
        body: 'Tap the star next to any song to rate it. Rate the overall show from the show detail view. Your ratings feed into your Stats page, showing your top songs, artists, and venues.',
      },
      {
        heading: 'Find Missing Setlists',
        body: 'If a show is missing its setlist, the "Find Setlists" banner will appear on your Shows page. Click it to automatically fetch setlists for all your shows that are missing one.',
      },
    ],
  },
  {
    id: 'stats',
    icon: BarChart3,
    title: 'Stats',
    description: 'Discover patterns in your concert history',
    steps: [
      {
        heading: 'Your Stats Dashboard',
        body: 'The Stats page shows your most-seen artists, top venues, songs heard most often, and show frequency by year. Click any stat to drill into the details.',
      },
      {
        heading: 'Leaderboard',
        body: 'See how your show count ranks among all MySetlists users. Your rank appears in the summary bar at the top of the Shows page.',
      },
    ],
  },
  {
    id: 'friends',
    icon: Users,
    title: 'Friends & Tagging',
    description: 'Share shows with people you went with',
    steps: [
      {
        heading: 'Add Friends',
        body: 'Go to Friends and search by username or email. Send a friend request — once accepted, you can tag each other in shows.',
      },
      {
        heading: 'Tag Friends in Shows',
        body: 'Open a show and tap the Tag Friends button to mark who was there with you. Friends will receive a notification and the show will appear in their history too.',
      },
      {
        heading: 'Bulk Tagging',
        body: 'Use "Select Multiple Shows" on the Shows page to tag a friend in several shows at once — great for when you just added a bunch of past shows.',
      },
    ],
  },
  {
    id: 'upcoming',
    icon: Ticket,
    title: 'Upcoming Shows',
    description: 'Track shows you\'re planning to attend',
    steps: [
      {
        heading: 'Add an Upcoming Show',
        body: 'Go to Upcoming Shows (Beta) and add concerts you have tickets to. After the show date passes, you\'ll be prompted to move it to your show history.',
      },
    ],
  },
  {
    id: 'profile',
    icon: Star,
    title: 'Profile & Sharing',
    description: 'Customize your profile and share your history',
    steps: [
      {
        heading: 'Public Profile',
        body: 'Your Profile page has a shareable link. Friends and non-members can view your show history, stats, and setlists without needing an account.',
      },
      {
        heading: 'Favorite Artists',
        body: 'Star artists from within any show to mark them as favorites. Favorited artists are highlighted on your Shows page.',
      },
    ],
  },
];

const faqs = [
  {
    q: 'Where does the setlist data come from?',
    a: 'Setlists are pulled from Setlist.fm, the largest community-driven setlist database. If a setlist isn\'t available yet, check back after a few days — the community usually adds them quickly.',
  },
  {
    q: 'Can I edit a setlist if it\'s wrong?',
    a: 'Currently setlists are imported as-is from Setlist.fm. To fix an incorrect setlist, update it on Setlist.fm directly. Then use Find Setlists to re-fetch it.',
  },
  {
    q: 'Is my data private?',
    a: 'Your shows are private by default. Only you can see your full history. If you share your profile link, visitors can see your shows — but nothing you haven\'t chosen to share.',
  },
  {
    q: 'What file formats does import support?',
    a: 'CSV and Excel (.xlsx) files are supported. Download the template from the Scan / Import page for the correct column format.',
  },
  {
    q: 'Can people without an account view shows they\'re tagged in?',
    a: 'Yes — tagged guests receive an email with a link to view the show without creating an account.',
  },
];

function Section({ section }) {
  const Icon = section.icon;
  return (
    <div className="bg-sidebar border border-[rgba(255,255,255,0.08)] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[rgba(75,200,106,0.15)]">
          <Icon className="w-5 h-5 text-[var(--green-primary)]" />
        </div>
        <div>
          <h2 className="text-on-dark font-semibold text-base">{section.title}</h2>
          <p className="text-on-dark-muted text-xs mt-0.5">{section.description}</p>
        </div>
      </div>
      <div className="space-y-4">
        {section.steps.map((step) => (
          <div key={step.heading}>
            <h3 className="text-[var(--green-primary)] text-sm font-semibold mb-1">{step.heading}</h3>
            <p className="text-on-dark-muted text-sm leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FaqItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgba(255,255,255,0.08)] last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-on-dark text-sm font-medium">{faq.q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-on-dark-muted flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-on-dark-muted flex-shrink-0" />
        }
      </button>
      {open && (
        <p className="text-on-dark-muted text-sm leading-relaxed pb-4">{faq.a}</p>
      )}
    </div>
  );
}

export default function HowToUsePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6 text-[var(--green-primary)]" />
          <h1 className="text-on-dark text-2xl font-bold">How to Use MySetlists</h1>
        </div>
        <p className="text-on-dark-muted text-sm">
          Everything you need to track your concert history, rate setlists, and share shows with friends.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        {sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </div>

      <div className="bg-sidebar border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 mb-8">
        <h2 className="text-on-dark font-semibold text-base mb-4">Frequently Asked Questions</h2>
        <div>
          {faqs.map((faq) => (
            <FaqItem key={faq.q} faq={faq} />
          ))}
        </div>
      </div>

      <div className="bg-[rgba(75,200,106,0.08)] border border-[rgba(75,200,106,0.2)] rounded-2xl p-6 text-center">
        <p className="text-on-dark text-sm font-medium mb-1">Still have questions?</p>
        <p className="text-on-dark-muted text-sm">
          Use the{' '}
          <a href="/feedback" className="text-[var(--green-primary)] hover:underline font-medium">
            Feedback
          </a>{' '}
          link in the sidebar to send us a message.
        </p>
      </div>
    </div>
  );
}
