import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  // Allow webhook POST (Parallel needs to reach this without auth)
  if (request.nextUrl.pathname === "/api/webhook" && request.method === "POST") {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authed = request.cookies.get("site-auth")?.value;
  if (authed === password) {
    return NextResponse.next();
  }

  // Check for password in query param (login form posts here)
  const passwordAttempt = request.nextUrl.searchParams.get("password");
  if (passwordAttempt === password) {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("site-auth", password, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  }

  // Show login page
  if (request.nextUrl.pathname === "/login") {
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
