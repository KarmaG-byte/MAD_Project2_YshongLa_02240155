import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';

export type Role = 'customer' | 'shopkeeper';
export type Profile = {
  id: string; name: string; email: string; role: Role; shopName?: string;
};
export type Product = {
  id: string; name: string; description: string; materials: string; category: string;
  price: number; stock: number; sellerId: string; seller: string;
  dzongkhag: string; imageUrl: string; active: boolean; schemaVersion?: number;
};
export type Shop = {
  id: string; name: string; address: string; dzongkhag: string;
  phone: string; openTime: string; closeTime: string; closedDays: string;
  latitude?: number; longitude?: number;
};
export type Booking = {
  id: string; customerId: string; sellerId: string; productId: string;
  productName: string; customerName: string; sellerName: string;
  quantity: number; unitPrice: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'collected';
};

const asString = (v: unknown) => typeof v === 'string' ? v : '';
const numeric = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
export function normalizeProfile(uid: string, raw: DocumentData): Profile {
  const roleValue = asString(raw.role || raw.userType || raw.type).toLowerCase();
  const role: Role = roleValue === 'shopkeeper' || roleValue === 'seller' || raw.isShopkeeper === true ? 'shopkeeper' : 'customer';
  return { id: uid, name: asString(raw.name || raw.fullName || raw.displayName) || 'Member',
    email: asString(raw.email), role, shopName: asString(raw.shopName) };
}
export function normalizeProduct(id: string, raw: DocumentData): Product {
  return {
    id, name: asString(raw.name || raw.productName || raw.title) || 'Untitled product',
    description: asString(raw.description), materials: asString(raw.materials || raw.ingredients),
    category: asString(raw.category) || 'Handmade',
    price: numeric(raw.price ?? raw.unitPrice), stock: numeric(raw.stock ?? raw.quantity),
    sellerId: asString(raw.sellerId || raw.sellerUid || raw.ownerId),
    seller: asString(raw.seller || raw.sellerName || raw.shopName) || 'Local artisan',
    dzongkhag: asString(raw.dzongkhag || raw.location),
    imageUrl: asString(raw.imageUrl || raw.imageURL || raw.photoUrl),
    active: raw.active !== false, schemaVersion: numeric(raw.schemaVersion, 1),
  };
}
export function normalizeShop(id: string, raw: DocumentData): Shop {
  const lat = numeric(raw.latitude, NaN), lng = numeric(raw.longitude, NaN);
  return { id, name: asString(raw.name || raw.shopName) || 'Bhutanese craft shop',
    address: asString(raw.address), dzongkhag: asString(raw.dzongkhag),
    phone: asString(raw.phone), openTime: asString(raw.openTime) || '09:00',
    closeTime: asString(raw.closeTime) || '18:00', closedDays: asString(raw.closedDays),
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined };
}
export function normalizeBooking(id: string, raw: DocumentData): Booking {
  return { id, customerId: asString(raw.customerId), sellerId: asString(raw.sellerId),
    productId: asString(raw.productId), productName: asString(raw.productName) || asString(raw.product?.name),
    customerName: asString(raw.customerName), sellerName: asString(raw.sellerName),
    quantity: numeric(raw.quantity, 1), unitPrice: numeric(raw.unitPrice ?? raw.price),
    status: (raw.status === 'Collected' ? 'collected' : raw.status || 'pending') as Booking['status'] };
}
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}
export function isShopOpen(shop: Shop, now = new Date()): boolean {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (shop.closedDays.toLowerCase().split(',').map(s => s.trim()).includes(days[now.getDay()].toLowerCase())) return false;
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  return hhmm >= shop.openTime && hhmm < shop.closeTime;
}
export async function saveProduct(input: Omit<Product, 'id'>, currentId?: string) {
  if (!input.sellerId || !input.name.trim() || !Number.isFinite(input.price) || input.price <= 0
    || !Number.isInteger(input.stock) || input.stock < 0 || !input.materials.trim()) {
    throw new Error('Provide a product name, raw materials, positive price and valid stock.');
  }
  const data = { ...input, schemaVersion: 2, name: input.name.trim(), updatedAt: serverTimestamp() };
  if (currentId) {
    const target = doc(db, 'products', currentId);
    const snap = await getDoc(target);
    if (!snap.exists() || snap.data().sellerId !== input.sellerId) throw new Error('Only the original seller can edit this product.');
    if (snap.data().schemaVersion !== 2) throw new Error('This older TshongLa 1 listing is read-only in TshongLa 2.');
    await updateDoc(target, data);
    return currentId;
  }
  const created = await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
  return created.id;
}
export async function setProductActive(product: Product, sellerId: string, active: boolean) {
  if (product.sellerId !== sellerId) throw new Error('Only the owner can change this listing.');
  if (product.schemaVersion !== 2) throw new Error('Legacy TshongLa 1 listings must be managed in TshongLa 1.');
  // Soft delete protects existing reservations and enables the seller to restore a listing.
  await updateDoc(doc(db, 'products', product.id), { active, updatedAt: serverTimestamp() });
}
export async function reserveProduct(product: Product, customerId: string, customerName: string) {
  if (product.schemaVersion !== 2) throw new Error('Legacy TshongLa 1 listings cannot use TshongLa 2 reservations.');
  if (!product.sellerId) throw new Error('This older listing needs a seller ID before reservations can be enabled.');
  if (product.sellerId === customerId) throw new Error('You cannot reserve your own product.');
  const bookingRef = doc(collection(db, 'bookings'));
  const productRef = doc(db, 'products', product.id);
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(productRef);
    if (!snap.exists()) throw new Error('This listing is no longer available.');
    const data = snap.data();
    if (data.schemaVersion !== 2) throw new Error('This product uses TshongLa 1 reservations.');
    if (data.active === false || !Number.isInteger(data.stock) || data.stock < 1) {
      throw new Error('This product is unavailable or out of stock.');
    }
    if (data.sellerId !== product.sellerId) throw new Error('Seller information changed. Refresh the product.');
    transaction.update(productRef, { stock: data.stock - 1, lastBookingId: bookingRef.id, updatedAt: serverTimestamp() });
    transaction.set(bookingRef, {
      productId: product.id, productName: asString(data.name) || product.name,
      customerId, customerName, sellerId: data.sellerId, sellerName: product.seller,
      schemaVersion: 2, quantity: 1, unitPrice: numeric(data.price), status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
  return bookingRef.id;
}
export async function transitionBooking(booking: Booking, actorUid: string,
  next: 'confirmed' | 'rejected' | 'cancelled' | 'collected') {
  const bookingRef = doc(db, 'bookings', booking.id);
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(bookingRef);
    if (!snap.exists()) throw new Error('Reservation was not found.');
    const current = snap.data();
    if (current.schemaVersion !== 2) throw new Error('Manage older TshongLa 1 bookings in the original app.');
    const isCustomer = current.customerId === actorUid;
    const isSeller = current.sellerId === actorUid;
    const valid = (isCustomer && current.status === 'pending' && next === 'cancelled')
      || (isSeller && current.status === 'pending' && (next === 'confirmed' || next === 'rejected'))
      || (isSeller && current.status === 'confirmed' && next === 'collected');
    if (!valid) throw new Error('This reservation has changed or this action is not allowed.');
    const mustRestock = next === 'cancelled' || next === 'rejected';
    const productRef = doc(db, 'products', current.productId);
    const product = mustRestock ? await transaction.get(productRef) : null;
    if (mustRestock && (!product || !product.exists())) throw new Error('Linked product cannot be found.');
    if (mustRestock && product) transaction.update(productRef, {
      stock: numeric(product.data()?.stock) + 1, lastBookingId: booking.id, updatedAt: serverTimestamp(),
    });
    transaction.update(bookingRef, { status: next, updatedAt: serverTimestamp() });
  });
}
