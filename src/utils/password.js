export const DEFAULT_PBKDF2_ITERATIONS = 200000;

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const cleanHex = (hex || "").replace(/^0x/i, "");
  const bytes = new Uint8Array(cleanHex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(cleanHex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

export function hasLegacyPlainTextPassword(user) {
  return !!user && typeof user.password === "string" && typeof user.passwordHash !== "string";
}

export async function hashPassword(password, saltBytes = null, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  if (!password || !String(password).trim()) {
    throw new Error("Password is required.");
  }

  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || !cryptoApi.subtle) {
    throw new Error("Secure password hashing is not available in this browser environment.");
  }

  const salt = saltBytes
    ? (typeof saltBytes === "string" ? fromHex(saltBytes) : saltBytes)
    : cryptoApi.getRandomValues(new Uint8Array(16));

  const encoder = new TextEncoder();
  const passwordKey = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await cryptoApi.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    passwordKey,
    256
  );

  return {
    passwordHash: toHex(new Uint8Array(derivedBits)),
    passwordSalt: toHex(salt),
    passwordIterations: Number(iterations),
    passwordVersion: 1,
  };
}

export async function verifyPassword(password, user) {
  if (!user) return false;

  if (hasLegacyPlainTextPassword(user)) {
    return user.password === password;
  }

  if (!user.passwordHash || !user.passwordSalt) {
    return false;
  }

  const derived = await hashPassword(
    password,
    user.passwordSalt,
    Number(user.passwordIterations || DEFAULT_PBKDF2_ITERATIONS)
  );

  return derived.passwordHash === user.passwordHash;
}

export function stripPasswordField(user) {
  if (!user || typeof user !== "object") return user;
  const { password, ...rest } = user;
  return rest;
}

export async function applyPasswordHash(user, plainPassword) {
  if (!plainPassword || !String(plainPassword).trim()) {
    throw new Error("Password is required.");
  }

  const hashData = await hashPassword(plainPassword);
  return {
    ...user,
    ...hashData,
    password: undefined,
  };
}
