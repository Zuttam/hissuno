import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Property API
export const propertyAPI = {
  getAll: () => apiClient.get('/properties'),
  getById: (id: string) => apiClient.get(`/properties/${id}`),
  search: (params: any) => apiClient.get('/properties/search', { params }),
  create: (data: any) => apiClient.post('/properties', data),
};

// User API
export const userAPI = {
  getAll: () => apiClient.get('/users'),
  getById: (id: string) => apiClient.get(`/users/${id}`),
  create: (data: any) => apiClient.post('/users', data),
};

// Booking API
export const bookingAPI = {
  getAll: () => apiClient.get('/bookings'),
  getByUserId: (userId: string) => apiClient.get(`/bookings/user/${userId}`),
  getByPropertyId: (propertyId: string) => apiClient.get(`/bookings/property/${propertyId}`),
  create: (data: any) => apiClient.post('/bookings', data),
  updateStatus: (id: string, status: string) => apiClient.patch(`/bookings/${id}`, { status }),
};

// Review API
export const reviewAPI = {
  getAll: () => apiClient.get('/reviews'),
  getByPropertyId: (propertyId: string) => apiClient.get(`/reviews/property/${propertyId}`),
  create: (data: any) => apiClient.post('/reviews', data),
};

// Amenities API
export const amenitiesAPI = {
  getAll: () => apiClient.get('/amenities'),
};

