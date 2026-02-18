/**
 * Tests for dateUtils — parseDateAsLocal and toLocalDateKey.
 *
 * Key invariant: date-only strings ("YYYY-MM-DD") must be treated as local
 * midnight, not UTC midnight. Without this, dates shift backward by one day
 * in Western Hemisphere timezones.
 */
import * as assert from 'assert';
import { parseDateAsLocal, toLocalDateKey } from '../../utils/dateUtils';

suite('dateUtils', () => {
    suite('parseDateAsLocal', () => {
        test('date-only string roundtrips through toLocalDateKey unchanged', () => {
            const dateStr = '2026-02-18';
            const parsed = parseDateAsLocal(dateStr);
            assert.strictEqual(toLocalDateKey(parsed), dateStr);
        });

        test('date-only string produces local midnight', () => {
            const parsed = parseDateAsLocal('2026-06-15');
            assert.strictEqual(parsed.getHours(), 0);
            assert.strictEqual(parsed.getMinutes(), 0);
            assert.strictEqual(parsed.getDate(), 15);
            assert.strictEqual(parsed.getMonth(), 5); // June = 5
            assert.strictEqual(parsed.getFullYear(), 2026);
        });

        test('ISO timestamp with Z is parsed as UTC (standard behavior)', () => {
            const parsed = parseDateAsLocal('2026-02-18T00:30:00Z');
            // This is a full ISO timestamp — standard Date parsing applies
            assert.ok(!isNaN(parsed.getTime()));
        });

        test('ISO timestamp with timezone offset is parsed correctly', () => {
            const parsed = parseDateAsLocal('2026-02-18T00:30:00-05:00');
            assert.ok(!isNaN(parsed.getTime()));
        });

        test('various date-only strings all roundtrip correctly', () => {
            const dates = ['2026-01-01', '2026-12-31', '2026-02-28', '2024-02-29', '2000-06-15'];
            for (const dateStr of dates) {
                const parsed = parseDateAsLocal(dateStr);
                assert.strictEqual(toLocalDateKey(parsed), dateStr,
                    `Date ${dateStr} did not roundtrip through parseDateAsLocal → toLocalDateKey`);
            }
        });

        test('date-only string never shifts to previous day', () => {
            // The core bug: new Date("2026-02-18") is UTC midnight,
            // which in UTC-5 becomes Feb 17. parseDateAsLocal must prevent this.
            const parsed = parseDateAsLocal('2026-02-18');
            assert.strictEqual(parsed.getDate(), 18, 'Day must remain 18 regardless of timezone');
            assert.strictEqual(parsed.getMonth(), 1, 'Month must remain February (1)');
        });
    });

    suite('toLocalDateKey', () => {
        test('formats date as YYYY-MM-DD', () => {
            const d = new Date(2026, 1, 18); // Feb 18, 2026 local
            assert.strictEqual(toLocalDateKey(d), '2026-02-18');
        });

        test('pads single-digit months and days', () => {
            const d = new Date(2026, 0, 5); // Jan 5, 2026
            assert.strictEqual(toLocalDateKey(d), '2026-01-05');
        });

        test('handles December correctly', () => {
            const d = new Date(2026, 11, 31); // Dec 31, 2026
            assert.strictEqual(toLocalDateKey(d), '2026-12-31');
        });
    });
});
