import {
  verifyToken
} from "./chunk-7NTWS23R.js";

// src/proxy.ts
import { NextResponse } from "next/server";
async function proxy(request) {
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  const session = request.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }
  try {
    await verifyToken(session);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(
      new URL("/api/auth/login", request.url)
    );
    response.cookies.delete("session");
    return response;
  }
}
var config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
export {
  config,
  proxy
};
