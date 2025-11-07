import { Router, Request, Response } from 'express';
import { bookings } from '../data/bookings';

const router = Router();

// Get all bookings
router.get('/', (req: Request, res: Response) => {
  res.json(bookings);
});

// Get bookings by user ID
router.get('/user/:userId', (req: Request, res: Response) => {
  const userBookings = bookings.filter(b => b.userId === req.params.userId);
  res.json(userBookings);
});

// Get bookings by property ID
router.get('/property/:propertyId', (req: Request, res: Response) => {
  const propertyBookings = bookings.filter(b => b.propertyId === req.params.propertyId);
  res.json(propertyBookings);
});

// Create new booking
router.post('/', (req: Request, res: Response) => {
  const newBooking = {
    id: `b${bookings.length + 1}`,
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  bookings.push(newBooking);
  res.status(201).json(newBooking);
});

// Update booking status
router.patch('/:id', (req: Request, res: Response) => {
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  
  if (req.body.status) {
    booking.status = req.body.status;
  }
  
  res.json(booking);
});

export default router;

