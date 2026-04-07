"use client";

// src/client.ts
import { createContext, useContext, createElement } from "react";
var SoupedContext = createContext(null);
function SoupedProvider({
  user,
  children
}) {
  return createElement(SoupedContext.Provider, { value: user }, children);
}
function useSession() {
  return useContext(SoupedContext);
}
export {
  SoupedProvider,
  useSession
};
