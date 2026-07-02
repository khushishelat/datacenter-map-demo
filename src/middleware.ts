import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  // Allow public endpoints without auth
  if (request.nextUrl.pathname === "/api/webhook" && request.method === "POST") {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname === "/api/auth") {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname === "/api/newsletter/subscribe") {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname === "/api/cron/newsletter") {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authed = request.cookies.get("site-auth")?.value;
  if (authed === password) {
    return NextResponse.next();
  }

  // Show login and unsubscribe pages
  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/unsubscribe") {
    return NextResponse.next();
  }

  // Redirect to login
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login).*)",
  ],
};
