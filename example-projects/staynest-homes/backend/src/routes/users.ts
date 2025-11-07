import { Router, Request, Response } from 'express';
import { users } from '../data/users';

const router = Router();

// Get all users
router.get('/', (req: Request, res: Response) => {
  res.json(users);
});

// Get user by ID
router.get('/:id', (req: Request, res: Response) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// Create new user
router.post('/', (req: Request, res: Response) => {
  const newUser = {
    id: `u${users.length + 1}`,
    ...req.body,
    joinedDate: new Date().toISOString().split('T')[0]
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

export default router;

