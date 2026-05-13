# BDM Decks

Region-aware merchant pitch deck app, forked from the Stripe Sessions deck.

Landing page lets the presenter pick:
- A merchant / acquirer bank / partner (autocompletes from the curated CSVs)
- A target region (Americas / LATAM / Europe / APAC / MENAT)

The chosen region drives the closing slide (`SlideRegionalConnections`), which
shows the local processors Yuno covers in every market of that region.

Stack: Vite + React 19, deployed via Biofrost.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm start` — serve the production bundle (Express, used by Biofrost)

## Layout

- `src/components/LandingPage.jsx` — merchant search + region pill
- `src/components/slides/SlideRegionalConnections.jsx` — final region slide
- `src/data/regional-connections.js` — region → country → processors data
