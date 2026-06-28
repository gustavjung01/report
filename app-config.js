const BEPI_SUPABASE_KEY = [
  'sb_publishable_n6LXv',
  '-fd-ImF3XzeU2mrjg',
  '_G7tBGy66'
].join('');

window.BEPI_CONFIG = Object.assign({}, window.BEPI_CONFIG || {}, {
  supabaseUrl: 'https://noiadkpkvdohljgopgfb.supabase.co',
  supabaseAnonKey: BEPI_SUPABASE_KEY,
  agentName: ' ',
  agentJson: ' '
});

window.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.src = 'sync-local-to-supabase.js?v=flow-v48';
  document.body.appendChild(script);
});
