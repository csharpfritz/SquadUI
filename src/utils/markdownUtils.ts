/**
 * Utility functions for handling markdown syntax in display text.
 */

/**
 * Strips markdown link syntax, returning only the display text.
 * Converts `[text](url)` to `text`. Non-link text passes through unchanged.
 */
export function stripMarkdownLinks(text: string): string {
    return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/**
 * Converts markdown link syntax to HTML anchor tags.
 * Converts `[text](url)` to `<a href="url" target="_blank">text</a>`.
 * Non-link text passes through unchanged.
 */
export function renderMarkdownLinks(text: string): string {
    return text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank">$1</a>'
    );
}
