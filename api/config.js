export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseKey: process.env.PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || '',
    aiConfigured: Boolean(process.env.AI_AGENT_URL || process.env.OPENAI_API_KEY),
    aiAgentName: process.env.AI_AGENT_NAME || 'Bếp Sỉ Report Analyst'
  });
}
