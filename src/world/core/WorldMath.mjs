export const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

export const shortestAngleDelta = (from, to) =>
  (((Number(to) || 0) - (Number(from) || 0) + 540) % 360) - 180;

export const lerpAngle = (from, to, t) =>
  (Number(from) || 0) +
  shortestAngleDelta(from, to) *
    clamp(Number(t) || 0, 0, 1);

export const distance = (a, b) =>
  Math.hypot(
    (a?.x || 0) - (b?.x || 0),
    (a?.y || 0) - (b?.y || 0)
  );

export const hashString = (value) => {
  let hash = 2166136261;

  for (const ch of String(value || "")) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const createSeededRandom = (seed) => {
  let state =
    (Number(seed) >>> 0) ||
    0x9e3779b9;

  return () => {
    state += 0x6D2B79F5;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return (
      ((t ^ (t >>> 14)) >>> 0) /
      4294967296
    );
  };
};
