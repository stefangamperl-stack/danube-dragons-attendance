const SUPABASE_URL = "https://qxrrhwkaesubexqmfhks.supabase.co";
const SUPABASE_KEY = "sb_publishable_qYO5Ox2yDKfJHqrlFg1iCg_cha-jVZ0";

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase Client geladen:", supabaseClient);
