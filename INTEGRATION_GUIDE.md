# Angkol — integration & build guide

**Purpose:** take this static Expo prototype to a working app (real database, real auth, real map, real GPS) **without changing the UI**.
**Companions:** `PROTOTYPE_REMARKS.md` (what to clean up first), `INTEGRATION_PROMPT.md` (schema SQL + migration checklist), `.env.example` (variable names), `DATA_FLOW_AND_SCREENS.md` (screen-by-screen state).

Everything below is a plan. No `/src` file has been modified.

---

## 0. How to read this

Work top to bottom. Each phase ends with a check you can run locally, so you never debug two things at once.

| Phase | Outcome | Touch these files |
|---|---|---|
| 1 | Env + dependencies installed | `.env`, `package.json`, `app.json` |
| 2 | Supabase client exists | `src/services/supabase.ts` **(new)** |
| 3 | Schema, RLS, RPCs deployed | Supabase SQL editor / `supabase/migrations` |
| 4 | Real sign-in / sign-up | `src/auth/sampleAccounts.ts`, `MobileAuth.tsx` |
| 5 | Real data behind the same `api()` signature | `src/services/api.ts` (+ domain modules) |
| 6 | Live updates | `src/AngkolApp.tsx` or `src/hooks/useRealtime.ts` **(new)** |
| 7 | Real GPS sharing | `DriverApp.tsx` toggle handler, `src/services/location.ts` **(new)** |
| 8 | Real map | `src/map/CalbayogMap.tsx`, `CalbayogMap.web.tsx` **(new)** |
| 9 | Real share/call/photo/payments | `src/services/previewActions.ts`, payment screen |
| 10 | Build + ship | `app.json`, `eas.json` **(new)** |

---

## 1. What you have today

```
src/app/_layout.tsx      fonts, splash, nav-bar colours, <Stack/>
src/app/index.tsx        native → WelcomeScreen, web → /sign-in
src/app/sign-in.tsx      re-exports AngkolApp
        │
        ▼
src/AngkolApp.tsx        owns Snapshot, notice, sharing
        │  api("/state") on mount, action() = mutate + refresh
        ├── Auth ──► MobileAuth   (sign-in / register sheet)
        ├── PassengerApp          (role Passenger)
        ├── DriverApp             (role Tricycle / PUJ driver)
        └── AdminDashboard.web    (role Administrator / Owner, web only)
                    │
                    ▼
src/services/api.ts      the entire "backend": module-level Snapshot,
                         ~24 endpoints, business rules, sample seeding
src/types/types.ts       the contract for every screen
```

Key invariants that must survive integration:

- `AngkolApp` props: `data`, `busy`, `connected`, `notice`, `dismissNotice`, `refresh`, `action`, `logout`.
- `action(endpoint, input?, method?) => Promise<boolean>` — screens only ever call this.
- Navigation: `useLocalSearchParams` + `router.setParams({ screen, trip, run })`.
- `Snapshot` shape in `src/types/types.ts` — extend, never break.

If a change forces edits inside a screen's JSX, the change is wrong.

---

## 2. Decisions to make before writing code

| Question | Options | Recommendation |
|---|---|---|
| Do you need a gateway? | (a) Supabase directly from the app, (b) REST gateway in front | Start with (a). Add a gateway only for fares/dispatch/SMS, which must not run on a phone. |
| Fare & ETA computed where? | client / Edge Function / gateway | **Server only.** The SRS has admin-approved fare matrices; a client-computed fare is trivially forged. |
| Map provider | `react-native-maps`, `expo-maps`, MapLibre | `react-native-maps` if you want Expo Go during development; `expo-maps` if you accept dev builds only. Both need a **separate web file** because the admin panel is web. |
| Payments | cash only / e-wallet | Model cash now (`payment_method`, `payment_status`), leave the e-wallet provider behind an interface. |
| Admin hosting | same web export / separate | Same `expo export --platform web`, served as an SPA with a rewrite to `index.html`. |
| Keep demo accounts? | yes/no | Keep behind `EXPO_PUBLIC_FEATURE_DEMO_ACCOUNTS` until UAT ends. |

---

## 3. Phase 1 — environment

1. Copy the template:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Fill at minimum: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAP_PROVIDER`, and the matching map key.
3. Leave `EXPO_PUBLIC_USE_SAMPLE_DATA=true` until Phase 5 is done.

Rules that bite (Expo SDK 58):

- Only `EXPO_PUBLIC_*` reach the bundle, and only when read as `process.env.EXPO_PUBLIC_NAME` (dot notation). `process.env["..."]` and destructuring are **not** inlined.
- Everything `EXPO_PUBLIC_*` is visible to users. Service-role keys stay in `eas.json`/CI only.
- `app.json` **cannot** read env vars. Native config that needs a key (Google Maps) must move to `app.config.js`, or the literal string reaches the native project.
- Changing a value requires a full app reload; changing a *name* requires restarting Metro.

Check:

```powershell
npx expo-doctor
```

> Known baseline: on a clean checkout `npx tsc --noEmit` currently reports one error in `src/passenger/PassengerApp.tsx:886` (missing `expires`). See `PROTOTYPE_REMARKS.md` R15. Fix it before you start, otherwise you cannot tell new type errors from this one.

---

## 4. Phase 2 — dependencies

```powershell
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install expo-location expo-image-picker
npx expo install react-native-maps
```

Notes:

- `npx expo install` (never `npm install`) so versions match SDK 58.
- `react-native-maps` works in Expo Go; a store build needs the Google Maps key via config plugin (Phase 8).
- If you pick `expo-maps` instead, it is **not** in Expo Go — every developer needs a development build.
- After adding native modules, Expo Go can no longer load the app: use `npx expo run:android` / `npx expo run:ios`, or `npx eas-cli@latest build --profile development`.

Check:

```powershell
npx tsc --noEmit
npx expo lint
```

---

## 5. Phase 3 — Supabase client

Create `src/services/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Expo Router owns deep links
  },
});
```

`detectSessionInUrl: false` matters: with Expo Router the URL is handled by the router, not by GoTrue.

Check: a throwaway `console.log(await supabase.auth.getSession())` on boot returns `{ session: null }` instead of throwing.

---

## 6. Phase 4 — schema, RLS, RPCs

The full DDL sketch is in `INTEGRATION_PROMPT.md` §9. Points that are easy to get wrong:

### 6.1 Tables

| TS type | Table | Notes |
|---|---|---|
| `User` | `profiles` (1:1 with `auth.users`) | `id` = `auth.users.id`. `role` and `admin_level` as Postgres enums. `owner_vehicle_ids` becomes a join table or `text[]`. |
| `Point` | `latitude`/`longitude` columns, or `geography(Point,4326)` | PostGIS is worth it for "nearest driver". |
| `Trip`/`Quote` | `trips` | `timestamps` is `jsonb` (matches `Partial<Record<Status, number>>`). `geometry` is `jsonb` GeoJSON or `geography(LineString)`. |
| `Route` | `routes` | `starts_at`/`ends_at` as `time`, not `text`, so the admin editor can validate. |
| `Terminal` | `terminals` | FK to `routes`. |
| `Vehicle` | `vehicles` | `location_updated_at timestamptz` replaces `updatedAt`; `stale` is derived, not stored. |
| `DriverRun` | `driver_runs` + `driver_run_events` | `events[]` must become a child table, otherwise realtime patches the whole array. |
| `StopRequest` | `stop_requests` | |
| `Report` | `reports` | |
| `Snapshot.notifications` | `notifications` | one row per recipient. |

### 6.2 RLS (minimum)

- `profiles`: users read/update their own row; admins read all; franchise owners read drivers whose `franchise_name` matches.
- `trips`: passenger sees own; driver sees assigned + `Requested` trips on their route; admin sees all.
- `vehicles`: drivers update only their own row; everyone authenticated can read (needed for the map).
- `reports`, `driver_runs`, `routes`, `terminals`, `fares`: admin-write, authenticated-read.

Never rely on a client-side `role` check. `role` in the JWT must be set by a trigger from `profiles`, or read through a `has_role()` SQL helper.

### 6.3 RPCs (server-side logic the UI already assumes)

| Existing behaviour | Replace with |
|---|---|
| `/quote` (`api.ts:320`) | `quote_trip(pickup, destination)` → distance, minutes, fare, geometry, expiry. Uses routing API + fare matrix. |
| `/book` (`api.ts:344`) | `book_trip(...)` → inserts trip, selects driver (nearest available, priority queue per SRS), returns the trip. Must be atomic. |
| Status transition (`/trips/:id`) | `transition_trip(id, next_status)` with a legal-transition guard. Otherwise two clients can race `Accepted` → `Completed`. |
| `/configure` (`api.ts:461`) | `upsert_route`, `upsert_terminal`, `upsert_fare` — admin/owner only. |
| `/runs/:id` (`api.ts:560`) | `record_run_event(run_id, stop, boarded, alighted)` so `onboard`/`cash_fares` cannot go negative. |

### 6.4 Indexes you will want immediately

`trips(status)`, `trips(passenger_id, created_at desc)`, `trips(driver_id, created_at desc)`, `vehicles(route_id)`, GiST on `vehicles.location`, `notifications(user_id, read)`.

Check: `npx supabase db diff` (or the SQL editor) applies cleanly on an empty project, and `select * from trips` under a passenger JWT returns only that passenger's rows.

---

## 7. Phase 5 — auth swap

`src/auth/sampleAccounts.ts` exposes `signInSampleAccount(email, password, persist?)` and `registerSampleAccount(...)`. `Auth.tsx` and `MobileAuth.tsx` call them directly; `AngkolApp` then calls `refresh()`.

### 7.1 Sign in

Keep the exported function names and signatures so `Auth.tsx` / `MobileAuth.tsx` do not change. Inside:

```ts
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
// then load the profile row; AngkolApp.refresh() will fetch /state anyway
```

### 7.2 Sign up

```ts
await supabase.auth.signUp({
  email,
  password,
  options: { data: { name, role, phone, license, plate, franchise_name } },
});
```

- A DB trigger on `auth.users` should insert the `profiles` row from `raw_user_meta_data`.
- Disable "Confirm email" in the Supabase dashboard during development; otherwise the session is `null` right after sign-up and the app looks broken.
- For production, wire the confirmation deep link (scheme `angkol-prototype` is already in `app.json`, `expo-linking` is installed).

### 7.3 Role routing (the part that silently breaks)

`AngkolApp` dispatches on `data.user.role`. Two guards:

1. Normalise the DB value to the exact literals in `types.ts` (`"PUJ / PUV driver"` etc.). A typo means a blank screen, not an error.
2. On boot, call `supabase.auth.getSession()` and `onAuthStateChange` → `refresh()`. Without this, a restored session shows the sign-in screen.

### 7.4 PUJ driver approval

`api.ts:270-295` currently registers PUJ drivers instantly and never exposes them to the franchise owner. In the real schema, insert `profiles.application_status = 'pending'` and let an admin set it to `accepted`. `pendingFranchiseApproval` drives the existing UI branch.

Check: sign in as each of the five roles; kill and relaunch the app; the role is still correct and no sample account is reachable.

---

## 8. Phase 6 — data adapter (the core work)

Do **not** let screens call `supabase` directly. Keep `api()` and replace its branches.

### 8.1 Endpoint → table map

| Endpoint | Replacement |
|---|---|
| `/state` | Parallel selects for the current role + `server_now()` RPC. Returns the same `Snapshot` shape. |
| `/login` / `/register` / `/logout` | Supabase Auth (§7). |
| `/search?q=` | `landmarks.select().ilike("name", `%${q}%`).limit(10)` or a Places API call server-side. |
| `/quote` | `rpc("quote_trip", …)` |
| `/book` | `rpc("book_trip", …)` |
| `/book-puj` | Confirm product intent first (see remarks §5). If kept, make it a `trips` insert with `service_type = 'puj'`. |
| `/trips/:id` PATCH | `rpc("transition_trip", …)`; `/decline` is a transition to `Cancelled`. |
| `/trips/:id/rating` | `trips.update({ rating })` guarded by `passenger_id = auth.uid()`. |
| `/profile` / `/profile/photo` | `profiles.update` + Storage upload to `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET`. Store the object path, not base64. |
| `/availability` | `profiles.update({ available })` + `vehicles` status. |
| `/notifications/read` | `notifications.update({ read: true })` for the current user. |
| `/report` / `/reports/:id` | `reports.insert` / `reports.update`. |
| `/vehicles` | `vehicles.insert` (owner only; enforce with RLS + `owner_id`). |
| `/vehicles/status`, `/vehicles/:id/status`, `/vehicles/:id` | `vehicles.update` with explicit column allow-list — the current `Object.assign(vehicle, body)` would let a caller overwrite `owner_id`. |
| `/drivers/:id` | `profiles.update` for verification/approval fields; admin-only. |
| `/configure` | `routes` / `terminals` / fare matrix upserts; admin/owner only. |
| `/stop` / `/stops/:id` DELETE | `stop_requests.insert` / `delete`. |
| `/runs` POST, `/runs/:id` PATCH | `driver_runs` insert + `record_run_event` RPC. |
| `/debug/pending-applications` | Delete. It exists only because registration is a local Map. |

### 8.2 Shape of the adapter

```ts
// keep this exact signature
export async function api<T>(endpoint: string, input?: unknown, method?: string): Promise<T> {
  switch (true) {
    case endpoint === "/state":      return (await loadSnapshot()) as T;
    case endpoint === "/quote":      return (await quote(input)) as T;
    // …
  }
}
```

Split the body into `src/services/{trips,vehicles,routes,reports,profiles}.ts` and `src/domain/{fare,dispatch,schedule}.ts`. `api()` becomes a 40-line dispatcher.

### 8.3 Non-negotiables

- **Server time.** `Snapshot.serverTime` must come from the DB (`select extract(epoch from now())*1000`), not `Date.now()` on the phone. Today it is frozen at module load (`api.ts:214`), which also means "next departure" never moves. Add a local `useNow()` tick so derived values recompute while the app is open.
- **Error mapping.** Screens expect `action()` to return `false` and set `notice`. Convert Supabase errors into the existing `ApiError` shape (`status`, message) so the current banner text keeps working.
- **No `structuredClone`.** Return fresh objects from the DB. If you keep an in-memory cache, clone at the boundary only.
- **Optimistic updates are optional.** The current `refresh()`-after-mutation pattern still works; just make `/state` cheap (one RPC returning JSON) before you optimise.
- **Time zones.** Postgres stores UTC; the UI formats with `Asia/Manila` everywhere. Do not switch to device-local time.

Check: with `EXPO_PUBLIC_USE_SAMPLE_DATA=false`, every screen still renders, and `action()` failures show the existing notice.

---

## 9. Phase 7 — realtime

Subscribe once, at the shell, and call `refresh()` on change:

```ts
supabase.channel(process.env.EXPO_PUBLIC_SUPABASE_REALTIME_CHANNEL!)
  .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, refresh)
  .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, refresh)
  .subscribe();
```

Requirements on the SQL side: `alter publication supabase_realtime add table trips, vehicles, notifications;` and, for filtered subscriptions, `replica identity full`.

Practical notes:

- `PassengerApp.tsx` already tracks `previousStatuses` to route to the receipt when a trip becomes `Completed`; a realtime refresh is enough to trigger it. No extra navigation code.
- Location rows update often. Prefer a narrowed subscription (`filter: vehicle_id=eq.…`) over refreshing the whole snapshot on every GPS ping.
- Unsubscribe on unmount, otherwise Fast Refresh stacks channels.

Check: two devices, one booking — the driver's request list appears within ~1 s without pull-to-refresh.

---

## 10. Phase 8 — GPS sharing

Today the driver toggle is `useState` only (`DriverApp.tsx` "Share location"), and `AngkolApp` holds a separate `sharing` boolean.

1. Ask permission with `expo-location` (`requestForegroundPermissionsAsync`).
2. While sharing: `watchPositionAsync({ accuracy: High, timeInterval: EXPO_PUBLIC_LOCATION_INTERVAL_MS, distanceInterval: EXPO_PUBLIC_LOCATION_DISTANCE_M }, cb)`.
3. On each fix, update `vehicles.location` + `location_updated_at` and `profiles.location`. Throttle to one write every 5–10 s; do not write per fix.
4. Stop the subscription when the toggle is off or the driver signs out.
5. For background tracking you need `expo-task-manager` + a development build + `ACCESS_BACKGROUND_LOCATION`, plus a foreground-service notification on Android. Do this only if the SRS requires tracking with the screen off — it changes store review.

`stale` in the admin fleet view should become `now - location_updated_at > 60s` (SQL expression or a derived field in `/state`), not a stored boolean.

Check: toggling sharing moves the marker on a second device; killing the app leaves the last known location and flips the row to stale after the threshold.

---

## 11. Phase 9 — map swap

### 11.1 The real contract

`src/map/mapTypes.ts` declares:

```ts
MapProps = { pickupLabel, destinationLabel, pickupColor, destinationColor, terminalColors,
             height, mode, pickup, destination, geometry, landmarks, vehicles,
             terminals, stops, onSelect }
```

`StaticMap.tsx` only uses `height`, `mode`, `pickup`, `destination`, `onSelect`. It **silently ignores** `geometry`, `vehicles`, `terminals`, `stops`, `landmarks`, `pickupLabel`, colours. Screens already pass them (`passengerScreens.tsx:387-390` passes vehicles and terminals; `AdminDashboard.web.tsx:1891` passes `geometry` and `vehicles`).

So the map phase is not a drop-in: the new component must actually render every prop that screens already send, or the UI loses markers that the current design implies.

Also: `onSelect` currently ignores the tap and returns a fixed point (`StaticMap.tsx:13-18`). A real map must convert the tap to coordinates and reverse-geocode it (or keep a "select from list" fallback). Otherwise "pick on map" remains fake after integration.

### 11.2 File layout (works for native + web)

```
src/map/
  mapTypes.ts        contract (unchanged)
  CalbayogMap.tsx    native implementation (react-native-maps or expo-maps)
  CalbayogMap.web.tsx web implementation (MapLibre GL JS)
  StaticMap.tsx      delete once both exist
```

Metro resolves `.web.tsx` first on web, so no import changes anywhere. Also delete the one-line `CalbayogMap.tsx` re-export (remarks R7) — the name should point at the real implementation.

### 11.3 Native

`react-native-maps`:

```tsx
<MapView provider={PROVIDER_GOOGLE} initialRegion={{ latitude: 12.0667, longitude: 124.5953, latitudeDelta: 0.03, longitudeDelta: 0.03 }} />
```

- Expo Go works without a key; store builds need the config plugin + key.
- Because `app.json` cannot read env, move to `app.config.js`:

```js
export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ["react-native-maps", {
      androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    }],
  ],
});
```

- Restrict the Google key to the Android package + SHA-1 and the iOS bundle id.
- Draw `geometry` as `<Polyline coordinates={…}>`, `vehicles`/`terminals` as `<Marker>`, `stops` as small markers, `landmarks` as a non-interactive layer.

`expo-maps` alternative: `GoogleMaps.View` / `AppleMaps.View`, `markers`, `polylines`, `onMapClick`. Requires iOS 17+, no Expo Go, no web.

### 11.4 Web

Use `maplibre-gl` (or `mapbox-gl`) in `CalbayogMap.web.tsx`; render the same props. Keep the same `height` and `borderRadius: 18` container so layout does not shift. Do not import `react-native-maps` on web — it has no web implementation and will crash the admin bundle.

### 11.5 Keys & tiles

- Google: enable **Maps SDK for Android** and **Maps SDK for iOS** in one Cloud project.
- MapLibre: point `EXPO_PUBLIC_MAP_STYLE_URL` at your style JSON; attribute per the tile provider's terms.
- Directions (the current "Directions" button) needs a routing API; `previewActions.ts` only shows an alert today.

Check: the passenger "track driver" screen shows the route line and a moving marker; the admin "Fleet tracking" page shows the same vehicles; nothing throws on `expo export --platform web`.

---

## 12. Phase 10 — device services & payments

`src/services/previewActions.ts` is 24 lines of `Alert.alert`. Replace each export, keep the names:

| Export | Real implementation |
|---|---|
| `Share` | `import { Share } from "react-native"` → `Share.share({ message, title })` |
| `Linking` | `import * as Linking from "expo-linking"` → `openURL("tel:…")`, `openURL(directionsUrl)` |
| `pickDriverPhoto` | `expo-image-picker` → upload to Storage → return the public/signed URL |

Upload pattern:

```ts
const path = `${userId}/${Date.now()}.jpg`;
await supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType: "image/jpeg" });
const { data } = supabase.storage.from(bucket).getPublicUrl(path);
```

`DriverAvatar.tsx` only renders a photo when it starts with `data:image/`. Decide: either keep base64 (simple, large payloads) or extend the component to accept `https://` URLs. The second is better; it is a 3-line change and does not alter the design.

**Payments.** `Trip.demoPayment` is a literal type `{ status: "Test succeeded", realMoneyCharged: false }`. For integration:

1. Add `payment_method` (`cash` | `gcash` | `maya` | `bank`) and `payment_status` (`unpaid` | `paid` | `refunded`) to `trips`.
2. Keep the current "Completed → receipt" flow for cash.
3. Put any online provider behind `src/services/payments.ts`; never let the client set `payment_status = 'paid'` — use a webhook/Edge Function.

Check: tapping Share/Call/Directions on a device opens the OS sheet; the photo persists after reload.

---

## 13. Phase 11 — build & ship

### 13.1 Local

```powershell
npx expo start            # dev server (press a / i / w)
npx tsc --noEmit          # typecheck
npx expo lint             # lint
npm run build:web         # expo export --platform web -> dist/
npm run build:native      # expo export --platform android --platform ios -> dist-native/
```

`npm run build:web` produces a static SPA. Host it with a rewrite of all paths to `index.html`; `/sign-in` is a client route, so a plain static host that 404s on `/sign-in` will break the admin panel.

### 13.2 app.json additions

```jsonc
{
  "expo": {
    "android": { "package": "com.yourorg.angkol" },
    "ios": { "bundleIdentifier": "com.yourorg.angkol" },
    "plugins": [
      "expo-router",
      "expo-font",
      ["expo-location", { "locationWhenInUsePermission": "Angkol uses your location to match you with nearby drivers." }],
      ["expo-image-picker", { "photosPermission": "Angkol uses your photo for your driver profile." }]
    ]
  }
}
```

Keep `scheme: "angkol-prototype"` (change it only if you also change `EXPO_PUBLIC_APP_SCHEME`). Add `extra.eas.projectId` through `eas init`, not by hand.

**Do not create `ios/` or `android/` by hand.** They are generated (CNG); native config belongs in `app.json` / config plugins.

### 13.3 EAS

```powershell
npx eas-cli@latest init                     # creates/link project, adds projectId
npx eas-cli@latest build:configure          # writes eas.json
npx eas-cli@latest build --profile development
npx eas-cli@latest build --profile preview
npx eas-cli@latest submit --profile production
```

`eas.json` needs one env block per profile (or EAS environment variables):

```jsonc
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal",
      "env": { "EXPO_PUBLIC_APP_ENV": "development" } },
    "preview": { "distribution": "internal",
      "env": { "EXPO_PUBLIC_APP_ENV": "staging" } },
    "production": {
      "env": { "EXPO_PUBLIC_APP_ENV": "production" } }
  }
}
```

`EXPO_PUBLIC_*` values are inlined at bundle time, so a build with the wrong env is permanently wrong — verify the project ref before shipping. Service-role keys must be EAS **secrets**, never `env`.

OTA updates (`eas update`) ship JS only; a new native module or permission string requires a new binary.

Check: a development build installs on a physical Android device, sign-in works against the real project, and the map renders tiles over mobile data.

---

## 14. Verification checklist

Run in this order; stop at the first failure.

- [ ] `npx expo-doctor` clean; `npx tsc --noEmit` clean; `npx expo lint` clean.
- [ ] `.env` present, `EXPO_PUBLIC_SUPABASE_URL` points at the intended project.
- [ ] Web: `/sign-in` loads, no console errors, no request to `localhost` in production build.
- [ ] Sign in as Passenger → book → driver accepts (second device) → status updates live → receipt.
- [ ] Sign in as Tricycle driver → incoming request appears without refresh → accept → arrive → complete.
- [ ] Sign in as PUJ driver → run starts → boarding counts persist across reload.
- [ ] Sign in as Administrator (web) → people/trips/reports/fleet/fares pages load real rows; CSV export works.
- [ ] Franchise owner sees only their drivers/vehicles.
- [ ] Kill the app mid-trip → relaunch → correct screen and data.
- [ ] Airplane mode → action fails with the existing notice, app does not crash.
- [ ] Background/foreground → realtime reconnects (channel is not left dead).
- [ ] `expo export --platform web` succeeds; the exported site works on a host with SPA rewrites.

---

## 15. Risks & rollback

| Risk | Mitigation |
|---|---|
| Screens start importing `supabase` directly, spreading coupling | Enforce: only `src/services/**` may import `supabase`. Add an ESLint `no-restricted-imports` rule later. |
| A schema change breaks `types.ts` for many screens | Add columns as nullable, map in `loadSnapshot()`, never rename a field a screen reads. |
| Realtime storms from GPS writes | Filter subscriptions by `vehicle_id`; throttle writes. |
| Fare/`role` trusted from the client | RPC + RLS; the client only displays. |
| Web build breaks after adding native modules | Keep the web map in `CalbayogMap.web.tsx`; never import native-only modules in shared files. |
| Integration stalls halfway | `EXPO_PUBLIC_USE_SAMPLE_DATA=true` keeps the prototype usable; migrate one endpoint at a time and ship behind the flag. |

Rollback is per-endpoint: the adapter is a dispatcher, so `if (USE_SAMPLE_DATA) return legacyApi(endpoint, input, method)` keeps a working demo while a given endpoint is being replaced.

---

## Appendix A — responsibility map after integration

| Layer | Files | Owns |
|---|---|---|
| Shell | `src/AngkolApp.tsx` | session, `Snapshot`, notices, `busy`/`connected` |
| Adapter | `src/services/api.ts` + `services/*.ts` | endpoint → Supabase/RPC, error mapping, server time |
| Domain | `src/domain/*.ts` **(new)** | fares, dispatch order, schedules, role normalisation |
| Auth | `src/auth/*` | Supabase Auth calls, profile bootstrap |
| Realtime | `src/hooks/useRealtime.ts` **(new)** | subscriptions → `refresh()` |
| Location | `src/services/location.ts` **(new)** | permissions, watch, throttled writes |
| Map | `src/map/CalbayogMap{,.web}.tsx` | rendering `MapProps`, tap → geocode |
| Device | `src/services/previewActions.ts` | Share, Linking, image picker |
| UI | `src/passenger/*`, `src/driver/*`, `src/admin/*`, `src/common/*` | unchanged layout, unchanged styles |

If a change requires editing a file in the last row for anything other than an import swap, revisit the design before proceeding.
