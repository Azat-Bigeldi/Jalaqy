/**
 * Управление компаниями и входом в Firestore (ключи — из .env.local).
 *
 *   npm run admin -- company  --company "ТОО Ромашка" --name "Айгуль Сапарова" --login buh@mail.kz --password "…" [--role accountant|owner]
 *       Новая пустая компания и её первый пользователь. После входа бухгалтер
 *       заполнит БИН, режим и сотрудников (онбординг).
 *
 *   npm run admin -- user     --company-id <id> --name "…" --login … --password "…" [--role accountant|owner]
 *       Ещё один пользователь в компании (то же можно сделать в «Настройках»).
 *
 *   npm run admin -- password --login … --password "…"
 *       Новый пароль пользователю (если забыл).
 *
 *   npm run admin -- list
 *       Компании и пользователи.
 *
 *   npm run admin -- wipe --yes
 *       Стереть ВСЕ компании, пользователей и служебные записи входа. Необратимо.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { emptyCompany } from "../src/lib/api/mock/seed";
import { hashPassword, isPasswordOk, PASSWORD_MIN } from "../src/lib/password";
import { parseLoginContact } from "../src/lib/validation/contact";

const STAFF = ["accountant", "owner"] as const;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    company: { type: "string" },
    "company-id": { type: "string" },
    name: { type: "string" },
    login: { type: "string" },
    password: { type: "string" },
    role: { type: "string", default: "accountant" },
    yes: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  fail("Нет ключей Firebase: заполните .env.local");
}
initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

/** Текущий месяц по времени Казахстана: с него начинается история расчётов. */
function currentPeriod(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

function needLogin(): string {
  const parsed = parseLoginContact(values.login ?? "");
  if (!parsed) fail("--login: почта или телефон +7 7XX XXX XX XX");
  return parsed.value;
}

function needPassword(): string {
  const password = values.password ?? "";
  if (!isPasswordOk(password)) fail(`--password: не короче ${PASSWORD_MIN} символов`);
  return password;
}

function needRole(): (typeof STAFF)[number] {
  const role = values.role as (typeof STAFF)[number];
  if (!STAFF.includes(role)) fail("--role: accountant или owner");
  return role;
}

async function loginTaken(contact: string): Promise<boolean> {
  const snap = await db.collection("users").where("contact", "==", contact).limit(1).get();
  return !snap.empty;
}

async function addUser(companyId: string, name: string, contact: string, password: string) {
  const role = needRole();
  const id = `${companyId}-u${randomBytes(4).toString("hex")}`;
  await db
    .collection("users")
    .doc(id)
    .set({
      name,
      contact,
      role,
      companyId,
      status: "invited",
      passwordHash: await hashPassword(password),
    });
  console.log(
    `✓ ${role === "owner" ? "Владелец" : "Бухгалтер"} ${name}: логин ${contact} (users/${id})`,
  );
}

async function deleteDeep(ref: DocumentReference) {
  for (const sub of await ref.listCollections()) {
    const docs = await sub.listDocuments();
    for (const doc of docs) await deleteDeep(doc);
  }
  await ref.delete();
}

const command = positionals[0];

if (command === "company") {
  const title = values.company?.trim() || fail("--company: название компании");
  const name = values.name?.trim() || fail("--name: имя первого пользователя");
  const contact = needLogin();
  const password = needPassword();
  needRole();
  if (await loginTaken(contact)) fail(`Логин ${contact} уже занят`);

  const id = `c${randomBytes(5).toString("hex")}`;
  const { users, employees, absences, contracts, certificates, ...root } = emptyCompany(
    id,
    title,
    currentPeriod(),
  );
  void users;
  void employees;
  void absences;
  void contracts;
  void certificates;
  await db.collection("companies").doc(id).set(root);
  console.log(`✓ Компания «${title}» (companies/${id}), расчёт с ${root.firstPeriod}`);
  await addUser(id, name, contact, password);
} else if (command === "user") {
  const companyId = values["company-id"] ?? fail("--company-id: id компании (см. list)");
  if (!(await db.collection("companies").doc(companyId).get()).exists) {
    fail(`Нет компании ${companyId}`);
  }
  const name = values.name?.trim() || fail("--name: имя");
  const contact = needLogin();
  const password = needPassword();
  if (await loginTaken(contact)) fail(`Логин ${contact} уже занят`);
  await addUser(companyId, name, contact, password);
} else if (command === "password") {
  const contact = needLogin();
  const password = needPassword();
  const snap = await db.collection("users").where("contact", "==", contact).limit(1).get();
  const doc = snap.docs[0] ?? fail(`Нет пользователя с логином ${contact}`);
  await doc.ref.update({ passwordHash: await hashPassword(password) });
  console.log(`✓ Пароль для ${contact} изменён`);
} else if (command === "list") {
  const [companies, users] = await Promise.all([
    db.collection("companies").get(),
    db.collection("users").get(),
  ]);
  if (companies.empty) console.log("Компаний нет.");
  for (const c of companies.docs) {
    const data = c.data();
    const staff = (await c.ref.collection("employees").count().get()).data().count;
    console.log(`\n${data.company?.name} — companies/${c.id}, сотрудников: ${staff}`);
    for (const u of users.docs.filter((u) => u.data().companyId === c.id)) {
      const x = u.data();
      console.log(`   ${x.role.padEnd(10)} ${x.name} — ${x.contact} (${x.status})`);
    }
  }
  const orphans = users.docs.filter(
    (u) => !companies.docs.some((c) => c.id === u.data().companyId),
  );
  for (const u of orphans) console.log(`! пользователь без компании: users/${u.id}`);
} else if (command === "wipe") {
  if (!values.yes) fail("Это сотрёт ВСЕ данные в Firestore. Повторите с --yes");
  for (const name of ["companies", "users", "loginAttempts", "loginCodes"]) {
    const docs = await db.collection(name).listDocuments();
    for (const doc of docs) await deleteDeep(doc);
    console.log(`✓ ${name}: удалено ${docs.length}`);
  }
} else {
  fail(
    "Команда: company | user | password | list | wipe (подробности — в начале scripts/admin.mts)",
  );
}
