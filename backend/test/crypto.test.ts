import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "../lib/crypto.js";

beforeAll(() => { process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64"); });

describe("token encryption", () => {
  it("round-trips and never stores plaintext", () => {
    const t = "access-sandbox-1234";
    const enc = encrypt(t);
    expect(enc).not.toContain(t);
    expect(decrypt(enc)).toBe(t);
  });
  it("rejects tampered ciphertext", () => {
    const parts = encrypt("secret").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});
