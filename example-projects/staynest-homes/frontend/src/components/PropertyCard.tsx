import React from 'react';
import { Card, CardMedia, CardContent, Typography, Box, Chip } from '@mui/material';
import { Star } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Property } from '../types';

// Using MUI components with sx prop
interface PropertyCardProps {
  property: Property;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const navigate = useNavigate();

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
        },
        borderRadius: 2,
        overflow: 'hidden',
      }}
      onClick={() => navigate(`/properties/${property.id}`)}
    >
      <CardMedia
        component="img"
        height="240"
        image={property.images[0]}
        alt={property.title}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {property.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Star sx={{ fontSize: 18, color: '#FFD700' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {property.rating}
            </Typography>
          </Box>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {property.location.city}, {property.location.country}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip label={property.type} size="small" sx={{ textTransform: 'capitalize' }} />
          <Chip label={`${property.bedrooms} beds`} size="small" variant="outlined" />
          <Chip label={`${property.maxGuests} guests`} size="small" variant="outlined" />
        </Box>
        
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#FF5A5F' }}>
          ${property.price}
          <Typography component="span" variant="body2" sx={{ fontWeight: 400, color: 'text.secondary' }}>
            {' '} / night
          </Typography>
        </Typography>
      </CardContent>
    </Card>
  );
};

