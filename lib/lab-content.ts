import { randomUUID } from "node:crypto";
import { ApiError } from "./api";
import { isCloudStorageEnabled } from "./cloud-config";
import { supabaseRequest } from "./supabase";
import { MAX_IMAGE_BYTES, type Collection, type ContentData, type LabEntry } from "./lab-content-types";

export async function listEntries(collection: Collection): Promise<LabEntry[]> {
  const entries = isCloudStorageEnabled()
    ? await supabaseRequest<LabEntry[]>("lab_entries", { query: { collection: `eq.${collection}`, order: "createdAt.desc" } })
    : (await import("./lab-content-local")).listEntries(collection);
  return entries.sort((a,b) => collection === "publications" ? (b.data.year ?? "").localeCompare(a.data.year ?? "") : collection === "gallery" ? (b.data.date || b.createdAt).localeCompare(a.data.date || a.createdAt) : b.createdAt.localeCompare(a.createdAt));
}
export async function findEntry(collection: Collection, id: string): Promise<LabEntry | undefined> {
  if (!isCloudStorageEnabled()) return (await import("./lab-content-local")).findEntry(collection,id);
  return (await supabaseRequest<LabEntry[]>("lab_entries", { query: { collection: `eq.${collection}`, id: `eq.${id}`, limit: "1" } }))[0];
}
export function detectImageType(content: Uint8Array): string {
  const buffer = Buffer.from(content);
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new ApiError(413, "image_size");
  if (buffer.length > 8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (buffer.length > 12 && buffer.toString("ascii",0,4) === "RIFF" && buffer.toString("ascii",8,12) === "WEBP") return "image/webp";
  throw new ApiError(422, "image_type");
}
export async function createEntry(collection: Collection, data: ContentData, image?: Uint8Array) {
  if (collection === "gallery" && !image) throw new ApiError(422, "image_required");
  const id = randomUUID();
  const now = new Date().toISOString();
  const imageType = image ? detectImageType(image) : "";
  const entry: LabEntry = { id,collection,data,createdAt:now,updatedAt:now,revision:1,imageKey:image ? `gallery/${id}` : "",imageType };
  if (!isCloudStorageEnabled()) { (await import("./lab-content-local")).createEntry(entry,image); return { id }; }
  if (image) {
    // Queue before upload so interrupted requests can be cleaned up safely later.
    await (await import("./storage-cleanup")).scheduleStorageCleanup(entry.imageKey);
    await (await import("./r2")).putLabImage(entry.imageKey,image,imageType);
  }
  await supabaseRequest("lab_entries", { method:"POST",body:entry,prefer:"return=minimal" });
  // The cleanup worker checks whether the image is attached before removing it.
  await (await import("./storage-cleanup")).flushStorageCleanup();
  return { id };
}
export async function updateEntry(collection: Collection,id: string,data: ContentData,revision: number) {
  if (!isCloudStorageEnabled()) return (await import("./lab-content-local")).updateEntry(collection,id,data,revision);
  await supabaseRequest("rpc/lab_update_entry", { method:"POST",body:{p_collection:collection,p_id:id,p_data:data,p_revision:revision} });
}
export async function deleteEntry(collection: Collection,id: string,revision: number) {
  if (!isCloudStorageEnabled()) return (await import("./lab-content-local")).deleteEntry(collection,id,revision);
  await supabaseRequest("rpc/lab_delete_entry", { method:"POST",body:{p_collection:collection,p_id:id,p_revision:revision} });
  await (await import("./storage-cleanup")).flushStorageCleanup();
}
