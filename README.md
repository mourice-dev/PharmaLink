# PharmaLink

**Find medicine. Find a pharmacy.**

PharmaLink is a healthcare access platform concept for connecting patients with nearby pharmacies that report having a medicine in stock. It is designed for an initial Rwanda launch, with a future path toward pharmacy inventory management, pharmacy verification, administration tools, and approved healthcare data integrations.

## Project description

People can spend time and money visiting multiple pharmacies without knowing whether a medicine is available. PharmaLink aims to make that search easier through a public medicine catalogue, reported availability, pharmacy details, and location-based discovery. Participating pharmacies will eventually maintain their own inventory, while administrators verify pharmacies and oversee catalogue and platform data.

This repository currently contains a **public discovery experience prototype**. It includes a responsive landing page and a dedicated map page. Every time the map page opens, the browser requests the user's current location. After permission is granted, Leaflet centers on the user and searches within 1 km by default. Patients can search the demo medicine catalogue, see the mock pharmacies and quantities that list that medicine, select a pharmacy to draw a shortest walking route, and open walking directions in Google Maps or OpenStreetMap. The precise location is kept in page memory and is not saved in local storage.

> **Data notice:** Nearby pharmacy pins and walking streets come from OpenStreetMap and may be missing or out of date. Medicine stock quantities shown in search are generated demo values attached to those real mapped locations; availability is not confirmed. A Google Maps search link is provided to check a pharmacy listing externally, but the app does not verify listings through Google Places. No live inventory is connected. Patients should contact a pharmacy before travelling. This prototype must not be used for medical advice or medicine substitution.

## Current features

- Browse OpenStreetMap pharmacy listings within 1 km of the user's current location by default.
- Search the mock medicine catalogue to preview demo stock values beside actual nearby OpenStreetMap pharmacy locations.
- Narrow the search radius to 500 m, search nearby pharmacy names, and select map markers or list entries.
- Require browser location permission before displaying the nearby map and listings.
- Draw a shortest walking route on the map after selecting a pharmacy, with route distance, estimated time, and street names when the routing service returns them.
- Open walking directions in OpenStreetMap or Google Maps.
- Responsive desktop and mobile layouts.
- Clear notice that pharmacy stock data is not connected.

## Technology

- React and TypeScript
- Vite
- Leaflet and React Leaflet
- OpenStreetMap tiles and Overpass API
- Lucide icons
- Plain CSS

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Vite prints a local URL (usually `http://localhost:5173`). To create and preview a production build:

```bash
npm run build
npm run preview
```

## Repository layout

```text
src/
  App.tsx                 Public search and pharmacy discovery interface
  data/demoInventory.ts   Mock medicines and stock definitions; replace stock with an API adapter later
  main.tsx                React entry point
  styles.css              Responsive application styling
index.html      Vite page shell
```

## Roadmap

The supplied project blueprint describes a broader modular platform. The next substantial milestones are:

1. Establish an Express REST API and PostgreSQL database (with PostGIS for proximity search).
2. Add a maintained medicine catalogue and pharmacy registration with a verification workflow.
3. Implement secure authentication and role-based pharmacy and administrator portals.
4. Add batch-aware inventory, stock movement history, expiry checks, and availability freshness rules.
5. Replace the demo stock values in `src/data/demoInventory.ts` with a backend adapter for pharmacy-reported, timestamped inventory. Continue using verified pharmacy coordinates or a trusted live locations provider, then match those records with live stock.
6. Add audit logging, automated tests, Docker-based development, and deployment configuration.
7. Explore integrations only with authorized healthcare data providers.

The map uses OpenStreetMap's standard raster tiles with a muted CSS treatment and visible attribution. The public tile service is suitable for prototype traffic, not an uptime guarantee; review its usage policy and choose a production tile provider or self-hosted option before a public launch. Google Maps directions are universal links; an embedded Google Maps JavaScript map requires a Google Maps Platform key and billing configuration. Do not present stock as confirmed availability unless a reliable update process backs it. Regulatory catalogue data and pharmacy inventory are separate sources of information.

## Project identity

**PharmaLink — Connecting patients to medicines and pharmacies.**

This is a software project concept. It is not affiliated with a regulator or healthcare institution, and the name has not been cleared for commercial use.
