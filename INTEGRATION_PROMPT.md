# Angkol — Integration Prompt & Project Summary

> **Purpose:** This document is a self-contained prompt/instruction set for integrating a real backend (Supabase) and real map API into the Angkol static prototype, without altering or removing existing UI files. Use it as the brief when prompting an AI or developer to perform the integration.

---

## 1. Project Summary

**Angkol** is an Expo / React Native mobile app (with a web admin panel) for public-transport ride-hailing in Calbayog City, Samar, Philippines. It supports:

- **Passengers** booking tricycle rides (point-to-point) and PUJ/PUV corridor routes.
- **Tricycle drivers** accepting/declining hails, tracking trips, recording cash fares.
- **PUJ/PUV drivers** operating corridor runs, counting boardings/alightings per stop, completing runs.
- **Administrators (Technical Team, Level A)** — system-wide monitoring, audit logs, route/terminal/fare configuration, driver approval.
- **Franchise Owners (Vehicle Owner / Operator, Level B)** — e.g. Calbayog Metro Express — manage their fleet, approve/decline PUJ/PUV driver applications, monitor fleet trips.

**Current state:** Pure static prototype. All data is in-memory (module-level `state` in `src/services/api.ts`). No backend, no authentication, no real GPS/tiles, no external services. All names, plates, fares, and routes are fictional sample data.

**Tech stack:**
- Expo SDK ~58 (expo 58.0.23, react-native 0.88.1, react 19.3.0)
- expo-router (file-based routing, routes in `src/app/`)
- TypeScript strict (`tsc --noEmit`)
- React Native Reanimated, Gesture Handler, Safe Area Context
- `@expo/vector-icons` (Ionicons)

**Key constraint:** Preserve existing UI design — layouts, colors, typography, navigation, sign-in screens. Integration must only replace live behavior with real data; no preview choosers, banners, or redesigns.

---

## 2. Current Architecture (local-only)

### 2.1 Data flow

```
User Action → action(endpoint, input, method) → api(endpoint, input, method)
  → mutates module-level `state: Snapshot` in memory → refresh() → api("/state")
  → new Snapshot (structuredClone) → AngkolApp re-renders → role dispatch
  → screen re-renders with updated props → derived values recompute → UI updates
```

### 2.2 Key files

| File | Role |
|---|---|
| `src/services/api.ts` | In-memory API adapter — the single "backend." All endpoints (`/state`, `/register`, `/book`, `/trips/:id`, `/runs`, `/vehicles`, `/configure`, etc.) mutate a module-level `Snapshot`. **Replace internals with real Supabase calls.** |
| `src/AngkolApp.tsx` | Root shell: holds `data`, `notice`, `sharing`; `refresh()`, `action()`, `logout()`; role-based dispatch to `AdminDashboard` / `PassengerApp` / `DriverApp`. |
| `src/types/types.ts` | Single source of truth for the data model (`User`, `Trip`, `Route`, `Terminal`, `Vehicle`, `DriverRun`, `Snapshot`, `Point`, etc.). **Maps 1:1 to Supabase tables.** |
| `src/auth/MobileAuth.tsx` | Sign-in/sign-up sheet. Currently uses `signInSampleAccount` / `registerSampleAccount` from `sampleAccounts.ts`. **Replace with Supabase Auth.** |
| `src/auth/sampleAccounts.ts` | 5 fictional demo accounts (RBAC). **Replace with real user lookup + role assignment.** |
| `src/map/StaticMap.tsx` | Static map placeholder. **Replace with real map component (react-native-maps / Mapbox).** |
| `src/map/CalbayogMap.tsx` | Re-exports `StaticMap`. |
| `src/services/previewActions.ts` | Simulated `Share`, `Linking`, `pickDriverPhoto` (all `Alert.alert`). **Replace with real device APIs.** |
| `src/admin/AdminDashboard.web.tsx` | Web-only admin panel (`.web.tsx` extension). Fleet, drivers, trips, monitor. |
| `src/admin/AdminPanel.tsx` | Transport management (routes, terminals, fares, driver approval). |
| `src/driver/DriverApp.tsx` | Driver dashboard (Tricycle + PUJ/PUV). |
| `src/passenger/PassengerApp.tsx` | Passenger booking flow. |
| `src/passenger/passengerScreens.tsx` | Passenger sub-screens (Home, Routes, Trips, Profile). |
| `src/common/ui.tsx` | Reusable UI primitives (`Icon`, `Button`, `Popover`, `Field`, `Card`, `Badge`, `Heading`, `Choice`, `money`). |
| `src/common/styles.ts` | Shared visual tokens. |
| `src/passenger/passengerStyles.ts` | Passenger-app styling (`ps`, `passengerColors`). |

### 2.3 Data model → Supabase tables

Each type in `src/types/types.ts` maps to a Supabase table:

| TypeScript type | Supabase table | Key fields |
|---|---|---|
| `User` | `users` (or `profiles` via Supabase Auth) | `id, email, name, phone, role, adminLevel, ownerVehicleIds, available, verified, license, association, plate, permitNo, franchiseName, capacity, routeId, location (lat/lng/updatedAt), photo` |
| `Trip` | `trips` | `id, passengerId, passenger, driverId, driver, plate, status, pickup, destination, pickupPoint, destinationPoint, distance, fare, minutes, geometry, createdAt, timestamps, rating, pickupNote, demoPayment` |
| `Route` | `routes` | `id, name, destination, transportType, stops, fare, interval, startsAt, endsAt, active, approved, reference, scheduled` |
| `Terminal` | `terminals` | `id, name, point (lat/lng), routeId, active` |
| `Vehicle` | `vehicles` | `id, name, kind, vehicleType, plate, routeId, capacity, location, stale, status, ownerId, ownerName, currentDriver` |
| `DriverRun` | `driver_runs` | `id, driverId, driver, plate, capacity, routeId, routeName, stops, fare, sampleFare, reference, status, startedAt, endedAt, stopIndex, onboard, totalBoarded, cashFares, revision, events` |
| `StopRequest` | `stop_requests` | `id, routeId, point, passenger, userId, createdAt` |
| `Report` | `reports` | `id, details, tripId, status, reporter, createdAt` |
| Notification | `notifications` | `id, message, createdAt, read, userId` |
| Audit log | `audit_logs` | `id, actor_id, action, at` |

### 2.4 Role system (RBAC)

Roles: `Passenger`, `Tricycle driver`, `PUJ / PUV driver`, `Administrator`, `Vehicle Owner / Operator`.

Admin levels: `Technical Team` (Level A, full system access) or `Franchise Owner` (Level B, own franchise only).

Franchise: `Calbayog Metro Express` (owner: Kent Ferrer, `ownerVehicleIds: ["sample-driver-1", "sample-driver-3"]`).

---

## 3. Integration Guidelines

### 3.1 Supabase setup

**Step 1: Create Supabase project**
- Create a project at https://supabase.com
- Note the `SUPABASE_URL` and `SUPABASE_ANON_KEY` (public) and `SUPABASE_SERVICE_ROLE_KEY` (server-only).

**Step 2: Install dependencies**
```bash
npx expo install @supabase/supabase-js
# Optional: expo-secure-store for session persistence
npx expo install expo-secure-store
```

**Step 3: Create the Supabase client**
Create `src/services/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Step 4: Create database tables**
Run SQL migrations in the Supabase SQL editor. Example for `users`/`profiles`:

```sql
-- Enable RLS
alter table profiles enable row level security;

-- Profiles table (extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null,
  phone text default '',
  role text not null default 'Passenger',
  admin_level text,
  owner_vehicle_ids text[] default '{}',
  available boolean default true,
  verified boolean default true,
  license text default '',
  association text default '',
  plate text default '',
  permit_no text default '',
  franchise_name text default '',
  capacity int default 0,
  route_id text,
  location jsonb,
  photo text,
  created_at timestamptz default now()
);

-- RLS: users can read/update their own profile; admins can read all
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Admins can view all profiles" on profiles for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'Administrator'));
```

Repeat for `trips`, `routes`, `terminals`, `vehicles`, `driver_runs`, `stop_requests`, `reports`, `notifications`, `audit_logs`.

**Step 5: Row-Level Security (RLS)**
- Passengers can only read/write their own trips.
- Drivers can read trips assigned to them and update status.
- Franchise owners can read vehicles/trips/drivers where `owner_id = auth.uid()`.
- Technical admins can read/write everything.

**Step 6: Real-time subscriptions**
Use Supabase Realtime for live trip status, driver locations, and notifications:

```ts
supabase
  .channel("trips")
  .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, (payload) => {
    // update local state
  })
  .subscribe();
```

### 3.2 Replacing `src/services/api.ts`

The current `api()` function is a single entry point. Replace its internals:

| Current (local) | Replacement (Supabase) |
|---|---|
| `selectDemo(role)` | `supabase.auth.signInWithPassword({ email, password })` + fetch profile |
| `api("/state")` | `supabase.from("profiles").select("*").eq("id", userId).single()` + fetch related trips/routes/vehicles |
| `api("/register")` | `supabase.auth.signUp({ email, password })` + insert profile |
| `api("/book")` | `supabase.from("trips").insert({ ... })` |
| `api("/trips/:id")` PATCH | `supabase.from("trips").update({ status }).eq("id", id)` |
| `api("/runs")` POST | `supabase.from("driver_runs").insert({ ... })` |
| `api("/runs/:id")` PATCH | `supabase.from("driver_runs").update({ ... }).eq("id", id)` |
| `api("/vehicles")` POST | `supabase.from("vehicles").upsert({ ... })` |
| `api("/configure")` | `supabase.from("routes").upsert(...)` / `terminals` / config |
| `api("/report")` | `supabase.from("reports").insert({ ... })` |
| `api("/search?q=")` | `supabase.from("landmarks").select("*").ilike("name", `%${q}%`)` |

Keep the `api()` function signature so screens don't change:
```ts
export async function api<T>(endpoint: string, input?: unknown, method?: string): Promise<T> {
  // route to Supabase based on endpoint
}
```

### 3.3 Replacing `src/auth/MobileAuth.tsx` and `sampleAccounts.ts`

- Remove `signInSampleAccount` / `registerSampleAccount` / `selectDemo`.
- Use Supabase Auth: `supabase.auth.signInWithPassword({ email, password })` and `supabase.auth.signUp({ email, password, options: { data: { name, role, ... } } })`.
- On sign-up, insert a profile row with the chosen role.
- Keep the UI (two-step form, validation, "Waiting for approval" for PUJ/PUV) — only replace the auth calls.
- Role is stored in `profiles.role`; `AngkolApp.tsx` reads it from the session profile.

### 3.4 Replacing `src/map/StaticMap.tsx`

Current: static placeholder with `Pressable` overlay for point selection.

Replacement options:
- **react-native-maps** (recommended, Expo-compatible): `npx expo install react-native-maps`
- **Mapbox** via `@rnmapbox/maps` (requires dev build)
- **OpenStreetMap tiles** via `react-native-webview` + Leaflet (web-only fallback)

Migration:
1. Create `src/map/CalbayogMap.tsx` as a real map component (replace the re-export).
2. Accept props: `pickup`, `destination`, `vehicles`, `stops`, `terminals`, `landmarks`, `mode`, `onSelect`.
3. Render markers for vehicles, terminals, stops, pickup/destination.
4. On `mode="select"`, enable tap-to-select and call `onSelect(point)` with lat/lng.
5. Keep the same prop interface so `PassengerApp.tsx` and `DriverApp.tsx` don't change.

### 3.5 Replacing `src/services/previewActions.ts`

| Current (simulated) | Replacement (real) |
|---|---|
| `Share.share()` → `Alert.alert` | `Share` from `react-native` (built-in) |
| `Linking.openURL()` → `Alert.alert` | `Linking` from `react-native` (built-in) |
| `pickDriverPhoto()` → `Alert.alert` returns `null` | `expo-image-picker`: `ImagePicker.launchImageLibraryAsync()` / `launchCameraAsync()` |

### 3.6 Real-time & GPS

- **Driver location**: Use `expo-location` (`Location.watchPositionAsync`) to update `vehicles.location` / `users.location` in Supabase every N seconds when `sharing === true`.
- **Passenger tracking**: Subscribe to the assigned driver's vehicle row via Supabase Realtime; update the map marker.
- **Trip status**: Subscribe to the trip row; auto-route passenger to "Receipt" when status becomes "Completed" (already handled by `previousStatuses` ref in `PassengerApp.tsx`).

### 3.7 Environment variables

Create `.env` (or use `app.json` → `extra`):
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
Access via `process.env.EXPO_PUBLIC_*` (Expo convention).

---

## 4. Migration Checklist

1. [ ] Create Supabase project + tables + RLS policies.
2. [ ] Install `@supabase/supabase-js` and `expo-secure-store`.
3. [ ] Create `src/services/supabase.ts` client.
4. [ ] Replace `api.ts` internals with Supabase calls (keep function signature).
5. [ ] Replace `MobileAuth.tsx` auth calls with Supabase Auth.
6. [ ] Remove `sampleAccounts.ts` usage (keep file for reference, don't delete).
7. [ ] Replace `StaticMap.tsx` with real map component.
8. [ ] Replace `previewActions.ts` with real device APIs.
9. [ ] Add `expo-location` for real GPS sharing.
10. [ ] Add Supabase Realtime subscriptions for trips/vehicles/notifications.
11. [ ] Seed initial data (routes, terminals, sample vehicles/drivers) via Supabase seed script.
12. [ ] Run `tsc --noEmit` and `expo lint --max-warnings=0` to verify.
13. [ ] Test on Android emulator + physical device for safe-area/navbar spacing.

---

## 5. What NOT to change

- **UI design**: layouts, colors, typography, navigation, sign-in screens — preserve exactly.
- **File structure**: keep `src/app/` for routes, `src/` subfolders for components/hooks/utils.
- **Type definitions**: `src/types/types.ts` — extend, don't break.
- **Props contract**: `AngkolApp.tsx` props (`data`, `notice`, `busy`, `connected`, `dismissNotice`, `refresh`, `action`, `logout`) — keep identical so screens don't need changes.
- **Screen navigation**: `useLocalSearchParams` + `router.setParams` pattern — keep.

---

## 6. Prompt Template (for AI integration)

> **Prompt:** "You are integrating a real backend (Supabase) and real map API into the Angkol Expo/React Native prototype. The project is at `C:\Users\alizz\Downloads\SoftEng\Angkol`. The current data layer is `src/services/api.ts` (in-memory). The data model is in `src/types/types.ts`. The UI must be preserved exactly — only replace data-fetching, auth, map, and device-API internals. Follow the migration checklist in `INTEGRATION_PROMPT.md`. Start with: (1) Supabase client setup, (2) replacing `api.ts` internals, (3) replacing `MobileAuth.tsx` auth calls. Run `tsc --noEmit` and `expo lint` after each step. Do not modify any `.tsx` UI files except to swap import sources."

---

## 7. Files to Remove / Retire During Integration

These files exist only for the static prototype and should be **removed or replaced** when integrating a real backend. Do not delete them until the replacement is in place and tested.

| File | Why it's temporary | Replacement |
|---|---|---|
| `src/auth/sampleAccounts.ts` | Hardcoded demo credentials (5 accounts, password `Angkol123!`). | Supabase Auth + `profiles` table lookup. |
| `src/admin/sampleAdministratorData.ts` | Seeds fictional admin data into `state` via `populateAdministratorSamples()`. | Supabase seed script or initial data migration. |
| `src/services/api.ts` (internals) | Entire in-memory adapter (`state`, `selectDemo`, `pendingStore`, etc.). | Supabase client calls (keep function signature). |
| `src/map/StaticMap.tsx` | Static placeholder map with `Pressable` overlay. | Real map component (`react-native-maps` / Mapbox). |
| `src/services/previewActions.ts` | Simulated `Share`, `Linking`, `pickDriverPhoto` (all `Alert.alert`). | Real `react-native` Share/Linking + `expo-image-picker`. |
| `src/driver/sampleDriverData.ts` | Creates fictional driver trips/runs. | Supabase seed data. |
| `src/services/sampleTrips.ts` | Creates fictional passenger trips. | Supabase seed data. |
| `src/services/sampleTrips.ts` (if exists) | Fictional trip generator. | Supabase seed data. |

**Removal order:** Replace `api.ts` internals first → then `MobileAuth.tsx` auth calls → then `StaticMap.tsx` → then `previewActions.ts` → finally delete `sampleAccounts.ts`, `sampleAdministratorData.ts`, `sampleDriverData.ts`, `sampleTrips.ts`.

---

## 8. Data Flow Alteration (local → Supabase)

### 8.1 Before (current prototype)

```
UI event → action() → api() → mutate module-level `state` → refresh() → api("/state")
  → structuredClone(state) → screen re-render → derived values recompute
```

All state lives in `src/services/api.ts` module scope. No persistence, no auth, no real-time.

### 8.2 After (integrated)

```
UI event → action() → api() → Supabase query/mutation
  → Supabase returns data → update local React state (or Supabase Realtime pushes update)
  → screen re-render → derived values recompute → UI updates
```

**Key changes:**
1. **`api.ts`**: Replace `state` variable with Supabase client calls. Keep `api()` signature so screens don't change.
2. **`AngkolApp.tsx`**: `refresh()` calls `api("/state")` which now fetches from Supabase. `action()` still wraps mutation + refresh.
3. **`MobileAuth.tsx`**: `onSignedIn` → Supabase `signInWithPassword` / `signUp` + profile fetch.
4. **Real-time**: Add Supabase Realtime subscriptions in `AngkolApp.tsx` or a custom hook (`useRealtime`) that listens to `trips`, `vehicles`, `notifications` tables and calls `refresh()` on change.
5. **GPS sharing**: `toggleSharing` → `expo-location` `watchPositionAsync` → upsert `vehicles.location` / `users.location` in Supabase.
6. **Persistence**: Session stored via `expo-secure-store` (Supabase Auth handles this). Data persists across app restarts.

### 8.3 New files to create

| File | Purpose |
|---|---|
| `src/services/supabase.ts` | Supabase client (auth + database + realtime). |
| `src/hooks/useRealtime.ts` | Supabase Realtime subscription hook (optional, can inline in AngkolApp). |
| `src/services/location.ts` | GPS wrapper using `expo-location` (optional, can inline). |

### 8.4 What stays the same

- `AngkolApp.tsx` props contract (`data`, `notice`, `busy`, `connected`, `dismissNotice`, `refresh`, `action`, `logout`).
- Screen navigation via `useLocalSearchParams` + `router.setParams`.
- `src/types/types.ts` — extend, don't break.
- UI components in `src/common/ui.tsx`, `src/common/styles.ts`, `src/passenger/passengerStyles.ts`.

---

## 9. Supabase Schema Creation (from SRS)

Based on the SRS Section 6.1 (Database Schema Requirements), the following tables must be created. Run these SQL statements in the Supabase SQL editor.

### 9.1 Core tables

```sql
-- USERS (extends Supabase auth.users)
create table users (
  user_id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null,
  phone text default '',
  role text not null default 'Passenger',
  admin_level text,
  owner_vehicle_ids text[] default '{}',
  available boolean default true,
  verified boolean default true,
  license text default '',
  association text default '',
  plate text default '',
  permit_no text default '',
  franchise_name text default '',
  capacity int default 0,
  route_id text,
  location jsonb,
  photo text,
  created_at timestamptz default now()
);

-- DRIVERS (extends users)
create table drivers (
  driver_id uuid references users(user_id) on delete cascade primary key,
  user_id uuid references users(user_id) on delete cascade not null,
  license_no text default '',
  association text default '',
  driver_type text default 'Tricycle', -- 'Tricycle' | 'PUJ/PUV'
  availability_status text default 'Available', -- 'Available' | 'Unavailable'
  verified boolean default false,
  created_at timestamptz default now()
);

-- VEHICLES
create table vehicles (
  vehicle_id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers(driver_id) on delete set null,
  route_id text,
  name text not null,
  kind text default 'PUJ / PUV driver',
  vehicle_type text default 'Jeepney',
  plate text not null,
  capacity int default 0,
  location jsonb,
  stale boolean default false,
  status text default 'In Terminal', -- 'Arrived' | 'In Terminal' | 'Broken / Inactive' | 'In transit'
  owner_id uuid references users(user_id) on delete set null,
  owner_name text default '',
  current_driver text default '',
  created_at timestamptz default now()
);

-- ROUTES
create table routes (
  route_id text primary key,
  name text not null,
  destination text default '',
  transport_type text default 'PUJ / PUV',
  stops jsonb default '[]',
  fare numeric default 0,
  interval int default 0,
  starts_at text default '06:00',
  ends_at text default '20:00',
  active boolean default true,
  approved boolean default false,
  reference text default '',
  scheduled boolean default false,
  created_at timestamptz default now()
);

-- TERMINALS
create table terminals (
  terminal_id text primary key,
  name text not null,
  point jsonb not null, -- { name, latitude, longitude }
  route_id text references routes(route_id) on delete set null,
  active boolean default true,
  created_at timestamptz default now()
);

-- TERMINAL SCHEDULES
create table terminal_schedules (
  sched_id uuid primary key default gen_random_uuid(),
  terminal_id text references terminals(terminal_id) on delete cascade,
  route_id text references routes(route_id) on delete cascade,
  departure_time text not null,
  interval_minutes int default 0,
  starts_at text,
  ends_at text,
  created_at timestamptz default now()
);

-- FARE MATRICES
create table fare_matrices (
  fare_id uuid primary key default gen_random_uuid(),
  route_id text references routes(route_id) on delete cascade,
  base_fare numeric default 0,
  per_km_rate numeric default 0,
  reference text default '',
  effective_date date default current_date,
  approved boolean default false,
  created_at timestamptz default now()
);

-- BOOKINGS (point-to-point tricycle ride requests)
create table bookings (
  booking_id uuid primary key default gen_random_uuid(),
  passenger_id uuid references users(user_id) on delete cascade not null,
  passenger_name text not null,
  driver_id uuid references users(user_id) on delete set null,
  driver_name text default '',
  plate text default '',
  pickup jsonb not null, -- Point { name, latitude, longitude }
  destination jsonb not null,
  pickup_point jsonb,
  destination_point jsonb,
  distance numeric default 0,
  fare numeric default 0,
  minutes int default 0,
  geometry jsonb,
  status text default 'Requested', -- 'Requested' | 'Accepted' | 'Arrived' | 'In progress' | 'Completed' | 'Cancelled'
  created_at timestamptz default now(),
  timestamps jsonb default '{}',
  rating int,
  pickup_note text,
  demo_payment jsonb
);

-- TRIP RECORDS (completed/terminated trips)
create table trip_records (
  trip_id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(booking_id) on delete cascade,
  driver_id uuid references users(user_id) on delete set null,
  user_id uuid references users(user_id) on delete set null,
  distance numeric default 0,
  fare numeric default 0,
  duration_minutes int default 0,
  payment_status text default 'Pending', -- 'Pending' | 'Paid' | 'Cancelled'
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

-- DRIVER RUNS (PUJ/PUV corridor runs)
create table driver_runs (
  run_id uuid primary key default gen_random_uuid(),
  driver_id uuid references users(user_id) on delete cascade not null,
  driver_name text not null,
  plate text default '',
  capacity int default 0,
  route_id text references routes(route_id) on delete set null,
  route_name text default '',
  stops jsonb default '[]',
  fare numeric default 0,
  sample_fare boolean default true,
  reference text default '',
  status text default 'In progress', -- 'In progress' | 'Completed'
  started_at timestamptz default now(),
  ended_at timestamptz,
  stop_index int default 0,
  onboard int default 0,
  total_boarded int default 0,
  cash_fares numeric default 0,
  revision int default 1,
  events jsonb default '[]',
  created_at timestamptz default now()
);

-- STOP REQUESTS (passenger pickup requests along a route)
create table stop_requests (
  stop_id uuid primary key default gen_random_uuid(),
  route_id text references routes(route_id) on delete cascade,
  point jsonb not null,
  passenger_name text not null,
  user_id uuid references users(user_id) on delete cascade,
  created_at timestamptz default now()
);

-- VEHICLE LOCATIONS (high-frequency GPS)
create table vehicle_locations (
  loc_id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(vehicle_id) on delete cascade,
  driver_id uuid references users(user_id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz default now()
);

-- NOTIFICATIONS
create table notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id uuid references users(user_id) on delete cascade,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- REPORTS
create table reports (
  report_id uuid primary key default gen_random_uuid(),
  trip_id uuid references bookings(booking_id) on delete set null,
  reporter_name text not null,
  reporter_id uuid references users(user_id) on delete set null,
  details text not null,
  status text default 'open',
  created_at timestamptz default now()
);

-- AUDIT LOGS
create table audit_logs (
  log_id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(user_id) on delete set null,
  action text not null,
  at timestamptz default now()
);

-- DATA ANALYSIS (aggregated metrics)
create table data_analysis (
  data_id uuid primary key default gen_random_uuid(),
  route_id text references routes(route_id) on delete set null,
  date date not null,
  peak_hours jsonb default '[]',
  passenger_demand jsonb default '{}',
  route_utilization numeric default 0,
  avg_waiting_time_minutes numeric default 0,
  total_trips int default 0,
  created_at timestamptz default now()
);
```

### 9.2 Row-Level Security (RLS) policies

Enable RLS on all tables and create policies:

```sql
-- Enable RLS on all tables
alter table users enable row level security;
alter table drivers enable row level security;
alter table vehicles enable row level security;
alter table routes enable row level security;
alter table terminals enable row level security;
alter table terminal_schedules enable row level security;
alter table fare_matrices enable row level security;
alter table bookings enable row level security;
alter table trip_records enable row level security;
alter table driver_runs enable row level security;
alter table stop_requests enable row level security;
alter table vehicle_locations enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;
alter table audit_logs enable row level security;
alter table data_analysis enable row level security;

-- Example: users can read/update own profile
create policy "users_select_own" on users for select using (auth.uid() = user_id);
create policy "users_update_own" on users for update using (auth.uid() = user_id);

-- Example: admins can read all
create policy "admins_select_all_users" on users for select
  using (exists (select 1 from users where user_id = auth.uid() and role = 'Administrator'));

-- Example: franchise owners can read their vehicles
create policy "owners_select_vehicles" on vehicles for select
  using (owner_id = auth.uid() or exists (select 1 from users where user_id = auth.uid() and role = 'Administrator'));

-- Example: passengers can read their own bookings
create policy "passengers_select_bookings" on bookings for select
  using (passenger_id = auth.uid() or driver_id = auth.uid() or exists (select 1 from users where user_id = auth.uid() and role = 'Administrator'));

-- Example: drivers can update trip status
create policy "drivers_update_bookings" on bookings for update
  using (driver_id = auth.uid());

-- Repeat similar patterns for all tables based on role and ownership.
```

### 9.3 Indexes (for performance)

```sql
create index idx_bookings_passenger on bookings(passenger_id);
create index idx_bookings_driver on bookings(driver_id);
create index idx_bookings_status on bookings(status);
create index idx_driver_runs_driver on driver_runs(driver_id);
create index idx_vehicles_owner on vehicles(owner_id);
create index idx_vehicles_driver on vehicles(driver_id);
create index idx_stop_requests_route on stop_requests(route_id);
create index idx_notifications_user on notifications(user_id);
create index idx_audit_logs_actor on audit_logs(actor_id);
create index idx_vehicle_locations_vehicle on vehicle_locations(vehicle_id);
```

### 9.4 Seed data

Seed initial data via Supabase seed script or SQL:

```sql
-- Sample routes
insert into routes (route_id, name, destination, transport_type, fare, interval, starts_at, ends_at, active, approved, reference) values
  ('CB01', 'City Hall – Public Market', 'Public Market', 'PUJ / PUV', 13, 15, '06:00', '20:00', true, false, 'Static sample'),
  ('CB02', 'City Hall – Airport', 'Airport', 'PUJ / PUV', 20, 30, '06:00', '18:00', true, false, 'Static sample');

-- Sample terminals
insert into terminals (terminal_id, name, point, route_id, active) values
  ('CT01', 'Public Market terminal', '{"name":"Calbayog Public Market","latitude":12.06145,"longitude":124.61079}', 'CB01', true);

-- Sample landmarks (for search)
-- (store in a separate landmarks table or as part of routes/stops)
```

---

## 10. SRS Feature Coverage Check

Cross-referenced against `SRS -G4 - CS3A-UPD.docx` (Software Requirements Specification v1.0.0):

| SRS Feature (Section 4.1.1) | Priority | Prototype Status | Integration Notes |
|---|---|---|---|
| Signup / Login Authentication | High | ✅ Implemented (demo) | Replace with Supabase Auth + RLS |
| Tricycle Ride Request | High | ✅ Implemented | Point-to-point booking via `/book` |
| Route Management | High | ✅ Implemented | AdminPanel routes CRUD via `/configure` |
| Driver Ride Management | High | ✅ Implemented | Accept/decline, status updates, run completion |
| Fare Information and Transparency | High | ✅ Implemented | Fixed fare display before booking |
| Vehicle Location / Tracking | Medium | ⚠️ Simulated (demo toggle) | Replace with `expo-location` + Supabase Realtime |
| Terminal Location and Schedule | Medium | ✅ Implemented | Terminals tab + departure times |
| Trip Information | High | ✅ Implemented | Trip details, distance, waiting time, driver info |
| Data Analysis | High | ⚠️ Partial (chart only) | Populate `data_analysis` table; admin dashboard charts |
| Waiting Time Estimation | High | ⚠️ Simulated | Calculate from route data + vehicle location |
| Priority Queue (nearest driver) | High | ⚠️ Simulated | Implement nearest-driver matching via PostGIS or Haversine |

**SRS Non-Functional Requirements (Section 5):**
- **Performance**: Response time, concurrent users, DB performance, location updates → handled by Supabase + indexes.
- **Security**: RBAC, session management, data encryption → Supabase Auth + RLS + HTTPS.
- **Reliability**: Availability, data consistency, failure handling → Supabase SLA + graceful error handling in `action()`.
- **Software Quality**: Usability, maintainability, scalability, localization, portability → Expo + TypeScript + documented codebase.

**SRS Database Schema (Section 6.1) → Supabase tables:**
All 12 core tables + 1 analysis table are defined in Section 9 above, matching the SRS entity list: Users, Drivers, Vehicles, Bookings, Routes, Terminal, Terminal_Schedule, Fare_Matrices, Vehicle_Locations, Trip_Records, Data_Analysis, Audit_Logs.

---

## 11. Prompt Template (updated for integration)

> **Prompt:** "You are integrating a real backend (Supabase) and real map API into the Angkol Expo/React Native prototype. The project is at `C:\Users\alizz\Downloads\SoftEng\Angkol`. The current data layer is `src/services/api.ts` (in-memory). The data model is in `src/types/types.ts`. The SRS document is `SRS -G4 - CS3A-UPD.docx` (feature list + DB schema). The UI must be preserved exactly — only replace data-fetching, auth, map, and device-API internals. Follow the migration checklist in `INTEGRATION_PROMPT.md` (Sections 3, 7, 8, 9, 10). Create the Supabase schema from Section 9 first, then replace `api.ts` internals, then `MobileAuth.tsx` auth calls, then `StaticMap.tsx`. Run `tsc --noEmit` and `expo lint` after each step. Do not modify any `.tsx` UI files except to swap import sources. Do not delete prototype files until replacements are tested."

---

*Generated from the Angkol codebase and SRS v1.0.0. All file paths are relative to `C:\Users\alizz\Downloads\SoftEng\Angkol`.*

