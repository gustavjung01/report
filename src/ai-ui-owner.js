// AI UI ownership module.
//
// ai-agent-settings.js currently contains both AI page UI and settings adapter code.
// Keep it behind this owner boundary until the UI/settings adapter can be split safely.
// Do not move this owner before supabase-sync.js without testing Admin sync and AI config.

import './ai-agent-real-load-guard.js?v=ai-agent-real-guard-1';
import './ai-agent-settings.js?v=ai-agent-real-load-2';
import './ai-report-agent-ui.js?v=gemini-report-agent-1';
import './ai-summary-ui.js?v=ai-summary-ui-1';
