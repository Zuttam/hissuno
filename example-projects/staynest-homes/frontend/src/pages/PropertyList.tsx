import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Grid, TextField, MenuItem } from '@mui/material';
import { PropertyCard } from '../components/PropertyCard';
import { SearchBar } from '../components/SearchBar';
import { Property } from '../types';
import { propertyAPI } from '../api/client';
import { useSearchParams } from 'react-router-dom';

export const PropertyList: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [searchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState('recommended');

  useEffect(() => {
    const location = searchParams.get('location') || '';
    const types = searchParams.get('types') || '';

    if (location || types) {
      const params: any = {};
      if (location) params.location = location;
      if (types) params.propertyType = types.split(',')[0];

      propertyAPI.search(params).then((response) => {
        setProperties(response.data);
        setFilteredProperties(response.data);
      });
    } else {
      propertyAPI.getAll().then((response) => {
        setProperties(response.data);
        setFilteredProperties(response.data);
      });
    }
  }, [searchParams]);

  const handleSearch = (query: string, filters: string[]) => {
    let filtered = [...properties];

    if (query) {
      filtered = filtered.filter(
        (p) =>
          p.location.city.toLowerCase().includes(query.toLowerCase()) ||
          p.location.country.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (filters.length > 0) {
      filtered = filtered.filter((p) => filters.includes(p.type));
    }

    setFilteredProperties(filtered);
  };

  const handleSort = (value: string) => {
    setSortBy(value);
    let sorted = [...filteredProperties];

    switch (value) {
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      default:
        // recommended - shuffle a bit
        break;
    }

    setFilteredProperties(sorted);
  };

  return (
    <div>
      <Box sx={{ backgroundColor: '#f9f9f9', py: 6, mb: 4 }}>
        <SearchBar onSearch={handleSearch} />
      </Box>

      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 4,
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {filteredProperties.length} stays available
          </Typography>

          <TextField
            select
            label="Sort by"
            value={sortBy}
            onChange={(e) => handleSort(e.target.value)}
            sx={{ minWidth: 200 }}
            size="small"
          >
            <MenuItem value="recommended">Recommended</MenuItem>
            <MenuItem value="price-low">Price: Low to High</MenuItem>
            <MenuItem value="price-high">Price: High to Low</MenuItem>
            <MenuItem value="rating">Top Rated</MenuItem>
          </TextField>
        </Box>

        {filteredProperties.length === 0 ? (
          <Box
            style={{
              textAlign: 'center',
              padding: '80px 20px',
              backgroundColor: '#f7f7f7',
              borderRadius: '12px',
            }}
          >
            <Typography variant="h5" style={{ marginBottom: '16px' }}>
              No properties found
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Try adjusting your filters or search criteria
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3} sx={{ mb: 6 }}>
            {filteredProperties.map((property) => (
              <Grid item xs={12} sm={6} md={4} key={property.id}>
                <PropertyCard property={property} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </div>
  );
};

