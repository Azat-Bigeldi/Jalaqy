import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-codec";

/**
 * Выход по ссылке: сюда уводит слой данных, когда сессия больше не действует
 * (доступ закрыли, роль поменяли, компанию удалили). Стираем cookie и ведём на вход.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
