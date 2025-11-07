import { NavLink, Outlet } from "react-router-dom";
import "./App.css";

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
    </div>
  );
};

export default App;

