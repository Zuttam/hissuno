import { useDrivers, useUpdateDriverStatus } from "../api/hooks";
import { Card, Button, Tag, Grid } from "../design-system";

export const DriversPage = () => {
  const { data: drivers, isLoading } = useDrivers();
  const updateStatus = useUpdateDriverStatus();

  if (isLoading) {
    return <div>Loading drivers...</div>;
  }

  const handleStatusToggle = (driverId: string, currentStatus: string) => {
    const newStatus = currentStatus === "available" ? "offline" : "available";
    updateStatus.mutate({ id: driverId, status: newStatus as "available" | "busy" | "offline" });
  };

  return (
    <section>
      <h2 style={{ marginBottom: "1.5rem" }}>Drivers Directory</h2>
      <p style={{ marginBottom: "2rem", color: "var(--color-text-secondary)" }}>
        Explore the fleet of Aurora drivers with real-time availability and ratings.
      </p>
      
      <Grid columns={3} gap="md">
        {drivers?.map((driver) => (
          <Card key={driver.id} hover>
            <div style={{ marginBottom: "0.75rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>{driver.name}</h3>
              <Tag variant={driver.status === "available" ? "success" : driver.status === "busy" ? "warning" : "default"}>
                {driver.status}
              </Tag>
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
              <p><strong>Vehicle:</strong> {driver.vehicleType}</p>
              <p><strong>Rating:</strong> {driver.rating.toFixed(1)} ⭐</p>
              <p><strong>Completed Rides:</strong> {driver.completedRides}</p>
              <p><strong>Location:</strong> {driver.currentLocation}</p>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              fullWidth
              onClick={() => handleStatusToggle(driver.id, driver.status)}
              disabled={driver.status === "busy"}
            >
              {driver.status === "available" ? "Set Offline" : "Set Available"}
            </Button>
          </Card>
        ))}
      </Grid>
    </section>
  );
};
