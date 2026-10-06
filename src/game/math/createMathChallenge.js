const hash = (text) => {
  let value = 0;

  for (let i = 0; i < text.length; i += 1) {
    value = (
      Math.imul(value, 31) +
      text.charCodeAt(i)
    ) >>> 0;
  }

  return value;
};

const shuffleDeterministic = (values, seed) => {
  const result = [...values];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = hash(`${seed}:shuffle:${i}`) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

export function createMathChallenge(seed = '') {
  const value = hash(String(seed));

  // Evita contas irrelevantes como 1 × 1.
  const a = 2 + (value % 11);
  const b = 2 + ((value >>> 8) % 11);
  const answer = a * b;

  const candidates = new Set([answer]);
  const offsets = [
    -10, 10,
    -5, 5,
    -3, 3,
    -2, 2,
    -1, 1
  ];

  for (let index = 0; candidates.size < 4; index += 1) {
    const offset =
      offsets[
        hash(`${seed}:wrong:${index}`) %
        offsets.length
      ];

    const candidate =
      Math.max(1, answer + offset);

    if (candidate !== answer) {
      candidates.add(candidate);
    }
  }

  return {
    id: `mul:${a}x${b}`,
    text: `${a} × ${b}`,
    answer,
    options: shuffleDeterministic(
      [...candidates],
      String(seed)
    )
  };
}
