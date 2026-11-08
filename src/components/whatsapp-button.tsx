import { whatsappLink } from "@/config/business";
import { getDictionary, type Locale } from "@/i18n";

type Props = {
  label?: string;
  text?: string;
  className?: string;
  /** Sprache des Standard-Labels und der vorausgefüllten Bestellnachricht. */
  lang?: Locale;
};

/** Öffnet den WhatsApp-Chat mit vorausgefüllter Nachricht. Ohne konfigurierte Nummer unsichtbar. */
export function WhatsAppButton({ label, text, className = "", lang = "de" }: Props) {
  const href = whatsappLink(text, lang);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn btn-whatsapp ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
      </svg>
      {label ?? getDictionary(lang).buttons.whatsappOrder}
    </a>
  );
}
