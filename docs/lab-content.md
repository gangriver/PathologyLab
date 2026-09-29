# Publications, projects, and photos

The main navigation and home page link to three independent sections:

| Section | Address | Content |
| --- | --- | --- |
| Lab Publications | `/publications` | Lab-authored papers, authors, journal, year, DOI / URL, and summary |
| Ongoing Research Projects | `/projects` | Current projects, researchers, funding agency, grant number, dates, and related URL |
| Gallery | `/gallery` | JPG, PNG, or WebP photos up to 3 MB, with a title, caption, and photo date |

Use the add button in each section. Entries can be edited or deleted from their cards. To replace a gallery image, upload a new entry and remove the old one. The existing `/papers` journal-club archive remains separate. Display controls and forms support Korean and English; entered research content is shown in its original language.

These sections follow the existing site's open editing model: visitors can add, edit, and delete entries without signing in. Updates and deletes use revision checks, so a stale page cannot silently overwrite a newer edit.

## Deployment

- Local SQLite: run `npm run setup` once to add the new tables. Existing tables and records remain intact.
- Existing Supabase installation: run `db/migrations/20260923_add_lab_content.sql` in its SQL editor **before deploying the code**. This adds a table and two server-only RPC functions; it does not modify existing paper data.
- New Supabase installation: `db/supabase.sql` includes this migration.
- Gallery images use the existing R2 account and bucket when `CLOUD_STORAGE=1`, under `gallery/`. Local installations store images in SQLite.
- Keep `APP_URL` set to the site's actual origin, as for the existing paper forms.

No papers, project descriptions, or photos are seeded. Empty sections invite the first entry.

## Where to edit text

- Existing home-page copy: `lib/i18n-site.ts`
- Member profiles: `lib/lab.ts`
- Navigation labels: `lib/i18n.ts`
- New section headings, form labels, and descriptions: `lib/lab-content-copy.ts`
