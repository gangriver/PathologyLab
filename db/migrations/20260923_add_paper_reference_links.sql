BEGIN;

-- 기존 논문은 빈 목록으로 유지하며 참고 링크를 추가합니다.
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS "referenceLinks" JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("referenceLinks") = 'array');

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

REVOKE ALL PRIVILEGES ON FUNCTION public.lab_edit_paper(TEXT, JSONB, INTEGER), public.lab_import_paper(JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_edit_paper(TEXT, JSONB, INTEGER), public.lab_import_paper(JSONB, JSONB)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
