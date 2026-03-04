/**
 * Input validation schemas using Joi for all Cloud Function inputs.
 * Provides defence against injection attacks and malformed requests.
 */

const Joi = require('joi');

const MAX_QUOTE_PRICE = 1_000_000; // Maximum allowed quote price in INR

// Reusable field definitions
const bookingIdSchema = Joi.string().trim().max(128).required();
const adminIdSchema = Joi.string().trim().max(128).required();
const workerIdSchema = Joi.string().trim().max(128).required();
const phoneSchema = Joi.string().trim().pattern(/^\+?[1-9]\d{6,14}$/).required()
  .messages({ 'string.pattern.base': 'Phone number must be in E.164 format.' });

/**
 * Validates the input for submitQuote Cloud Function.
 * Fields: bookingId (string, required), price (positive number, required)
 */
const submitQuoteSchema = Joi.object({
  bookingId: bookingIdSchema,
  price: Joi.number().positive().max(MAX_QUOTE_PRICE).required(),
});

/**
 * Validates the input for acceptQuote Cloud Function.
 * Fields: bookingId (string, required), adminId (string, required)
 */
const acceptQuoteSchema = Joi.object({
  bookingId: bookingIdSchema,
  adminId: adminIdSchema,
});

// Allowed booking action values
const ALLOWED_BOOKING_ACTIONS = [
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

/**
 * Validates the input for updateBookingStatus Cloud Function.
 * Fields: bookingId (string, required), action (enum, required), extraArgs (object, optional)
 */
const updateBookingStatusSchema = Joi.object({
  bookingId: bookingIdSchema,
  action: Joi.string().valid(...ALLOWED_BOOKING_ACTIONS).required(),
  extraArgs: Joi.object({
    workerId: Joi.string().trim().max(128),
    workerName: Joi.string().trim().max(200),
    workerPhone: phoneSchema.optional(),
    rating: Joi.number().integer().min(1).max(5),
    decision: Joi.string().valid('user_fault', 'worker_fault', 'shared_fault'),
    superadminOverride: Joi.boolean(),
    callNotes: Joi.string().trim().max(2000),
    note: Joi.string().trim().max(2000),
    label: Joi.string().trim().max(200),
    url: Joi.string().uri().max(2048),
    reason: Joi.string().trim().max(1000),
  }).optional(),
});

/**
 * Validates the input for updateWorkerStatus Cloud Function.
 */
const updateWorkerStatusSchema = Joi.object({
  workerId: workerIdSchema,
  status: Joi.string().valid('available', 'unavailable', 'suspended').required(),
});

/**
 * Validates the input for createWorker Cloud Function.
 */
const createWorkerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  phone: phoneSchema,
  skills: Joi.array().items(Joi.string().trim().max(100)).min(1).max(20).required(),
  documents: Joi.array().items(
    Joi.object({
      type: Joi.string().trim().max(100).required(),
      url: Joi.string().uri().max(2048).required(),
    })
  ).max(10).optional(),
});

/**
 * Validates the input for secureLogActivity Cloud Function.
 */
const secureLogActivitySchema = Joi.object({
  bookingId: bookingIdSchema,
  action: Joi.string().trim().max(100).required(),
  extraArgs: Joi.object().pattern(Joi.string().max(100), Joi.any()).max(20).optional(),
});

/**
 * Validates and strips unknown fields from data using the given schema.
 * Throws a functions.https.HttpsError on validation failure.
 * @param {object} data - Input data to validate
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {Function} HttpsError - functions.https.HttpsError constructor
 * @returns {object} Validated and sanitized data
 */
function validate(data, schema, HttpsError) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const message = error.details.map(d => d.message).join('; ');
    throw new HttpsError('invalid-argument', `Validation failed: ${message}`);
  }

  return value;
}

module.exports = {
  submitQuoteSchema,
  acceptQuoteSchema,
  updateBookingStatusSchema,
  updateWorkerStatusSchema,
  createWorkerSchema,
  secureLogActivitySchema,
  validate,
};
