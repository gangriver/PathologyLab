import { db } from "./db";
import { ApiError } from "./api";
import type { Collection, ContentData, LabEntry } from "./lab-content-types";

function read(row: Record<string, unknown>): LabEntry { return { ...row, data: JSON.parse(String(row.data)) } as LabEntry; }
export function listEntries(collection: Collection) {
  return db.prepare("SELECT * FROM lab_entries WHERE collection=? ORDER BY createdAt DESC").all(collection).map(read);
}
export function findEntry(collection: Collection, id: string) {
  const row = db.prepare("SELECT * FROM lab_entries WHERE collection=? AND id=?").get(collection, id);
  return row ? read(row) : undefined;
}
export function createEntry(entry: LabEntry, image?: Uint8Array) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO lab_entries (id,collection,data,createdAt,updatedAt,revision,imageKey,imageType) VALUES (?,?,?,?,?,?,?,?)").run(entry.id,entry.collection,JSON.stringify(entry.data),entry.createdAt,entry.updatedAt,entry.revision,entry.imageKey,entry.imageType);
    if (image) db.prepare("INSERT INTO lab_images (entryId,content) VALUES (?,?)").run(entry.id,image);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function updateEntry(collection: Collection, id: string, data: ContentData, revision: number) {
  const result = db.prepare("UPDATE lab_entries SET data=?,updatedAt=?,revision=revision+1 WHERE id=? AND collection=? AND revision=?").run(JSON.stringify(data),new Date().toISOString(),id,collection,revision);
  if (!result.changes) throw new ApiError(409, "entry_conflict");
}
export function deleteEntry(collection: Collection, id: string, revision: number) {
  const result = db.prepare("DELETE FROM lab_entries WHERE id=? AND collection=? AND revision=?").run(id,collection,revision);
  if (!result.changes) throw new ApiError(409, "entry_conflict");
}
export function getImage(id: string) { return db.prepare("SELECT content FROM lab_images WHERE entryId=?").get(id)?.content as Uint8Array | undefined; }
