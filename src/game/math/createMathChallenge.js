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

export function createMathChallenge(seed = '') {
  const value = hash(String(seed));

  // Evita contas irrelevantes como 1 × 1.
  const a = 2 + (value % 11);
  const b = 2 + ((value >>> 8) % 11);

  return {
    id: `mul:${a}x${b}`,
    text: `${a} × ${b} = ?`,
    answer: a * b
  };
}
