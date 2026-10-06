import { clamp } from "./WorldMath.mjs";

export const normalizeAmmoInventory = (input) => {
  const value =
    input && typeof input === "object"
      ? input
      : {};

  const stock =
    value.stock &&
    typeof value.stock === "object"
      ? value.stock
      : {};

  const normalizedStock = {};

  for (
    const [ammoId, quantity]
    of Object.entries(stock)
  ) {
    const id =
      String(ammoId || "").trim();

    if (!id) continue;

    normalizedStock[id] =
      Math.max(
        0,
        Math.floor(Number(quantity) || 0)
      );
  }

  return {
    selectedAmmoId:
      String(value.selectedAmmoId || ""),
    stock: normalizedStock
  };
};

export const ammoDamageFactor = (ammo) =>
  clamp(
    Number(ammo?.damageFactor ?? 1) || 1,
    0.1,
    2
  );

export const cannonDamagePerShot = (cannon) =>
  Math.max(
    0.1,
    Number(cannon?.damagePerShot) || 1
  );

export const navalShotDamage = (cannon, ammo) =>
  Math.round(
    cannonDamagePerShot(cannon) *
    ammoDamageFactor(ammo) *
    100
  ) / 100;

export const resolvePlayerHullHp = (
  player,
  fallbackCombat = {}
) => {
  const combat =
    player?.combat &&
    typeof player.combat === "object"
      ? player.combat
      : {};

  const modifiers =
    player?.combatModifiers &&
    typeof player.combatModifiers === "object"
      ? player.combatModifiers
      : {};

  const base = clamp(
    Math.floor(
      Number(
        combat.hp ??
        fallbackCombat?.playerHp
      ) || 50
    ),
    50,
    500000000
  );

  const flat = clamp(
    Math.floor(
      Number(
        modifiers.maxHpFlat ??
        modifiers.hpFlat
      ) || 0
    ),
    -499999950,
    500000000
  );

  const pct = clamp(
    Number(
      modifiers.maxHpPct ??
      modifiers.hpPct
    ) || 0,
    -0.9,
    10
  );

  return clamp(
    Math.round(
      base * (1 + pct) + flat
    ),
    50,
    500000000
  );
};
