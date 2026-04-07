import {
  verifyToken
} from "./chunk-DIZYQRF2.js";

// src/index.ts
import { cookies } from "next/headers";
async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}
export {
  getSession
};
