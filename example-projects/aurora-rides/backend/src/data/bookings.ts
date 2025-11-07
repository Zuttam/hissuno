export type BookingStatus = "pending" | "confirmed" | "cancelled";

export type Booking = {
  id: string;
  customerId: string;
  customerName: string;
  rideId: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  requestedAt: string;
  status: BookingStatus;
};

export const bookings: Booking[] = [
  {
    id: "booking_001",
    customerId: "cust_006",
    customerName: "Alice Thompson",
    rideId: null,
    pickupLocation: "Airport Terminal 1",
    dropoffLocation: "Downtown Hotel Plaza",
    requestedAt: "2024-11-06T10:00:00Z",
    status: "pending"
  },
  {
    id: "booking_002",
    customerId: "cust_007",
    customerName: "Bob Anderson",
    rideId: "ride_1699123456790",
    pickupLocation: "Central Station",
    dropoffLocation: "Business District Tower",
    requestedAt: "2024-11-06T09:15:00Z",
    status: "confirmed"
  },
  {
    id: "booking_003",
    customerId: "cust_008",
    customerName: "Carol Davis",
    rideId: null,
    pickupLocation: "Shopping Mall Entrance",
    dropoffLocation: "Residential Complex A",
    requestedAt: "2024-11-06T11:30:00Z",
    status: "pending"
  }
];
