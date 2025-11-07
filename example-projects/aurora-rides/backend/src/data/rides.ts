export type RideStatus = "pending" | "accepted" | "in_progress" | "completed" | "cancelled";

export type Ride = {
  id: string;
  customerId: string;
  driverId: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  status: RideStatus;
  fare: number;
  distance: number;
  createdAt: string;
  completedAt?: string;
};

export const rides: Ride[] = [
  {
    id: "ride_1699123456789",
    customerId: "cust_001",
    driverId: "drv_001",
    pickupLocation: "123 Main St, Downtown",
    dropoffLocation: "456 Oak Ave, Uptown",
    status: "completed",
    fare: 25.50,
    distance: 8.2,
    createdAt: "2024-11-01T10:30:00Z",
    completedAt: "2024-11-01T10:55:00Z"
  },
  {
    id: "ride_1699123456790",
    customerId: "cust_002",
    driverId: "drv_002",
    pickupLocation: "789 Pine Rd, Westside",
    dropoffLocation: "321 Elm St, Eastside",
    status: "in_progress",
    fare: 18.75,
    distance: 5.6,
    createdAt: "2024-11-05T14:15:00Z"
  },
  {
    id: "ride_1699123456791",
    customerId: "cust_003",
    driverId: null,
    pickupLocation: "555 Maple Dr, Northtown",
    dropoffLocation: "888 Cedar Ln, Southtown",
    status: "pending",
    fare: 32.00,
    distance: 12.4,
    createdAt: "2024-11-06T08:00:00Z"
  },
  {
    id: "ride_1699123456792",
    customerId: "cust_004",
    driverId: "drv_003",
    pickupLocation: "100 River Rd, Harbor",
    dropoffLocation: "200 Beach Blvd, Oceanside",
    status: "accepted",
    fare: 45.25,
    distance: 18.9,
    createdAt: "2024-11-06T09:30:00Z"
  },
  {
    id: "ride_1699123456793",
    customerId: "cust_005",
    driverId: "drv_001",
    pickupLocation: "777 Hill St, Midtown",
    dropoffLocation: "999 Valley Rd, Lowlands",
    status: "completed",
    fare: 15.00,
    distance: 4.2,
    createdAt: "2024-11-04T16:45:00Z",
    completedAt: "2024-11-04T17:05:00Z"
  }
];
