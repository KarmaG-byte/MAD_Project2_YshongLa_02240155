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

### Shopkeeper
- Register/sign in and manage a public shop profile.
- Set shop name, address, Dzongkhag, phone, opening time, closing time and closed days.
- Save the device's current GPS position as the **fixed shop location**.
- Create and edit products, including materials, prices and stock.
- Add a **public HTTPS image URL**, or select a phone photo for optional Firebase Storage upload.
- **Remove** products by archiving them (active=false) and restore them later. Existing reservations remain intact.
- View orders, **confirm/reject pending reservations** and mark confirmed orders as **collected**. Rejection returns stock.

### Data and security
- Transaction routines in src/marketplace.ts handle coordinated stock changes.
- Role-sensitive Firestore rules in firestore.rules; upload rules in storage.rules.
- Compatibility adapter reads common field variations from Project I; records lacking sellerId cannot be reserved until migrated.
- Burgundy-and-cream interface in app/index.tsx.

## Getting started

1. Open the repository folder in VS Code.
2. Run **npm install**.
3. Verify firebase.ts uses the existing TshongLa Firebase Web App configuration. It currently targets project tshongla-77361.
4. Firebase Console → Authentication → Sign-in method → enable **Email/Password**.
5. Ensure Cloud Firestore exists.
6. **Back up and review your existing rules before deploying.** Firebase Console → Firestore Database → Rules → review and paste contents of firestore.rules → Publish. These rules target Project II and **may break older Project I access patterns**; reconcile them if Project I must keep working.
7. For selecting/uploading **phone photos**, Firebase Storage must be available. Review and deploy storage.rules in Firebase Console → Storage → Rules. Storage provisioning may require enabling the **Blaze billing plan**; do not enable billing without checking costs. Public **HTTPS image URLs** work without Storage.
8. Run **npx expo install --check**, then **npx expo start --clear**.
9. Open Expo Go and test separate customer/shopkeeper accounts.

## Firestore data structure

- users/{uid}: private account profile (uid, name, email, role).
- shops/{uid}: **public** business profile (name, address, dzongkhag, phone, hours, closedDays, latitude, longitude).
- products/{autoId}: name, description, materials, category, price, stock, sellerId, seller, dzongkhag, imageUrl, active, lastBookingId.
- bookings/{autoId}: productId, productName, customerId, sellerId, names, unitPrice, quantity=1, status, createdAt, updatedAt.

Reservation flow: pending → confirmed → collected, or pending → rejected/cancelled. Stock is decremented on reservation, and restored on rejection or cancellation in the **same Firestore transaction**. Only pending reservations can be cancelled by customers.

**Important:** Committing firestore.rules to GitHub does **not** deploy these rules to Firebase. If outdated rules remain active, writes can fail with permission-denied. Never set unrestricted security rules to work around this.

## Project I compatibility

The Project I GitHub main README describes demo products, and its data model differs from Project II. Reusing one Firebase project does not automatically migrate every product or user. Existing Email/Password Auth users may sign in, but must have a compatible users/{uid} profile. Products without a seller ID cannot be reserved safely until migrated. Shopkeepers can add their own public shops/{uid} profile and GPS marker.

## Testing before submission

After npm install, run **npm run typecheck** and **npx expo install --check**. Test with two separate accounts: register and sign in, save shop/hours/GPS, publish and edit product, archive and restore, reserve 1 unit, confirm, mark collected, cancel/reject another pending reservation, verify stock restoration, use maps and distance, test image URLs. Only test Storage uploads if Storage is enabled and rules deployed.

Inspect Firestore documents after each reservation action. Confirm rule permissions and actual device behavior before demonstrating.

## Current limitations

- No payment processing, shopping cart checkout, chat, ratings, identity verification, push notifications, shop moderation, or admin console.
- Google Maps may require platform-specific configuration in production builds; Expo Go behavior can differ across devices.
- Shop pins are fixed coordinates entered by the seller, not continuous location tracking.
- Open/closed indication uses **device-local time**, not a live business status service.
- Public product photos must be appropriate for public viewing.
- Firebase Security Rules must be reviewed against Project I before deployment.
- **Source implementation is committed, but real Firebase end-to-end and device testing are still required.**
