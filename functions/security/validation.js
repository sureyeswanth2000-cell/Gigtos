/**
 * GIGTOS SECURITY — INPUT VALIDATION & SANITISATION
 *
 * Centralised Joi schemas for every Cloud Function callable endpoint.
 * Call validate(schema, data) before processing any user-supplied input.
 *
 * Supported schemas:
 *   submitQuoteSchema      — bookingId, price
 *   acceptQuoteSchema      — bookingId, adminId
 *   updateBookingSchema    — bookingId, action, extraArgs
 *   createWorkerSchema     — name, phone, serviceType, skills
 *   otpRequestSchema       — phone
 *   otpVerifySchema        — phone, otp
 */

'use strict';

const Joi = require('joi');
const functions = require('firebase-functions');

// ── Common reusable primitives ───────────────────────────────────────────────

/** E.164 phone number (e.g. +911234567890) */
const phoneSchema = Joi.string()
  .pattern(/^\+?[1-9]\d{6,14}$/)
  .required()
  .messages({ 'string.pattern.base': 'Phone must be a valid E.164 number.' });

/** Firestore document ID (alphanumeric + hyphen/underscore, 1-128 chars) */
const docIdSchema = Joi.string()
  .pattern(/^[a-zA-Z0-9_-]+$/)
  .max(128)
  .required()
  .messages({ 'string.pattern.base': 'ID must contain only alphanumeric characters, hyphens, or underscores.' });

// ── Endpoint schemas ─────────────────────────────────────────────────────────

const submitQuoteSchema = Joi.object({
  bookingId: docIdSchema,
  price: Joi.number().positive().max(100000).required()
    .messages({ 'number.positive': 'Price must be a positive number.' }),
});

const acceptQuoteSchema = Joi.object({
  bookingId: docIdSchema,
  adminId: docIdSchema,
});

/** Allowed action identifiers for updateBookingStatus */
const ALLOWED_ACTIONS = [
  'user_cancelled',
  'admin_cancelled',
  'admin_assign_worker',
  'admin_start_work',
  'admin_mark_finished',
  'user_confirm_completion',
  'admin_reopen_booking',
  'user_rate',
  'admin_resolve_dispute',
  'admin_log_call',
  'admin_log_visit',
  'admin_add_note',
  'admin_upload_photo',
  'user_raise_dispute',
];

const updateBookingSchema = Joi.object({
  bookingId: docIdSchema,
  action: Joi.string().valid(...ALLOWED_ACTIONS).required()
    .messages({ 'any.only': 'action must be one of the allowed booking actions.' }),
  extraArgs: Joi.object().optional().unknown(true),
});

const createWorkerSchema = Joi.object({
  name: Joi.string().min(2).max(100).pattern(/^[\p{L}\s'-]+$/u).required()
    .messages({ 'string.pattern.base': 'Name must contain only letters, spaces, hyphens, or apostrophes.' }),
  phone: phoneSchema,
  serviceType: Joi.string().min(2).max(50).required(),
  skills: Joi.array().items(Joi.string().max(50)).min(1).max(20).required(),
});

const otpRequestSchema = Joi.object({
  phone: phoneSchema,
});

const otpVerifySchema = Joi.object({
  phone: phoneSchema,
  otp: Joi.string().length(6).pattern(/^\d+$/).required()
    .messages({ 'string.pattern.base': 'OTP must be a 6-digit number.' }),
});

// ── Validation helper ────────────────────────────────────────────────────────

/**
 * Validates `data` against the provided Joi `schema`.
 * Throws an HttpsError with code `invalid-argument` if validation fails.
 *
 * @param {Joi.ObjectSchema} schema
 * @param {object} data
 * @returns {object} The validated (coerced) value.
 */
function validate(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const message = error.details.map(d => d.message).join('; ');
    throw new functions.https.HttpsError('invalid-argument', message);
  }

  return value;
}

/**
 * Strips HTML tags and encodes common XSS characters from a string value.
 * Use on free-text fields before persisting to Firestore.
 *
 * @param {string} input
 * @returns {string}
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Recursively sanitizes all string values in an object.
 *
 * @param {object} obj
 * @returns {object}
 */
function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'object' ? sanitizeObject(v) : sanitizeString(v)])
  );
}

module.exports = {
  submitQuoteSchema,
  acceptQuoteSchema,
  updateBookingSchema,
  createWorkerSchema,
  otpRequestSchema,
  otpVerifySchema,
  validate,
  sanitizeString,
  sanitizeObject,
};
