'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Music } from 'lucide-react';
import SharedCollectionView from '@/components/SharedCollectionView';

export default function SharedCollectionPage() {
  const params = useParams();
  const collectionId = params.collectionId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!collectionId) return;
    setLoading(true);
    fetch(`/.netlify/functions/get-shared-collection?id=${encodeURIComponent(collectionId)}`)
      .then(r => {
        if (!r.ok) {
          if (r.status === 404) throw new Error('Collection not found');
          if (r.status === 410) throw new Error('This shared collection has expired');
          throw new Error('Failed to load collection');
        }
        return r.json();
      })
      .then(data => { setData(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [collectionId]);

  // Update document title client-side
  useEffect(() => {
    if (data?.ownerName) {
      document.title = `${data.ownerName}'s Concert Collection — MySetlists`;
    }
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-white/40 font-medium">Loading collection...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-white/30" />
          </div>
          <p className="text-white/40 mb-4">{error}</p>
          <a href="/" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-medium transition-colors">
            Go to MySetlists
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {data && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: `${data.ownerName}'s Concert Collection`,
              description: `${data.stats?.totalShows || data.shows?.length || 0} shows tracked on MySetlists.`,
              url: `https://mysetlists.net/shared/${collectionId}`,
              numberOfItems: data.shows?.length || 0,
              itemListElement: (data.shows || []).slice(0, 20).map((show, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'MusicEvent',
                  name: `${show.artist} at ${show.venue}`,
                  startDate: show.date || undefined,
                  location: {
                    '@type': 'MusicVenue',
                    name: show.venue,
                    address: show.city || undefined,
                  },
                  performer: {
                    '@type': 'MusicGroup',
                    name: show.artist,
                  },
                },
              })),
            }),
          }}
        />
      )}
      <SharedCollectionView data={data} />
    </>
  );
}
