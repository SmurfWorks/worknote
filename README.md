# Worknote

A Vue 3 app for weekday voice notes of what you worked on. Record in the browser, transcribe with the free built-in speech API, and keep everything in this device’s IndexedDB.

## Run it while developing

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Open it as a local file

```bash
npm run build
```

That writes a self-contained `docs/index.html`. Copy that file onto a computer or phone and open it in the browser — no web server required. Optional: copy `docs/favicon.svg` and `docs/icon.svg` alongside it if you want the tab/notification icons.

Routes use hashes (`index.html#/history`), so navigation works from `file://`.

If you later host Worknote on a real origin and want install-as-an-app plus a service worker, run `npm run build:pwa` instead.

## Access

The docs directory is included, so we can access this from GitHub Pages.