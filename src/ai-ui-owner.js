// AI UI ownership module.
//
// ai-agent-settings.js currently contains both AI page UI and settings adapter code.
// Keep it behind this owner boundary until the UI/settings adapter can be split safely.
// Do not move this owner before supabase-sync.js without testing Admin sync and AI config.

import './ai-agent-settings.js';
import './ai-summary-ui.js?v=ai-summary-ui-1';
