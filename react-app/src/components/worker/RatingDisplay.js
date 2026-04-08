import React from 'react';

export default function RatingDisplay({ rating = 0, maxStars = 5, size = 'md', showNumber = true }) {
  const filled = Math.round(rating);
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <div className="star-rating">
        {Array.from({ length: maxStars }).map((_, i) => (
          <span key={i} className={`star ${i < filled ? 'filled' : 'empty'}`} style={{ fontSize }}>
            ★
          </span>
        ))}
      </div>
      {showNumber && (
        <span style={{ fontSize: fontSize - 2, color: '#6B7280', fontWeight: 600 }}>
          {rating > 0 ? `${rating.toFixed(1)}/5` : 'No ratings'}
        </span>
      )}
    </div>
  );
}
