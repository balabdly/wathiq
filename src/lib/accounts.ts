import { supabase } from "./supabase";

export async function getChartOfAccounts() {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .order("code", { ascending: true });

  if (error) throw error;
  return data;
}
