// MCP UI ownership module.
// UI-only grouping for scoped MCP page, card, modal, and import UI patches.
// Do not place MCP business logic in this file.
// Keep MCP action modules imported before this owner in ui-polish.js.
// Keep import order stable to preserve existing override behavior.

import './mcp-order-modal-ui.js?v=mcp-order-modal-1';
import './mcp-ui-shell.js?v=mcp-customer-manage-1';
import './mcp-card-compact-ui.js?v=mcp-card-compact-2';
import './mcp-page-scroll-ui.js?v=mcp-page-scroll-1';
import './mcp-import-ui.js?v=mcp-import-2';
import './mcp-route-admin-ui.js?v=mcp-route-admin-dedupe-1';
import './mcp-cancel-export-actions.js?v=mcp-cancel-export-1';
import './mcp-detail-toolbar-ui.js?v=mcp-detail-toolbar-stable-3';
import './mcp-toolbar-admin-slot-fix.js?v=mcp-admin-slot-dedupe-1';
import './mcp-data-actions-compact-ui.js?v=mcp-data-actions-compact-3';
