import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Layers3, ReceiptText, ShieldCheck, Wallet } from "lucide-react";

import { AdminLedgerShell } from "@/components/admin/admin-ledger-shell";
import { requireAdminArea } from "@/lib/auth";
import { loadLedgerTransactionDetail } from "@/lib/admin/allocation-ledger";

type Props = {
  params: Promise<{
    kind: string;
    id: string;
  }>;
};

function DetailValue({ value }: { value: string | null }) {
  return <strong>{value || "Not recorded"}</strong>;
}

function getSectionIcon(title: string) {
  if (title.includes("Wallet")) {
    return <Wallet size={18} aria-hidden="true" />;
  }

  if (title.includes("Order")) {
    return <ReceiptText size={18} aria-hidden="true" />;
  }

  return <ExternalLink size={18} aria-hidden="true" />;
}

export default async function AdminLedgerTransactionDetailPage({ params }: Props) {
  await requireAdminArea("ledger");

  const { kind, id } = await params;
  const detail = await loadLedgerTransactionDetail(kind, id);

  if (!detail) {
    notFound();
  }

  return (
    <AdminLedgerShell>
      <div className="vh-admin-ledger vh-admin-ledger-detail">
        <nav className="vh-admin-design-breadcrumb" aria-label="Breadcrumb">
          <Link href="/admin">Dashboard</Link>
          <span>/</span>
          <Link href="/admin/orders">Orders</Link>
          <span>/</span>
          <Link href="/admin/ledger/transactions">Transactions</Link>
          <span>/</span>
          <span>{detail.kind === "payment" ? "Payment" : "Cash-Out"}</span>
        </nav>

        <header className="vh-admin-ledger-header vh-admin-ledger-detail__header">
          <div>
            <Link className="vh-admin-ledger-detail__back" href="/admin/ledger/transactions">
              <ArrowLeft size={16} aria-hidden="true" />
              Transaction History
            </Link>
            <p className="vh-admin-design-eyebrow">{detail.eyebrow}</p>
            <h1>{detail.title}</h1>
            <p>Full ledger record with payment, order, wallet, chain, allocation, status, and timestamp detail.</p>
          </div>
          <div className="vh-admin-ledger-detail__amount">
            <span>{detail.methodLabel}</span>
            <strong>{detail.amountLabel}</strong>
            <p>{detail.occurredAtLabel}</p>
          </div>
        </header>

        <section className="vh-admin-ledger-kpi-grid vh-admin-ledger-kpi-grid--compact" aria-label="Transaction overview">
          {detail.overview.map((item) => (
            <article key={item.label} className="vh-admin-ledger-kpi">
              <div className="vh-admin-ledger-kpi__icon">
                <ShieldCheck size={18} aria-hidden="true" />
              </div>
              <div>
                <span>{item.label}</span>
                <DetailValue value={item.value} />
                <p>Recorded transaction field</p>
              </div>
            </article>
          ))}
        </section>

        <section className="vh-admin-ledger-detail-grid">
          <article className="vh-admin-ledger-panel vh-admin-ledger-detail__trace">
            <div className="vh-admin-ledger-panel__header">
              <div>
                <p className="vh-admin-design-eyebrow">Transaction Trace</p>
                <h2>{detail.referenceLabel}</h2>
                <span>{detail.chainLabel}</span>
              </div>
              <ShieldCheck size={18} aria-hidden="true" />
            </div>

            <div className="vh-admin-ledger-detail-trace-grid">
              <div>
                <span>Chain / Network</span>
                <strong>{detail.chainLabel}</strong>
              </div>
              <div>
                <span>Wallet</span>
                {detail.walletUrl ? (
                  <a href={detail.walletUrl} target="_blank" rel="noreferrer">
                    {detail.walletLabel}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <strong>{detail.walletLabel}</strong>
                )}
              </div>
              <div>
                <span>Status</span>
                <strong>{detail.statusLabel}</strong>
              </div>
            </div>

            <div className="vh-admin-ledger-detail-reference">
              <span>Full Transaction Reference</span>
              {detail.referenceUrl ? (
                <a href={detail.referenceUrl} target="_blank" rel="noreferrer">
                  <code>{detail.referenceValue}</code>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : (
                <code>{detail.referenceValue}</code>
              )}
            </div>

            <div className="vh-admin-ledger-detail-timeline" aria-label="Transaction timeline">
              <div>
                <span />
                <strong>Recorded</strong>
                <small>{detail.occurredAtLabel}</small>
              </div>
              <div>
                <span />
                <strong>{detail.statusLabel}</strong>
                <small>Confirmation status</small>
              </div>
              <div>
                <span />
                <strong>{detail.allocations.length ? "Allocated" : "Allocation pending"}</strong>
                <small>{detail.allocations.length} ledger row{detail.allocations.length === 1 ? "" : "s"}</small>
              </div>
            </div>
          </article>

          <article className="vh-admin-ledger-panel">
            <div className="vh-admin-ledger-panel__header">
              <div>
                <p className="vh-admin-design-eyebrow">Allocation Rows</p>
                <h2>{detail.allocations.length} row{detail.allocations.length === 1 ? "" : "s"}</h2>
                <span>Confirmed value routing for this ledger movement</span>
              </div>
              <Layers3 size={18} aria-hidden="true" />
            </div>

            <div className="vh-admin-ledger-detail-allocation-list">
              {detail.allocations.length ? (
                detail.allocations.map((allocation, index) => {
                  const percentageWidth = Number.parseFloat(allocation.percentageLabel || "");
                  const fallbackWidth = 100 / Math.max(detail.allocations.length, 1);
                  const width = Number.isFinite(percentageWidth) && percentageWidth > 0 ? percentageWidth : fallbackWidth;

                  return (
                    <div key={allocation.id} className="vh-admin-ledger-detail-allocation">
                      <div>
                        <i style={{ backgroundColor: allocation.color }} aria-hidden="true" />
                        <span>{allocation.percentageLabel || allocation.code}</span>
                      </div>
                      <strong>{allocation.name}</strong>
                      <b>{allocation.amountLabel}</b>
                      <em
                        style={{
                          background: `linear-gradient(90deg, ${allocation.color} ${width}%, #eee7df ${width}%)`,
                        }}
                        aria-hidden="true"
                      />
                      {allocation.beforeLabel || allocation.afterLabel ? (
                        <small>
                          {allocation.beforeLabel || "Not recorded"} → {allocation.afterLabel || "Not recorded"}
                        </small>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="vh-admin-ledger-empty">No allocation rows are attached to this transaction.</div>
              )}
            </div>
          </article>
        </section>

        {detail.items.length ? (
          <section className="vh-admin-ledger-panel vh-admin-ledger-detail-items" aria-label="Purchased items">
            <div className="vh-admin-ledger-panel__header">
              <div>
                <p className="vh-admin-design-eyebrow">Purchased Items</p>
                <h2>{detail.items.length} item{detail.items.length === 1 ? "" : "s"} attached to this transaction</h2>
                <span>Real product lines from the connected order record</span>
              </div>
              <ReceiptText size={18} aria-hidden="true" />
            </div>

            <div className="vh-admin-ledger-detail-item-list">
              {detail.items.map((item) => (
                <article key={item.id} className="vh-admin-ledger-detail-item">
                  <div className="vh-admin-ledger-detail-item__media">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} loading="lazy" />
                    ) : (
                      <span className="vh-admin-ledger-detail-item__placeholder">No image on record</span>
                    )}
                  </div>
                  <div className="vh-admin-ledger-detail-item__body">
                    <strong>{item.productName}</strong>
                    {item.productMeta ? <span>{item.productMeta}</span> : null}
                    <small>{item.quantityLabel}</small>
                  </div>
                  <div className="vh-admin-ledger-detail-item__totals">
                    <span>{item.unitPriceLabel}</span>
                    <strong>{item.lineTotalLabel}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="vh-admin-ledger-detail-section-grid">
          {detail.sections.map((section) => (
            <article key={section.title} className="vh-admin-ledger-panel">
              <div className="vh-admin-ledger-panel__header">
                <div>
                  <p className="vh-admin-design-eyebrow">{section.title}</p>
                  <h2>Recorded fields</h2>
                </div>
                {getSectionIcon(section.title)}
              </div>
              <div className="vh-admin-ledger-detail-field-list">
                {section.items.map((item) => (
                  <div key={`${section.title}-${item.label}`} className="vh-admin-ledger-detail-field">
                    <span>{item.label}</span>
                    <DetailValue value={item.value} />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </AdminLedgerShell>
  );
}
