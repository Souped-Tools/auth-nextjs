import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "./core.js"

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  const session = request.cookies.get("session")?.value

  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url))
  }

  try {
    await verifyToken(session)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(
      new URL("/api/auth/login", request.url)
    )
    response.cookies.delete("session")
    return response
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
