# Angkol — File / Folder ↔ Database Map

This document explains **what each file and folder does, and which database object
it reads or writes**. It is checked against the Software Requirements Specification
(`docs/SRS -G4 - CS3A-UPD.docx`). The database source of truth is
`supabase/migrations/`; a plain-text extract of the SRS is in
`docs/SRS-extracted.txt`.

SRS section numbers below refer to the extracted SRS:

- **SRS 4.1.1** — feature list and priorities (auth, ride request, route management,
  driver ride management, fare transparency, tracking, terminals, trip information,
  data analysis, waiting time, priority queue).
- **SRS 4.1.2** — stimulus/response sequences.
- **SRS 4.1.3** — explicit requirements matrix.

## Quick rules

1. The UI never talks to Postgres directly. Screens call `src/services/api.ts`
   (plus a few focused services such as `documents.ts` and `location.ts`).
2. Every ride, fare, route, terminal, user, driver and vehicle value comes from a
   Supabase table or RPC. There is no parallel hard-coded data source in live mode.
3. Row Level Security (RLS) is the real access control. A hidden button is not
   security; the migration policies and `security definer` functions are.
4. The app only uses Supabase + Mapbox and exactly three env vars:
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.

---

## Root files

| File | Role | Database link |
| --- | --- | --- |
| `app.json` / `app.config.*` | Expo app config, permissions, web output. | None. |
| `package.json` | Scripts (`start`, `typecheck`, `lint`, `test`, `build:web`, `emulate:*`). | None. |
| `.env` | The three public Supabase/Mapbox values. | Credentials used by `src/services/supabase.ts`. |
| `supabase/config.toml` | Local Supabase CLI settings (if present). | Applies migrations/seeds. |
| `docs/SRS-extracted.txt` | Readable text of the SRS for traceability. | None. |

---

## `src/app/` — Expo Router entry points

Every file here is a route. `_layout.tsx` defines the stack.

| File | Role | Database link |
| --- | --- | --- |
| `_layout.tsx` | Root navigator and fonts. | None. |
| `index.tsx` | Restores the session, loads the snapshot, then picks Passenger / Driver / Admin. | Reads the whole snapshot through `src/services/api.ts` (`my_profile`, users, drivers, bookings, etc.). |
| `sign-in.tsx` | Sign-in / sign-up route wrapper. | Supabase Auth via `src/auth/session.ts`. |
| `reset-password.tsx` | Password reset screen. | Supabase Auth via `requestPasswordReset`. |
| `capture.tsx` | Dev-only screenshot scenes (`/capture?scene=...`). | Uses `src/testing/captureScenes.ts` sample data, not the live DB. |

**SRS 4.1.1 / 4.1.3:** role-based access after login (Signup/Login Authentication).

---

## `src/auth/` — accounts and sessions

| File | Role | Database link |
| --- | --- | --- |
| `Auth.tsx` | Chooses the welcome / mobile auth experience. | Auth only. |
| `WelcomeScreen.tsx` | Marketing / entry screen. | None. |
| `MobileAuth.tsx` | Sign-in and multi-step sign-up; collects driver license, franchise, plate, capacity and optional license photo. | `auth.users` (Supabase Auth), then `public.users` and `public.drivers` via the `handle_new_user` trigger. Sets `drivers.license_doc_attached`. |
| `ResetPassword.tsx` | Reset-password UI. | Supabase Auth. |
| `session.ts` | `registerAccount`, `signInAccount`, `restoreSession`, `clearSession`, `requestPasswordReset`. | Supabase Auth; `public.users`, `public.drivers` metadata. |
| `session.test.ts` | Tests the registration/session contract. | Mocks Auth + inserts. |

**SRS 4.1.1 / 4.1.3:** account creation, role assignment, two driver types.
**License check (SRS 4.1.1 Driver Ride Management):** the photo is stored in the
`driver-documents` Storage bucket as `license/<user_id>.jpg`; the driver row only
records `license_doc_attached = true`.

---

## `src/services/` — the only database boundary

| File | Role | Tables / functions |
| --- | --- | --- |
| `supabase.ts` | Creates the Supabase client from the two public env vars. | Client only. |
| `api.ts` | Central “API”: loads the snapshot and implements every action endpoint (`/quote`, `/book`, `/book-puj`, `/trips/...`, `/drivers/...`, `/configure`, `/profile/photo`, `/documents/license/...`, `/fares`, admin actions). | `users`, `drivers`, `vehicles`, `routes`, `terminals`, `terminal_schedules`, `fare_matrices`, `bookings`, `trip_records`, `driver_runs`, `driver_run_events`, `stop_requests`, `reports`, `notifications`, `landmarks`, `audit_logs`; RPCs `quote_fare`, `prepare_booking` (trigger), `transition_booking`, `release_booking`, `rate_booking`, `my_profile`, `admin_users`, `admin_drivers`, `start_run`, `advance_run`, `delete_my_account`; Storage `driver-documents`. |
| `mappers.ts` | Converts raw Postgres rows into typed app models (`User`, `Driver`, `Trip`, `Route`, `Vehicle`, `Terminal`). | Read-only view of the tables above. |
| `documents.ts` | Picks, stores, decodes and uploads driver-license photos. Keeps a pending photo in AsyncStorage until the driver can sign in. | Storage `driver-documents` + `drivers.license_doc_attached`. |
| `location.ts` | Requests foreground GPS, checks the 30 km service area, and streams driver positions. | Writes `drivers.current_lat/current_lng/location_updated_at`, `vehicles.current_lat/current_lng/location_updated_at`, and `vehicle_locations`. |
| `mapbox.ts` | Geocoding, reverse geocoding, directions and route geometry. | None (external Mapbox). |
| `routeGeometry.ts` | Cleans Mapbox lines (dedupe, remove spurs/U-turns/loops) and joins route ends to the real pickup/drop-off. | None (pure functions). |
| `previewActions.ts` | Share / link / image-picker helpers that work in preview and web. | None. |

**Fare trace (SRS 4.1.1 Fare Information and Transparency, SRS 4.1.3 “configure
applicable fare information”):**

1. Admin saves base fare + per-km in `AdminPanel` → `api("/configure", {type:"fare"})`.
2. `api.ts` updates the active tricycle row in `fare_matrices`
   (`vehicle_classification = 'Tricycle'`, `routes_id is null`), or upserts it.
3. `snapshot()` reads `fare_matrices` and sets `Snapshot.baseFare` / `perKm`, so the
   admin/owner panel and passenger fare labels immediately show the new values.
4. A passenger quote calls `quote_fare(distance, 'Tricycle')`, which reads
   `fare_matrices` (`base_fare + max(0, km − included_km) × per_kilometer_rate`).
5. The booking insert trigger `prepare_booking()` calls `quote_fare` again and
   locks `bookings.calculated_fixed_fare`, so a booked ride is not repriced.
6. PUJ/PUV fares are read per route from `fare_matrices` (or `routes.fare` fallback)
   and also locked by `prepare_booking()`.

**Ride-state trace (SRS 4.1.1 Driver Ride Management, SRS 4.1.3 356–368):**

`/book` inserts a `bookings` row → trigger `prepare_booking()` validates the
passenger, service area, distance and fare → drivers see `Requested` bookings →
`transition_booking` enforces `Requested → Accepted → Arrived → In progress →
Completed` (or `Cancelled` / `Expired`) and writes `bookings.timestamps` and
`trip_records`. `release_booking` returns a declined request to the pool.

---

## `src/domain/` — pure business rules

| File | Role | Database link |
| --- | --- | --- |
| `format.ts` | Money, phone, status labels. | None. |
| `roles.ts` | Role checks, active-trip helpers. | Mirrors `users.assigned_roles` values. |
| `schedule.ts` | Next departure / wait calculations. | Mirrors `terminal_schedules` fields. |
| `serviceArea.ts` | Client-side Calbayog bounds. | Mirrors `in_service_area()` in SQL. |
| `vehicles.ts` | Vehicle naming/capacity helpers. | Mirrors `vehicles`. |

**SRS 4.1.1:** waiting-time estimation, terminal schedule, driver classification.

---

## `src/passenger/` — commuter app

| File | Role | Database link |
| --- | --- | --- |
| `PassengerApp.tsx` | Home, journey, quote, booking, searching, tracking, drop-off, payment, receipt, PUJ seat flow, trips, routes, terminals, profile. | Snapshot + `/quote`, `/book`, `/book-puj`, `/trips/...`, `/stops`, `/profile`. Reads `bookings`, `routes`, `terminals`, `terminal_schedules`, `vehicles`, `drivers`, `stop_requests`, `notifications`. |
| `passengerScreens.tsx` | Reusable screens such as `PassengerProfileScreen`; shared with the driver profile look. | `users.photo/name/phone`, trips for stats. |
| `passengerStyles.ts` | Shared colors and text styles. | None. |
| `SearchCountdown.tsx` | 10-minute request expiry countdown. | Mirrors `bookings.expires_at`. |
| `RateTrip.tsx` | Post-trip rating. | `bookings.rating` via `rate_booking`. |
| `Ticket.tsx` | PUJ seat ticket. | `bookings` (PUJ/PUV seat rows) + `vehicles`. |

**SRS 4.1.1 / 4.1.3:** point-to-point tricycle request, confirm-before-book, view
fixed fare, see terminals/schedules, track vehicle, notify driver acceptance.
**Map note:** the route line is drawn from `bookings.route_polyline` or a route's
`routes.route_polyline`/stops when present, falls back to pickup→destination when it is
missing, draws an approach line to the only visible vehicle while a driver is on the way,
and (while tracking) fades the already-driven portion instead of leaving the whole path on screen.

---

## `src/driver/` — driver app

| File | Role | Database link |
| --- | --- | --- |
| `DriverApp.tsx` | Dashboard, requests, active trip, route run, earnings, records, profile, account/security. | `bookings`, `driver_runs`, `driver_run_events`, `vehicles`, `stop_requests`, `users.photo`. Actions `/trips/...`, `/runs/...`, `/profile/photo`, `/drivers/:id`. |
| `DriverPending.tsx` | Pending/declined application screen; captures or replaces the license photo. | `drivers.license_doc_attached`; Storage `driver-documents`. |

**SRS 4.1.1 / 4.1.3:** accept/decline requests, update arrival and completion,
availability toggle, fare display, driver information. The profile header now
matches the passenger layout (avatar with camera badge, name, subtitle) and the
body number sits centered directly below the photo.

---

## `src/admin/` — web dashboard and owner console

| File | Role | Database link |
| --- | --- | --- |
| `AdminDashboard.tsx` | Native/web-switching props and fallback. | None. |
| `AdminDashboard.web.tsx` | Web dashboard: overview, fleet, people, verification queue, routes/terminals/fares, trips/reports, system, account, pending driver review (including license photo). | Snapshot + `admin_users` / `admin_drivers`, `bookings`, `routes`, `terminals`, `terminal_schedules`, `fare_matrices`, `reports`, `audit_logs`, `users.photo`, Storage `driver-documents`. |
| `AdminPanel.tsx` | Editor for routes, terminals and tricycle fare rules. | `routes`, `terminals`, `terminal_schedules`, `fare_matrices` via `/configure`. |
| `adminDashboardStyles.ts` | Dashboard CSS-in-JS (avatars, tables, schedules, account actions). | None. |

**SRS 4.1.3:** admins add/modify/deactivate routes and terminals, configure fares,
view ride records and reports. The “Verification queue” and the owner’s “Pending
driver approvals” both open a detail view; the driver license photo is fetched from
`/documents/license/:userId` (signed URL) and rendered there.

---

## `src/common/` — shared UI and helpers

| File | Role | Database link |
| --- | --- | --- |
| `ui.tsx` | `Button`, `Icon`, `Field`, `Choice`, cards. | None. |
| `Avatar.tsx` | Circle photo or initials from `users.name`. | Reads `User.photo`. |
| `initials.ts` | `Karen Davila → KD`. | None. |
| `DriverAvatar.tsx` | Driver avatar with shared initials. | Reads `Trip.driverPhoto` / driver name. |
| `BodyNumber.tsx` | Painted body number (tricycle) or LTO plate (jeepney). | Reads `Vehicle.plate` / driver plate. |
| `Glyph.tsx` | Vehicle/route/terminal/status glyphs. | None. |
| `BrandLogo.tsx`, `styles.ts` | Brand and text styles. | None. |
| `RouteBoard.tsx` | Pickup → destination summary. | Reads trip/quote names. |
| `confirmAccountDeletion.ts` | Confirmation dialog before deletion. | Calls `delete_my_account`. |
| `useAppActive.ts`, `useNow.ts` | Foreground polling and clock hooks. | None. |
| `haptics.ts` | Haptics wrappers. | None. |

**SRS 4.1.2:** profile update display, trip information display, body-number
identification (driver information).

---

## `src/map/` — map rendering

| File | Role | Database link |
| --- | --- | --- |
| `CalbayogMap.tsx` | Public map component used by all apps. | Receives data from screens. |
| `RouteDiagram.tsx` | SVG map: Mapbox tiles when configured, otherwise paper; draws route, stops, vehicles, terminals, people, labels, pin mode, pan/zoom. | Reads `bookings.route_polyline` (via `geometry`), `routes.route_polyline`, `vehicles`, `terminal_schedules` display data. |
| `geo.ts` | Mercator math, camera fitting, tile selection. | None. |
| `mapGestures.ts` | Pan/pinch/double-tap/wheel gestures. | None. |
| `mapTypes.ts` | `MapProps`. | None. |
| `roadKey.ts` + `roads.json` | Pre-sampled road geometry lookup for common routes. | Generated from Mapbox Directions/OSRM, no DB link. |
| `useMyLocation.ts` | Device location hook. | Reads device GPS; not the database. |

**SRS 4.1.1 / 4.1.3:** show route, nearest path, latest vehicle location, and
indicate stale/unavailable location. Stale positions are drawn faded and labelled.

---

## `src/types/` and `src/testing/`

| File | Role | Database link |
| --- | --- | --- |
| `types/types.ts` | Shared models (`User`, `Driver`, `Vehicle`, `Trip`, `Route`, `Terminal`, `Snapshot`, …). | A TypeScript mirror of the tables and RPC payloads. |
| `testing/captureScenes.ts` | Fictional data used by `/capture`. | None (deliberately offline sample data). |
| `testing/fixtures.ts` | Test data builders. | None. |

---

## `src/__tests__/` and `src/**/__tests__/`

Screen and service tests. They mock Supabase with `supabaseFake.ts` and assert the
contract between UI, `api.ts`, mappers and the SQL behaviour described in the
migrations. They are not run against the live database.

---

## `supabase/migrations/` — database source of truth

| Migration | Purpose | Main objects |
| --- | --- | --- |
| `20261121030959_initial_schema.sql` | Base schema, RLS, `my_profile`, `my_role`, `is_admin`, `quote_fare`, `transition_booking`, `release_booking`, seeds for fares/routes/landmarks. | All core tables (`users`, `drivers`, `vehicles`, `routes`, `terminals`, `terminal_schedules`, `fare_matrices`, `bookings`, `trip_records`, `vehicle_locations`, `driver_runs`, `stop_requests`, `reports`, `notifications`, `landmarks`, `audit_logs`, `data_analysis`). |
| `20261121031053_security_hardening.sql` | Hardens functions, adds admin RPCs and driver approval checks. | `admin_users`, `admin_drivers`, `is_approved_driver`, `handle_new_user`. |
| `20261121031152_lock_internal_functions.sql` | Revokes direct execution of internal triggers/functions. | Function grants. |
| `20261121032331_rls_performance.sql` | Indexes used by RLS. | Indexes on `bookings`, `drivers`, `fare_matrices`, etc. |
| `20261121032350_puj_vehicle_assignment.sql` | PUJ seat/vehicle assignment. | `prepare_booking`, `vehicles`, `bookings`. |
| `20261121040000_delete_my_account.sql` | Self-service account deletion. | `delete_my_account`, cascade cleanup. |
| `20261121143448_sync_driver_verification.sql` | Keeps driver approval in sync with user status. | `drivers.verified`, `users.application_status`. |
| `20261121143512_guard_driver_runs.sql` | Protects run/route transitions. | `driver_runs`, `driver_run_events`. |
| `20261121143513_exclude_decommissioned_vehicles.sql` | Decommissioned vehicles never match rides. | `prepare_booking`, `vehicles`. |
| `20261121143626_driver_license_documents.sql` | Private `driver-documents` bucket + owner/admin access. | Storage bucket and policies. |
| `20261121143711_fix_seed_coordinates.sql` | Corrects demo coordinates inside Calbayog. | Seed data. |
| `20261121145720_ride_lifecycle_and_safety.sql` | Booking lifecycle, safety reports, driver-run events, notifications. | `transition_booking`, `release_booking`, `reports`, `driver_run_events`, `notifications`. |
| `20261121145836_grant_policy_helpers.sql` | Grants policy helper functions. | `my_role`, `is_admin`, `is_approved_driver`. |
| `20261121145940_allow_expired_status.sql` | Allows the `Expired` booking status. | `bookings.request_status`. |
| `20261121152213_concurrency_and_payment.sql` | Atomic acceptance, trip records, payment status, driver GPS columns. | `transition_booking`, `trip_records`, `drivers.current_lat/current_lng`, `vehicle_locations`. |
| `20261123090000_notification_links_and_puj_seats.sql` | Links notifications to bookings and finishes PUJ seat handling. | `prepare_booking`, `transition_booking`, `notifications`, `bookings`. |
| `20261126090000_fix_obrero_coordinates.sql` | Corrects the CB01 Obrero stop/end point, landmark, stored booking drop-off and run stops to 12.0671, 124.5903. | `routes`, `landmarks`, `bookings`, `driver_runs`. |
| `seed.sql` | Fictional Calbayog accounts, vehicles, routes, trips, notifications. | All tables (test data only). |
| `seed_authfix.sql` | Promotes demo admin/owner roles and approves demo drivers. | `users.assigned_roles`, `users.admin_level`, `drivers.verified`. |

**SRS 4.1.3 database requirements:** unique ride records (`bookings`), completed
ride history (`trip_records`), role-based access (RLS), fare configuration
(`fare_matrices`), route/terminal management, and admin-only reports/analysis
(`data_analysis`, `audit_logs`).

---

## `scripts/`

| Folder / file | Role | Database link |
| --- | --- | --- |
| `scripts/capture/` | Dev-only browser screenshots and `roads.json` generation. | None at runtime. |
| `scripts/emulator/drivers.mjs` | Simulated tricycle drivers: sign in with real approved test accounts, go online, accept `Requested` tricycle bookings, drive to pickup, wait for boarding, drive the booked route, complete at drop-off. | `drivers.availability_status`, `drivers.current_lat/current_lng`, `vehicles.current_lat/current_lng`, `bookings`, RPC `transition_booking`. |
| `scripts/emulator/pujs.mjs` | Simulated jeepneys: park at terminals, follow the assigned route, board/drop off PUJ seat bookings, repeat runs. | `vehicles`, `routes`, `bookings`, `stop_requests`, `driver_runs`. |
| `scripts/emulator/README.md` | How to run both emulators. | — |

### Can simulated drivers pick up real users?

**Yes.** `findRequest()` reads **all** `bookings` rows with
`request_status = 'Requested'` and `service_type = 'Tricycle'` (oldest first). It is
not tied to the emulator’s own user id, so a booking created from a real passenger
phone is eligible. The emulator then calls the same `transition_booking` RPC a human
driver uses, so Supabase enforces:

- the account is an approved, available tricycle driver,
- the booking is not already taken by another driver,
- the driver has no other active ride.

If two emulators race for one request, the database accepts only one; the loser
logs a skip and polls again.

**Known limitation:** the demo emulators accept any eligible request regardless of
distance, so they may “teleport” toward a pickup outside their current area. That is
intentional for demos; a production dispatcher would filter by proximity and
availability.

### Running two devices on localhost

Both devices talk to the **same** Supabase project, so the flow works across
phones, browsers and simulators at once:

1. Put the three keys in `.env` on the dev machine (they are public client keys).
2. Start Expo with a reachable host: `npx expo start --lan` (same Wi-Fi) or
   `npx expo start --tunnel` (different networks). Do not use `localhost` as the
   API host from a phone; the phone’s `localhost` is the phone.
3. Sign in on device A as a **passenger** account and on device B as an **approved
   tricycle driver** account (or run `npm run emulate:drivers`).
4. Optional: run `npm run emulate:drivers` on the dev machine; the emulated driver
   will accept the passenger’s request and drive the booked route. The passenger
   device updates through the normal snapshot polling / realtime refresh.
5. Web admin/owner runs at the same Expo web URL or a static export; it shares the
   same Supabase data.

---

## SRS coverage checks

| SRS area | Where it lives | Status / note |
| --- | --- | --- |
| Signup / login / roles (4.1.1, 4.1.3) | `src/auth/*`, `users`, `handle_new_user` | Met. Admin roles are SQL-promoted, not chosen at sign-up. |
| Tricycle ride request + confirmation (4.1.1, 4.1.3) | `PassengerApp`, `/quote`, `/book`, `prepare_booking` | Met. |
| Fare transparency + admin fare config (4.1.1, 4.1.3) | `AdminPanel`, `/configure`, `fare_matrices`, `quote_fare` | Met; admin saves are DB-backed and propagate to new quotes/bookings. |
| Driver ride management + license check (4.1.1, 4.1.3) | `DriverApp`, `DriverPending`, `documents.ts`, `driver-documents` bucket | Met; license photo is captured at sign-up (or before approval) and visible to admin/owner reviewers. |
| Route management / nearest path (4.1.1, 4.1.3) | `mapbox.ts`, `routeGeometry.ts`, `RouteDiagram.tsx` | Met; route line is cleaned, always falls back when geometry is missing, and clears behind a tracked driver. |
| Vehicle location / tracking (4.1.1, 4.1.3) | `location.ts`, `drivers` GPS columns, `vehicle_locations`, `RouteDiagram` | Met; stale positions are shown as stale, not silently hidden. |
| Terminal location and schedule (4.1.1, 4.1.3) | `PassengerApp`, `terminal_schedules`, `schedule.ts` | Met; schedules are read from the DB. |
| Trip information / history (4.1.1, 4.1.3) | `bookings`, `trip_records`, receipt screens | Met. |
| Data analysis / admin reports (4.1.1, 4.1.3) | `AdminDashboard`, `data_analysis`, `audit_logs` | Partly met; the dashboard shows trip/report data, while demand heatmaps are not yet implemented. |
| Priority queue / nearest driver (4.1.1, 4.1.3) | `release_booking`, trip request list ordering | Partly met; matching is broadcast “nearest first”, not exclusive auto-dispatch. |
| Online payments (SRS 1.3 out of initial scope) | `bookings.payment_method`, `trip_records.payment_status` | Cash is used; demo/test payment is clearly marked and not a real charge. |
