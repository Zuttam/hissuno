import { Router, Request, Response } from 'express';
import { properties, amenitiesList } from '../data/properties';
import { reviews } from '../data/bookings';
import { SearchFilters } from '../types';

const router = Router();

// Get all properties
router.get('/', (req: Request, res: Response) => {
  res.json(properties);
});

// Search properties with filters
router.get('/search', (req: Request, res: Response) => {
  const filters: SearchFilters = {
    location: req.query.location as string,
    checkIn: req.query.checkIn as string,
    checkOut: req.query.checkOut as string,
    guests: req.query.guests ? parseInt(req.query.guests as string) : undefined,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
    propertyType: req.query.propertyType as string,
    amenities: req.query.amenities ? (req.query.amenities as string).split(',') : undefined
  };

  let filtered = [...properties];

  // Filter by location (city or country)
  if (filters.location) {
    const searchTerm = filters.location.toLowerCase();
    filtered = filtered.filter(p => 
      p.location.city.toLowerCase().includes(searchTerm) ||
      p.location.country.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by guests
  if (filters.guests) {
    filtered = filtered.filter(p => p.maxGuests >= filters.guests!);
  }

  // Filter by price range
  if (filters.minPrice) {
    filtered = filtered.filter(p => p.price >= filters.minPrice!);
  }
  if (filters.maxPrice) {
    filtered = filtered.filter(p => p.price <= filters.maxPrice!);
  }

  // Filter by property type
  if (filters.propertyType) {
    filtered = filtered.filter(p => p.type === filters.propertyType);
  }

  // Filter by amenities
  if (filters.amenities && filters.amenities.length > 0) {
    filtered = filtered.filter(p => 
      filters.amenities!.every(amenity => p.amenities.includes(amenity))
    );
  }

  res.json(filtered);
});

// Get property by ID
router.get('/:id', (req: Request, res: Response) => {
  const property = properties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }
  res.json(property);
});

// Create new property
router.post('/', (req: Request, res: Response) => {
  const newProperty = {
    id: `p${properties.length + 1}`,
    ...req.body,
    rating: 0,
    reviewCount: 0,
    available: true
  };
  properties.push(newProperty);
  res.status(201).json(newProperty);
});

export default router;

