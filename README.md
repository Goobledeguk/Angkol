# Angkol static UI prototype

Run `npm install`, then `npm start` (or `npm run web`). Login identifies the role from the exact sample account email, without a role selector. Registration keeps its role selection and stores a sample account in memory until reload.

Sample password for all predefined accounts: `Angkol123!`.

| Role | Email |
| --- | --- |
| Passenger | isabella@angkol.example |
| Tricycle driver | miguel@angkol.example |
| PUJ/PUV driver | rafael@angkol.example |
| Administrator (web) | patricia@angkol.example |

Unknown emails and incorrect sample passwords show an error. These fictional accounts simulate recognition locally; no real authentication or account storage is involved.

All screen data is fictional and bundled locally. Buttons simulate changes in memory. Leaving a preview or reloading resets changes. The map is a bundled snapshot from the existing design; location, calling, directions, and sharing are previews. No login, backend, credentials, GPS, map service, or database is required.

`src/api.ts` is an in-memory UI adapter and never makes network requests. Backend, Firebase configuration, credentials, and emulator tools have been removed.

Validation: `npm run lint` and `npm run typecheck`.


Code style: run `npm run format` to format the source, or `npm run format:check` to check formatting without changing files. Use two-space indentation, double quotes, and braces around conditionals.
