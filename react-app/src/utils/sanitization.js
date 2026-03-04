/**
 * GIGTOS SECURITY — CLIENT-SIDE INPUT SANITISATION
 *
 * Provides XSS prevention utilities for all user-supplied text
 * before it is rendered in the React UI or sent to the backend.
 *
 * DOMPurify is used for full HTML sanitisation in the browser.
 * For plain-text fields (names, addresses, notes) we additionally
 * strip HTML entirely so no markup is preserved.
 *
 * Usage:
 *   import { sanitizeHtml, sanitizePlainText, sanitizeFormData } from './utils/sanitization';
 */

import DOMPurify from 'dompurify';

/**
 * Sanitises a string that may contain safe HTML (e.g. rich-text chat messages).
 * Removes all unsafe tags/attributes while preserving allowed formatting.
 *
 * @param {string} input
 * @returns {string}
 */
export function sanitizeHtml(input) {
  if (typeof input !== 'string') return input;
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitises a plain-text field by stripping ALL HTML tags.
 * Use for names, addresses, phone numbers, IDs, etc.
 *
 * @param {string} input
 * @returns {string}
 */
export function sanitizePlainText(input) {
  if (typeof input !== 'string') return input;
  // Strip all tags, decode entities, then trim
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

/**
 * Recursively sanitises all string values in a form data object.
 * Non-string values (numbers, booleans, arrays, nested objects) are preserved.
 *
 * @param {object} formData
 * @returns {object} A new object with all string values sanitised.
 */
export function sanitizeFormData(formData) {
  if (typeof formData !== 'object' || formData === null) return formData;

  const sanitized = {};
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizePlainText(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizePlainText(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeFormData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
