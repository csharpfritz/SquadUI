/**
 * Date utilities for consistent local-timezone date handling.
 *
 * JavaScript's `new Date("YYYY-MM-DD")` parses date-only strings as UTC midnight,
 * which shifts them backward by one day in Western Hemisphere timezones when
 * converted to local dates. These helpers ensure date-only strings are always
 * treated as local midnight.
 */

/**
 * Parses a date string as local time.
 * - Date-only strings ("YYYY-MM-DD") → local midnight (not UTC midnight).
 * - ISO timestamps with time/timezone → standard `new Date()` parsing.
 */
export function parseDateAsLocal(dateStr: string): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(dateStr);
}

/** Formats a Date as YYYY-MM-DD using local timezone (not UTC). */
export function toLocalDateKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
