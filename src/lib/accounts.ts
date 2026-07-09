import { supabase } from "./supabase";

export async function getChartOfAccounts(tenantId: string) {
  const { data, error } = await supabase
    .from("finance_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error) throw error;
  return data;
}
