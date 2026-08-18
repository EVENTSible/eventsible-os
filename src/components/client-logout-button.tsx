"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function ClientLogoutButton() {
  const router = useRouter();

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    router.replace("/client/login");
    router.refresh();
  }

  return <button type="button" className="client-text-button" onClick={signOut}>Sign out</button>;
}
