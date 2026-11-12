import { connection } from "next/server";
import { db } from "@/lib/firebase/admin";
import { dataMode } from "@/lib/mode";

/**
 * Проверка «жив ли сервис и видит ли он базу» — для настройки хостинга.
 * Секретов и данных не отдаёт: только режим и вид ошибки подключения.
 */
export async function GET() {
  await connection();
  const mode = dataMode();
  const session = Boolean(process.env.SESSION_SECRET);
  if (mode !== "firebase") return Response.json({ mode, session, db: null });
  try {
    await db().collection("companies").limit(1).get();
    return Response.json({ mode, session, db: "ok" });
  } catch (e) {
    const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
    console.error("[health] база недоступна:", e);
    // наружу — только категория, без текста ошибки
    const reason = /private key|PEM|DECODER|asn1|parse/i.test(text)
      ? "private_key_format"
      : /PERMISSION_DENIED|permission/i.test(text)
        ? "permission_denied"
        : /UNAUTHENTICATED|invalid_grant|account not found|invalid_client/i.test(text)
          ? "wrong_account_or_key"
          : /NOT_FOUND|project/i.test(text)
            ? "project_or_database_not_found"
            : "other";
    return Response.json({ mode, session, db: "error", reason }, { status: 503 });
  }
}
