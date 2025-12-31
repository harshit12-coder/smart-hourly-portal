import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://nwescdacxabperaawnkv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZXNjZGFjeGFicGVyYWF3bmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Mzk2NDIsImV4cCI6MjA4MjUxNTY0Mn0.IJYGB4VkYOMnBUwIXs-tTN3jNG7HvweXyQkBIRVczj8"
);
