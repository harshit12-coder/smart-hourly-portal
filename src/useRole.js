// useRole.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useRole() {
  const [role, setRole] = useState(null); // Start with null, not undefined

  useEffect(() => {
    async function getRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRole(null);
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
          console.error("Role fetch error:", error);
          setRole(null);
        } else {
          setRole(data?.role || null);
        }
      } catch (error) {
        console.error("useRole error:", error);
        setRole(null);
      }
    }

    getRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        getRole();
      } else if (event === 'SIGNED_OUT') {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return role;
}