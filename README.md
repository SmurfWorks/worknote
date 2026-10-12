# Worknote

A Vue 3 app for a daily note of what you worked on. Add as many entries a day as you like: type each one, or tap **Dictate** to fill it from your voice with the browser’s built-in speech recognition. No audio is saved; notes are kept in this device’s IndexedDB.

## Backup and delete

In Settings, **Backup to file** saves every note as a JSON file, and **Restore from file** replaces the notes on this device with a backup, after saying how many days and entries it holds. Reminder settings, the timezone and the reminder server stay with each device, so they are not in backups. **Delete all data** removes every note and setting from this device, withdraws the reminders booked for it, and shows the welcome again.

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