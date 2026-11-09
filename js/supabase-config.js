// Paste your two Supabase values between the quotes
const SUPABASE_URL = "https://uwbhneolwidjxpdgijqk.supabase.co";       // looks like https://abcdxyz.supabase.co
const SUPABASE_KEY = "sb_publishable_Bspa6lOHr314DMlNJ1lDaQ_1mO0dihK";

const db = SUPABASE_URL.startsWith("https://")
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;