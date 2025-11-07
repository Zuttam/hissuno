import React, { useState } from 'react';
import { Box, Typography, TextField } from '@mui/material';
import { Button as CustomButton } from './Button';
import { format } from 'date-fns';

interface BookingWidgetProps {
  price: number;
  currency: string;
  propertyId: string;
  maxGuests: number;
}

// Mix of MUI and custom styling
export const BookingWidget: React.FC<BookingWidgetProps> = ({
  price,
  currency,
  propertyId,
  maxGuests,
}) => {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);

  const handleBook = () => {
    alert(`Booking request sent for property ${propertyId}!`);
  };

  const calculateTotal = () => {
    if (!checkIn || !checkOut) return 0;
    const days = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days > 0 ? days * price : 0;
  };

  return (
    <Box
      sx={{
        border: '1px solid #ddd',
        borderRadius: 3,
        p: 3,
        position: 'sticky',
        top: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        backgroundColor: 'white',
      }}
    >
      <Box style={{ marginBottom: '24px' }}>
        <Typography
          variant="h4"
          style={{ fontWeight: 700, color: '#484848', display: 'inline' }}
        >
          ${price}
        </Typography>
        <Typography
          variant="body1"
          style={{ display: 'inline', color: '#767676', marginLeft: '8px' }}
        >
          / night
        </Typography>
      </Box>

      <Box style={{ marginBottom: '16px' }}>
        <TextField
          label="Check-in"
          type="date"
          fullWidth
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Check-out"
          type="date"
          fullWidth
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Guests"
          type="number"
          fullWidth
          value={guests}
          onChange={(e) => setGuests(Math.min(parseInt(e.target.value) || 1, maxGuests))}
          inputProps={{ min: 1, max: maxGuests }}
        />
      </Box>

      <CustomButton variant="primary" size="large" fullWidth onClick={handleBook}>
        Reserve
      </CustomButton>

      {calculateTotal() > 0 && (
        <Box style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <Box
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <Typography variant="body2">
              ${price} x {Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))} nights
            </Typography>
            <Typography variant="body2">${calculateTotal()}</Typography>
          </Box>
          <Box
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <Typography variant="body2">Service fee</Typography>
            <Typography variant="body2">${Math.round(calculateTotal() * 0.1)}</Typography>
          </Box>
          <Box
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid #eee',
            }}
          >
            <Typography variant="h6" style={{ fontWeight: 600 }}>
              Total
            </Typography>
            <Typography variant="h6" style={{ fontWeight: 600 }}>
              ${calculateTotal() + Math.round(calculateTotal() * 0.1)}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

