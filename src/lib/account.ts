import "server-only";
import { api, isApiError } from "@/lib/api";
import type { CompanyUser, Session } from "@/lib/api/contracts";

/** Свой аккаунт для экрана профиля. В демо у сотрудника записи нет — берём из сессии. */
export async function getAccount(session: Session): Promise<CompanyUser> {
  try {
    return await api.account.get(session.userId);
  } catch (e) {
    if (isApiError(e) && e.body.code === "not_found") {
      return {
        id: session.userId,
        name: session.name,
        contact: "",
        role: session.role,
        status: "active",
        ...(session.employeeId ? { employeeId: session.employeeId } : {}),
      };
    }
    throw e;
  }
}
