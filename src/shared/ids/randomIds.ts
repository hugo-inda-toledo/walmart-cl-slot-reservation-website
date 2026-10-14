const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newIdempotencyKey(): string {
  return `wk-${randomHex(16)}`;
}

export function newOrderId(): string {
  return `web-${randomBase32(26)}`;
}

export function newCorrelationId(): string {
  return `web-${randomBase32(22)}`;
}

function randomHex(byteLength: number): string {
  return Array.from(randomBytes(byteLength), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function randomBase32(length: number): string {
  const bytes = randomBytes(Math.ceil((length * 5) / 8));
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5 && output.length < length) {
      bits -= 5;
      const character = BASE32_ALPHABET[(value >>> bits) & 31];

      if (character === undefined) {
        throw new Error("No se pudo generar un identificador aleatorio.");
      }

      output += character;
    }
  }

  return output;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}
