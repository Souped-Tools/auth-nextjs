import * as react from 'react';
import { ReactNode } from 'react';
import { S as SoupedClaims } from './core-ByjMjqq3.js';

type SoupedUser = Pick<SoupedClaims, "sub" | "email" | "roles">;
/**
 * Wrap your app (or a subtree) with this provider to access the user in client components.
 *
 * In your layout.tsx (server component):
 * ```tsx
 * import { getSession } from "@souped/auth-nextjs"
 * import { SoupedProvider } from "@souped/auth-nextjs/client"
 *
 * export default async function Layout({ children }) {
 *   const session = await getSession()
 *   return <SoupedProvider user={session}>{children}</SoupedProvider>
 * }
 * ```
 */
declare function SoupedProvider({ user, children, }: {
    user: SoupedUser | null;
    children: ReactNode;
}): react.FunctionComponentElement<react.ProviderProps<SoupedUser | null>>;
/**
 * Read the current user in any client component.
 * Returns `null` if not authenticated.
 *
 * ```tsx
 * "use client"
 * import { useSession } from "@souped/auth-nextjs/client"
 *
 * export function UserGreeting() {
 *   const user = useSession()
 *   if (!user) return null
 *   return <p>Hello, {user.email}</p>
 * }
 * ```
 */
declare function useSession(): SoupedUser | null;

export { SoupedProvider, type SoupedUser, useSession };
