
// @ts-ignore
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

/**
 * Server-Side Shield
 * Provides metadata randomization and workspace-isolated encryption.
 */

const USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
];

export const Shield = {
    /**
     * Returns a random User-Agent from a curated list of modern browsers.
     * Prevents fingerprinting of the Edge Function runtime.
     */
    getRandomUserAgent: (): string => {
        const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
        return USER_AGENTS[randomIndex];
    },

    /**
     * Derives a workspace-specific encryption key.
     * key = HMAC(GlobalMasterKey, WorkspaceID)
     * This ensures that even if one key is compromised (unlikely), others are isolated.
     * Note: In this architecture, PostgreSQL `pgp_sym_encrypt` is used at the DB layer, 
     * but this helper is useful if we need application-layer encryption before sending to DB.
     */
    deriveWorkspaceKey: (masterKey: string, workspaceId: string): string => {
        if (!masterKey || !workspaceId) throw new Error("Missing inputs for key derivation");
        // @ts-ignore
        const hmac = createHmac("sha256", masterKey);
        hmac.update(workspaceId);
        return hmac.digest("hex");
    }
};
