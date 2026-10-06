export const STARTER_REGION = Object.freeze({
  id: 'starter-ocean',
  width: 12000,
  height: 12000,
  minX: -6000,
  maxX: 6000,
  minY: -6000,
  maxY: 6000
});

export function clampPointToRegion(x, y, region = STARTER_REGION, padding = 0) {
  const pad = Math.max(0, Number(padding) || 0);

  return {
    x: Math.max(
      region.minX + pad,
      Math.min(region.maxX - pad, Number(x) || 0)
    ),
    y: Math.max(
      region.minY + pad,
      Math.min(region.maxY - pad, Number(y) || 0)
    )
  };
}
