/**
 * Web App Manifest — some clients/scrapers read this to pick up icons + names.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { runtime: "nodejs" };

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.setHeader("content-type", "application/manifest+json");
  res.setHeader("cache-control", "public, max-age=86400");
  res.status(200).json({
    name: "Lever Shopify MCP",
    short_name: "Lever Shopify",
    description: "Multi-shop Shopify Admin MCP for Lever Agency.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#dc2626",
    icons: [
      {
        src: "/lever-logo.png",
        type: "image/png",
        sizes: "1080x1080",
        purpose: "any maskable",
      },
    ],
  });
}
