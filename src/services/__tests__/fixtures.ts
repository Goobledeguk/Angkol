import type { Geometry, Point } from "../../types/types";

export const timestamp = "2026-05-06T07:08:09.000Z";
export const now = Date.parse(timestamp);
export const pickup: Point = {
  name: "Market",
  latitude: 12.07,
  longitude: 124.59,
};
export const destination: Point = {
  name: "Pier",
  latitude: 12.09,
  longitude: 124.61,
};
export const geometry: Geometry = {
  type: "LineString",
  coordinates: [
    [124.59, 12.07],
    [124.6, 12.08],
    [124.61, 12.09],
  ],
};

export const booking = {
  booking_id: "booking-1",
  user_id: "rider",
  driver_id: "driver-1",
  driver_name: "Stored driver",
  driver_plate: "ABC 123",
  pickup_name: "Market",
  pickup_latitude: "12.07",
  pickup_longitude: "124.59",
  dropoff_name: "Pier",
  dropoff_latitude: "12.09",
  dropoff_longitude: "124.61",
  distance_km: "2.7",
  calculated_fixed_fare: "45.50",
  duration_min: "8",
  route_polyline: geometry,
  created_at: timestamp,
  expires_at: "2026-05-06T07:13:09.000Z",
  request_status: "Completed",
  timestamps: { Completed: now + 1000 },
  rating: 4,
  pickup_note: "Gate 2",
};
