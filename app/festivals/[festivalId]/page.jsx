import FestivalDetailClient from './FestivalDetailClient';

// Returns a placeholder so the static-export constraint is satisfied.
// Real festival ids come from Firestore at runtime; the Netlify catch-all
// redirect (/* → /index.html) serves the SPA shell for any unmatched path.
// Mirrors app/shows/[id]/page.jsx.
export function generateStaticParams() {
  return [{ festivalId: '_' }];
}

export default function Page({ params }) {
  return <FestivalDetailClient festivalId={params.festivalId} />;
}
