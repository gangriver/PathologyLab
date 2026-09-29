import { z } from "zod";
import { ApiError, assertMutationOrigin } from "./api";
import { contentSchemas, isCollection, MAX_IMAGE_BYTES, type Collection, type ContentData } from "./lab-content-types";

export function parseCollection(value: string): Collection {
  if (!isCollection(value)) throw new ApiError(404, "collection_not_found");
  return value;
}
export function parseId(value: string) {
  if (!z.uuid().safeParse(value).success) throw new ApiError(404,"entry_not_found");
  return value;
}
export const entryMutationSchema = z.object({ data: z.record(z.string(),z.unknown()), revision:z.number().int().positive() }).strict();
export const entryDeleteSchema = z.object({ revision:z.number().int().positive() }).strict();
export function parseContent(collection: Collection,input: unknown): ContentData {
  const result = contentSchemas[collection].safeParse(input);
  if (!result.success) throw new ApiError(422,"invalid_entry");
  return result.data;
}
export async function readPhoto(request: Request) {
  assertMutationOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new ApiError(415,"invalid_form");
  // Bound actual streamed bytes, including when Content-Length is absent or forged.
  const limit = MAX_IMAGE_BYTES + 100000;
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new ApiError(413,"image_size");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(422,"image_required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done,value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new ApiError(413,"image_size");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  const form = await new Response(Buffer.concat(chunks),{headers:{"Content-Type":request.headers.get("content-type")!}}).formData();
  const file = form.get("image");
  if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES) throw new ApiError(422,"image_required");
  let input: unknown;
  try { input = JSON.parse(String(form.get("data"))); } catch { throw new ApiError(422,"invalid_entry"); }
  return { data:parseContent("gallery",input), image:new Uint8Array(await file.arrayBuffer()) };
}
