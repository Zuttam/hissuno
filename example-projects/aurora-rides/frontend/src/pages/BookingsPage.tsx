import { useState } from "react";
import { useBookings, useCreateBooking } from "../api/hooks";
import { Card, Button, Tag, Input } from "../design-system";

export const BookingsPage = () => {
  const { data: bookings, isLoading } = useBookings();
  const createBooking = useCreateBooking();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customerId: "",
    customerName: "",
    pickupLocation: "",
    dropoffLocation: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBooking.mutate(formData, {
      onSuccess: () => {
        setShowForm(false);
        setFormData({ customerId: "", customerName: "", pickupLocation: "", dropoffLocation: "" });
      }
    });
  };

  if (isLoading) {
    return <div>Loading bookings...</div>;
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2>Bookings</h2>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Booking"}
        </Button>
      </div>

      {showForm && (
        <Card style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Create New Booking</h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Input
              label="Customer ID"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              required
            />
            <Input
              label="Customer Name"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              required
            />
            <Input
              label="Pickup Location"
              value={formData.pickupLocation}
              onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
              required
            />
            <Input
              label="Dropoff Location"
              value={formData.dropoffLocation}
              onChange={(e) => setFormData({ ...formData, dropoffLocation: e.target.value })}
              required
            />
            <Button type="submit" variant="primary" disabled={createBooking.isPending}>
              {createBooking.isPending ? "Creating..." : "Create Booking"}
            </Button>
          </form>
        </Card>
      )}

      <p style={{ marginBottom: "2rem", color: "var(--color-text-secondary)" }}>
        Manage live and upcoming ride bookings with real-time status updates.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {bookings?.map((booking) => (
          <Card key={booking.id} hover>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ marginBottom: "0.5rem" }}>{booking.customerName}</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
                  ID: {booking.customerId}
                </p>
                <p style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                  <strong>Pickup:</strong> {booking.pickupLocation}
                </p>
                <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  <strong>Dropoff:</strong> {booking.dropoffLocation}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                  Requested: {new Date(booking.requestedAt).toLocaleString()}
                </p>
              </div>
              <Tag 
                variant={
                  booking.status === "confirmed" ? "success" : 
                  booking.status === "cancelled" ? "danger" : 
                  "warning"
                }
              >
                {booking.status}
              </Tag>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
