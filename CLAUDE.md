# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run / develop

There is no build step. Serve the directory and open it in a browser:

```
python3 -m http.server 8000      # any static server works
```

The app runs at `http://localhost:8000`. ES modules are loaded directly from `js/main.js`; Firebase comes from the `gstatic.com` CDN at version `12.12.1` — keep that version consistent across all `js/*.js` import URLs.

There are no tests, no linter, no package manager. Editing a file and reloading the page is the full dev loop.

## Configuration

`js/config.js` is gitignored and holds the real Firebase config + `ADMIN_EMAILS`. `js/config.example.js` is the committed template. When changing the config shape, update **both** files. If `js/config.js` is missing, the app fails at module load with an import error — that's the signal a fresh clone needs to copy the example.

The Firestore + Storage security rules in `README.md` reference the same admin email list as `js/config.js`. Both must be updated together when admins change.

## Architecture

Single-page collaborative board for one classroom. The data model lives in Firestore; the UI is a thin DOM layer on top of real-time subscriptions.

**Module layout** (`js/`):
- `firebase.js` — single source of `auth`, `db`, `storage` singletons. Every other module imports from here, never from the SDK URLs directly.
- `auth.js`, `posts.js`, `comments.js`, `settings.js` — each owns one Firestore concern and exports `subscribeX(cb)` returning an unsubscribe function, plus mutation helpers. They never touch the DOM.
- `admin.js` — `isAdmin(user)` (checks `ADMIN_EMAILS`) + `exportCSV(posts)`. Pure functions.
- `ui.js` — DOM helpers (`el`, `showModal`, `closeModal`, `toast`, `formatRelativeTime`). No app state.
- `main.js` — the only module that imports from everything else. Owns the `state` object, wires DOM events, and calls `subscribeX` to drive renders.

**Data flow.** Auth changes drive everything: `onAuthChange` in `main.js` (un)subscribes to `posts` and `settings`, opens the detail modal's `comments` subscription on demand, and tears them down on sign-out. The `state.posts` array is the single source the board renders from; search / category / sort happen in-memory in `filterAndSort` — never re-query Firestore for these.

**Pin ordering is handled in two places.** Firestore rules forbid non-admins from changing `pinned`; `filterAndSort` always partitions pinned posts to the top before applying the user's sort choice. If you add a new sort option, preserve that partition.

**Detail modal lifecycle.** `openDetail(p)` opens a comment subscription scoped to that post and uses a `MutationObserver` on `#modal-root` to detect when the modal closes (any path — Escape, overlay click, programmatic `closeModal()`) so the subscription is torn down. When `state.posts` updates and the detail modal is open for that post, `refreshDetailModal` re-renders the modal contents in place — keep this in sync if you add fields to the detail view.

**Image uploads** go to Firebase Storage at `post-images/{authorId}/{uuid}-{filename}`. The `imagePath` field on the post is used to delete the storage object when the post is deleted (best-effort, in `posts.deletePost`). Don't drop `imagePath` from the document or orphan files accumulate.

**Likes** are an array of UIDs (`arrayUnion`/`arrayRemove`). The Firestore rules permit any signed-in user to update **only** the `likes` and `updatedAt` fields — when adding new fields, decide whether they belong in the same "anyone can mutate" path or the stricter author-only path, and update the rules accordingly.

## Conventions

- All Firebase SDK imports use the **modular** API at `https://www.gstatic.com/firebasejs/12.12.1/...`. Don't mix in compat or namespaced imports.
- Modules export named functions only — no default exports, no classes.
- DOM construction uses `el(tag, attrs, ...children)` from `ui.js`. Event handlers go in `attrs` as `onclick: fn` etc. Avoid building HTML strings (use `el` or `escapeHtml` if a string is unavoidable).
- User feedback is via `toast(msg, kind)` — never `alert()` except for destructive `confirm()` prompts.
- Firestore timestamps come back as `Timestamp` objects, not numbers. Use `tsMs()` in `main.js` or `formatRelativeTime()` in `ui.js`; don't do arithmetic on them directly.
