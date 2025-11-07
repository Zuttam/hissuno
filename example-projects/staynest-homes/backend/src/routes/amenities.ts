import { Router, Request, Response } from 'express';
import { amenitiesList } from '../data/properties';

const router = Router();

// Get all available amenities
router.get('/', (req: Request, res: Response) => {
  res.json(amenitiesList);
});

export default router;

