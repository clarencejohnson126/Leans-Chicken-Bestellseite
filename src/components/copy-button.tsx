"use client";

import { useState } from "react";

/** Kopiert einen Text (z. B. Zahlungs- oder Verfolgungslink) in die Zwischenablage. */
export function CopyButton({
  text,
  label,
  className = "btn btn-ghost",
  copiedLabel = "Kopiert ✓",
}: {
  text: string;
  label: string;
  className?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
