/** Client booking limits (BT Booking v5) */

/** Max number of future CONFIRMED bookings per client */
export const MAX_ACTIVE_BOOKINGS = 3;

/** Cannot cancel if slot starts sooner than this (hours, Europe/Riga wall clock approx) */
export const CANCEL_MIN_HOURS_BEFORE = 2;

/** Cannot create a new booking if another starts within this many hours */
export const MIN_GAP_HOURS = 1;
