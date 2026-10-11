export type Role = 'Passenger' | 'Tricycle driver' | 'PUJ / PUV driver' | 'Administrator';
export type Status = 'Requested' | 'Accepted' | 'Arrived' | 'In progress' | 'Completed' | 'Cancelled';
export type Trip = { id: string; pickup: string; destination: string; fare: number; distance: number; status: Status; createdAt: string; driver?: string; declined?: boolean };
export type Route = { id: string; name: string; stops: string[]; fare: number; interval: number; active: boolean };
export type Terminal = { id: string; name: string; area: string; routeId: string; active: boolean };
export type Store = { name: string; trips: Trip[]; routes: Route[]; terminals: Terminal[]; baseFare: number; perKm: number; available: boolean; logs: string[] };
export const initialStore: Store = {
  name: 'Juan', trips: [], baseFare: 25, perKm: 8, available: true, logs: [],
  routes: [
    { id: 'R01', name: 'Town Center → Public Market', stops: ['Town Center', 'Municipal Hall', 'Public Market'], fare: 13, interval: 10, active: true },
    { id: 'R02', name: 'Town Center → University', stops: ['Town Center', 'Riverside', 'University'], fare: 15, interval: 15, active: true },
    { id: 'R03', name: 'Public Market → Hospital', stops: ['Public Market', 'Barangay Hall', 'Hospital'], fare: 13, interval: 12, active: true },
  ],
  terminals: [
    { id: 'T01', name: 'Central Jeepney Terminal', area: 'Town Center', routeId: 'R01', active: true },
    { id: 'T02', name: 'University Loading Station', area: 'University', routeId: 'R02', active: true },
    { id: 'T03', name: 'Market Transport Hub', area: 'Public Market', routeId: 'R03', active: true },
  ],
};
export const places = ['Town Center', 'Public Market', 'University', 'Municipal Hall', 'Riverside', 'Barangay Hall', 'Hospital'];
// Sample distances only. Replace with a routing provider before operational use.
export function estimate(pickup: string, destination: string, base: number, perKm: number) {
  if (!pickup.trim() || !destination.trim() || pickup.trim().toLowerCase() === destination.trim().toLowerCase()) throw new Error('Choose different pickup and destination locations.');
  const a = places.indexOf(pickup), b = places.indexOf(destination);
  const distance = a >= 0 && b >= 0 ? +(1.2 + Math.abs(a - b) * .7).toFixed(1) : 3;
  return { distance, fare: Math.round(base + Math.max(0, distance - 1) * perKm), minutes: Math.ceil(distance * 5) };
}
export const nextStatus: Partial<Record<Status, Status>> = { Requested: 'Accepted', Accepted: 'Arrived', Arrived: 'In progress', 'In progress': 'Completed' };
export function transition(trip: Trip, status: Status): Trip {
  if (status === 'Cancelled') {
    if (!['Requested', 'Accepted'].includes(trip.status)) throw new Error('This trip can no longer be cancelled.');
  } else if (nextStatus[trip.status] !== status) throw new Error('Invalid trip status transition.');
  return { ...trip, status, ...(status === 'Accepted' ? { driver: trip.declined ? 'Pedro Reyes' : 'Miguel Santos' } : {}) };
}
