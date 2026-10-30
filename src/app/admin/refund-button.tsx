"use client";

import { useActionState } from "react";
import { refundAction } from "@/app/admin/actions";

/** Zweistufig, weil eine Erstattung nicht rückgängig zu machen ist. */
export function RefundButton({ orderId, amount }: { orderId: string; amount: string }) {
  const [state, action, pending] = useActionState(refundAction, null);
  return (
    <details className="admin-refund">
      <summary className="btn-link">Erstatten</summary>
      <form action={action}>
        <input type="hidden" name="orderId" value={orderId} />
        <p>
          {amount} gehen über Stripe zurück an den Kunden, die Bestellung wird storniert. Das lässt sich nicht
          rückgängig machen.
        </p>
        <button type="submit" className="btn btn-red" disabled={pending}>
          {pending ? "Wird erstattet …" : `Ja, ${amount} erstatten`}
        </button>
        {state?.error && (
          <p className="notice error" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}
