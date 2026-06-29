/**
 * PKCE S256 verification.
 *   code_challenge = BASE64URL(SHA256(code_verifier))
 * Claude.ai always uses S256.
 */
import { sha256Base64Url, constantTimeEq } from "./util.js";

export async function verifyPkceS256(verifier: string, challenge: string): Promise<boolean> {
  if (!verifier || !challenge) return false;
  const computed = await sha256Base64Url(verifier);
  return constantTimeEq(computed, challenge);
}
