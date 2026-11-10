import "server-only";
import { createHash } from "node:crypto";
import { interpolate } from "@/i18n";
import { db } from "@/lib/firebase/admin";
import { verifyPassword } from "@/lib/password";
import { parseLoginContact } from "@/lib/validation/contact";
import type { JalaqyApi } from "../client";
import type { Role, Session } from "../contracts";
import { v, validation } from "../mock/core";

/*
 * Вход по телефону или почте и паролю.
 *
 * users/{userId}          — { name, contact, role, companyId, employeeId?, status, passwordHash }
 * loginAttempts/{hash}    — { fails, lockedUntil } — защита от подбора пароля
 *
 * Пароль хранится только хэшем scrypt (lib/password). После 5 неудачных попыток
 * вход для этого контакта закрывается на 15 минут. Ответ на неверный пароль и на
 * неизвестный контакт одинаковый — по форме нельзя узнать, кто зарегистрирован.
 */

const MAX_FAILS = 5;
/** Хэш случайного пароля: для неизвестного контакта проверка занимает столько же времени. */
const DUMMY_HASH =
  "scrypt$16384$8$1$4vGcFSsT-L4Qisg5zAAd1A$Zw3VRvSPQ9hfOge-ikAJPWhXA691ot8c32YmJdYi4v8";
const LOCK_MS = 15 * 60 * 1000;

export interface UserDoc {
  name: string;
  contact: string;
  role: Role;
  companyId: string;
  employeeId?: string;
  status: "active" | "invited";
  passwordHash?: string;
}

interface AttemptsDoc {
  fails: number;
  lockedUntil: number;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function findUserByContact(
  contact: string,
): Promise<{ id: string; data: UserDoc } | null> {
  const snap = await db().collection("users").where("contact", "==", contact).limit(1).get();
  const doc = snap.docs[0];
  return doc ? { id: doc.id, data: doc.data() as UserDoc } : null;
}

export const firebaseAuth: JalaqyApi["auth"] = {
  async login({ contact, password }) {
    const parsed = parseLoginContact(contact);
    if (!parsed) validation({ contact: v.contact });
    if (!password) validation({ password: v.required });

    const attemptsRef = db().collection("loginAttempts").doc(sha256(parsed.value));
    const attempts = (await attemptsRef.get()).data() as AttemptsDoc | undefined;
    if (attempts && attempts.lockedUntil > Date.now()) {
      const min = Math.ceil((attempts.lockedUntil - Date.now()) / 60_000);
      validation({ password: interpolate(v.loginLocked, { min }) });
    }

    const user = await findUserByContact(parsed.value);
    const ok = await verifyPassword(password, user?.data.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      // после блокировки счётчик начинается заново (fails обнулён при блокировке)
      const fails = (attempts?.fails ?? 0) + 1;
      await attemptsRef.set({
        fails: fails >= MAX_FAILS ? 0 : fails,
        lockedUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0,
      } satisfies AttemptsDoc);
      if (!user) console.warn(`[auth] login for unknown contact`);
      validation({ password: v.loginWrong });
    }
    if (attempts) await attemptsRef.delete();

    const ref = db().collection("users").doc(user.id);
    if (user.data.status === "invited") await ref.update({ status: "active" });

    const session: Session = {
      userId: user.id,
      role: user.data.role,
      name: user.data.name,
      companyId: user.data.companyId,
      ...(user.data.employeeId ? { employeeId: user.data.employeeId } : {}),
    };
    return session;
  },
};
