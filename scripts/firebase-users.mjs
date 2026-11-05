/**
 * Пользователи для входа через Firebase (коллекция users).
 * Запуск: npm run firebase:users -- --accountant a@mail.kz --owner b@mail.kz --employee c@mail.kz
 *
 * Пока разделы данных берутся из мока, пользователи привязаны к мок-компании
 * (companyId «tulpan») и тем же id, что в моке: u-acc, u-owner, u-daniyar.
 * Повторный запуск обновляет почту, а не создаёт дубли.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseArgs } from "node:util";

const USERS = {
  accountant: { id: "u-acc", name: "Гульмира Нурланова", role: "accountant" },
  owner: { id: "u-owner", name: "Ержан Сейткали", role: "owner" },
  employee: { id: "u-daniyar", name: "Данияр К.", role: "employee", employeeId: "daniyar" },
};
const COMPANY_ID = "tulpan";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const { values } = parseArgs({
  options: {
    accountant: { type: "string" },
    owner: { type: "string" },
    employee: { type: "string" },
  },
});

const given = Object.entries(values);
if (given.length === 0) {
  console.error("Укажите хотя бы одну роль: --accountant, --owner или --employee <почта>");
  process.exit(1);
}
for (const [, email] of given) {
  if (!EMAIL.test(email)) {
    console.error(`Не похоже на почту: ${email}`);
    process.exit(1);
  }
}

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error("Нет ключей Firebase: заполните .env.local");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

for (const [role, email] of given) {
  const { id, ...user } = USERS[role];
  await db
    .collection("users")
    .doc(id)
    .set({ ...user, contact: email.trim().toLowerCase(), companyId: COMPANY_ID, status: "active" });
  console.log(`${role}: ${email} → users/${id}`);
}
