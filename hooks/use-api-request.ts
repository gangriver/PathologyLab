"use client";
import { useState, useRef } from "react";

export function useApiRequest() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function send<T>(url: string, method: string, body: unknown, timeoutMs = 15000): Promise<T | null> {
    if (busy.current) return null;
    busy.current = true; setPending(true); setError("");
    try {
      const multipart = body instanceof FormData;
      const response = await fetch(url, { method, headers: multipart ? undefined : { "Content-Type": "application/json" }, body: multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "요청을 처리하지 못했습니다.";
        setError(message); return null;
      }
      return result as T;
    } catch { setError("연결이 끊겼습니다. 저장 여부를 새로고침으로 확인한 뒤 다시 시도해주세요."); return null; }
    finally { busy.current = false; setPending(false); }
  }
  return { pending, error, send };
}
