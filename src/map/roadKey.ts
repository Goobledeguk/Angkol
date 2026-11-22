/** Stable key for a sequence of [longitude, latitude] pairs. */
export const roadKey = (coords: number[][]) =>
  coords.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
