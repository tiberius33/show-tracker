import ShowDetailClient from './ShowDetailClient';

// Returns a placeholder so the static-export constraint is satisfied.
// The real show IDs come from Firebase at runtime; the Netlify catch-all
// redirect (/* → /index.html) serves the SPA shell for any unmatched path.
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page({ params }) {
  return <ShowDetailClient id={params.id} />;
}
