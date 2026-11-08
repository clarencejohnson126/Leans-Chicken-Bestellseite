import { orderMessages } from "@/i18n/order-messages";
import { orderRequestSchemaFor, requestLocale } from "@/lib/validation";
import { loadAdminStore, loadOrderDeps } from "@/server/integrations";
import { log } from "@/server/log";
import { createOrder } from "@/server/orders";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_json", message: orderMessages.de.invalidJson }, { status: 400 });
  }

  // Sprache zuerst lesen, damit auch Validierungsfehler in der Sprache des Formulars zurückkommen.
  const lang = requestLocale(body);
  const messages = orderMessages[lang];
  const parsed = orderRequestSchemaFor(lang).safeParse(body);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((i) => [i.path.join("."), i.message]),
    );
    return Response.json(
      { code: "validation", message: messages.validation, fields },
      { status: 422 },
    );
  }

  const deps = loadOrderDeps();
  if (!deps) {
    return Response.json(
      {
        code: "not_configured",
        message: messages.notConfigured,
      },
      { status: 503 },
    );
  }

  if (await loadAdminStore()?.ordersPaused()) {
    return Response.json(
      { code: "paused", message: messages.paused },
      { status: 409 },
    );
  }

  const result = await createOrder(parsed.data, "website", deps, new Date(), log);
  if (!result.ok) {
    return Response.json(result, { status: result.code === "checkout_failed" ? 502 : 409 });
  }
  return Response.json(result, { status: 201 });
}
