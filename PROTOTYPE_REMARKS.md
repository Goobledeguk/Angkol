# Angkol prototype — code review remarks (read-only)

**Date:** 19 Nov 2026
**Scope:** full `src/` tree, `app.json`, `package.json`, plus `DATA_FLOW_AND_SCREENS.md`, `INTEGRATION_PROMPT.md`, and the SRS (`SRS -G4 - CS3A-UPD.docx`).
**Status:** read-only review. No `/src` file was edited, created, or deleted. Companion files: `.env.example` (variable names only) and `INTEGRATION_GUIDE.md` (step-by-step migration/build plan).

---

## 1. Verdict in one paragraph

The prototype is internally consistent and every screen is fed by one source of truth (`src/services/api.ts` → `Snapshot`), which is exactly the right shape for a later swap. The cost of that convenience is that **UI logic, business rules, formatting, and styling all live inside a handful of very large screen files**. Nothing here is broken, but three things will hurt during integration: (a) the same helper is written two to five times in different files, so a backend change must be applied in several places; (b) 5,200 lines sit in four files, which makes every change review-unfriendly; (c) a few prototype shortcuts are baked into the UI (frozen clock, hardcoded `connected`/`busy`, demo fallbacks) and will silently mask real network behaviour once a backend is attached.

---

## 2. Priority summary

| # | Remark | Severity | Effort |
|---|---|---|---|
| R1 | Schedule/"next departure" math duplicated in passenger + driver apps | Medium | Low |
| R2 | Date/time formatters duplicated 6×, with **inconsistent locales** | Medium | Low |
| R3 | `Tag`/`Hint`/`Stat`/`Pill`/`Tile`/`Section`/`Empty` re-implemented per screen | Medium | Medium |
| R4 | Three parallel style systems; `common/` depends on `passenger/` | Medium | Medium |
| R5 | Four files hold ~76% of the codebase | High (maintainability) | High |
| R6 | Admin web renders the same 15 KB CSS string twice | Low | Low |
| R7 | `CalbayogMap.tsx` is a one-line re-export of `StaticMap.tsx` | Low | Low |
| R8 | Admin is web-only; the native admin stub silently returns `null` | Medium | Low |
| R9 | `api.ts` mixes transport, business rules, seeding and auth in one router | High (integration) | High |
| R10 | `serverTime` is frozen at module load; no timer anywhere | High (integration) | Low |
| R11 | `connected`/`busy` are hardcoded `true`/`false`; children still accept them | Medium (integration) | Low |
| R12 | Whole-snapshot cloning + zero memoisation → re-render everything per action | Medium (scale) | Medium |
| R13 | Domain filters (`role.includes("PUJ")`, vehicle-type lists, `any`) live in JSX | Medium | Medium |
| R14 | Sample-data seeding overlaps and inherits the signed-in user's fields | Low | Low |
| R15 | `npm run typecheck` currently fails (`PassengerApp.tsx:886`) | **Build blocker** | Trivial |

---

## 3. Detailed remarks

### R1 — `nextDeparture()` and `departure()` are the same algorithm

**Evidence**

- `src/passenger/PassengerApp.tsx:183` — `nextDeparture(route, now)`.
- `src/driver/DriverApp.tsx:143` — `departure(route, now)`.

These are behaviourally identical: both bail out when `scheduled === false || !interval || !startsAt || !endsAt`, format `now` with `toLocaleTimeString("en-GB", { timeZone: "Asia/Manila", hour12: false })`, convert `HH:MM` to minutes, round up to the next interval, clamp to the route window, and return either `"Tomorrow HH:MM"` or `"HH:MM"`. Only the local variable names differ (`minutes()` vs `minute(clock)`).

**Why it matters:** this is a scheduling rule the SRS treats as product logic (fixed-interval PUJ departures). When departure times come from the backend, two copies will drift.

**Direction:** one module (e.g. `src/domain/schedule.ts`) exporting `nextDepartureMinutes()` + `formatDeparture()`, consumed by both apps.

---

### R2 — Six bespoke date/time formatters, two different date locales

**Evidence (all with `timeZone: "Asia/Manila"`)**

| Location | Purpose | Locale |
|---|---|---|
| `PassengerApp.tsx:170` `stamp` | time | `en-PH` |
| `PassengerApp.tsx:176` `fullDate` | date | `en-PH` |
| `PassengerApp.tsx:508` | clock from `data.serverTime` | `en-GB` |
| `DriverApp.tsx:135` `time` | time | `en-PH` |
| `DriverApp.tsx:141` `date` | date | **`en-CA`** |
| `DriverApp.tsx:287` | earnings chart day label | `en-PH` |
| `DriverApp.tsx:548` | clock from `data.serverTime` | `en-GB` |
| `passengerScreens.tsx:115` `date()` | trip date | `en-PH` |

`en-CA` yields `2026-11-19`, while `en-PH` yields `19 Nov 2026` — the same trip is rendered differently on the driver and passenger sides. `PassengerApp` and `DriverApp` also format `data.serverTime` independently.

**Direction:** `src/domain/datetime.ts` with `formatTime`, `formatDate`, `formatClock`, `formatWeekday`. Keep the exact current strings for the driver side if the design must not change — but choose one deliberately.

---

### R3 — The same tiny components exist 2–5 times with different props

| Component | Copies | Notes |
|---|---|---|
| `Tag` | `DriverApp.tsx:70`, `PassengerApp.tsx:73` | driver version takes `{text, amber}`, passenger takes `{text, icon}` |
| `Hint` | `DriverApp.tsx:77`, `PassengerApp.tsx:81` | near-identical info row |
| `Stat` | `DriverApp.tsx:101` | no passenger/admin equivalent |
| `Pill` | `passengerScreens.tsx:23` (`label`, `quiet`), `AdminDashboard.web.tsx:51` | different APIs for the same visual |
| `Tile` | `passengerScreens.tsx:16` | icon container |
| `Section` | `passengerScreens.tsx:37` | card-with-title wrapper |
| `Empty` | `passengerScreens.tsx:97`, `AdminDashboard.web.tsx:133` | identical intent |

`src/common/ui.tsx` already exports `Icon`, `Button`, `Popover`, `Field`, `Card`, `Badge`, `Heading`, `Choice`, `money` — but none of the duplicates use it, and `Badge` vs `Pill` are the same idea.

**Direction:** add `Pill`, `Tile`, `Stat`, `Section`, `Empty`, `Hint` to `common/ui.tsx` (or a `common/mobile.tsx`) with props that are a union of the current variants, then delete the local copies. This is a pure move; visuals stay identical if styles are migrated verbatim.

---

### R4 — Three style systems, and a reversed dependency

- `src/common/styles.ts` (`s`) — 331 lines, desktop/admin panel styling.
- `src/passenger/passengerStyles.ts` (`ps` + `passengerColors`) — 400 lines, but used by **auth, driver, passenger, and common** (`DriverAvatar.tsx` imports `ps`).
- `src/admin/adminDashboardStyles.ts` — a 15 KB **plain CSS string** injected into the DOM, scoped only by the `.angkol-admin` class prefix.

`src/common/styles.ts:2` imports `passengerColors` from `../passenger/passengerStyles`, so the shared layer depends on a feature layer. If the passenger folder is ever reorganized, `common/` breaks.

**Direction:** move the palette to `src/theme/colors.ts`, keep `ps`/`s` importing from it, and let `common/` depend only on `theme/`.

---

### R5 — Four files hold most of the code

| Lines | Bytes | File |
|---:|---:|---|
| 2,070 | 69 KB | `src/passenger/PassengerApp.tsx` |
| 2,014 | 95 KB | `src/admin/AdminDashboard.web.tsx` |
| 1,697 | 57 KB | `src/driver/DriverApp.tsx` |
| 1,151 | 36 KB | `src/passenger/passengerScreens.tsx` |
| 977 | 40 KB | `src/auth/MobileAuth.tsx` |
| 607 | 21 KB | `src/services/api.ts` |

That is ~76% of `src/` in five files. `AdminDashboard.web.tsx` alone contains the sidebar, header, stat grid, people/trips/reports/fleet/fares/terminals/settings pages, dialogs, CSV export, and inline fallback datasets.

**Direction (before or during integration):** split by page, e.g. `admin/pages/{Overview,People,Trips,Reports,Fleet,Fares,Settings}.tsx` plus `admin/AdminShell.tsx`; `passenger/screens/*` already exists as `passengerScreens.tsx` and can absorb more. Do this *before* swapping the data layer so the diff stays reviewable.

---

### R6 — The admin CSS string is injected twice

`src/admin/AdminDashboard.web.tsx:316` and `:1529` both render `<style>{adminDashboardStyles}</style>` inside different page branches. On navigation, the whole 15 KB stylesheet (including `@keyframes`) is re-mounted.

**Direction:** mount once in a layout/shell component (or use a `<style>` element created once), and keep only one `className="angkol-admin"` root. Also note the CSS is untyped: a typo silently does nothing, unlike `StyleSheet.create`.

---

### R7 — Two names for one map component

`src/map/CalbayogMap.tsx` is exactly:

```ts
export { default } from "./StaticMap";
```

Five files import `CalbayogMap` (`PassengerApp`, `DriverApp`, `passengerScreens`, `AdminDashboard.web`) while the implementation lives in `StaticMap.tsx`. `mapTypes.ts` (18 lines) defines the props contract.

**Direction:** pick one name. Keep the public name (`CalbayogMap`) and delete the alias — this matters for the map swap, because there should be exactly one file to replace.

---

### R8 — Admin exists only on web, and the native fallback is silent

`src/admin/AdminDashboard.tsx` (19 lines) is a platform stub that returns `null`; `AdminDashboard.web.tsx` holds the real UI. `AdminPanel.tsx` (355 lines, mobile-style `s` styles) is imported **only** by the web dashboard, so on iOS/Android an administrator signs in and sees a blank role surface.

This is a deliberate prototype decision (see the SRS/admin role list), but it should be stated in the README/AGENTS docs so nobody debugs a "missing screen" later. If admin on mobile is in scope, `AdminPanel.tsx` is the existing starting point.

---

### R9 — `api.ts` is transport + business rules + seeding + auth in one router

One `api()` function (607 lines) dispatches ~24 endpoints with `if/else if` on string paths, and inside those branches it:

- computes fares and quotes (`/quote`, `/book`, `/book-puj`),
- assigns drivers and timestamps,
- mutates nested `Snapshot` fields,
- calls `selectDemo()` (which **rebuilds the entire state**) during `/register`,
- keeps a `globalThis.__angkolPendingApplications` registry,
- returns `structuredClone(state)` for `/state`.

Concrete trap: `api.ts:290` — registering a PUJ driver calls `selectDemo("PUJ / PUV driver")`, wiping any trips/reports created earlier in the session before merging the new user. Acceptable for a demo; it must not be ported to a real adapter.

**Direction:** keep `api()` as a thin façade, but move rules into `src/domain/` (`fare.ts`, `dispatch.ts`, `schedule.ts`) and one module per resource (`services/{auth,trips,vehicles,routes,reports}.ts`). The adapter contract (`endpoint`, `input`, `method` → `T`) can stay unchanged so screens never notice.

---

### R10 — The clock is frozen

`src/services/api.ts:214` sets `serverTime: Date.now()` **once** at module initialisation. `/state` returns the same `state` object and never advances it. There is no `setInterval`/`setTimeout` anywhere in `src/` except two deliberate `await new Promise(...)` waits in `MobileAuth.tsx:322,351`.

Consequences while the app is open:

- "Next departure" never changes.
- Trip `expires` never passes, so `Requested` trips never go stale.
- Vehicle `location.updatedAt` never becomes stale (admin "stale" badge never triggers).
- "Today" on the earnings chart never rolls over.

**Direction:** integration must provide server time (`select now()` / gateway header) **and** a local ticking clock (e.g. a `useNow(30_000)` hook) so derived values recompute. Do not fix this by mutating `serverTime` inside `/state` — real time should come from the server.

---

### R11 — `connected` and `busy` are fake

`src/AngkolApp.tsx:60-61` passes a constant:

```ts
busy: false,
connected: true,
```

Every child accepts `busy`/`connected` and some render "Working…"/offline affordances that can never appear. No button is ever disabled by `busy` from the shell.

**Direction:** when the gateway is attached, drive `busy` from in-flight requests and `connected` from `@react-native-community/netinfo` + request failures. That is a 1-file change in `AngkolApp.tsx` — worth doing early because it validates every screen's loading state.

---

### R12 — Everything re-renders on every action

- `api()` returns `structuredClone(state)`; `action()` then calls `refresh()` which fetches `/state` again.
- Every screen receives the whole `Snapshot` and derives lists inline.
- There is **no `useMemo`, no `React.memo`, and no `FlatList`/`FlashList`** in `src/` (verified by search). Lists use `ScrollView` + `.map()`.

At 20–50 sample rows this is invisible. With real trip history it becomes a frame-drop problem, and with `ScrollView` it becomes a memory problem.

**Direction (after integration):** memoise derived arrays, split `Snapshot` into per-screen selectors, and use `FlashList`/`FlatList` for trips, reports, and the admin tables. Keep the visual layout identical.

---

### R13 — Domain rules written inside JSX

Examples in `AdminDashboard.web.tsx`:

- line 1411: `const pujVehicleTypes = ["Jeepney","Modern Jeepney","Bus","Mini Van","Coaster","SUV","PUV"]` declared inside the render branch;
- line 1413: `String(d.role || "").includes("PUJ") || ... || d.kind === "PUJ / PUV driver"`;
- lines 722–726: `demoFleet` fallback array built inline when `vehicles.length === 0`;
- numerous `(d: any)` / `(v: any)` casts that defeat the types in `types.ts`.

**Direction:** move "is this a PUJ/PUV driver?", "is this vehicle a PUV?", and role normalization into `src/domain/roles.ts` / `src/domain/vehicles.ts`. This is also where the real backend's enum values will need mapping — one place instead of five.

---

### R14 — Sample data overlaps and inherits the signed-in user

- `src/services/sampleTrips.ts` is consumed by **both** `driver/sampleDriverData.ts` and `admin/sampleAdministratorData.ts`.
- `sampleAdministratorData.ts:8-22` (`makePerson`) spreads `...state.user` into every fabricated person, so all sample users inherit the admin's `photo`, `phone`, and any other populated field unless explicitly overridden.
- `sampleDriverData.ts:14` reuses the same two trip templates seven times (only dates change), so the earnings chart shows repeating routes.

**Direction:** generate samples from a small fixture file with explicit per-person fields. This matters because these fixtures are the easiest thing to accidentally promote into production seed data.

---

### R15 — `npx tsc --noEmit` fails today (pre-existing)

**Evidence:** `npm run typecheck` reports exactly one error:

```
src/passenger/PassengerApp.tsx(886,21): error TS2322:
  Property 'expires' is missing in type '{…}' but required in type 'Quote'.
```

The ad-hoc PUJ trip literal (`PassengerApp.tsx:886-917`) sets `id, pickup, destination, pickupPoint, destinationPoint, distance, fare, minutes, passengerId, passenger, driverId, driver, plate, status, createdAt, timestamps, rating, sampleFare, fareReference, geometry` but omits `expires`, which `Trip` inherits from `Quote` (`types.ts:56`).

**Why it matters:** this blocks the `typecheck` gate that CI and the integration checklist rely on, so a *new* error introduced during integration would be indistinguishable from this known one. `eslint` passes, so it is easy to miss.

**Direction:** add `expires` to the literal (e.g. `Date.now() + 15 * 60_000`) — or make `expires` optional on `Quote` if expiry is not modeled for ad-hoc PUJ trips. It is a one-line fix, but it is a source change, so it was left for you to approve. Do this before Phase 5 of the integration guide.

---

## 4. Repetition map (quick reference)

| Concern | Where it already exists | Where it is duplicated |
|---|---|---|
| Brand colors | `passengerStyles.ts:2` | `adminDashboardStyles.ts:2` (CSS vars), `app.json` (`#0B5D45`), `_layout.tsx:69` |
| Buttons | `common/ui.tsx:17` (`Button`) | `MobileAuth.tsx` `SolidButton`, admin `.aa-button` CSS |
| Inputs | `common/ui.tsx:106` (`Field`) | `MobileAuth.tsx` inputs, `DriverApp.tsx` inline `TextInput` block (line ~120), admin `.aa-search` |
| Cards | `common/ui.tsx:155` (`Card`) | `passengerScreens.tsx` `Section`, `AdminPanel.tsx` `Card` usage |
| Empty state | `passengerScreens.tsx:97` | `AdminDashboard.web.tsx:133` |
| Money | `common/ui.tsx:5` (`money`) | inline `₱${...}` strings in admin/fare code |
| Day/time | `PassengerApp.tsx:170-182` | `DriverApp.tsx:135-142,287,548`, `passengerScreens.tsx:115` |

---

## 5. Things that look wrong but are intentional

These are correct for a static prototype — do **not** "fix" them as part of cleanup:

1. `api()` never touches the network, storage, or credentials (documented at `api.ts:256`).
2. Demo accounts with a shared password (`sampleAccounts.ts`).
3. `previewActions.ts` showing "simulated" alerts for Share/Linking/photo.
4. The map is a bundled image (`StaticMap.tsx`) — no tile requests.
5. `/book-puj` and the ad-hoc PUJ flow exist only in the prototype; the SRS covers scheduled PUJ service, so confirm the product intent before carrying this endpoint over.
6. Registration wait screens in `MobileAuth.tsx` (`setTimeout` 3 s / 5 s) simulate review latency.

---

## 6. Suggested order of work (safe, no UI change)

0. **Fix the existing typecheck failure** (R15) so the gate is green before anything else moves.
1. **Extract shared helpers** (R1, R2, R7) — pure moves, no visual diff.
2. **Promote duplicates into `common/ui.tsx`** (R3) and delete local copies.
3. **Create `src/theme/`** and fix the `common → passenger` dependency (R4).
4. **Split `AdminDashboard.web.tsx` and `PassengerApp.tsx` by page** (R5) *before* touching data.
5. **Split `api.ts` into domain modules behind the same `api()` façade** (R9).
6. **Then** attach Supabase / maps / GPS per `INTEGRATION_GUIDE.md`.

Steps 1–5 can each land as a separate commit with `npm run typecheck` and `npm run lint` clean, and none of them change what the user sees.
