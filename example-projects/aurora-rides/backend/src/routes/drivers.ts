import { Router } from "express";
import { drivers } from "../data/drivers";

export const driversRouter = Router();

// Get all drivers
driversRouter.get("/", (_req, res) => {
  res.json({ drivers });
});

// Get driver by ID
driversRouter.get("/:id", (req, res) => {
  const driver = drivers.find((d) => d.id === req.params.id);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }
  res.json({ driver });
});

// Update driver status
driversRouter.patch("/:id", (req, res) => {
  const { status } = req.body;
  const driverIndex = drivers.findIndex((d) => d.id === req.params.id);
  
  if (driverIndex === -1) {
    return res.status(404).json({ error: "Driver not found" });
  }
  
  drivers[driverIndex] = {
    ...drivers[driverIndex],
    status
  };
  
  res.json({ driver: drivers[driverIndex] });
});
