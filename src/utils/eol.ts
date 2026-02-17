/**
 * Cross-platform line ending utilities.
 *
 * Use {@link normalizeEol} when reading text content to ensure all
 * downstream parsing uses a consistent `\n` separator.
 * Use {@link EOL} when writing text to produce OS-native line endings.
 */

import { EOL as osEol } from 'os';

/** OS-native line ending — use when **writing** files. */
export const EOL: string = osEol;

/**
 * Normalizes all line endings in a string to `\n`.
 * Handles Windows (`\r\n`), old Mac (`\r`), and Unix (`\n`).
 *
 * Call this at the boundary where text is first read (from disk, network, etc.)
 * so all downstream code can safely split on `\n`.
 */
export function normalizeEol(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
