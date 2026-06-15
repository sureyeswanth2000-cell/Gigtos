import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '../firebase';
import { buildAreaId } from './backendContracts';

export const MVP_SERVICE_ID_BY_CATALOG_ID = {
  'home-helper': 'maid_hourly_basic_help',
  'kitchen-help': 'kitchen_help',
  'bedroom-cleaning': 'bedroom_cleaning',
  'bathroom-cleaning': 'bathroom_cleaning',
  'full-house-cleaning': 'full_house_basic_cleaning',
  'house-cleaning': 'full_house_basic_cleaning',
  'kitchen-cleaning': 'deep_kitchen_cleaning',
};

export function toMvpServiceId(service) {
  return MVP_SERVICE_ID_BY_CATALOG_ID[service?.id] || String(service?.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function slugifyAreaPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function inferCityAndArea({ address = '', profileCity = '', profileArea = '', fallbackCity = 'Bangalore' }) {
  const parts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const city = profileCity || parts[parts.length - 1] || fallbackCity;
  const area = profileArea || parts[0] || 'central';
  return {
    city,
    areaName: area,
    areaId: buildAreaId({ city, areaName: area }),
  };
}

export function isQuoteExpired(quote, now = new Date()) {
  if (!quote?.priceLockedUntil) return true;
  return new Date(quote.priceLockedUntil).getTime() <= new Date(now).getTime();
}

export async function requestMvpDemandQuote(payload) {
  const callable = httpsCallable(functionsInstance, 'getMvpDemandQuote');
  const result = await callable(payload);
  return result.data;
}

export async function startSmartQueueForBooking(payload) {
  const callable = httpsCallable(functionsInstance, 'startSmartQueueForBooking');
  const result = await callable(payload);
  return result.data;
}
