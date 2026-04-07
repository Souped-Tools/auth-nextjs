import { NextRequest, NextResponse } from 'next/server';

type ProxyHandler = (request: NextRequest) => Response | NextResponse | Promise<Response | NextResponse>;
/**
 * Standalone proxy — use when you don't have existing proxy/middleware logic.
 *
 * ```ts
 * // src/proxy.ts
 * export { proxy } from "@souped-tools/auth-nextjs/proxy"
 * export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
 * ```
 */
declare function proxy(request: NextRequest): Promise<NextResponse<unknown>>;
/**
 * Composable wrapper — use when you have existing proxy/middleware logic.
 *
 * ```ts
 * // src/proxy.ts (Next.js 16+)
 * import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
 *
 * export const proxy = withSoupedAuth((request) => {
 *   // your custom logic here
 *   return NextResponse.next()
 * })
 * ```
 *
 * ```ts
 * // middleware.ts (Next.js 15)
 * import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
 *
 * export const middleware = withSoupedAuth((request) => {
 *   return NextResponse.next()
 * })
 * ```
 */
declare function withSoupedAuth(handler: ProxyHandler): ProxyHandler;
declare const config: {
    matcher: string[];
};

export { config, proxy, withSoupedAuth };
