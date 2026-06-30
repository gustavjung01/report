export function cleanStatus(value = '') {
  return String(value ?? '').trim().toLowerCase();
}

export function deletedAt(row = {}) {
  return row.deleted_at || row.raw_payload?.deleted_at || null;
}

export function cancelledAt(row = {}) {
  return row.cancelled_at || row.raw_payload?.cancelled_at || null;
}

export function isDeleted(row = {}) {
  return Boolean(cleanStatus(row.status) === 'deleted' || deletedAt(row) || row.raw_payload?.delete_reason);
}

export function isCancelled(row = {}) {
  return Boolean(cleanStatus(row.status) === 'cancelled' || cancelledAt(row));
}

export function isInactive(row = {}) {
  return row.active === false;
}

export function isActiveBusinessRow(row = {}, options = {}) {
  if (isDeleted(row)) return false;
  if (options.includeCancelled !== true && isCancelled(row)) return false;
  if (options.includeInactive !== true && isInactive(row)) return false;
  return true;
}

export function isActiveTestRow(row = {}) {
  return !isDeleted(row);
}

export function isActiveRouteCustomer(row = {}) {
  return !isDeleted(row) && !isInactive(row);
}

export function makeSoftDeleted(row = {}, reason = 'local_ui') {
  const now = new Date().toISOString();
  return {
    ...row,
    status: 'deleted',
    sync_status: 'local',
    updated_at: now,
    deleted_at: row.deleted_at || now,
    raw_payload: {
      ...(row.raw_payload || {}),
      deleted_at: row.raw_payload?.deleted_at || row.deleted_at || now,
      delete_reason: reason || row.raw_payload?.delete_reason || 'local_ui'
    }
  };
}

export function makeCancelled(row = {}, reason = 'local_ui') {
  const now = new Date().toISOString();
  return {
    ...row,
    status: 'cancelled',
    sync_status: 'local',
    updated_at: now,
    raw_payload: {
      ...(row.raw_payload || {}),
      cancelled_at: row.raw_payload?.cancelled_at || now,
      cancel_source: reason || row.raw_payload?.cancel_source || 'local_ui'
    }
  };
}

export function makeInactive(row = {}, reason = 'local_ui') {
  const now = new Date().toISOString();
  return {
    ...row,
    active: false,
    sync_status: 'local',
    updated_at: now,
    raw_payload: {
      ...(row.raw_payload || {}),
      inactive_at: row.raw_payload?.inactive_at || now,
      inactive_reason: reason || row.raw_payload?.inactive_reason || 'local_ui'
    }
  };
}
