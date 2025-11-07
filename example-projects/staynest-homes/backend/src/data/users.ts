import { User } from '../types';

export const users: User[] = [
  {
    id: 'u1',
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    avatar: 'https://i.pravatar.cc/150?img=1',
    bio: 'Travel enthusiast and property owner. Love sharing my beautiful homes with guests!',
    isHost: true,
    joinedDate: '2020-03-15'
  },
  {
    id: 'u2',
    name: 'Michael Chen',
    email: 'michael.c@example.com',
    avatar: 'https://i.pravatar.cc/150?img=13',
    bio: 'Software engineer who loves exploring new cities and meeting people.',
    isHost: false,
    joinedDate: '2021-07-22'
  },
  {
    id: 'u3',
    name: 'Emily Rodriguez',
    email: 'emily.r@example.com',
    avatar: 'https://i.pravatar.cc/150?img=5',
    bio: 'Host of 5 properties across Europe. I ensure every guest has an amazing stay!',
    isHost: true,
    joinedDate: '2019-11-08'
  },
  {
    id: 'u4',
    name: 'David Kim',
    email: 'david.k@example.com',
    avatar: 'https://i.pravatar.cc/150?img=12',
    bio: 'Architect and vacation rental host. My properties showcase unique design.',
    isHost: true,
    joinedDate: '2020-06-30'
  },
  {
    id: 'u5',
    name: 'Jessica Martinez',
    email: 'jessica.m@example.com',
    avatar: 'https://i.pravatar.cc/150?img=9',
    bio: 'Frequent traveler always looking for unique stays around the world.',
    isHost: false,
    joinedDate: '2022-01-14'
  }
];

