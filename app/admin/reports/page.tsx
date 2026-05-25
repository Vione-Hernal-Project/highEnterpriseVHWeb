import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BarChart3,
  Download,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { AdminReportControls } from "@/components/admin/admin-report-controls";
import {
  AdminAnalyticsDonutChart,
  AdminAnalyticsSalesChart,
} from "@/components/admin/admin-analytics-charts";
import { AdminPageHeader, EmptyAdminState } from "@/components/admin/admin-ui";
import {
  REPORT_RANGE_OPTIONS,
  REPORT_TABS,
  formatCurrencyShort,
  formatReportMetricDelta,
  loadAdminReportData,
  resolveReportRangeKey,
  resolveReportTabKey,
  type AdminReportData,
  type ReportTabKey,
} from "@/lib/admin/reports";
import { requireManagementUser } from "@/lib/auth";
import type { CatalogProduct } from "@/lib/catalog";
import { formatAmountWithUnit } from "@/lib/payments/options";

type Props = {
  searchParams?: Promise<{
    range?: string | string[];
    tab?: string | string[];
  }>;
};

type ReportMetricCardProps = {
  label: string;
  value: string | number;
  delta: string;
  href: string;
  icon: LucideIcon;
  tone?: "purple" | "green" | "blue" | "gold" | "rose";
  trend?: "positive" | "negative" | "muted";
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getProductStock(product: CatalogProduct) {
  return Object.values(product.sizeInventory).reduce((total, stock) => total + stock, 0);
}

function getProductInventoryStatus(product: CatalogProduct) {
  const stock = getProductStock(product);

  if (stock <= 0) {
    return "Out of Stock";
  }

  if (stock <= 2) {
    return "Low Stock";
  }

  return "In Stock";
}

function resolveTrend(current: number, previous: number, rangeKey: string) {
  if (rangeKey === "all" || previous <= 0) {
    return "muted" as const;
  }

  return current >= previous ? "positive" as const : "negative" as const;
}

function buildTabHref(tab: ReportTabKey, range: string) {
  return `/admin/reports?tab=${encodeURIComponent(tab)}&range=${encodeURIComponent(range)}`;
}

function buildExportHref(tab: ReportTabKey, range: string) {
  return `/api/admin/reports/export?tab=${encodeURIComponent(tab)}&range=${encodeURIComponent(range)}`;
}

function ReportMetricCard({ label, value, delta, href, icon: Icon, tone = "purple", trend = "muted" }: ReportMetricCardProps) {
  return (
    <Link href={href} className="vh-admin-analytics-metric-card-link">
      <article className={`vh-admin-analytics-metric-card vh-admin-analytics-metric-card--${tone}`}>
        <span className="vh-admin-analytics-metric-card__icon">
          <Icon size={23} strokeWidth={1.85} aria-hidden="true" />
        </span>
        <div>
          <span>{label}</span>
          <strong>{value}</strong>
          <p data-trend={trend}>{delta}</p>
        </div>
      </article>
    </Link>
  );
}

function DonutBreakdown({ report, type }: { report: AdminReportData; type: "category" | "status" | "channel" | "inventory" }) {
  const segments = type === "category"
    ? report.salesByCategory
    : type === "status"
      ? report.orderStatusSegments
      : type === "inventory"
        ? report.inventorySegments
        : report.salesByChannel;
  const title = type === "category"
    ? "Sales by Category"
    : type === "status"
      ? "Order Status Overview"
      : type === "inventory"
        ? "Inventory Overview"
        : "Sales by Channel";
  const copy = type === "category"
    ? "Revenue grouped by product category."
    : type === "status"
      ? "Orders grouped by current status."
      : type === "inventory"
        ? "Products grouped by stock health."
        : "Revenue grouped by saved order attribution.";
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const totalLabel = type === "category" || type === "channel" ? formatCurrencyShort(total) : formatNumber(total);

  return (
    <section className="vh-admin-panel vh-admin-analytics-panel">
      <div className="vh-admin-panel__header">
        <div>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
        <span className="vh-admin-analytics-pill">{report.range.label}</span>
      </div>
      {segments.length ? (
        <div className="vh-admin-analytics-channel-grid">
          <AdminAnalyticsDonutChart segments={segments} totalLabel={totalLabel} />
          <div className="vh-admin-analytics-breakdown-list">
            {segments.map((segment) => (
              <div key={segment.label}>
                <span style={{ backgroundColor: segment.color }} aria-hidden="true" />
                <strong>{segment.label}</strong>
                <small>{segment.detail}</small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyAdminState
          title={type === "channel" ? "Channel attribution is not connected." : "No report data for this section."}
          copy={type === "channel"
            ? "Sales channels will appear after orders include source or campaign attribution."
            : "Records will appear here when matching data exists for the selected date range."}
        />
      )}
    </section>
  );
}

function TopProductsPanel({ report }: { report: AdminReportData }) {
  const topProducts = report.topProducts.slice(0, 5);

  return (
    <section className="vh-admin-panel vh-admin-analytics-panel">
      <div className="vh-admin-panel__header">
        <div>
          <h2>Top Selling Products</h2>
          <p>Best sellers from confirmed orders in this report range.</p>
        </div>
        <Link href="/admin/products">View full product report <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      {topProducts.length ? (
        <div className="vh-admin-analytics-product-list">
          <div className="vh-admin-analytics-product-header" aria-hidden="true">
            <span>Product</span>
            <span>Revenue</span>
            <span>Sold</span>
          </div>
          {topProducts.map((product) => (
            <Link key={product.key} href="/admin/products" className="vh-admin-analytics-product-row">
              {product.image ? (
                <img src={product.image} alt={product.name} />
              ) : (
                <span aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>
              )}
              <strong>{product.name}</strong>
              <small>{formatAmountWithUnit(product.revenue, "PHP")}</small>
              <b>{formatNumber(product.sold)}</b>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyAdminState title="No product sales for this range." copy="Products will appear after paid orders are recorded in the selected period." />
      )}
    </section>
  );
}

function CustomerReportPanel({ report }: { report: AdminReportData }) {
  return (
    <section className="vh-admin-panel vh-admin-analytics-panel">
      <div className="vh-admin-panel__header">
        <div>
          <h2>Customer Reports</h2>
          <p>Customer totals from profiles, manual records, and order contacts.</p>
        </div>
        <Link href="/admin/customers">View customers <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      <div className="vh-admin-analytics-customer-list">
        <div>
          <span><Users size={18} aria-hidden="true" /></span>
          <strong>Total Customers</strong>
          <b>{formatNumber(report.totalCustomers)}</b>
        </div>
        <div>
          <span><ShoppingCart size={18} aria-hidden="true" /></span>
          <strong>Orders In Range</strong>
          <b>{formatNumber(report.currentOrders.length)}</b>
        </div>
        <div>
          <span><ShoppingBag size={18} aria-hidden="true" /></span>
          <strong>Paid Payments</strong>
          <b>{formatNumber(report.currentPaidPayments.length)}</b>
        </div>
        <div>
          <span><BarChart3 size={18} aria-hidden="true" /></span>
          <strong>Average Order Value</strong>
          <b>{formatAmountWithUnit(report.averageOrderValue, "PHP")}</b>
        </div>
      </div>
    </section>
  );
}

function InventoryTable({ report }: { report: AdminReportData }) {
  const products = report.products.slice(0, 8);

  return (
    <section className="vh-admin-panel vh-admin-analytics-panel">
      <div className="vh-admin-panel__header">
        <div>
          <h2>Inventory Reports</h2>
          <p>Stock status and retail inventory value from product records.</p>
        </div>
        <Link href="/admin/products">View inventory <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      {products.length ? (
        <div className="vh-admin-report-table-wrap">
          <table className="vh-admin-report-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Stock</th>
                <th>Retail Value</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const stock = getProductStock(product);

                return (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{getProductInventoryStatus(product)}</td>
                    <td>{formatNumber(stock)}</td>
                    <td>{formatAmountWithUnit((stock * product.pricePhpCents) / 100, "PHP")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyAdminState title="No product inventory connected." copy="Inventory reports will appear when product records are available." />
      )}
    </section>
  );
}

function RecentReportsTable({ report, selectedTab }: { report: AdminReportData; selectedTab: ReportTabKey }) {
  const rows = selectedTab === "overview" ? report.recentReports : report.recentReports.filter((item) => item.id === selectedTab);
  const safeRows = rows.length ? rows : report.recentReports;

  return (
    <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-report-recent-panel">
      <div className="vh-admin-panel__header">
        <div>
          <h2>Recent Reports</h2>
          <p>Download CSV reports generated from the selected date range.</p>
        </div>
      </div>
      <div className="vh-admin-report-table-wrap">
        <table className="vh-admin-report-table">
          <thead>
            <tr>
              <th>Report Name</th>
              <th>Type</th>
              <th>Date Range</th>
              <th>Generated On</th>
              <th>Generated By</th>
              <th>Format</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.type}</td>
                <td>{row.dateRange}</td>
                <td>{row.generatedOn}</td>
                <td>{row.generatedBy}</td>
                <td>{row.format}</td>
                <td>
                  <Link className="vh-admin-report-icon-button" href={buildExportHref(row.id, report.range.key)} aria-label={`Download ${row.name}`}>
                    <Download size={15} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportContent({ report, selectedTab }: { report: AdminReportData; selectedTab: ReportTabKey }) {
  if (selectedTab === "sales") {
    return (
      <>
        <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-analytics-panel--sales">
          <AdminAnalyticsSalesChart
            points={report.salesPoints}
            currentLabel={report.range.label}
            previousLabel={report.range.key === "all" ? null : report.previousRange.label}
            title="Revenue Over Time"
            subtitle="Revenue and orders over the selected report range."
          />
        </section>
        <DonutBreakdown report={report} type="category" />
        <DonutBreakdown report={report} type="channel" />
      </>
    );
  }

  if (selectedTab === "orders") {
    return (
      <>
        <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-analytics-panel--sales">
          <AdminAnalyticsSalesChart
            points={report.salesPoints}
            currentLabel={report.range.label}
            previousLabel={report.range.key === "all" ? null : report.previousRange.label}
            title="Revenue Over Time"
            subtitle="Order and payment movement for this report range."
          />
        </section>
        <DonutBreakdown report={report} type="status" />
      </>
    );
  }

  if (selectedTab === "products") {
    return (
      <>
        <TopProductsPanel report={report} />
        <DonutBreakdown report={report} type="category" />
        <InventoryTable report={report} />
      </>
    );
  }

  if (selectedTab === "customers") {
    return (
      <>
        <CustomerReportPanel report={report} />
        <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-analytics-panel--sales">
          <AdminAnalyticsSalesChart
            points={report.salesPoints}
            currentLabel={report.range.label}
            previousLabel={report.range.key === "all" ? null : report.previousRange.label}
            title="Customer Revenue Over Time"
            subtitle="Revenue and orders connected to customer records."
          />
        </section>
      </>
    );
  }

  if (selectedTab === "marketing") {
    return (
      <>
        <DonutBreakdown report={report} type="channel" />
        <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-analytics-panel--sales">
          <AdminAnalyticsSalesChart
            points={report.salesPoints}
            currentLabel={report.range.label}
            previousLabel={report.range.key === "all" ? null : report.previousRange.label}
            title="Attributed Revenue Over Time"
            subtitle="Uses order source and campaign fields when present."
          />
        </section>
      </>
    );
  }

  if (selectedTab === "inventory") {
    return (
      <>
        <InventoryTable report={report} />
        <DonutBreakdown report={report} type="inventory" />
      </>
    );
  }

  return (
    <>
      <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-analytics-panel--sales">
        <AdminAnalyticsSalesChart
          points={report.salesPoints}
          currentLabel={report.range.label}
          previousLabel={report.range.key === "all" ? null : report.previousRange.label}
          title="Revenue Over Time"
          subtitle="Revenue and order movement for the selected report range."
        />
      </section>
      <DonutBreakdown report={report} type="category" />
      <TopProductsPanel report={report} />
      <DonutBreakdown report={report} type="status" />
      <DonutBreakdown report={report} type="channel" />
    </>
  );
}

export default async function AdminReportsPage({ searchParams }: Props) {
  await requireManagementUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedRange = resolveReportRangeKey(resolvedSearchParams.range);
  const selectedTab = resolveReportTabKey(resolvedSearchParams.tab);
  const report = await loadAdminReportData(selectedRange);

  return (
    <div className="vh-admin-page vh-admin-analytics-page vh-admin-reports-page">
      <AdminPageHeader title="Reports" subtitle="View and export detailed reports about your store performance.">
        <Suspense fallback={null}>
          <AdminReportControls rangeOptions={REPORT_RANGE_OPTIONS} selectedRange={selectedRange} selectedTab={selectedTab} />
        </Suspense>
      </AdminPageHeader>

      {report.loadErrors.length ? (
        <div className="vh-admin-alert">
          {report.loadErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <nav className="vh-admin-report-tabs" aria-label="Report sections">
        {REPORT_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={buildTabHref(tab.key, selectedRange)}
            className={tab.key === selectedTab ? "vh-admin-report-tab vh-admin-report-tab--active" : "vh-admin-report-tab"}
            aria-current={tab.key === selectedTab ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="vh-admin-analytics-metrics-grid" aria-label="Report metrics">
        <ReportMetricCard
          href="/admin/payments"
          label="Total Revenue"
          value={formatAmountWithUnit(report.revenue, "PHP")}
          delta={formatReportMetricDelta(report.revenue, report.previousRevenue, report.range, "Confirmed payment report")}
          trend={resolveTrend(report.revenue, report.previousRevenue, report.range.key)}
          icon={ShoppingBag}
        />
        <ReportMetricCard
          href="/admin/orders"
          label="Total Orders"
          value={formatNumber(report.currentOrders.length)}
          delta={formatReportMetricDelta(report.currentOrders.length, report.previousOrders.length, report.range, "Order report source")}
          trend={resolveTrend(report.currentOrders.length, report.previousOrders.length, report.range.key)}
          tone="blue"
          icon={ShoppingCart}
        />
        <ReportMetricCard
          href="/admin/customers"
          label="Total Customers"
          value={formatNumber(report.totalCustomers)}
          delta={formatReportMetricDelta(report.totalCustomers, report.previousCustomerCount, report.range, "Profile report source")}
          trend={resolveTrend(report.totalCustomers, report.previousCustomerCount, report.range.key)}
          tone="green"
          icon={Users}
        />
        <ReportMetricCard
          href="/admin/reports?tab=sales"
          label="Average Order Value"
          value={formatAmountWithUnit(report.averageOrderValue, "PHP")}
          delta={formatReportMetricDelta(report.averageOrderValue, report.previousAverageOrderValue, report.range, "Paid payments only")}
          trend={resolveTrend(report.averageOrderValue, report.previousAverageOrderValue, report.range.key)}
          tone="gold"
          icon={BarChart3}
        />
        <ReportMetricCard
          href="/admin/reports?tab=orders"
          label="Conversion Rate"
          value={`${report.conversionRate.toFixed(2)}%`}
          delta={formatReportMetricDelta(report.conversionRate, report.previousConversionRate, report.range, "Paid / total orders")}
          trend={resolveTrend(report.conversionRate, report.previousConversionRate, report.range.key)}
          tone="rose"
          icon={TrendingUp}
        />
      </section>

      <div className="vh-admin-analytics-layout vh-admin-report-layout">
        <ReportContent report={report} selectedTab={selectedTab} />
      </div>

      <RecentReportsTable report={report} selectedTab={selectedTab} />
    </div>
  );
}
