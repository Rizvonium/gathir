# Gathir

Android-only, fully offline app for Kashmiri shawl sellers: stock with per-colour piece counts, sales, customer book, Showroom mode, catalogue PDFs with rates for customers, and sales-report PDFs for the owner, all shared over WhatsApp. **Read `docs/PLAN.md` first**; it is the source of truth for scope, screens, data model, design system and motion rules.

## Hard constraints
- Android only. No server, no login: all data lives on the phone (expo-sqlite + Drizzle, photos in app storage). The internet is touched only by WhatsApp itself.
- Money is stored as integer paise and shown with `Intl.NumberFormat('en-IN')` (₹1,25,000).
- Piece counts change only through `stock_moves` rows written in the same transaction as the cached count.
- Deletes are soft (30-day Recently deleted + Undo toast). Never add a confirm dialog where undo works.
- Customer-facing surfaces (Showroom, catalogue PDF, product card) never show cost price or history.
- All strings go through i18n; use start/end layout (Urdu RTL is planned).

## Stack
Expo (latest SDK) + React Native + TypeScript, Expo Router, `@expo/ui`, Reanimated 4, Gesture Handler, Skia, expo-print, react-native-share, FlashList, expo-image.

## Which skill for what (`.claude/skills/`)
- Motion: `expo-animation` (decide first), then `animating-react-native-expo`; Skia/pattern art and jank: `reanimated-skia-performance`.
- Screens & tokens: `expo-design-system`, `expo-native-ui`, `expo-ui`, `expo-router`, `expo-project-structure`.
- Visual direction & critique: `frontend-design`, `impeccable`, `typography-audit`; UX rules: `web-design-guidelines` (adapt to mobile).
- Flows, undo vs confirm, state coverage: `product-design`.
- React Native code quality: `vercel-react-native-skills`, `vercel-composition-patterns`.
- Generative patterns (design-time, `design/pattern-lab/`): `p5js`, `algorithmic-art`. Port the maths to Skia for the app.

Motion rules in short: no animation on tab switches or scrolling; press feedback ≤ 150 ms; delight only for rare moments; animate transform/opacity only on the UI thread; reduced-motion version ships with every animation; verify on a release build on the low-end test phone.
