// MCP UI ownership module.
// UI-only grouping for scoped MCP page, card, modal, and import UI patches.
// Do not place MCP business logic in this file.
// Keep MCP action modules imported before this owner in ui-polish.js.
// Keep import order stable to preserve existing override behavior.

import './mcp-order-modal-ui.js?v=mcp-order-modal-1';
import './mcp-ui-shell.js?v=mcp-customer-manage-1';
import './mcp-card-compact-ui.js?v=mcp-card-compact-2';
import './mcp-import-ui.js?v=mcp-import-1';
