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
- Supabase 운영 DB에는 이 기능의 SQL이 적용되어 있습니다. 새 DB 변경은 `supabase/migrations/`에 추가하고 [공통 배포 절차](deployment.md)를 따릅니다. 예전 `db/migrations/` SQL을 다시 실행하지 마세요.
- 새 Supabase 환경의 스키마는 `supabase/migrations/`의 기준 파일부터 순서대로 구성합니다.
- Gallery images use the existing R2 account and bucket when `CLOUD_STORAGE=1`, under `gallery/`. Local installations store images in SQLite.
- Keep `APP_URL` set to the site's actual origin, as for the existing paper forms.

No papers, project descriptions, or photos are seeded. Empty sections invite the first entry.

## Where to edit text

- Existing home-page copy: `lib/i18n-site.ts`
- Member profiles: `lib/lab.ts`
- Navigation labels: `lib/i18n.ts`
- New section headings, form labels, and descriptions: `lib/lab-content-copy.ts`
