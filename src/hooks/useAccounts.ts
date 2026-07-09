import { create } from "zustand";
import { getChartOfAccounts } from "@/lib/accounts";
import { useStore } from "./useStore";

export const useAccounts = create((set) => ({
  accounts: [],
  loading: false,

  fetchAccounts: async () => {
    const tenantId = useStore.getState().tenant?.id;
    if (!tenantId) {
      set({ accounts: [], loading: false });
      return;
    }
    set({ loading: true });
    const data = await getChartOfAccounts(tenantId);
    set({ accounts: data, loading: false });
  },
}));
