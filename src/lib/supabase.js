
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jnhfqoljunnetxldqjxw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaGZxb2xqdW5uZXR4bGRxanh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NDMwMjAsImV4cCI6MjA3MjMxOTAyMH0.04wAwqT8-JXt1dR4rux24J60QFXGnON45hDuxgxBX-0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
