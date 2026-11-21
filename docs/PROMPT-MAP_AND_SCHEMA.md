You are a senior full-stack mobile engineer helping me build a local ride-hailing and transit application using **React Native (Expo)**, **Supabase (PostgreSQL)**, **Mapbox** (for map rendering, route polylines, custom zone overlays, and Directions/routing), and **Turf.js** (for client-side geofencing).

### System Architecture & Exact RDBMS Schema
Follow my exact relational schema (`rdbm.drawio_2.jpg`) without inventing conflicting table names:

#### Core Tables
* **`USER`**: `user_id` (PK), `credentials`, `profile_information`, `contact_numbers`, `assigned_roles`
* **`DRIVER`**: `driver_id` (PK), `user_id` (FK), `verification_details`, `license_number`, `operational_classification`, `availability_status`
* **`VEHICLE`**: `vehicle_id` (PK), `driver_id` (FK), `routes_id` (FK, nullable for Tricycles), `registration_details`, `plate_number`, `body_number`, `capacity`, `vehicle_type`
* **`ROUTES`**: `routes_id` (PK), `route_name`, `route_polyline`, `start_location`, `end_location`, `ltfrb_route_definition`
* **`TERMINAL`**: `terminal_id` (PK), `routes_id` (FK), `station_name`, `physical_information`, `latitude`, `longitude`
* **`TERMINAL_SCHEDULE`**: `sched_id` (PK), `terminal_id` (FK), `routes_id` (FK), `estimated_departure_time`, `target_dispatch_interval`, `operational_time_window`
* **`FARE_MATRICES`**: `fare_id` (PK), `routes_id` (FK, nullable for Tricycles), `base_fare`, `per_kilometer_rate`, `tariff_tier`, `vehicle_classification`
* **`BOOKING`**: `booking_id` (PK), `user_id` (FK), `driver_id` (FK), `pickup_latitude`, `pickup_longitude`, `dropoff_latitude`, `dropoff_longitude`, `calculated_fixed_fare`, `request_status`
* **`TRIP_RECORDS`**: `trip_id` (PK), `booking_id` (FK), `driver_id` (FK), `user_id` (FK), `actual_distance`, `payment_status`, `total_duration`, `started_at`, `completed_at`
* **`VEHICLE_LOCATIONS`**: `loc_id` (PK), `vehicle_id` (FK), `driver_id` (FK), `latitude`, `longitude`, `recorded_at`
* **`AUDIT_LOGS`**: `log_id` (PK), `user_id` (FK), `event_type`, `event_details`, `login_attempt_status`, `created_at`
* **`DATA_ANALYSIS`**: `data_id` (PK), `routes_id` (FK), `analysis_date`, `peak_travel_hours`, `passenger_demand_heatmap`, `route_utilization_rate`, `operational_efficiency`

### Dual Fare Engine & Business Rules

#### 1. PUJ / PUV Mode (Corridor, Terminal & Zone-Based via `ROUTES` + `FARE_MATRICES`)
* Matches passenger pickup/drop-off points (via Turf.js `@turf/boolean-point-in-polygon` barangay/zone GeoJSON polygons or nearest `TERMINAL` coordinates) to a corridor in `ROUTES` (`start_location` <-> `end_location`, supporting bidirectional lookup so `A -> B` also matches `B -> A`).
* Queries `FARE_MATRICES` by `routes_id`, `vehicle_classification` (`'PUJ'` or `'PUV'`), and `tariff_tier` (e.g., `'REGULAR'`, `'DISCOUNTED'`) to retrieve `base_fare` (and `per_kilometer_rate` if the route uses distance increments; otherwise `0` for flat zone/corridor rates).
* Displays `ROUTES.route_polyline` on Mapbox along with relevant `TERMINAL` pins and `TERMINAL_SCHEDULE` departure info, then locks the computed fare into `BOOKING.calculated_fixed_fare`.

#### 2. Tricycle Mode (Point-to-Point Distance-Based via `FARE_MATRICES`)
* Operates without a fixed `routes_id` (`routes_id IS NULL`).
* Fetches actual road distance (`distanceMeters / 1000`) between `(pickup_latitude, pickup_longitude)` and `(dropoff_latitude, dropoff_longitude)` from the **Mapbox Directions API**.
* Queries `FARE_MATRICES` where `vehicle_classification = 'Tricycle'` to read `base_fare` (`₱10.00`) and `per_kilometer_rate` (`₱5.00/km`), computing `base_fare + Math.max(0, distanceKm - includedKm) * per_kilometer_rate` (rounded to the nearest peso) and locking it into `BOOKING.calculated_fixed_fare`.

#### 3. Mapbox & GPS Lifecycle (`expo-location`)
* **Mapbox Setup:** Render the map with `@rnmapbox/maps` (custom Expo dev client), draw `ROUTES.route_polyline` for PUJ/PUV corridors, draw Mapbox Directions polylines for Tricycle trips, and optionally render barangay/zone GeoJSON boundaries.
* **Initial Pickup:** Request foreground permission and call `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })` to center the Mapbox camera and set initial `pickup_latitude` / `pickup_longitude`.
* **Active Trip Tracking:** Stream live driver GPS coordinates via `Location.watchPositionAsync` (`timeInterval: 3000`, `distanceInterval: 10`, `Accuracy.High`), insert/broadcast updates to `VEHICLE_LOCATIONS` via Supabase Realtime, animate Mapbox vehicle markers smoothly, filter noisy GPS jumps, and call `.remove()` on cleanup. Keep `BOOKING.calculated_fixed_fare` locked while logging `actual_distance`, `total_duration`, `started_at`, and `completed_at` into `TRIP_RECORDS`.

### Task
Help me implement [specify part: e.g., the Supabase PostgreSQL DDL + bidirectional PUJ/PUV & Tricycle fare lookup RPCs matching `rdbm.drawio_2.jpg` / the Mapbox + Turf.js React Native booking flow / the live `VEHICLE_LOCATIONS` GPS tracking service] with clean, modular, production-ready code.