import { createTheme } from '@mui/material/styles';

// Intentionally basic theme - some components will ignore this
export const theme = createTheme({
  palette: {
    primary: {
      main: '#FF5A5F',
      light: '#FF7E82',
      dark: '#E00007',
    },
    secondary: {
      main: '#00A699',
      light: '#26B5A8',
      dark: '#008489',
    },
    background: {
      default: '#FFFFFF',
      paper: '#F7F7F7',
    },
    text: {
      primary: '#484848',
      secondary: '#767676',
    },
  },
  typography: {
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 8,
  },
});

