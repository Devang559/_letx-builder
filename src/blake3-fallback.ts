type HashOptions = { length?: number };

function hash(value: string | Uint8Array, options: HashOptions = {}) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let state = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    state ^= BigInt(byte);
    state = BigInt.asUintN(64, state * 0x100000001b3n);
  }
  const length = options.length ?? 32;
  const hex = state.toString(16).padStart(16, "0").repeat(Math.ceil(length / 8)).slice(0, length * 2);
  return {
    toString() {
      return hex;
    },
  };
}

export { hash };
