import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { env } from "./env.js";
import { HttpError } from "./http.js";

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const secret = () => new TextEncoder().encode(env("SESSION_SECRET"));

/** Verifies an identity token from Sign in with Apple and returns Apple's stable user id (sub). */
export async function verifyAppleToken(identityToken: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: env("APPLE_BUNDLE_ID"),
    });
    if (!payload.sub) throw new Error("no sub");
    return payload.sub;
  } catch {
    throw new HttpError(401, "Invalid Apple identity token");
  }
}

export async function issueSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function requireUser(req: Request): Promise<string> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) throw new HttpError(401, "Not signed in");
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error();
    return payload.sub;
  } catch {
    throw new HttpError(401, "Session expired");
  }
}
