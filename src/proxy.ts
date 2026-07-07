import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.(?:avif|css|gif|ico|jpg|jpeg|js|json|map|png|svg|txt|webmanifest|webp|woff|woff2|xml)$/i;

function isAllowedDuringShutdown(pathname: string) {
  if (pathname === "/") return true;
  if (pathname === "/api/holding-interest") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (PUBLIC_FILE.test(pathname)) return true;
  return false;
}

export function proxy(request: NextRequest) {
  if (isAllowedDuringShutdown(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";

  const status = request.method === "GET" || request.method === "HEAD" ? 307 : 303;
  return NextResponse.redirect(url, status);
}

export const config = {
  matcher: [
    /*
     * Proxy still allows public files and the shutdown capture endpoint.
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
