export type DriverStatus = "available" | "busy" | "offline";

export type Driver = {
  id: string;
  name: string;
  vehicleType: string;
  rating: number;
  completedRides: number;
  status: DriverStatus;
  currentLocation: string;
};

export const drivers: Driver[] = [
  {
    id: "drv_001",
    name: "Sarah Johnson",
    vehicleType: "Tesla Model 3",
    rating: 4.9,
    completedRides: 1247,
    status: "available",
    currentLocation: "Downtown"
  },
  {
    id: "drv_002",
    name: "Michael Chen",
    vehicleType: "Honda Accord",
    rating: 4.8,
    completedRides: 892,
    status: "busy",
    currentLocation: "Westside"
  },
  {
    id: "drv_003",
    name: "Emily Rodriguez",
    vehicleType: "Toyota Prius",
    rating: 4.95,
    completedRides: 1563,
    status: "available",
    currentLocation: "Midtown"
  },
  {
    id: "drv_004",
    name: "David Kim",
    vehicleType: "Nissan Leaf",
    rating: 4.7,
    completedRides: 634,
    status: "offline",
    currentLocation: "Uptown"
  },
  {
    id: "drv_005",
    name: "Jessica Williams",
    vehicleType: "Chevrolet Bolt",
    rating: 4.85,
    completedRides: 1089,
    status: "available",
    currentLocation: "Eastside"
  },
  {
    id: "drv_006",
    name: "Robert Martinez",
    vehicleType: "Ford Fusion",
    rating: 4.75,
    completedRides: 756,
    status: "busy",
    currentLocation: "Northtown"
  }
];
