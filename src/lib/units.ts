/**
 * Length/area formatting that applies the global calibration scale factor.
 * `raw` values are in model units; multiplying by scaleFactor yields real units.
 */

/** Meters per one unit of the given label. */
export const METERS_PER_UNIT: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
};

/**
 * Scale factor (raw → display unit) for a model whose raw coordinates are in
 * `modelUnit`, displayed in `displayUnit`.
 */
export function unitPresetScale(modelUnit: string, displayUnit: string): number {
  const a = METERS_PER_UNIT[modelUnit] ?? 1;
  const b = METERS_PER_UNIT[displayUnit] ?? 1;
  return a / b;
}

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
