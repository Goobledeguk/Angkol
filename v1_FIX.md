# Antigravity Task Prompt: Angkol Frontend Restructuring, Role-Access Overhaul & Asset Integration

Please execute the following comprehensive structural, visual, and role-based architectural updates for the Project Angkol frontend repository based on the specifications below:

## 1. File & Folder Structure Restructuring
Restructure the `src/` directory to cleanly separate domain layers and components. Currently, files are flat under `src/`. Migrate and organize them into the following clean hierarchy
*(Make sure to update all internal relative import paths across files accordingly).*

---

## 2. UI Fixes: Text Compaction & Layouts
* Fix all layout bootstrap issues where text elements are compacted, overflowed, or incorrectly forced onto awkward new lines. Ensure proper flexbox wrapping, padding, and text scaling across mobile and web views.

* I've uploaded a new updated image-logo named "angkol-white-centered.png", **replace the mobile-auth image with the new image**. Also make the background-white opacity to background-black opacity 

---

## 3. Role-Based Access Control (RBAC) Overhaul
Refactor the administrative and monitoring tier into two distinct permission levels:

* **Create a new or rehaul the examples in sampleaccounts** to fit the RBAC. Make it that it servers to the right screen.

### Level A: Angkol Technical Team (Full Access)
* Retain full system-wide access to all features, including system health monitoring, infrastructure uptime, API response times, audit logs, and complete fleet tracking.
* Provide a toggle or separate view category for **Tricycle Monitoring** versus **PUJ/PUV Monitoring**.

### Level B: Vehicle / Franchise Owners (Limited Admin Access)
* Restructure the admin/owner dashboard view so that **PUJ/PUV Owners / Operators** only monitor their **own assigned vehicles**.
* Owners can monitor real-time vehicle status: whether the vehicle has **Arrived**, is **In Terminal**, or is **Broken / Inactive**.
* Owners can manage and adjust:
  * Their specific **Drivers' Information** (earnings, trip histories, profile info).
  * Their assigned **Routes and Terminals**.
  * **Limited Trip Info** restricted strictly to their own vehicle fleet.
  * A simplified owner **Overview** panel.

---

## 4. Dashboard & Analytics Refinements
* **Remove the Live Map Card** from the administrative dashboard overview.
* **Extend Trips by Hour Chart**:
  * Modify the hourly trip distribution graph to showcase a full **24-hour interval** (00:00 to 23:00).
  * If data fits across the 24 hours, display the full timeline; otherwise, dynamically show only the active/fitted operating hours with activity, keeping the axis clean and readable.

## 5. Route Guard 
* Create a route guard for the **web-admin control** applies for both tech and operators vehicle, so people couldn't access without auth. 

## 6. Splash Screen, App Icon & Skeleton Loading Architecture

Update the application's configuration and loading behavior with the following specifications:

### A. App Icon & Bundling
* **Expo Icon Configuration**: Ensure `app.json` (or Expo config) points the app icon and splash screen configuration directly to **`angkol-icon.png`** (located in `assets/` or your assets directory) so that no generic Expo placeholder text or default icons appear during bundling.

### B. Cold Start & Initial Boot
**Cold Start Experience**: Display a branded splash screen featuring `angkol-icon.png` during app boot and session token validation, utilizing the official brand green background color (`#0B5D45`) to ensure a seamless visual transition without white flashes.

### C. Data Fetching & Pre-Rendering (Skeleton Loaders)
* **Replace Generic Spinners**: Remove full-screen `ActivityIndicator` spinners used during data synchronization or screen transitions (e.g., when loading trips, driver feeds, or admin stats).
* **Implement Skeleton Loaders**: Use reusable skeleton loader components (pulsing/shimmering gray rectangular placeholders matching card, list, and table dimensions) across the Passenger, Driver, and Admin portals while data is being fetched.

## 7. . Interactive Slidable Bottom Sheet & Dynamic Image Scaling
* **Gesture-Driven Bottom Sheet**: Implement a slidable bottom sheet container on the mobile authentication/login view (utilizing `react-native-reanimated` and `react-native-gesture-handler`) enabling users to fluidly drag the card up and down.
* **Dynamic Image Resizing**: Bind the bottom sheet's vertical translation value using `interpolate()` so that the header background banner/logo shrinks and scales down smoothly as the user slides the card upward, optimizing screen estate for form inputs without breaking layout proportions. Include a clean drag handle indicator bar at the top of the sheet card.

## 8. Animation
* Animate Confirmation buttons with pulsing effect after confirming.
* Popovers starts at 0.95s