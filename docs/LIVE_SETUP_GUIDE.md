# Angkol live setup guide

This guide covers every structure added when the app moved from the bundled
prototype to live Supabase + Mapbox services. The UI, navigation, colors, and
sign-in screens are unchanged.

---

## 1. Architecture

```
Expo screens (src/passenger, src/driver, src/admin, src/auth)
        │  api("/endpoint", body)          ← same calls as before
        ▼
src/services/api.ts  (adapter)
        ├── src/services/supabase.ts      → Supabase Auth + Postgres + Realtime
        ├── src/services/mapbox.ts        → Static map / Directions / Geocoding
        └── src/services/location.ts      → expo-location GPS writer
```

- Screens never import `@supabase/supabase-js` directly.
- `api()` keeps its exact signature, so no screen had to be rewritten.
- `api("/state")` returns the same `Snapshot` type as the prototype, built from
  live tables.

---

## 2. Prerequisites

- Node 20+ and npm
- An Expo Go app or a development build
- A Supabase project (free tier is enough)
- A Mapbox account (free tier is enough)

```bash
npm install
```

---

## 3. Environment variables

Create `.env` from `.env.example`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.<token>
```

Only these three variables are used. `.env` is git-ignored. Restart Expo after
changing values.

| Variable | Where to find it |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox → Account → Access tokens (public token) |

`src/services/supabase.ts` validates the values. If they are blank or still the
template, the app shows a configuration error instead of silently using sample
data.

---

## 4. Supabase setup

### 4.1 Create the project

1. Create a project at <https://supabase.com/dashboard>.
2. Open **Authentication → Sign In / Providers → Email** and turn **Confirm
   email** off. This lets registration sign the user in immediately.
3. Copy the Project URL and anon key into `.env`.

### 4.2 Run the schema

Apply the files in [`supabase/migrations/`](../supabase/migrations) in filename
order, either with `npx supabase db push` or by pasting each one into the
**SQL Editor**. Never edit a migration that has already been applied; add a new
file instead.

It creates:

- every table listed in section 7
- the `handle_new_user` trigger that copies registration metadata into
  `public.users` and `public.drivers`
- row-level security (RLS) policies
- `quote_fare`, `transition_booking`, and `rate_booking` RPCs
- guard triggers that stop users from promoting themselves
- Calbayog routes, terminals, landmarks, and fare-matrix seed rows
- Realtime publication entries for `bookings`, `vehicle_locations`, and
  `notifications`

The security migration also makes the database the source of truth: sign-up
can only create commuter or driver accounts, fares are computed server-side,
booking status changes follow fixed rules, and other users' email, birthday,
and license details are hidden. Admins read full profiles through the
`admin_users` and `admin_drivers` RPCs.

### 4.3 Create an administrator

Register a normal account in the app first (any role), then run one of these in
the SQL editor:

```sql
-- Technical team administrator
update public.users
set assigned_roles = array['Administrator'],
    admin_level = 'Technical Team',
    verified = true,
    application_status = 'accepted'
where email = 'admin@example.com';
```

```sql
-- Franchise owner / vehicle operator
update public.users
set assigned_roles = array['Vehicle Owner / Operator'],
    admin_level = 'Franchise Owner',
    franchise_name = 'Calbayog Metro Express',
    verified = true,
    application_status = 'accepted'
where email = 'owner@example.com';
```

Sign in with that account on the **web** build (`npm run web`). Administrators
and vehicle owners cannot use the mobile registration sheet; they use the web
portal sign-in screen.

### 4.4 Realtime (optional verification)

Realtime is already added to the publication by the schema. Confirm under
**Database → Replication** that `bookings`, `vehicle_locations`, and
`notifications` are enabled. `AngkolApp` refreshes the snapshot when a booking
or notification row changes.

Every booking status change now writes an in-app notification for the passenger
and an `audit_logs` row. Admin verification/role changes are also audited. No
extra setup is needed.

---

## 5. Mapbox setup

1. Create a token at <https://account.mapbox.com/access-tokens/>. The default
   public token works.
2. The token needs these scopes:
   - `styles:tiles` and `styles:read` for Static Images
   - `geocoding` for place search and reverse geocoding
   - `directions` for route distance, ETA, and the route line
3. Put it in `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.

The map is rendered with the **Static Images API**, so no native map module or
development build is required. A tap is projected back to latitude/longitude
using the same bounding box that requested the image, then reverse geocoded.

If the token is missing, `StaticMap` falls back to the bundled
`assets/calbayog-map.png`, and booking reports a clear Mapbox configuration
error.

---

## 6. Run, test, and build version 1

### 6.1 Fastest live demo — Expo Go (both phones)

1. Install **Expo Go** from the Play Store (Android) or App Store (iOS).
2. On the computer: `npx expo start` (keep `.env` filled in).
3. Put both phones on the same Wi-Fi as the computer, open Expo Go, and scan
   the QR code. Android scans inside Expo Go; iOS uses the Camera app.
4. If the LAN QR does not connect, run `npx expo start --tunnel` and scan again.

Expo Go already contains `expo-location`, `expo-image-picker`, and the rest of
this app's native modules, so no custom build is required for the demo.

### 6.2 Standalone Android APK (recommended "version 1" demo)

`eas.json` ships a `preview` profile that produces an installable `.apk`.

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure        # links the Expo project once
npx eas-cli@latest env:create --environment preview \
  --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxx.supabase.co" --visibility plaintext
npx eas-cli@latest env:create --environment preview \
  --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --visibility plaintext
npx eas-cli@latest env:create --environment preview \
  --name EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN --value "pk..." --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
```

EAS prints a build page and QR code. Download the APK on the phone, allow
"install unknown apps", and install. `.env` is git-ignored and is **not**
uploaded to EAS, which is why the three values are registered with
`eas env:create` (or under Expo → Project → Environment variables).

### 6.3 iOS

- Demo only: use **Expo Go** (section 6.1). This is the fastest path.
- Standalone install: `npx eas-cli@latest build --platform ios --profile preview`
  needs a paid Apple Developer account and the phone's UDID registered for
  ad-hoc distribution. TestFlight (`--profile production` + `eas submit`) is
  the alternative.

### 6.5 Location / GPS on both phones

The app uses **foreground location only**, so the phone screen stays on while
sharing. No background-location permission is requested.

**Phone settings (Android and iOS)**

1. Turn on the phone's Location/GPS.
2. Android: Settings → Location → Google Location Accuracy = on.
3. iOS: Settings → Privacy & Security → Location Services = on, and for
   Angkol/Expo Go choose **While Using the App** with **Precise Location** on.
4. Keep mobile data or Wi-Fi on; the app writes coordinates to Supabase.

**Driver phone**

1. Sign in with an approved driver account.
2. On the dashboard, tap **Enable GPS to go online** and allow location.
3. Turn the availability switch on. Only available drivers receive ride
   offers, ranked nearest-first.
4. Keep the app open while driving. It writes `drivers.current_lat/lng`,
   `vehicles.current_lat/lng`, and a `vehicle_locations` history row every
   ~5 seconds or 10 metres.
5. If permission was denied: Android → Settings → Apps → Angkol → Permissions →
   Location → Allow; iOS → Settings → Angkol → Location → While Using.

**Passenger phone**

1. Sign in as a commuter.
2. Tap **Use my current location** to set pickup, or tap the map to drop a pin.
3. Location is used for the pickup point and nearby-vehicle display; the
   passenger does not stream location continuously.

**Live demo check**

- Driver dashboard shows "You're available" and a moving position on the map.
- Passenger sees the tricycle marker and, after booking, the driver's latest
  position. A position older than 60 seconds is labelled stale.
- Admin web portal shows the same vehicle position after a refresh.

### 6.6 Local quality gates

```bash
npm run typecheck       # TypeScript gate
npm run lint            # ESLint gate
npm run build:web       # static web export (admin portal check)
npm run build:native    # native bundle export
```


---

## 7. Database reference

### 7.1 Tables

| Table | Purpose |
| --- | --- |
| `routes` | Route name, stops (JSON), schedule window, interval, fare, approval |
| `terminals` | Station name, coordinates, route link, active flag |
| `terminal_schedules` | Departure time and dispatch interval per terminal |
| `fare_matrices` | Base fare, per-km rate, included km, tariff tier, vehicle class |
| `users` | Auth profile + every registration field |
| `drivers` | License, association, permit, plate, capacity, availability, GPS |
| `vehicles` | Franchise vehicles, plate, capacity, type, status, owner, GPS |
| `bookings` | Ride requests, fare, distance, ETA, status, timestamps, rating |
| `trip_records` | Completed-trip ledger (distance, duration, payment, rating) |
| `vehicle_locations` | GPS history for vehicles |
| `audit_logs` | Security/audit events (admin-readable) |
| `data_analysis` | Per-route demand and utilization aggregates |
| `driver_runs` | PUJ trip sheet: route, stops, boarded counts, cash fares |
| `driver_run_events` | Boarding/alighting/completion events for a run |
| `stop_requests` | Passenger pickup requests on a route |
| `reports` | Passenger/driver incident reports |
| `notifications` | Per-user in-app notifications |
| `landmarks` | Searchable places for pickup/destination |

### 7.2 Registration form → column checklist

Every field on the mobile registration sheet is stored.

| Form field | Screen | `public.users` | `public.drivers` |
| --- | --- | --- | --- |
| Full name | both steps | `name` | — |
| Birthday (MM-DD-YYYY) | step 1 | `birthday` (stored as `date`) | — |
| Phone number | step 1 | `phone`, `contact_numbers` | — |
| Email address | step 1 | `email` (also `auth.users.email`) | — |
| Password | step 1 | Supabase Auth (`auth.users`, hashed) | — |
| Consent | step 1 | `consent` | — |
| Role | step 1 | `assigned_roles[1]` | — |
| License No. | driver | — | `license_number` |
| Association | tricycle driver | — | `association` |
| Plate No. | tricycle driver | — | `plate_number` |
| Permit No. (Prangkisa) | tricycle driver | — | `permit_number` |
| Capacity | tricycle driver | — | `capacity` |
| License document attached | PUJ/PUV driver | — | `license_doc_attached` |
| Business / franchise | PUJ/PUV driver | `franchise_name` | `franchise_name` |
| Application status | derived | `application_status` | `verified` |

Additional profile fields used by screens: `photo`, `admin_level`,
`availability_status`, `current_lat`, `current_lng`, `location_updated_at`.

### 7.3 RPCs

| RPC | Caller | Purpose |
| --- | --- | --- |
| `quote_fare(p_distance_km, p_class)` | passenger | Server-side fare from `fare_matrices` |
| `transition_booking(p_booking_id, p_status)` | passenger/driver | Status change, driver assignment, trip ledger |
| `rate_booking(p_booking_id, p_rating)` | passenger | 1–5 rating on a completed trip |
| `my_role()` | policies | Current user's primary role |
| `is_admin()` | policies | Administrator or vehicle owner |

### 7.4 RLS summary

- Reference data (`routes`, `terminals`, schedules, fares, landmarks, vehicles,
  locations, analysis) is readable by authenticated users.
- `bookings` is visible to the passenger, the assigned driver, administrators,
  and drivers looking at unassigned `Requested` trips.
- A passenger can only insert their own booking.
- Runs are visible/writable by their driver and administrators.
- Reports are visible to their reporter and administrators.
- Notifications are visible to their owner.
- Admin-only writes: routes, terminals, schedules, fares, landmarks, reports
  status.
- `guard_user_update` and `guard_driver_update` prevent self-promotion and
  self-verification.

> Privacy note: authenticated users can read the profile directory because the
> existing UI shows driver names, plates, and phone numbers. If you later need
> stricter privacy, replace `read_users`/`read_drivers` with column-level views.

---

## 8. Application file guide

### `src/services/supabase.ts`

Creates the singleton Supabase client with AsyncStorage session persistence,
auto token refresh, and a guard (`isSupabaseConfigured`) so the app can show a
clear error when `.env` is incomplete.

### `src/services/api.ts`

The live adapter. Maintains `api(endpoint, body, method)` and maps:

| Endpoint | Live behavior |
| --- | --- |
| `/state` | Reads all tables and builds `Snapshot` |
| `/login` (legacy) | Sign-in is handled by `src/auth/session.ts` |
| `/search?q=` | `landmarks` ILIKE search |
| `/quote` | Mapbox Directions + `quote_fare` RPC |
| `/book` | Inserts `bookings` with the validated quote |
| `/book-puj` | Inserts a walk-up PUJ/PUV booking |
| `/trips/:id` | `transition_booking` RPC |
| `/trips/:id/decline` | `release_booking` RPC — returns the ride to the pool for the next driver |
| `/trips/:id/rating` | `rate_booking` RPC |
| `/profile`, `/profile/photo` | Updates `users` |
| `/availability` | Updates `drivers.availability_status` |
| `/notifications/read` | Marks the user's notifications read |
| `/report`, `/reports/:id` | Inserts/updates `reports` |
| `/vehicles`, `/vehicles/status`, `/vehicles/:id` | Franchise vehicle CRUD |
| `/drivers/:id` | Approves/declines drivers, assigns routes |
| `/configure` | Route/terminal upsert, active toggle, tricycle fare rules |
| `/stop`, `/stops/:id` | Stop requests |
| `/runs`, `/runs/:id` | Trip sheet create/advance/complete |

### `src/services/mapbox.ts`

- `staticMapUrl({ points, path, width, height })` → Static Images URL with pins,
  route path, and a bounding box.
- `viewportFor(points)` → bounding box used for both the URL and tap projection.
- `directions(from, to)` → distance (km), minutes, GeoJSON line.
- `reverseGeocode(lat, lng)` → place name for map taps.
- `searchPlaces(query)` → place suggestions (available for future fields).

### `src/services/location.ts`

- `startSharing(driverId)` requests foreground permission, watches position, and
  writes to `drivers`, `vehicles`, and `vehicle_locations`.
- `stopSharing()` removes the watcher.
- Wired to the driver screen's sharing switch in `AngkolApp`.

### `src/services/previewActions.ts`

Device services used by the existing UI: native share sheet, external links
(`expo-linking`), and profile photo picking (`expo-image-picker`, image is stored
as a data URI in `users.photo`).

### `src/auth/session.ts`

- `signInAccount(email, password, administrator)` — Supabase Auth sign-in plus
  portal-role check.
- `registerAccount(input)` — Supabase Auth sign-up; registration fields are
  passed as user metadata and copied to tables by the trigger.
- `signOutAccount()` / `getSession()` — helpers.

### `src/map/StaticMap.tsx`

Mapbox Static Images map with a transparent press layer. It converts a tap into
a coordinate using the requested bounding box, reverse geocodes it, and calls
`onSelect`. It draws the bundled map only when Mapbox is not configured.

### `supabase/migrations/`

Ordered migrations: the initial schema with Calbayog seed data, then the
security hardening (sign-up roles, server-side fares, booking state rules,
private columns, function permissions).

---

## 9. Role flows

### Commuter

1. Register or sign in.
2. Choose pickup and destination on the Mapbox map or from landmarks.
3. `quote` draws a Mapbox route and computes the server-side fare.
4. `book` inserts a `Requested` booking.
5. Track status updates (Realtime refresh or manual refresh).
6. Cancel, complete, and rate through RPCs.
7. PUJ/PUV walk-up booking writes an `Arrived` booking.

### Tricycle / PUJ-PUV driver

1. Register; PUJ/PUV stays `pending` until a franchise owner approves.
2. Toggle availability and optionally share GPS.
3. Accept/decline incoming `Requested` bookings.
4. Advance `Accepted → Arrived → In progress → Completed`.
5. Record boarding/stop events in `driver_runs` and `driver_run_events`.
6. Submit reports, edit profile, view notifications.

### Administrator / franchise owner (web)

1. Sign in on the web portal.
2. Overview, fleet positions, people, routes/terminals, trips/reports, audit.
3. Approve or decline pending PUJ/PUV drivers.
4. Assign routes, add/decommission vehicles, configure routes and terminals.
5. Update report statuses and mark notifications read.

---

## 10. Removed prototype-only files

| Removed | Replaced by |
| --- | --- |
| `src/auth/sampleAccounts.ts` | `src/auth/session.ts` + Supabase Auth |
| `src/services/sampleTrips.ts` | `bookings` / `trip_records` tables |
| `src/driver/sampleDriverData.ts` | `driver_runs` / `driver_run_events` |
| `src/admin/sampleAdministratorData.ts` | live `users`, `vehicles`, `bookings` |

Also removed from `AdminDashboard.web.tsx`: fake pending applications, fake
fleet fallback rows, and local-only approve/decline/decommission state. Those
actions now call the API and persist to Supabase.

---

## 11. Verification checklist

Run:

```bash
npm run typecheck
npm run lint
```

Then, with real keys:

- [ ] Commuter registration creates an `auth.users` row and a `public.users` row.
- [ ] Birthday, phone, consent, and name appear in the table.
- [ ] Tricycle registration creates a `public.drivers` row with license, plate,
      permit, association, and capacity.
- [ ] PUJ/PUV registration shows the pending screen and appears for the owner.
- [ ] Owner accept sets `verified = true` and `application_status = accepted`.
- [ ] Owner decline sets `application_status = declined`.
- [ ] Map loads with a Mapbox token; tapping sets pickup/destination.
- [ ] Quote returns a distance, ETA, and fare from `fare_matrices`.
- [ ] Booking appears for the passenger and for available drivers (nearest first).
- [ ] Driver accept assigns `driver_id`; completion writes `trip_records`.
- [ ] Driver decline returns the ride to `Requested` and hides it from that driver.
- [ ] The passenger receives an in-app notification when a driver accepts.
- [ ] Rating appears on the completed trip.
- [ ] Driver GPS sharing updates `drivers` and `vehicle_locations`.
- [ ] Profile photo, name, phone, and availability persist after reload.
- [ ] Notifications mark-all-read persists.
- [ ] Admin route/terminal/vehicle changes persist after reload.
- [ ] Realtime refresh arrives when a booking changes.

---

## 12. Troubleshooting

| Symptom | Fix |
| --- | --- |
| “Supabase is not configured” | Fill `.env` and restart Expo (`Ctrl+C`, then `npx expo start -c`) |
| “No profile found for this account” | Apply the migrations, then sign out/in |
| Registration says “Confirm your email” | Turn off **Confirm email** in Supabase Auth settings |
| “Invalid login credentials” | Wrong password or the account was created before email confirmation was disabled |
| Admin sign-in says use the web portal | Administrator/owner accounts only work on the web build |
| “Could not calculate a route” | Check the Mapbox token and its `directions` scope |
| Map shows the bundled image | `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is missing or invalid |
| Driver cannot see requests | Driver must be verified, available, and have a matching role |
| RLS blocks a write | Confirm the signed-in user owns the row; see section 7.4 |
| Realtime does not fire | Enable the three tables under Database → Replication |

---

## 13. Security notes

- The anon key is safe to ship; RLS enforces access.
- Never put the service-role key in `.env` or the app bundle.
- Fares are computed by `quote_fare`, not trusted from the client.
- Status changes go through `transition_booking`, which checks ownership and
  role.
- Profile updates cannot change role, verification, or email because of the
  guard trigger.
- Photos are stored as data URIs to avoid a storage bucket. If you expect large
  photos, add a Supabase Storage bucket later and store only the URL.
