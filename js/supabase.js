import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://urcrpzbxxomluvyxucvj.supabase.co";

const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyY3JwemJ4eG9tbHV2eXh1Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTExNzQsImV4cCI6MjA4NTc2NzE3NH0.jYx1DPD0iSXUTGPSJMQmW0NzNOYUIDOUzWzkcK9kedA";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);