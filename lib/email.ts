import "server-only";

import nodemailer from "nodemailer";

import { isSmtpConfigured, serverEnv } from "@/lib/env/server";
import { formatAmountWithUnit, getPaymentMethodLabel } from "@/lib/payments/options";

type OrderConfirmationInput = {
  to: string | null | undefined;
  customerName: string;
  orderNumber: string | null;
  amount: string | number;
  currency?: string;
  paymentMethod: string;
  itemLines?: string[];
  notes?: string | null;
  shippingAddress: string;
  shippingMethodLabel?: string | null;
  shippingFee?: string | number | null;
};

type EmailResult = {
  status: "sent" | "failed" | "not_configured";
  sentAt?: string;
};

let transporter: nodemailer.Transporter | null = null;
const BRAND_NAME = "VIONE HERNAL";
const SUPPORT_EMAIL = "vionehernal@gmail.com";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeSiteUrl(value: string) {
  if (!value) {
    return "";
  }

  return value.replace(/\/+$/, "");
}

function formatTextBlock(label: string, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return `${label}: ${value}`;
}

function renderLines(lines: string[]) {
  return lines
    .map(
      (line) =>
        `<tr><td style="padding:0 0 14px;font-size:14px;line-height:1.85;color:#1a1a1a;border-bottom:1px solid #ece7df;">${escapeHtml(line)}</td></tr>`,
    )
    .join("");
}

function renderDetailCard(title: string, rows: Array<{ label: string; value: string | null | undefined }>) {
  const safeRows = rows.filter((row) => row.value);

  if (!safeRows.length) {
    return "";
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #d8d1c7;background:#ffffff;">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid #ece7df;font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#6e665d;">
          ${escapeHtml(title)}
        </td>
      </tr>
      ${safeRows
        .map(
          (row, index) => `
            <tr>
              <td style="padding:${index === 0 ? "18px 24px 16px" : "0 24px 16px"};">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#8a8278;margin-bottom:8px;">
                  ${escapeHtml(row.label)}
                </div>
                <div style="font-size:15px;line-height:1.8;color:#111114;white-space:pre-line;">
                  ${escapeHtml(row.value || "")}
                </div>
              </td>
            </tr>
          `,
        )
        .join("")}
    </table>
  `;
}

function renderItemSection(title: string, lines: string[]) {
  if (!lines.length) {
    return "";
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse;border:1px solid #d8d1c7;background:#ffffff;">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid #ece7df;font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#6e665d;">
          ${escapeHtml(title)}
        </td>
      </tr>
      <tr>
        <td style="padding:18px 24px 4px;font-family:Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${renderLines(lines)}
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderEmailShell(options: {
  eyebrow: string;
  title: string;
  introHtml: string;
  summaryCardsHtml: string;
  ctaHref?: string;
  ctaLabel?: string;
  secondaryNote?: string;
}) {
  const ctaHtml =
    options.ctaHref && options.ctaLabel
      ? `
        <tr>
          <td class="vh-shell-pad" style="padding:0 40px 36px;text-align:center;">
            <a
              href="${escapeHtml(options.ctaHref)}"
              style="display:inline-block;padding:16px 30px;border:1px solid #111114;background:#111114;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;"
            >
              ${escapeHtml(options.ctaLabel)}
            </a>
          </td>
        </tr>
      `
      : "";

  const noteHtml = options.secondaryNote
    ? `
      <tr>
        <td class="vh-shell-pad" style="padding:0 40px 42px;font-size:12px;line-height:1.9;color:#6e665d;text-align:center;">
          ${escapeHtml(options.secondaryNote)}
        </td>
      </tr>
    `
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @media only screen and (max-width: 640px) {
            .vh-shell-pad {
              padding-left: 24px !important;
              padding-right: 24px !important;
            }

            .vh-hero-title {
              font-size: 28px !important;
            }

            .vh-brand {
              letter-spacing: 0.34em !important;
            }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#f3f1ed;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          ${escapeHtml(`${options.eyebrow}: ${options.title}`)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f3f1ed;">
          <tr>
            <td align="center" style="padding:28px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;border-collapse:collapse;background:#ffffff;border:1px solid #d8d1c7;">
                <tr>
                  <td class="vh-shell-pad" style="padding:24px 40px 0;">
                    <div style="height:1px;background:#111114;line-height:1px;font-size:1px;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td class="vh-shell-pad" style="padding:22px 40px 0;text-align:center;">
                    <div class="vh-brand" style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.46em;text-transform:uppercase;color:#111114;">
                      ${BRAND_NAME}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="vh-shell-pad" style="padding:42px 40px 18px;font-family:Arial,sans-serif;text-align:center;">
                    <div style="font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#8a8278;margin-bottom:18px;">
                      ${escapeHtml(options.eyebrow)}
                    </div>
                    <div class="vh-hero-title" style="max-width:460px;margin:0 auto 18px;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.12;color:#111114;">
                      ${escapeHtml(options.title)}
                    </div>
                    <div style="max-width:470px;margin:0 auto;font-size:14px;line-height:1.9;color:#34302b;">
                      ${options.introHtml}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="vh-shell-pad" style="padding:0 40px 30px;font-family:Arial,sans-serif;">
                    ${options.summaryCardsHtml}
                  </td>
                </tr>
                ${ctaHtml}
                ${noteHtml}
                <tr>
                  <td class="vh-shell-pad" style="padding:0 40px 24px;">
                    <div style="height:1px;background:#ece7df;line-height:1px;font-size:1px;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td class="vh-shell-pad" style="padding:0 40px 28px;text-align:center;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.26em;text-transform:uppercase;color:#8a8278;">
                    Vione Hernal
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: serverEnv.smtpHost,
      port: serverEnv.smtpPort,
      secure: serverEnv.smtpSecure,
      auth: serverEnv.smtpUser || serverEnv.smtpPass ? { user: serverEnv.smtpUser, pass: serverEnv.smtpPass } : undefined,
    });
  }

  return transporter;
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationInput): Promise<EmailResult> {
  if (!input.to || !isSmtpConfigured()) {
    return {
      status: "not_configured",
    };
  }

  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    return {
      status: "not_configured",
    };
  }

  const orderSummary = [
    `Order number: ${input.orderNumber || "Pending assignment"}`,
    `Customer: ${input.customerName}`,
    `Amount: ${formatAmountWithUnit(input.amount, input.currency || getPaymentMethodLabel(input.paymentMethod))}`,
    `Payment method: ${getPaymentMethodLabel(input.paymentMethod)}`,
    `Shipping address: ${input.shippingAddress}`,
    input.shippingMethodLabel ? `Shipping method: ${input.shippingMethodLabel}` : null,
    input.shippingFee !== null && input.shippingFee !== undefined ? `Shipping fee: ${formatAmountWithUnit(input.shippingFee, "PHP")}` : null,
    input.itemLines?.length ? `Items:\n${input.itemLines.map((line) => `- ${line}`).join("\n")}` : null,
    input.notes ? `Notes: ${input.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const safeCustomerName = escapeHtml(input.customerName);
  const paymentMethodLabel = getPaymentMethodLabel(input.paymentMethod);
  const trackOrderHref = normalizeSiteUrl(serverEnv.publicSiteUrl)
    ? `${normalizeSiteUrl(serverEnv.publicSiteUrl)}/dashboard`
    : "";

  const customerHtml = renderEmailShell({
    eyebrow: "Order Confirmation",
    title: "Your order has been received.",
    introHtml: `
      <p style="margin:0 0 14px;">Hi ${safeCustomerName},</p>
      <p style="margin:0 0 14px;">
        Thank you for shopping with Vione Hernal. Your order has been created and is now waiting for payment confirmation.
      </p>
      <p style="margin:0;">
        We will keep the order details saved in your dashboard while the payment is being confirmed on-chain.
      </p>
    `,
    summaryCardsHtml: [
      renderDetailCard("Order Summary", [
        { label: "Order Number", value: input.orderNumber || "Pending assignment" },
        { label: "Order Total", value: formatAmountWithUnit(input.amount, input.currency || paymentMethodLabel) },
        { label: "Payment Method", value: paymentMethodLabel },
        { label: "Shipping Method", value: input.shippingMethodLabel || "Not selected" },
        {
          label: "Shipping Fee",
          value:
            input.shippingFee !== null && input.shippingFee !== undefined
              ? formatAmountWithUnit(input.shippingFee, "PHP")
              : "Not set",
        },
      ]),
      input.itemLines?.length ? renderItemSection("Ordered Pieces", input.itemLines) : "",
      renderDetailCard("Delivery Details", [
        { label: "Customer", value: input.customerName },
        { label: "Shipping Address", value: input.shippingAddress },
        { label: "Notes", value: input.notes || "No note added." },
      ]),
    ].join(""),
    ctaHref: trackOrderHref || undefined,
    ctaLabel: trackOrderHref ? "Track Order" : undefined,
    secondaryNote: trackOrderHref
      ? `You can review this order anytime from your dashboard. If you need help, contact ${SUPPORT_EMAIL}.`
      : `If you need help with this order, contact ${SUPPORT_EMAIL}.`,
  });

  const storeNotificationHtml = renderEmailShell({
    eyebrow: "New Order",
    title: "A new Vione Hernal order was placed.",
    introHtml: `
      <p style="margin:0 0 14px;">A customer has placed a new order and the payment is currently waiting for confirmation.</p>
      <p style="margin:0;">Review the dashboard for the latest order and payment status updates.</p>
    `,
    summaryCardsHtml: [
      renderDetailCard("Order Summary", [
        { label: "Order Number", value: input.orderNumber || "Pending assignment" },
        { label: "Customer", value: input.customerName },
        { label: "Order Total", value: formatAmountWithUnit(input.amount, input.currency || paymentMethodLabel) },
        { label: "Payment Method", value: paymentMethodLabel },
      ]),
      input.itemLines?.length ? renderItemSection("Ordered Pieces", input.itemLines) : "",
      renderDetailCard("Delivery Details", [
        { label: "Shipping Address", value: input.shippingAddress },
        { label: "Shipping Method", value: input.shippingMethodLabel || "Not selected" },
        {
          label: "Shipping Fee",
          value:
            input.shippingFee !== null && input.shippingFee !== undefined
              ? formatAmountWithUnit(input.shippingFee, "PHP")
              : "Not set",
        },
        { label: "Notes", value: input.notes || "No note added." },
      ]),
    ].join(""),
    ctaHref: trackOrderHref || undefined,
    ctaLabel: trackOrderHref ? "Open Dashboard" : undefined,
  });

  const customerText = [
    "Your Vione Hernal order has been created.",
    "",
    orderSummary,
    "",
    "The order is now waiting for payment confirmation.",
    trackOrderHref ? `Track order: ${trackOrderHref}` : null,
    formatTextBlock("Support", SUPPORT_EMAIL),
  ]
    .filter(Boolean)
    .join("\n");

  const storeEmail = serverEnv.storeNotificationEmail || "";
  const customerMessage = activeTransporter.sendMail({
    from: serverEnv.smtpFrom,
    to: input.to,
    subject: `Vione Hernal order confirmation ${input.orderNumber || ""}`.trim(),
    text: customerText,
    html: customerHtml,
  });

  const notificationMessage =
    storeEmail && storeEmail.toLowerCase() !== input.to.toLowerCase()
      ? activeTransporter.sendMail({
          from: serverEnv.smtpFrom,
          to: storeEmail,
          subject: `New Vione Hernal order ${input.orderNumber || ""}`.trim(),
          text: `A new order was placed.\n\n${orderSummary}${trackOrderHref ? `\n\nDashboard: ${trackOrderHref}` : ""}`,
          html: storeNotificationHtml,
        })
      : Promise.resolve(null);

  const [customerResult] = await Promise.allSettled([customerMessage, notificationMessage]);

  if (customerResult.status === "rejected") {
    return {
      status: "failed",
    };
  }

  return {
    status: "sent",
    sentAt: new Date().toISOString(),
  };
}
