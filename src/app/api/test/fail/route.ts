import { isDemo } from "@/lib/api";
import { setFailures } from "@/lib/api/mock/failures";

/** Только для e2e (JALAQY_E2E=1): какие методы мока должны падать. Тело: { methods: string[] }. */
export async function POST(request: Request) {
  if (process.env.JALAQY_E2E !== "1" || !isDemo) {
    return new Response(null, { status: 404 });
  }
  const { methods } = (await request.json().catch(() => ({ methods: [] }))) as {
    methods?: string[];
  };
  setFailures(Array.isArray(methods) ? methods.map(String) : []);
  return new Response(null, { status: 204 });
}
