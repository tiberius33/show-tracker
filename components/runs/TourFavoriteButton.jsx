// components/runs/TourFavoriteButton.jsx
//
// Star toggle for "favorite tour" — the same star convention the Wishlist
// uses for songs (filled amber when on, outline when off, disabled while
// its Firestore write is in flight). Persistence and optimistic revert
// live in hooks/useFavoriteTours.js.

'use client';

import { Star } from 'lucide-react';

export default function TourFavoriteButton({ tour, isFavorite, pending, onToggle, size = 'md' }) {
  const px = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${tour.tourName} from favorite tours` : `Add ${tour.tourName} to favorite tours`}
      title={isFavorite ? 'Favorite tour' : 'Mark as a favorite tour'}
      onClick={(e) => {
        // These sit inside a <Link> card on the Tours list — the star must
        // toggle in place, not navigate.
        e.preventDefault();
        e.stopPropagation();
        onToggle(tour);
      }}
      className={[
        'p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        pending ? 'opacity-50 cursor-wait' : 'hover:bg-hover',
        isFavorite ? 'text-amber' : 'text-muted hover:text-amber',
      ].join(' ')}
    >
      <Star className={`${px} ${isFavorite ? 'fill-current' : ''}`} />
    </button>
  );
}
