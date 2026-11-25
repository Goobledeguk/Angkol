# Angkol — Simple Summary

Angkol is a Calbayog City transport app built with **Expo / React Native**, **Expo Router**, **Supabase**, and **Mapbox**. One codebase runs the passenger app, the driver app, and the web admin dashboard.

## Run it

```bash
npm install
# fill in the three values in .env
npx expo start          # mobile
npx expo start --web    # admin / web
```

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint
npm test                # jest
npm run build:web       # static web export
npm run build:native    # Android + iOS export
```

Required environment variables (only these three):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=...
```

Supabase must have **Confirm email turned off**; the app has no verification callback. Full setup, builds, and GPS notes are in `docs/LIVE_SETUP_GUIDE.md`.

## How the folders fit together

```
src/
  app/          Expo Router entry screens (index, sign-in, reset-password, capture)
  auth/         Welcome, sign-in/sign-up, session storage, password reset
  passenger/    Passenger app screens, styles, countdown, rating, ticket
  driver/       Driver app screens, pending-approval screen
  admin/        Web admin dashboard, admin editor panels, dashboard CSS
  common/       Shared UI (buttons, avatar, glyphs, logo, confirmations)
  domain/       Pure rules: fares/format, roles, schedules, service area, vehicles
  map/          Mapbox map, route diagram, geolocation helpers
  services/     Supabase/API calls, snapshot mappers, location, Mapbox, image picker
  types/        Shared TypeScript models
supabase/
  migrations/   Source of truth for the database (run in filename order)
docs/           Setup, data-flow, and summary documentation
```

`src/app/index.tsx` picks the right app by signed-in role:

- Passenger → `src/passenger/PassengerApp.tsx`
- Tricycle / PUJ-PUV driver → `src/driver/DriverApp.tsx`
- Administrator / vehicle owner → `src/admin/AdminDashboard.web.tsx` on web

## Data flow (happy path)

1. **Auth** — Supabase Auth signs the user in; `auth/session.ts` keeps the session.
2. **Profile** — `services/api.ts` loads the app snapshot (profile, trips, routes, vehicles, users, notifications).
3. **Ride request** — passenger picks pickup/destination; fare is quoted; a booking is inserted.
4. **Matching** — available tricycle drivers see the request, nearest first; a driver accepts it.
   Declining puts the request back in the queue. Matching is **not** exclusive auto-dispatch.
5. **Trip** — status moves `Requested → Accepted → Arrived → In progress → Completed`
   (or `Cancelled` / `Expired`). The database functions enforce the allowed moves.
6. **Realtime** — Supabase realtime refresh keeps the other phone in sync.
7. **GPS** — `services/location.ts` shares the driver's position into `vehicle_locations`;
   Mapbox draws the map and route geometry.
8. **Admin** — admins read `admin_users` / `admin_drivers` RPCs, edit fares, approve drivers,
   and review audit logs.

The app only talks to Supabase and Mapbox. There is no extra backend.

## Database quick map

Main tables: `users`, `drivers`, `vehicles`, `routes`, `terminals`, `terminal_schedules`,
`fare_matrices`, `bookings`, `trip_records`, `vehicle_locations`, `driver_runs`,
`driver_run_events`, `stop_requests`, `reports`, `notifications`, `landmarks`,
`audit_logs`, `data_analysis`.

Key functions in the migrations include `transition_booking`, `release_booking`,
`rate_booking`, `my_profile`, `admin_users`, `admin_drivers`, `start_run`,
`advance_run`, and `delete_my_account`.

`supabase/migrations/` is the source of truth. A fresh project runs every migration
in filename order. An existing project only needs migrations it has not applied yet.

## Profiles and avatars

- `src/common/Avatar.tsx` shows the uploaded photo, or the user's **initials**
  (`Karen Davila` → `KD`) when there is no photo.
- `src/common/initials.ts` is the shared initials helper.
- Passengers and drivers can add, change, or remove a photo from their profile.
  The photo is stored as a small JPEG data URI in `users.photo`.
- The web admin shows the same fallback and can upload a photo from **Your account**.
- Profile screens are laid out with wrapping/truncation rules so long names and
  contact details do not overflow on phones or web.

## Demo / test data

- `supabase/seed.sql` adds fictional Calbayog accounts, vehicles, and ride history
  on top of the migrations. It is safe to re-run.
- `supabase/seed_authfix.sql` sets admin/owner roles and approves demo drivers.
- Some routes, landmarks, and demo driver locations are seeded directly by the
  migrations.

Test accounts are fictional and documented at the top of `supabase/seed.sql`.
Never run test seeds against a production project. Admin roles cannot be chosen
at sign-up; promote a user with SQL when you need a real admin.

