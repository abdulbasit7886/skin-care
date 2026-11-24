import React from 'react';
import { Star } from 'lucide-react';

export default function Stars({ rating = 5 }) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`Rated ${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className="h-4 w-4"
          aria-hidden="true"
          fill={i < value ? '#7a2944' : 'none'}
          stroke={i < value ? '#7a2944' : '#c9b9b2'}
        />
      ))}
    </span>
  );
}
