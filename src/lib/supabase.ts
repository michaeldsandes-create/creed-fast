import { createClient } from '@supabase/supabase-js';

// Hardcoded values as requested to bypass .env issues
const supabaseUrl = 'https://uvlqxdlbggwzuawdxxhv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHF4ZGxiZ2d3enVhd2R4eGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzUyNzUsImV4cCI6MjA5MDcxMTI3NX0.RZQRDL4vjeY39m8wr_AGjg5bSWfslKZFQfbrWVckw1I';

console.log('Initializing Supabase with hardcoded URL');

// Initialize the Supabase client directly
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
