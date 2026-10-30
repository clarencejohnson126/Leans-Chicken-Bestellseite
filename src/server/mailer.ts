import "server-only";
import { business, taxNote, trackingUrl, whatsappLink } from "@/config/business";
import { formatEuro, formatWindow } from "@/lib/format";
import { formatDay } from "@/lib/time";
import type { OrderSummary } from "@/server/ports";

// E-Mails über die Resend-REST-API (ohne SDK): Bestellbestätigung mit Verfolgungslink an den Kunden,
// Hinweis an Lean bei neuer Bestellung, "Unterwegs"-Mail beim Losfahren. Aktiv, sobald
// RESEND_API_KEY und ORDER_NOTIFICATION_FROM gesetzt sind (Absender-Domain muss bei Resend verifiziert sein).

type MailerConfig = { apiKey: string; from: string; notifyTo?: string; replyTo?: string };

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Markenfarben wie auf der Website. Mail-HTML: Tabellenlayout und Inline-Styles, damit es auch in
// Outlook und Gmail hält; Logo als PNG mit absoluter URL (WebP zeigen nicht alle Clients an).
const color = { black: "#080808", red: "#e32228", cream: "#f7f5ef", text: "#1a1a1a", muted: "#6b6660", line: "#e6e1d8" };
const font = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function delivery(order: OrderSummary) {
  return `${formatDay(order.deliveryDate)}, ${formatWindow(order.slotStart, order.slotEnd)}`;
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 0;color:${color.muted};font-size:14px;width:120px;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:15px;color:${color.text}">${value}</td></tr>`;
}

function itemsTable(order: OrderSummary) {
  const lines = order.items
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${color.line};font-size:15px">${i.quantity}× ${escape(i.name)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${color.line};font-size:15px;white-space:nowrap">${formatEuro(i.lineTotalCents)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0">${lines}
<tr><td style="padding:14px 0 0;font-size:16px;font-weight:bold">Summe</td><td align="right" style="padding:14px 0 0;font-size:20px;font-weight:bold;color:${color.red};white-space:nowrap">${formatEuro(order.totalCents)}</td></tr></table>
<p style="margin:6px 0 0;font-size:12px;color:${color.muted}">${escape(taxNote)}</p>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="background:${color.red};border-radius:999px">
<a href="${href}" style="display:inline-block;padding:16px 30px;font-family:${font};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${label}</a></td></tr></table>`;
}

function card(content: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${color.cream};border-radius:12px;margin:20px 0 0"><tr><td style="padding:18px 20px">${content}</td></tr></table>`;
}

function layout({ preheader, title, body }: { preheader: string; title: string; body: string }) {
  const site = business.siteUrl;
  const { operator } = business;
  const address = `Ein Unternehmen von ${operator.company} · ${operator.name} · ${operator.street} · ${operator.city}`;
  const wa = whatsappLink("Hi Lean's, ");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#efebe3;font-family:${font};color:${color.text}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efebe3"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td align="center" style="background:${color.black};padding:28px 24px 22px">
<a href="${site}"><img src="${site}/assets/brand/badge-email.png" width="96" height="96" alt="${escape(business.name)}" style="display:block;border:0"></a>
<p style="margin:12px 0 0;font-family:${font};font-size:12px;letter-spacing:3px;font-weight:bold;color:${color.cream}">CRISPY CHICKEN · MIT DEM RAD ZU DIR</p>
</td></tr>
<tr><td style="background:${color.red};height:6px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:32px 28px 8px">
<h1 style="margin:0 0 12px;font-family:${font};font-size:26px;line-height:1.2;color:${color.black}">${escape(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:24px 28px 28px">
<p style="margin:0;font-size:14px;line-height:1.5;color:${color.muted}">Fragen oder Änderungen? Antworte einfach auf diese Mail${wa ? ` oder <a href="${wa}" style="color:${color.red};font-weight:bold">schreib uns auf WhatsApp</a>` : ""}.</p>
</td></tr>
<tr><td style="background:${color.black};padding:22px 28px;font-size:12px;line-height:1.6;color:#bdb9b4">
<strong style="color:${color.cream}">${escape(business.name)}</strong><br>
${escape(address)}<br>
<a href="mailto:${business.operator.email}" style="color:#bdb9b4">${business.operator.email}</a> · ${escape(business.operator.phone)}<br>
<a href="${site}" style="color:#bdb9b4">${site.replace(/^https?:\/\//, "")}</a> · <a href="${site}/impressum" style="color:#bdb9b4">Impressum</a> · <a href="${site}/datenschutz" style="color:#bdb9b4">Datenschutz</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function orderDetails(order: OrderSummary) {
  return card(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("Bestellnummer", `<strong>${order.orderNumber}</strong>`)}
${row("Lieferung", delivery(order))}
${row("Adresse", `${escape(order.street)}, ${escape(order.postalCode)} ${escape(business.area.split(", ").pop() ?? "")}${order.addressNote ? `<br><span style="color:${color.muted}">${escape(order.addressNote)}</span>` : ""}`)}
</table>`,
  );
}

const paragraph = (text: string) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.55">${text}</p>`;

export function confirmationMail(order: OrderSummary) {
  const firstName = escape(order.customerName.split(" ")[0]);
  const status =
    order.paymentStatus === "processing"
      ? "Deine SEPA-Lastschrift ist eingereicht. Wir liefern wie geplant, die Abbuchung folgt in den nächsten Tagen."
      : "Deine Zahlung ist eingegangen.";
  return {
    subject: `Deine Bestellung ${order.orderNumber} bei ${business.name}`,
    html: layout({
      preheader: `Lieferung ${delivery(order)} · ${formatEuro(order.totalCents)}`,
      title: `Danke, ${order.customerName.split(" ")[0]}! 🍗`,
      body: `${paragraph(`${status} Wir machen deine Chicken Strips frisch und Lean bringt sie dir mit dem Rad.`)}
${orderDetails(order)}
<h2 style="margin:28px 0 0;font-size:13px;letter-spacing:2px;color:${color.muted}">DEINE BESTELLUNG</h2>
${itemsTable(order)}
<h2 style="margin:32px 0 6px;font-size:18px;color:${color.black}">Live verfolgen</h2>
${paragraph(`Über den Button siehst du jederzeit, ob dein Essen in der Fritteuse ist oder schon auf dem Rad zu dir, ${firstName}.`)}
${button(trackingUrl(order.trackingToken), "Bestellung verfolgen")}`,
    }),
  };
}

export function onTheWayMail(order: OrderSummary) {
  return {
    subject: `Dein Chicken ist unterwegs 🚲 (${order.orderNumber})`,
    html: layout({
      preheader: `Lean ist losgefahren und gleich bei dir in der ${order.street}.`,
      title: "Dein Chicken ist unterwegs! 🚲",
      body: `${paragraph(`Lean ist gerade mit deiner Bestellung <strong>${order.orderNumber}</strong> losgefahren und gleich bei dir in der ${escape(order.street)}. Halt schon mal die Tür bereit.`)}
${button(trackingUrl(order.trackingToken), "Bestellung verfolgen")}`,
    }),
  };
}

export function notificationMail(order: OrderSummary) {
  return {
    subject: `Neue Bestellung ${order.orderNumber} · ${formatEuro(order.totalCents)} · ${order.slotStart} Uhr`,
    html: layout({
      preheader: `${order.customerName} · ${delivery(order)}`,
      title: `Neue Bestellung ${order.orderNumber}`,
      body: `${paragraph(`<strong>${escape(order.customerName)}</strong>${order.company ? ` (${escape(order.company)})` : ""} · <a href="tel:${order.customerPhone}" style="color:${color.red}">${escape(order.customerPhone)}</a> · Quelle: ${order.source === "whatsapp" ? "WhatsApp" : "Website"}`)}
${orderDetails(order)}
${itemsTable(order)}
${order.customerNote ? card(`<em>„${escape(order.customerNote)}“</em>`) : ""}
${button(`${business.siteUrl}/admin?tag=${order.deliveryDate}`, "Im Dashboard öffnen")}`,
    }),
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
