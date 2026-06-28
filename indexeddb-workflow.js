import { openLocalDb } from './local-db.js';

window.addEventListener('load', () => {
  openLocalDb().catch((error) => console.warn('Local DB init failed', error));
});
