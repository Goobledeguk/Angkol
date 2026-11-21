# Angkol

Calbayog City transport app built with Expo (React Native + web), Supabase, and Mapbox.

- **Accounts, data, and realtime:** Supabase Auth + Postgres + Realtime.
- **Map, route, distance, and place lookup:** Mapbox Static Images, Directions, and Geocoding APIs.
- **App:** Expo SDK 58 / Expo Router. Passenger, driver, and administrator experiences are in `src/`.

## Quick start

```bash
npm install
cp .env.example .env      # fill in the three values
npx expo start
```

Fill `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.<token>
```

Then run `supabase/schema.sql` once in the Supabase SQL editor. The full setup,
schema checklist, table list, and troubleshooting steps are in
[`LIVE_SETUP_GUIDE.md`](./docs/LIVE_SETUP_GUIDE.md).

## Commands

```bash
npm start                 # Expo dev server
npm run web               # web build/dev
npm run typecheck         # tsc --noEmit
npm run lint              # expo lint
npm run build:web         # static web export
npm run build:native      # android + ios export
```

## Project map

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router routes (`/sign-in`, `/`) |
| `src/auth/` | Sign-in, registration, and Supabase session helpers |
| `src/passenger/`, `src/driver/`, `src/admin/` | Role experiences |
| `src/services/api.ts` | Screens → Supabase adapter (the only data layer) |
| `src/services/supabase.ts` | Supabase client and configuration guard |
| `src/services/mapbox.ts` | Static map URL, directions, geocoding |
| `src/services/location.ts` | Foreground GPS sharing to `drivers` / `vehicles` |
| `supabase/schema.sql` | Tables, RLS, RPCs, triggers, seed data |

## Account roles

Register in the mobile app as a commuter, tricycle driver, or PUJ/PUV driver.
PUJ/PUV applications start as **pending** and are approved by a franchise owner
in the web portal. To create an administrator, register normally and then run
the promotion SQL in `LIVE_SETUP_GUIDE.md`.
