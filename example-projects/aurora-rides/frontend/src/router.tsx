import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { HomePage } from "./pages/HomePage";
import { DriversPage } from "./pages/DriversPage";
import { BookingsPage } from "./pages/BookingsPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { RideDetailsPage } from "./features/rides/RideDetailsPage";
import { DesignSystemDocs } from "./design-system/docs/DesignSystemDocs";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "drivers", element: <DriversPage /> },
      { path: "bookings", element: <BookingsPage /> },
      { path: "rides/:rideId", element: <RideDetailsPage /> },
      { path: "design-system", element: <DesignSystemDocs /> }
    ]
  }
]);

