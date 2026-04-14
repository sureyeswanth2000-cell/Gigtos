import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Fetches the set of available service IDs (gigTypes) for a given location.
 * 
 * Logic:
 * 1. Queries all active workers in the user's city.
 * 2. Groups them to see if any match the user's specific area.
 * 3. Returns a map of serviceId -> availabilityLevel ('area', 'city', 'none').
 * 
 * @param {string} city - User's current city
 * @param {string} area - User's current area (optional)
 * @returns {Promise<Record<string, 'area' | 'city' | 'none'>>}
 */
export async function getServiceAvailability(city, area) {
  if (!city) return {};

  try {
    // Query all active workers in this city
    const q = query(
      collection(db, 'gig_workers'),
      where('status', '==', 'active'),
      where('locationCity', '==', city)
    );

    const querySnapshot = await getDocs(q);
    const availability = {};

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const gigTypes = data.gigTypes || [];
      const workerArea = (data.locationArea || data.area || '').toLowerCase().trim();
      const userArea = (area || '').toLowerCase().trim();

      gigTypes.forEach((type) => {
        // Current best availability for this type
        const current = availability[type];

        if (userArea && workerArea === userArea) {
          // Best possible: worker in the same area
          availability[type] = 'area';
        } else if (current !== 'area') {
          // Fallback: worker in the same city
          availability[type] = 'city';
        }
      });
    });

    return availability;
  } catch (error) {
    console.error('Error fetching service availability:', error);
    return {};
  }
}
