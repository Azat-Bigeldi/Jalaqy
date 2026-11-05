import { isDemo } from "@/lib/api";
import { resetDb } from "@/lib/api/mock/db";
import { setFailures } from "@/lib/api/mock/failures";

/** Только для e2e (JALAQY_E2E=1): вернуть мок-данные к исходным. В остальных случаях — 404. */
export async function POST() {
  if (process.env.JALAQY_E2E !== "1" || !isDemo) {
    return new Response(null, { status: 404 });
  }
  resetDb();
  setFailures([]);
  return new Response(null, { status: 204 });
}
