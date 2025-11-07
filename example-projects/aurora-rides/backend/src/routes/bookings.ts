import { Router } from "express";
import { bookings } from "../data/bookings";

export const bookingsRouter = Router();

// Get all bookings
bookingsRouter.get("/", (_req, res) => {
  res.json({ bookings });
});

// Get booking by ID
bookingsRouter.get("/:id", (req, res) => {
  const booking = bookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  res.json({ booking });
});

// Create new booking
bookingsRouter.post("/", (req, res) => {
  const { customerId, customerName, pickupLocation, dropoffLocation } = req.body;
  
  const newBooking = {
    id: `booking_${Date.now()}`,
    customerId,
    customerName,
    rideId: null,
    pickupLocation,
    dropoffLocation,
    requestedAt: new Date().toISOString(),
    status: "pending" as const
  };
  
  bookings.push(newBooking);
  res.status(201).json({ booking: newBooking });
});

// Update booking status
bookingsRouter.patch("/:id", (req, res) => {
  const { status, rideId } = req.body;
  const bookingIndex = bookings.findIndex((b) => b.id === req.params.id);
  
  if (bookingIndex === -1) {
    return res.status(404).json({ error: "Booking not found" });
  }
  
  bookings[bookingIndex] = {
    ...bookings[bookingIndex],
    ...(status ? { status } : {}),
    ...(rideId ? { rideId } : {})
  };
  
  res.json({ booking: bookings[bookingIndex] });
});
