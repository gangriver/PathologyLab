import { ApiError } from "./api";

type Resource = "papers" | "comments" | "paper_documents" | "storage_cleanup"
  | "rpc/lab_edit_paper" | "rpc/lab_remove_paper" | "rpc/lab_import_paper"
  | "rpc/lab_replace_document" | "rpc/lab_delete_document";
type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
  prefer?: "return=minimal";
};

export async function supabaseRequest<T>(resource: Resource, options: RequestOptions = {}): Promise<T> {
  let base: URL;
  try { base = new URL(process.env.SUPABASE_URL ?? ""); }
  catch { throw new ApiError(503, "데이터베이스 연결 설정을 확인해주세요."); }
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (base.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname)
    || base.username || base.password || base.port || base.pathname !== "/" || base.search || base.hash
    || !secretKey?.startsWith("sb_secret_") || secretKey.length <= "sb_secret_".length) {
    throw new ApiError(503, "데이터베이스 연결 설정을 확인해주세요.");
  }
  const url = new URL(`/rest/v1/${resource}`, base);
  url.search = new URLSearchParams(options.query).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        apikey: secretKey,
        "Content-Type": "application/json",
        ...(options.prefer ? { Prefer: options.prefer } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(503, "데이터베이스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  let data: unknown;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(502, "데이터베이스 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  if (!response.ok) {
    const error = data && typeof data === "object" ? data as { code?: unknown; message?: unknown } : undefined;
    if (error?.code === "PT404") {
      throw new ApiError(404, error.message === "document_not_found" ? "첨부된 PDF가 없습니다." : "논문을 찾을 수 없습니다.");
    }
    if (error?.code === "PT409") throw new ApiError(409, "논문이 변경되었습니다. 새로고침 후 다시 시도해주세요.");
    if (error?.code === "23503") throw new ApiError(404, "논문을 찾을 수 없습니다.");
    if (error?.code === "23505") throw new ApiError(409, "이미 처리된 자료입니다. 새로고침 후 확인해주세요.");
    if (error?.code === "PT422") throw new ApiError(422, "저장할 논문과 PDF 정보를 확인해주세요.");
    throw new ApiError(503, "데이터베이스 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  return data as T;
}
