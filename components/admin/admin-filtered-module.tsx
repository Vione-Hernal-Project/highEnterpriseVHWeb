"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  ImageIcon,
  Mail,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  PauseCircle,
  PenLine,
  Search,
  Send,
  ShieldX,
  Star,
  Trash2,
  TrendingUp,
  type LucideIcon,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import {
  AddButton,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  ExportButton,
  MoreActionsButton,
} from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

export type AdminFilteredIconKey =
  | "alert"
  | "archive"
  | "check"
  | "clock"
  | "credit-card"
  | "eye"
  | "file"
  | "image"
  | "mail"
  | "megaphone"
  | "message"
  | "mouse"
  | "pause"
  | "pen"
  | "send"
  | "shield"
  | "star"
  | "trash"
  | "trending";

export type AdminFilteredCell =
  | { kind: "text"; text: string; subtext?: string; strong?: boolean }
  | { kind: "compound"; title: string; subtitle?: string; iconText?: string }
  | { kind: "review"; title: string; subtitle?: string }
  | { kind: "status"; text: string; tone?: "paid" | "processing" | "pending" | "cancelled" | "shipped" | "active" | "inactive" | "draft" }
  | { kind: "stars"; rating: number }
  | { kind: "link"; href: string; text: string; className?: string }
  | { kind: "anchor"; href: string; text: string; className?: string }
  | { kind: "muted"; text: string };

export type AdminFilteredRow = {
  id: string;
  status?: string;
  tabKeys?: string[];
  date?: string | null;
  href?: string;
  searchText?: string;
  sortText?: string;
  facets?: Record<string, string | string[] | null | undefined>;
  metrics?: Record<string, number | null | undefined>;
  cells: AdminFilteredCell[];
};

export type AdminFilteredStat = {
  key: string;
  label: string;
  delta?: string;
  tone?: "purple" | "green" | "blue" | "gold" | "rose" | "neutral";
  icon: AdminFilteredIconKey;
  activeTabs?: string[];
  valueKind: "count" | "sum" | "average" | "static";
  metricKey?: string;
  statusTabs?: string[];
  staticValue?: string | number;
  format?: "number" | "currency" | "rating" | "percent";
};

type FilterConfig = {
  key: string;
  label: string;
  allLabel: string;
};

type DateRangeKey = "today" | "last7" | "last30" | "month" | "all";
type SortKey = "newest" | "oldest" | "az" | "za";

type Props = {
  title: string;
  subtitle: string;
  addLabel?: string;
  addHref?: string;
  includeExport?: boolean;
  includeMoreActions?: boolean;
  stats: AdminFilteredStat[];
  tabs: string[];
  searchPlaceholder: string;
  filterConfigs?: FilterConfig[];
  columns: string[];
  rows: AdminFilteredRow[];
  emptyTitle: string;
  emptyCopy: string;
  alertMessage?: string;
  selectable?: boolean;
};

const iconMap: Record<AdminFilteredIconKey, LucideIcon> = {
  alert: AlertCircle,
  archive: Archive,
  check: CheckCircle2,
  clock: Clock3,
  "credit-card": CreditCard,
  eye: Eye,
  file: FileText,
  image: ImageIcon,
  mail: Mail,
  megaphone: Megaphone,
  message: MessageCircle,
  mouse: MousePointerClick,
  pause: PauseCircle,
  pen: PenLine,
  send: Send,
  shield: ShieldX,
  star: Star,
  trash: Trash2,
  trending: TrendingUp,
};

const dateRangeOptions: Array<{ value: DateRangeKey; label: string }> = [
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
];

const manilaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getManilaDateKey(value: Date) {
  return manilaDateFormatter.format(value);
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return getManilaDateKey(date);
}

function rowDateKey(row: AdminFilteredRow) {
  if (!row.date) {
    return "";
  }

  const parsed = new Date(row.date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return getManilaDateKey(parsed);
}

function matchesDateRange(row: AdminFilteredRow, range: DateRangeKey) {
  if (range === "all") {
    return true;
  }

  const key = rowDateKey(row);
  if (!key) {
    return false;
  }

  const today = getManilaDateKey(new Date());

  if (range === "today") {
    return key === today;
  }

  if (range === "last7") {
    return key >= shiftDateKey(today, -6) && key <= today;
  }

  if (range === "last30") {
    return key >= shiftDateKey(today, -29) && key <= today;
  }

  return key.slice(0, 7) === today.slice(0, 7);
}

function rowMatchesTab(row: AdminFilteredRow, tab: string, firstTab: string) {
  const normalizedTab = normalize(tab).replace(/^all\s+.+$/, "all");
  const normalizedFirstTab = normalize(firstTab).replace(/^all\s+.+$/, "all");

  if (!normalizedTab || normalizedTab === "all" || normalizedTab === normalizedFirstTab) {
    return true;
  }

  const rowTokens = [
    row.status,
    ...(row.tabKeys || []),
  ].map((value) => normalize(value || ""));

  return rowTokens.some((value) => value === normalizedTab || value.includes(normalizedTab) || normalizedTab.includes(value));
}

function getCellText(cell: AdminFilteredCell) {
  if (cell.kind === "compound") {
    return `${cell.title} ${cell.subtitle || ""}`;
  }

  if (cell.kind === "review") {
    return `${cell.title} ${cell.subtitle || ""}`;
  }

  if (cell.kind === "stars") {
    return `${cell.rating} stars`;
  }

  return "text" in cell ? cell.text : "";
}

function getRowSearchText(row: AdminFilteredRow) {
  return normalize([row.searchText, row.status, ...(row.tabKeys || []), ...row.cells.map(getCellText)].filter(Boolean).join(" "));
}

function getFacetValues(row: AdminFilteredRow, key: string) {
  const value = row.facets?.[key];
  if (Array.isArray(value)) {
    return value.map((item) => normalize(String(item)));
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [normalize(String(value))];
}

function getMetric(row: AdminFilteredRow, key: string | undefined) {
  if (!key) {
    return 0;
  }

  const value = row.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function statRows(rows: AdminFilteredRow[], stat: AdminFilteredStat) {
  if (!stat.statusTabs?.length) {
    return rows;
  }

  const tabs = stat.statusTabs.map(normalize);
  return rows.filter((row) => {
    const rowTabs = [row.status, ...(row.tabKeys || [])].map((value) => normalize(value || ""));
    return rowTabs.some((rowTab) => tabs.some((tab) => rowTab === tab || rowTab.includes(tab)));
  });
}

function formatStatValue(value: number, stat: AdminFilteredStat) {
  if (stat.format === "currency") {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (stat.format === "rating") {
    return `${value ? value.toFixed(1).replace(/\.0$/, "") : "0"} / 5`;
  }

  if (stat.format === "percent") {
    return `${value.toFixed(2).replace(/\.00$/, "")}%`;
  }

  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function renderCell(cell: AdminFilteredCell) {
  if (cell.kind === "compound") {
    return (
      <div className="vh-admin-product-cell">
        <span className="vh-admin-table-icon">{cell.iconText || "•"}</span>
        <span>
          <strong>{cell.title}</strong>
          {cell.subtitle ? <small>{cell.subtitle}</small> : null}
        </span>
      </div>
    );
  }

  if (cell.kind === "review") {
    return (
      <span className="vh-admin-review-table-cell">
        <strong>{cell.title}</strong>
        {cell.subtitle ? <small>{cell.subtitle}</small> : null}
      </span>
    );
  }

  if (cell.kind === "status") {
    return <AdminStatusBadge tone={cell.tone}>{cell.text}</AdminStatusBadge>;
  }

  if (cell.kind === "stars") {
    const rating = Math.max(0, Math.min(5, Math.round(cell.rating)));
    return (
      <span className="vh-admin-review-stars" aria-label={`${rating} out of 5 stars`}>
        {"★".repeat(rating)}{"☆".repeat(5 - rating)}
      </span>
    );
  }

  if (cell.kind === "link") {
    return (
      <Link className={cell.className || "vh-admin-icon-button"} href={cell.href}>
        {cell.text}
      </Link>
    );
  }

  if (cell.kind === "anchor") {
    return (
      <a className={cell.className || "vh-admin-icon-button"} href={cell.href}>
        {cell.text}
      </a>
    );
  }

  if (cell.kind === "muted") {
    return <span className="vh-admin-link-muted">{cell.text}</span>;
  }

  if (cell.strong || cell.subtext) {
    return (
      <>
        <strong>{cell.text}</strong>
        {cell.subtext ? <span>{cell.subtext}</span> : null}
      </>
    );
  }

  return cell.text;
}

export function AdminFilteredModule({
  title,
  subtitle,
  addLabel,
  addHref,
  includeExport = true,
  includeMoreActions = true,
  stats,
  tabs,
  searchPlaceholder,
  filterConfigs = [],
  columns,
  rows,
  emptyTitle,
  emptyCopy,
  alertMessage,
  selectable = true,
}: Props) {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState(tabs[0]);
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [facetSelections, setFacetSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(filterConfigs.map((filter) => [filter.key, "all"])),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = normalize(params.get("tab") || "");
    const requestedRange = params.get("range") as DateRangeKey | null;
    const matchingTab = tabs.find((tab) => normalize(tab) === requestedTab || normalize(tab).replace(/^all\s+/, "") === requestedTab);

    setSelectedTab(matchingTab || tabs[0]);
    if (requestedRange && dateRangeOptions.some((option) => option.value === requestedRange)) {
      setDateRange(requestedRange);
    }
  }, [tabs]);

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

  const selectDateRange = useCallback((range: DateRangeKey) => {
    setDateRange(range);
    const params = new URLSearchParams(window.location.search);
    if (range === "all") {
      params.delete("range");
    } else {
      params.set("range", range);
    }
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  const facetOptions = useMemo(() => {
    return Object.fromEntries(filterConfigs.map((filter) => {
      const options = Array.from(new Set(rows.flatMap((row) => {
        const value = row.facets?.[filter.key];
        if (Array.isArray(value)) {
          return value.filter(Boolean).map(String);
        }
        return value ? [String(value)] : [];
      }))).sort((first, second) => first.localeCompare(second));

      return [filter.key, options];
    }));
  }, [filterConfigs, rows]);

  const dateRows = useMemo(() => rows.filter((row) => matchesDateRange(row, dateRange)), [dateRange, rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalize(search);
    const selectedFacets = Object.entries(facetSelections).filter(([, value]) => value !== "all");

    return dateRows
      .filter((row) => rowMatchesTab(row, selectedTab, tabs[0]))
      .filter((row) => !normalizedSearch || getRowSearchText(row).includes(normalizedSearch))
      .filter((row) => selectedFacets.every(([key, value]) => getFacetValues(row, key).includes(normalize(value))))
      .sort((first, second) => {
        if (sort === "az" || sort === "za") {
          const comparison = (first.sortText || getRowSearchText(first)).localeCompare(second.sortText || getRowSearchText(second));
          return sort === "az" ? comparison : -comparison;
        }

        const firstDate = rowDateKey(first);
        const secondDate = rowDateKey(second);
        const comparison = firstDate.localeCompare(secondDate);
        return sort === "newest" ? -comparison : comparison;
      });
  }, [dateRows, facetSelections, search, selectedTab, sort, tabs]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, facetSelections, rowsPerPage, search, selectedTab, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const pageRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const showingStart = filteredRows.length ? (page - 1) * rowsPerPage + 1 : 0;
  const showingEnd = Math.min(page * rowsPerPage, filteredRows.length);
  const activeFilterCount = Object.values(facetSelections).filter((value) => value !== "all").length + (sort !== "newest" ? 1 : 0);
  const filterSummary = [
    ...filterConfigs.map((filter) => facetSelections[filter.key] === "all" ? filter.allLabel : facetSelections[filter.key]),
    `Sort by: ${sortOptions.find((option) => option.value === sort)?.label || "Newest"}`,
  ].join(" / ");

  const computedStats = useMemo(() => {
    return stats.map((stat) => {
      if (stat.valueKind === "static") {
        return { ...stat, displayValue: stat.staticValue ?? "—" };
      }

      const rowsForStat = statRows(dateRows, stat);
      if (stat.valueKind === "count") {
        return { ...stat, displayValue: formatStatValue(rowsForStat.length, stat) };
      }

      if (stat.valueKind === "average") {
        const values = rowsForStat.map((row) => getMetric(row, stat.metricKey)).filter((value) => value > 0);
        const average = values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
        return { ...stat, displayValue: formatStatValue(average, stat) };
      }

      const sum = rowsForStat.reduce((total, row) => total + getMetric(row, stat.metricKey), 0);
      return { ...stat, displayValue: formatStatValue(sum, stat) };
    });
  }, [dateRows, stats]);

  const resetFilters = () => {
    setSearch("");
    setSort("newest");
    setFacetSelections(Object.fromEntries(filterConfigs.map((filter) => [filter.key, "all"])));
  };

  const handleRowClick = useCallback((row: AdminFilteredRow) => {
    const href = row.href;

    if (href) {
      if (href.startsWith("/") && !href.startsWith("//")) {
        startTransition(() => router.push(href));
        return;
      }

      window.location.assign(href);
    }
  }, [router]);

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title={title} subtitle={subtitle}>
        {includeExport ? <ExportButton /> : null}
        {includeMoreActions ? <MoreActionsButton /> : null}
        {addLabel ? <AddButton href={addHref}>{addLabel}</AddButton> : null}
      </AdminPageHeader>

      {alertMessage ? <div className="vh-admin-alert"><p>{alertMessage}</p></div> : null}

      <section className={cn("vh-admin-stats-grid", stats.length === 4 && "vh-admin-stats-grid--four")}>
        {computedStats.map((stat) => (
          <AdminStatCard
            key={stat.key}
            label={stat.label}
            value={stat.displayValue}
            delta={stat.delta}
            tone={stat.tone}
            icon={iconMap[stat.icon]}
            active={Boolean(stat.activeTabs?.some((tab) => normalize(tab) === normalize(selectedTab)))}
          />
        ))}
      </section>

      <section className="vh-admin-table-card">
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
            <label className="vh-admin-date-range-select">
              <CalendarDays size={15} strokeWidth={1.8} aria-hidden="true" />
              <select value={dateRange} onChange={(event) => selectDateRange(event.target.value as DateRangeKey)}>
                {dateRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {filterSummary ? <span className="vh-admin-filter-summary">{filterSummary}</span> : null}
            <button className="vh-admin-filter-button" type="button" onClick={() => setFilterOpen((isOpen) => !isOpen)} aria-expanded={filterOpen}>
              <Filter size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>

        {filterOpen ? (
          <div className="vh-admin-table-filter-panel vh-admin-table-filter-panel--expanded">
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
            {filterConfigs.map((filter) => (
              <label key={filter.key}>
                <span>{filter.label}</span>
                <select
                  value={facetSelections[filter.key] || "all"}
                  onChange={(event) => setFacetSelections((current) => ({ ...current, [filter.key]: event.target.value }))}
                >
                  <option value="all">{filter.allLabel}</option>
                  {(facetOptions[filter.key] || []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} />
            </label>
            <div className="vh-admin-table-filter-panel__actions">
              <button className="vh-admin-action-button" type="button" onClick={resetFilters}>
                Reset
              </button>
            </div>
          </div>
        ) : null}

        <div className="vh-admin-table-scroll">
          <table className="vh-admin-table">
            <thead>
              <tr>
                {selectable ? <th><input type="checkbox" aria-label={`Select all ${title.toLowerCase()} records`} /></th> : null}
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? pageRows.map((row) => (
                <tr
                  key={row.id}
                  data-admin-table-row="true"
                  data-admin-row-id={row.id}
                  data-admin-row-href={row.href}
                  data-admin-status={[row.status, ...(row.tabKeys || [])].filter(Boolean).join(" ")}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) {
                      return;
                    }
                    handleRowClick(row);
                  }}
                >
                  {selectable ? <td><input type="checkbox" aria-label={`Select ${row.id}`} /></td> : null}
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${index}`}>{renderCell(cell)}</td>
                  ))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0)}>
                    <div className="vh-admin-empty-state">
                      <strong>{rows.length ? "No matching records." : emptyTitle}</strong>
                      <p>{rows.length ? "Adjust the search, date range, or filters to view more records." : emptyCopy}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="vh-admin-pagination">
          <span>Showing {showingStart} to {showingEnd} of {filteredRows.length} records</span>
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
    </div>
  );
}
