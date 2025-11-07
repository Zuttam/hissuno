import React from 'react';

// Custom button that duplicates MUI functionality (intentionally redundant)
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
}) => {
  // Hardcoded styles instead of using theme
  const baseStyles: React.CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'Poppins, sans-serif',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: '#FF5A5F',
      color: 'white',
      boxShadow: '0 2px 4px rgba(255, 90, 95, 0.3)',
    },
    secondary: {
      backgroundColor: '#00A699',
      color: 'white',
      boxShadow: '0 2px 4px rgba(0, 166, 153, 0.3)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#FF5A5F',
      border: '2px solid #FF5A5F',
    },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    small: {
      padding: '6px 16px',
      fontSize: '14px',
    },
    medium: {
      padding: '10px 24px',
      fontSize: '16px',
    },
    large: {
      padding: '14px 32px',
      fontSize: '18px',
    },
  };

  const buttonStyle = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  return (
    <button style={buttonStyle} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

