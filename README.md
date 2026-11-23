# Angkol static UI prototype

Run `npm install`, then `npm start` (or `npm run web`). Login identifies the role from the exact sample account email, without a role selector. Registration keeps its role selection and stores a sample account in memory until reload.

Sample password for all predefined accounts: `Angkol123!`.

| Role                | Email                   |
| ------------------- | ----------------------- |
| Passenger           | isabella@angkol.example |
| Tricycle driver     | miguel@angkol.example   |
| PUJ/PUV driver      | rafael@angkol.example   |
| Administrator (web) | patricia@angkol.example |

Unknown emails and incorrect sample passwords show an error. These fictional accounts simulate recognition locally; no real authentication or account storage is involved.

All screen data is fictional and bundled locally. Buttons simulate changes in memory. Leaving a preview or reloading resets changes. The map is drawn by the app. With `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env` it sits on Mapbox street tiles, and sample routes follow real roads from `src/map/roads.json` (refresh with `node --env-file=.env scripts/capture/roads.mjs`); without a token it falls back to plain paper. Otherwise location, calling, directions, and sharing are previews. No login, backend, credentials, GPS, map service, or database is required.

`src/api.ts` is an in-memory UI adapter and never makes network requests. Backend, Firebase configuration, credentials, and emulator tools have been removed.

Validation: `npm run lint` and `npm run typecheck`.

Code style: run `npm run format` to format the source, or `npm run format:check` to check formatting without changing files. Use two-space indentation, double quotes, and braces around conditionals.

The welcome screen uses the bundled Calbayog photo. Get started opens the restored sign-in screen. The earlier UI was restored from C:\dev\Angol; live services were replaced with local previews. A recovery archive of the prior redesign is saved in .recovery/before-design-restore.zip.

Visual style: clean and premium, using deep green, white surfaces, subtle borders, and the locally bundled Manrope font (license in assets/fonts). The welcome photo uses an AI-enhanced portrait version to reduce enlargement on phones; assets/calbayog-welcome.jpg retains the original supplied image.

The web portal opens administrator sign-in directly, with the Calbayog photo behind a transparent form; the dashboard keeps its white background. The mobile welcome screen is unchanged. Passenger home, routes, trips, and profile use the cohesive premium components in src/passengerScreens.tsx. All interactions still use the local sample adapter.
