import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WhatsAppButton } from "@/components/whatsapp-button";

export const metadata: Metadata = { title: "Zahlung abgebrochen | Lean's Crispy Chicken" };

export default function CancelledPage({ searchParams }: PageProps<"/bestellung/abgebrochen">) {
  return (
    <main className="wrap status-page">
      <p className="eyebrow">Bezahlung</p>
      <h1>
        Deine Bestellung wurde <span className="brush">noch nicht</span> bezahlt.
      </h1>
      <p className="lead">
        Es wurde nichts abgebucht. Deine Lieferzeit halten wir noch kurz für dich frei – danach wird
        sie wieder für andere freigegeben.
      </p>
      <div className="status-actions">
        <Link href="/bestellen" className="btn btn-red">
          Zahlung erneut versuchen
        </Link>
        <Suspense fallback={null}>
          <ContactButton searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function ContactButton({ searchParams }: Pick<PageProps<"/bestellung/abgebrochen">, "searchParams">) {
  const { order } = await searchParams;
  const orderNumber = typeof order === "string" ? order : null;
  return (
    <WhatsAppButton
      label="Über WhatsApp kontaktieren"
      text={
        orderNumber
          ? `Hi Lean's, meine Zahlung für ${orderNumber} hat nicht geklappt.`
          : "Hi Lean's, meine Zahlung hat nicht geklappt."
      }
    />
  );
}
