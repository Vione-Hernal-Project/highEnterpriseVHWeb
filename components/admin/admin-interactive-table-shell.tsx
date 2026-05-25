"use client";

import type { MouseEvent, ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type Props = {
  tabs?: string[];
  activeTab?: string;
  searchPlaceholder?: string;
  filters?: string[];
  children: ReactNode;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tabMatchesRow(tab: string, row: HTMLTableRowElement) {
  const normalizedTab = normalize(tab).replace(/^all\s+.+$/, "all");
  const rowText = normalize(row.textContent || "");
  const rowStatus = normalize(row.dataset.adminStatus || "");

  if (!normalizedTab || normalizedTab === "all") {
    return true;
  }

  if (normalizedTab === "confirmed") {
    return rowStatus === "paid" || rowText.includes("paid") || rowText.includes("confirmed");
  }

  if (normalizedTab === "guest customers") {
    return rowStatus.includes("guest customers") || (!rowStatus.includes("subscribed") && !rowText.includes("internal profile") && !rowText.includes("subscribed"));
  }

  if (normalizedTab === "management") {
    return ["owner", "admin", "staff"].some((role) => rowStatus.includes(role) || rowText.includes(role));
  }

  return rowStatus.includes(normalizedTab) || rowText.includes(normalizedTab);
}

export function AdminInteractiveTableShell({
  tabs = ["All"],
  activeTab = tabs[0],
  searchPlaceholder = "Search...",
  filters = ["Filter"],
  children,
}: Props) {
  const shellRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState(activeTab);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [filteredCount, setFilteredCount] = useState(0);
  const [dataRowCount, setDataRowCount] = useState(0);
  const pageCount = Math.max(1, Math.ceil(filteredCount / rowsPerPage));
  const filterSummary = useMemo(() => filters.filter((filter) => filter !== "Filter").join(" / "), [filters]);

  const selectTab = useCallback((tab: string) => {
    setSelectedTab(tab);

    const params = new URLSearchParams(window.location.search);
    if (tab === tabs[0]) {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }

    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [tabs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    const normalizedRequestedTab = normalize(requestedTab || "");
    const matchingTab = tabs.find((tab) => {
      const normalizedTab = normalize(tab);
      return normalizedTab === normalizedRequestedTab || normalizedTab.replace(/^all\s+/, "") === normalizedRequestedTab;
    });

    setSelectedTab(matchingTab || activeTab);
  }, [activeTab, tabs]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, search, selectedTab]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const rows = [...shell.querySelectorAll<HTMLTableRowElement>('tbody tr[data-admin-table-row="true"]')];
    setDataRowCount(rows.length);
    const normalizedSearch = normalize(search);
    const matchingRows = rows.filter((row) => {
      const rowText = normalize(row.textContent || "");
      return tabMatchesRow(selectedTab, row) && (!normalizedSearch || rowText.includes(normalizedSearch));
    });
    const visibleRowIds = matchingRows.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((row) => row.dataset.adminRowId || "");

    rows.forEach((row) => {
      const rowId = row.dataset.adminRowId || "";
      row.hidden = !visibleRowIds.includes(rowId);
    });

    setFilteredCount(matchingRows.length);
    if (page > Math.max(1, Math.ceil(matchingRows.length / rowsPerPage))) {
      setPage(Math.max(1, Math.ceil(matchingRows.length / rowsPerPage)));
    }
  }, [page, rowsPerPage, search, selectedTab, children]);

  const navigateToHref = useCallback((href: string) => {
    if (href.startsWith("/") && !href.startsWith("//")) {
      startTransition(() => router.push(href));
      return;
    }

    window.location.assign(href);
  }, [router]);

  const handleRowClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, label")) {
      return;
    }

    const row = target.closest<HTMLTableRowElement>('tr[data-admin-row-href]');
    const href = row?.dataset.adminRowHref;

    if (href) {
      navigateToHref(href);
    }
  };

  const showingStart = filteredCount ? (page - 1) * rowsPerPage + 1 : 0;
  const showingEnd = Math.min(page * rowsPerPage, filteredCount);

  return (
    <section className="vh-admin-table-card" ref={shellRef}>
      <div className="vh-admin-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={cn("vh-admin-tab", tab === selectedTab && "vh-admin-tab--active")}
            type="button"
            role="tab"
            aria-selected={tab === selectedTab}
            onClick={() => selectTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="vh-admin-table-toolbar">
        <label className="vh-admin-search">
          <Search size={16} strokeWidth={1.8} aria-hidden="true" />
          <input type="search" placeholder={searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="vh-admin-table-toolbar__filters">
          {filterSummary ? <span className="vh-admin-filter-summary">{filterSummary}</span> : null}
          <button className="vh-admin-filter-button" type="button" onClick={() => setFilterOpen((isOpen) => !isOpen)} aria-expanded={filterOpen}>
            <Filter size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Filter</span>
            <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      {filterOpen ? (
        <div className="vh-admin-table-filter-panel">
          <label>
            <span>Status / Tab</span>
            <select value={selectedTab} onChange={(event) => selectTab(event.target.value)}>
              {tabs.map((tab) => (
                <option key={tab} value={tab}>
                  {tab}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} />
          </label>
          <button className="vh-admin-action-button" type="button" onClick={() => { selectTab(tabs[0]); setSearch(""); }}>
            Reset
          </button>
        </div>
      ) : null}

      <div className="vh-admin-table-scroll" onClick={handleRowClick}>
        {children}
        {dataRowCount > 0 && filteredCount === 0 ? (
          <div className="vh-admin-empty-state vh-admin-table-empty-state">
            <strong>No matching records.</strong>
            <p>Adjust the search or filter to view more records.</p>
          </div>
        ) : null}
      </div>

      <div className="vh-admin-pagination">
        <span>Showing {showingStart} to {showingEnd} of {filteredCount} records</span>
        <div>
          <button type="button" className="vh-admin-page-button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page">
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, page - 3), Math.max(5, page + 2)).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={cn("vh-admin-page-button", pageNumber === page && "vh-admin-page-button--active")}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button type="button" className="vh-admin-page-button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="Next page">
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
        <label className="vh-admin-rows-select">
          <span>Rows per page:</span>
          <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>
    </section>
  );
}
