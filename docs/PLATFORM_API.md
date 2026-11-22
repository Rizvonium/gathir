# Gathir platform API

The reference for feature builders: every public module below `src/` outside `src/app/`.
Read with `docs/ARCHITECTURE.md` (where code goes) and `docs/PLAN.md` (what to build).
Signatures are copied from the code; `?` = optional, `=x` = default. Money is **paise**, time is **epoch ms**.

Status (profit & personal catalogues pass, 22 Nov 2026): `npm run typecheck`, `npm test` (70 suites, 511 tests), `npm run lint`
and `npm run export:android` (with every module below bundled) are green. Nothing has run on a device yet.
Schema version 2 (`drizzle/0001_profit_catalogues.sql`): `colours.cost_paise`, `sale_items.cost_paise_snapshot`,
`shop_settings.report_includes_profit`, table `customer_catalogue_items`.

---

## 0. Gotchas (read first)

1. **Repo rows hold file names, not URIs.** Convert with `thumbUri(row.coverThumb)` / `photoUri(name)` from `@/lib/photos`
   before passing to `Thumbnail`/expo-image. When the name is `null` (sample products have no photos) render
   `<PatternPlaceholder productId name />`.
2. **Errors are codes, not copy.** Repos throw `RepoError{code}`, `DuplicateCustomerError{existingId, existingName}` and
   `StockError{code}`; their `.message` is developer English. Show `t(...)` chosen from `code`.
3. **All repo functions are synchronous** and take `db` (`import { db } from '@/db/client'`) first. No `await`, no async
   transaction callbacks. `@/db/client` opens SQLite on import: never import it (or `@/lib/storage`, which imports it) in
   `*.node.test.ts`; use `createTestDb()` from `@/test/testDb` instead.
4. **Low stock has two scales.** Repo status is `'in'|'low'|'out'` (from `shop_settings.low_stock_level`, default 1);
   UI `PieceBadge` uses `'ok'|'low'|'out'` with its own default threshold 2. Always pass
   `lowThreshold={useLowStockLevel()}` (or a row's `status`-consistent level) to `PieceBadge`.
5. **`useDbQuery` deps must be primitives** (strings, numbers, booleans, null). A new array/object each render would
   re-run the query every render.
6. `PatternHeader` and `LoomEmptyState` call expo-router `useIsFocused`: only inside a route screen.
7. `AppSheet` children are plain RN views; `ToastProvider` is already mounted in `src/app/_layout.tsx` (88 dp above the
   bottom, for tab screens).
8. Two `formatBytes`: `@/lib/storage` (exact, "1.5 KB", "393 MB", for the Storage screen) and `@/pdf` (rough
   "about 6 MB" hints). Two reduced-motion hooks: `useReduceMotionEnabled` (UI kit) and `useReducedMotionLive`
   (patterns); both follow the system setting live — use either.
9. Exports (PDFs, card images, backup zips) live in `<cache>/exports` and are deleted after 24 h by
   `cleanupOldExports()` (runs at app start). Re-render a PDF to re-share an old report.
10. Component tests (`*.rn.test.tsx`): `src/test/rnSetup.ts` globally mocks `react-native-reanimated` (stand-in at
    `src/ui/components/__tests__/reanimatedMock.ts`), `react-native-worklets` and `expo-haptics`. Skia components do
    not run under Jest. Render with `renderWithTheme` from `src/ui/components/__tests__/renderWithTheme.tsx`.
11. Start-up housekeeping is done in the root layout: migrations, `ensureSeedData`, `recoverInterruptedRestore()`,
    `cleanupOldExports()`. Do not repeat it in screens.
12. **Buying price and profit are seller-only.** Never pass `profit`, `costPaise`, `profitPaise`, `knownProfitPaise`,
    `stockValueAtCostPaise`… to Showroom, catalogues, product cards or bills. Product list rows (`listProducts`,
    `loadLiveProducts`) and catalogue data never carry them; `getProductDetail().product.costPaise` and
    `colours[].costPaise` do, so screens a customer may see keep the "hide" eye toggle. Profit counts only items with a
    buying price: always show `unknownCostItems` ("profit unknown"), never treat a missing cost as 0.
13. **Undo a sale = `voidSale`, Return = `cancelSale`.** The Sell toast's Undo voids (sale removed, bill number freed when
    it is the latest) within `VOID_WINDOW_MS` (2 min) and falls back to `cancelSale` after that. Sale detail "Return" stays
    `cancelSale` with its confirm sheet.
14. **`Stepper` is controlled.** Every tap steps from `value`; to "reset" it, keep or set `value` (no `key` remount). Only a
    hold-to-repeat counts ahead of renders, starting from `value` when the hold starts.

---

## 1. Theme, tokens, motion, i18n

| Import | API |
|---|---|
| `@/ui/theme` | `AppThemeProvider({children})` (mounted at root) · `useTheme(): {scheme:'light'\|'dark', colors: ColorTokens, fonts, type, space, radius}` |
| `@/ui/tokens` | `ColorTokens` keys: `bg surface surfaceSunken border text textMuted primary onPrimary saffron onSaffron teal onTeal rose meadow indigo onAccent lowText danger scrim stockOk stockLow stockOut` · `fonts` (Fraunces `display`, `displaySemi`; Manrope `body`, `bodyMedium`, `bodySemi`, `bodyBold`) · `type` (`caption small body title heading display count`) · `space` (`xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48`) · `radius` (`sm 8, md 12, card 20, sheet 28, pill 999`) · `touchTarget = 48` · `shawlSwatches: {key,name,hex}[]` (the named colour palette; `hex:'multi'` = multicolour) · `palette`, `lightColors`, `darkColors` |
| `@/ui/motion` | `timing.{press,chip,count,standard}` (`withTiming` configs, ReduceMotion.System) · `springs.{settle,snap,sheet,bazaar}` · `durations` · `easings.{out,inOut,sheet}` · `pressScale = 0.97` |
| `@/i18n` | Namespaces: `common ui home onboarding stock sales customers catalogue showroom report backup settings lock`. Use `useTranslation('<ns>')`. Feature teams add keys to their own namespace; `backup.json` already has `errors.*`, `catalogue.json`/`report.json` have `pdf.*`/`share.*` (add beside them, do not replace). |

---

## 2. UI kit — `import { … } from '@/ui/components'`

All read `useTheme()`. Most accept `style` and `testID`. Every pressable has a role + label; targets ≥ 48 dp.

### Text and icons
- `AppText(props: TextProps & {variant?:'display'|'heading'|'title'|'body'|'small'|'caption'|'count'; weight?:'regular'|'medium'|'semibold'|'bold'; muted?; tone?: keyof ColorTokens; color?; numeric?; align?:'start'|'center'|'end'})` — all text. `display/heading` = Fraunces; `numeric` = tabular digits. `<AppText variant="title">{t('x')}</AppText>`
- `Icon({name: IconName; size?=24; tone?='text'; color?; accessibilityLabel?})` — MaterialIcons glyph; hidden from TalkBack without a label.

### Pressables
- `PressableScale(props: PressableProps & {haptic?: HapticKind; scaleTo?=0.97})` — base pressable (scale 0.97 / 120 ms).
- `Button({label; onPress?; variant?:'primary'|'secondary'|'tonal'|'ghost'|'danger'; size?:'sm'|'md'|'lg'; icon?; loading?; disabled?; fullWidth?; haptic?; accessibilityHint?})` — `<Button label={t('sell')} icon="sell" fullWidth />`
- `IconButton({icon; accessibilityLabel; onPress?; variant?:'ghost'|'tonal'|'filled'; size?=48; color?; disabled?; haptic?})`
- `playHaptic(kind: 'selection'|'light'|'medium'|'success'|'error'): void`

### Layout
- `Screen({children; title?; subtitle?; leading?; actions?; scroll?=false; footer?; edges?=['top']; padded?=true; contentStyle?})` — safe-area page; `scroll` is keyboard-aware; `footer` is a sticky bar above the keyboard (main action goes there).
- `Card({children; onPress?; accessibilityLabel?; accessibilityHint?; padding?:'none'|'md'|'lg'|'xl'})`
- `SectionHeader({title; actionLabel?; onAction?})`
- `ListRow({title; subtitle?; leading?; trailing?; onPress?; chevron?; accessibilityLabel?})` — ≥ 56 dp row.
- `EmptyState({illustration?; title; body?; actionLabel?; actionIcon?; onAction?})` — put `<LoomEmptyState/>` in `illustration`.
- `Divider({inset?})` · `Spacer({size?: keyof space; horizontal?})` (no size = flex filler)
- `ProgressDots({total; current})` — wizard dots ("Step n of m").
- `Skeleton({width?; height?; rounded?:'sm'|'md'|'card'|'pill'})`
- `Thumbnail({uri; size?=56; rounded?:'sm'|'md'|'card'; recyclingKey?; accessibilityLabel?; contentFit?='cover'})` — expo-image; in FlashList pass `recyclingKey`.
- `Avatar({name; color:'#RRGGBB'; size?=40})` · `initialsOf(name): string`

### Numbers and stock
- `RollingNumber({value; format?=formatNumber; variant?='count'; weight?; tone?; color?; accessible?=true; accessibilityLabel?})` — money: `format={formatINR}` with paise.
- `Stepper({value; onChange(n); accessibilityLabel; min?=0; max?; step?=1; size?:'md'|'lg'; disabled?; testID?})` — **controlled**: shows `value` and every tap/TalkBack step is `value ± step` (a parent that does not apply the change keeps the stepper where it was, e.g. "−" waiting for a reason); hold-to-repeat counts on from `value`. Haptics, TalkBack adjustable. Test IDs `${testID}-inc|-dec|-value`.
- `PieceBadge({count; lowThreshold?=2; size?:'sm'|'md'})` — "12 pieces" / "Only 2 left" / "Sold out". Pass `lowThreshold={useLowStockLevel()}`.
- `stockStatusOf(count, lowThreshold=2): 'ok'|'low'|'out'` · `DEFAULT_LOW_THRESHOLD = 2`
- `StatCard({label; value; format?; delta?; icon?; onPress?})` — Home figure with rolling number and "Up 3 on yesterday".

### Colours and chips
- `ColourSwatch({hex: '#RRGGBB'|'multi'; name; size?=32; selected?; onPress?; showName?})` · `MULTI_COLOUR = 'multi'`
- `ColourDots({items: {key; hex; name; count?}[]; max?=5})` — one TalkBack label.
- `Chip({label; selected?; onPress?; icon?; leading?; role?:'button'|'radio'|'checkbox'; disabled?})`
- `ChipGroup<T>({options: {value; label; icon?; leading?; disabled?}[]; accessibilityLabel; mode:'single'; value: T|null; onChange(v)} | {…; mode:'multi'; value: T[]; onChange(v[])})`

### Inputs
- `TextField(props: TextInputProps & {label; helper?; error?; prefix?; suffix?; align?:'start'|'end'; numeric?})`
- `MoneyInput({label; value: paise|null; onChange(paise|null); helper?; error?; placeholder?; autoFocus?; editable?; onSubmitEditing?})` — ₹, Indian grouping while typing.
- `formatMoneyTyping(text)`, `groupIndian(digits)`, `paiseToInputText(paise|null)` — pure helpers.
- `PhoneInput({label; value: E.164|''; onChange(e164|null, text); country?='IN'; helper?; error?; autoFocus?; onSubmitEditing?})`

### Sheet, toast, misc
- `AppSheet({visible; onClose; title?; snapPoints?: ('half'|'full'|{fraction}|{height})[]; children; testID?})` — @expo/ui BottomSheet.
- `useToast(): {show({message; actionLabel?; onAction?; secondaryActionLabel?; onSecondaryAction?; durationMs?=8000; tone?:'neutral'|'success'|'danger'}): id; hide(id?)}` — Undo toasts: `toast.show({message: t('deleted'), actionLabel: t('common:actions.undo'), onAction: restore})`. With a secondary action both buttons render (secondary first, main action last); either one runs its handler and closes the toast; TalkBack hears "message. secondary. main". Test IDs `toast-action-secondary|primary`. Pure helpers `toastActions(options)`, `toastAnnouncement(options)`.
- `ToastProvider({children; bottomOffset?=88})` (already mounted).
- `useReduceMotionEnabled(): boolean` · `readableTextOn(hex): string` · `warmShadow(scheme, level?:'card'|'overlay'): ViewStyle`

---

## 3. Patterns (Skia) — `import { … } from '@/ui/patterns'`

Colours come from the theme; art is hidden from TalkBack; touches pass through (except ThreadWeaveLogo). Omit
`width/height` to measure the parent.

- `PatternHeader({width?; height?=140; seed?=1; density?=0.45; background?; paused?})` — drifting boteh band for Home/Showroom. **Route only.**
- `KaniWeaveBackground({width?; height?; seed?=3; cell?=8; accent?=0.22; intensity?=0.12})` — static twill; without size fills parent absolutely (render first).
- `PatternPlaceholder({productId; name; width?; height?; radius?=radius.card; accessibilityLabel?})` — no-photo art, stable per product id. `accessibilityLabel={t('stock:noPhoto')}`.
- `ThreadWeaveLogo({size?=160; onDone?; skipLabel; animate?=true})` — first-launch weave (1.2 s, tap to skip).
- `ChinarLeaves({width?; height?; seed?=7; count?:1|2|3=2; onDone?})` — sale-done overlay; `{celebrate && <ChinarLeaves onDone={() => setCelebrate(false)} />}`.
- `PaisleyConfetti({width?; height?; seed?=11; count?=32 (≤40); originX?=0.5; originY?=0.6; onDone?})` — report-sent burst.
- `LoomEmptyState({width?; height?=160; period?=7; warpCount?=13; rows?=9; paused?})` — **Route only.**
- Helpers: `patternInks(colors): string[]`, `inkAt(inks, i)`, `productInitials(name)`, `usePatternLoop(paused?): {running, reduced}` (route only), `useReducedMotionLive(): boolean`, `patternGeometry` (pure seeded path maths, 1:1 with `design/pattern-lab/geometry.js`; path strings work in SVG `<path d>`).

---

## 4. Database

`import { db } from '@/db/client'` (app only). Types: `DbOrTx` (`@/db/types`); row types `ShopSettings, Category, Product,
Colour, Photo, StockMove, Customer, CustomerEvent, Sale, SaleItem, Report, CustomerCatalogueItem` and enums `STOCK_REASONS, CUSTOMER_TAGS,
CUSTOMER_EVENT_KINDS, PAYMENT_METHODS ('cash'|'upi'|'card'|'other'), REPORT_KINDS` from `@/db/schema`.

### Errors — `@/db/repo/errors`, `@/db/stock`
- `RepoError{code: 'not_found'|'invalid'|'in_use'|'duplicate'|'already_done'}`
- `DuplicateCustomerError extends RepoError {existingId; existingName}`
- `StockError{code: 'not_found'|'insufficient'|'invalid'}`

### Stock — `@/db/stock` (the only code that changes piece counts)
- `applyMove(tx, {colourId; delta; reason: StockReason; saleId?; note?; at?}): number` — inside your own transaction. `adjustStock(db, MoveInput)` wraps it in one.
- `recordRestock(db, colourId, qty, note='', at?): number` — "+" stepper.
- `recordReduction(db, colourId, qty, reason: 'damaged'|'correction'|'returned_to_owner'|'sample', note='', at?): number` — "−" with reason chip. `REDUCTION_REASONS`.
- `recordCorrection(db, colourId, actualCount, note='', at?): number` — "Counted wrong".
- `productPieces(tx, productId): number` · `findCountDrift(tx)` (tests).

### Settings — `@/db/repo/settings`, `@/db/repo/shopInfo`, `@/db/seed`
- `getSettings(db, now?): ShopSettings` (incl. `reportIncludesProfit`, default false) · `getLowStockLevel(db): number` · `updateSettings(db, patch: SettingsPatch, now?): ShopSettings` · `markOnboarded(db, now?)`
- `nextProductCode(db, now?): 'GTH-0001'…` · `nextBillNo(db, now?): 'B-2026-0001'` (yearly) · `nextReportNumber(db, now?)` · `peekNextReportNumber(db)`
- `getShopInfo(db): {shopName, sellerName, sellerCode, phone, address, upiId, ownerWhatsapp}`
- `CRAFTS`, `MATERIALS`, `SIZES`, `DEFAULT_CATEGORIES` (suggestion lists) · `ensureSeedData(db, ownerWhatsApp?, now?)` (root layout).

### Categories — `@/db/repo/categories`
`listCategories(db)` · `listCategoriesWithCounts(db)` · `createCategory(db, {name, icon?}, now?): id` ·
`renameCategory(db, id, name, icon?, now?)` · `reorderCategories(db, orderedIds, now?)` · `deleteCategory(db, id)` (throws `in_use`).

### Products — `@/db/repo/products`
- `createProduct(db, {fields: ProductFields, colours: {name, hex, pieces, costPaise?}[], photos: {fileName, thumbName, width, height}[]}, now?): {productId, code}` — ≥ 1 colour, ≤ 8 photos (`MAX_PHOTOS`); `ProductFields = {name, ratePaise, categoryId?, craft?, material?, size?, costPaise?, notes?, oneOfAKind?, isSample?, code?}`. `costPaise` = buying price (product); a colour's `costPaise` overrides it for that colour (null = use the product's).
- `updateProduct(db, id, ProductUpdate, now?)` — `ProductUpdate` = partial fields + `colourCosts?: Record<colourId, paise|null>` (per-colour buying prices of this product, in the same transaction; unknown colour → `not_found`) · `setPhotos(db, productId, PhotoInput[], now?): string[]` (first = cover; returns files safe to delete → `deletePhotoFiles`).
- `addColour(db, productId, ColourInput, now?): colourId` · `renameColour(db, colourId, {name?, hex?, costPaise?}, now?)` (`costPaise: null` clears the colour's override) · `removeColour` / `restoreColour(db, colourId, now?)` (soft + Undo).
- `softDeleteProduct` / `restoreProduct(db, id, now?)` — exact Undo, idempotent.
- `purgeDeletedOlderThan(db, now?, days=30): {productIds, files}` · `listRecentlyDeleted(db, days?): DeletedProductRow[]`
- `getProductDetail(db, id, lowStockLevel=1): {product, category, colours, photos, totalPieces, status} | null`
- `listProducts(db, {search?, categoryId?, filter?:'all'|'low'|'out'|'in', sort?:'newest'|'most'|'least'|'rate_high'|'rate_low'|'name', lowStockLevel?}): ProductListRow[]` — row: `{id, code, name, categoryId, categoryName, craft, material, size, ratePaise, oneOfAKind, isSample, createdAt, totalPieces, status, colours: {id,name,hex,pieces}[], coverThumb, coverFile}`; never cost.
- `loadLiveProducts(db, level)` · `stockHistory(db, productId): {id, at, delta, reason, note, colourId, colourName, colourHex, saleId, billNo}[]` (`saleId` is null when the sale no longer exists, e.g. voided) · `liveColours(db, productId)` · `unreferencedFiles(db, names)`

### Sales — `@/db/repo/sales`
- `createSale(db, {items: {colourId, qty, ratePaise}[], payment?, discountPaise?, customerId?, newCustomer?: {name, phone?}, note?, billNo?}, now?): {saleId, billNo, totalPaise, customerId}` — atomic; `StockError('insufficient')` rolls back; discount > subtotal → `RepoError('invalid')`; `newCustomer` reuses a customer with the same phone. Each item stores `costPaiseSnapshot` = colour cost ?? product cost ?? null at sale time.
- `cancelSale(db, saleId, now?): boolean` — Return: pieces back with 'returned' moves, sale kept with `cancelledAt`; false if already cancelled.
- `voidSale(db, saleId, now?): void` — true Undo within `VOID_WINDOW_MS` (2 min) of creation: a +qty `'correction'` move (note `VOID_NOTE` = 'sale voided', same `saleId`, so owner reports skip both) per sold move, then the sale and its items are deleted; the bill number is released only when it is the latest issued. `findCountDrift` stays empty. Throws `RepoError('not_found')`, or `'already_done'` when cancelled, already in an owner report, or too old (use `cancelSale`).
- `listSales(db, {from, to, payment?, customerId?, includeCancelled?=true}): SaleListRow[]` (newest first; `{id, billNo, createdAt, day, cancelledAt, payment, discountPaise, totalPaise, customerId, customerName, customerPhone, pieces, itemCount, items, profitPaise (null when any cost unknown), knownProfitPaise, unknownCostItems}`)
- `getSale(db, id): {sale, items, customer, profit: SaleProfit} | null` · `salesSummary(db, {from, to}): {pieces, amountPaise, count, discountsPaise, byPayment, byCategory, profitPaise, knownCostPaise, knownRevenuePaise, marginPct, unknownCostItems}` · `summarise(db, sales)` · `profitOfSale(sale, items): SaleProfit` · `itemsBySale(db, ids)` · `unreportedSales(db, since?)`

### Profit — `@/db/repo/profit` (maths: `@/db/repo/profitMath`, pure) — seller-only
- Rules: effective buying price = `colours.costPaise ?? products.costPaise ?? null`; item profit = (rate − cost) × qty; the bill discount is shared between items in proportion to value (largest remainder, whole paise); an item without a cost has **unknown** profit (counted in revenue, never as profit; reported in `unknownCostItems`); cancelled sales are excluded.
- `ProfitTotals = {revenuePaise, knownRevenuePaise, knownCostPaise, profitPaise (known items only), marginPct (profit ÷ known revenue, 1 decimal, null at 0), unknownCostItems (lines), pieces}`; `ProfitSummary = ProfitTotals & {salesCount}`; `SaleProfit = ProfitTotals & {fullProfitPaise: number|null, lines: LineProfit[]}`.
- `profitSummary(db, {from, to}): ProfitSummary` · `profitBreakdown(db, range, 'day'|'week'|'month'|'product'|'category'|'customer'): ProfitGroupRow[]` (time groups oldest first; others most profit first; row = summary + `{key, label, at}`, `key ''` = no category / walk-in) · `profitBreakdowns(db, range): {summary, byDay, byProduct, byCategory, byCustomer}` (one pass)
- `productProfit(db, productId): ProfitSummary` (profit earned on a design, all time) · `stockValues(db): {atRatePaise, atCostPaise, unknownCostPieces, totalPieces}` · `colourCost(db, colourId): paise|null` · `saleProfitOf`
- Pure: `effectiveCost(colourCost, productCost)`, `itemProfit(line)`, `allocateDiscount(weights, discount)`, `computeSaleProfit({discountPaise, items: {qty, ratePaise, costPaise}[]})`, `marginPct(profit, revenue)`.

### Personal catalogue per customer — `@/db/repo/customerCatalogue`
- `addToCustomerCatalogue(db, {customerId, productId, specialRatePaise?, note?}, now?): itemId` — idempotent (one active row per customer + design; given fields update it); brings back a removed row. `not_found` for a deleted customer/design.
- `removeFromCustomerCatalogue(db, itemId, now?): boolean` (soft) · `restoreCustomerCatalogueItem(db, itemId): boolean` (Undo; false if the design was re-added) · `updateCatalogueItem(db, itemId, {specialRatePaise?: paise|null, note?})` · `reorderCustomerCatalogue(db, customerId, orderedItemIds)`
- `listCustomerCatalogue(db, customerId, lowStockLevel?): CustomerCatalogueRow[]` — `{id, productId, code, name, craft, material, categoryName, coverThumb, coverFile, normalRatePaise, specialRatePaise, ratePaise (special ?? normal), note, sortOrder, addedAt, colours, totalPieces, status, soldOut, productDeleted}`; never cost. `customerCatalogueProductIds(db, customerId)`.
- `buildCustomerCatalogueData(db, customerId, CatalogueOptions, now?): CatalogueData` — their designs in their order (deleted left out), `ratePaise` = special rate where set with `specialPrice: true` (only when rates are shown), `preparedFor` = customer name, `customerId`. Feed it to `catalogueDocFromData` like any catalogue ("Prepared for …" comes from `preparedFor` unless `extras.customerName` is given).
- Versions sent: after sending, `logCatalogueSent(db, customerId, reportId, ids, now, {items: catalogueSnapshot(data), personal: true, title})`; list with `catalogueVersions(db, customerId): {eventId, sentAt, reportId, personal, title, productIds, items: {productId, name, ratePaise, specialPrice}[]}[]` (newest first; older sends have `items: []`).
- Showroom "they liked this": `likeAndAddToCatalogue(db, customerId, productId, now?): {eventId, itemId, added}` (liked_item event + catalogue item, one transaction; Undo = `deleteEvent(eventId)` and, if `added`, `removeFromCustomerCatalogue(itemId)`).
- Purging a customer or a design deletes its catalogue rows; clearing sample data too.

### Customers — `@/db/repo/customers`
- `createCustomer(db, {name, phone?, whatsappOk?, city?, address?, tag?, notes?, likes?}, now?, {id?}): id` — throws `DuplicateCustomerError`.
- `updateCustomer(db, id, patch, now?)` · `softDeleteCustomer` / `restoreCustomer(db, id, now?)` · `purgeDeletedCustomers(db, now?, days=30)` · `eraseCustomers(tx, ids)`
- `findByPhone(db, phone)` · `normalizePhone(p): E.164|null` (libphonenumber via `@/lib/phone`, fallback heuristic) · `parseLikes(json)`
- `listCustomers(db, {search?, tag?, followUpDue?, inactiveDays?, sort?:'recent'|'spend'|'name'}, now?): CustomerListRow[]`
- `getCustomerProfile(db, id): {customer, likes, stats, learnedLikes, openFollowUps, timeline} | null`
- `suggestedProducts(db, customerId, limit=12): (ProductListRow & {score, reasons})[]` · `listDeletedCustomers(db, days?)`

### Customer events — `@/db/repo/events`
`addNote(db, customerId, note, now?)` · `logCatalogueSent(db, customerId, reportId|null, productIds, now?, snapshot?: {items: CatalogueSentItem[], personal?, title?})` · `catalogueSentItems(event): CatalogueSentItem[]` ·
`logCardSent(db, customerId, productId, now?)` · `logLikedItem(db, customerId, productId, now?)` · `catalogueProductIds(event)` ·
`addFollowUp(db, {customerId, dueAt, note?, notificationId?}, now?)` · `setFollowUpNotification(db, eventId, id|null)` ·
`completeFollowUp(db, eventId, now?): notificationId|null` · `reopenFollowUp(db, eventId)` · `deleteEvent(db, eventId)` ·
`dueFollowUps(db, now?): {eventId, customerId, customerName, phone, whatsappOk, dueAt, note, notificationId}[]`

### Reports, catalogue data, dashboard — `@/db/repo/reports`, `@/db/repo/dashboard`
- `buildCatalogueData(db, 'all'|{productIds}|{categoryId}, {hideSoldOut, showRates, showCounts}, now?): CatalogueData` — never cost. `CatalogueProduct.specialPrice?` and `CatalogueData.preparedFor? / customerId?` are set only by `buildCustomerCatalogueData`.
- `buildOwnerReportData(db, {from, to, includeCustomerPhones, now?}): OwnerReportData` (stockChanges include 'opening' moves). `includeProfit` = `settings.reportIncludesProfit`; only then `profit: {summary, byProduct (top 10), byCategory, stockValueAtCostPaise, stockCostUnknownPieces}` is set and sales carry `profitPaise` and items `costPaise`/`profitPaise`. Otherwise `profit: null`, `summary` has no profit keys and no cost appears anywhere in the data.
- `createReportRecord(db, {kind, periodFrom?, periodTo?, fileName?, customerId?, summary?, fingerprint?}, now?): {id, number}`
- `markSent(db, id, at?)` / `unmarkSent(db, id)` (Undo) · `listReports(db, kind?)` · `lastOwnerReport(db)` · `sinceLastReportPeriod(db, now, fallbackFrom): {from, to}`
- `computeFingerprint(data): string` · `canonicalJson(v)` · `fewThreshold(level)`
- `homeSummary(db, now, lowStockLevel): {totalPieces, designs, stockValuePaise (at rate), stockValueAtCostPaise, stockCostUnknownPieces, todayPieces, todayAmountPaise, yesterdayAmountPaise, todayProfitPaise, todayMarginPct, todayProfitUnknownItems, lowStock, soldOut, unreportedSalesCount, lastReportSentAt, followUpsDue}` (profit/cost fields seller-only)

### Backup data, sample data
- `@/db/repo/backup`: `exportAllTables(db, now?): BackupData` · `importAllTables(db, data)` (validated, all-or-nothing) · `validateBackup(data)` · `BACKUP_FORMAT`, `BACKUP_VERSION` (= 2; includes `customer_catalogue_items` and the new columns). Version-1 backups still restore: a missing table is empty, missing columns get their default (`reportIncludesProfit` false, costs null → old sales show "profit unknown").
- `@/db/sampleData`: `insertSampleData(db, now?)` · `clearSampleData(db): {products, sales, customers}` · `hasSampleData(db)` · `SAMPLE_ID_PREFIX`
- `@/db/repo/constants`: `stockStatus(total, level)`, `swatchKeyFor(name, hex)`, `DAY_MS`, `RECENTLY_DELETED_DAYS = 30`

---

## 5. Data hooks — `import { … } from '@/db/hooks'`

Return plain data and re-run (at most once per frame) after any DB write.

| Hook | Returns |
|---|---|
| `useDbQuery(fn: (db) => T, deps: primitive[])` | `T` — any sync repo function: `useDbQuery((d) => getShopInfo(d), [])` |
| `useDbVersion()` | number that bumps after writes |
| `useToday()` | `startOfDay(now)`, refreshed at midnight and on app resume; add it to deps for "today" queries |
| `useSettings()` | `ShopSettings \| undefined` |
| `useLowStockLevel()` | `number` |
| `useCategories()` | `Category[]` |
| `useProducts(filters: ProductListFilters)` | `ProductListRow[]` (level defaults to the setting) |
| `useProductDetail(id?)` / `useStockHistory(id?)` | `ProductDetail \| null` / `StockHistoryRow[]` |
| `useRecentlyDeleted()` | `{products, customers}` |
| `useSales({from, to, payment?, customerId?})` / `useSale(id?)` / `useSalesSummary({from, to})` | list / detail / summary |
| `useCustomers(filters)` / `useCustomerProfile(id?)` / `useSuggestedProducts(id?, limit?)` | |
| `useCustomerCatalogue(customerId?)` / `useCatalogueVersions(customerId?)` | `CustomerCatalogueRow[]` / `CatalogueVersion[]` |
| `useProfitSummary({from, to})` / `useProfitBreakdowns({from, to})` / `useProfitBreakdown({from, to}, by)` | seller-only profit (see §4 Profit) |
| `useProductProfit(productId?)` / `useStockValues()` | profit earned on a design / stock at rate and at buying price |
| `useDueFollowUps()` / `useHomeSummary()` | roll over at midnight (via `useToday`) |
| `useReports(kind?)` | `Report[]` newest first |

---

## 6. lib — pure helpers and device services

- `@/lib/money`: `formatINR(paise)` "₹1,25,000" · `formatNumber(n)` · `rupeesToPaise` · `paiseToRupees` · `parseRupeesInput(text): paise|null`
- `@/lib/dates`: `startOfDay endOfDay startOfWeek startOfMonth addDays(ms, n)` · `formatDate` "22 Nov 2026" · `formatTime` · `formatDay` · `relativeDays(ms, now)`
- `@/lib/ids`: `newId()` · `productCode(seq)` · `billNumber(year, seq)`
- `@/lib/phone` (default `'IN'`): `toE164(input, country?)` · `isValidPhone` · `formatPhone` · `formatPhoneInternational` · `formatPhoneAsYouType` · `toWhatsAppNumber` ("919876543210") · `nationalDigits` · `callingCodePrefix` · `DEFAULT_COUNTRY`
- `@/lib/files`: `photosDir()` · `photoFile(name)` / `thumbFile(name)` (throw on unsafe names) · `isSafeFileName(name)` · `exportsDir()` (`<cache>/exports`) · `freshExportFile(name)` · `cleanupOldExports(now?, maxAge?)` · `isExpired` · `dirUsage(dir, filter?)` · `ensureDir` · `documentSubdir` · `PHOTOS_DIR_NAME`, `EXPORTS_DIR_NAME`, `EXPORT_MAX_AGE_MS`
- `@/lib/photos`:
  - `pickFromCamera(): Promise<PickResult>` · `pickFromGallery({multiple?=true, max?=8}?)` · `recoverPendingPick(): Promise<PickResult|null>` (call on mount of add-photo screen). `PickResult = {status:'ok', uris} | {status:'cancelled'} | {status:'denied', canAskAgain} | {status:'error', message}`.
  - `savePhoto(uri): Promise<{fileName, thumbName, width, height}>` → pass to `createProduct`/`setPhotos`. Throws → `backup:errors.photoSaveFailed`.
  - `deletePhotoFiles(names): number` · `photoUri(fileName)` / `thumbUri(thumbName)` · `photoAsDataUri(fileName, maxSide=800, quality=0.72): Promise<string|null>` · `sampleColourFromImage(fileName): Promise<'#rrggbb'|null>`
  - Pure: `fitWithin`, `photoNames(id)`, `isThumbName`, `dominantColourHex`; constants `PHOTO_MAX_SIDE 1600, THUMB_MAX_SIDE 400, MAX_PHOTOS_PER_PRODUCT 8, THUMB_SUFFIX`.
- `@/lib/storage` (imports the DB): `storageUsage(): {photosBytes, photoCount, dbBytes, exportsBytes}` (sync; call in an effect) · `formatBytes(bytes)`

---

## 7. PDF — `import { … } from '@/pdf'`

Flow for every document: repo data → adapter → doc → `render*Html(doc)` → `renderPdf(html, …)` → `shareFileToWhatsApp`.

```ts
const data = buildCatalogueData(db, selection, { hideSoldOut, showRates, showCounts });
const photos = await loadPhotoMap(cataloguePhotoNames(data), photoAsDataUri, CATALOGUE_PHOTO);
const doc = catalogueDocFromData(data, { title, customerName, fontCss: await getPdfFontCss(),
  layout: { style: settings.catalogueStyle, columns: 2, showOnlyLeft: true } }, photos);
const pdf = await renderPdf(renderCatalogueHtml(doc), { fileBaseName: catalogueFileBaseName(shop.shopName, Date.now()) });
await shareFileToWhatsApp({ fileUri: pdf.uri, mimeType: 'application/pdf', phoneE164: customer.phone, message: catalogueMessage(doc) });
```

- Adapters: `catalogueDocFromData(data, extras, photos)` · `ownerReportDocFromData(data, {appVersion, fingerprint, fontCss?}, photos)` · **`billDocFromSale(saleDetail, shopInfo, fontCss?)`** (from `getSale`/`useSale`) · `loadPhotoMap(names, loader, size, concurrency=4)` · `cataloguePhotoNames(data)` · `ownerReportPhotoNames(data)` (use `REPORT_THUMB`) · `pdfShopFrom(shopInfo)` · `CATALOGUE_PHOTO`, `REPORT_THUMB` · types `PhotoLoader`, `CatalogueExtras`.
- Templates (pure): `renderCatalogueHtml(doc)` (A4) · `renderOwnerReportHtml(doc)` (A4) · `renderBillHtml(doc)` (use `page:'A5'`) · `availabilityTag(item, options, t)`
- Texts for the WhatsApp message: `catalogueMessage(doc)` · `ownerReportMessage(doc)` (exact PLAN §7, plus a `Profit: ₹… (n%)` line only when `doc.profit` is set) · `billMessage(doc)`
- Profit in PDFs: `OwnerReportDoc.profit?: OwnerProfitDoc | null` (set by `ownerReportDocFromData` only when `data.includeProfit`) adds a "Buying price and profit" section after the summary, "Bought at ₹…" under sold items and "Profit ₹…" / "Profit unknown" per sale. Catalogue, bill and product card docs have no cost/profit fields at all. `src/pdf/__tests__/profitPrivacy.node.test.ts` guards this: it sets a buying price on every sample design and colour and asserts no cost/profit value or word reaches catalogue, personal-catalogue or bill data, HTML or message text. Keep it green when touching these docs. `CatalogueItemDoc.specialPrice?` prints a "Special price for you" tag under the card (only when rates are shown).
- Render (device): `renderPdf(html, {fileBaseName, page?:'A4'|'A5'}): Promise<{uri, sizeBytes, pages|null}>` · `getPdfFontCss(): Promise<string>` (cached, never rejects) · `clearPdfFontCache()` · `buildFontFaceCss` · `exportsDir` · `PAGE_SIZES`
- Pagination/size: `itemsPerPage(2|3)` (4 or 6) · `paginateCatalogue(items, columns)` · `visibleCatalogueItems(items, {hideSoldOut})` · `estimateCatalogueSize(n)` · `splitForSize(items, max=120)` (set `doc.part = {index, total}`) · `MAX_ITEMS_PER_PART` · `formatBytes`
- File names: `catalogueFileBaseName(shop, at, part?)` · `ownerReportFileBaseName(shop, number, at)` · `billFileBaseName(billNo, shop)` · `productCardFileBaseName(name, shop)` · `sanitizeFileName(name, fallback?)`
- SVG patterns: `botehBorderSvg`, `sozniVineSvg`, `kaniCornerSvg`, `placeholderSvg`, `mulberry32`, `hashSeed`, `patternPalettes`
- HTML helpers: `escapeHtml`, `escapeMultiline`, `initials`, `chunk` (plus `safeImageSrc`, `safeHex`, `joinParts` in `@/pdf/html`)
- Doc types: `PdfShop, CatalogueDoc, CatalogueDocOptions, CatalogueItemDoc, OwnerReportDoc, OwnerProfitDoc, OwnerProfitRowDoc, BillDoc, PaymentKey`.

---

## 8. Share — `import { … } from '@/share'` (never throw; return a status)

- `shareFileToWhatsApp({fileUri, mimeType, phoneE164?, message, prefer?:'whatsapp'|'business'|'auto', dialogTitle?, filename?}): Promise<{status:'sent'|'dismissed'|'fallback_shared'|'unavailable'|'error', error?}>` — `'sent'` means WhatsApp opened with the file.
- `shareImagesToWhatsApp({urls, phoneE164?, message?, prefer?, mimeType?}): Promise<ShareResult & {batchesSent, batches}>` — batches of 30.
- `openWhatsAppChat(phone|null, text): Promise<boolean>` (text-only, wa.me) · `whatsAppChatUrl(phone, text?)` · `whatsAppDigits(phone)` · `detectWhatsApp()` · `chooseWhatsAppTarget(available, prefer)` · `WHATSAPP_PACKAGE`, `WHATSAPP_BUSINESS_PACKAGE`, `WHATSAPP_MAX_MEDIA`
- Product card: `useProductCardCapture(data: ProductCardData): {node, capture(): Promise<fileUri>}` — render `{node}` in the screen (offscreen), then `capture()` → 1080×1350 JPEG → `shareFileToWhatsApp({…, mimeType: 'image/jpeg'})`. `ProductCardData = {seedKey, name, craft, material?, ratePaise|null, shopName, code?, photoUri|null}`. `<ProductCardImage data onPhotoSettled?/>`, `PRODUCT_CARD_SIZE`.

---

## 9. Backup — `@/features/backup/*`

- `backupService`: `createBackup(db, now?): Promise<{file, uri, sizeBytes, counts}>` (sets `lastBackupAt`; throws → `backup:errors.createFailed`) · `shareBackup(file|uri, dialogTitle?): Promise<boolean>` (false → `errors.shareUnavailable`) · `pickAndRestoreBackup(db): Promise<RestoreResult>` · `restoreBackupFromUri(db, uri)`. `RestoreResult = {ok:true, counts} | {ok:false, reason:'cancelled'|'invalid'|'newer_version'|'failed', message}` → show `t(\`backup:errors.${reason}\`)`. Restore keeps this phone's `pinHashSet` (the PIN lives in secure storage).
- `photoFolderSwap`: `recoverInterruptedRestore()` (already called at start-up); `stagePhotos`, `swapInStagedPhotos`, `commitPhotoSwap`, `rollbackPhotoSwap` (internal to restore).
- `backupFormat` (pure): `buildManifest`, `validateManifest`, `assembleBackupZip`, `parseBackupZip`, `stampLastBackupAt`, `backupFileName(shop, now)`, `slugify`, `isoDate`, `isSafeBackupFileName`, `BACKUP_MIME`, types `BackupCounts`, `BackupManifest`.
- `schemaVersion`: `CURRENT_SCHEMA_VERSION` (= number of drizzle migrations, now 2). A backup with a lower schema version restores into the migrated database (defaults filled, see §4 Backup data).

---

## 9b. App lock — `@/features/lock`

- `/lock?mode=verify&returnTo=/showroom/leave` (Showroom exit) **blocks Android back and the back swipe**: the PIN pad stays until a correct PIN or the close button (which returns to the Showroom). Every other `/lock` use keeps normal back. Pure rule: `lockBlocksBack(mode, returnTo)` / `BACK_GUARDED_RETURNS` in `pinLogic`.

---

## 10. Test helpers

- `createTestDb()` — `@/test/testDb` (better-sqlite3 + real migrations) for `*.node.test.ts`.
- `src/db/__tests__/fixtures.ts`: `addTestProduct(db, opts?)` (`costPaise` defaults to 4,00,000; pass `null` for "no buying price"), `expectNoDrift(db)`, `T0`, `DAY`.
- Toast in component tests: mock `react-native-gesture-handler` with `usePanGesture: () => ({})` and a pass-through `GestureDetector` (see `src/ui/components/__tests__/Toast.rn.test.tsx`), or mock `@/ui/components/Toast` in screen tests.
- `src/lib/__tests__/fakeFileSystem.ts`: `jest.mock('expo-file-system', () => require('@/lib/__tests__/fakeFileSystem'))`; `resetFakeFs()`, `setMtime`, `listFiles`.
- `src/ui/components/__tests__/renderWithTheme.tsx` for component tests (global RN mocks in `src/test/rnSetup.ts`).
