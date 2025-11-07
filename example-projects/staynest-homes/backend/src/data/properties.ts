import { Property } from '../types';

export const properties: Property[] = [
  {
    id: 'p1',
    title: 'Cozy Downtown Loft',
    description: 'Modern loft in the heart of the city with stunning skyline views. Walking distance to restaurants, shops, and entertainment.',
    type: 'apartment',
    location: {
      city: 'New York',
      country: 'USA',
      address: '123 Broadway St',
      lat: 40.7128,
      lng: -74.0060
    },
    price: 180,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2'
    ],
    amenities: ['WiFi', 'Kitchen', 'Air conditioning', 'Washer', 'Elevator'],
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    hostId: 'u1',
    rating: 4.8,
    reviewCount: 47,
    available: true
  },
  {
    id: 'p2',
    title: 'Beachfront Villa Paradise',
    description: 'Luxurious villa right on the beach with private pool and breathtaking ocean views. Perfect for families or groups.',
    type: 'villa',
    location: {
      city: 'Malibu',
      country: 'USA',
      address: '456 Pacific Coast Hwy',
      lat: 34.0259,
      lng: -118.7798
    },
    price: 550,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811',
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945'
    ],
    amenities: ['WiFi', 'Pool', 'Beach access', 'Kitchen', 'Air conditioning', 'Parking', 'Hot tub'],
    maxGuests: 8,
    bedrooms: 4,
    bathrooms: 3,
    hostId: 'u1',
    rating: 4.9,
    reviewCount: 89,
    available: true
  },
  {
    id: 'p3',
    title: 'Rustic Mountain Cabin',
    description: 'Charming cabin nestled in the mountains. Perfect getaway for nature lovers with hiking trails nearby.',
    type: 'cabin',
    location: {
      city: 'Aspen',
      country: 'USA',
      address: '789 Mountain View Rd',
      lat: 39.1911,
      lng: -106.8175
    },
    price: 220,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8',
      'https://images.unsplash.com/photo-1587061949409-02df41d5e562',
      'https://images.unsplash.com/photo-1510798831971-661eb04b3739'
    ],
    amenities: ['WiFi', 'Fireplace', 'Kitchen', 'Parking', 'Mountain view'],
    maxGuests: 6,
    bedrooms: 3,
    bathrooms: 2,
    hostId: 'u3',
    rating: 4.7,
    reviewCount: 34,
    available: true
  },
  {
    id: 'p4',
    title: 'Chic Parisian Studio',
    description: 'Elegant studio apartment in the heart of Paris, near the Eiffel Tower. Recently renovated with modern amenities.',
    type: 'apartment',
    location: {
      city: 'Paris',
      country: 'France',
      address: '12 Rue de la Paix',
      lat: 48.8566,
      lng: 2.3522
    },
    price: 140,
    currency: 'EUR',
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'
    ],
    amenities: ['WiFi', 'Kitchen', 'Elevator', 'City view'],
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    hostId: 'u3',
    rating: 4.6,
    reviewCount: 28,
    available: true
  },
  {
    id: 'p5',
    title: 'Modern Tokyo Apartment',
    description: 'Sleek apartment in Shibuya with easy access to public transport. Experience Tokyo like a local!',
    type: 'apartment',
    location: {
      city: 'Tokyo',
      country: 'Japan',
      address: '34 Shibuya Crossing',
      lat: 35.6762,
      lng: 139.6503
    },
    price: 95,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688'
    ],
    amenities: ['WiFi', 'Air conditioning', 'Kitchen', 'Washer'],
    maxGuests: 3,
    bedrooms: 1,
    bathrooms: 1,
    hostId: 'u4',
    rating: 4.8,
    reviewCount: 56,
    available: true
  },
  {
    id: 'p6',
    title: 'Tuscan Countryside Villa',
    description: 'Beautiful villa surrounded by vineyards and olive groves. Authentic Italian experience with modern comforts.',
    type: 'villa',
    location: {
      city: 'Florence',
      country: 'Italy',
      address: '56 Via Toscana',
      lat: 43.7696,
      lng: 11.2558
    },
    price: 380,
    currency: 'EUR',
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811',
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf'
    ],
    amenities: ['WiFi', 'Pool', 'Kitchen', 'Parking', 'Garden', 'Fireplace'],
    maxGuests: 10,
    bedrooms: 5,
    bathrooms: 4,
    hostId: 'u4',
    rating: 5.0,
    reviewCount: 73,
    available: true
  },
  {
    id: 'p7',
    title: 'Downtown Portland Condo',
    description: 'Contemporary condo in trendy Pearl District. Walk to breweries, restaurants, and Powell\'s Books.',
    type: 'condo',
    location: {
      city: 'Portland',
      country: 'USA',
      address: '890 NW 13th Ave',
      lat: 45.5231,
      lng: -122.6765
    },
    price: 130,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'
    ],
    amenities: ['WiFi', 'Kitchen', 'Parking', 'Air conditioning', 'Gym'],
    maxGuests: 3,
    bedrooms: 1,
    bathrooms: 1,
    hostId: 'u3',
    rating: 4.5,
    reviewCount: 41,
    available: true
  },
  {
    id: 'p8',
    title: 'Barcelona Beach House',
    description: 'Stunning house steps from Barceloneta Beach. Enjoy Mediterranean vibes and incredible sunsets.',
    type: 'house',
    location: {
      city: 'Barcelona',
      country: 'Spain',
      address: '23 Passeig Marítim',
      lat: 41.3851,
      lng: 2.1734
    },
    price: 290,
    currency: 'EUR',
    images: [
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811'
    ],
    amenities: ['WiFi', 'Beach access', 'Kitchen', 'Air conditioning', 'Terrace'],
    maxGuests: 6,
    bedrooms: 3,
    bathrooms: 2,
    hostId: 'u1',
    rating: 4.9,
    reviewCount: 67,
    available: true
  },
  {
    id: 'p9',
    title: 'London Victorian Townhouse',
    description: 'Elegant Victorian home in Notting Hill. Classic British charm with modern updates throughout.',
    type: 'house',
    location: {
      city: 'London',
      country: 'UK',
      address: '45 Portobello Rd',
      lat: 51.5074,
      lng: -0.1278
    },
    price: 320,
    currency: 'GBP',
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811'
    ],
    amenities: ['WiFi', 'Kitchen', 'Fireplace', 'Garden', 'Washer'],
    maxGuests: 7,
    bedrooms: 4,
    bathrooms: 2,
    hostId: 'u4',
    rating: 4.7,
    reviewCount: 52,
    available: true
  },
  {
    id: 'p10',
    title: 'Seattle Waterfront Apartment',
    description: 'Modern apartment with stunning Puget Sound views. Close to Pike Place Market and Space Needle.',
    type: 'apartment',
    location: {
      city: 'Seattle',
      country: 'USA',
      address: '1100 Alaskan Way',
      lat: 47.6062,
      lng: -122.3321
    },
    price: 165,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'
    ],
    amenities: ['WiFi', 'Kitchen', 'Parking', 'Water view', 'Gym'],
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 2,
    hostId: 'u3',
    rating: 4.8,
    reviewCount: 39,
    available: true
  },
  {
    id: 'p11',
    title: 'Austin Hill Country Retreat',
    description: 'Peaceful ranch-style home with lake views. Perfect for a Texas getaway with outdoor space.',
    type: 'house',
    location: {
      city: 'Austin',
      country: 'USA',
      address: '567 Ranch Rd',
      lat: 30.2672,
      lng: -97.7431
    },
    price: 210,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811'
    ],
    amenities: ['WiFi', 'Pool', 'Kitchen', 'Parking', 'BBQ', 'Lake view'],
    maxGuests: 8,
    bedrooms: 4,
    bathrooms: 3,
    hostId: 'u1',
    rating: 4.6,
    reviewCount: 44,
    available: true
  },
  {
    id: 'p12',
    title: 'Miami Art Deco Apartment',
    description: 'Stylish apartment in iconic Art Deco district. Steps from South Beach and Ocean Drive nightlife.',
    type: 'apartment',
    location: {
      city: 'Miami',
      country: 'USA',
      address: '789 Ocean Dr',
      lat: 25.7617,
      lng: -80.1918
    },
    price: 195,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'
    ],
    amenities: ['WiFi', 'Air conditioning', 'Beach access', 'Pool', 'Parking'],
    maxGuests: 5,
    bedrooms: 2,
    bathrooms: 2,
    hostId: 'u4',
    rating: 4.7,
    reviewCount: 61,
    available: true
  },
  {
    id: 'p13',
    title: 'Amsterdam Canal House',
    description: 'Historic canal house with authentic Dutch character. Bikes included for exploring the city!',
    type: 'house',
    location: {
      city: 'Amsterdam',
      country: 'Netherlands',
      address: '234 Prinsengracht',
      lat: 52.3676,
      lng: 4.9041
    },
    price: 250,
    currency: 'EUR',
    images: [
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811'
    ],
    amenities: ['WiFi', 'Kitchen', 'Canal view', 'Bikes', 'Washer'],
    maxGuests: 6,
    bedrooms: 3,
    bathrooms: 2,
    hostId: 'u3',
    rating: 4.9,
    reviewCount: 78,
    available: true
  },
  {
    id: 'p14',
    title: 'Sydney Harbor View Condo',
    description: 'Luxe condo with Opera House views. Prime location in Circular Quay for exploring Sydney.',
    type: 'condo',
    location: {
      city: 'Sydney',
      country: 'Australia',
      address: '88 The Rocks',
      lat: -33.8688,
      lng: 151.2093
    },
    price: 280,
    currency: 'AUD',
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'
    ],
    amenities: ['WiFi', 'Kitchen', 'Air conditioning', 'Harbor view', 'Gym', 'Pool'],
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 2,
    hostId: 'u4',
    rating: 5.0,
    reviewCount: 92,
    available: true
  },
  {
    id: 'p15',
    title: 'Swiss Alps Chalet',
    description: 'Cozy alpine chalet with mountain views. Ski-in/ski-out access and hot tub for après-ski relaxation.',
    type: 'cabin',
    location: {
      city: 'Zermatt',
      country: 'Switzerland',
      address: '12 Bergstrasse',
      lat: 46.0207,
      lng: 7.7491
    },
    price: 450,
    currency: 'CHF',
    images: [
      'https://images.unsplash.com/photo-1587061949409-02df41d5e562',
      'https://images.unsplash.com/photo-1510798831971-661eb04b3739',
      'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8'
    ],
    amenities: ['WiFi', 'Fireplace', 'Kitchen', 'Hot tub', 'Ski access', 'Mountain view'],
    maxGuests: 8,
    bedrooms: 4,
    bathrooms: 3,
    hostId: 'u1',
    rating: 4.9,
    reviewCount: 85,
    available: true
  },
  {
    id: 'p16',
    title: 'Nashville Music Row Loft',
    description: 'Industrial loft in Music Row. Walking distance to honky-tonks and live music venues.',
    type: 'apartment',
    location: {
      city: 'Nashville',
      country: 'USA',
      address: '456 Music Row',
      lat: 36.1627,
      lng: -86.7816
    },
    price: 145,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2'
    ],
    amenities: ['WiFi', 'Kitchen', 'Air conditioning', 'Parking', 'City view'],
    maxGuests: 3,
    bedrooms: 1,
    bathrooms: 1,
    hostId: 'u3',
    rating: 4.6,
    reviewCount: 36,
    available: true
  },
  {
    id: 'p17',
    title: 'Costa Rica Jungle Villa',
    description: 'Eco-friendly villa immersed in rainforest. Private waterfall and incredible wildlife viewing.',
    type: 'villa',
    location: {
      city: 'Manuel Antonio',
      country: 'Costa Rica',
      address: 'Rainforest Road 123',
      lat: 9.3905,
      lng: -84.1399
    },
    price: 340,
    currency: 'USD',
    images: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811',
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945'
    ],
    amenities: ['WiFi', 'Pool', 'Kitchen', 'Nature view', 'Outdoor shower'],
    maxGuests: 6,
    bedrooms: 3,
    bathrooms: 2,
    hostId: 'u4',
    rating: 4.8,
    reviewCount: 54,
    available: true
  },
  {
    id: 'p18',
    title: 'Dublin Georgian Apartment',
    description: 'Charming apartment in historic Georgian building. Perfect base for exploring Temple Bar and Trinity College.',
    type: 'apartment',
    location: {
      city: 'Dublin',
      country: 'Ireland',
      address: '78 Merrion Square',
      lat: 53.3498,
      lng: -6.2603
    },
    price: 125,
    currency: 'EUR',
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'
    ],
    amenities: ['WiFi', 'Kitchen', 'Fireplace', 'City view'],
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    hostId: 'u1',
    rating: 4.7,
    reviewCount: 48,
    available: true
  }
];

export const amenitiesList = [
  'WiFi',
  'Kitchen',
  'Air conditioning',
  'Heating',
  'Washer',
  'Dryer',
  'Pool',
  'Hot tub',
  'Parking',
  'Elevator',
  'Gym',
  'Beach access',
  'Ski access',
  'Fireplace',
  'BBQ',
  'Garden',
  'Terrace',
  'Balcony',
  'Mountain view',
  'Ocean view',
  'City view',
  'Lake view',
  'Canal view',
  'Harbor view',
  'Nature view',
  'Water view',
  'Bikes',
  'Outdoor shower'
];

