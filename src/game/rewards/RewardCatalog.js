const TABLES = Object.freeze({
  'treasure.halloween.gold.v1': Object.freeze([
    Object.freeze({
      weight: 100,
      grants: Object.freeze([
        Object.freeze({
          kind: 'currency',
          ref: 'gold',
          amount: Object.freeze({
            min: 1,
            max: 100
          })
        })
      ])
    })
  ])
});

const hash = (text) => {
  let value = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }

  return value >>> 0;
};

const seededUnit = (seed, salt = '') =>
  hash(`${seed}:${salt}`) / 4294967295;

const resolveAmount = (amount, seed, index) => {
  if (Number.isFinite(Number(amount))) {
    return Math.max(0, Number(amount));
  }

  const min = Math.max(
    0,
    Number(amount?.min) || 0
  );

  const max = Math.max(
    min,
    Number(amount?.max) || min
  );

  const unit = seededUnit(
    seed,
    `amount:${index}`
  );

  return Math.floor(
    min +
    unit *
      (max - min + 1)
  );
};

export function resolveReward(
  rewardRef,
  claimToken
) {
  const table = TABLES[rewardRef];

  if (!table?.length) {
    throw new Error(
      `Unknown reward ref: ${rewardRef}`
    );
  }

  const totalWeight =
    table.reduce(
      (sum, entry) =>
        sum +
        Math.max(
          0,
          Number(entry.weight) || 0
        ),
      0
    );

  let cursor =
    seededUnit(
      claimToken,
      'entry'
    ) *
    totalWeight;

  let selected =
    table[table.length - 1];

  for (const entry of table) {
    cursor -= Math.max(
      0,
      Number(entry.weight) || 0
    );

    if (cursor <= 0) {
      selected = entry;
      break;
    }
  }

  return selected.grants.map(
    (grant, index) => ({
      ...grant,
      amount: resolveAmount(
        grant.amount,
        claimToken,
        index
      )
    })
  );
}

export const RewardRefs = Object.freeze({
  HALLOWEEN_TREASURE:
    'treasure.halloween.gold.v1'
});
