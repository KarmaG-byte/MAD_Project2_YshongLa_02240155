import { collection, doc, setDoc, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { db } from '../firebase';

export type ShopReview = {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  bookingId: string;
  rating: number;
  comment: string;
  createdAt?: { toMillis?: () => number } | null;
};

export function normalizeShopReview(id: string, raw: DocumentData): ShopReview {
  return {
    id,
    shopId: typeof raw.shopId === 'string' ? raw.shopId : '',
    customerId: typeof raw.customerId === 'string' ? raw.customerId : '',
    customerName: typeof raw.customerName === 'string' ? raw.customerName : 'Customer',
    bookingId: typeof raw.bookingId === 'string' ? raw.bookingId : '',
    rating: Number(raw.rating) || 0,
    comment: typeof raw.comment === 'string' ? raw.comment : '',
    createdAt: raw.createdAt || null,
  };
}

export function ratingSummary(reviews: ShopReview[], shopId: string) {
  const matching = reviews.filter(r => r.shopId === shopId && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
  const count = matching.length;
  const average = count ? matching.reduce((total, review) => total + review.rating, 0) / count : 0;
  return { count, average };
}

export function starText(rating: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

/**
 * One review per customer per shop. A collected reservation is mandatory.
 * The Firestore rules independently verify shop, customer and booking ownership.
 * Do not use this client-side check as a substitute for security rules.
 */
export async function saveShopReview(params: {
  shopId: string; customerId: string; customerName: string; bookingId: string;
  rating: number; comment: string; existingReview?: ShopReview;
}) {
  const { shopId, customerId, customerName, bookingId, rating, existingReview } = params;
  const comment = params.comment.trim();
  if (!shopId || !customerId || !bookingId) throw new Error('A completed reservation is required to review a shop.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5 stars.');
  if (comment.length < 10 || comment.length > 500) throw new Error('Please write a review of 10–500 characters.');
  if (shopId === customerId) throw new Error('You cannot review your own shop.');

  const reviewRef = doc(collection(db, 'shopReviews'), shopId + '_' + customerId);
  if (existingReview) {
    // Updating a review only changes the rating, comment and edit time.
    await setDoc(reviewRef, { rating, comment, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(reviewRef, {
      shopId, customerId, customerName, bookingId, rating, comment,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
}
