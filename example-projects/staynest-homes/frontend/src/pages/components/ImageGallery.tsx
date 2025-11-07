import React, { useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { ArrowBack, ArrowForward, Close } from '@mui/icons-material';

// Page-specific component with yet another styling approach
interface ImageGalleryProps {
  images: string[];
  title: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, title }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Completely different styling approach - more hardcoded CSS
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 9999,
    display: isOpen ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  };

  const imageStyle: React.CSSProperties = {
    maxWidth: '90%',
    maxHeight: '80vh',
    objectFit: 'contain',
  };

  const thumbnailContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
    overflowX: 'auto',
    maxWidth: '90%',
  };

  const thumbnailStyle: React.CSSProperties = {
    width: '80px',
    height: '80px',
    objectFit: 'cover',
    cursor: 'pointer',
    borderRadius: '4px',
    opacity: 0.6,
    transition: 'opacity 0.2s',
  };

  const activeThumbnailStyle: React.CSSProperties = {
    ...thumbnailStyle,
    opacity: 1,
    border: '3px solid #FF5A5F',
  };

  return (
    <div>
      <div style={overlayStyle}>
        <Box
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
          }}
        >
          <IconButton onClick={() => setIsOpen(false)} style={{ color: 'white' }}>
            <Close fontSize="large" />
          </IconButton>
        </Box>

        <Box
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <IconButton onClick={prev} style={{ color: 'white' }}>
            <ArrowBack fontSize="large" />
          </IconButton>

          <img src={images[currentIndex]} alt={`${title} ${currentIndex + 1}`} style={imageStyle} />

          <IconButton onClick={next} style={{ color: 'white' }}>
            <ArrowForward fontSize="large" />
          </IconButton>
        </Box>

        <div style={thumbnailContainerStyle}>
          {images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`Thumbnail ${idx + 1}`}
              style={idx === currentIndex ? activeThumbnailStyle : thumbnailStyle}
              onClick={() => setCurrentIndex(idx)}
              onMouseEnter={(e) => {
                if (idx !== currentIndex) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onMouseLeave={(e) => {
                if (idx !== currentIndex) {
                  e.currentTarget.style.opacity = '0.6';
                }
              }}
            />
          ))}
        </div>
      </Box>

      {/* Trigger button - inline button without using custom Button component */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          padding: '12px 24px',
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        View all {images.length} photos
      </button>
    </div>
  );
};

