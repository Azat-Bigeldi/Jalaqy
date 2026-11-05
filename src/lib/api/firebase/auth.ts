import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { interpolate, t } from "@/i18n";
import { db } from "@/lib/firebase/admin";
import { sendMail } from "@/lib/mail";
import { parseLoginContact } from "@/lib/validation/contact";
import type { JalaqyApi } from "../client";
import type { Role, Session } from "../contracts";
import { v, validation } from "../mock/core";

/*
 * Вход по одноразовому коду.
 *
 * users/{userId}        — { name, contact, role, companyId, employeeId?, status }
 * loginCodes/{hash}     — { userId, codeHash, expiresAt, sentAt, attempts }
 *
 * Код хранится только хэшем, живёт 10 минут, даёт 5 попыток.
 * Если контакта нет в users, ответ такой же, как при успехе: по форме входа
 * нельзя узнать, чья почта зарегистрирована.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_IN_SEC = 60;
const MAX_ATTEMPTS = 5;

interface UserDoc {
  name: string;
  contact: string;
  role: Role;
  companyId: string;
  employeeId?: string;
  status: "active" | "invited";
}

interface LoginCodeDoc {
  userId: string;
  codeHash: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const codeHash = (contact: string, code: string) =>
  sha256(`${process.env.SESSION_SECRET ?? ""}:${contact}:${code}`);

async function findUser(contact: string): Promise<{ id: string; data: UserDoc } | null> {
  const snap = await db().collection("users").where("contact", "==", contact).limit(1).get();
  const doc = snap.docs[0];
  return doc ? { id: doc.id, data: doc.data() as UserDoc } : null;
}

export const firebaseAuth: JalaqyApi["auth"] = {
  async requestCode({ contact }) {
    const parsed = parseLoginContact(contact);
    if (!parsed) validation({ contact: v.contact });
    // SMS-провайдера пока нет — входим только по почте
    if (parsed.kind === "phone") validation({ contact: v.phoneLoginSoon });

    const ref = db().collection("loginCodes").doc(sha256(parsed.value));
    const prev = (await ref.get()).data() as LoginCodeDoc | undefined;
    const waitSec = prev ? Math.ceil(RESEND_IN_SEC - (Date.now() - prev.sentAt) / 1000) : 0;
    if (waitSec > 0) validation({ contact: interpolate(v.codeWait, { sec: waitSec }) });

    const user = await findUser(parsed.value);
    if (!user) {
      console.warn(`[auth] code requested for unknown contact ${parsed.value}`);
      return { channel: "email", resendInSec: RESEND_IN_SEC };
    }

    const code = String(randomInt(0, 10_000)).padStart(4, "0");
    const doc: LoginCodeDoc = {
      userId: user.id,
      codeHash: codeHash(parsed.value, code),
      expiresAt: Date.now() + CODE_TTL_MS,
      sentAt: Date.now(),
      attempts: 0,
    };
    await ref.set(doc);
    await sendMail({
      to: parsed.value,
      subject: interpolate(t.auth.email.subject, { code }),
      text: interpolate(t.auth.email.text, { code }),
    });
    return { channel: "email", resendInSec: RESEND_IN_SEC };
  },

  async verifyCode({ contact, code }) {
    const parsed = parseLoginContact(contact);
    if (!parsed) validation({ contact: v.contact });
    if (!/^\d{4}$/.test(code)) validation({ code: v.code });

    const ref = db().collection("loginCodes").doc(sha256(parsed.value));
    const userId = await db().runTransaction(async (tx) => {
      const saved = (await tx.get(ref)).data() as LoginCodeDoc | undefined;
      if (!saved) return { error: v.codeWrong };
      if (saved.expiresAt < Date.now()) {
        tx.delete(ref);
        return { error: v.codeExpired };
      }
      if (saved.attempts >= MAX_ATTEMPTS) {
        tx.delete(ref);
        return { error: v.codeTooMany };
      }
      const expected = Buffer.from(saved.codeHash);
      const actual = Buffer.from(codeHash(parsed.value, code));
      if (!timingSafeEqual(expected, actual)) {
        tx.update(ref, { attempts: saved.attempts + 1 });
        return { error: v.codeWrong };
      }
      tx.delete(ref);
      return { userId: saved.userId };
    });
    if ("error" in userId) validation({ code: userId.error });

    const snap = await db().collection("users").doc(userId.userId).get();
    const user = snap.data() as UserDoc | undefined;
    if (!user) validation({ code: v.codeWrong });
    if (user.status === "invited") await snap.ref.update({ status: "active" });

    const session: Session = {
      userId: snap.id,
      role: user.role,
      name: user.name,
      companyId: user.companyId,
      ...(user.employeeId ? { employeeId: user.employeeId } : {}),
    };
    return session;
  },
};
