import { NextResponse, type NextRequest } from "next/server";
import { canAccess, decodeSession, homeFor, SESSION_COOKIE } from "@/lib/session-codec";
import { currentSite, routeForSite } from "@/lib/site";

const PROTECTED = ["/app", "/owner", "/me"];

/**
 * 1. Разделение сайтов (lib/site): лендинг и приложение — разные проекты из одного кода.
 * 2. Оптимистичная проверка доступа: без сессии — на /login?next=…,
 *    с чужой ролью — на свою главную. Окончательная проверка — в данных (requireSession).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const site = currentSite();

  const decision = routeForSite(
    site,
    pathname,
    search,
    site === "landing" ? process.env.JALAQY_APP_URL : process.env.JALAQY_LANDING_URL,
  );
  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  if (decision.kind === "notFound") {
    return new NextResponse(null, { status: 404 });
  }

  const response = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ? guard(request, pathname, search)
    : NextResponse.next();
  // приложение — закрытый кабинет: поисковикам там делать нечего
  if (site === "app") response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function guard(request: NextRequest, pathname: string, search: string): NextResponse {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (!canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }
  return NextResponse.next();
}

export const config = {
  // всё, кроме статики Next, картинок, иконок и служебных файлов PWA
  matcher: [
    "/((?!_next/static|_next/image|images/|icons/|favicon|icon|apple-icon|manifest|sw\\.js|robots\\.txt|sitemap\\.xml).*)",
  ],
};
