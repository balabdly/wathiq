import { create } from "zustand";
import { getChartOfAccounts } from "@/lib/accounts";

export const useAccounts = create((set) => ({
  accounts: [],
  loading: false,

  fetchAccounts: async () => {
    set({ loading: true });
    const data = await getChartOfAccounts();
    set({ accounts: data, loading: false });
  },
}));
