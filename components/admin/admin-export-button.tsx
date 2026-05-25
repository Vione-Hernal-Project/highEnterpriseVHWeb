"use client";

import { Download } from "lucide-react";

function getCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildTableCsv(table: HTMLTableElement) {
  const headerCells = [...table.querySelectorAll("thead th")].slice(1);
  const headers = headerCells.map((cell) => getCsvValue((cell.textContent || "").trim()));
  const rows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-admin-table-row="true"]')]
    .filter((row) => !row.hidden && row.style.display !== "none")
    .map((row) => [...row.querySelectorAll("td")].slice(1).map((cell) => getCsvValue((cell.textContent || "").replace(/\s+/g, " ").trim())));

  return [headers, ...rows].map((line) => line.join(",")).join("\n");
}

export function AdminExportButton() {
  const exportVisibleTable = () => {
    const table = document.querySelector<HTMLTableElement>(".vh-admin-page .vh-admin-table-card table");

    if (!table) {
      return;
    }

    const csv = buildTableCsv(table);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vione-hernal-admin-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button className="vh-admin-action-button" type="button" onClick={exportVisibleTable}>
      <Download size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>Export</span>
    </button>
  );
}
