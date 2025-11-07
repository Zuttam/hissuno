import React, { useState } from 'react';
import { Box, Container } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  onSearch: (query: string, filters: string[]) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const propertyTypes = ['apartment', 'house', 'villa', 'cabin', 'condo'];

  const handleSearch = () => {
    onSearch(searchQuery, selectedFilters);
  };

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  return (
    <Container maxWidth="lg">
      <Box className={styles.searchContainer}>
        <SearchIcon style={{ marginLeft: '16px', color: '#999', fontSize: 24 }} />
        <input
          type="text"
          placeholder="Where do you want to go?"
          className={styles.searchField}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <div className={styles.divider} />
        <input
          type="text"
          placeholder="Check in"
          className={styles.searchField}
          style={{ flex: 0.7 }}
        />
        <div className={styles.divider} />
        <input
          type="text"
          placeholder="Guests"
          className={styles.searchField}
          style={{ flex: 0.5 }}
        />
        <button className={styles.searchButton} onClick={handleSearch}>
          Search
        </button>
      </Box>

      <Box className={styles.filtersContainer}>
        {propertyTypes.map((type) => (
          <div
            key={type}
            className={`${styles.filterChip} ${
              selectedFilters.includes(type) ? styles.filterChipActive : ''
            }`}
            onClick={() => toggleFilter(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </div>
        ))}
      </Box>
    </Container>
  );
};

