import React from 'react';
import { Box, Typography, Container } from '@mui/material';

// Using MUI Box but with inline styles mixed with sx prop
export const Footer: React.FC = () => {
  return (
    <Box
      sx={{
        backgroundColor: '#f7f7f7',
        mt: 8,
        py: 6,
        borderTop: '1px solid #e0e0e0',
      }}
    >
      <Container maxWidth="lg">
        <Box
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '40px',
          }}
        >
          <Box>
            <Typography variant="h6" style={{ marginBottom: '16px', fontWeight: 600 }}>
              StayNest
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your home away from home
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="h6" style={{ marginBottom: '16px', fontWeight: 600 }}>
              Company
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              About Us
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              Careers
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              Press
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="h6" style={{ marginBottom: '16px', fontWeight: 600 }}>
              Support
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              Help Center
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              Safety
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              Contact Us
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="h6" style={{ marginBottom: '16px', fontWeight: 600 }}>
              Hosting
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              List Your Property
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              Host Resources
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '8px' }}>
              Community Forum
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid #e0e0e0' }}>
          <Typography variant="body2" color="text.secondary" align="center">
            © 2024 StayNest, Inc. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

