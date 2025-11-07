import express from "express";
import cors from "cors";
import morgan from "morgan";
import { ridesRouter } from "./routes/rides";
import { driversRouter } from "./routes/drivers";
import { bookingsRouter } from "./routes/bookings";
import { getOperationalMetrics } from "./lib/analytics";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/analytics", (_req, res) => {
  res.json({ analytics: getOperationalMetrics() });
});

app.use("/api/rides", ridesRouter);
app.use("/api/drivers", driversRouter);
app.use("/api/bookings", bookingsRouter);

app.listen(port, () => {
  console.log(`Aurora Rides API listening on http://localhost:${port}`);
});

