export interface Property {
  id: string;
  title: string;
  description: string;
  type: 'apartment' | 'house' | 'villa' | 'cabin' | 'condo';
  location: {
    city: string;
    country: string;
    address: string;
    lat: number;
    lng: number;
  };
  price: number;
  currency: string;
  images: string[];
  amenities: string[];
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  hostId: string;
  rating: number;
  reviewCount: number;
  available: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  isHost: boolean;
  joinedDate: string;
}

export interface Booking {
  id: string;
  propertyId: string;
  userId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface Review {
  id: string;
  propertyId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

