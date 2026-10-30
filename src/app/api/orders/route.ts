import { orderRequestSchema } from "@/lib/validation";
import { loadAdminStore, loadOrderDeps } from "@/server/integrations";
import { log } from "@/server/log";
import { createOrder } from "@/server/orders";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_json", message: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = orderRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((i) => [i.path.join("."), i.message]),
    );
    return Response.json(
      { code: "validation", message: "Bitte prüfe deine Angaben.", fields },
      { status: 422 },
    );
  }

  const deps = loadOrderDeps();
  if (!deps) {
    return Response.json(
      {
        code: "not_configured",
        message: "Die Online-Bezahlung wird gerade eingerichtet. Bestell gern solange per WhatsApp.",
      },
      { status: 503 },
    );
  }

  if (await loadAdminStore()?.ordersPaused()) {
    return Response.json(
      { code: "paused", message: "Online-Bestellungen sind gerade pausiert. Schreib uns gern auf WhatsApp." },
      { status: 409 },
    );
  }

  const result = await createOrder(parsed.data, "website", deps, new Date(), log);
  if (!result.ok) {
    return Response.json(result, { status: result.code === "checkout_failed" ? 502 : 409 });
  }
  return Response.json(result, { status: 201 });
}
