import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Avatar,
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { User, Booking, Property } from '../types';
import { userAPI, bookingAPI, propertyAPI } from '../api/client';

export const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    if (userId) {
      userAPI.getById(userId).then((response) => {
        setUser(response.data);
      });

      bookingAPI.getByUserId(userId).then((response) => {
        setBookings(response.data);

        // Fetch property details for each booking
        const propertyPromises = response.data.map((booking: Booking) =>
          propertyAPI.getById(booking.propertyId)
        );
        Promise.all(propertyPromises).then((propertyResponses) => {
          setProperties(propertyResponses.map((r) => r.data));
        });
      });
    }
  }, [userId]);

  if (!user) {
    return <div>Loading...</div>;
  }

  // Different card styling approach - hardcoded instead of using theme
  const cardStyle = {
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    transition: 'box-shadow 0.3s ease',
    cursor: 'pointer',
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Profile header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          mb: 6,
          p: 4,
          backgroundColor: '#f9f9f9',
          borderRadius: 3,
        }}
      >
        <Avatar src={user.avatar} sx={{ width: 120, height: 120 }} />
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
            {user.name}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            {user.email}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {user.isHost && (
              <Chip label="Host" color="primary" size="small" />
            )}
            <Chip
              label={`Member since ${new Date(user.joinedDate).getFullYear()}`}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>
      </Box>

      {/* Bio */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          About
        </Typography>
        <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
          {user.bio}
        </Typography>
      </Box>

      {/* Bookings */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
          My Trips
        </Typography>

        {bookings.length === 0 ? (
          <Box
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: '#f7f7f7',
              borderRadius: '12px',
            }}
          >
            <Typography variant="body1" color="text.secondary">
              No bookings yet
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {bookings.map((booking, idx) => {
              const property = properties[idx];
              if (!property) return null;

              return (
                <Grid item xs={12} md={6} key={booking.id}>
                  <Card style={cardStyle}>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 2,
                      }}
                    >
                      <img
                        src={property.images[0]}
                        alt={property.title}
                        style={{
                          width: '180px',
                          height: '180px',
                          objectFit: 'cover',
                          borderRadius: '12px 0 0 12px',
                        }}
                      />
                      <CardContent style={{ flex: 1 }}>
                        <Typography
                          variant="h6"
                          style={{ fontWeight: 600, marginBottom: '8px' }}
                        >
                          {property.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          style={{ marginBottom: '12px' }}
                        >
                          {property.location.city}, {property.location.country}
                        </Typography>
                        <Box style={{ marginBottom: '8px' }}>
                          <Typography variant="body2" style={{ fontWeight: 500 }}>
                            Check-in: {new Date(booking.checkIn).toLocaleDateString()}
                          </Typography>
                          <Typography variant="body2" style={{ fontWeight: 500 }}>
                            Check-out: {new Date(booking.checkOut).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Chip
                            label={booking.status}
                            color={booking.status === 'confirmed' ? 'success' : 'default'}
                            size="small"
                            style={{ textTransform: 'capitalize' }}
                          />
                          <Typography variant="h6" style={{ fontWeight: 700, color: '#FF5A5F' }}>
                            ${booking.totalPrice}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Container>
  );
};

