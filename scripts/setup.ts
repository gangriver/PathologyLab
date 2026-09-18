import { existsSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { backup } from "node:sqlite";
import { needsPublicMigration, setupDatabase } from "../lib/setup-database";

async function main() {
  const envPath = resolve(".env.local");
  if (!existsSync(envPath)) {
    writeFileSync(envPath, [
      "APP_URL=http://127.0.0.1:3000",
      "DATABASE_PATH=./data/lab.sqlite",
      "OPENAI_API_KEY=",
      "OPENAI_MODEL=gpt-5-mini",
      "",
    ].join("\n"), { mode: 0o600 });
    console.log("로컬 환경 설정을 생성했습니다.");
  }
  process.loadEnvFile(envPath);
  const { db } = await import("../lib/db");
  if (needsPublicMigration(db)) {
    const backupPath = resolve(process.env.DATABASE_PATH!) + ".before-public-" + randomUUID() + ".sqlite";
    await backup(db, backupPath);
    console.log("기존 데이터베이스 백업을 생성했습니다: " + backupPath);
  }
  setupDatabase(db);
  console.log("공개 논문 데이터베이스 준비가 완료되었습니다.");
}
main().catch(() => { console.error("초기화에 실패했습니다. 환경 설정과 데이터베이스 경로를 확인해주세요."); process.exitCode = 1; });
