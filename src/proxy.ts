import { NextResponse, type NextRequest } from "next/server";

// Sprach-Routing der Kundenseiten (app/[lang]):
// - Deutsch bleibt unter den bisherigen URLs und wird intern auf /de/… umgeschrieben.
// - Englisch liegt sichtbar unter /en/… und geht unverändert durch.
// - Sichtbare /de/…-URLs leiten auf die URL ohne Präfix um, damit es pro Seite nur eine deutsche URL gibt.
// Admin, API, Next-Interna und Dateien (alles mit Endung) laufen gar nicht erst durch (siehe matcher).

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/de" || pathname.startsWith("/de/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/en" || pathname.startsWith("/en/")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/de${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Alles außer /admin, /api, /_next, /_vercel und Pfaden mit Dateiendung (icon.png, /assets/…, robots.txt).
    "/((?!admin(?:/|$)|api(?:/|$)|_next/|_vercel/|.*\\.[^/]+$).*)",
  ],
};
