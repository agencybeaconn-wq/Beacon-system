import { listShopsTool } from "./shopify/list-shops.js";
import { getShopInfoTool } from "./shopify/get-shop-info.js";
import { graphqlQueryTool } from "./shopify/graphql-query.js";
import { graphqlMutationTool } from "./shopify/graphql-mutation.js";
import { bulkQueryTool } from "./shopify/bulk-query.js";
import { cloneThemeTool } from "./shopify/clone-theme.js";
import { publishToChannelsTool } from "./shopify/publish-to-channels.js";
import { estimateCostTool } from "./shopify/estimate-cost.js";

import { listClientsTool } from "./lever/list-clients.js";
import { revenueTool } from "./lever/revenue.js";
import { shopInfoTool as leverShopInfoTool } from "./lever/shop-info.js";
import { recentOrdersTool } from "./lever/recent-orders.js";
import { metaCampaignsTool } from "./lever/meta-campaigns.js";
import { metaAnomaliesTool } from "./lever/meta-anomalies.js";
import { metaHistoryTool } from "./lever/meta-history.js";
import { brainContextTool } from "./lever/brain-context.js";

import { requestToolTool } from "./lever/request-tool.js";
import { myActivityTool } from "./lever/my-activity.js";
import { teamActivityTool } from "./lever/team-activity.js";

import { vaultSearchTool } from "./vault/search.js";
import { vaultReadNoteTool } from "./vault/read-note.js";
import { vaultLogEventTool } from "./vault/log-event.js";
import { vaultLogDecisionTool } from "./vault/log-decision.js";
import { vaultClientSnapshotTool } from "./vault/client-snapshot.js";

import { withAudit } from "./_shared/audit.js";
import type { Tool } from "./types.js";

const raw: Tool[] = [
  // Shopify multi-store
  listShopsTool, getShopInfoTool, graphqlQueryTool, graphqlMutationTool, bulkQueryTool, cloneThemeTool,
  publishToChannelsTool, estimateCostTool,
  // Lever client data (per-client visibility)
  listClientsTool, revenueTool, leverShopInfoTool, recentOrdersTool,
  // Lever Meta Ads
  metaCampaignsTool, metaAnomaliesTool, metaHistoryTool,
  // Brain context (call FIRST in any Lever session)
  brainContextTool,
  // Self-improvement + observability
  requestToolTool, myActivityTool, teamActivityTool,
  // Vault (Obsidian Lever QI via GitHub Contents API)
  vaultSearchTool, vaultReadNoteTool, vaultLogEventTool, vaultLogDecisionTool, vaultClientSnapshotTool,
];

export const tools: Tool[] = raw.map((t) => withAudit(t));
