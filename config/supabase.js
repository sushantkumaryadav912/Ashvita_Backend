const { createClient } = require('@supabase/supabase-js');

// These should be stored in environment variables in production
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'your-supabase-key';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;