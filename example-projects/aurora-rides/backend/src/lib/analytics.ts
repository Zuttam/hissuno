import { rides } from "../data/rides";
import { drivers } from "../data/drivers";

export const getOperationalMetrics = () => {
  const totalRides = rides.length;
  const activeRides = rides.filter((ride) => 
    ride.status === "in_progress" || ride.status === "accepted"
  ).length;
  
  const totalRevenue = rides
    .filter((ride) => ride.status === "completed")
    .reduce((sum, ride) => sum + ride.fare, 0);
  
  const completedRides = rides.filter((ride) => ride.status === "completed");
  const averageRating = drivers.reduce((sum, driver) => sum + driver.rating, 0) / drivers.length;
  
  // Top 3 drivers by completed rides
  const topDrivers = [...drivers]
    .sort((a, b) => b.completedRides - a.completedRides)
    .slice(0, 3)
    .map((driver) => ({
      id: driver.id,
      name: driver.name,
      rides: driver.completedRides
    }));
  
  return {
    totalRides,
    activeRides,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    averageRating: Math.round(averageRating * 100) / 100,
    topDrivers
  };
};
