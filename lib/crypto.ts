import crypto from "crypto";

/**
 * Validates and retrieves the 32-byte encryption key from ENCRYPTION_KEY env var (base64 encoded).
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not defined");
  }

  const keyBuffer = Buffer.from(envKey, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Found ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

export interface EncryptedData {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
}

/**
 * Encrypts plaintext string using AES-256-GCM with a fresh random 12-byte IV.
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertextBuffer = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertextBuffer.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypts AES-256-GCM encrypted payload back to UTF-8 plaintext.
 */
export function decrypt(data: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(data.iv, "base64");
  const tag = Buffer.from(data.tag, "base64");
  const ciphertext = Buffer.from(data.ciphertext, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Computes SHA-256 hex hash of a string (used for comparing one-time booking tokens).
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a secure random 32-byte token for one-time booking actions.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
