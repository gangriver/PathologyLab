import { ApiError,apiResponse } from "@/lib/api";
import { findEntry } from "@/lib/lab-content";
import { parseId } from "@/lib/lab-content-request";
import { isCloudStorageEnabled } from "@/lib/cloud-config";
export const runtime = "nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const id = parseId((await context.params).id);
    const entry = await findEntry("gallery",id);
    if (!entry?.imageType) throw new ApiError(404,"image_not_found");
    if (isCloudStorageEnabled()) {
      const url = await (await import("@/lib/r2")).getLabImageUrl(entry.imageKey,entry.imageType);
      return new Response(null,{status:302,headers:{Location:url,"Cache-Control":"no-store"}});
    }
    const content = (await import("@/lib/lab-content-local")).getImage(id);
    if (!content) throw new ApiError(404,"image_not_found");
    return new Response(Buffer.from(content),{headers:{"Content-Type":entry.imageType,"Content-Disposition":"inline","X-Content-Type-Options":"nosniff","Cache-Control":"no-store"}});
  } catch (error) { return apiResponse(async () => {throw error;},200,request); }
}
