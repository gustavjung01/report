export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const aiConfigured = Boolean(
    process.env.AI_AGENT_URL
    || process.env.AI_AGENT_JSON
    || process.env.GOOGLE_AGENT_BUILDER_JSON
    || process.env.AI_AGENT_ID
    || process.env.OPENAI_AGENT_ID
    || process.env.OPENAI_ASSISTANT_ID
    || process.env.ASSISTANT_ID
    || process.env.GOOGLE_AGENT_ID
    || process.env.GOOGLE_AGENT_ENGINE_ID
    || process.env.OPENAI_API_KEY
  );
  res.status(200).json({
    supabaseUrl: process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseKey: process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || '',
    aiConfigured,
    aiAgentName: process.env.AI_AGENT_NAME || process.env.OPENAI_ASSISTANT_NAME || 'Bếp Sỉ Report Analyst'
  });
}
