# Gathir — Architecture & conventions

Read with `docs/PLAN.md` (what to build) and `CLAUDE.md` (hard rules). This file says **where code goes and how modules talk**.

## Stack facts (Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6)
- **Expo docs are unreachable from the build machine.** Treat the installed type definitions in `node_modules/**/build/*.d.ts` (or `lib/typescript`) as the API reference. Do not rely on memory for Expo APIs: they change every SDK. Check the `.d.ts` before using an API.
- `expo-file-system` uses the class API (`File`, `Directory`, `Paths`): see `node_modules/expo-file-system/build/*.d.ts`.
- `Stack`, `router`, `Link`, `useLocalSearchParams`, `Redirect` come from `expo-router`. Tabs come from `expo-router/native-tabs` (Material icons via `md="icon_name"`).
- Routes live in `src/app/`. Every file there is a screen. Non-route code lives outside `src/app/`.
- React Compiler is on: no manual `useMemo`/`useCallback` needed for perf (allowed when semantically required).
- Never add `android/` or `ios/` folders. Native config goes in `app.json` plugins.
- Don't install packages. Everything planned is installed. If something is truly missing, report it in your result instead.

## Folder ownership
```
src/app/                      routes (screens only, thin)
  _layout.tsx                 root: fonts, migrations, providers, Stack
  (tabs)/_layout.tsx          native tabs (Home, Stock, Sales, Customers, More)
  (tabs)/index|stock|sales|customers|more.tsx
  (onboarding)/…              first-launch flow
  product/…  sell.tsx  sale/[id].tsx  customer/…  catalogue/…  showroom/…  report/…  settings/…  backup/…  deleted.tsx
src/features/<feature>/       screen components, hooks and logic for one feature
src/db/
  schema.ts                   tables (change only with a new drizzle migration: `npm run db:generate`)
  client.ts                   expo-sqlite connection (`db`). App-only. Never import it in Node tests
  types.ts                    `DbOrTx`: any sync drizzle db/tx with our schema
  stock.ts                    the ONLY code that changes piece counts (applyMove / adjustStock)
  seed.ts                     settings row + default categories; craft/material/size lists
  repo/<entity>.ts            sync data functions: `fn(db: DbOrTx, …)`. No React, no expo imports
  hooks/<entity>.ts           React hooks for screens (drizzle `useLiveQuery` on `db` from client.ts)
src/ui/
  tokens.ts motion.ts theme.tsx       design + motion tokens, useTheme()
  components/                 shared UI kit (one component per file, index.ts barrel)
  patterns/                   Skia generative art components
src/lib/                      pure helpers (money, ids, dates, phone, photos, files)
src/pdf/                      HTML templates (pure functions → string) + render (expo-print)
src/share/                    WhatsApp / share-sheet helpers, product-card image
src/i18n/en/<namespace>.json  one namespace per feature (already registered)
src/test/                     Node test helpers (createTestDb uses better-sqlite3 + real migrations)
design/pattern-lab/           p5.js sketches (design-time only)
```

## Route map (final, after integration)
Typed routes are on: `npm run typecheck` first writes `.expo/types/router.d.ts` (`scripts/gen-route-types.js`), so a link to a route that does not exist fails tsc. Do not cast hrefs (`as Href` / `as never`) unless the path is built at runtime.

| Path | Notes |
|---|---|
| `/(tabs)` `index` Home · `/stock` · `/sales` · `/customers` · `/more` | Tabs layout redirects to `/welcome` until onboarding is finished |
| `/welcome` → `/language` → `/shop` → `/owner` → `/app-lock` → `/start` | group `(onboarding)`. The lock step is `/app-lock` (an `(onboarding)/lock.tsx` would collide with `/lock`). No other feature may create these top-level paths |
| `/product/new`, `/product/[id]`, `/product/[id]/edit`, `/deleted` | `/deleted` lists products and customers |
| `/sell?productId=&colourId=&customerId=` | formSheet, declared in the root `_layout.tsx` Stack |
| `/sale/[id]` | |
| `/customer/new?name=&phone=&returnTo=`, `/customer/[id]`, `/customer/[id]/edit` | `returnTo` returns via `router.dismissTo` with `customerId` |
| `/catalogue?productIds=&categoryId=&customerId=&quick=1` → `/catalogue/options` → `/catalogue/preview` → `/catalogue/send`; `/catalogue/card?productId=&customerId=` | `quick=1` jumps to preview (Showroom) |
| `/showroom`, `/showroom/leave` | Exit pushes `/lock?mode=verify&returnTo=/showroom/leave` on top (never replaces itself with `/lock`) |
| `/report` → `/report/preview`; `/report/history` | `/report?from=&to=` re-makes an old report |
| `/settings` (→ `/more`), `/settings/shop`, `/settings/owner`, `/settings/stock`, `/settings/catalogue`, `/settings/language`, `/settings/storage`, `/settings/sample-data`, `/settings/tags`, `/settings/lock` | |
| `/backup`, `/backup/result` | weekly reminder notification taps open `/backup` |
| `/lock?mode=` set / verify / change `&returnTo=` | `returnTo` must start with `/`; success does `router.replace(returnTo)`, else back. Close/back in verify mode only goes back, so never guard a screen by *replacing* it with `/lock` |

Root layout order: fonts + migrations → seed → `ToastProvider` → `AppLockGate` (applies only once a PIN is set **and** onboarding is finished) → Stack, plus notification-tap routing (follow-up → `/customer/[id]`, backup → `/backup`).

## Data rules
- drizzle's expo-sqlite driver is **synchronous**. `db.transaction((tx) => { … })` callbacks must not be `async`. Inside, use `.run()`, `.get()`, `.all()`.
- Repository functions take `DbOrTx` as their first argument so they run in Node tests with `createTestDb()` and in the app with `db`.
- Money: integer **paise** (`src/lib/money.ts`). Time: epoch **ms** (`src/lib/dates.ts`). IDs: `newId()` (`src/lib/ids.ts`).
- Piece counts change only via `applyMove`/`adjustStock` (`src/db/stock.ts`), which writes a `stock_moves` row in the same transaction.
- Soft deletes (`deleted_at`). "Recently deleted" keeps items for 30 days.
- Screens read with live queries so counts update instantly after writes.

## UI rules
- Colours, type, spacing and radius come from `useTheme()`. No hex literals in screens.
- All user-visible strings go through `useTranslation('<namespace>')`. Use `start`/`end`, not `left`/`right`, in styles (RTL later).
- Touch targets ≥ 48 dp. Status is shown with text + icon + colour, never colour alone. Every pressable has an `accessibilityLabel` or visible text and an `accessibilityRole`.
- Motion: use `src/ui/motion.ts` tokens. Reanimated only (never core `Animated`). Animate `transform`/`opacity` only. No animation on tab switches or scrolling. Press feedback = scale 0.97 in 120 ms. Every animation uses `ReduceMotion.System`. Skia canvases pause when not visible.
- Lists with more than ~30 rows use `FlashList`. Images use `expo-image` with thumbnails.
- Destructive actions: soft delete + Undo toast (no confirm dialog when undo exists).

## Testing
- `npm test` runs two Jest projects: `*.node.test.ts` (Node, for db/lib/pdf logic, with `createTestDb()`) and `*.rn.test.tsx` (jest-expo, for components).
- `npm run typecheck`, `npm run lint`, `npm run export:android` (Metro Android bundle) must pass.
- `src/test/rnSetup.ts` already mocks Reanimated (incl. `withSequence`, layout builders), worklets, haptics, Gesture Handler (`jestSetup`), `react-native-keyboard-controller` and safe-area. The real `ToastProvider` cannot render under Jest: mock `@/ui/components/Toast` in screen tests.
- `src/i18n/__tests__/keys.node.test.ts` fails when a static `t('key')` has no string in `src/i18n/en/*.json`.
- The APK is built with EAS: `npx eas-cli build -p android --profile preview` (needs an Expo account; not possible on the cloud build machine).
