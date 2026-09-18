import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databasePath = process.env.DATABASE_PATH;
if (!databasePath) throw new Error("DATABASE_PATH 설정이 필요합니다.");
const path = resolve(databasePath);
mkdirSync(dirname(path), { recursive: true });
const globalDatabase = globalThis as typeof globalThis & { labDatabase?: DatabaseSync };
export const db = globalDatabase.labDatabase ?? new DatabaseSync(path);
db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
if (process.env.NODE_ENV !== "production") globalDatabase.labDatabase = db;
