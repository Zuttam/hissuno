import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// ========== Types ==========

export type Ride = {
  id: string;
  customerId: string;
  driverId: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  fare: number;
  distance: number;
  createdAt: string;
  completedAt?: string;
};

export type Driver = {
  id: string;
  name: string;
  vehicleType: string;
  rating: number;
  completedRides: number;
  status: "available" | "busy" | "offline";
  currentLocation: string;
};

export type Booking = {
  id: string;
  customerId: string;
  customerName: string;
  rideId: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  requestedAt: string;
  status: "pending" | "confirmed" | "cancelled";
};

export type Analytics = {
  totalRides: number;
  activeRides: number;
  totalRevenue: number;
  averageRating: number;
  topDrivers: Array<{ id: string; name: string; rides: number }>;
};

// ========== Rides ==========

export const useRides = () => {
  return useQuery({
    queryKey: ["rides"],
    queryFn: async () => {
      const response = await apiClient.get<{ rides: Ride[] }>("/rides");
      return response.data.rides;
    }
  });
};

export const useRide = (id: string) => {
  return useQuery({
    queryKey: ["rides", id],
    queryFn: async () => {
      const response = await apiClient.get<{ ride: Ride }>(`/rides/${id}`);
      return response.data.ride;
    },
    enabled: !!id
  });
};

export const useCreateRide = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Ride, "id" | "createdAt" | "status" | "driverId">) => {
      const response = await apiClient.post<{ ride: Ride }>("/rides", data);
      return response.data.ride;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rides"] });
    }
  });
};

export const useUpdateRideStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Ride["status"] }) => {
      const response = await apiClient.patch<{ ride: Ride }>(`/rides/${id}`, { status });
      return response.data.ride;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rides"] });
    }
  });
};

// ========== Drivers ==========

export const useDrivers = () => {
  return useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const response = await apiClient.get<{ drivers: Driver[] }>("/drivers");
      return response.data.drivers;
    }
  });
};

export const useDriver = (id: string) => {
  return useQuery({
    queryKey: ["drivers", id],
    queryFn: async () => {
      const response = await apiClient.get<{ driver: Driver }>(`/drivers/${id}`);
      return response.data.driver;
    },
    enabled: !!id
  });
};

export const useUpdateDriverStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Driver["status"] }) => {
      const response = await apiClient.patch<{ driver: Driver }>(`/drivers/${id}`, { status });
      return response.data.driver;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    }
  });
};

// ========== Bookings ==========

export const useBookings = () => {
  return useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const response = await apiClient.get<{ bookings: Booking[] }>("/bookings");
      return response.data.bookings;
    }
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Booking, "id" | "requestedAt" | "status" | "rideId">) => {
      const response = await apiClient.post<{ booking: Booking }>("/bookings", data);
      return response.data.booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    }
  });
};

// ========== Analytics ==========

export const useAnalytics = () => {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const response = await apiClient.get<{ analytics: Analytics }>("/analytics");
      return response.data.analytics;
    }
  });
};
