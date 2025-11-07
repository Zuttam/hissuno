import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PropertyCard } from '../components/PropertyCard';
import { SearchBar } from '../components/SearchBar';
import { Button } from '../components/Button';
import { Property } from '../types';
import { propertyAPI } from '../api/client';

// Home page with hero section
export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);

  useEffect(() => {
    propertyAPI.getAll().then((response) => {
      // Get 6 featured properties
      setFeaturedProperties(response.data.slice(0, 6));
    });
  }, []);

  const handleSearch = (query: string, filters: string[]) => {
    navigate(`/properties?location=${query}&types=${filters.join(',')}`);
  };

  return (
    <div>
      {/* Hero section with hardcoded background */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 12,
          mb: 8,
        }}
      >
        <Container maxWidth="lg">
          <Box style={{ textAlign: 'center', marginBottom: '48px' }}>
            <Typography
              variant="h2"
              style={{
                fontWeight: 700,
                marginBottom: '20px',
                fontSize: '3.5rem',
                textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              Find Your Perfect Stay
            </Typography>
            <Typography
              variant="h5"
              style={{
                fontWeight: 300,
                marginBottom: '40px',
                opacity: 0.95,
              }}
            >
              Discover unique homes, apartments, and villas around the world
            </Typography>
          </Box>
          <SearchBar onSearch={handleSearch} />
        </Container>
      </Box>

      {/* Featured properties section */}
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
            Featured Stays
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Handpicked properties for your next adventure
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mb: 6 }}>
          {featuredProperties.map((property) => (
            <Grid item xs={12} sm={6} md={4} key={property.id}>
              <PropertyCard property={property} />
            </Grid>
          ))}
        </Grid>

        <Box style={{ textAlign: 'center', marginTop: '40px', marginBottom: '60px' }}>
          <Button
            variant="outline"
            size="large"
            onClick={() => navigate('/properties')}
          >
            Explore All Properties
          </Button>
        </Box>

        {/* Why StayNest section - more hardcoded styles */}
        <Box
          style={{
            background: '#f7f7f7',
            borderRadius: '16px',
            padding: '60px 40px',
            marginBottom: '60px',
          }}
        >
          <Typography
            variant="h3"
            style={{ textAlign: 'center', marginBottom: '48px', fontWeight: 600 }}
          >
            Why Choose StayNest?
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                  }}
                >
                  🏡
                </div>
                <Typography variant="h5" style={{ marginBottom: '12px', fontWeight: 600 }}>
                  Unique Properties
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  From cozy cabins to luxury villas, find the perfect place for your stay
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                  }}
                >
                  ⭐
                </div>
                <Typography variant="h5" style={{ marginBottom: '12px', fontWeight: 600 }}>
                  Verified Reviews
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Real reviews from real guests to help you make the right choice
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                  }}
                >
                  💬
                </div>
                <Typography variant="h5" style={{ marginBottom: '12px', fontWeight: 600 }}>
                  24/7 Support
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Our support team is always here to help with any questions
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </div>
  );
};

