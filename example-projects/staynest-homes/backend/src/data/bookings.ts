import { Booking, Review } from '../types';

export const bookings: Booking[] = [
  {
    id: 'b1',
    propertyId: 'p1',
    userId: 'u2',
    checkIn: '2024-12-15',
    checkOut: '2024-12-20',
    guests: 2,
    totalPrice: 900,
    status: 'confirmed',
    createdAt: '2024-11-01T10:30:00Z'
  },
  {
    id: 'b2',
    propertyId: 'p3',
    userId: 'u5',
    checkIn: '2024-12-10',
    checkOut: '2024-12-17',
    guests: 4,
    totalPrice: 1540,
    status: 'confirmed',
    createdAt: '2024-10-28T14:22:00Z'
  },
  {
    id: 'b3',
    propertyId: 'p6',
    userId: 'u2',
    checkIn: '2025-01-05',
    checkOut: '2025-01-12',
    guests: 8,
    totalPrice: 2660,
    status: 'pending',
    createdAt: '2024-11-03T09:15:00Z'
  }
];

export const reviews: Review[] = [
  {
    id: 'r1',
    propertyId: 'p1',
    userId: 'u2',
    rating: 5,
    comment: 'Amazing location and beautifully decorated! Sarah was a wonderful host.',
    createdAt: '2024-10-15T16:45:00Z'
  },
  {
    id: 'r2',
    propertyId: 'p1',
    userId: 'u5',
    rating: 4,
    comment: 'Great apartment, very clean. Only issue was some street noise at night.',
    createdAt: '2024-09-22T11:20:00Z'
  },
  {
    id: 'r3',
    propertyId: 'p2',
    userId: 'u2',
    rating: 5,
    comment: 'Absolutely stunning villa! The pool and ocean views were incredible. Best vacation ever!',
    createdAt: '2024-08-30T14:10:00Z'
  },
  {
    id: 'r4',
    propertyId: 'p3',
    userId: 'u5',
    rating: 5,
    comment: 'Perfect mountain getaway. Cozy cabin with everything we needed. Hiking was fantastic!',
    createdAt: '2024-10-05T09:30:00Z'
  },
  {
    id: 'r5',
    propertyId: 'p4',
    userId: 'u2',
    rating: 4,
    comment: 'Lovely studio in a great Paris location. Small but perfectly designed.',
    createdAt: '2024-07-18T18:25:00Z'
  },
  {
    id: 'r6',
    propertyId: 'p6',
    userId: 'u5',
    rating: 5,
    comment: 'The Tuscan villa of our dreams! Beautiful property, amazing food recommendations from the host.',
    createdAt: '2024-09-10T12:40:00Z'
  },
  {
    id: 'r7',
    propertyId: 'p8',
    userId: 'u2',
    rating: 5,
    comment: 'Beach house was perfect! Walked to the beach every morning. Barcelona is incredible!',
    createdAt: '2024-08-15T15:55:00Z'
  },
  {
    id: 'r8',
    propertyId: 'p14',
    userId: 'u5',
    rating: 5,
    comment: 'Woke up to Opera House views every day! Location is unbeatable.',
    createdAt: '2024-10-20T08:15:00Z'
  }
];

