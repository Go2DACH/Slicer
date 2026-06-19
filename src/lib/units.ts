/**
 * Length/area formatting that applies the global calibration scale factor.
 * `raw` values are in model units; multiplying by scaleFactor yields real units.
 */

export function formatLength(raw: number, scaleFactor: number, unit: string): string {
  const real = raw * scaleFactor;
  const decimals = real < 1 ? 3 : real < 100 ? 2 : 1;
  return `${real.toFixed(decimals)} ${unit}`;
}

export function formatArea(rawArea: number, scaleFactor: number, unit: string): string {
  const real = rawArea * scaleFactor * scaleFactor;
  const decimals = real < 1 ? 3 : real < 100 ? 2 : 1;
  return `${real.toFixed(decimals)} ${unit}²`;
}

export function realLength(raw: number, scaleFactor: number): number {
  return raw * scaleFactor;
}
