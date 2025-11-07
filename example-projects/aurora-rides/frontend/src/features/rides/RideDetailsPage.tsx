import { useParams, useNavigate } from "react-router-dom";
import { useRide, useDriver, useUpdateRideStatus } from "../../api/hooks";
import { Card, Button, Tag } from "../../design-system";

export const RideDetailsPage = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { data: ride, isLoading } = useRide(rideId || "");
  const { data: driver } = useDriver(ride?.driverId || "");
  const updateStatus = useUpdateRideStatus();

  if (isLoading) {
    return <div>Loading ride details...</div>;
  }

  if (!ride) {
    return (
      <section>
        <h2>Ride Not Found</h2>
        <p>The requested ride could not be found.</p>
        <Button variant="secondary" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      </section>
    );
  }

  const handleStatusChange = (newStatus: typeof ride.status) => {
    if (rideId) {
      updateStatus.mutate({ id: rideId, status: newStatus });
    }
  };

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2>Ride Details</h2>
        <Button variant="secondary" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ marginBottom: "0.5rem" }}>Ride #{ride.id.substring(0, 8)}</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                Created: {new Date(ride.createdAt).toLocaleString()}
              </p>
              {ride.completedAt && (
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  Completed: {new Date(ride.completedAt).toLocaleString()}
                </p>
              )}
            </div>
            <Tag
              variant={
                ride.status === "completed" ? "success" :
                ride.status === "in_progress" ? "warning" :
                ride.status === "cancelled" ? "danger" :
                "default"
              }
            >
              {ride.status}
            </Tag>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                Customer ID
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                {ride.customerId}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                Driver ID
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                {ride.driverId || "Not assigned"}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                Fare
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                ${ride.fare.toFixed(2)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                Distance
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                {ride.distance.toFixed(1)} km
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginBottom: "1rem" }}>Route</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                🟢 Pickup Location
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                {ride.pickupLocation}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                🔴 Dropoff Location
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                {ride.dropoffLocation}
              </p>
            </div>
          </div>
        </Card>

        {driver && (
          <Card>
            <h3 style={{ marginBottom: "1rem" }}>Driver Information</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                  Name
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  {driver.name}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                  Vehicle
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  {driver.vehicleType}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                  Rating
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  {driver.rating.toFixed(1)} ⭐
                </p>
              </div>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                  Completed Rides
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  {driver.completedRides}
                </p>
              </div>
            </div>
          </Card>
        )}

        {ride.status !== "completed" && ride.status !== "cancelled" && (
          <Card>
            <h3 style={{ marginBottom: "1rem" }}>Actions</h3>
            <div style={{ display: "flex", gap: "1rem" }}>
              {ride.status === "pending" && (
                <Button variant="primary" onClick={() => handleStatusChange("accepted")}>
                  Accept Ride
                </Button>
              )}
              {ride.status === "accepted" && (
                <Button variant="primary" onClick={() => handleStatusChange("in_progress")}>
                  Start Ride
                </Button>
              )}
              {ride.status === "in_progress" && (
                <Button variant="primary" onClick={() => handleStatusChange("completed")}>
                  Complete Ride
                </Button>
              )}
              <Button variant="danger" onClick={() => handleStatusChange("cancelled")}>
                Cancel Ride
              </Button>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
};
