BEGIN;

-- 기존 논문과 첨부 파일을 유지하며 선택 부제목을 추가합니다.
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS subtitle TEXT NOT NULL DEFAULT '';

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
    "researchQuestion" = p_input->>'researchQuestion', methods = p_input->>'methods',
    findings = p_input->>'findings', limitations = p_input->>'limitations',
    "meetingDate" = p_input->>'meetingDate', presenter = p_input->>'presenter', status = p_input->>'status',
    "updatedAt" = clock_timestamp(), revision = revision + 1
  WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id);
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION public.lab_edit_paper(TEXT, JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_edit_paper(TEXT, JSONB, INTEGER)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
