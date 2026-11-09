# Angkol — Data Flow & Screen Functionality

**Static UI prototype — local-only (Expo / React Native + expo-router, TypeScript strict).**  
No backend, no Firebase, no GPS hardware calls, no external services, no shared web↔mobile sync. All state lives in memory and resets on reload/restart. Fictional bundled sample data only.

---

## 1. Project boundaries & why

| Boundary | What it means | Why |
|---|---|---|
| Local-only prototype | `src/services/api.ts` is an in-memory adapter; no network, no `EXPO_PUBLIC_SHARED_API`, no `sharedFetch` | Keeps the prototype self-contained and offline-capable; no credentials or URLs are stored |
| No web↔mobile connection | Deleted `src/app/api/pending-applications+api.ts` and `src/app/api/pending-applications/[id]+api.ts`; `app.json` has no `web.output:"server"` | The original app tied web and mobile together; this prototype keeps them separate |
| Role-Based Access Control (RBAC) | Five roles: `Passenger`, `Tricycle driver`, `PUJ / PUV driver`, `Administrator` (Technical Team), `Vehicle Owner / Operator` (Franchise Owner) | Each role lands on a different dashboard with different capabilities |
| Branding | Calbayog Metro Express (franchise of Kent Ferrer, Vehicle Owner / Level B) | Franchise-owner admin panel carries this branding throughout |

---

## 2. Entry & layout

### `src/app/_layout.tsx` — expo-router root layout
- Loads the `Manrope` font via `expo-font`; shows a splash screen (`#0B5D45` green, `assets/angkol-icon.png`) while fonts load.
- **Android navigation bar**: via `expo-navigation-bar` — sets position `relative`, background `#FFFFFF`, button style `dark` (no inline `<NavigationBar />` component).
- `StatusBar` set to `dark`; `SafeAreaProvider` wraps the whole app; `GestureHandlerRootView` for gesture handling.
- `Stack` navigator with `headerShown: false` and white `contentStyle`.
- **Why**: single navigation entry point, consistent status/navigation-bar styling across platforms, safe-area handling for notches/home indicators.

### `src/app/sign-in.tsx`
- Re-exports `../AngkolApp`. It is the expo-router index route that boots the app shell.
- **Why**: expo-router convention — `src/app/sign-in.tsx` is the entry screen; it delegates to the root `AngkolApp`.

---

## 3. App shell

### `src/AngkolApp.tsx` — root shell / dispatcher
Holds the prototype's in-memory `Snapshot` state (`data`), a notice banner, and GPS `sharing` toggle. Renders:

| State | Rendered screen | Props |
|---|---|---|
| `!data` (no session) | `Auth` (`src/auth/Auth.tsx`, sign-in/sign-up sheet) | `onSignedIn={refresh}` |
| `data.user.role === "Administrator"` / `"Vehicle Owner / Operator"` | `AdminDashboard` (`src/admin/AdminDashboard.web.tsx`) | `data`, `notice`, `busy`, `connected`, `dismissNotice`, `refresh`, `action`, `logout` |
| `data.user.role === "Passenger"` | `PassengerApp` (`src/passenger/PassengerApp.tsx`) | same props |
| otherwise (driver roles) | `DriverApp` (`src/driver/DriverApp.tsx`) | same props + `sharing`, `toggleSharing` |

Key functions:
- `refresh()` → `api("/state")` — reloads the local snapshot.
- `action(endpoint, input, method)` → calls `api`, then `refresh`; surfaces errors into `notice`.
- `logout()` → `clearSession()`, clears `data`/`sharing`/`notice`, navigates back to auth.
- Fade animation (`Animated.Value`, 220ms) over signed-in content; `SafeAreaView` edges `top/left/right` (auth uses `top/bottom`).
- **Why**: centralizes session state, routing between role-specific dashboards, and the shared `api`/`action`/`logout` contract used by every screen.

---

## 4. Authentication

### `src/auth/MobileAuth.tsx` — sign-in / sign-up sheet
Gesture-driven bottom sheet (Reanimated `useSharedValue`, `Gesture.Pan`) with:
- **Sign-in** (email + password): `signInSampleAccount(email, password)` → `onSignedIn()`.
- **Sign-up** (two steps): Step 1 collects name, birthday (MM-DD-YYYY), phone, email, password (≥10 chars), consent. Step 2 confirms and branches by role:
  - `Commuter` → `registerSampleAccount` (Passenger).
  - `Driver` → choose `Tricycle driver` or `PUJ / PUV driver`:
    - Tricycle: plate (`LL-DDDDD`), permit No. (Prangkisa), capacity, TODA/association → 3s "Verifying your account" → `onSignedIn()`.
    - PUJ / PUV: franchise dropdown (default `Calbayog Metro Express`), license ID attachment toggle → **5s "Waiting for approval"** → `api("/register", {...})` → `onSignedIn()` → `DriverApp`.
- Field-level errors render under each input (`fieldError("password")` etc.).
- `KENT_OWNER_FRANCHISE = "Calbayog Metro Express"` constant.
- **Why**: single unified auth sheet; simulates the PUJ/PUV franchise approval wait without a backend; validates plate/permit formats.

### `src/auth/sampleAccounts.ts` — fictional demo credentials (RBAC)
Five pre-seeded accounts (all password `Angkol123!`):

| Email | Name | Role | adminLevel | Notes |
|---|---|---|---|---|
| `april@angkol.example` | April Lentejas | Passenger | — | Commuter; books rides |
| `meynard@angkol.example` | Meynard Salem | Tricycle driver | — | License, Magsaysay TODA, plate `AB-12345`, permit `PRK-2026-0142`, capacity 3 |
| `limuel@angkol.example` | Limuel Rosino | PUJ / PUV driver | — | License, Calbayog Transport Cooperative, plate `ABC 1231`, capacity 18, franchise `Calbayog Metro Express` |
| `shaina@angkol.example` | Shaina Moriles | Administrator | Technical Team | Full system-wide access |
| `kent@angkol.example` | Kent Ferrer | Administrator | Franchise Owner | `ownerVehicleIds: ["sample-driver-1","sample-driver-3"]`, franchise `Calbayog Metro Express` |

Functions:
- `signInSampleAccount(email, password, administrator)` — validates credentials, enforces admin vs. mobile split, calls `openAccount`.
- `registerSampleAccount(account)` — rejects duplicate emails and administrator registration; adds to the in-memory `accounts` Map then opens it.
- `openAccount(account)` → `selectDemo(role, adminLevel)` then `api("/profile", {...}, "PATCH")` to populate fictional phone/license/association/plate/permit/capacity/franchiseName.
- **Why**: provides a usable demo without real authentication; drives `selectDemo` in `api.ts`.

---

## 5. Local data layer

### `src/services/api.ts` — in-memory API adapter (the only "backend")
Single `api<T>(endpoint, input?, method?)` function. Maintains module-level `state: Snapshot`, `signedIn`, `sequence`, `quote`, and a `globalThis.__angkolPendingApplications` Map.

**Entry points:**
- `/login` → `selectDemo(role)` → returns `{ token: "static-demo", user }`.
- `/register` → PUJ/PUV creates a local accepted session (`id: \`puj-${email}-${Date.now()}\`, `verified:true`, `available:false`, `applicationStatus:"accepted"`, `pendingFranchiseApproval:false`); other roles call `selectDemo`.
- `/state` → returns full `Snapshot` (injects pending applications, syncs pending user).
- `/debug/pending-applications` → count + items of the pending-applications Map.
- `/search?q=` → filters `landmarks` by name.
- `/quote` → fixed sample quote (distance 3.2 km, fare ₱43, 12 min) with LineString geometry.
- `/book` → creates a `Trip`, unshifts into `state.trips`, supports demo payment methods (GCash/Maya/Bank transfer, `realMoneyCharged: false`).
- `/trips/:id` and `/trips/:id/:action` (e.g. `/decline`) → mutate trip status; driver accept sets `driverId`/`driver`/`plate`.
- `/profile`, `/profile/photo`, `/availability`, `/notifications/read`, `/report`, `/reports/:id` → profile/availability/report mutations.
- `/vehicles` (POST) → upserts a vehicle; if user is Franchise Owner, adds to `ownerVehicleIds`. `/vehicles/:id` and `/vehicles/:id/status` → update vehicle fields/status.
- `/drivers/:id` (PATCH) → update driver (verified, routeId).
- `/runs` (POST) → seeds a `DriverRun` (departure event, cash fares = boarded × fare). `/runs/:id` (PATCH) → `action:"complete"`/`status:"Completed"` sets `Completed`, `endedAt`, final stop index, onboard=0, completion event; otherwise advances stop index and updates boarded/alighted.
- `/stop` → adds a stop request; `DELETE /stops/:id` → removes.
- `/configure` → wholesale state merge (used by AdminPanel for routes/terminals/fares).

`PendingApplication` Map + `injectPendingApplications()` / `syncPendingUserFromRegistry()` keep any registered PUJ/PUV applications mirrored into `state.users` without exposing them to the franchise-owner drivers tab (prototype rule).
- **Why**: one unified local adapter so every screen calls the same `api`/`action` contract; no network, no credentials, no URLs; state resets on reload.

### `src/types/types.ts` — shared TypeScript model
Core types: `Role`, `AdminLevel`, `VehicleStatus`, `ApplicationStatus`, `Point`, `Geometry`, `User`, `Status` (trip statuses), `Quote`, `Trip`, `Route`, `Terminal`, `Vehicle`, `StopRequest`, `Report`, `Snapshot`, `DriverRun`.
- **Why**: single source of truth for the data model; strict typing across all screens and the API adapter.

---

## 6. Role screens

### `src/driver/DriverApp.tsx` — driver dashboard (Tricycle + PUJ/PUV)
Alias map (`Home`→`Dashboard`, `Trips`/`My trips`→`Records`, `Requests`→`Requests`, `Reports`→`Support`, etc.) and an `allowed` page list guard.

Pages:
- **Dashboard** — greeting (Waray: Maupay nga aga/kulop/gab-i), availability switch (`/availability`), "Enable GPS to go online" (`toggleSharing`), route card / next departure, today's stats (completed trips, cash fares, on board / new requests).
- **Terminal** — scheduled departure time, passenger count at departure, terminal schedule list, "Depart terminal · start trip" → `start()` POSTs `/runs`.
- **Route** / **Pickup** — map of stops, on-board counts, boarding/alighting counters, "Confirm stop & passenger counts" → PATCH `/runs/:id` (`action:"stop"`), pickup requests list (mark picked up → `DELETE /stops/:id`), "Complete trip" → `finish()` PATCH `/runs/:id` (`action:"complete"`).
- **Run complete** — trip-complete summary: cash fares recorded, total boardings, trip log (events table), "Back to dashboard".
- **Requests** — nearby ride requests (`status === "Requested"`); "Accept ride request" → PATCH `/trips/:id` (`status:"Accepted"`); "Decline · offer to next driver" → `/trips/:id/decline`.
- **Trip** — map, "Directions to passenger" (OpenStreetMap link), trip details, status progression (Accepted→Arrived→In progress→Completed) via PATCH `/trips/:id`; "Done" on Completed → `Records`.
- **Records** — list of runs (PUJ/PUV) or trips (Tricycle) with fares and status tags; "View trip record".
- **Earnings** — 7-day bar chart (Su–Sa, Thursday highlighted gold/amber), today/week cash totals, recent earnings list, "Export / share cash records" (Share API).
- **Profile / Documents** — driver photo (pick → PATCH `/profile/photo`), license & association, plate/capacity, registered vehicle tag, today cash, "Account & security", "Report account or vehicle changes", "Log out".
- **Account** — display name, phone, email (read-only), "Save account details" → PATCH `/profile`, "Stop GPS sharing & go offline".
- **Notifications** — "Mark all as read" → `/notifications/read`, list of notifications.
- **Support** — report text input → POST `/report`, list of reports.
- **Why**: complete driver workflow — go online, start a run, count stops/passengers, accept/decline hails, complete trips, view earnings/records, manage profile.

### `src/passenger/PassengerApp.tsx` — passenger app
Tab nav: Home, Routes, Terminals, Trips, Profile. `useLocalSearchParams` for `screen`/`trip`; status-change effect auto-routes to `Track ride`/`Receipt` when a trip completes.

Pages:
- **Home** — "Your next journey", greeting, quick actions (Book → Journey, Routes, Terminals, Track active ride).
- **Journey** — pickup/destination pills (outside the map), "Use my current location", "Tap map to set pickup/destination" (`mode="select"` on `CalbayogMap`), pickup note, "Confirm locations" → `/quote`.
- **Location search** — search `/search?q=`, results + Calbayog landmarks, choose a point.
- **Choose ride** — quote map card, Regular tricycle (fixed total) vs. Jeepney/PUV (per passenger, from route fares), "Continue" → Review ride.
- **Review ride** — receipt details, upfront fare, booking fee ₱0, demo-payment disclaimer ("TEST ONLY — no money charged"), "Confirm ride request" → `/book` → Ride accepted.
- **Ride accepted** — status banner (driver on the way / looking for driver), step progress (Request sent → Driver accepted → Driver arrived), confirmed cash fare, "Track my ride".
- **Track ride** — map with driver/passenger positions, vehicle staleness hint, driver card (avatar, name, plate, association, call/support), status, cash fare, "Share trip status" / "Cancel request".
- **Receipt** — trip completed/cancelled banner, date/time, trip ID, receipt details, fares, 5-star rating → PATCH `/trips/:id/rating`, "Done" → `Trips`, "Back to Home".
- **Routes** — `PassengerRoutesScreen`, route list with departures, stop requests (`POST /stop`, `DELETE /stops/:id`).
- **Terminals** — map + terminal list, "Use as pickup", "Directions ↗" (OpenStreetMap), today's departures.
- **Trips** — `PassengerTripsScreen`, open completed/cancelled → Receipt, active → Track ride.
- **Profile / Edit profile** — `PassengerProfileScreen`, name/phone save → PATCH `/profile`, sign out.
- **Notifications** — mark all read → `/notifications/read`, list.
- **Support** — report → POST `/report`, list of reports.
- **Why**: end-to-end passenger booking flow — pick locations → get quote → choose ride → book → track → receipt/rate → history.

### `src/passenger/passengerScreens.tsx`
- `PassengerHomeScreen`, `PassengerRoutesScreen`, `PassengerTripsScreen`, `PassengerProfileScreen` — extracted sub-components used by `PassengerApp`.
- **Why**: keeps `PassengerApp.tsx` manageable by separating tab-screen UI into dedicated components.

---

## 7. Admin screens (web panel)

### `src/admin/AdminDashboard.web.tsx` — franchise-owner / tech-admin dashboard
Role-gated (`Administrator` or `Vehicle Owner / Operator`). Sidebar brand label: "Calbayog Metro Express" (owner) / "City transport admin" (tech admin). Pages:

| Page | Function |
|---|---|
| **Overview** | Stats cards (franchise fleet, in service, broken/inactive, assigned vehicles, arrived, in terminal), 24h trips-by-hour bar chart (green gradient, fictional dataset for owner), recent trips table |
| **Fleet tracking** | Vehicles table (All/Active/Maintenance/Inactive tabs, search), vehicle rows clickable → "Vehicle details" modal with "Decommission vehicle" action; `ownerAddedVehicles` inserted with `In Terminal` status |
| **Drivers** | "Pending driver approvals" (owner only): Accept moves applicant into franchise drivers; Decline opens a reconfirm modal with driver details (Confirm removes, Cancel keeps). "Franchise drivers" table with verified/pending status |
| **Fleet trips** | PUJ/PUV-only trip logs: filters by verified PUJ/PUV driver id/name/plate, franchise plates, and PUJ/PUV vehicle types; status/date/search filters; `tripTable` renders the filtered list |
| **System monitor** | Service health (auth, Firebase sync label, driver-location freshness, routes, notifications), driver-location freshness meters (live/stale/offline), audit-trail table |
| **Vehicle details** modal | Add vehicle modal (plate/unit, type, driver, route, capacity; required-field validation; inserts `In Terminal`); decommission action |

Key data derivations: `myVehicles` (owner vehicle IDs / ownerId / ownerName / PUJ-PUV kind), `myDrivers`, `myTrips`, `franchiseTrips` (PUJ/PUV-filtered), `shownFleetTrips` (status/date/search).
- **Why**: franchise-owner administrative panel for fleet, driver approvals, and trip monitoring; tech-admin gets system-wide monitoring. Local-only, fictional data.

### `src/admin/AdminPanel.tsx` — transport management panel (farms/road config)
Sections: `all`, `routes`, `terminals`, `fares`.
- **Route fare configuration**: base fare / per-km reference.
- **Driver approval**: list drivers with Approve/Revoke (`PATCH /drivers/:id`), route choice chips for PUJ/PUV drivers.
- **Terminal map point**: `CalbayogMap` in `mode="pickup"`, rename point, lat/long display.
- **Add/Edit route**: name, vehicle type (PUJ/PUV), fare, destination, approve switch, terminal point → `POST /configure` (`type:"route"`).
- **Add/Edit terminal**: name, route, active switch → `POST /configure` (`type:"terminal"`).
- **Why**: administrator tooling for configuring routes, terminals, fares, and driver approvals — all local state mutations.

### `src/admin/sampleAdministratorData.ts`
- `populateAdministratorSamples(state)` — seeds administrator-facing sample data (users, vehicles, trips, logs, reports, notifications) when an Administrator signs in.
- **Why**: gives the admin dashboard something to display without a backend.

---

## 8. Common & UI utilities

### `src/common/ui.tsx`
- `money(n)` → `₱XX.XX` formatter.
- `Icon` — Ionicons wrapper.
- `Button` — animated press (scale 0.94→1.04→1) + pulse animation; secondary variant.
- `Popover` — scale/opacity animated popover (0.95→1, 0→1).
- `Field`, `Card`, `Badge`, `Heading`, `Choice` — reusable form/UI primitives.
- **Why**: consistent theming, animation, and form controls across mobile and admin screens.

### `src/common/styles.ts`
- Shared style constants (`s.button`, `s.card`, `s.input`, etc.) used by `ui.tsx` and screens.
- **Why**: single source of visual tokens (colors, spacing, typography).

### `src/styles` / `src/passenger/passengerStyles.ts`
- `ps` (layout primitives: card, row, button, pill, hint, nav, footer) and `passengerColors` (`c.ink`, `c.green`, `c.amber`, `c.background`, `c.muted`).
- **Why**: passenger-app-specific styling kept separate from common UI.

---

## 9. Map

### `src/map/CalbayogMap.tsx` → re-exports `./StaticMap`
### `src/map/StaticMap.tsx`
- Hint ("Tap map to set pickup/destination") placed **outside** the map container; full-overlay accessible `Pressable`; `mode="select"` with `onSelect` callback for journey point selection.
- **Why**: static map placeholder for the Calbayog prototype; no live GPS/tiles, purely visual location selection.

---

## 10. Data flow diagram (logical)

```
User opens app
    │
    ▼
src/app/sign-in.tsx  →  src/AngkolApp.tsx  (no session?)
    │                              │
    │ (session)                    ▼ (no session)
    │                    src/auth/MobileAuth.tsx
    │                    (sign-in / sign-up)
    │                              │
    │                    onSignedIn() → refresh() → api("/state")
    │                              │
    ▼                              ▼
role-based dispatch ───────────────────────►
    │
    ├─ Administrator / Vehicle Owner / Operator  →  AdminDashboard.web.tsx
    │                                           (fleet, drivers, trips, monitor)
    │
    ├─ Passenger  →  PassengerApp.tsx
    │             (Home → Journey → Quote → Book → Track → Receipt)
    │
    └─ Tricycle / PUJ-PUV driver  →  DriverApp.tsx
                  (Dashboard → Terminal → Run → Requests → Trip → Records → Earnings)

Every screen mutation goes through:
    action(endpoint, input, method)  →  api(endpoint, input, method)
                                          → local in-memory Snapshot state
                                          → refresh() re-renders screens
```

---

## 11. API endpoint reference (local adapter)

| Endpoint | Method | Purpose |
|---|---|---|
| `/login` | POST | `selectDemo(role)` → demo session |
| `/register` | POST | Register; PUJ/PUV → local accepted session |
| `/logout` | POST | Clear session |
| `/state` | GET | Return full `Snapshot` |
| `/debug/pending-applications` | GET | Pending-applications Map count + items |
| `/search?q=` | GET | Search landmarks |
| `/quote` | POST | Sample fare quote + geometry |
| `/book` | POST | Create trip from quote |
| `/trips/:id` | PATCH | Update trip status |
| `/trips/:id/decline` | PATCH | Cancel trip (decline) |
| `/trips/:id/rating` | PATCH | Passenger rating |
| `/profile` | PATCH | Update user profile |
| `/profile/photo` | PATCH | Set/remove driver photo |
| `/availability` | PATCH | Toggle driver available |
| `/notifications/read` | POST | Mark all notifications read |
| `/report` | POST | Create support report |
| `/reports/:id` | PATCH | Update report |
| `/vehicles` | POST | Upsert vehicle (links to owner if Franchise Owner) |
| `/vehicles/:id` | PATCH | Update vehicle |
| `/vehicles/:id/status` | PATCH | Update vehicle status |
| `/drivers/:id` | PATCH | Approve/revoke driver + route |
| `/runs` | POST | Seed driver run (departure) |
| `/runs/:id` | PATCH | Complete run or advance stop |
| `/stop` | POST | Add stop request |
| `/stops/:id` | DELETE | Remove stop request |
| `/configure` | POST | Configure routes/terminals/fares |

---

## 12. Roles & capabilities matrix

| Capability | Passenger | Tricycle driver | PUJ/PUV driver | Administrator (Tech) | Vehicle Owner (Franchise) |
|---|---|---|---|---|---|
| Book rides | ✅ | | | | |
| Accept/decline hails | | ✅ | | | |
| Operate PUJ/PUV route runs | | | ✅ | | |
| View earnings/cash records | | ✅ | ✅ | | |
| Fleet/vehicle management | | | | | ✅ (own franchise) |
| Driver approve/decline | | | | | ✅ (pending apps) |
| System monitor / audit | | | | ✅ | |
| Route/terminal/fare config | | | | ✅ | |

---

## 13. Prototype constraints (intentional)

- **No backend**: all data is in-memory; reload/reset clears state.
- **No real auth**: demo passwords are hardcoded in `sampleAccounts.ts`.
- **No real payments**: `demoPayment.realMoneyCharged: false`; "TEST ONLY — no money charged".
- **No real GPS/tiles**: `StaticMap` is a visual placeholder; `toggleSharing` is a demo GPS toggle.
- **No external services**: no Firebase, no maps API, no SMS/email.
- **Fictional data only**: all names, plates, emails, fares, and routes are samples for Calbayog City, Samar.

---

## 14. Configuration files

- `package.json` — Expo SDK ~58 (expo 58.0.23, react-native 0.88.1, react 19.3.0), scripts: `start`, `android`, `ios`, `web`, `typecheck` (`tsc --noEmit`), `lint` (`expo lint`), `build:web`, `build:native`.
- `tsconfig.json` — `jsx:"react-jsx"`, `module:"ESNext"`, `moduleResolution:"Bundler"`, `target:"ES2022"`, strict-ish; `skipLibCheck`, `resolveJsonModule`, `noEmit`.
- `app.json` — Expo app config (name `angol`, slug, no `web.output:"server"`).

---

## 15. Key screens and flow (variables + functions)

This section walks each key screen through its state variables and the functions that drive it.

### 15.1 `src/AngkolApp.tsx` — app shell / dispatcher

Central session state and role routing. Every screen receives the same `props` contract.

**State variables**
- `data: Snapshot | null` — the in-memory snapshot returned by `api("/state")`.
- `notice: string` — banner message surfaced from `action()` errors.
- `sharing: boolean` — demo GPS/location sharing toggle.
- `fade: Animated.Value` — 220ms fade-in over signed-in content.
- `insets` — safe-area insets (`useSafeAreaInsets`).
- `userId`, `hasData` — derived from `data`.

**Key functions**
- `refresh()` → `await api<Snapshot>("/state")` — reloads snapshot; used as `onSignedIn`.
- `action(endpoint, input, method?)` → calls `api`, then `refresh`; on error sets `notice`.
- `logout()` → `clearSession()`, clears `data`/`sharing`/`notice`, navigates back to auth.

**Flow**
```
no data  →  render Auth (MobileAuth) with onSignedIn={refresh}
has data →  role dispatch:
   Administrator / Vehicle Owner / Operator  →  AdminDashboard (web)
   Passenger                                 →  PassengerApp (mobile)
   Tricycle / PUJ-PUV driver                 →  DriverApp (mobile, + sharing/toggleSharing)
```

---

### 15.2 `src/auth/MobileAuth.tsx` — sign-in / sign-up

**State variables**
- `signup: boolean` — sign-in vs. sign-up mode.
- `step: 1 | 2` — sign-up step (basic info → driver/passenger details).
- `busy: boolean` — submission lock.
- `fieldErr: Record<string,string>` — per-field validation errors.
- `verifyPhase: "idle" | "tricycle-loading" | "puj-pending"` — approval-simulation phase.
- `pendingInfo` — name + franchise shown during the PUJ/PUV wait.
- `role: "Commuter" | "Driver"` — chosen at sign-up.
- `driverType: Role` — `Tricycle driver` or `PUJ / PUV driver`.
- `name, birthday, phone, email, password` — basic credentials.
- `license, association, franchiseName, plate, permitNo, capacity, consent` — role-specific fields.
- `licenseDoc: boolean` — demo license-ID attachment toggle.

**Key functions**
- `formatBirthday(raw)` / `isValidBirthday(value)` — MM-DD-YYYY validation.
- `formatPlate(raw)` / `isValidPlate(value)` — `LL-DDDDD` plate validation.
- `fieldError(key)` — renders error text under an input.
- `clearErr(key)` — clears a single field error.
- `changeMode(create)` — toggles sign-in ↔ sign-up, resets step/errors.
- `next()` — validates step 1, advances to step 2.
- `submit()` — full sign-up/sign-in flow:
  - Passenger → `registerSampleAccount(...)` → `onSignedIn()`.
  - Tricycle driver → `registerSampleAccount` → 3s `tricycle-loading` → `onSignedIn()`.
  - PUJ/PUV driver → `setVerifyPhase("puj-pending")` → 5s wait → `api("/register", {...})` → `onSignedIn()` → `DriverApp`.
  - Sign-in → `signInSampleAccount(email, password)` → `onSignedIn()`.
- Errors are rendered under the password field via `setFieldErr({ password: msg })`.

**Flow**
```
Sign in: email + password → signInSampleAccount → onSignedIn → refresh → role dispatch
Sign up: step1 (name, birthday, phone, email, password, consent) → step2
  Commuter → registerSampleAccount (Passenger) → onSignedIn → PassengerApp
  Driver → pick Tricycle or PUJ/PUV
    Tricycle → plate/permit/capacity/association → 3s wait → onSignedIn → DriverApp
    PUJ/PUV → franchise dropdown + license doc → 5s "Waiting for approval" → api("/register") → onSignedIn → DriverApp
```

---

### 15.3 `src/passenger/PassengerApp.tsx` — passenger app

Tab nav: Home, Routes, Terminals, Trips, Profile. Uses `useLocalSearchParams<{ screen?, trip? }>`.

**State variables**
- `pickup, destination: Point | null` — selected journey endpoints.
- `quote: Quote | null` — upfront fare quote (from `/quote`).
- `pickupNote: string` — free-text pickup note.
- `working, error, gpsAt` — submission lock, error banner, last GPS check.
- `editing: "pickup" | "destination"` — which map pill is being set.
- `search, results: Point[]` — location search results.
- `routeId, terminalId` — selected route / terminal.
- `name, phone` — editable profile fields.
- `paymentMethod: "Cash"` — demo payment method.
- `active: Trip | undefined` — the non-completed trip.
- `trip: Trip | undefined` — currently viewed trip (from params or active).
- `vehicle: Vehicle | undefined` — vehicle for the active trip.
- `previousStatuses: Map` — tracks status changes to auto-route to Track ride / Receipt.

**Key functions**
- `choosePoint(point)` — sets pickup/destination, clears quote, goes to Journey.
- `pick(kind)` — opens Location search for pickup or destination.
- `gps()` — sets pickup to first landmark, sets `gpsAt`, clears quote.
- `searchPlaces()` → `api("/search?q=...")`.
- `getQuote()` → `api("/quote", { pickup, destination })` → go Choose ride; if active trip exists, goes Track ride.
- `confirm()` → `api("/book", {...})` → `refresh()` → go Ride accepted.
- `cancel()` → `action("/trips/:id", { status: "Cancelled" })`.
- `share(receipt?)` → `Share.share(...)` with trip text / receipt.
- `map(height, journey?)` — renders `CalbayogMap` with mode `select`, `quote`, `trip`, `route`, `terminal`.
- Status-change `useEffect` — when a trip becomes `Completed`, routes to Receipt; `In progress` → Track ride.

**Flow**
```
Home → Journey (pickup/destination pills + "Tap map to set") → Confirm locations → /quote
→ Choose ride (Regular tricycle fixed total / Jeepney-PUV per passenger) → Review ride
→ Confirm ride request → /book → Ride accepted → Track ride (map, driver card, status steps)
→ Completed → Receipt (fare, 5-star rating → /trips/:id/rating, "Done" → Trips)
Side tabs: Routes (route list, stop requests POST/DELETE /stop, DELETE /stops/:id),
Terminals (map + terminal list, "Use as pickup", "Directions ↗"), Trips (history),
Profile/Edit profile (name/phone → PATCH /profile, sign out), Notifications (mark read → /notifications/read),
Support (report → POST /report)
```

---

### 15.4 `src/driver/DriverApp.tsx` — driver dashboard (Tricycle + PUJ/PUV)

**State variables**
- `params: { screen?, run?, trip? }` — expo-router local search params.
- `puj: boolean` — `data.user.role === "PUJ / PUV driver"`.
- `page` — resolved from `params.screen` via `aliases` + `allowed` list.
- `working, error` — submission lock + error banner.
- `boarded, alighted: string` — passenger counters (text inputs).
- `query: string` — route search.
- `name, phone` — editable account fields.
- `report: string` — support report text.
- `lock: useRef(false)` — prevents concurrent mutations.
- `runs, activeRun, run` — `DriverRun` list + active/completed run.
- `trips, requests, activeTrip, trip` — passenger trips filtered by driver.
- `assigned, stops` — assigned route and its stops.
- `fresh` — location freshness (`serverTime - updatedAt <= 60s`).
- `ownVehicle` — single-vehicle array for the map.
- `completed, today, todayCash, week, weekCash` — earnings derivations.

**Key functions**
- `go(screen, id?)` — `router.setParams({ screen, run: puj ? id : "", trip: !puj ? id : "" })`.
- `perform(task)` — lock-guarded async wrapper that sets `working`/`error`.
- `start()` → `api("/runs", { boarded })` → `refresh()` → go Route (depart terminal).
- `confirmStop()` → `action("/runs/:id", { action:"stop", revision, boarded, alighted })`.
- `finish()` → confirm dialog → `action("/runs/:id", { action:"complete" })` → go Run complete.
- `shareRecords()` → `Share.share(...)` with cash-fare records.

**Flow**
```
Dashboard (greeting, availability switch, "Enable GPS", route card, today's stats)
  PUJ/PUV: route card + next departure banner
  Tricycle: map + "Continue your active trip" / nearby ride requests
Terminal (scheduled departure, boarded count, terminal schedule, "Depart terminal" → start())
Route / Pickup (stop map, on-board counts, boarding/alighting counters,
  "Confirm stop" → PATCH /runs/:id action:"stop", pickup requests → DELETE /stops/:id,
  "Complete trip" → finish() → PATCH /runs/:id action:"complete")
Run complete (cash fares, boardings, trip log events, "Back to dashboard")
Requests (accept → PATCH /trips/:id status:"Accepted"; decline → /trips/:id/decline)
Trip (map, directions to passenger via OpenStreetMap, status progression
  Accepted→Arrived→In progress→Completed via PATCH /trips/:id, "Done" → Records)
Records (list of runs/trips with fares, "View trip record")
Earnings (7-day bar chart, Thursday gold highlight, today/week cash, "Export / share cash records")
Profile/Documents (photo → PATCH /profile/photo, license/association/plate/capacity,
  "Account & security", "Report account or vehicle changes", "Log out")
Account (name/phone → PATCH /profile, "Stop GPS sharing & go offline")
Notifications (mark all read → /notifications/read)
Support (report → POST /report)
```

---

### 15.5 `src/admin/AdminDashboard.web.tsx` — franchise-owner / tech-admin dashboard (web)

Role-gated: `Administrator` or `Vehicle Owner / Operator`. Sidebar brand: "Calbayog Metro Express" (owner) / "City transport admin" (tech admin).

**State variables** (page-specific)
- `page` — Overview / Fleet tracking / Drivers / Fleet trips / System monitor.
- `search, tripDate, tripStatus, vehicleFilterStatus` — filters.
- `ownerAddedVehicles, ownerPendingDrivers, ownerAcceptedDrivers` — owner prototype state.
- `declineTarget, vehicleForm, vehicleFormError` — modal states.
- `ownerDecommissionedVehicleIds` — decommissioned set.
- `selectedId, modal` — open modal + selected entity.
- `tripStatus, tripDate, search` (fleet trips) — status/date/text filters.

**Derived data**
- `users, trips, vehicles, drivers, commuters` — from `data`.
- `ownerVehicleIds`, `myVehicles` (ownerId/ownerName/ownerVehicleIds/PUJ-PUV kind), `myDrivers`, `myTrips`.
- `pujDrivers` (verified PUJ/PUV drivers), `pujDriverIds/Names/Plates`, `pujVehicles`.
- `franchisePlates` (from `pujVehicles` only — excludes tricycle plates).
- `franchiseTrips` — trips matching pujDriver ids/names/plates, franchise plates, or puj vehicle types; de-duplicated by id.
- `populatedFleetTrips` — `franchiseTrips` or 5 fictional demo trips (Limuel Rosino `ABC 1231`, Rico Dela Cruz `PUV 1024`, etc.).
- `shownFleetTrips` — `populatedFleetTrips` filtered by status/date/search.

**Key functions**
- `tripTable(items)` — renders trip rows (Trip ID, Passenger, Driver/unit, Route, Fare, Status); reads `items` (not the global `trips`).
- `open(kind, id?)` — sets `selectedId` + `modal`.
- Vehicle add modal — validates required fields, appends vehicle `In Terminal`; owner adds to `ownerVehicleIds`.
- Driver pending: Accept → remove from pending, add to accepted; Decline → open reconfirm modal; Confirm → remove; Cancel → keep.
- Vehicle details modal — "Decommission vehicle" → adds to `ownerDecommissionedVehicleIds`.

**Flow**
```
Overview (stats cards, 24h trips-by-hour chart, recent trips table)
Fleet tracking (vehicles table All/Active/Maintenance/Inactive + search,
  click vehicle → Vehicle details modal → Decommission vehicle; Add vehicle → In Terminal)
Drivers (Pending driver approvals: Accept/Decline with reconfirm modal;
  Franchise drivers table with verified/pending status)
Fleet trips (PUJ/PUV-only trip logs filtered by driver/plate/vehicle type + status/date/search)
System monitor (service health, location-freshness meters, audit-trail table)
```

---

### 15.6 `src/admin/AdminPanel.tsx` — transport management panel

**State variables**
- `base, rate, reference` — fare config.
- `approved` — fare approved flag.
- `routeId, routeName, routeFare, routeRef, routeApproved, routeDestination, transportType, selected (Point)` — route form.
- `terminalId, terminalName, terminalRoute` — terminal form.
- `routeError, feedback` — messages.
- `saving: useRef(false)` — save lock.

**Key functions**
- `save(input, message)` → `action("/configure", input)` → sets `feedback`.
- `selectTerminalPoint(point)` / `editTerminal(t)` — map point selection.
- Route save → `POST /configure` `{ type:"route", id, name, transportType, destination, stops:[selected], fare, scheduled:false, approved, reference, active }`.
- Terminal save → `POST /configure` `{ type:"terminal", id, name, point, routeId, active }`.
- Driver approval cards → `PATCH /drivers/:id` `{ verified, routeId? }`.

**Flow**
```
Route fare configuration (base fare, per-km, reference)
Driver approval (list drivers, Approve/Revoke + route choice chips for PUJ/PUV)
Terminal map point (CalbayogMap mode="pickup", rename point, lat/long)
Add/Edit route (name, vehicle type PUJ/PUV, fare, destination, approve switch, terminal point)
Add/Edit terminal (name, route, active switch)
```

---

### 15.7 Shared data contract (every screen)

All screens receive `props` from `AngkolApp.tsx`:

| Prop | Type | Purpose |
|---|---|---|
| `data` | `Snapshot` | in-memory state |
| `notice` | `string` | banner message |
| `busy` | `boolean` | submission lock |
| `connected` | `boolean` | connection flag (demo: always `true`) |
| `dismissNotice` | `() => void` | clear banner |
| `refresh` | `() => Promise<boolean>` | `api("/state")` |
| `action` | `(endpoint, input, method?) => Promise<boolean>` | `api` + `refresh` |
| `logout` | `() => Promise<void>` | `clearSession()` + navigate to auth |

`DriverApp` additionally receives `sharing` and `toggleSharing` for the demo GPS toggle.

---

## 16. Cross-screen navigation & data mutation lifecycle

### 16.1 Navigation mechanism

All screens are driven by expo-router local search params, not separate route files:

| Screen | Params hook | Param shape | Navigation function |
|---|---|---|---|
| `PassengerApp` | `useLocalSearchParams<{ screen?, trip? }>()` | `{ screen: "Home"\|"Journey"\|..., trip?: string }` | `go(next, id?)` → `router.setParams({ screen: next, trip: id })` |
| `DriverApp` | `useLocalSearchParams<{ screen?, run?, trip? }>()` | `{ screen: "Dashboard"\|..., run?: string, trip?: string }` | `go(screen, id?)` → `router.setParams({ screen, run: puj ? id : "", trip: !puj ? id : "" })` |
| `AngkolApp` (shell) | `router.setParams({ screen: undefined })` | clears to auth | `logout()` → `router.setParams({ screen: undefined })` |

**Screen-to-screen transitions:**

- **Auth → shell**: `onSignedIn()` → `refresh()` loads `data` → `AngkolApp` role-dispatches to `AdminDashboard` / `PassengerApp` / `DriverApp`.
- **Shell → auth**: `logout()` → `clearSession()`, `setData(null)`, `router.setParams({ screen: undefined })`.
- **Passenger**: Home → Journey (pick/destination) → Choose ride → Review ride → Ride accepted → Track ride → (Completed) Receipt → Trips. Back buttons use `go(back)` to return to the previous named screen.
- **Driver**: Dashboard → Terminal → Route / Pickup → Run complete; Dashboard → Requests → Trip → Records → Earnings → Profile / Account → Support → Notifications. "Done" on a completed trip returns to Records.
- **AdminDashboard**: Overview → Fleet tracking → Drivers → Fleet trips → System monitor via sidebar; modals for Vehicle details, Add vehicle, Decline driver reconfirm.

### 16.2 Data mutation lifecycle (the core flow)

Every user-initiated change follows the same loop:

```
UI event (button press / input change)
    │
    ▼
action(endpoint, input, method?)    [AngkolApp.tsx:30]
    │  calls api(endpoint, input, method)
    │  then awaits refresh() → api("/state")
    │  on error → setNotice(error.message)
    │
    ▼
api() mutates the module-level `state: Snapshot`    [api.ts:46]
    │  (e.g. state.trips.unshift(trip), state.user.available = ..., state.runs.unshift(run))
    │
    ▼
refresh() returns the mutated Snapshot
    │
    ▼
AngkolApp re-renders with new `data`
    │
    ▼
role-dispatch screen re-renders with updated props
    │
    ▼
derived values recompute (myVehicles, franchiseTrips, completed, weekCash, etc.)
    │
    ▼
UI reflects the change
```

Key rules:
- `api()` returns `structuredClone(result)` — screens never hold a live reference to module state.
- `action()` always follows a mutation with `refresh()` so every screen sees the latest snapshot.
- `busy`/`working`/`lock` flags prevent double-submission while a promise is in flight.
- All mutations are in-memory only; reload/reset clears everything.

### 16.3 `src/services/previewActions.ts` — simulated device APIs

All three are stubbed (no real device capability):

| Export | Behavior |
|---|---|
| `Share.share(content)` | `Alert.alert("Share preview", "This action is simulated. Nothing was shared.")` — used by DriverApp `shareRecords()` and PassengerApp `share()`. |
| `Linking.openURL(url)` | `Alert.alert("Contact preview", "Calls and directions are simulated in this static prototype.")` — used for "Directions to passenger", "Call driver", terminal "Directions ↗". |
| `pickDriverPhoto()` | `Alert.alert("Photo preview", "The profile image stays local in this prototype.")` returns `null` — used by DriverApp profile photo picker. |

### 16.4 `src/passenger/passengerScreens.tsx` — passenger sub-components

Extracted from `PassengerApp.tsx` to keep it maintainable:

| Component | Purpose |
|---|---|
| `PassengerHomeScreen` | Home tab: greeting, quick actions (Book, Routes, Terminals, Track active ride). |
| `PassengerRoutesScreen` | Routes tab: route list, departure times, stop-request add/cancel via `action("/stop", ...)` / `DELETE /stops/:id`. |
| `PassengerTripsScreen` | Trips tab: history list, open completed/cancelled → Receipt, active → Track ride. |
| `PassengerProfileScreen` | Profile tab: name/phone/email display, sign-out, navigation to Trips/Notifications/Support. |

Shared UI primitives in this file: `Tile`, `Pill`, `Section` (title/detail/action row).

### 16.5 End-to-end data flow summary (text diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER ACTION                                                    │
│  (e.g. "Confirm ride request", "Accept ride request",           │
│   "Complete trip", "Add vehicle", "Accept driver")              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  action(endpoint, input, method)  ──►  api(endpoint, input, m)  │
│  (AngkolApp.tsx)                    │                           │
│    - validates busy/lock            ▼                           │
│    - catches errors → notice        Mutates module `state`      │
│                                     (Snapshot in memory)        │
│    - awaits refresh()               │                           │
│      → api("/state") ───────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  new Snapshot returned                                          │
│  (structuredClone — no live reference to module state)          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  AngkolApp re-renders                                           │
│  role-dispatch → AdminDashboard / PassengerApp / DriverApp      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  derived values recompute                                       │
│  (myVehicles, franchiseTrips, completed, weekCash, etc.)        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  UI reflects change                                             │
│  (tables, charts, modals, badges, stats update)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 16.6 Role → screen → capability matrix (quick reference)

| Role | Lands on | Primary capabilities |
|---|---|---|
| Passenger (`april@...`) | PassengerApp | Book tricycle/PUV rides, track, rate, view history, routes/terminals, profile |
| Tricycle driver (`meynard@...`) | DriverApp | Accept/decline hails, progress trip status, view trips/earnings, profile |
| PUJ/PUV driver (`limuel@...`) | DriverApp | Start runs, count boardings/alightings per stop, complete runs, view earnings |
| Administrator Tech (`shaina@...`) | AdminDashboard (web) | System monitor, audit trail, service health, fleet tracking |
| Vehicle Owner Franchise (`kent@...`) | AdminDashboard (web) | Calbayog Metro Express branding, fleet vehicles, add/decommission vehicles, approve/decline driver applications |

---

