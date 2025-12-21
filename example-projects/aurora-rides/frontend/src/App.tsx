import { NavLink, Outlet } from "react-router-dom";
import { CustomizeWidget } from "@customize/widget";
import "@copilotkit/react-ui/styles.css";
import "./App.css";

// Get these from your Customize dashboard or use test values for development
const CUSTOMIZE_PROJECT_ID = import.meta.env.VITE_CUSTOMIZE_PROJECT_ID || "test-project";
const CUSTOMIZE_PUBLIC_KEY = import.meta.env.VITE_CUSTOMIZE_PUBLIC_KEY || "pk_live_test";
const CUSTOMIZE_API_URL = import.meta.env.VITE_CUSTOMIZE_API_URL || "http://localhost:3000/api/copilotkit";

export const App = () => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Aurora Rides</h1>
        <nav>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/drivers">Drivers</NavLink>
          <NavLink to="/bookings">Bookings</NavLink>
        </nav>
      </header>
      <main className="app-content">
        <Outlet />
      </main>

      {/* Customize Support Widget */}
      <CustomizeWidget
        projectId={CUSTOMIZE_PROJECT_ID}
        publicKey={CUSTOMIZE_PUBLIC_KEY}
        apiUrl={CUSTOMIZE_API_URL}
        title="Aurora Support"
        initialMessage="Hi! 👋 How can I help you with Aurora Rides today?"
      />
    </div>
  );
};

export default App;

