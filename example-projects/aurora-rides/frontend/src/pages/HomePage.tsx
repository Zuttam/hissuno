import { Button } from "../design-system";
import { useNavigate } from "react-router-dom";

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <section style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", padding: "3rem 1rem" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Aurora Rides</h1>
      <h2 style={{ fontSize: "1.5rem", color: "var(--color-text-secondary)", marginBottom: "2rem" }}>
        Ride-hailing intelligence
      </h2>
      <p style={{ fontSize: "1.125rem", lineHeight: 1.7, marginBottom: "2rem" }}>
        Aurora Rides is a fictional platform that connects riders with drivers using real-time analytics and modern
        design systems. This example project demonstrates a comprehensive design system, React Query integration, and
        a Node.js backend.
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Button variant="primary" onClick={() => navigate("/dashboard")}>
          View Dashboard
        </Button>
        <Button variant="secondary" onClick={() => navigate("/design-system")}>
          Explore Design System
        </Button>
      </div>
    </section>
  );
};
