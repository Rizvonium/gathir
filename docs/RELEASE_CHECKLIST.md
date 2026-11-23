# Release checklist

How to build the Gathir APK, put it on a phone, and test the things that cannot be checked on the build machine. Tests, typecheck, lint and the JS bundle export are checked on the build machine. Everything below needs a real phone.

## 1. Before you build

1. Run the build-machine checks. All four must pass:
   ```sh
   npm run typecheck
   npx jest
   npx expo lint
   EXPO_OFFLINE=1 npx expo export --platform android --output-dir /tmp/gathir-export
   ```
2. Open `app.json` and set **`expo.extra.ownerWhatsApp`** to the owner's WhatsApp number with country code, digits only (for example `919876543210`). Onboarding fills the owner number from this value. If you leave it empty, the seller has to type it during onboarding. Also set `extra.ownerName`.
3. For every release after the first, raise `expo.version` (for example `1.0.1`) **and** `expo.android.versionCode` (for example `2`). Android will not install an update over an APK with the same or a higher `versionCode`. `eas.json` uses `appVersionSource: local`, so EAS reads these numbers from `app.json`.

## 2. Build the APK with EAS

```sh
npx eas-cli login              # once, with the Expo account that owns the project
npx eas-cli build -p android --profile preview
```

- The `preview` profile builds an installable **`.apk`** for internal distribution. (`production` builds an `.aab` for the Play Store. Do not use it for sideloading.)
- On the first build, EAS asks to create an Android keystore. Say yes and let EAS store it.
- When the build finishes, EAS prints a download link and a QR code.

### Keep the signing keystore safe

Android only installs an update if it is signed with **the same keystore** as the installed app. If the keystore is lost, sellers cannot update. They have to uninstall the app, and uninstalling deletes all their stock, sales and customers unless they made a backup first.

- Download a copy now: `npx eas-cli credentials -p android` → *Keystore* → *Download*.
- Keep the `.jks` file and its passwords in two places off this computer (for example a password manager and an encrypted USB stick).
- Never commit the keystore or its passwords to git.

## 3. Install on a phone

1. On the phone, open the EAS link (or scan the QR code) and download `gathir-….apk`. You can also send the file to the phone over WhatsApp or USB.
2. Tap the file. If Android blocks it, allow **Install unknown apps** for the browser or file manager you used (Settings → Apps → Special app access → Install unknown apps).
3. If Play Protect warns about an unknown developer, tap **More details → Install anyway**.
4. To update, install the new APK over the old one. **Do not uninstall first**: that deletes all data.
5. USB alternative: `adb install -r gathir.apk` (`-r` keeps the data).

Test on at least two phones: a **low-end phone** (2–3 GB RAM, Android 8–10, minSdk is 26) and a recent one (Android 13+).

## 4. On-device test checklist

Mark each item pass or fail and note the phone model. Anything failing blocks the release.

### WhatsApp sharing
- [ ] **Catalogue to a customer, WhatsApp installed:** the chat with *that* customer's number opens with the PDF attached. You should not land in the contact picker.
- [ ] **Same flow with only WhatsApp Business installed:** it opens WhatsApp Business directly to the number.
- [ ] **Both apps installed:** the app picks the right one, or asks which one, and it is clear which one will open.
- [ ] **Neither app installed:** the normal Android share sheet opens. The customer's number is copied to the clipboard, and a message says so.
- [ ] **Sales report to the owner:** it goes to the `ownerWhatsApp` number and arrives with the PDF readable on the owner's phone.
- [ ] **Bill from a sale (Send bill):** the bill reaches the customer.
- [ ] **Share cancelled** (press back in WhatsApp): the app shows no "sent" state and the report history is not marked sent.
- [ ] Number without `+91`, and a number with a foreign country code: both open the right chat.

### PDFs (catalogue, sales report, bill)
- [ ] Fonts render correctly in the PDF on the phone and in WhatsApp's preview. There are no boxes or tofu in ₹, Urdu or Hindi text, and no fallback serif font.
- [ ] Amounts use Indian grouping (₹1,25,000).
- [ ] Page breaks: no product card, table row or photo is cut across two pages. Headers repeat on long tables. Test with 1 product and with 60+ products.
- [ ] Photos are sharp, the right way up, and the file size stays small enough for WhatsApp (note the size of a 60-product catalogue).
- [ ] **The catalogue PDF shows no cost price, profit or history anywhere.**
- [ ] The report footer shows the app version and the report fingerprint.

### Camera and photos
- [ ] Take a photo in portrait and one in landscape, with the phone held both ways. Thumbnails, product page, Showroom and PDF all show them the right way up.
- [ ] Pick a photo from the gallery (including an old EXIF-rotated photo): it has the right orientation.
- [ ] Deny camera permission, then try again: the app explains and offers Settings. It does not crash.
- [ ] Photos survive closing and reopening the app.

### Contacts picker
- [ ] Add a customer from contacts: name and phone come in, and the number is normalised to +91.
- [ ] A contact with several numbers: you can choose which one.
- [ ] Deny contacts permission: manual entry still works and the app does not crash.
- [ ] Picking a contact during a sale (Sell sheet → + New) returns to the sheet with the sale intact.

### Notifications
- [ ] On Android 13+, the notification permission prompt appears at a sensible moment, not on first launch.
- [ ] A customer follow-up reminder fires at the set time with the app closed, and tapping it opens that customer.
- [ ] The weekly backup reminder fires (set the phone clock forward to test). Tapping it opens Backup.
- [ ] Low-stock alert.
- [ ] Reminders still fire after a phone restart.
- [ ] Notifications denied: the app still works and explains how to turn them on.
- [ ] The notification icon is a white silhouette in the status bar, not a grey square.

### App lock and fingerprint
- [ ] Turn on the PIN, close the app and reopen it: it asks for the PIN.
- [ ] Turn on fingerprint: unlock works, and a wrong finger falls back to the PIN.
- [ ] On a phone with no fingerprint enrolled, the option is hidden or explained.
- [ ] Recents/task switcher shows a blank or covered card, not shop data (Android 13+ native; older versions use the privacy cover).
- [ ] App lock after the app has been in the background, then reopened from a notification or a `gathir://` link.

### Sheets, navigation and gestures
- [ ] The Sell sheet and other form sheets (formSheet): open, drag between detents, and close by swiping down. The keyboard does not cover the fields or the Done button.
- [ ] Android back closes the sheet first, then the screen. Predictive back animation shows on Android 14+.
- [ ] Swipe actions on stock rows work and do not fight vertical scrolling.
- [ ] The photo gallery supports swipe and pinch-zoom.
- [ ] Delete → Undo toast → Undo restores the item and its counts. Recently deleted restores it after the toast has gone.
- [ ] Showroom mode: hand the phone over, swipe through products, and confirm there is **no cost price, profit or history visible** and no way out to the shop data without unlocking.

### Motion and performance (release APK, low-end phone)
- [ ] Press feedback appears instantly (≤ 150 ms) on buttons, rows and the stepper.
- [ ] Tab switches and scrolling have no animation and no jank. Scroll stock with 500+ products (load sample data) and the customer list at 60 fps. Check with *Developer options → Profile HWUI rendering → On screen as bars*.
- [ ] Sheets, the sale-done moment and Skia pattern art run smoothly with no dropped frames.
- [ ] Cold start to a usable Stock screen in under about 3 s on the low-end phone.
- [ ] Generating a 60-product catalogue PDF does not freeze the UI and shows progress.

### Reduced motion
- [ ] Turn on *Settings → Accessibility → Remove animations* (or set animator duration scale to off in Developer options). Every animation uses its reduced version: fades or instant changes, no movement. Nothing gets stuck half-way, and the sale-done and undo states still appear.

### 200% font size and display size
- [ ] Set *Font size* to the maximum and *Display size* to large. Every screen, sheet, toast, button and tab label stays readable and is not cut off. Long product names wrap. The stepper and amount fields still fit.
- [ ] PDFs are not affected by the phone's font size.

### TalkBack
- [ ] With TalkBack on, you can do the main flows by ear: add product, sell 1 piece, send catalogue, undo a delete.
- [ ] Every icon button has a spoken label, and counts and amounts are read correctly ("₹1,25,000", "3 pieces").
- [ ] Focus order follows the screen. When a sheet opens, focus moves into it, and when it closes, focus goes back.
- [ ] The undo toast is announced and can be reached before it disappears.

### Backup and restore across two phones
- [ ] On phone A, with real-looking data (products with photos, sales, returns, customers, deleted items), tap **Backup** and share the `.zip` to WhatsApp (to yourself) and to Google Drive.
- [ ] On phone B, a fresh install: during onboarding or under Settings → Backup & restore, restore from that file.
- [ ] Every product, colour count, photo, sale, customer, follow-up and Recently deleted item matches phone A exactly. Spot-check 5 counts and one customer timeline.
- [ ] A sales report for the same period has the same totals on both phones.
- [ ] Restoring a backup made by an older app version runs migrations and works.
- [ ] Restoring a damaged or wrong file shows a clear error and leaves the current data untouched.
- [ ] Follow-up reminders are scheduled again on phone B.

### General
- [ ] Light and dark mode on every main screen.
- [ ] Airplane mode: everything except the actual WhatsApp send works.
- [ ] Storage almost full: saving a photo or PDF fails with a clear message, and no data is lost.
- [ ] Phone language set to Urdu: the layout mirrors (RTL) without overlaps, if Urdu is in this release.

## 5. Ship

- [ ] All items above pass on both phones.
- [ ] Tag the commit (`git tag v1.0.0`) and note the EAS build ID and `versionCode`.
- [ ] Send the APK link to sellers, with the reminder: **make a backup before updating, and never uninstall to update.**
