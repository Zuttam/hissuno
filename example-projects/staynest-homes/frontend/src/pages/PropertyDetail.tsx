import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Chip,
  Avatar,
  Rating,
  Divider,
} from '@mui/material';
import { LocationOn, Bathtub, Bed, People, Star } from '@mui/icons-material';
import { Property, User, Review } from '../types';
import { propertyAPI, userAPI, reviewAPI } from '../api/client';
import { BookingWidget } from '../components/BookingWidget';

export const PropertyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [host, setHost] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (id) {
      propertyAPI.getById(id).then((response) => {
        setProperty(response.data);
        userAPI.getById(response.data.hostId).then((hostResponse) => {
          setHost(hostResponse.data);
        });
      });

      reviewAPI.getByPropertyId(id).then((response) => {
        setReviews(response.data);
      });
    }
  }, [id]);

  if (!property) {
    return <div>Loading...</div>;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Title */}
      <Typography variant="h3" sx={{ fontWeight: 600, mb: 2 }}>
        {property.title}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Star sx={{ fontSize: 20, color: '#FFD700' }} />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {property.rating}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ({property.reviewCount} reviews)
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          •
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocationOn sx={{ fontSize: 20 }} />
          <Typography variant="body1">
            {property.location.city}, {property.location.country}
          </Typography>
        </Box>
      </Box>

      {/* Image gallery - simplified */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={1}>
          <Grid item xs={12} md={8}>
            <img
              src={property.images[0]}
              alt={property.title}
              style={{
                width: '100%',
                height: '450px',
                objectFit: 'cover',
                borderRadius: '12px',
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Grid container spacing={1}>
              {property.images.slice(1, 3).map((img, idx) => (
                <Grid item xs={12} key={idx}>
                  <img
                    src={img}
                    alt={`${property.title} ${idx + 2}`}
                    style={{
                      width: '100%',
                      height: '220px',
                      objectFit: 'cover',
                      borderRadius: '12px',
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          {/* Host info */}
          {host && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                Hosted by {host.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar src={host.avatar} sx={{ width: 60, height: 60 }} />
                <Box>
                  <Typography variant="body1">{host.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Joined {new Date(host.joinedDate).getFullYear()}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {host.bio}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Property details with icons - mix of inline styles */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" style={{ fontWeight: 600, marginBottom: '20px' }}>
              Property Details
            </Typography>
            <Box style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <People style={{ color: '#FF5A5F' }} />
                <Typography>{property.maxGuests} guests</Typography>
              </Box>
              <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bed style={{ color: '#FF5A5F' }} />
                <Typography>{property.bedrooms} bedrooms</Typography>
              </Box>
              <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bathtub style={{ color: '#FF5A5F' }} />
                <Typography>{property.bathrooms} bathrooms</Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Description */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
              About this place
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
              {property.description}
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Amenities */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
              What this place offers
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {property.amenities.map((amenity) => (
                <Chip key={amenity} label={amenity} sx={{ fontSize: '0.95rem' }} />
              ))}
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Reviews */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Reviews
            </Typography>
            {reviews.map((review) => (
              <Box
                key={review.id}
                sx={{
                  mb: 3,
                  p: 2,
                  backgroundColor: '#f9f9f9',
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Rating value={review.rating} readOnly size="small" />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Typography variant="body1">{review.comment}</Typography>
              </Box>
            ))}
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <BookingWidget
            price={property.price}
            currency={property.currency}
            propertyId={property.id}
            maxGuests={property.maxGuests}
          />
        </Grid>
      </Grid>
    </Container>
  );
};

