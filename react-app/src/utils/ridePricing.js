// Simple pricing logic for rides (can be replaced with dynamic pricing)
export function calculateRidePrice({ driverType, distanceKm, durationMin }) {
  // Example base fares
  const baseFares = {
    bike: 20,
    auto: 30,
    car: 50,
  };
  // Example per km and per min rates
  const perKm = {
    bike: 7,
    auto: 10,
    car: 15,
  };
  const perMin = {
    bike: 1,
    auto: 1.5,
    car: 2,
  };
  const base = baseFares[driverType] || 20;
  const kmRate = perKm[driverType] || 7;
  const minRate = perMin[driverType] || 1;
  return Math.round(base + distanceKm * kmRate + durationMin * minRate);
}
