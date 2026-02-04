'use strict';

/**
 * Table Renderer Module for jade-dev-assist
 *
 * Provides shared utilities for rendering Unicode box-drawing tables
 * to the terminal. Used by presenter.js and milestone-tracker.js.
 *
 * Functions exported:
 * - BOX: Object containing Unicode box-drawing characters
 * - truncate(str, maxLen): Truncate string with ellipsis
 * - padRight(str, width): Left-align and pad to width
 * - padLeft(str, width): Right-align and pad to width
 * - horizontalRule(left, mid, right, columnWidths): Build horizontal rule
 * - dataRow(values, columnWidths, alignments): Build data row
 */

// ── Box-drawing characters ───────────────────────────────────────────

/**
 * Unicode box-drawing characters for table rendering.
 *
 * @constant {Object}
 * @property {string} topLeft - Top-left corner (┌)
 * @property {string} topRight - Top-right corner (┐)
 * @property {string} bottomLeft - Bottom-left corner (└)
 * @property {string} bottomRight - Bottom-right corner (┘)
 * @property {string} horizontal - Horizontal line (─)
 * @property {string} vertical - Vertical line (│)
 * @property {string} topTee - Top T-junction (┬)
 * @property {string} bottomTee - Bottom T-junction (┴)
 * @property {string} leftTee - Left T-junction (├)
 * @property {string} rightTee - Right T-junction (┤)
 * @property {string} cross - Cross junction (┼)
 */
const BOX = {
    topLeft:     '\u250c',  // ┌
    topRight:    '\u2510',  // ┐
    bottomLeft:  '\u2514',  // └
    bottomRight: '\u2518',  // ┘
    horizontal:  '\u2500',  // ─
    vertical:    '\u2502',  // │
    topTee:      '\u252c',  // ┬
    bottomTee:   '\u2534',  // ┴
    leftTee:     '\u251c',  // ├
    rightTee:    '\u2524',  // ┤
    cross:       '\u253c'   // ┼
};

const ELLIPSIS = '\u2026';

// ── String Formatting Utilities ──────────────────────────────────────

/**
 * Truncate a string to maxLen characters, appending an ellipsis if truncated.
 *
 * If the string is shorter than or equal to maxLen, returns it unchanged.
 * If longer, returns the first (maxLen - 1) characters plus an ellipsis.
 *
 * @param {string} str - The string to truncate
 * @param {number} maxLen - Maximum length (including ellipsis)
 * @returns {string} The truncated string
 *
 * @example
 * truncate('hello world', 8)   // => 'hello w…'
 * truncate('hello', 10)         // => 'hello'
 */
function truncate(str, maxLen) {
    if (str.length <= maxLen) {
        return str;
    }
    return str.slice(0, maxLen - 1) + ELLIPSIS;
}

/**
 * Pad or truncate a string to exactly `width` characters, left-aligned.
 *
 * If the string is longer than width, it will be truncated with an ellipsis.
 * If shorter, it will be padded with spaces on the right.
 *
 * @param {string} str - The string to format
 * @param {number} width - Target width in characters
 * @returns {string} The formatted string of exactly `width` characters
 *
 * @example
 * padRight('hello', 10)  // => 'hello     '
 * padRight('hello world', 8)  // => 'hello w…'
 */
function padRight(str, width) {
    const truncated = truncate(str, width);
    if (truncated.length >= width) {
        return truncated;
    }
    return truncated + ' '.repeat(width - truncated.length);
}

/**
 * Pad or truncate a string to exactly `width` characters, right-aligned.
 *
 * If the string is longer than width, it will be truncated with an ellipsis.
 * If shorter, it will be padded with spaces on the left.
 *
 * @param {string} str - The string to format
 * @param {number} width - Target width in characters
 * @returns {string} The formatted string of exactly `width` characters
 *
 * @example
 * padLeft('42', 5)  // => '   42'
 * padLeft('hello world', 8)  // => 'hello w…'
 */
function padLeft(str, width) {
    const truncated = truncate(str, width);
    if (truncated.length >= width) {
        return truncated;
    }
    return ' '.repeat(width - truncated.length) + truncated;
}

// ── Table Building Utilities ─────────────────────────────────────────

/**
 * Build a horizontal rule (top, middle, or bottom border) for a table.
 *
 * Creates a line of horizontal characters with appropriate corner/junction
 * characters at the left, between columns, and at the right.
 *
 * @param {string} left - Left edge character (topLeft, leftTee, or bottomLeft)
 * @param {string} mid - Column separator character (topTee, cross, or bottomTee)
 * @param {string} right - Right edge character (topRight, rightTee, or bottomRight)
 * @param {number[]} columnWidths - Array of column widths (total width including padding)
 * @returns {string} The formatted horizontal rule
 *
 * @example
 * horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, [10, 20, 15])
 * // => '┌──────────┬────────────────────┬───────────────┐'
 */
function horizontalRule(left, mid, right, columnWidths) {
    if (!Array.isArray(columnWidths) || columnWidths.length === 0) {
        throw new Error('columnWidths must be a non-empty array');
    }

    const segments = columnWidths.map(width => BOX.horizontal.repeat(width));
    return left + segments.join(mid) + right;
}

/**
 * Build a data row for a table.
 *
 * Formats each value according to its column width and alignment, then
 * assembles them into a row with vertical separators.
 *
 * @param {string[]} values - Array of values to display (one per column)
 * @param {number[]} columnWidths - Array of column widths (total width including padding)
 * @param {string[]} alignments - Array of alignments: 'left' or 'right' for each column
 * @returns {string} The formatted data row
 *
 * @example
 * dataRow(['Alice', '100', 'Active'], [10, 5, 10], ['left', 'right', 'left'])
 * // => '│ Alice     │   100 │ Active    │'
 */
function dataRow(values, columnWidths, alignments) {
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error('values must be a non-empty array');
    }
    if (!Array.isArray(columnWidths) || columnWidths.length !== values.length) {
        throw new Error('columnWidths must match values length');
    }
    if (!Array.isArray(alignments) || alignments.length !== values.length) {
        throw new Error('alignments must match values length');
    }

    const cells = values.map((value, i) => {
        const width = columnWidths[i];
        const alignment = alignments[i];
        const contentWidth = width - 2; // Reserve 2 chars for padding (1 space on each side)

        let formatted;
        if (alignment === 'right') {
            formatted = padLeft(String(value), contentWidth);
        } else {
            formatted = padRight(String(value), contentWidth);
        }

        return ' ' + formatted + ' ';
    });

    return BOX.vertical + cells.join(BOX.vertical) + BOX.vertical;
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
    BOX,
    truncate,
    padRight,
    padLeft,
    horizontalRule,
    dataRow
};
