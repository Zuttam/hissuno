import { useAnalytics, useRides } from "../../api/hooks";
import { MetricCard, RecentRidesTable } from "./components";
import { Grid } from "../../design-system";

export const DashboardPage = () => {
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics();
  const { data: rides, isLoading: ridesLoading } = useRides();

  if (analyticsLoading || ridesLoading) {
    return <div>Loading dashboard...</div>;
  }

  const recentRides = rides?.slice(0, 5) || [];

  return (
    <section>
      <h2 style={{ marginBottom: "1.5rem" }}>Operations Dashboard</h2>
      <p style={{ marginBottom: "2rem", color: "var(--color-text-secondary)" }}>
        Key performance indicators for Aurora Rides with real-time metrics and insights.
      </p>

      <Grid columns={4} gap="md" style={{ marginBottom: "2rem" }}>
        <MetricCard
          label="Total Rides"
          value={analytics?.totalRides || 0}
          icon="🚗"
        />
        <MetricCard
          label="Active Rides"
          value={analytics?.activeRides || 0}
          icon="⚡"
        />
        <MetricCard
          label="Total Revenue"
          value={`$${analytics?.totalRevenue.toLocaleString() || 0}`}
          icon="💰"
        />
        <MetricCard
          label="Avg Rating"
          value={analytics?.averageRating.toFixed(1) || "0.0"}
          icon="⭐"
        />
      </Grid>

      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginBottom: "1rem" }}>Top Drivers</h3>
        <Grid columns={3} gap="md">
          {analytics?.topDrivers.map((driver) => (
            <div
              key={driver.id}
              style={{
                padding: "1rem",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--border-radius-md)",
                backgroundColor: "var(--color-surface)"
              }}
            >
              <p style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "0.25rem" }}>
                {driver.name}
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                {driver.rides} rides completed
              </p>
            </div>
          ))}
        </Grid>
      </div>

      <div>
        <h3 style={{ marginBottom: "1rem" }}>Recent Rides</h3>
        <RecentRidesTable rides={recentRides} />
      </div>
    </section>
  );
};
