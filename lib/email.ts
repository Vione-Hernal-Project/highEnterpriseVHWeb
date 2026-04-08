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
  notes?: string | null;
  shippingAddress: string;
};

type EmailResult = {
  status: "sent" | "failed" | "not_configured";
  sentAt?: string;
};

let transporter: nodemailer.Transporter | null = null;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    input.notes ? `Notes: ${input.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const safeCustomerName = escapeHtml(input.customerName);
  const safeOrderSummary = escapeHtml(orderSummary);

  const customerHtml = `
    <div style="font-family: Arial, sans-serif; color: #111114; line-height: 1.6;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">Vione Hernal order received</h1>
      <p>Hi ${safeCustomerName},</p>
      <p>Your order has been created and is now waiting for payment confirmation.</p>
      <p style="white-space: pre-line;">${safeOrderSummary}</p>
    </div>
  `;

  const storeEmail = serverEnv.storeNotificationEmail || "";
  const customerMessage = activeTransporter.sendMail({
    from: serverEnv.smtpFrom,
    to: input.to,
    subject: `Vione Hernal order confirmation ${input.orderNumber || ""}`.trim(),
    text: `Your Vione Hernal order has been created.\n\n${orderSummary}`,
    html: customerHtml,
  });

  const notificationMessage =
    storeEmail && storeEmail.toLowerCase() !== input.to.toLowerCase()
      ? activeTransporter.sendMail({
          from: serverEnv.smtpFrom,
          to: storeEmail,
          subject: `New Vione Hernal order ${input.orderNumber || ""}`.trim(),
          text: `A new order was placed.\n\n${orderSummary}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #111114; line-height: 1.6;">
              <h1 style="font-size: 20px; margin-bottom: 16px;">New Vione Hernal order</h1>
              <p style="white-space: pre-line;">${safeOrderSummary}</p>
            </div>
          `,
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
