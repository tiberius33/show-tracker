// lib/anniversaries.js
//
// Pure helpers for the client-side "upcoming anniversaries" list (see
// components/notifications/AnniversaryCalendar.jsx). The actual daily
// reminder notifications are sent server-side by the scheduled function at
// netlify/functions/anniversary-notifications.js, which duplicates the
// month-day/years-ago math below in CommonJS — this file's job is only the
// client-facing "what's coming up" view.

function monthDay(dateStr) {
  return (dateStr || '').slice(5, 10); // "MM-DD"
}

// Next calendar occurrence of a show's month-day, on/after `today` (an ISO
// "YYYY-MM-DD" string) — this year if it hasn't passed yet, else next year.
export function nextOccurrence(dateStr, today = new Date().toISOString().slice(0, 10)) {
  if (!dateStr) return null;
  const md = monthDay(dateStr);
  const todayYear = Number(today.slice(0, 4));
  const thisYear = `${todayYear}-${md}`;
  const nextYear = `${todayYear + 1}-${md}`;
  return thisYear >= today ? thisYear : nextYear;
}

// Builds one upcoming-anniversary entry per show that has already had at
// least one anniversary (i.e. isn't from this coming occurrence's year),
// sorted soonest-first.
export function buildUpcomingAnniversaries(shows = [], today = new Date().toISOString().slice(0, 10)) {
  const todayYear = Number(today.slice(0, 4));

  return shows
    .filter(s => s?.date)
    .map(show => {
      const occurrence = nextOccurrence(show.date, today);
      const occurrenceYear = Number(occurrence.slice(0, 4));
      const showYear = Number(show.date.slice(0, 4));
      const yearsAgo = occurrenceYear - showYear;
      return { show, occurrence, yearsAgo };
    })
    .filter(entry => entry.yearsAgo > 0)
    .sort((a, b) => a.occurrence.localeCompare(b.occurrence));
}
