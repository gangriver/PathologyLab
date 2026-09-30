


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."lab_delete_document"("p_id" "text", "p_revision" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."lab_delete_document"("p_id" "text", "p_revision" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lab_delete_entry"("p_collection" "text", "p_id" "text", "p_revision" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."lab_delete_entry"("p_collection" "text", "p_id" "text", "p_revision" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lab_edit_paper"("p_id" "text", "p_input" "jsonb", "p_revision" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."lab_edit_paper"("p_id" "text", "p_input" "jsonb", "p_revision" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lab_import_paper"("p_input" "jsonb", "p_document" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."lab_import_paper"("p_input" "jsonb", "p_document" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lab_remove_paper"("p_id" "text", "p_revision" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."lab_remove_paper"("p_id" "text", "p_revision" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lab_replace_document"("p_id" "text", "p_document" "jsonb", "p_revision" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."lab_replace_document"("p_id" "text", "p_document" "jsonb", "p_revision" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lab_update_entry"("p_collection" "text", "p_id" "text", "p_data" "jsonb", "p_revision" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  UPDATE public.lab_entries SET data=p_data,"updatedAt"=clock_timestamp(),revision=revision+1
  WHERE id=p_id AND collection=p_collection AND revision=p_revision;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='entry_conflict'; END IF;
  RETURN jsonb_build_object('id',p_id);
END;
$$;


ALTER FUNCTION "public"."lab_update_entry"("p_collection" "text", "p_id" "text", "p_data" "jsonb", "p_revision" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "text" NOT NULL,
    "paperId" "text" NOT NULL,
    "authorName" "text" DEFAULT '방문자'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_entries" (
    "id" "text" NOT NULL,
    "collection" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "revision" integer DEFAULT 1 NOT NULL,
    "imageKey" "text" DEFAULT ''::"text" NOT NULL,
    "imageType" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "lab_entries_collection_check" CHECK (("collection" = ANY (ARRAY['publications'::"text", 'projects'::"text", 'gallery'::"text"]))),
    CONSTRAINT "lab_entries_data_check" CHECK (("jsonb_typeof"("data") = 'object'::"text")),
    CONSTRAINT "lab_entries_revision_check" CHECK (("revision" > 0))
);


ALTER TABLE "public"."lab_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."paper_documents" (
    "id" "text" NOT NULL,
    "paperId" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "storageKey" "text" NOT NULL,
    "byteLength" bigint NOT NULL,
    "pagesJson" "text" NOT NULL,
    "pageCount" integer NOT NULL,
    "textCharacters" integer NOT NULL,
    "uploadedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "paper_documents_byteLength_check" CHECK (("byteLength" > 0)),
    CONSTRAINT "paper_documents_pageCount_check" CHECK (("pageCount" > 0)),
    CONSTRAINT "paper_documents_textCharacters_check" CHECK (("textCharacters" >= 0))
);


ALTER TABLE "public"."paper_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."papers" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "authors" "text" DEFAULT ''::"text" NOT NULL,
    "url" "text" DEFAULT ''::"text" NOT NULL,
    "researchQuestion" "text" DEFAULT ''::"text" NOT NULL,
    "methods" "text" DEFAULT ''::"text" NOT NULL,
    "findings" "text" DEFAULT ''::"text" NOT NULL,
    "limitations" "text" DEFAULT ''::"text" NOT NULL,
    "meetingDate" "text" DEFAULT ''::"text" NOT NULL,
    "presenter" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "creatorName" "text" DEFAULT '방문자'::"text" NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "revision" integer DEFAULT 1 NOT NULL,
    "subtitle" "text" DEFAULT ''::"text" NOT NULL,
    "referenceLinks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "papers_referenceLinks_check" CHECK (("jsonb_typeof"("referenceLinks") = 'array'::"text")),
    CONSTRAINT "papers_revision_check" CHECK (("revision" > 0)),
    CONSTRAINT "papers_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'discussed'::"text"])))
);


ALTER TABLE "public"."papers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_cleanup" (
    "storageKey" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."storage_cleanup" OWNER TO "postgres";


ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_entries"
    ADD CONSTRAINT "lab_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paper_documents"
    ADD CONSTRAINT "paper_documents_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."paper_documents"
    ADD CONSTRAINT "paper_documents_pkey" PRIMARY KEY ("paperId");



ALTER TABLE ONLY "public"."paper_documents"
    ADD CONSTRAINT "paper_documents_storageKey_key" UNIQUE ("storageKey");



ALTER TABLE ONLY "public"."papers"
    ADD CONSTRAINT "papers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_cleanup"
    ADD CONSTRAINT "storage_cleanup_pkey" PRIMARY KEY ("storageKey");



CREATE INDEX "comments_paper_idx" ON "public"."comments" USING "btree" ("paperId", "createdAt");



CREATE INDEX "lab_entries_collection_idx" ON "public"."lab_entries" USING "btree" ("collection", "createdAt");



CREATE INDEX "papers_meeting_idx" ON "public"."papers" USING "btree" ("meetingDate", "createdAt");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "public"."papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."paper_documents"
    ADD CONSTRAINT "paper_documents_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "public"."papers"("id") ON DELETE CASCADE;



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."paper_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."papers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."storage_cleanup" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."lab_delete_document"("p_id" "text", "p_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lab_delete_document"("p_id" "text", "p_revision" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lab_delete_entry"("p_collection" "text", "p_id" "text", "p_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lab_delete_entry"("p_collection" "text", "p_id" "text", "p_revision" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lab_edit_paper"("p_id" "text", "p_input" "jsonb", "p_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lab_edit_paper"("p_id" "text", "p_input" "jsonb", "p_revision" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lab_import_paper"("p_input" "jsonb", "p_document" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lab_import_paper"("p_input" "jsonb", "p_document" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lab_remove_paper"("p_id" "text", "p_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lab_remove_paper"("p_id" "text", "p_revision" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lab_replace_document"("p_id" "text", "p_document" "jsonb", "p_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lab_replace_document"("p_id" "text", "p_document" "jsonb", "p_revision" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lab_update_entry"("p_collection" "text", "p_id" "text", "p_data" "jsonb", "p_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lab_update_entry"("p_collection" "text", "p_id" "text", "p_data" "jsonb", "p_revision" integer) TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."lab_entries" TO "service_role";



GRANT ALL ON TABLE "public"."paper_documents" TO "service_role";



GRANT ALL ON TABLE "public"."papers" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."storage_cleanup" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";
