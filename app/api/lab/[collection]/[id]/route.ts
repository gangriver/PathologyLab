import { apiResponse, readMutation } from "@/lib/api";
import { deleteEntry, updateEntry } from "@/lib/lab-content";
import { entryDeleteSchema, entryMutationSchema, parseCollection, parseContent, parseId } from "@/lib/lab-content-request";
type Context = {params:Promise<{collection:string;id:string}>};
export const runtime = "nodejs";
export async function PATCH(request:Request,context:Context) {
  return apiResponse(async () => {
    const params = await context.params;
    const collection = parseCollection(params.collection);
    const input = await readMutation(request,entryMutationSchema);
    await updateEntry(collection,parseId(params.id),parseContent(collection,input.data),input.revision);
    return {success:true};
  },200,request);
}
export async function DELETE(request:Request,context:Context) {
  return apiResponse(async () => {
    const params = await context.params;
    const input = await readMutation(request,entryDeleteSchema);
    await deleteEntry(parseCollection(params.collection),parseId(params.id),input.revision);
    return {success:true};
  },200,request);
}
