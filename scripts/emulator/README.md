# Driver emulators

Use approved test accounts in a test Supabase project. Both emulators update
real locations and booking records in the configured project.

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
Add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` for road directions. Without a token,
the emulators use straight lines when requesting a new path.
`EMULATOR_SPEED` sets the movement multiplier (default 4).

- `npm run emulate:drivers` runs tricycle drivers from
  `EMULATOR_DRIVERS=email:password,...`. They accept requests, drive to pickup,
  wait for boarding, and complete the ride at drop-off. Flags are
  `--speed=<n>`, `--board-wait=<seconds>`, and `--once`.
- `npm run emulate:pujs` runs jeepney drivers from
  `EMULATOR_PUJS=email:password,...`. The seed includes
  `driver3@angkol.test:Driver3!` on route CB01. Jeepneys park at the terminal,
  visit stops in the assigned order, board and drop off seat bookings, and
  return to the first terminal for the next run. Flags are `--speed=<n>`,
  `--dwell=<seconds>` (default 20), and `--loops=<n>` (default unlimited).

Pass flags after `--` with npm. You can also run either script directly, for
example `node --env-file=.env scripts/emulator/pujs.mjs --loops=1`.
Ctrl+C takes drivers offline and parks jeepneys. If a PUJ run was interrupted
after departure, finish it in the driver app before restarting the emulator.
