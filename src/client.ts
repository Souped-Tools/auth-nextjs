"use client"

import { createContext, useContext, createElement } from "react"
import type { ReactNode } from "react"
import type { SoupedClaims } from "./core.js"

export type SoupedUser = Pick<SoupedClaims, "sub" | "email" | "roles">

const SoupedContext = createContext<SoupedUser | null>(null)

/**
 * Wrap your app (or a subtree) with this provider to access the user in client components.
 *
 * In your layout.tsx (server component):
 * ```tsx
 * import { getSession } from "@souped-tools/auth-nextjs"
 * import { SoupedProvider } from "@souped-tools/auth-nextjs/client"
 *
 * export default async function Layout({ children }) {
 *   const session = await getSession()
 *   return <SoupedProvider user={session}>{children}</SoupedProvider>
 * }
 * ```
 */
export function SoupedProvider({
  user,
  children,
}: {
  user: SoupedUser | null
  children: ReactNode
}) {
  return createElement(SoupedContext.Provider, { value: user }, children)
}

/**
 * Read the current user in any client component.
 * Returns `null` if not authenticated.
 *
 * ```tsx
 * "use client"
 * import { useSession } from "@souped-tools/auth-nextjs/client"
 *
 * export function UserGreeting() {
 *   const user = useSession()
 *   if (!user) return null
 *   return <p>Hello, {user.email}</p>
 * }
 * ```
 */
export function useSession(): SoupedUser | null {
  return useContext(SoupedContext)
}
