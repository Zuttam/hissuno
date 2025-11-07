import React from 'react';
import './ReviewCard.css';

// Another page-specific component using plain CSS instead of CSS modules or MUI
interface ReviewCardProps {
  rating: number;
  comment: string;
  userName: string;
  userAvatar: string;
  date: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  rating,
  comment,
  userName,
  userAvatar,
  date,
}) => {
  return (
    <div className="review-card">
      <div className="review-header">
        <img src={userAvatar} alt={userName} className="review-avatar" />
        <div className="review-user-info">
          <h4 className="review-username">{userName}</h4>
          <span className="review-date">{date}</span>
        </div>
      </div>
      <div className="review-rating">
        {'⭐'.repeat(rating)}
      </div>
      <p className="review-comment">{comment}</p>
    </div>
  );
};

