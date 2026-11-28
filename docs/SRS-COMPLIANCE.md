# Angkol — SRS Compliance Audit

Audit of the implementation against `docs/SRS -G4 - CS3A-UPD.docx`
(readable text: `docs/SRS-extracted.txt`), version 1.0.0, dated September 15, 2026.

Legend: **MET** = implemented and traceable to code; **PARTIAL** = core behavior
exists but a stated detail is missing or manual; **NOT MET** = not implemented;
**OOS** = explicitly outside the SRS's initial scope (not a defect).

**Bottom line:** the implemented product satisfies the SRS's core scope —
authentication/roles, tricycle ride-hailing, fixed DB-backed fares, PUJ/PUV
tracking, terminals/schedules, driver management, admin configuration, audit
logging, and the full database schema. The remaining gaps are secondary:
the **Data Analysis** aggregation feature, a distinct **Developer** role, and
**login-attempt** auditing.

---

## 1. Feature description and priority (SRS 4.1.1)

| Priority | Feature | Status | Evidence |
|---|---|---|---|
| High | Signup / Login Authentication | MET | `src/auth/MobileAuth.tsx`, `src/auth/session.ts`, `handle_new_user()` trigger; roles seeded by `assigned_roles`. |
| High | Tricycle Ride Request | MET | `src/passenger/PassengerApp.tsx` journey/review flow; `prepare_booking()` inserts a `bookings` row. |
| High | Route Management | MET | `src/map/RouteDiagram.tsx`, Mapbox Directions, `routes.route_polyline`; driver sees pickup→destination path. |
| High | Driver Ride Management | MET | `src/driver/DriverApp.tsx` requests/accept/arrive/complete; `transition_booking()` enforces transitions; license + association stored on `drivers`. |
| High | Fare Information and Transparency | MET | `fare_matrices` → `quote_fare()` → `prepare_booking()` locks `calculated_fixed_fare`; fare shown before booking. |
| Medium | Vehicle Location / Tracking | MET | `src/services/location.ts` writes `vehicle_locations`; `RouteDiagram` + snapshot show live/stale vehicle positions. |
| Medium | Terminal Location and Schedule | MET | `terminals` table, Terminals screen, `src/domain/schedule.ts` (`nextDeparture`, `waitLabel`), route `startsAt`/`endsAt`/`interval`. |
| High | Trip Information | MET | Trip detail screens show distance, duration, driver, fare, timestamps; `trip_records` stores completion data. |
| High | Data Analysis (peak hours, wait estimates) | **PARTIAL** | `data_analysis` table exists but no code writes or reads it; admin computes *average wait* from live bookings only (`AdminDashboard.web.tsx`). Peak hours / demand heatmap / route utilization / efficiency are **not** computed. |
| High | Waiting Time Estimation | MET | `nextDeparture` / `waitLabel` for PUJ/PUV; passenger ETA from vehicle distance (`PassengerApp.tsx`); admin average wait. |
| High | Priority Queue (nearest available driver) | PARTIAL | Requests are broadcast to all available tricycle drivers and sorted nearest-first in `DriverApp.tsx` (`awayKm` sort). There is no exclusive auto-assign to the single nearest driver; first to accept wins (`transition_booking`). Documented as intentional in `docs/SUMMARY.md` §Data flow. |

---

## 2. Stimulus / response sequences (SRS 4.1.2)

| Sequence | Status | Evidence |
|---|---|---|
| Login | MET | `MobileAuth.tsx` sign-in; role-based routing in `src/app/index.tsx`. |
| Signup | MET | `MobileAuth.tsx` validation, `users` + `drivers` rows, pending-approval screen. |
| Update Profile | MET | Passenger `Edit profile` (`/profile`), driver/admin photo + details, `users.phone`/`contact_numbers`/`photo`. |
| View Terminal | MET | `PassengerApp.tsx` Terminals page over `terminals`. |
| View Schedule | MET | `src/domain/schedule.ts` + Terminals/Route screens. |
| Booking of Trip | MET | Journey → Review ride → confirm; `prepare_booking()`. |
| Accept Trip | MET | Driver requests list → `transition_booking(..., 'Accepted')`; passenger notified by `notify_booking_change()`. |
| View Vehicle Location | MET | `RouteDiagram` tracks the assigned driver's latest `vehicle_locations`/`drivers.current_*`. |
| View Total Fare | MET | Quote shown on Review ride before confirm; stored as `calculated_fixed_fare`. |
| View Near PUV/PUJ | MET | Routes screen search by route name/stops + live vehicle counts; Home shows nearby terminals. |
| Notify PUV/PUJ | MET | Supabase realtime on `bookings`/`notifications` (`AngkolApp.tsx`) refreshes status/locations. |
| View Trip Data | MET | Admin `Trips & reports`, `Fleet trip logs`, `System monitor` audit trail. |

---

## 3. Explicit requirements matrix (SRS 4.1.3)

| # | Requirement | Status | Evidence / note |
|---|---|---|---|
| 1 | Create account with registration information | MET | `MobileAuth.tsx` sign-up + `handle_new_user()`. |
| 2 | Access account after verifying information | MET | Supabase Auth session; app is gated behind sign-in. (Email confirmation intentionally disabled, per project constraint.) |
| 3 | Assign appropriate role to account | MET | `assigned_roles`; `src/domain/roles.ts`. |
| 4 | Driver role presents Tricycle vs PUJ/PUV | MET | `MobileAuth.tsx` `driverType` chooser → "Tricycle driver" / "PUJ / PUV driver". |
| 5 | Passenger sees all terminals and departure schedules | MET | Terminals screen + `nextDeparture`. |
| 6 | Request ride and pinpoint current location | MET | Map pin + geolocation (`PassengerApp.tsx`). |
| 7 | Point-to-point prompts exact location | MET | Journey pickup/destination flow. |
| 8 | Confirm displayed ride info before request | MET | "Review ride" step. |
| 9 | Create unique ride request record | MET | `bookings.booking_id uuid default gen_random_uuid()`. |
| 10 | Identify drivers whose status is Available | MET | `drivers.availability_status`, `is_approved_driver()`; request list filters `data.user.available`. |
| 11 | Find nearest available Tricycle driver | PARTIAL | Nearest-first sort for drivers; no single-driver auto-dispatch. First accept wins. |
| 12 | Driver refuses → automatically find another nearest driver | MET | `release_booking()` resets to `Requested`, clears driver, notifies passenger, re-enters pool. |
| 13 | Notify passenger when driver accepts | MET | `notify_booking_change()` trigger on `bookings`. |
| 14 | Display fare after pickup and destination | MET | `quote_fare()` / `calculated_fixed_fare`. |
| 15 | Driver updates status to Arrived | MET | `transition_booking()` + `DriverApp.tsx`. |
| 16 | Driver marks ride Completed | MET | `transition_booking()` → Completed; `trip_records` upsert. |
| 17 | Store completed ride info | MET | `bookings` + `trip_records` (passenger, driver, pickup/dropoff, fare, timestamps). |
| 18 | Search PUJ/PUV routes by route or destination | PARTIAL | `PassengerRoutesScreen` searches route name + stop names (stops act as destinations). Recent-destination shortcuts exist on Home (`passengerScreens.tsx`), but the route list does not filter by a chosen destination. |
| 19 | Estimate waiting time before PUJ/PUV arrives | MET | `nextDeparture` / `waitLabel` / `minutesUntil`. |
| 20 | Determine path of nearest PUJ/PUV route; passengers navigate and wait | PARTIAL | Route polyline and live vehicles are shown, but there is no turn-by-turn navigation and route choice is manual, not auto-nearest. |
| 21 | Display configured PUJ route stops and route info | MET | Route detail screens read `routes.stops`. |
| 22 | Display latest available vehicle location | MET | Realtime `vehicle_locations` / vehicle `current_lat/lng`. |
| 23 | Indicate when location is unavailable/stale | MET | `stale` flag (GPS older than ~2 min) in snapshot + admin "Location alerts". |
| 24 | Drivers change availability | MET | `/availability` action; `DriverApp.tsx` toggle. |
| 25 | Detect current vehicle location | MET | `src/services/location.ts` GPS watch. |
| 26 | Admin add/modify/deactivate PUJ routes | MET | Admin `Routes & fares` → `/configure` (`type:"route"`) + `type:"toggle"`. |
| 27 | Admin add/modify/deactivate terminals | MET | Admin `/configure` (`type:"terminal"`) + `type:"toggle"` on `terminals`. |
| 28 | Authorized admins configure fares | MET | `/configure` (`type:"fare"`) → `fare_matrices`; `is_admin()` guards writes. |
| 29 | Authorized admins view ride records and reports | MET | `Trips & reports`, `Fleet trip logs`, `reports` handling. |
| 30 | Display calculated data for administrator assessment only | PARTIAL | Admin-only metrics + audit trail exist; the dedicated `data_analysis` dataset is not surfaced. |

---

## 4. Non-functional requirements (SRS 5.x)

| Area | Status | Notes / evidence |
|---|---|---|
| 5.1 Response time | MET (by design) | Supabase indexed queries, RPCs, realtime; no load test evidence in repo. |
| 5.1 Concurrent users | MET (architecture) | Client/server split with Supabase; not load-tested here. |
| 5.1 Database performance | MET | Indexes in `20261121032331_rls_performance.sql`; bounded `.limit()` reads. |
| 5.1 Location updates | MET | Periodic GPS share + realtime refresh; stale detection. |
| 5.2 Access control | MET | Role checks in RLS + `is_admin` / `is_approved_driver` / `can_manage_user`. |
| 5.2 Session management | MET (delegated) | Supabase JWT/session persistence (`src/auth/session.ts`). |
| 5.2 Data encryption | MET (delegated) | HTTPS to Supabase/Mapbox; private `driver-documents` bucket with signed URLs. At-rest encryption is Supabase-managed. |
| 5.3 Availability | PARTIAL | Depends on Supabase/Mapbox availability; no in-repo SLA or monitoring. |
| 5.3 Data consistency | MET | `transition_booking()` row locks + guarded status transitions; atomic fare lock. |
| 5.3 Failure handling | MET | Offline/stale indicators, `ErrorBoundary`, user-facing error text, fallback map geometry. |
| 5.4 Usability | MET | Mobile-first Expo app + responsive web admin. |
| 5.4 Maintainability | MET | Folder structure, typed domain modules, tests, and `docs/FILE_DATABASE_MAP.md`. |
| 5.4 Scalability | MET (architecture) | Managed Postgres + stateless client; no capacity testing. |
| 5.4 Localization | PARTIAL | PH peso formatting and Calbayog place names; no multi-language i18n. |
| 5.4 Portability | MET | iOS/Android via Expo + web admin via Expo web. |

---

## 5. Database schema requirements (SRS 6.1)

All SRS core tables exist in `supabase/migrations/`:

| SRS table | Implemented as | Status |
|---|---|---|
| User | `users` | MET |
| Driver | `drivers` (license, classification, availability, association, verification) | MET |
| Vehicle | `vehicles` (plate, body number, capacity, `driver_id`, `routes_id`) | MET |
| Booking | `bookings` (pickup/dropoff, fixed fare, status, `user_id`, `driver_id`) | MET |
| Routes | `routes` (name, polyline, start/end, LTFRB definition, stops) | MET |
| Terminal | `terminals` | MET |
| Terminal_Schedule | `terminal_schedules` | Table exists; the UI derives departures from route `startsAt`/`endsAt`/`interval` instead. Functionally met, table unused. |
| Fare_Matrices | `fare_matrices` (base, per-km, included km, tier, classification, active) | MET |
| Vehicle_Locations | `vehicle_locations` | MET |
| Trip_Records | `trip_records` (distance, duration, payment status, timestamps, rating) | MET |
| Data_Analysis | `data_analysis` | Table exists; **no producer/consumer** in app code. |
| Audit_Logs | `audit_logs` (booking + user changes via triggers) | MET (see gap: login attempts) |

Supporting tables beyond the SRS ERD: `driver_runs`, `driver_run_events`,
`stop_requests`, `reports`, `notifications`, `landmarks`.

Data integrity is enforced with primary keys, foreign keys, check constraints
(e.g. `operational_classification`, `service_type`, rating 1–5), unique
constraints (`drivers.user_id`, `bookings.trip_records.booking_id`,
`vehicles.plate_number`), and RLS.

---

## 6. Gaps and recommended next steps

Ordered by how directly the SRS names them.

1. **Data Analysis (High, SRS 4.1.1 / 4.1.3 #30).**
   Add a scheduled aggregation (SQL function or `pg_cron`) that fills
   `data_analysis` from `bookings`/`trip_records` — peak hours, demand heatmap,
   route utilization, operational efficiency — and render it on an admin
   "Analytics" panel. Today only an average-wait metric is computed live.

2. **Developer role (SRS 2.1 / 5.2).**
   Roles today are Passenger, Tricycle driver, PUJ/PUV driver, Administrator,
   Vehicle Owner/Operator. Add a `Developer` role (or document that
   Administrator covers developers) and include it in access-control language.

3. **Login-attempt auditing (SRS 6.1 Audit_Logs).**
   `audit_logs.login_attempt_status` exists but nothing writes it. Supabase Auth
   owns sign-in; either log attempts via an edge function/Auth hook or narrow the
   SRS claim to administrative/data changes.

4. **`terminal_schedules` table is unused (SRS 6.1).**
   Either have the admin schedule editor write `terminal_schedules` (and read
   departures from it) or document that schedule data intentionally lives on
   `routes` (`starts_at`, `ends_at`, `interval_minutes`).

5. **Priority-queue semantics (SRS 4.1.3 #11 / 4.1.1).**
   Current model is nearest-first broadcast with first-accept. If the SRS is read
   as exclusive auto-dispatch, add a dispatch function that offers the request to
   the nearest available driver only, with a timeout before widening.

6. **PUJ/PUV navigation (SRS 4.1.3 #20).**
   Route geometry is displayed but there is no turn-by-turn navigation. Clarify in
   the SRS that "navigate" means visual route guidance, or add directions steps.

7. **Operational NFRs (SRS 5.3).**
   Availability target and backup policy are deployment concerns. Document the
   Supabase plan's backup/retention and a target availability figure.

---

## 7. How this was verified

- Static trace of every SRS feature to `src/` screens/services and `supabase/`
  migrations (see also `docs/FILE_DATABASE_MAP.md`).
- `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` (20/20), and the Jest
  suite (602 tests) pass.
- Live Supabase/Mapbox behavior was **not** exercised here because `.env` holds
  placeholder credentials; DB/RLS claims were verified by reading the migrations.
