import React from 'react';
import { Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

// Intentionally NOT using theme colors, using hardcoded values
const headerStyles = {
  appBar: {
    backgroundColor: '#FF5A5F',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 20px',
  },
  logo: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '28px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  nav: {
    display: 'flex',
    gap: '25px',
    alignItems: 'center',
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: 500,
    transition: 'opacity 0.2s',
  },
};

export const Header: React.FC = () => {
  return (
    <AppBar position="sticky" style={headerStyles.appBar}>
      <Toolbar style={headerStyles.toolbar}>
        <Link to="/" style={headerStyles.logo}>
          StayNest
        </Link>
        <Box style={headerStyles.nav}>
          <Link to="/properties" style={headerStyles.link}>
            Explore
          </Link>
          <Link to="/profile/u2" style={headerStyles.link}>
            <AccountCircleIcon style={{ fontSize: 32 }} />
          </Link>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

