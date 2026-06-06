"use client";

import { useEffect } from "react";
import { useAccounts } from "@/hooks/useAccounts";

export default function AccountsTree() {
  const { accounts, fetchAccounts, loading } = useAccounts();

  useEffect(() => {
    fetchAccounts();
  }, []);

  if (loading) return <p>جاري التحميل...</p>;

  const buildTree = (parentId = null) =>
    accounts
      .filter((acc) => acc.parent_id === parentId)
      .map((acc) => ({
        ...acc,
        children: buildTree(acc.id),
      }));

  const tree = buildTree();

  const renderNode = (node) => (
    <div key={node.id} className="ml-4 border-l pl-4 py-1">
      <div className="font-semibold">{node.code} — {node.name}</div>
      {node.children?.map(renderNode)}
    </div>
  );

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">شجرة الحسابات</h2>
      {tree.map(renderNode)}
    </div>
  );
}
