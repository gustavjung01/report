// Order UI ownership module.
//
// This file is UI-only. It groups the scoped Order page/card/modal UI patches
// without changing order business logic, IndexedDB stores, sync, schema, ids,
// or custom events.
//
// Keep import order stable:
// 1) compact create form
// 2) mobile width lock override
// 3) order list/card compact override

import './order-create-compact-ui.js?v=order-address-select-1';
import './order-modal-lock-ui.js?v=order-modal-lock-1';
import './order-card-compact-ui.js?v=order-card-compact-1';
