import { Router, Request, Response } from 'express';
import { reviews } from '../data/bookings';

const router = Router();

// Get all reviews
router.get('/', (req: Request, res: Response) => {
  res.json(reviews);
});

// Get reviews by property ID
router.get('/property/:propertyId', (req: Request, res: Response) => {
  const propertyReviews = reviews.filter(r => r.propertyId === req.params.propertyId);
  res.json(propertyReviews);
});

// Create new review
router.post('/', (req: Request, res: Response) => {
  const newReview = {
    id: `r${reviews.length + 1}`,
    ...req.body,
    createdAt: new Date().toISOString()
  };
  reviews.push(newReview);
  res.status(201).json(newReview);
});

export default router;

