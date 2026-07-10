/**
 * SECURITY (finding #7): the per-booking access token is a bearer credential
 * that unlocks the booking's PII and payment. Carrying it in the URL leaks it
 * into browser history, the address bar, referrer headers, and any
 * URL-capturing telemetry (Sentry records request URLs).
 *
 * In-app navigation therefore passes the token through sessionStorage keyed by
 * booking id, never the query string. The one exception is an emailed resume
 * link, which has no choice but to carry the token in the URL — the /success
 * page consumes that, moves it into sessionStorage, and strips it from the URL
 * immediately (see readTokenFromUrlOrStore).
 *
 * sessionStorage (not localStorage) so the credential dies with the tab.
 */

const storageKey = (bookingId: string) => `oss:booking-token:${bookingId}`;

export const stashBookingToken = (bookingId: string, token: string): void => {
  try {
    sessionStorage.setItem(storageKey(bookingId), token);
  } catch {
    // Private mode / storage disabled — the flow degrades to re-entry, not a leak.
  }
};

export const getStashedBookingToken = (bookingId: string): string | null => {
  try {
    return sessionStorage.getItem(storageKey(bookingId));
  } catch {
    return null;
  }
};

/**
 * Resolve the access token for a booking on a page that may have been reached
 * either in-app (token in sessionStorage) or via an emailed link (token in the
 * URL). If the token is present in the URL, persist it to sessionStorage and
 * scrub it from the address bar / history so it stops leaking on subsequent
 * navigations and reloads.
 */
export const readTokenFromUrlOrStore = (
  bookingId: string,
  urlToken: string | null
): string | null => {
  if (urlToken) {
    stashBookingToken(bookingId, urlToken);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("token")) {
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      // Non-fatal: worst case the URL retains the token this once.
    }
    return urlToken;
  }
  return getStashedBookingToken(bookingId);
};
