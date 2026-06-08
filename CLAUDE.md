# Claude Code — repo conventions

This file is auto-loaded by Claude Code into every session opened in this repo. It captures the workflow patterns, design-system context, and project rules so they don't have to be re-learned each conversation.

## What this repo is

`cinely-Esgi` — a notes app with a NestJS + TypeORM + Postgres backend and a Vite + Vue 3 frontend. Monorepo layout: `apps/backend` and `apps/frontend`.

## What just landed on `feat/design-system-cluster-offline`

The frontend's design system (tokens, fonts, primitives, prose, dark mode, transitions) was ported from a sister project — `cluster-offline` — onto this branch. Source of truth for the *visual language* is now this branch; application logic stays cinely's own.

Commit: `bd9f023 feat(frontend): port design system from cluster-offline …`

The cluster-offline repo is the reference for any pattern not yet present here: https://github.com/duongdk099/cluster-offline (look in `front/`).

## Working rules

These carry over from the cluster-offline sessions and apply here too:

### 1. Delegate by default — never the thinking

For every substantive task in this repo, spawn a subagent via the Agent tool (or stages inside a Workflow) and have it execute the edits / commands / investigation. The main loop is responsible for:

- Deciding what needs to happen
- Writing a **specific brief** for the subagent (file paths, line numbers, expected behaviour — never "figure out what to do")
- Verifying the result after the subagent returns (Read the changed files, run tests/lint, sanity-check the diff)

**Do NOT pass `model` to `Agent` or to `agent()` inside a Workflow** — subagents inherit the parent session's model.

Solo only on conversational turns or genuinely trivial mechanical edits (a one-line typo fix, this kind of doc write). Even then, call it out.

### 2. No hardcoded config / magic numbers

- No raw `process.env.X` reads scattered across domain/application/infrastructure modules. Read all env in one place (`apps/backend/src/config.ts` if needed — pattern from cluster-offline) and import a typed `config` object everywhere else.
- No magic numbers in code (limits, sizes, timeouts, model names, base URLs). Named exports from the config module.
- AI model names, base URLs, embedding dimensions — env-overridable with sensible defaults.

### 3. Trust but verify

A subagent's summary describes what it *intended* to do, not necessarily what it actually did. Always Read the changed files (or grep for the key markers) before reporting "done" to the user.

### 4. Parallel work uses one tool-use block

If you're launching multiple Agent calls that are genuinely independent, send them in a single message so they run concurrently. Same for multiple Bash / Read / Grep calls.

## Frontend design system (`apps/frontend`)

### Stack

| Layer | Tool |
|---|---|
| Framework | Vite + Vue 3 (NOT Nuxt) |
| Tailwind | v3.4 with `darkMode: 'class'`, HSL-token colors |
| Components | shadcn-vue primitives (vanilla, no auto-import) |
| State | Pinia |
| Router | vue-router |
| HTTP | axios |
| Editor | TipTap starter-kit |
| Path alias | `@/` → `src/` (configured in vite.config.ts + tsconfig.json) |

### Key files / locations

- `src/assets/main.css` — `@layer base` (root + dark token blocks, theme transitions, view-transitions crossfade), `@layer components` (prose, tables, checklists), `@layer utilities` (page transitions, drag affordances, scrollbar).
- `tailwind.config.js` — v3 token-based config. **Do not hardcode hex / oklch colours in components**; use the semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, etc.).
- `src/lib/utils.ts` — the `cn(...)` helper (clsx + tailwind-merge). All shadcn-vue primitives import it via `@/lib/utils`.
- `src/components/ui/` — shadcn-vue primitives (Button, Card, Badge, Skeleton, Separator, Kbd). Add more via `npx shadcn-vue@latest add <name>` or copy from cluster-offline and rewrite `~/` → `@/`.
- `src/composables/useColorMode.ts` — vanilla dark-mode toggle with localStorage persistence + `prefers-color-scheme` fallback. Uses the `theme-switching` class for atomic swaps.
- `index.html` — Inter + JetBrains Mono font links (don't remove; the design assumes them).

### Patterns to follow

- **Theme tokens, not raw colours.** `bg-primary` not `bg-blue-500`. If a colour is missing from the palette, add a new CSS variable in `:root` and `.dark`, then a Tailwind token in `tailwind.config.js`.
- **Primitives, not ad-hoc buttons.** Reach for `<Button variant="ghost" size="icon">` rather than a hand-rolled `<button class="...">`. Variants live in cva inside each primitive.
- **Prose for rendered note content.** Wrap rendered content in `class="prose prose-zinc dark:prose-invert max-w-none"`. The table + checklist fixes (first/last-cell padding, label `font: inherit; height: 1lh;`, `!important` `<p>` margin resets) are already in `main.css` — don't duplicate them inline.
- **Dark-mode-aware components.** Every component should look right in both light and dark. Test via the toggle in `App.vue` (or whatever lives there after views are fleshed out).

### What was intentionally NOT ported from cluster-offline

The following were tied to cluster-offline's backend (its tags, folders, AI endpoints, share tokens, RAG pipeline) and were left out on purpose:

- `AIPanel.vue` (DeepSeek summarise / auto-tag / detect-actions)
- `SharePanel.vue` (public link visibility toggle)
- `AskPanel.vue` (RAG ask-your-notes)
- `NoteCard.vue`, `NoteList.vue`, `AppSidebar.vue`, `AppTopBar.vue`, `MainEditor.vue` — tied to cluster-offline routing + composables
- `composables/useNotes.ts`, `useNoteEditor.ts`, `useAi.ts`, `useRag.ts`
- `services/notesService.ts`, `aiService.ts`, `ragService.ts`, `shareService.ts`
- `pages/` — Nuxt file-based routing; cinely uses Vue Router

If you need to recreate any of these for cinely, **don't copy verbatim**. Cinely's backend has different endpoints, different DTOs, different auth shape (NestJS + TypeORM, JWT in cookies probably). Read cinely's `src/api/*.api.ts` and `src/stores/*.store.ts` first, then compose new views on top of the *primitives* that did port (`<Button>`, `<Card>`, `<Badge>`, etc.).

## Continuing the design system

### Adding a new token

1. Add CSS variable to both `:root` and `.dark` in `src/assets/main.css`.
2. Reference it via `hsl(var(--your-token))` in `tailwind.config.js` under `theme.extend.colors`.
3. Use semantically: `bg-your-token`, `text-your-token`, etc.

### Adding a new shadcn-vue primitive

Either:
- `npx shadcn-vue@latest add <name>` (will land in `src/components/ui/<name>/`), then verify imports use `@/lib/utils`.
- OR copy verbatim from `cluster-offline/front/components/ui/<name>/`, then run `sed`/Edit on the `~/` paths to make them `@/`.

The ones that are already here: Button, Card (with header/title/description/content/footer), Badge, Skeleton, Separator, Kbd.

## Reference

- Source design system: https://github.com/duongdk099/cluster-offline (look at `front/assets/css/main.css`, `front/tailwind.config.ts`, `front/components/ui/`)
- shadcn-vue docs: https://www.shadcn-vue.com
- Tailwind CSS v3 docs: https://v3.tailwindcss.com (this repo is on v3; cluster-offline is on v4 — most class names are the same but the **config syntax differs**: v4 uses `@theme inline {}` and `@plugin "..."` in CSS, v3 uses `tailwind.config.js`)
