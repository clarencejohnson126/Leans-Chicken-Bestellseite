"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="admin-login">
      <label>
        E-Mail
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Passwort
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-red" disabled={pending}>
        {pending ? "Wird geprüft …" : "Einloggen"}
      </button>
    </form>
  );
}
