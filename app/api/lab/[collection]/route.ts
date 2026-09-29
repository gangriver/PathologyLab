import { z } from "zod";
import { apiResponse, readMutation } from "@/lib/api";
import { createEntry } from "@/lib/lab-content";
import { parseCollection, parseContent, readPhoto } from "@/lib/lab-content-request";
export const runtime = "nodejs";
export async function POST(request:Request,context:{params:Promise<{collection:string}>}) {
  return apiResponse(async () => {
    const collection = parseCollection((await context.params).collection);
    if (collection === "gallery") { const { data,image } = await readPhoto(request); return createEntry(collection,data,image); }
    const input = await readMutation(request,z.record(z.string(),z.unknown()));
    return createEntry(collection,parseContent(collection,input));
  },201,request);
}
