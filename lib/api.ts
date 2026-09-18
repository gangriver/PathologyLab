import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function assertMutationOrigin(request: Request) {
  const expectedOrigin = process.env.APP_URL || process.env.BETTER_AUTH_URL;
  if (!expectedOrigin || request.headers.get("origin") !== new URL(expectedOrigin).origin) throw new ApiError(403, "요청 출처를 확인할 수 없습니다.");
}
export async function readMutation<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  assertMutationOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "올바른 형식으로 요청해주세요.");
  if (Number(request.headers.get("content-length") ?? 0) > 250000) throw new ApiError(413, "입력 내용이 너무 깁니다.");
  const raw = await request.text();
  if (raw.length > 100000) throw new ApiError(413, "입력 내용이 너무 깁니다.");
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new ApiError(400, "입력 내용을 확인해주세요."); }
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError(422, result.error.issues[0]?.message ?? "입력 내용을 확인해주세요.");
  return result.data;
}
export async function apiResponse(operation: () => Promise<unknown>, status = 200) {
  try { return NextResponse.json(await operation(), { status, headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("요청 처리 중 오류가 발생했습니다.");
    return NextResponse.json({ error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
