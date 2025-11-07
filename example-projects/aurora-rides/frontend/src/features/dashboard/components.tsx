import { Card, Tag } from "../../design-system";
import type { Ride } from "../../api/hooks";
import { useNavigate } from "react-router-dom";

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: string;
};

export const MetricCard = ({ label, value, icon }: MetricCardProps) => {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "2rem" }}>{icon}</span>
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>
            {label}
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: "var(--font-weight-bold)" }}>
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
};

type RecentRidesTableProps = {
  rides: Ride[];
};

export const RecentRidesTable = ({ rides }: RecentRidesTableProps) => {
  const navigate = useNavigate();

  if (rides.length === 0) {
    return (
      <Card>
        <p style={{ color: "var(--color-text-secondary)" }}>No recent rides to display.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)" }}>
                Ride ID
              </th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)" }}>
                Route
              </th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)" }}>
                Status
              </th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)" }}>
                Fare
              </th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.875rem", fontWeight: "var(--font-weight-semibold)" }}>
                Distance
              </th>
            </tr>
          </thead>
          <tbody>
            {rides.map((ride) => (
              <tr
                key={ride.id}
                style={{
                  borderBottom: "1px solid var(--color-border)",
                  cursor: "pointer"
                }}
                onClick={() => navigate(`/rides/${ride.id}`)}
              >
                <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>
                  {ride.id.substring(0, 8)}...
                </td>
                <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>
                  {ride.pickupLocation} → {ride.dropoffLocation}
                </td>
                <td style={{ padding: "0.75rem" }}>
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
                </td>
                <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>
                  ${ride.fare.toFixed(2)}
                </td>
                <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>
                  {ride.distance.toFixed(1)} km
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
