"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Filter,
  Layers3,
  Package,
  Search,
  Star,
  Unlink,
  X,
} from "lucide-react";

import {
  AddButton,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  EmptyAdminState,
  ExportButton,
  MoreActionsButton,
} from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

export type AdminCollectionRow = {
  id: string;
  name: string;
  description: string;
  productCount: number;
  status: string;
  featured: boolean;
  featuredProductCount: number;
  categoryType: "catalog" | "edited";
  categoryTypeLabel: string;
  image: string;
  href: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type Props = {
  collections: AdminCollectionRow[];
  productCount: number;
  uncategorizedProductCount: number;
  initialTab?: "All Collections" | "Featured Collections";
  initialStatusFilter?: CollectionStatusFilter;
};

type SortOption = "newest" | "oldest" | "az" | "za" | "most-products" | "least-products";
type CollectionStatusFilter = "all" | "active" | "draft" | "archived" | "disabled";
type FeaturedFilter = "all" | "featured" | "not-featured";
type CollectionFilters = {
  status: CollectionStatusFilter;
  featured: FeaturedFilter;
  minProducts: string;
  maxProducts: string;
  categoryType: "all" | "catalog" | "edited";
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: CollectionFilters = {
  status: "all",
  featured: "all",
  minProducts: "",
  maxProducts: "",
  categoryType: "all",
  dateFrom: "",
  dateTo: "",
};

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "az", label: "A-Z" },
  { key: "za", label: "Z-A" },
  { key: "most-products", label: "Most Products" },
  { key: "least-products", label: "Least Products" },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeFilterValue(value: string | null | undefined) {
  return (value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getRowTimestamp(row: AdminCollectionRow) {
  return Date.parse(row.updatedAt || row.createdAt || "1970-01-01T00:00:00.000Z");
}

function parsePositiveNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : null;
}

function matchesDate(value: string | null, from: string, to: string) {
  if (!from && !to) {
    return true;
  }

  if (!value) {
    return false;
  }

  const rowDate = new Date(value);
  rowDate.setHours(0, 0, 0, 0);
  const fromDate = from ? new Date(`${from}T00:00:00`) : null;
  const toDate = to ? new Date(`${to}T00:00:00`) : null;

  if (fromDate && rowDate < fromDate) {
    return false;
  }

  if (toDate && rowDate > toDate) {
    return false;
  }

  return true;
}

function getStatusLabel(status: string) {
  const normalizedStatus = normalizeFilterValue(status);

  if (!normalizedStatus) {
    return "Draft";
  }

  return normalizedStatus
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getStatusTone(status: string): "active" | "draft" {
  return normalizeFilterValue(status) === "active" ? "active" : "draft";
}

function matchesCollectionFilters(collection: AdminCollectionRow, filters: CollectionFilters) {
  const minProducts = parsePositiveNumber(filters.minProducts);
  const maxProducts = parsePositiveNumber(filters.maxProducts);
  const collectionStatus = normalizeFilterValue(collection.status);
  const matchesStatus = filters.status === "all" || collectionStatus === filters.status;
  const matchesFeatured = filters.featured === "all"
    || (filters.featured === "featured" && collection.featured)
    || (filters.featured === "not-featured" && !collection.featured);
  const matchesMin = minProducts === null || collection.productCount >= minProducts;
  const matchesMax = maxProducts === null || collection.productCount <= maxProducts;
  const matchesType = filters.categoryType === "all" || collection.categoryType === filters.categoryType;
  const matchesDateRange = matchesDate(collection.updatedAt || collection.createdAt, filters.dateFrom, filters.dateTo);

  return matchesStatus && matchesFeatured && matchesMin && matchesMax && matchesType && matchesDateRange;
}

function sortRows(rows: AdminCollectionRow[], sortBy: SortOption) {
  const nextRows = [...rows];

  if (sortBy === "oldest") {
    return nextRows.sort((firstRow, secondRow) => getRowTimestamp(firstRow) - getRowTimestamp(secondRow));
  }

  if (sortBy === "az") {
    return nextRows.sort((firstRow, secondRow) => firstRow.name.localeCompare(secondRow.name));
  }

  if (sortBy === "za") {
    return nextRows.sort((firstRow, secondRow) => secondRow.name.localeCompare(firstRow.name));
  }

  if (sortBy === "most-products") {
    return nextRows.sort((firstRow, secondRow) => secondRow.productCount - firstRow.productCount || firstRow.name.localeCompare(secondRow.name));
  }

  if (sortBy === "least-products") {
    return nextRows.sort((firstRow, secondRow) => firstRow.productCount - secondRow.productCount || firstRow.name.localeCompare(secondRow.name));
  }

  return nextRows.sort((firstRow, secondRow) => getRowTimestamp(secondRow) - getRowTimestamp(firstRow) || firstRow.name.localeCompare(secondRow.name));
}

function countActiveFilters(filters: CollectionFilters) {
  return [
    filters.status !== "all",
    filters.featured !== "all",
    filters.minProducts.trim(),
    filters.maxProducts.trim(),
    filters.categoryType !== "all",
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;
}

export function AdminCollectionsView({ collections, productCount, uncategorizedProductCount, initialTab = "All Collections", initialStatusFilter = "all" }: Props) {
  const [selectedTab, setSelectedTab] = useState<"All Collections" | "Featured Collections">(initialTab);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<CollectionFilters>({ ...DEFAULT_FILTERS, status: initialStatusFilter });
  const [draftFilters, setDraftFilters] = useState<CollectionFilters>({ ...DEFAULT_FILTERS, status: initialStatusFilter });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const activeFilterCount = countActiveFilters(filters);
  const draftFilterCount = countActiveFilters(draftFilters);
  const activeCollectionCount = collections.filter((collection) => normalizeFilterValue(collection.status) === "active").length;

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalize(search);

    return sortRows(collections.filter((collection) => {
      const matchesTab = selectedTab === "Featured Collections" ? collection.featured : true;
      const matchesSearch = normalizedSearch
        ? normalize(`${collection.name} ${collection.description} ${collection.categoryTypeLabel}`).includes(normalizedSearch)
        : true;

      return matchesTab && matchesSearch && matchesCollectionFilters(collection, filters);
    }), sortBy);
  }, [collections, filters, search, selectedTab, sortBy]);

  const selectedVisibleIds = filteredRows.map((row) => row.id);
  const allVisibleSelected = selectedVisibleIds.length > 0 && selectedVisibleIds.every((id) => selectedIds.includes(id));
  const selectedCount = selectedIds.length;

  useEffect(() => {
    setSelectedIds((currentIds) => currentIds.filter((id) => collections.some((collection) => collection.id === id)));
  }, [collections]);

  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setFilters((currentFilters) => ({ ...currentFilters, status: initialStatusFilter }));
    setDraftFilters((currentFilters) => ({ ...currentFilters, status: initialStatusFilter }));
  }, [initialStatusFilter]);

  useEffect(() => {
    if (!filtersOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filtersOpen]);

  const toggleAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((currentIds) => currentIds.filter((id) => !selectedVisibleIds.includes(id)));
      return;
    }

    setSelectedIds((currentIds) => Array.from(new Set([...currentIds, ...selectedVisibleIds])));
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setFiltersOpen(true);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setSearch("");
    setSelectedTab("All Collections");
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setFiltersOpen(false);
  };

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Collections" subtitle="Organize your products into collections to make them easier to shop.">
        <ExportButton />
        <MoreActionsButton />
        <AddButton href="/admin/collections/new">Add Collection</AddButton>
      </AdminPageHeader>

      <section className="vh-admin-stats-grid vh-admin-stats-grid--four" aria-label="Collections metrics">
        <AdminStatCard href="/admin/collections" label="Total Collections" value={collections.length} delta="↑ product categories" icon={Layers3} active={selectedTab === "All Collections" && !activeFilterCount} />
        <AdminStatCard href="/admin/collections?status=active" label="Active Collections" value={activeCollectionCount} delta="↑ visible groupings" tone="green" icon={CheckCircle2} active={filters.status === "active"} />
        <AdminStatCard href="/admin/products" label="Products in Collections" value={productCount} delta="↑ assigned products" tone="purple" icon={Package} />
        <AdminStatCard href="/admin/products?category=uncategorized" label="Uncategorized Products" value={uncategorizedProductCount} delta="↓ clean catalog" tone="rose" icon={Unlink} />
      </section>

      <section className="vh-admin-table-card">
        <div className="vh-admin-tabs" role="tablist" aria-label="Collection views">
          {(["All Collections", "Featured Collections"] as const).map((tab) => (
            <button
              key={tab}
              className={cn("vh-admin-tab", selectedTab === tab && "vh-admin-tab--active")}
              type="button"
              role="tab"
              aria-selected={selectedTab === tab}
              onClick={() => {
                setSelectedTab(tab);
                const params = new URLSearchParams(window.location.search);
                if (tab === "All Collections") {
                  params.delete("tab");
                } else {
                  params.set("tab", tab);
                }
                const query = params.toString();
                window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="vh-admin-table-toolbar">
          <label className="vh-admin-search">
            <Search size={16} strokeWidth={1.8} aria-hidden="true" />
            <input type="search" placeholder="Search collections..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="vh-admin-table-toolbar__filters">
            {selectedCount ? (
              <span className="vh-admin-selection-summary">
                {selectedCount} selected
                <button type="button" onClick={() => setSelectedIds([])}>Clear</button>
              </span>
            ) : null}
            <label className="vh-admin-sort-control">
              <span>Sort by:</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
            </label>
            <button className="vh-admin-filter-button" type="button" onClick={openFilters} aria-expanded={filtersOpen}>
              <Filter size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>{activeFilterCount ? `Filter (${activeFilterCount})` : "Filter"}</span>
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="vh-admin-table-scroll">
          <table className="vh-admin-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all visible collections"
                    checked={allVisibleSelected}
                    disabled={!filteredRows.length}
                    onChange={(event) => toggleAllVisible(event.target.checked)}
                  />
                </th>
                <th>Collection</th>
                <th>Description</th>
                <th>Products</th>
                <th>Status</th>
                <th>Featured</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((collection) => (
                  <tr key={collection.id} data-admin-table-row="true" data-admin-row-id={collection.id} data-admin-status={`${normalizeFilterValue(collection.status)} ${collection.featured ? "featured" : "not featured"} ${collection.categoryType}`}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${collection.name}`}
                        checked={selectedIds.includes(collection.id)}
                        onChange={(event) => {
                          setSelectedIds((currentIds) => (
                            event.target.checked
                              ? [...currentIds, collection.id]
                              : currentIds.filter((id) => id !== collection.id)
                          ));
                        }}
                      />
                    </td>
                    <td>
                      <div className="vh-admin-product-cell">
                        <img loading="lazy" decoding="async" src={collection.image} alt="" />
                        <span>
                          <strong>{collection.name}</strong>
                          <small>{collection.categoryTypeLabel}</small>
                        </span>
                      </div>
                    </td>
                    <td>{collection.description}</td>
                    <td>{collection.productCount}</td>
                    <td><AdminStatusBadge tone={getStatusTone(collection.status)}>{getStatusLabel(collection.status)}</AdminStatusBadge></td>
                    <td>
                      <span
                        className={cn("vh-admin-featured-star", collection.featured && "vh-admin-featured-star--active")}
                        aria-label={collection.featured ? `${collection.featuredProductCount} featured product${collection.featuredProductCount === 1 ? "" : "s"}` : "No featured products"}
                        title={collection.featured ? `${collection.featuredProductCount} featured product${collection.featuredProductCount === 1 ? "" : "s"} in this collection` : "No published featured products in this collection"}
                      >
                        <Star size={16} strokeWidth={1.8} fill={collection.featured ? "currentColor" : "none"} aria-hidden="true" />
                      </span>
                    </td>
                    <td>
                      <Link className="vh-admin-icon-button" href={collection.href}>View</Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyAdminState
                      title={selectedTab === "Featured Collections" && !activeFilterCount && !search.trim() ? "No featured collections yet." : "No matching collections."}
                      copy={selectedTab === "Featured Collections" && !activeFilterCount && !search.trim() ? "Mark products as featured to surface their collections here." : "Adjust the search, sort, or filters to view more collections."}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {filtersOpen ? (
        <div className="vh-admin-filter-drawer-shell">
          <button className="vh-admin-filter-drawer-backdrop" type="button" aria-label="Close collection filters" onClick={() => setFiltersOpen(false)} />
          <aside className="vh-admin-filter-drawer" role="dialog" aria-modal="true" aria-labelledby="collection-filter-title">
            <header className="vh-admin-filter-drawer__header">
              <h2 id="collection-filter-title">Filter Collections</h2>
              <button className="vh-admin-filter-drawer__close" type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                <X size={18} strokeWidth={1.9} aria-hidden="true" />
              </button>
            </header>

            <div className="vh-admin-filter-drawer__body">
              <label className="vh-admin-filter-field">
                <span>Status</span>
                <span className="vh-admin-filter-select">
                  <select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value as CollectionFilters["status"] }))}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                    <option value="disabled">Disabled</option>
                  </select>
                  <ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
                </span>
              </label>

              <label className="vh-admin-filter-field">
                <span>Featured status</span>
                <span className="vh-admin-filter-select">
                  <select value={draftFilters.featured} onChange={(event) => setDraftFilters((current) => ({ ...current, featured: event.target.value as FeaturedFilter }))}>
                    <option value="all">All collections</option>
                    <option value="featured">Featured only</option>
                    <option value="not-featured">Not featured</option>
                  </select>
                  <ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
                </span>
              </label>

              <div className="vh-admin-filter-field">
                <span>Product count</span>
                <div className="vh-admin-filter-grid">
                  <input type="number" min="0" inputMode="numeric" placeholder="Min products" value={draftFilters.minProducts} onChange={(event) => setDraftFilters((current) => ({ ...current, minProducts: event.target.value }))} />
                  <input type="number" min="0" inputMode="numeric" placeholder="Max products" value={draftFilters.maxProducts} onChange={(event) => setDraftFilters((current) => ({ ...current, maxProducts: event.target.value }))} />
                </div>
              </div>

              <label className="vh-admin-filter-field">
                <span>Category type</span>
                <span className="vh-admin-filter-select">
                  <select value={draftFilters.categoryType} onChange={(event) => setDraftFilters((current) => ({ ...current, categoryType: event.target.value as CollectionFilters["categoryType"] }))}>
                    <option value="all">All types</option>
                    <option value="catalog">Catalog collection</option>
                    <option value="edited">Edited fashion category</option>
                  </select>
                  <ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
                </span>
              </label>

              <div className="vh-admin-filter-field">
                <span>Date created/updated</span>
                <div className="vh-admin-filter-grid">
                  <input type="date" value={draftFilters.dateFrom} onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))} aria-label="Date from" />
                  <input type="date" value={draftFilters.dateTo} onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))} aria-label="Date to" />
                </div>
              </div>
            </div>

            <footer className="vh-admin-filter-drawer__footer">
              <button className="vh-admin-filter-drawer__reset" type="button" onClick={resetFilters}>
                Reset Filters
              </button>
              <button className="vh-admin-filter-drawer__apply" type="button" onClick={applyFilters}>
                <Filter size={15} strokeWidth={1.9} aria-hidden="true" />
                <span>Apply Filters</span>
                {draftFilterCount ? <b>{draftFilterCount}</b> : null}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
