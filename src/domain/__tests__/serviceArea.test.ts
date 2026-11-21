import { inServiceArea } from "../serviceArea";

describe("inServiceArea", () => {
  it.each([
    [12.07, 124.59],
    [11.93, 124.48],
    [11.93, 124.90],
    [12.32, 124.48],
    [12.32, 124.90],
  ])("includes latitude %s and longitude %s", (latitude, longitude) => {
    expect(inServiceArea({ latitude, longitude })).toBe(true);
  });

  it.each([
    [11.9299, 124.59],
    [12.3201, 124.59],
    [12.07, 124.4799],
    [12.07, 124.9001],
    [NaN, 124.59],
    [12.07, Infinity],
  ])("excludes latitude %s and longitude %s", (latitude, longitude) => {
    expect(inServiceArea({ latitude, longitude })).toBe(false);
  });
});
