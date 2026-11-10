import "server-only";
import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  QuerySnapshot,
  Transaction,
} from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { parseLoginContact } from "@/lib/validation/contact";
import type { CompanyUser } from "../contracts";
import type { MockDb } from "../mock/seed";

/*
 * Данные компании в Firestore.
 *
 * companies/{companyId}                — company, payrollStatus, payrollTimestamps,
 *                                        paidTaxes, reports, seq
 * companies/{companyId}/employees/{id} — сотрудники (и absences, contracts, certificates)
 * users/{userId}                       — пользователи всех компаний (по ним идёт вход;
 *                                        passwordHash пишется только в firebase/index.ts)
 *
 * Загружаем компанию целиком в форму MockDb, выполняем логику мока и
 * сохраняем только изменившиеся документы. Порядок в списках — поле _i.
 */

const LISTS = ["employees", "absences", "contracts", "certificates"] as const;
type ListName = (typeof LISTS)[number];
type Item = { id: string };

/** Firestore не принимает undefined — убираем, как JSON. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface Loaded {
  state: MockDb;
  /** id пользователя в состоянии → id документа в users */
  userDocs: Map<string, string>;
}

function companyRef(store: Firestore, companyId: string): DocumentReference {
  return store.collection("companies").doc(companyId);
}

/**
 * Загрузить компанию. С транзакцией — для изменений (чтение под блокировкой),
 * без неё — для чтения: заметно быстрее и не блокирует параллельные запросы.
 */
export async function loadCompany(
  tx: Transaction | null,
  companyId: string,
): Promise<Loaded | null> {
  const store = db();
  const ref = companyRef(store, companyId);
  const users = store.collection("users").where("companyId", "==", companyId);
  const lists = LISTS.map((name) => ref.collection(name).orderBy("_i"));
  const [root, usersSnap, ...listSnaps] = await Promise.all(
    tx
      ? [tx.get(ref), tx.get(users), ...lists.map((q) => tx.get(q))]
      : [ref.get(), users.get(), ...lists.map((q) => q.get())],
  );
  if (!(root as DocumentSnapshot).exists) return null;

  const userDocs = new Map<string, string>();
  const people: CompanyUser[] = [];
  for (const doc of (usersSnap as QuerySnapshot).docs) {
    const u = doc.data();
    userDocs.set(doc.id, doc.id);
    // passwordHash в состояние не попадает — наружу уходят только эти поля
    people.push({
      id: doc.id,
      name: u.name,
      contact: u.contact,
      role: u.role,
      ...(u.employeeId ? { employeeId: u.employeeId } : {}),
      status: u.status,
    });
  }
  people.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const data = (root as DocumentSnapshot).data()!;
  const state = { ...data, firstPeriod: data.firstPeriod ?? "2026-01", users: people } as MockDb;
  LISTS.forEach((name, i) => {
    (state as unknown as Record<ListName, Item[]>)[name] = (listSnaps[i] as QuerySnapshot).docs.map(
      (doc) => {
        const { _i, ...item } = doc.data();
        void _i;
        return { ...item, id: doc.id };
      },
    );
  });
  return { state, userDocs };
}

/** Снимок для сравнения «до/после». */
export function snapshot(state: MockDb): string {
  return JSON.stringify(state);
}

export function saveCompany(
  tx: Transaction,
  companyId: string,
  loaded: Loaded,
  beforeJson: string,
): void {
  const store = db();
  const ref = companyRef(store, companyId);
  const before = JSON.parse(beforeJson) as MockDb;
  const after = loaded.state;

  const rootOf = (s: MockDb) => ({
    firstPeriod: s.firstPeriod,
    company: s.company,
    payrollStatus: s.payrollStatus,
    payrollTimestamps: s.payrollTimestamps,
    paidTaxes: s.paidTaxes,
    reports: s.reports,
    seq: s.seq,
  });
  if (JSON.stringify(rootOf(before)) !== JSON.stringify(rootOf(after))) {
    tx.set(ref, plain(rootOf(after)));
  }

  for (const name of LISTS) saveList(tx, ref, name, before[name], after[name]);
  saveUsers(tx, store, companyId, loaded.userDocs, before.users, after.users);
}

function saveList(
  tx: Transaction,
  ref: DocumentReference,
  name: ListName,
  before: Item[],
  after: Item[],
): void {
  const old = new Map(before.map((item, i) => [item.id, JSON.stringify({ ...item, _i: i })]));
  after.forEach((item, i) => {
    const json = JSON.stringify({ ...item, _i: i });
    if (old.get(item.id) !== json) {
      const { id, ...rest } = item;
      tx.set(ref.collection(name).doc(id), plain({ ...rest, _i: i }));
    }
    old.delete(item.id);
  });
  for (const id of old.keys()) tx.delete(ref.collection(name).doc(id));
}

function saveUsers(
  tx: Transaction,
  store: Firestore,
  companyId: string,
  userDocs: Map<string, string>,
  before: CompanyUser[],
  after: CompanyUser[],
): void {
  const old = new Map(before.map((u) => [u.id, JSON.stringify(u)]));
  for (const user of after) {
    if (old.get(user.id) === JSON.stringify(user)) continue;
    // Новый пользователь: id из мока уникален только внутри компании
    const docId = userDocs.get(user.id) ?? `${companyId}-${user.id}`;
    const contact = parseLoginContact(user.contact)?.value ?? user.contact;
    tx.set(
      store.collection("users").doc(docId),
      plain({
        name: user.name,
        contact,
        role: user.role,
        employeeId: user.employeeId,
        status: user.status,
        companyId,
      }),
      { merge: true },
    );
  }
}
