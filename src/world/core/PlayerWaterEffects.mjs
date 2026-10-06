import { clamp } from "./WorldMath.mjs";

export const normalizePlayerWaterEffects = (player) => {
  const fx = player?.effects || {};

  return {
    wakeActive:
      fx.wakeActive !== false,
    wakeScale: clamp(
      Number(fx.wakeScale ?? 1),
      0.35,
      2.5
    ),
    wakeOpacity: clamp(
      Number(fx.wakeOpacity ?? 0.78),
      0,
      1
    ),
    wakeWidth: clamp(
      Number(fx.wakeWidth ?? 66),
      18,
      220
    ),
    wakeLength: clamp(
      Number(fx.wakeLength ?? 240),
      50,
      520
    ),
    wakeRate: clamp(
      Number(fx.wakeRate ?? 55),
      30,
      220
    ),
    wakeMinSpeed: clamp(
      Number(fx.wakeMinSpeed ?? 35),
      0,
      280
    ),
    shadowActive:
      fx.shadowActive !== false,
    shadowOpacity: clamp(
      Number(fx.shadowOpacity ?? 0.34),
      0,
      0.9
    ),
    shadowBlur: clamp(
      Number(fx.shadowBlur ?? 9),
      0,
      30
    ),
    shadowOffset: clamp(
      Number(fx.shadowOffset ?? 12),
      -40,
      80
    ),
    shadowScaleX: clamp(
      Number(fx.shadowScaleX ?? 0.72),
      0.25,
      1.5
    ),
    shadowScaleY: clamp(
      Number(fx.shadowScaleY ?? 0.28),
      0.12,
      1
    ),
    idleBalanceActive:
      fx.idleBalanceActive !== false,
    idleBalanceMaxSpeed: clamp(
      Number(
        fx.idleBalanceMaxSpeed ?? 8
      ),
      0,
      80
    ),
    idleRoll: clamp(
      Number(fx.idleRoll ?? 2.4),
      0,
      12
    ),
    idleHeave: clamp(
      Number(fx.idleHeave ?? 3.2),
      0,
      24
    ),
    idlePeriod: clamp(
      Number(fx.idlePeriod ?? 3600),
      800,
      8000
    )
  };
};
