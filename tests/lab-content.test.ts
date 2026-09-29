import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contentSchemas,MAX_IMAGE_BYTES } from "../lib/lab-content-types";
import { detectImageType } from "../lib/lab-content";
import { setupDatabase } from "../lib/setup-database";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT0kAAAAASUVORK5CYII=","base64");
test("lab publication, project and gallery lifecycle",async t => {
  const directory = mkdtempSync(join(tmpdir(),"lab-content-"));
  process.env.DATABASE_PATH = join(directory,"test.sqlite");
  process.env.APP_URL = "http://localhost:3000";
  process.env.CLOUD_STORAGE = "0";
  const {db} = await import("../lib/db");
  setupDatabase(db);
  const content = await import("../lib/lab-content");
  const create = await import("../app/api/lab/[collection]/route");
  const mutate = await import("../app/api/lab/[collection]/[id]/route");
  const imageRoute = await import("../app/api/lab/gallery/[id]/image/route");
  const request = (body:unknown,method="POST",origin="http://localhost:3000") => new Request("http://localhost:3000/api/lab/publications",{method,headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
  try {
    await t.test("validation rejects scripts, invalid dates, wrong fields, and unsupported images",() => {
      assert.equal(contentSchemas.publications.safeParse({title:"Paper",year:"2026",url:"javascript:alert(1)"}).success,false);
      assert.equal(contentSchemas.publications.safeParse({title:"Paper",year:"2026",caption:"wrong collection"}).success,false);
      assert.equal(contentSchemas.projects.safeParse({title:"Study",startDate:"2026-99-99"}).success,false);
      assert.equal(contentSchemas.projects.safeParse({title:"Study",startDate:"2026-02-30"}).success,false);
      assert.equal(contentSchemas.projects.safeParse({title:"Study",startDate:"2026-12-01",endDate:"2026-01-01"}).success,false);
      assert.throws(() => detectImageType(Buffer.from("<svg><script/></svg>")));
      assert.throws(() => detectImageType(Buffer.alloc(MAX_IMAGE_BYTES+1)));
      assert.equal(detectImageType(png),"image/png");
    });
    await t.test("publication CRUD persists and refuses stale or cross-collection changes",async () => {
      const input = {title:"Lab paper",authors:"Researcher",journal:"Journal",year:"2026",url:"https://doi.org/10.1000/example"};
      assert.equal((await create.POST(request(input,"POST","https://untrusted.example"),{params:Promise.resolve({collection:"publications"})})).status,403);
      const response = await create.POST(request(input),{params:Promise.resolve({collection:"publications"})});
      assert.equal(response.status,201);
      const {id} = await response.json();
      const entry = await content.findEntry("publications",id);
      assert.equal(entry?.data.authors,"Researcher");
      assert.equal((await content.listEntries("projects")).length,0);
      const params = Promise.resolve({collection:"publications",id});
      const update = {data:{...input,title:"Revised paper"},revision:1};
      assert.equal((await mutate.PATCH(request(update,"PATCH"),{params})).status,200);
      assert.equal((await mutate.PATCH(request(update,"PATCH"),{params})).status,409);
      assert.equal((await mutate.DELETE(request({revision:2},"DELETE"),{params:Promise.resolve({collection:"projects",id})})).status,409);
      assert.equal((await mutate.DELETE(request({revision:1},"DELETE"),{params})).status,409);
      assert.equal((await content.findEntry("publications",id))?.data.title,"Revised paper");
      assert.equal((await mutate.DELETE(request({revision:2},"DELETE"),{params})).status,200);
      assert.equal(await content.findEntry("publications",id),undefined);
    });
    await t.test("project metadata and year ordering survive database reads",async () => {
      await content.createEntry("publications",contentSchemas.publications.parse({title:"Older",year:"2024"}));
      await content.createEntry("publications",contentSchemas.publications.parse({title:"Newer",year:"2026"}));
      assert.deepEqual((await content.listEntries("publications")).map(row => row.data.year),["2026","2024"]);
      const data = contentSchemas.projects.parse({title:"Current study",funder:"Foundation",grantNumber:"GRANT-1",startDate:"2026-01-01",endDate:"2027-12-31"});
      const {id} = await content.createEntry("projects",data);
      assert.deepEqual((await content.findEntry("projects",id))?.data,data);
    });
    await t.test("multipart photo upload serves exact bytes and deletes its local image",async () => {
      const upload = new FormData();
      upload.set("data",JSON.stringify({title:"Lab photo",caption:"Meeting",date:"2026-09-23"}));
      upload.set("image",new Blob([png],{type:"image/png"}),"photo.png");
      const response = await create.POST(new Request("http://localhost:3000/api/lab/gallery",{method:"POST",headers:{origin:"http://localhost:3000"},body:upload}),{params:Promise.resolve({collection:"gallery"})});
      assert.equal(response.status,201);
      const {id} = await response.json();
      const image = await imageRoute.GET(new Request(`http://localhost:3000/api/lab/gallery/${id}/image`),{params:Promise.resolve({id})});
      assert.equal(image.headers.get("content-type"),"image/png");
      assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
      await content.deleteEntry("gallery",id,1);
      assert.equal(db.prepare("SELECT count(*) AS n FROM lab_images").get()?.n,0);
      assert.equal((await imageRoute.GET(new Request(`http://localhost:3000/api/lab/gallery/${id}/image`),{params:Promise.resolve({id})})).status,404);
    });
    await t.test("cloud calls keep collection and revision boundaries; attached gallery images are preserved",async () => {
      process.env.CLOUD_STORAGE = "1";
      process.env.SUPABASE_URL = "https://lab-content-test.supabase.co";
      process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
      const calls:{url:URL;body:Record<string,unknown>|undefined;method:string}[] = [];
      let cleanup = false;
      const mock = t.mock.method(globalThis,"fetch",async (input: string | URL | Request,options:RequestInit={}) => {
        const url = new URL(String(input));
        calls.push({url,body:options.body ? JSON.parse(String(options.body)) : undefined,method:options.method ?? "GET"});
        if (cleanup && url.pathname.endsWith("/storage_cleanup") && options.method !== "DELETE") return Response.json([{storageKey:"gallery/attached-image"}]);
        if (cleanup && url.pathname.endsWith("/lab_entries")) return Response.json([{id:"attached-image"}]);
        return Response.json([]);
      });
      try {
        await content.updateEntry("projects","project-id",{title:"Changed"},5);
        assert.equal(calls[0].url.pathname,"/rest/v1/rpc/lab_update_entry");
        assert.deepEqual(calls[0].body,{p_collection:"projects",p_id:"project-id",p_data:{title:"Changed"},p_revision:5});
        await content.deleteEntry("publications","publication-id",7);
        assert.equal(calls[1].body?.p_revision,7);
        assert.equal(calls[1].body?.p_collection,"publications");
        cleanup = true;
        await (await import("../lib/storage-cleanup")).flushStorageCleanup();
        assert.ok(calls.some(call => call.url.searchParams.get("imageKey") === "eq.gallery/attached-image"));
        assert.equal(calls.at(-1)?.method,"DELETE");
        assert.equal(calls.at(-1)?.url.pathname,"/rest/v1/storage_cleanup");
      } finally {mock.mock.restore();process.env.CLOUD_STORAGE="0";}
    });
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});
