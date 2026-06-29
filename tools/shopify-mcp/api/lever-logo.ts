/**
 * Serves the Lever logo PNG inline (base64-embedded so no filesystem reads).
 * Referenced from OAuth metadata `logo_uri` and from the consent page favicon.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LEVER_LOGO_PNG_B64 } from "../src/oauth/logo-data.js";

export const config = { runtime: "nodejs" };

const BYTES = Buffer.from(LEVER_LOGO_PNG_B64, "base64");

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.setHeader("content-type", "image/png");
  res.setHeader("cache-control", "public, max-age=86400, immutable");
  res.status(200).send(BYTES);
}
