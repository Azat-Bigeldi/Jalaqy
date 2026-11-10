import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Role, Session } from "@/lib/api/contracts";
import { decodeSession, encodeSession, SESSION_COOKIE } from "./session-codec";

export async function getSession(): Promise<Session | null> {
  // Страницы с сессией персональные и считаются «на сегодня» (lib/clock):
  // рендерим их на запрос, не при пререндере
  await connection();
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

/** Сессия обязательна; без неё или с чужой ролью — на вход. */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session || (roles && !roles.includes(session.role))) redirect("/login");
  return session;
}

export async function setSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
