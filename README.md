# TshongLa 2.0 — Project II (React Native + Expo)

This is an **early development scaffold**, not a completed or tested application. The original Kotlin/Jetpack Compose Project I remains untouched on the `main` branch. Project II code lives in the `project2-expo/` folder of the `project2-expo` branch.

## Current implementation
- Expo Router / TypeScript React Native starter.
- Firebase email/password registration and sign-in, with customer/shopkeeper role selection.
- Firestore listeners for product listings and booking records.
- Product raw-material/ingredient display and shopkeeper product creation form.
- Shop coordinates, foreground GPS permission and map pins (react-native-maps).
- Account sign-out.

## Important incomplete work
- **Reservations are intentionally disabled** until Project I's Firestore transaction and stock consistency are migrated and tested.
- Product edit/delete, ratings, CID and phone verification, image upload, notifications, QR pickup, chat, and advanced distance filtering are not implemented.
- Project I's Firestore security rules may **reject** new product writes and shop-location updates. Rules must be reviewed and updated securely before testing; never loosen them to allow unrestricted writes.
- Existing Project I product documents use numeric document IDs and a different field schema. The new UI can read compatible fields but a schema migration/adapter and testing are still needed.
- The map needs platform-specific validation; some builds require a Google Maps API key. No billing-free guarantee is implied.
- No production security review or Android/iOS build test has been completed.

## Local setup
1. Check out branch `project2-expo` and open its `project2-expo` folder.
2. Install Node.js LTS and run `npm install`.
3. In Firebase Console, register a **Web App** in your existing Firebase project to obtain the JavaScript SDK configuration. This is separate from Android's `google-services.json`.
4. Copy `.env.example` to `.env` and fill the `EXPO_PUBLIC_FIREBASE_...` values. These identify the Firebase project and are not admin credentials; **never put service-account private keys in the app**.
5. Enable Firebase Authentication email/password and ensure Cloud Firestore exists.
6. Run `npx expo start` and open in Expo Go if supported. If the map or another native module requires it, use an Expo development build.
7. Confirm and test Firestore Security Rules for role-based access before attempting writes.

## Four-week target
- Week 1: app setup, login, roles, Firestore schema review.
- Week 2: product CRUD, materials, booking transaction.
- Week 3: GPS map, distance filters, seller shop coordinates.
- Week 4: end-to-end testing, security rules, UI polish and documentation.

## Data model proposals
`users/{uid}`: role, name, shopName, address, latitude, longitude.

`products/{id}`: name, sellerId, price, stock, description, materials, dzongkhag.

`bookings/{id}`: customerId, sellerId, productId, status, quantity, pickupCode.

Use server-side Firestore rules to enforce ownership and booking transitions. GPS is foreground-only; shop location is a fixed coordinate, not continuous tracking.
