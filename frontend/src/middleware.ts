import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const AUTH_ROUTES = new Set(["/auth/login", "/auth/register"]);
const PUBLIC_ROUTES = new Set(["/updates"]);
const UI_MODE_COOKIE = "ui_mode";

const isPublicAsset = (pathname: string) =>
  pathname.startsWith("/_next") ||
  pathname.startsWith("/favicon") ||
  pathname.startsWith("/robots") ||
  pathname.startsWith("/sitemap") ||
  pathname.startsWith("/assets");

const isFileRequest = (pathname: string) => /\.[a-zA-Z0-9]+$/.test(pathname);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname) || isFileRequest(pathname)) {
    return NextResponse.next();
  }

  if (AUTH_ROUTES.has(pathname)) {
    const response = NextResponse.next();
    const mode = pathname.endsWith("/register") ? "register" : "login";
    response.cookies.set(UI_MODE_COOKIE, mode, { path: "/", sameSite: "lax" });
    return response;
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    const response = NextResponse.next();
    if (pathname === "/updates") {
      response.cookies.set(UI_MODE_COOKIE, "updates", { path: "/", sameSite: "lax" });
    }
    return response;
  }

  const hasAccess = request.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!hasAccess && !hasRefresh) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    response.cookies.set(UI_MODE_COOKIE, "login", { path: "/", sameSite: "lax" });
    return response;
  }

  if (pathname === "/") {
    const response = NextResponse.next();
    response.cookies.set(UI_MODE_COOKIE, "home", { path: "/", sameSite: "lax" });
    return response;
  }

  const response = NextResponse.next();
  if (request.cookies.get(UI_MODE_COOKIE)) {
    response.cookies.delete(UI_MODE_COOKIE);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api).*)"],
};
