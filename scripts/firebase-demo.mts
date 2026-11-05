/**
 * Копирует демо-компанию из мока («Кофейня «Тюльпан»», 6 сотрудников) в Firestore —
 * чтобы проверять экраны на базе. Реальные компании сюда не относятся.
 * Запуск: npm run firebase:demo            — если компании ещё нет
 *         npm run firebase:demo -- --force — стереть и записать заново
 *
 * Пользователи из мока добавляются, только если их ещё нет: почта, заданная
 * через npm run firebase:users, не перезаписывается.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseArgs } from "node:util";
import { seed } from "../src/lib/api/mock/seed";

const LISTS = ["employees", "absences", "contracts", "certificates"] as const;

const { values } = parseArgs({ options: { force: { type: "boolean", default: false } } });

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
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const state = seed();
const ref = db.collection("companies").doc(state.company.id);

if ((await ref.get()).exists) {
  if (!values.force) {
    console.error(`Компания ${state.company.id} уже есть. Чтобы записать заново: -- --force`);
    process.exit(1);
  }
  await db.recursiveDelete(ref);
}

const batch = db.batch();
batch.set(
  ref,
  plain({
    company: state.company,
    payrollStatus: state.payrollStatus,
    payrollTimestamps: state.payrollTimestamps,
    paidTaxes: state.paidTaxes,
    reports: state.reports,
    seq: state.seq,
  }),
);
for (const name of LISTS) {
  state[name].forEach(({ id, ...rest }, i) => {
    batch.set(ref.collection(name).doc(id), plain({ ...rest, _i: i }));
  });
}
await batch.commit();

let added = 0;
for (const { id, ...user } of state.users) {
  const userRef = db.collection("users").doc(id);
  if ((await userRef.get()).exists) continue;
  await userRef.set({ ...user, companyId: state.company.id });
  added += 1;
}

const counts = LISTS.map((name) => `${name}: ${state[name].length}`).join(", ");
console.log(`companies/${state.company.id} записана (${counts}); новых пользователей: ${added}`);
