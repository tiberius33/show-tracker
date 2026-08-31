import VenueDashboardClient from './VenueDashboardClient';

export function generateStaticParams() {
  return [{ venueKey: '_' }];
}

export default function Page({ params }) {
  return <VenueDashboardClient venueKey={decodeURIComponent(params.venueKey)} />;
}
