import VenueDetailClient from './VenueDetailClient';

// Returns a placeholder so the static-export constraint is satisfied.
// Real venue keys are resolved from Firestore/shows at runtime; the
// Netlify catch-all redirect (/* → /index.html) serves the SPA shell for
// any unmatched path.
export function generateStaticParams() {
  return [{ venueKey: '_' }];
}

export default function Page({ params }) {
  return <VenueDetailClient venueKey={decodeURIComponent(params.venueKey)} />;
}
