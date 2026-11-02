import { business, phoneHref } from "@/config/business";

/** Ruft die Bestellnummer an. Auf dem Handy öffnet sich direkt die Telefon-App. */
export function CallButton({ className = "btn btn-ghost" }: { className?: string }) {
  return (
    <a href={phoneHref} className={className}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z" />
      </svg>
      Anrufen: {business.operator.phoneDisplay}
    </a>
  );
}
