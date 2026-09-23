BEGIN;

-- 기존 논문 식별자와 필드 이름을 유지해 자료를 이전할 수 있도록 합니다.
CREATE TABLE IF NOT EXISTS public.papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  authors TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  "referenceLinks" JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("referenceLinks") = 'array'),
  "researchQuestion" TEXT NOT NULL DEFAULT '',
  methods TEXT NOT NULL DEFAULT '',
  findings TEXT NOT NULL DEFAULT '',
  limitations TEXT NOT NULL DEFAULT '',
  "meetingDate" TEXT NOT NULL DEFAULT '',
  presenter TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'discussed')),
  "creatorName" TEXT NOT NULL DEFAULT '방문자',
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
);

ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS subtitle TEXT NOT NULL DEFAULT '';
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS "referenceLinks" JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("referenceLinks") = 'array');

CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY,
  "paperId" TEXT NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  "authorName" TEXT NOT NULL DEFAULT '방문자',
  content TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS comments_paper_idx ON public.comments ("paperId", "createdAt");
CREATE INDEX IF NOT EXISTS papers_meeting_idx ON public.papers ("meetingDate", "createdAt");

-- PDF 원본은 별도 파일 저장소에 두고 DB에는 저장 위치와 추출한 내용을 기록합니다.
CREATE TABLE IF NOT EXISTS public.paper_documents (
  id TEXT NOT NULL UNIQUE,
  "paperId" TEXT PRIMARY KEY REFERENCES public.papers(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "byteLength" BIGINT NOT NULL CHECK ("byteLength" > 0),
  "pagesJson" TEXT NOT NULL,
  "pageCount" INTEGER NOT NULL CHECK ("pageCount" > 0),
  "textCharacters" INTEGER NOT NULL CHECK ("textCharacters" >= 0),
  "uploadedAt" TIMESTAMPTZ NOT NULL
);

-- DB 변경 후 파일 삭제가 실패해도 다음 요청에서 다시 정리할 수 있도록 기록합니다.
CREATE TABLE IF NOT EXISTS public.storage_cleanup (
  "storageKey" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 브라우저의 직접 접근은 차단하고 서버에서만 데이터에 접근합니다.
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_cleanup ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.papers, public.comments, public.paper_documents, public.storage_cleanup
  FROM anon, authenticated, PUBLIC;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.papers, public.comments, public.paper_documents
  TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.storage_cleanup TO service_role;

-- 논문과 첨부 파일의 변경은 같은 트랜잭션에서 처리합니다.
CREATE OR REPLACE FUNCTION public.lab_edit_paper(p_id TEXT, p_input JSONB, p_revision INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  current_revision INTEGER;
BEGIN
  SELECT revision INTO current_revision FROM public.papers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'paper_not_found'; END IF;
  IF current_revision <> p_revision OR p_revision IS NULL THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'revision_conflict';
  END IF;
  UPDATE public.papers SET
    title = p_input->>'title', subtitle = COALESCE(p_input->>'subtitle', subtitle),
    authors = p_input->>'authors', url = p_input->>'url',
    "referenceLinks" = COALESCE(p_input->'referenceLinks', "referenceLinks"),
    "researchQuestion" = p_input->>'researchQuestion', methods = p_input->>'methods',
    findings = p_input->>'findings', limitations = p_input->>'limitations',
    "meetingDate" = p_input->>'meetingDate', presenter = p_input->>'presenter', status = p_input->>'status',
    "updatedAt" = clock_timestamp(), revision = revision + 1
  WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.lab_remove_paper(p_id TEXT, p_revision INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  current_revision INTEGER;
  previous_key TEXT;
BEGIN
  SELECT revision INTO current_revision FROM public.papers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'paper_not_found'; END IF;
  IF current_revision <> p_revision OR p_revision IS NULL THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'revision_conflict';
  END IF;
  SELECT "storageKey" INTO previous_key FROM public.paper_documents WHERE "paperId" = p_id;
  IF previous_key IS NOT NULL THEN
    INSERT INTO public.storage_cleanup ("storageKey") VALUES (previous_key) ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM public.papers WHERE id = p_id;
  RETURN jsonb_strip_nulls(jsonb_build_object('success', true, 'storageKey', previous_key));
END;
$$;

CREATE OR REPLACE FUNCTION public.lab_import_paper(p_input JSONB, p_document JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  document public.paper_documents;
  created_time TIMESTAMPTZ := clock_timestamp();
BEGIN
  document := jsonb_populate_record(NULL::public.paper_documents, p_document);
  INSERT INTO public.papers (
    id, title, subtitle, authors, url, "referenceLinks", "researchQuestion", methods, findings, limitations,
    "meetingDate", presenter, status, "createdAt", "updatedAt"
  ) VALUES (
    document."paperId", p_input->>'title', COALESCE(p_input->>'subtitle', ''), p_input->>'authors', p_input->>'url',
    COALESCE(p_input->'referenceLinks', '[]'::jsonb), p_input->>'researchQuestion',
    p_input->>'methods', p_input->>'findings', p_input->>'limitations', p_input->>'meetingDate',
    p_input->>'presenter', p_input->>'status', created_time, created_time
  );
  INSERT INTO public.paper_documents (
    id, "paperId", filename, "storageKey", "byteLength", "pagesJson", "pageCount", "textCharacters", "uploadedAt"
  ) VALUES (
    document.id, document."paperId", document.filename, document."storageKey", document."byteLength",
    document."pagesJson", document."pageCount", document."textCharacters", document."uploadedAt"
  );
  DELETE FROM public.storage_cleanup WHERE "storageKey" = document."storageKey";
  RETURN jsonb_build_object('id', document."paperId");
END;
$$;

CREATE OR REPLACE FUNCTION public.lab_replace_document(p_id TEXT, p_document JSONB, p_revision INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  current_revision INTEGER;
  previous_key TEXT;
  document public.paper_documents;
BEGIN
  document := jsonb_populate_record(NULL::public.paper_documents, p_document);
  IF document."paperId" IS DISTINCT FROM p_id THEN
    RAISE SQLSTATE 'PT422' USING MESSAGE = 'document_paper_mismatch';
  END IF;
  SELECT revision INTO current_revision FROM public.papers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'paper_not_found'; END IF;
  IF current_revision <> p_revision OR p_revision IS NULL THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'revision_conflict';
  END IF;
  SELECT "storageKey" INTO previous_key FROM public.paper_documents WHERE "paperId" = p_id;
  UPDATE public.papers SET revision = revision + 1, "updatedAt" = clock_timestamp() WHERE id = p_id;
  INSERT INTO public.paper_documents (
    id, "paperId", filename, "storageKey", "byteLength", "pagesJson", "pageCount", "textCharacters", "uploadedAt"
  ) VALUES (
    document.id, document."paperId", document.filename, document."storageKey", document."byteLength",
    document."pagesJson", document."pageCount", document."textCharacters", document."uploadedAt"
  ) ON CONFLICT ("paperId") DO UPDATE SET
    id = EXCLUDED.id, filename = EXCLUDED.filename, "storageKey" = EXCLUDED."storageKey", "byteLength" = EXCLUDED."byteLength",
    "pagesJson" = EXCLUDED."pagesJson", "pageCount" = EXCLUDED."pageCount", "textCharacters" = EXCLUDED."textCharacters",
    "uploadedAt" = EXCLUDED."uploadedAt";
  IF previous_key IS NOT NULL AND previous_key <> document."storageKey" THEN
    INSERT INTO public.storage_cleanup ("storageKey") VALUES (previous_key) ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM public.storage_cleanup WHERE "storageKey" = document."storageKey";
  RETURN jsonb_strip_nulls(jsonb_build_object('revision', p_revision + 1, 'previousStorageKey', previous_key));
END;
$$;

CREATE OR REPLACE FUNCTION public.lab_delete_document(p_id TEXT, p_revision INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  current_revision INTEGER;
  previous_key TEXT;
BEGIN
  SELECT revision INTO current_revision FROM public.papers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'paper_not_found'; END IF;
  IF current_revision <> p_revision OR p_revision IS NULL THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'revision_conflict';
  END IF;
  SELECT "storageKey" INTO previous_key FROM public.paper_documents WHERE "paperId" = p_id;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'document_not_found'; END IF;
  INSERT INTO public.storage_cleanup ("storageKey") VALUES (previous_key) ON CONFLICT DO NOTHING;
  UPDATE public.papers SET revision = revision + 1, "updatedAt" = clock_timestamp() WHERE id = p_id;
  DELETE FROM public.paper_documents WHERE "paperId" = p_id;
  RETURN jsonb_build_object('revision', p_revision + 1, 'storageKey', previous_key);
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION
  public.lab_edit_paper(TEXT, JSONB, INTEGER), public.lab_remove_paper(TEXT, INTEGER),
  public.lab_import_paper(JSONB, JSONB), public.lab_replace_document(TEXT, JSONB, INTEGER),
  public.lab_delete_document(TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.lab_edit_paper(TEXT, JSONB, INTEGER), public.lab_remove_paper(TEXT, INTEGER),
  public.lab_import_paper(JSONB, JSONB), public.lab_replace_document(TEXT, JSONB, INTEGER),
  public.lab_delete_document(TEXT, INTEGER)
  TO service_role;

COMMIT;
