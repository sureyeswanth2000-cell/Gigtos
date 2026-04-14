// Firestore ride request structure for bike, car, auto rides
// Collection: rideRequests
// Each document: {
//   userId: string,
//   driverType: 'bike' | 'car' | 'auto',
//   pickup: { lat: number, lng: number, address: string },
//   drop: { lat: number, lng: number, address: string },
//   status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled',
//   driverId?: string,
//   createdAt: Timestamp,
//   price: number,
//   ...
// }
//
// Collection: rideResponses
// Each document: {
//   rideRequestId: string,
//   driverId: string,
//   status: 'accepted' | 'rejected',
//   respondedAt: Timestamp
// }
