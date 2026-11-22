# Gathir — Product & Build Plan

> **Gathir** is a working name taken from this repository. It is an Android app for Kashmiri shawl sellers.
> Status: plan v1, 22 Nov 2026. No code yet.

---

## 0. The app in one paragraph

Gathir is an **Android-only app that works fully offline**. Everything (products, photos, stock counts, sales) is stored **on the seller's phone**: no server, no login, no internet needed. A seller photographs a shawl, adds its colours and how many pieces they have, and always sees exactly how many pieces are left. When they sell, the count goes down by itself. They can hand the phone to a customer in **Showroom mode** to browse their stock, or send the customer a **catalogue PDF with photos and rates** on WhatsApp. They keep a **customer book**: who each customer is, what they bought, what they like, and when to follow up. At any time, the seller can send **you (the owner)** a **sales report PDF** with everything they sold, with photos, on WhatsApp. The look is a **vibrant bazaar**: jewel colours, playful but disciplined motion, and original paisley/chinar/weave art made with p5.js and drawn live with Skia.

### Decisions so far

| Topic | Decision | Source |
|---|---|---|
| Platform | Android phones only, a native app you install (APK) | You |
| Storage | 100% on the phone (SQLite database + photo files). No server, no account | You |
| Seller basics | Add, edit and delete products; see how many pieces there are | You |
| Owner reporting | Seller sends you sold items + photos + details as a PDF on WhatsApp | You |
| Customers | Show inventory on the phone (Showroom mode) + send a catalogue PDF with rates on WhatsApp | You |
| Customer data | Sellers keep customer records (contact, purchases, preferences, follow-ups), on the phone | You |
| Buyers | India only: ₹ INR, Indian number format (₹1,25,000) | You |
| Look & feel | Vibrant bazaar | You |
| Seller model | Curated: sellers work with you and report to you | You (adapted to offline) |
| Stock counting | Per **design + colour** (e.g. "Sozni stole — Red 4, Beige 2"), total shown automatically. A design can be marked "one-of-a-kind" | **Assumed** (recommended) |
| Tech | React Native + Expo (TypeScript), built as an Android APK | **Assumed** (recommended) |
| Extras in v1 | Record sales, backup/restore, low-stock alerts; Urdu + Hindi in a later milestone | **Assumed** (recommended) |

Anything marked **Assumed** is easy to change. See §17, "Open questions".

---

## 1. Who uses it

| Person | Context | What they need most |
|---|---|---|
| **Seller** (shopkeeper or artisan in Srinagar, or a travelling seller) | Busy shop, often one hand free, mid-range Android phone, mixed comfort with apps, may prefer Urdu/Hindi/Kashmiri | Add a shawl fast, never lose count, sell in seconds, look professional to customers |
| **Walk-in or WhatsApp customer** | Browsing in the shop, or at home on WhatsApp | Beautiful photos, clear rates, what colours are available, an easy way to ask/buy |
| **You (owner)** | Receive updates from several sellers | A clear, trustworthy, regular picture of what sold, for how much, and what stock is left, with photos |

### UX principles (they guide every screen)

1. **Photo first, typing last.** Products are recognised by their picture. Every form starts with the camera. Names come from tap-able suggestions.
2. **The count is sacred.** Piece counts are big, always visible, never ambiguous, and every change is recorded with a reason.
3. **Nothing is lost by accident.** Every delete can be undone. Deleted items wait 30 days in "Recently deleted". Backups are one tap.
4. **Fast for frequent work, delightful for rare moments.** Selling and counting have no showy animation. Finishing a sale, sending a report and the first launch get the "wow".
5. **Works with no signal, on a cheap phone, in sunlight.** No spinners waiting on a network. High contrast. 60 fps on a 3–4 GB RAM phone.
6. **Speak the seller's language.** Plain words ("Pieces left", not "Inventory quantity"). Urdu (right-to-left) and Hindi, with Kashmiri as a later option.
7. **Look premium to customers.** Anything a customer sees (Showroom, catalogue PDF, product card) must feel like a boutique, not a spreadsheet.

### Time-on-task targets (measured in field tests, §14)

| Task | Target |
|---|---|
| Add a shawl with 2 photos and 2 colours | under **60 s** |
| Record a sale of one piece | under **15 s** (≤ 4 taps) |
| Find a product by looking | under **5 s** |
| Send a catalogue PDF to a customer | under **30 s** |
| Send a sales report to the owner | under **20 s** |
| Add a new customer while selling | under **20 s** (name + phone, or pick from phone contacts) |
| Find "what did this customer buy last time?" | under **10 s** |

---

## 2. How it works end to end

```
 ┌──────────────── Seller's Android phone (offline) ────────────────┐
 │                                                                   │
 │  Camera/Gallery ──► Photos (app storage, compressed)              │
 │                         │                                         │
 │  Add product ──► SQLite database ◄── Sell ── Showroom (customer)  │
 │                  products · colours · piece counts                │
 │                  stock history · sales · reports                  │
 │                         │                                         │
 │          ┌──────────────┼───────────────────┐                     │
 │          ▼              ▼                   ▼                     │
 │   Catalogue PDF    Sales report PDF     Backup file (.zip)        │
 │   (photos + ₹)     (sold + photos)      (database + photos)       │
 └──────────┼──────────────┼───────────────────┼─────────────────────┘
            ▼              ▼                   ▼
     WhatsApp → Customer   WhatsApp → You     Google Drive / WhatsApp / USB
```

The only time the internet is used is when WhatsApp itself delivers a message. WhatsApp queues the message until there is signal.

---

## 3. Features

### MVP (version 1.0)

**Stock**
- Add / edit / delete products: photos (up to 8), name, category, craft, material, size, rate (₹), optional cost price (hidden from customers), notes.
- Colours with **piece counts** per colour. Total pieces shown automatically.
- "One-of-a-kind" switch for unique hand-made pieces (count is 1, sold means gone).
- Stock list: search, category chips, filters (Low stock, Sold out), sort (newest, most pieces, rate).
- **Piece counts everywhere**: big total on Home, per-product badge, per-colour steppers.
- **Stock history**: every change (added, sold, returned, corrected, damaged, deleted) is recorded with a time and reason.
- Low-stock alerts (default ≤ 1 piece, adjustable).
- Recently deleted (30 days) + Undo.

**Selling**
- Record a sale in ≤ 4 taps: product → colour → quantity → rate (pre-filled, editable) → payment (Cash/UPI/Card). Customer name/phone optional.
- Sale lowers the count automatically. Returning a sale puts the count back, and both are logged.
- Sales list by day, with totals for today / this week / this month.
- Simple bill (PDF/image) that can be sent to the customer on WhatsApp.

**Showing stock to customers**
- **Showroom mode**: a full-screen, customer-safe catalogue on the phone (no cost prices, no settings, exit needs a long-press + PIN).
- **Catalogue PDF with rates** sent on WhatsApp: pick all stock, a category, or hand-picked items. See §6.
- **Product card image** for a single piece (photo + name + rate + shop name) to send on WhatsApp.

**Customer book**
- Customer records: name, WhatsApp/phone, city, address (optional), type tag (*Regular*, *Wholesale/Dealer*, *Tourist*, *Walk-in*), notes.
- Add from scratch, **pick from phone contacts**, or create during a sale in one step.
- **Likes**: favourite colours, crafts and budget range. Set by hand, and also **learned from purchases** (e.g. "Usually buys Sozni, maroon, ₹5–8k").
- **History timeline**: purchases (with photos), returns, catalogues and product cards sent, notes.
- Totals: lifetime spend, number of purchases, last visit.
- **Follow-ups**: "Remind me in 2 weeks", "New Kani arrived: tell her", with local notifications (no internet).
- **Suggest for this customer**: in-stock items matching their likes, one tap to send as a catalogue.
- Customer list: search, tag filters, sort by last visit / spend; quick WhatsApp and call buttons.
- Privacy: delete a customer (sales stay, but the name is removed from them); record whether the customer agreed to receive WhatsApp catalogues.

**Owner reporting**
- **Sales report PDF to the owner** on WhatsApp, with photos, for "since last report", today, this week, this month or custom dates. See §7.
- Report history: what was sent and when.

**Safety**
- One-tap **backup** (database + photos into one `.zip`) shared to Google Drive, WhatsApp (to yourself or the owner) or a USB stick. **Restore** on a new phone.
- Weekly backup reminder (local notification, no internet).
- Optional app lock: 4-digit PIN or fingerprint.

### Later (after field feedback)

| Milestone | Feature |
|---|---|
| 1.1 | Urdu (RTL) and Hindi. Kashmiri if fonts and testers confirm |
| 1.2 | QR tags: print a QR sticker per design, scan to sell or look up (offline) |
| 1.2 | Guided camera: framing overlay for consistent shawl photos; on-device background clean-up |
| 1.3 | **Owner mode**: you import the data file attached to each seller's report and see all sellers combined, on your own phone, still offline |
| 2.0 | Optional cloud sync / online storefront / iPhone (the code is written so this stays possible) |

---

## 4. Screens and flows

Navigation: a native bottom tab bar with **5 tabs** plus context actions. Tab switches do **not** animate (per `expo-animation`: they are frequent peer switches).

```
Tabs:  [ Home ]  [ Stock ]  [ Sales ]  [ Customers ]  [ More ]
Big actions: "+ Add product" (Stock), "Sell" (Home & product), "Showroom" (Home), "+ Customer" (Customers)
```

### 4.1 First launch (about 1 minute, once)
1. **Welcome**: a woven-thread animation forms the Gathir paisley mark (1.2 s, tap to skip). One line: "Your shop, in your pocket."
2. **Language**: English · اردو · हिन्दी (large cards; Urdu/Hindi arrive in 1.1, but the screen is built now).
3. **Your shop**: shop name, your name, shop phone, address (all optional except shop name). Used on PDFs.
4. **Owner's WhatsApp number**: pre-filled from the build (you set it once when making the APK), so sellers don't type it. Can be changed only with the PIN.
5. **Lock (optional)**: PIN / fingerprint.
6. **Start**: "Add your first shawl" or "Try with sample products" (sample data can be cleared with one tap).

### 4.2 Home ("My Shop")
- **Stock card**: big **total pieces**, number of designs and stock value at rate (₹). Counts roll odometer-style when they change.
- **Today**: pieces sold and amount, compared with yesterday.
- **Needs attention**: low-stock and sold-out designs (thumbnail strip).
- **Owner report status**: "Last sent 3 days ago · 7 new sales" with a **Send report** button.
- **Follow-ups due today**: customers to contact, with one-tap WhatsApp.
- Quick actions: **Sell**, **Add product**, **Showroom**, **Send catalogue**.

### 4.3 Stock (list)
- Grid of photo cards by default (switch to compact rows). Each card: photo, name, rate, **piece badge** (green ≥ 3, saffron "Low" 1–2, red "Sold out" 0, always with text, not colour alone) and colour dots with mini counts.
- Search (name, craft, colour, code), category chips (Shawls, Stoles, Pherans, Kani, Pashmina, Sozni, Aari, Papier-mâché, Other), filters, sort.
- Row gestures (compact view) have visible button alternatives: swipe right **Sell 1**, swipe left **Delete** (with undo).
- Multi-select (long-press) → **Send as catalogue**, Delete, Change category.
- Empty state: animated loom illustration + "Add your first shawl".

### 4.4 Product detail
- Swipeable photo gallery with **pinch-zoom to see the weave**. Double-tap zooms to 2.5×.
- Name, craft, material, size, rate, notes. Cost price shown only to the seller (eye toggle).
- **Colours & pieces**: one row per colour: swatch, name, big count, **– / +** steppers.
  - **+** = "Added stock" (restock).
  - **–** asks a quick reason with chips: *Sold* (opens Sell sheet), *Damaged*, *Counted wrong*, *Returned to owner*, *Sample/gift*. This keeps the history honest for reports.
- History timeline (latest first).
- Actions: **Sell**, **Send to customer** (product card or PDF), Edit, Delete.

### 4.5 Add / Edit product (3 short steps, auto-saved draft)
1. **Photos**: camera or gallery (multi-select), drag to reorder; first photo = cover. Tip overlay: "Lay flat in daylight, fill the frame."
2. **Details**: name (suggestions from craft + category, e.g. "Sozni Pashmina Stole"), category & craft chips, material chips (Pashmina, Wool, Silk, Cotton, Blend), size chips, rate (₹ number pad), optional cost price, notes.
3. **Colours & pieces**: pick from a named swatch palette (Red, Maroon, Beige, Black, Grey, Blue, Green, Pink, Multi…) or "photo colour" (sample from the cover photo); stepper for pieces. Or switch **One-of-a-kind**.
- **Save** → card flies into place in the Stock grid; success haptic.
- Inline validation only (rate needs a number, at least 1 photo recommended, not required).

### 4.6 Sell (bottom sheet)
`Product (search / recent / scan later) → Colour → Quantity (max = pieces left) → Rate (pre-filled) → Payment chips → Done`
- **Customer** row (optional, one tap): *Walk-in* (default) · search existing · **+ New** (name + phone, or pick from contacts) inline, without leaving the sheet.
- Optional: discount, note.
- After **Done**: count animates down, short success haptic, toast "Sold 1 · Sozni stole (Red) · ₹6,500 — **Undo** · **Send bill**".

### 4.7 Sales
- Grouped by day with day totals; filters by period and payment.
- Sale detail: items with photos, amount, payment, customer, **Return/Cancel** (restores stock, logged), **Send bill**.

### 4.8 Customers
- **List**: avatar initials (tinted with their favourite colour), name, tag, last visit, lifetime spend. Search by name or phone. Filters: tags, follow-up due, "hasn't visited in 3 months". Sort by last visit, spend or name.
- **Customer profile**:
  - Header: name, tag, city, big **WhatsApp** and **Call** buttons.
  - Stats: total spent, purchases, last visit.
  - **Likes** chips (colours, crafts, budget), editable, with "learned from purchases" suggestions to accept.
  - **Suggested for them**: in-stock designs matching their likes → **Send as catalogue**.
  - **Timeline**: purchases (photo thumbnails), returns, catalogues sent, notes, follow-ups.
  - **Follow-up**: date + note → local reminder notification.
  - Actions: Edit, Sell to this customer, Send catalogue, Delete (with undo).
- **Add / edit customer**: name, phone (with +91 default and WhatsApp check), pick from contacts, city, address, tag, likes, notes, "OK to send catalogues on WhatsApp" switch.
- Duplicate guard: same phone number → "Already saved as *Name*. Open?"

### 4.9 Showroom mode (customer-facing)
- Full-screen, edge-to-edge photos, swipe through designs, pinch to zoom on the weave.
- Shows: name, craft, colours available, **rate**, and availability as **"Available" / "Only 2 left"** (exact counts optional in settings).
- Never shows: cost price, history, sales, settings.
- Category rail at the top; animated sozni-pattern header drawn by Skia.
- "**Send me this**" button: the seller picks the customer (or adds them in one step), and the product card or a mini-catalogue goes to that customer's WhatsApp. The items they liked are saved to their profile.
- Screen stays awake. After 45 s idle it plays a slow slideshow (attract mode).
- Exit: long-press the corner mark for 1.5 s + PIN (if set).

### 4.10 More
Shop profile · Owner number · Catalogue PDF style · What owner reports include (customer names/phones) · Low-stock level · Categories · Customer tags · Language · App lock · Backup & restore · Recently deleted · Storage used · Sample data · About/version.

### State coverage (from the `product-design` skill: every reachable state is designed)
For every list and screen: **empty**, **one item**, **many items (500+)**, **long names**, **no photo**, **sold out**, **storage almost full**, **WhatsApp not installed**, **WhatsApp Business only**, **share cancelled**, **PDF too large**, **restore from older app version**, **phone in Urdu (RTL)**, **font size 200%**.

---

## 5. Stock counting rules

- Each **product (design)** has one or more **colours**; each colour has a **piece count** (≥ 0).
- **Total pieces** for a design = sum of its colours. **Total stock** on Home = sum of all designs (deleted ones excluded).
- Every change writes a **stock movement** row: `+3 added`, `−1 sold (sale #123)`, `+1 returned`, `−1 damaged`, `±n correction`, `−n deleted`. The count stored on the colour is always the sum of its movements. It is updated in the **same database transaction**, so it can never drift.
- **Delete** = soft delete (hidden, kept 30 days in Recently deleted, still in reports as "Deleted: 3 pieces"). Undo for 8 s from the toast, restore any time within 30 days.
- **Sold out** ≠ deleted: sold-out designs stay (count 0) so they can be restocked and keep their sales history.

---

## 6. Catalogue PDF for customers (stock with rates)

The seller's main sales tool on WhatsApp. It must look like a boutique lookbook.

**Flow**: Home/Stock/Customer profile → **Send catalogue** → choose *All in stock* / *a category* / *selected items* / *suggested for this customer* → options → **Preview** (swipe the actual pages) → pick a **customer** from the customer book (or type a number, or choose a chat) → **Send on WhatsApp**. The send is logged on that customer's timeline. A personal greeting uses their name ("Prepared for Mrs. Shah").

**Options** (remembered for next time):
- Show rates ✔ (default on) · Show "Only n left" ✔ · Show exact counts ✖ · Hide sold-out ✔
- Title (e.g. "Winter Collection"), personal note, "Rates valid till ___", discount line (optional)
- Style: **Bazaar** (vibrant, default) or **Ivory** (quiet, luxury); 2 or 3 items per row
- Language: English (Urdu/Hindi in 1.1)

**Layout (A4 portrait)**:
1. **Cover**: shop name in display type, a generated paisley/sozni border (p5.js → SVG), collection title, date, seller name and phone/WhatsApp.
2. **Product pages**: photo cards with name, craft · material · size, colour swatches available, **rate in ₹** (Indian format), availability tag. Cards never split across pages.
3. **Last page**: how to order (WhatsApp number, UPI ID optional, shop address), "Rates valid till", thank-you line.
- Page numbers and the shop name in the footer of every page.

**Size budget**: photos embedded at ~800 px, JPEG quality ~0.72 (≈ 80–100 KB each). A 60-item catalogue stays under **~8 MB**. Over 120 items → split into "Part 1 / Part 2" automatically.

**Product card image** (single item): a 1080×1350 image with the photo, name, rate and shop name inside a pattern frame. Best for quick replies on WhatsApp.

---

## 7. Sales report PDF for the owner (you)

**Flow**: Home → **Send report** → period (*Since last report*, default) → **Preview** → **Send on WhatsApp** → opens WhatsApp **directly in your chat** with the PDF attached and a short text summary. When the seller comes back to the app: "Marked as sent ✓ (Undo)".

**PDF contents**:
1. **Summary**: shop, seller, phone, period, generated time, report number.
   Pieces sold · Total amount (₹) · by payment (Cash/UPI/Card) · by category · discounts given.
2. **Every sale**: date/time, **product photo**, name, colour, quantity, rate, amount, payment, bill number, and **who bought it** (customer name, phone, city, tag, if entered). The seller controls whether customer phones are included (setting, default **on**, because this report goes only to you).
3. **Customers this period**: new customers added, top customers by spend, catalogues sent.
4. **Stock changes not from sales** (for trust): added, returned, damaged, corrections, deletions, each with reason and time.
5. **Current stock snapshot**: every design with photo, colours and piece counts, rate; low-stock and sold-out highlighted.
6. Footer: app version and a short **report fingerprint** (a checksum of the data) so edited PDFs can be spotted.

**WhatsApp message text** (pre-filled):
```
Gathir report — <Shop name> (<Seller>)
<From date> – <To date>
Sold: 7 pieces · ₹48,500
In stock: 63 pieces · 21 designs · 3 low
PDF attached.
```

**Also send photos** (optional toggle): full-quality photos of sold items as separate images (WhatsApp shares up to ~30 media at a time, so they are batched).

**Data file (prepared now, used in 1.3)**: an optional `report.json` with the same data, so a future **Owner mode** can import reports from many sellers into one view.

### How sending to WhatsApp works (technical)
- `react-native-share` → `Share.shareSingle({ social: WHATSAPP | WHATSAPPBUSINESS, whatsAppNumber, url: <pdf file> })` opens the specific chat with the file on Android.
- Detects WhatsApp vs WhatsApp Business. Falls back to the normal Android share sheet (`expo-sharing`) if neither is installed or the direct method fails. The number is copied to the clipboard as a backup.
- **Spike in week 1** to confirm the exact behaviour on current WhatsApp versions (see §15 risks).

---

## 8. Data storage

**Engine**: `expo-sqlite` (WAL mode) + **Drizzle ORM** (typed schema, migrations, live queries so counts on screen update instantly).

```text
shop_settings  id, shop_name, seller_name, seller_code, phone, address, owner_whatsapp,
               language, low_stock_level, catalogue_style, pin_hash, last_backup_at, schema_version

categories     id, name, icon, sort_order, is_default
products       id (uuid), code (short, e.g. GTH-0042), name, category_id, craft, material, size,
               rate_paise, cost_paise?, notes, one_of_a_kind, cover_photo_id,
               created_at, updated_at, deleted_at?
colours        id, product_id, name, hex, pieces (cached), sort_order, deleted_at?
photos         id, product_id, file_name, thumb_name, width, height, sort_order
stock_moves    id, colour_id, delta, reason (added|sold|returned|damaged|correction|deleted|restored),
               sale_id?, note, created_at
customers      id (uuid), name, phone_e164?, whatsapp_ok, city?, address?, tag (regular|wholesale|
               tourist|walk_in|custom), notes?, likes_json (colours, crafts, budget range),
               created_at, updated_at, deleted_at?
customer_events id, customer_id, kind (note|catalogue_sent|card_sent|follow_up|liked_item),
               ref_id?, note?, due_at?, done_at?, created_at
sales          id, bill_no, customer_id?, customer_name_snapshot?, customer_phone_snapshot?,
               payment (cash|upi|card|other), discount_paise, total_paise, created_at,
               cancelled_at?, report_id?
sale_items     id, sale_id, colour_id, product_name_snapshot, colour_name_snapshot,
               qty, rate_paise, photo_snapshot_name
reports        id, kind (owner|catalogue|bill), period_from, period_to, file_name,
               created_at, sent_at?, fingerprint
```

- **Money** is stored as whole paise (integers) to avoid rounding errors. It is shown as `₹1,25,000` using `Intl.NumberFormat('en-IN')`.
- **IDs** are UUIDs plus a seller code, so data from many sellers can later be merged without clashes.
- **Photos**: saved inside the app's private storage (`photos/`), resized to max 1600 px (JPEG 0.8) plus a 400 px thumbnail. Typical shawl photo ≈ 250 KB, so 500 designs × 3 photos ≈ 400 MB. A **Storage used** screen shows this and can clean up photos of long-deleted items.
- **Sale snapshots**: sale items copy the product name, colour and photo at the moment of sale, so reports stay correct even if the product is later edited or deleted.
- **Customer totals** (lifetime spend, purchases, last visit) are calculated from sales, not stored twice, so they can never disagree. **Learned likes** come from the crafts and colours they bought most.
- **Deleting a customer** removes their record and clears the name/phone snapshots on their sales (amounts stay for totals). Undo for 8 s, Recently deleted for 30 days.
- **Backups**: one `.zip` (database file + photos + `manifest.json` with app/schema version), shared anywhere. Restore checks the version and runs migrations. Android's automatic backup is not enough (25 MB limit), so this is manual + reminded.

---

## 9. Design system — "Vibrant Bazaar"

Inspired by Srinagar's markets: jewel colours on warm pashmina ivory, crisp structure, playful accents. Built as tokens (`src/ui/tokens.ts`) following the `expo-design-system` skill. No hard-coded colours in screens.

### Colour (contrast checked against WCAG AA)

| Token | Light | Dark ("Dal at night") | Use |
|---|---|---|---|
| `bg` | Pashmina ivory `#FFF8EE` | `#15101F` | App background |
| `surface` | `#FFFFFF` | `#1F1830` | Cards, sheets |
| `surfaceSunken` | `#F6ECDD` | `#100C18` | Inputs, wells |
| `text` | Walnut `#2B1A12` (15.8:1) | `#F8EEDF` (16.2:1) | Primary text |
| `textMuted` | `#6B5446` (6.7:1) | `#BFAE9C` (7.9:1) | Secondary text |
| `primary` | Chinar red `#C62F17` (white text 5.5:1) | `#FF7452` (dark text 7.0:1) | Main buttons, Sell |
| `saffron` | `#F4A300` (walnut text 8.0:1) | `#FFC24B` | Highlights, "Low" badge |
| `teal` | Dal teal `#0B6E77` (white 6.0:1) | `#4CC9D1` | Links, info, Showroom |
| `rose` | Kani rose `#B0124F` (white 6.9:1) | — | Accents, offers |
| `meadow` | `#23794A` (white 5.4:1) | — | In stock, success |
| `indigo` | Pheran indigo `#3B3A98` (white 9.4:1) | — | Category accents |
| `lowText` | `#8A4F00` (6.2:1) | `#FFC24B` | Low-stock text |

Stock status always uses **text + icon + colour**, never colour alone.

### Type
- **Display**: *Fraunces* (static 600/700 cuts). Warm, characterful serif for shop name, headings, prices on PDFs.
- **UI**: *Manrope* (400/600/700). Clear on low-res screens; **tabular numbers** for all counts and prices (`fontVariant: ['tabular-nums']`).
- **Urdu**: *Noto Nastaliq Urdu* (line-height ≈ 2×). **Hindi**: *Noto Sans Devanagari*.
- Scale (sp): 12 · 14 · 16 (body) · 20 · 24 · 32 · 44 (big counts). Supports system font scaling to 200%. Validated with the `typography-audit` skill.

### Shape, space, touch
- 4-pt spacing grid. Card radius 20, chip radius full, sheet radius 28.
- Minimum touch target **48 dp**. Primary actions sit in the thumb zone (bottom third).
- Elevation: soft warm shadows + 1 px borders (they read better in sunlight than shadows alone).

### Pattern language (original, generated)
- **Boteh (paisley) field**: paisley forms placed along a flow field.
- **Kani weave**: twill grid with drifting colour threads.
- **Sozni stitch**: fine needle-stitch vine lines that "draw themselves".
- **Chinar leaf fall**: a few leaves drifting (celebration only).
All are **original algorithms** (no copying of real shawl designs or other artists). They are designed in p5.js (§11) and drawn live with Skia or exported as SVG for PDFs.

### Core components
`ProductCard` · `PieceBadge` · `ColourStockRow` (swatch + count + steppers) · `Stepper` (hold to repeat) · `PhotoGallery` (pinch-zoom) · `Chip`/`ChipGroup` · `MoneyInput` (₹ pad) · `BottomSheet` (`@expo/ui`) · `Toast` with Undo · `EmptyState` (animated) · `StatCard` (rolling numbers) · `PatternHeader` (Skia) · `PdfPreview`.

---

## 10. Motion system

Rules from the installed `expo-animation`, `animating-react-native-expo` and `reanimated-skia-performance` skills:

1. **Should it animate at all?** Frequent actions (tab switches, typing, scrolling) get **no** animation. Common actions get **under 150 ms**. Delight is only for rare moments.
2. **Name the purpose**: feedback · spatial consistency · state change · explanation · delight.
3. **Right tool**: Reanimated CSS transitions for state changes. Layout animations for items entering, leaving or reflowing. Shared values + Gesture Handler for anything a finger drags. Native stack for screen changes (never hand-rolled). Skia only for pattern art and celebration.
4. **Always on the UI thread**: no `setState` per frame, no animating `height`/`width`. Animate only `transform` and `opacity`.
5. **Reduced motion ships with every animation** (`ReduceMotion.System`): moves become fades, and celebrations become a static check mark.
6. **Feel is judged on a release build on the cheapest test phone.**

### Tokens (`src/ui/motion.ts`)

| Token | Value | Used for |
|---|---|---|
| `press` | scale 0.97, 120 ms, ease-out `bezier(0.23,1,0.32,1)` | Every pressable |
| `chip` | 160 ms ease-out | Chips, toggles, badge colour |
| `springSettle` | `{ duration: 400, dampingRatio: 1 }` | Default settle |
| `springSnap` | `{ duration: 400, dampingRatio: 0.8, velocity }` | Drag release, swipe rows |
| `springSheet` | `{ duration: 300, dampingRatio: 0.8 }` | Sheets |
| `springBazaar` | `{ duration: 450, dampingRatio: 0.65 }` | Playful pops (badges, success), rare only |
| `moveInOut` | `bezier(0.77,0,0.175,1)` | On-screen moves |

### Haptics (`expo-haptics`)
Stepper tick → `selection` · swipe commit / sheet detent → `impact Light` · delete → `impact Medium` · sale done / report sent → `notification Success` · error → `notification Error`.

### Signature moments (the "delight budget")

| Moment | Frequency | Motion | Purpose |
|---|---|---|---|
| First launch | once | Threads weave into the paisley mark (Skia path trim + stagger), 1.2 s, skippable | Delight / brand |
| Piece count changes | often | Digits roll (odometer, 180 ms), badge colour cross-fades when crossing the low-stock line | State change |
| Stepper hold | often | Accelerating repeat + selection haptic per step, no extra visuals | Feedback |
| Product card → detail | often | Platform screen transition; cover photo fades up crisply (no custom shared-element hacks in v1) | Spatial |
| Save new product | daily | Card pops into the grid (`springBazaar`) + success haptic | Feedback |
| Sale completed | daily | Count rolls down, sheet settles, **two chinar leaves drift** (Skia, 900 ms, max 3 particles) | Delight (rare-ish, kept tiny) |
| Delete | occasional | Row collapses (layout animation), toast slides up with **Undo** | State + recovery |
| PDF preview | occasional | Pages fan in with a short stagger (60 ms apart, 5 pages max) | Explanation |
| Report sent | weekly | Envelope folds closed, paisley confetti burst (Skia, ≤ 40 particles, 1.2 s) | Delight |
| Showroom | per customer | Slow Ken-Burns drift on photos (8 s), animated sozni header, pinch-zoom with rubber-band | Delight / premium |
| Empty stock | rare | Loom draws threads in a loop | Explanation |

Skia canvases **pause when off-screen** and when the app is in the background. Particle counts are capped. Everything is tested at 60 fps on the low-end test phone.

---

## 11. p5.js "Pattern Lab"

p5.js is used where it is strongest: **designing and exploring generative art quickly**, with seeded randomness and live sliders. The phone app itself draws with **Skia** (native, much faster than a web view on cheap phones).

```
design/pattern-lab/
  index.html            ← opens all sketches with sliders (seed, density, palette, speed)
  boteh-field.js        ← paisley along a flow field
  kani-weave.js         ← twill grid + drifting threads
  sozni-vine.js         ← self-drawing stitch vines
  chinar-fall.js        ← leaf particles
  exports/              ← chosen seeds exported as SVG/PNG
```

**Pipeline**
1. Explore in p5.js (`algorithmic-art` + `p5js` skills): pick seeds and parameters that look right with the Vibrant Bazaar palette.
2. **Export SVG** for static uses: app icon, splash, PDF cover borders, empty-state art.
3. **Port the same maths to Skia** (`reanimated-skia-performance` skill) for the live pieces: welcome weave, Showroom header, celebrations. The same seed gives the same art on both.
4. A small **dev-only tuning screen** in the app (sliders) for adjusting the live versions on a real phone.

---

## 12. Language, accessibility and low-end phones

- **Languages**: English at launch. Urdu (RTL, Nastaliq) and Hindi in 1.1 via `i18next` + `expo-localization`. All strings are externalised from day one, and layouts use start/end (not left/right) so RTL works. Numbers and ₹ use Indian grouping.
- **Accessibility**: TalkBack labels on every control ("Sozni stole, red, 4 pieces left, rate 6,500 rupees"). Visible buttons for every swipe action. 48 dp targets. Contrast AA (§9). Font scaling to 200% without clipping. Reduced motion respected. Checked against the `web-design-guidelines` rules adapted to mobile, plus `impeccable` audits.
- **Low-end phones**: target Android 7.0+ (Expo minimum). Test on a ~₹8–10k phone with 3–4 GB RAM. Fast lists (`FlashList`) with thumbnail images (`expo-image`). Cold start under 2 s. App size under 40 MB.
- **Sunlight & shop use**: high-contrast light theme by default. Dark theme follows the system.

---

## 13. Technology

| Area | Choice | Why |
|---|---|---|
| App framework | **Expo (latest SDK) + React Native, TypeScript**, New Architecture | One codebase, great Android tooling, matches installed skills, iPhone possible later |
| Navigation | **Expo Router** (native stack + native tabs) | Real Android transitions & predictive back |
| Native UI pieces | **`@expo/ui`** (Jetpack Compose on Android) for sheets, switches, pickers, menus | Truly native feel (per `expo-ui` skill) |
| Database | **expo-sqlite + Drizzle ORM** (migrations, live queries) | Fast, offline, typed |
| Photos | expo-image-picker · expo-image-manipulator · expo-file-system · **expo-image** | Capture, compress, store, fast display |
| Lists | **@shopify/flash-list** | Smooth with hundreds of items |
| Motion | **react-native-reanimated 4** + react-native-worklets · **react-native-gesture-handler** · expo-haptics · react-native-keyboard-controller | UI-thread animation & gestures |
| Art | **@shopify/react-native-skia** (live) · p5.js (design-time) | Generative patterns |
| PDFs | **expo-print** (HTML/CSS → PDF) with embedded fonts and images | Beautiful, consistent PDFs offline |
| Sharing | **react-native-share** (direct to a WhatsApp number) + expo-sharing (fallback) · react-native-view-shot (product card image) | WhatsApp delivery |
| Backup | fflate (zip) + expo-document-picker (restore) | Pure-JS, no server |
| Security | expo-local-authentication + expo-secure-store (PIN hash) | Optional app lock |
| Customers | expo-contacts (pick a contact, read-only, asks permission) · expo-notifications (local follow-up reminders) · libphonenumber-js (+91 numbers) | Customer book |
| Language | i18next + expo-localization | Urdu/Hindi later |
| State | Database is the source of truth. Small UI state in Zustand | Simple |
| Quality | ESLint + Prettier, Jest + React Native Testing Library, **Maestro** (Android end-to-end flows) | Confidence |
| Build | **EAS Build** (or local Gradle) → signed **APK** to install directly. AAB for Play Store later | "Just install it" |

### Folder layout (per `expo-project-structure`)
```
app/                         Expo Router screens
  _layout.tsx
  (onboarding)/              welcome, language, shop, owner, lock
  (tabs)/                    index (Home), stock, sales, customers, more
  customer/[id].tsx, customer/new.tsx
  product/[id].tsx, product/new.tsx, product/[id]/edit.tsx
  sell.tsx (form sheet)      catalogue/ (pick → options → preview)
  report/ (period → preview) showroom/  backup/  deleted.tsx
src/
  db/          schema.ts, migrations/, queries/ (stock, sales, reports)
  features/    stock/ sales/ customers/ catalogue/ report/ showroom/ backup/ onboarding/
  ui/          tokens.ts, motion.ts, theme/, components/, patterns/ (Skia)
  pdf/         templates/ (catalogue, report, bill), fonts/, render.ts
  share/       whatsapp.ts, productCard.tsx
  i18n/        en.json, ur.json, hi.json
  lib/         money.ts (paise ↔ ₹ en-IN), images.ts, ids.ts, dates.ts
design/pattern-lab/          p5.js sketches (§11)
docs/                        PLAN.md (this file), DESIGN.md (later)
.maestro/                    end-to-end flows
```

---

## 14. Testing & field trials

- **Unit tests**: stock maths (moves ↔ counts), money formatting, report totals, backup/restore round-trip, migrations.
- **End-to-end (Maestro on an Android emulator)**: onboarding · add product with 2 colours · sell 1 to a new customer · return · delete + undo · customer profile shows the purchase · send catalogue to that customer (share-sheet stub) · send report · backup → wipe → restore → counts and customers identical.
- **PDF checks**: render catalogue/report with 1, 20, 150 items; check page breaks, fonts, Urdu, file size.
- **Performance**: release build on the low-end phone. Scroll 500 products at 60 fps; cold start < 2 s; no frame drops during the sale animation.
- **Field trials (Srinagar, 3–5 real sellers, 1 week)**: watch them do the §1 tasks without help; record time and confusion points; collect real sample PDFs on your WhatsApp; fix and repeat once.

---

## 15. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| **Phone lost/broken = data lost** (no server) | One-tap backup + weekly reminder; owner reports are an off-phone record; restore tested in CI |
| WhatsApp changes how direct-to-number file sharing works | Week-1 spike; automatic fallback to the share sheet + number copied; support WhatsApp Business |
| PDFs too big for cheap phones | Thumbnail sizes tuned in spike; auto-split large catalogues; "Lite" option without photos |
| Android PDF rendering quirks (fonts, page breaks) | Spike in week 1; embed fonts as base64; avoid complex CSS; test on 3 phones |
| Storage fills up with photos | Compression, Storage screen, cleanup of deleted items' photos |
| Installing an APK outside Play Store shows warnings | Clear install guide for sellers; later Play Store (closed testing) for smoother installs & updates |
| **Losing the app signing key** means sellers can't update without losing data | Keep the keystore in two safe places; same package name forever (`com.gathir.app`, to confirm) |
| **Customer personal data** on a phone that can be lost or shared (India's DPDP Act 2023) | Keep only what's needed; optional app lock; "OK to send catalogues" consent switch; delete-customer that really deletes; backups contain customer data, so the guide tells sellers where to keep them |
| Seller edits counts dishonestly | Append-only stock history with reasons, deletions logged, all shown in owner reports + fingerprint |
| Updates without internet/Play Store | Send the new APK on WhatsApp; data stays because the package name and signature are the same; migrations run on start |
| Low-end performance | UI-thread animation only, capped Skia work, test on the cheapest device every milestone |

---

## 16. Roadmap (about 8 weeks to a field-tested 1.0)

| Week | Milestone | Done when |
|---|---|---|
| 1 | **Foundation + spikes**: Expo app, dev build on a real phone, SQLite + Drizzle schema & migrations, tokens & fonts. Spikes: WhatsApp direct share (WA + WA Business), expo-print PDF with fonts/images/page breaks, Skia on the low-end phone. Pattern Lab started | Spikes pass or fallbacks chosen |
| 2 | **Stock core**: onboarding, add/edit product (photos, colours, pieces), stock list & detail, steppers with reasons, history | Can add 20 real shawls in under 20 min |
| 3 | **Stock polish**: search/filters, delete + undo + Recently deleted, low-stock, Home dashboard with live counts | All §4 states designed |
| 4 | **Selling + customer book**: Sell sheet with customer picker, sales list, returns, bills (PDF/image); customer list, profile, timeline, contacts import, follow-up reminders | Sale in ≤ 4 taps, counts always right; customer history correct |
| 5 | **Customers' view**: Showroom mode, catalogue PDF (Bazaar & Ivory styles), "suggested for this customer", product card image, WhatsApp sending | A customer receives a catalogue that "looks like a boutique" |
| 6 | **Owner reports + safety**: sales report PDF, report history, backup/restore, app lock, backup reminder | Report arrives on your WhatsApp; restore works on a second phone |
| 7 | **Motion & delight pass**: welcome weave, count rolls, sale leaves, report confetti, Showroom drift; reduced-motion versions; perf on the low-end phone | 60 fps in release build |
| 8 | **Field trial & release**: 3–5 sellers, fix findings, accessibility pass, signed APK 1.0 + install guide | Time targets in §1 met |
| Next | 1.1 Urdu/Hindi · 1.2 QR tags & guided camera · 1.3 Owner mode · 2.0 sync/online/iPhone | — |

---

## 17. Open questions for you

1. **Stock counting**: is "per design + colour" right, or are most of your pieces one-of-a-kind?
2. **Several sellers?** Will each seller have their own phone with the app (all reporting to your one WhatsApp number)? Do you want a seller code printed on their reports?
3. **Your WhatsApp number** for reports, and whether you use **WhatsApp or WhatsApp Business**.
4. **Brand**: is "Gathir" the app name? Do you have a logo/colours, or should the Pattern Lab create the mark?
5. **Prices**: one rate per design, or different rates per colour? Do sellers bargain (we can make the rate editable at sale time, as planned)?
6. **Cost price**: should sellers enter it, or should only you know it?
7. **Customer PDF**: show exact piece counts to customers, or just "Available / Only 2 left"?
8. **Languages**: is Urdu or Hindi needed for 1.0 rather than 1.1? Is Kashmiri needed?
9. **Report schedule**: should the app remind sellers to send a report (daily/weekly)?
10. **Customer details**: is name + phone + city + tag + likes enough? Do you want birthdays/anniversaries for festive offers (Eid, Diwali, weddings)? Should customer phone numbers appear in the reports sent to you?
11. **Other items** besides shawls (pherans, stoles, papier-mâché, carpets, dry fruits, saffron)? Each may need different fields (e.g. weight for saffron).

---

## 18. Skills installed for building this (`.claude/skills/`)

| Skill | Source | Used for |
|---|---|---|
| `web-design-guidelines` | vercel-labs/agent-skills | UX/accessibility rule checks (adapted to mobile screens) |
| `frontend-design` | anthropics/skills | Distinctive visual direction, avoiding template looks |
| `impeccable` | pbakaus/impeccable | Design critique, polish and audits (also native Android screens) |
| `product-design` | mblode/agent-skills | Flows, reversibility (undo vs confirm), state coverage |
| `typography-audit` | mblode/agent-skills | Type scale, fonts, Urdu/Hindi rendering |
| `ui-animation` | mblode/agent-skills | Motion principles, curve fitting, motion review |
| `expo-animation` | expo/skills (with Emil Kowalski) | The motion decision sequence, springs, haptics, reduced motion |
| `animating-react-native-expo` | tristanmanchester/agent-skills | Reanimated 4 + Gesture Handler 3 implementation |
| `reanimated-skia-performance` | andreev-danila/skills | Skia pattern art, shaders, jank diagnosis |
| `expo-design-system` | expo/skills | Tokens, theme, component conventions |
| `expo-native-ui` | expo/skills | Native-feeling screens |
| `expo-ui` | expo/skills | `@expo/ui` (Jetpack Compose) sheets, pickers, switches |
| `expo-router` | expo/skills | Navigation, native tabs, form sheets |
| `expo-project-structure` | expo/skills | Folder layout for the new app |
| `vercel-react-native-skills` | vercel-labs/agent-skills | React Native performance best practices |
| `vercel-composition-patterns` | vercel-labs/agent-skills | Clean, reusable component APIs |
| `p5js` | nousresearch/hermes-agent | p5.js Pattern Lab sketches & export |
| `algorithmic-art` | anthropics/skills | Seeded, original generative art method |

Exact versions are pinned in `skills-lock.json`. Web-only skills (GSAP, React View Transitions, Next.js performance, Playwright web testing) were tried and **removed** because the app is Android-only.
