import "server-only";
import { business, trackingUrl } from "@/config/business";
import { formatEuro, formatWindow } from "@/lib/format";
import { formatDay } from "@/lib/time";
import type { OrderSummary } from "@/server/ports";

// E-Mails über die Resend-REST-API (ohne SDK): Bestellbestätigung mit Verfolgungslink an den Kunden,
// Hinweis an Lean bei neuer Bestellung, "Unterwegs"-Mail beim Losfahren. Aktiv, sobald
// RESEND_API_KEY und ORDER_NOTIFICATION_FROM gesetzt sind (Absender-Domain muss bei Resend verifiziert sein).

type MailerConfig = { apiKey: string; from: string; notifyTo?: string; replyTo?: string };

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function delivery(order: OrderSummary) {
  return `${formatDay(order.deliveryDate)}, ${formatWindow(order.slotStart, order.slotEnd)}`;
}

function itemsHtml(order: OrderSummary) {
  return order.items
    .map((i) => `<tr><td>${i.quantity}× ${escape(i.name)}</td><td align="right">${formatEuro(i.lineTotalCents)}</td></tr>`)
    .join("");
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#f7f5ef;font-family:Arial,sans-serif;color:#080808">
<div style="max-width:520px;margin:0 auto;padding:24px">
<p style="font-weight:bold;color:#e32228;letter-spacing:1px;margin:0 0 8px">${escape(business.name.toUpperCase())}</p>
<h1 style="font-size:24px;margin:0 0 16px">${escape(title)}</h1>
${body}
<p style="color:#666;font-size:13px;margin-top:28px">Fragen oder Änderungen? Antworte auf diese Mail oder schreib uns auf WhatsApp: ${escape(business.operator.phone)}</p>
</div></body></html>`;
}

function trackButton(order: OrderSummary) {
  return `<p style="margin:24px 0"><a href="${trackingUrl(order.trackingToken)}" style="background:#e32228;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Bestellung verfolgen</a></p>`;
}

export function confirmationMail(order: OrderSummary) {
  const status =
    order.paymentStatus === "processing"
      ? "Deine SEPA-Lastschrift ist eingereicht. Wir liefern wie geplant, die Abbuchung folgt in den nächsten Tagen."
      : "Deine Zahlung ist eingegangen.";
  return {
    subject: `Deine Bestellung ${order.orderNumber} bei ${business.name}`,
    html: layout(
      `Danke, ${order.customerName.split(" ")[0]}!`,
      `<p>${status} Lean bringt dein Essen mit dem Rad.</p>
<p><strong>Bestellnummer:</strong> ${order.orderNumber}<br><strong>Lieferung:</strong> ${delivery(order)}<br><strong>Adresse:</strong> ${escape(order.street)}, ${escape(order.postalCode)}</p>
<table width="100%" cellpadding="4" style="border-collapse:collapse;border-top:1px solid #ddd">${itemsHtml(order)}
<tr><td style="border-top:1px solid #ddd"><strong>Summe</strong></td><td align="right" style="border-top:1px solid #ddd"><strong>${formatEuro(order.totalCents)}</strong></td></tr></table>
<p>Über diesen Link siehst du jederzeit, ob dein Essen in Zubereitung oder schon unterwegs ist:</p>
${trackButton(order)}`,
    ),
  };
}

export function onTheWayMail(order: OrderSummary) {
  return {
    subject: `Dein Chicken ist unterwegs (${order.orderNumber})`,
    html: layout(
      "Dein Chicken ist unterwegs! 🚲",
      `<p>Lean ist gerade mit deiner Bestellung ${order.orderNumber} losgefahren und gleich bei dir in der ${escape(order.street)}.</p>${trackButton(order)}`,
    ),
  };
}

export function notificationMail(order: OrderSummary) {
  return {
    subject: `Neue Bestellung ${order.orderNumber} · ${formatEuro(order.totalCents)} · ${order.slotStart} Uhr`,
    html: layout(
      `Neue Bestellung ${order.orderNumber}`,
      `<p><strong>${escape(order.customerName)}</strong>${order.company ? ` (${escape(order.company)})` : ""} · ${escape(order.customerPhone)}<br>${escape(order.street)}, ${escape(order.postalCode)}${order.addressNote ? ` · ${escape(order.addressNote)}` : ""}</p>
<p><strong>Lieferung:</strong> ${delivery(order)} · Quelle: ${order.source}</p>
<table width="100%" cellpadding="4">${itemsHtml(order)}</table>
${order.customerNote ? `<p><em>„${escape(order.customerNote)}“</em></p>` : ""}
<p><a href="${business.siteUrl}/admin?tag=${order.deliveryDate}">Im Admin öffnen</a></p>`,
    ),
  };
}

export function createResendMailer(config: MailerConfig) {
  async function send(to: string, mail: { subject: string; html: string }, idempotencyKey: string) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ from: config.from, to: [to], reply_to: config.replyTo, ...mail }),
    });
    if (!response.ok) throw new Error(`resend ${response.status}: ${await response.text()}`);
  }

  return {
    /** Bestellbestätigung an den Kunden. Ohne E-Mail-Adresse gibt es nichts zu senden. */
    async confirmation(order: OrderSummary) {
      if (order.customerEmail) await send(order.customerEmail, confirmationMail(order), `confirmation_${order.id}`);
    },
    notification: config.notifyTo
      ? async (order: OrderSummary) => send(config.notifyTo!, notificationMail(order), `notification_${order.id}`)
      : undefined,
    async onTheWay(order: OrderSummary) {
      if (order.customerEmail) await send(order.customerEmail, onTheWayMail(order), `on_the_way_${order.id}`);
    },
  };
}

export type Mailer = ReturnType<typeof createResendMailer>;
