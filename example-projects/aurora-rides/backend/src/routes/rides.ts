import { Router } from "express";
import { rides } from "../data/rides";

export const ridesRouter = Router();

// Get all rides
ridesRouter.get("/", (_req, res) => {
  res.json({ rides });
});

// Get ride by ID
ridesRouter.get("/:id", (req, res) => {
  const ride = rides.find((r) => r.id === req.params.id);
  if (!ride) {
    return res.status(404).json({ error: "Ride not found" });
  }
  res.json({ ride });
});

// Create new ride
ridesRouter.post("/", (req, res) => {
  const { customerId, pickupLocation, dropoffLocation, fare, distance } = req.body;
  
  const newRide = {
    id: `ride_${Date.now()}`,
    customerId,
    driverId: null,
    pickupLocation,
    dropoffLocation,
    status: "pending" as const,
    fare,
    distance,
    createdAt: new Date().toISOString()
  };
  
  rides.push(newRide);
  res.status(201).json({ ride: newRide });
});

// Update ride status
ridesRouter.patch("/:id", (req, res) => {
  const { status } = req.body;
  const rideIndex = rides.findIndex((r) => r.id === req.params.id);
  
  if (rideIndex === -1) {
    return res.status(404).json({ error: "Ride not found" });
  }
  
  rides[rideIndex] = {
    ...rides[rideIndex],
    status,
    ...(status === "completed" ? { completedAt: new Date().toISOString() } : {})
  };
  
  res.json({ ride: rides[rideIndex] });
});

// Delete ride
ridesRouter.delete("/:id", (req, res) => {
  const rideIndex = rides.findIndex((r) => r.id === req.params.id);
  
  if (rideIndex === -1) {
    return res.status(404).json({ error: "Ride not found" });
  }
  
  rides.splice(rideIndex, 1);
  res.status(204).send();
});
