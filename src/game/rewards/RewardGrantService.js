const addStack = (bucket, ref, amount) => {
  if (!Array.isArray(bucket)) return;

  const existing = bucket.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      item.ref === ref
  );

  if (existing) {
    existing.quantity =
      Math.max(0, Number(existing.quantity) || 0) +
      amount;
    return;
  }

  bucket.push({
    ref,
    quantity: amount
  });
};

export function grantReward(profile, grants = []) {
  if (!profile) {
    throw new Error('Player profile is required.');
  }

  const applied = [];

  for (const grant of grants) {
    const amount = Math.max(
      0,
      Math.floor(Number(grant.amount) || 0)
    );

    if (!amount) continue;

    if (grant.kind === 'currency') {
      if (!(grant.ref in profile.wallet)) continue;

      profile.wallet[grant.ref] =
        Math.max(
          0,
          Number(profile.wallet[grant.ref]) || 0
        ) + amount;

      applied.push({ ...grant, amount });
      continue;
    }

    if (grant.kind === 'inventory') {
      const bucket = profile.inventory?.[grant.bucket];

      if (!Array.isArray(bucket)) continue;

      addStack(bucket, grant.ref, amount);
      applied.push({ ...grant, amount });
    }
  }

  return applied;
}
