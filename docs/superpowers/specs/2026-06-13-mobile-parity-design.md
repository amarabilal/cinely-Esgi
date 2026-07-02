# Mobile parity with the web app — design

**Date:** 2026-06-13 · **App:** `apps/mobile` (Expo SDK 56, expo-router, TS) · **Branch:** `feat/mobile-react-native`

Bring the React Native app up to parity with the post-merge web app. Four phases, built in order, each verified on the emulator.

## Conventions (must follow)
- API via `@/lib/api` axios instance (`/api` base, Bearer auto-inject, 401 refresh). `X-Client-Platform: capacitor`.
- Theme tokens from `@/constants/theme` `Palette` (light only). Ionicons. `StyleSheet.create`.
- Screens = files under `src/app` (expo-router auto-routes; no manual Stack registration). Tabs registered in `src/app/(tabs)/_layout.tsx`.
- Bottom sheets = `<Modal>` + `useSheetLayout()` (`@/lib/sheet`).
- zustand stores in `src/stores`. Optimistic updates with revert-on-catch. `useFocusEffect` to reload on focus.

## Phase 1 — Quick parity wins
- **Pin**: `Note.isPinned` (add to type). `PATCH /notes/:id/pin` toggles, returns Note. List sorts pinned-first. NoteCard shows a pin glyph when pinned. Long-press a card → action sheet (Pin/Unpin · Archive · Delete). Editor header gets a pin toggle.
- **Templates**: `+` opens a template bottom sheet (ported `templates` constant: Blank, Meeting Notes, To-Do, Daily Journal, Project Plan, Bug Report). Pick → `POST /notes {title, content}` → open editor.
- **Trash**: `GET /notes/trash` → `app/trash.tsx`. Per-item **Restore** (`PATCH /notes/:id/restore`, 204) and **Delete forever** (`DELETE /notes/:id/permanent`, 204). "Empty trash" = `DELETE /notes/trash`. Reached via a "Trash" row in the filter sheet.
- **Word count / reading time**: editor shows `N words · M min read` (≈200 wpm) under the title.

## Phase 2 — In-app notifications
- `stores/notifications.ts`: `GET /notifications` (list, `{id,type,message,read,metadata,createdAt}`), unread count, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `DELETE /notifications/:id`. Live: socket auto-joins `user:<id>` on connect; listen `notification:new` → prepend + bump unread. Connect socket app-wide once authenticated.
- Bell icon + unread badge in the Notes header → `app/notifications.tsx` (list; tap a SHARE/EDIT row with `metadata.noteId` → open that note; mark read).

## Phase 3 — Google integration
- Backend (minimal, backward-compatible): `GET /api/google/auth` accepts `&platform=mobile` → encodes `state="<userId>|mobile"`; `GoogleCallbackController` splits state on `|`, and for the mobile flag redirects to `cinely://google?google_connected=success|error` instead of `FRONTEND_URL`. Web path unchanged.
- Mobile connect: `expo-web-browser` `openAuthSessionAsync(${API_BASE}/google/auth?token=<jwt>&platform=mobile, 'cinely://google')`. (Emulator caveat: the Google→backend redirect targets `localhost:3000/callback`; on a real device/prod with a public callback this completes. Status/disconnect/per-note actions work on emulator for an already-connected account.)
- `lib/google.ts`: `connect()`, `getStatus()` (`GET /google/status`), `disconnect()` (`POST /google/disconnect`), `exportDrive(noteId)`, `syncCalendar(noteId,{start,end})`, `sendEmail({to,subject,html})`, `listEvents(timeMin,timeMax)`.
- Settings: Google card (connected email, Connect/Disconnect, "Open Calendar").
- `app/calendar.tsx`: month grid from `GET /google/calendar-events`.
- Editor header overflow (`ellipsis`) → action sheet: Export to Drive · Add to Calendar (default now→+1h) · Email note (small modal: to/subject). Gated on connected status.

## Phase 4 — Notebooks (AI)
- `lib/notebooks.ts`: `GET/POST/PATCH/DELETE /notebooks`, `POST|DELETE /notebooks/:id/notes/:noteId`, `GET /notebooks/:id/messages`, `POST /notebooks/:id/chat {query,activeSourceIds?}` → `{userMessage, assistantMessage}` (sync, markdown content), `POST /notebooks/:id/generate-guide {type}` → `{title, content}`.
- New **Notebooks** tab (`(tabs)/notebooks.tsx`): list/create/delete notebooks.
- `app/notebook/[id].tsx`: manage source notes (add from a picker / remove), chat thread (user/assistant bubbles, markdown via `react-native-markdown-display`), "Generate" → pick a guide type → render result (and offer "save as note" via `POST /notes`).

## New deps
- `react-native-markdown-display` (notebook chat + guides). `expo-web-browser`, `expo-linking`, `expo-notifications` already installed.

## Navigation
- Tabs: Notes · Search · Dashboard · **Notebooks** · Settings (5).
- Stack routes (auto): `note/[id]` (exists), `notifications`, `trash`, `calendar`, `notebook/[id]`.

## Verification
- `npx tsc --noEmit` after each phase. Build release APK, install, screenshot each feature on the emulator. Backend build green after the Phase-3 change.
