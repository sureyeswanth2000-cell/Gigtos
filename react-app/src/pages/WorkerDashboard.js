/**
 * WorkerDashboard — re-export shim.
 * The real implementation lives at ./worker/WorkerDashboard.
 * App.js imports directly from there; this shim keeps any accidental
 * direct import from this path working correctly.
 */
export { default } from './worker/WorkerDashboard';
