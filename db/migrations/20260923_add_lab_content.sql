BEGIN;
CREATE TABLE IF NOT EXISTS public.lab_entries (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL CHECK(collection IN ('publications','projects','gallery')),
  data JSONB NOT NULL CHECK(jsonb_typeof(data) = 'object'),
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  "imageKey" TEXT NOT NULL DEFAULT '',
  "imageType" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS lab_entries_collection_idx ON public.lab_entries(collection,"createdAt");
ALTER TABLE public.lab_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.lab_entries FROM anon, authenticated, PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.lab_entries TO service_role;

CREATE OR REPLACE FUNCTION public.lab_update_entry(p_collection TEXT,p_id TEXT,p_data JSONB,p_revision INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.lab_entries SET data=p_data,"updatedAt"=clock_timestamp(),revision=revision+1
  WHERE id=p_id AND collection=p_collection AND revision=p_revision;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='entry_conflict'; END IF;
  RETURN jsonb_build_object('id',p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.lab_delete_entry(p_collection TEXT,p_id TEXT,p_revision INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE image_key TEXT;
BEGIN
  DELETE FROM public.lab_entries WHERE id=p_id AND collection=p_collection AND revision=p_revision RETURNING "imageKey" INTO image_key;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='entry_conflict'; END IF;
  IF image_key <> '' THEN
    INSERT INTO public.storage_cleanup ("storageKey") VALUES(image_key) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('success',true);
END;
$$;
REVOKE ALL PRIVILEGES ON FUNCTION public.lab_update_entry(TEXT,TEXT,JSONB,INTEGER),public.lab_delete_entry(TEXT,TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_update_entry(TEXT,TEXT,JSONB,INTEGER),public.lab_delete_entry(TEXT,TEXT,INTEGER) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
