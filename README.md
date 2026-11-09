# TshongLa 2.0 — React Native / Expo Marketplace

TshongLa 2 is the cross-platform continuation of the Bhutanese handmade marketplace. It uses **Expo SDK 54**, **Firebase Authentication**, **Cloud Firestore**, optional **Firebase Storage**, and native maps.

## Features implemented in source

### Customer
- Email/password registration, sign-in, password reset and sign-out.
- Searchable products with images, prices, raw materials, descriptions and stock.
- **Reserve 1 unit** with a Firestore transaction that decrements stock.
- See reservation status; cancel a **pending** reservation and return stock.
- View shop pins and opening schedules; filter nearby shops by 5, 20 or 100 km (straight-line distance), or view all.
- Open shop coordinates in an external maps app.
- **Public shopkeeper ratings and reviews:** after a reservation is marked collected, customers can submit 1–5 stars and a written comment (10–500 characters), then edit their review later. One review per customer per shop; reviews appear in shop listings, shopkeeper profiles and as average ratings beside products.

### Shopkeeper
- Register/sign in and manage a public shop profile.
- Set shop name, address, Dzongkhag, phone, opening time, closing time and closed days.
- Save the device's current GPS position as the **fixed shop location**.
- Create and edit products, including materials, prices and stock.
- Add a product photo by **taking a picture with the camera**, **choosing one from the gallery**, or pasting a public HTTPS image URL. Photos are resized automatically (800 px wide) and uploaded to Firebase Storage when it is available; otherwise the resized photo is saved inside the product document, so photos work on the free Spark plan too.
- **Remove** products by archiving them (active=false) and restore them later. Existing reservations remain intact.
- View orders, **confirm/reject pending reservations** and mark confirmed orders as **collected**. Rejection returns stock.

### Shopkeeper verification
- When registering as a shopkeeper, the person enters an **11-digit CID number** and takes or chooses a **photo of their CID card**. Existing shopkeeper accounts can submit the same details from the **My shop** tab.
- Until the administrator approves them, a shopkeeper can set up the shop profile but **cannot publish, edit or remove products**. The app and firestore.rules both enforce this.
- **Approving a shopkeeper (administrator, in the Firebase Console):** open Firestore Database → `users`, find the shopkeeper, check `cidNumber` and view the photo (copy the `cidImageUri` value into a browser address bar). Then create the collection `verifiedShopkeepers` (first time only) and add a document whose **Document ID is the shopkeeper's UID** with the field `approved` = `true` (boolean). The shop then shows a **Verified shop** badge to customers.
- To reject a submission, delete the `cidNumber` and `cidImageUri` fields from that user's document; the shopkeeper can then submit again.
- The ID photo is stored in the shopkeeper's own `users/{uid}` document, which only that user can read. Nobody can write `verifiedShopkeepers` from the app.
- You must **publish the updated firestore.rules** in Firebase Console → Firestore Database → Rules for this to take effect.

### Data and security
- Transaction routines in src/marketplace.ts handle coordinated stock changes.
- Role-sensitive Firestore rules in firestore.rules; upload rules in storage.rules.
- Rules in firestore.rules verify that every shop review comes from a customer whose reservation was marked collected, and prevent sellers from reviewing their own shops.
- Compatibility adapter reads common field variations from Project I; records lacking sellerId cannot be reserved until migrated.
- Burgundy-and-cream interface in app/index.tsx.

## TshongLa 1 compatibility and Firebase rules

The merged firestore.rules retains Project I verification and capitalized booking statuses. New Project II products and reservations use schemaVersion: 2 so they cannot modify original inventory. Existing Project I listings are visible but read-only in Project II. The merged rules are a proposal until you publish them in Firebase Console and test both apps; back up the current live rules first.

## Getting started

1. Open the repository folder in VS Code.
2. Run **npm install**.
3. Verify firebase.ts uses the existing TshongLa Firebase Web App configuration. It currently targets project tshongla-77361.
4. Firebase Console → Authentication → Sign-in method → enable **Email/Password**.
5. Ensure Cloud Firestore exists.
6. **Back up and review your existing rules before deploying.** Firebase Console → Firestore Database → Rules → review and paste contents of firestore.rules → Publish. These rules target Project II and **may break older Project I access patterns**; reconcile them if Project I must keep working.
7. **Firebase Storage is optional.** If Storage is enabled, deploy storage.rules (Firebase Console → Storage → Rules) and photos are uploaded there. If it is not available, the app stores the resized photo with the product automatically. Storage provisioning may require the **Blaze billing plan**; do not enable billing unless you understand the costs.
8. Run **npx expo install --check**, then **npx expo start --clear**.
9. Open Expo Go and test separate customer/shopkeeper accounts.

## Firestore data structure

- users/{uid}: private account profile (uid, name, email, role).
- shops/{uid}: **public** business profile (name, address, dzongkhag, phone, hours, closedDays, latitude, longitude).
- products/{autoId}: name, description, materials, category, price, stock, sellerId, seller, dzongkhag, imageUrl, active, lastBookingId.
- bookings/{autoId}: productId, productName, customerId, sellerId, names, unitPrice, quantity=1, status, createdAt, updatedAt.
- shopReviews/{shopId}_{customerUid}: shopId, customerId, customerName, bookingId, rating (1–5), comment, createdAt, updatedAt. All reviews are publicly readable. Writes require a collected reservation and the corresponding customer account.

Reservation flow: pending → confirmed → collected, or pending → rejected/cancelled. Stock is decremented on reservation, and restored on rejection or cancellation in the **same Firestore transaction**. Only pending reservations can be cancelled by customers. Once an order is marked collected, the customer can review that shop.

**Important:** Committing firestore.rules to GitHub does **not** deploy these rules to Firebase. If outdated rules remain active, writes can fail with permission-denied. Never set unrestricted security rules to work around this.

## Project I compatibility

The Project I GitHub main README describes demo products, and its data model differs from Project II. Reusing one Firebase project does not automatically migrate every product or user. Existing Email/Password Auth users may sign in, but must have a compatible users/{uid} profile. Products without a seller ID cannot be reserved safely until migrated. Shopkeepers can add their own public shops/{uid} profile and GPS marker.

## Testing before submission

After npm install, run **npm run typecheck** and **npx expo install --check**. Test with two separate accounts: register and sign in, save shop/hours/GPS, publish and edit product, archive and restore, reserve 1 unit, confirm, mark collected, cancel/reject another pending reservation, verify stock restoration, use maps and distance, test image URLs, submit a five-star review after collection, edit it, and confirm that both customer and shopkeeper accounts see the comment and correct average. Confirm an uncollected order cannot be reviewed and a second review for the same shop does not create a duplicate. Only test Storage uploads if Storage is enabled and rules deployed.

Inspect Firestore documents after each reservation action. Confirm rule permissions and actual device behavior before demonstrating.

## Current limitations

- No payment processing, shopping cart checkout, chat, product-specific ratings, automated identity checks (shopkeepers are approved manually by the administrator), push notifications, review moderation, or admin console. Shopkeeper reviews ARE implemented.
- Google Maps may require platform-specific configuration in production builds; Expo Go behavior can differ across devices.
- Shop pins are fixed coordinates entered by the seller, not continuous location tracking.
- Open/closed indication uses **Bhutan time (UTC+6)**, not the phone's time zone, and is computed from the saved schedule rather than a live business status service.
- Public product photos must be appropriate for public viewing.
- Firebase Security Rules must be reviewed against Project I before deployment.
- **Source implementation is committed, but real Firebase end-to-end and device testing are still required.**
