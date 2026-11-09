// Turns raw Firebase errors into messages that say what to actually fix.
// Most "Firebase is not working" reports come from project setup, not app code.
export function friendlyError(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  const raw = e instanceof Error ? e.message : String(e);
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled. Firebase Console → Authentication → Sign-in method → enable Email/Password.';
    case 'auth/email-already-in-use':
      return 'That email is already registered. Log in instead, or use a different email.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Cannot reach Firebase. Check the phone’s internet connection.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'The Firebase API key in firebase.ts is invalid or restricted. Copy the web app config again from Firebase Console → Project settings.';
    case 'permission-denied':
      return 'Firestore rejected this action (permission-denied). Publish the latest firestore.rules in Firebase Console → Firestore Database → Rules, and make sure you are using the correct account role.';
    case 'failed-precondition':
      return 'Firestore is not ready (failed-precondition). Make sure a Cloud Firestore database exists in Firebase Console.';
    case 'not-found':
      return 'Firestore database not found. Create it in Firebase Console → Firestore Database → Create database.';
    case 'storage/unauthorized':
      return 'Storage rejected the upload. Publish storage.rules in Firebase Console → Storage → Rules.';
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
      return 'Firebase Storage is not set up for this project (it may need the Blaze plan).';
    case 'storage/retry-limit-exceeded':
      return 'The photo upload timed out. Check the connection and try again.';
    default:
      return raw;
  }
}
