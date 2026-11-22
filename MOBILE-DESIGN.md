# Angkol design notes

What the UI is built on, so later changes keep it consistent.

## Direction

- **Product:** book tricycles and board jeepneys in Calbayog at the city's fixed fare, paid to the driver in cash.
- **Character:** plain, exact, street-level.
- **World:** TODA body numbers on sidecars, LTO plates, terminal fare boards.
- **Moment:** the body-number plate (`src/common/BodyNumber.tsx`). It is the one place the condensed display face and the plate yellow appear, because riders match it against a real vehicle.
- **Signature:** the stop rail. A ring marks the pickup and a filled square marks the drop-off, both on the map (`src/map/RouteDiagram.tsx`) and in lists (`src/common/RouteBoard.tsx`).

## Tokens

These live in `src/passenger/passengerStyles.ts` (`passengerColors`, `ps`), and `src/admin/adminDashboardStyles.ts` covers the web admin.

- **Brand green `#0F5D45`:** from the app icon. Primary actions (white text), the active tab, route lines, vehicle markers on the map, the driver's online card, today's chart bar. `brandSoft #E4EFE9` for selected states, `brandDeep #0A4434` for dark panels.
- **Leaf `#00A651`:** the icon's bright stripe. Only "live" states: the online switch and the jeepney board edge.
- **Ink `#14201A` / muted `#56625B` / line `#DCE4DF` / surface `#F1F5F2`:** green-leaning neutrals. No pure black chrome: the nav bar is white with a hairline, icon buttons are round with a hairline.
- **Plate yellow `#F6C744`:** the body-number plate only, because real TODA plates are yellow.
- **Red `#C8321B`:** errors, destructive actions and the unread dot only.
- **Cards:** white with a 1px `line` hairline, radius 10. Grey filled cards are retired.
- **Type:** Archivo 400/500/600 in sentence case. `ArchivoBoard` (condensed display) is used for money totals, plates and PARA!. No uppercase labels anywhere else.
- **Money:** `money()` in `src/common/ui.tsx` renders `₱1,271.00`.

## Rules

- Copy states what is on screen. No greeting headlines, no taglines, no exclamation marks except PARA!.
- Map labels go through `placeLabels()`. Pickup and drop-off labels are always drawn, and context labels drop out rather than overlap.
- Live trip screens let the map fill the space above the sheet, so there is no dead band.
- Admin: KPI tiles only on Overview. Every other page leads with its queue or table. Minimum text is 12–13px.

## Store screenshots

- `node scripts/capture/capture.mjs` captures the raw screens from `/capture` (Expo web on :8081) using `src/testing/captureScenes.ts`.
- `node scripts/capture/store.mjs` composes 10 App Store shots (1320×2868) and 8 Google Play shots (1080×1920, 9:16), plus the 1024×500 feature graphic.
- Copy sits in normal flow above the art, so nothing can cover it. Phones are upright and run off the bottom edge.
- If a capture looks stale, restart Metro with `--clear`; its watcher can miss edits.
