// Pure helpers with no Firebase imports, so they can be tested anywhere.

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
// Bhutan Standard Time is UTC+6 all year (no daylight saving).
const BHUTAN_OFFSET_MINUTES = 6 * 60;

export type OpeningHours = { openTime: string; closeTime: string; closedDays: string };

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

/** "9:00" or "09:00" -> minutes since midnight, or null when invalid. */
export function parseClock(value: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!m) return null;
  const hours = Number(m[1]), minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Day of week (0 = Sunday) and minutes since midnight in Bhutan, whatever the phone's time zone. */
export function bhutanClock(now = new Date()): { day: number; minutes: number } {
  const shifted = new Date(now.getTime() + BHUTAN_OFFSET_MINUTES * 60000);
  return { day: shifted.getUTCDay(), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

export function isShopOpen(shop: OpeningHours, now = new Date()): boolean {
  const { day, minutes } = bhutanClock(now);
  const today = DAYS[day].slice(0, 3);
  const closedToday = shop.closedDays.toLowerCase().split(/[,;/]+|\s+and\s+/)
    .map(s => s.trim()).filter(s => s.length >= 3).some(s => s.slice(0, 3) === today);
  if (closedToday) return false;
  const open = parseClock(shop.openTime), close = parseClock(shop.closeTime);
  if (open === null || close === null) return false;
  return close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}
