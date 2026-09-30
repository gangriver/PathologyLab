# 공통 배포 규칙

- 운영 배포는 `.github/workflows/deploy-production.yml`로 실행한다. 코드 검증과 빌드, HTTP 검증, Supabase SQL 적용이 모두 성공해야 Vercel에 배포한다.
- DB 변경은 `supabase/migrations/`에 `YYYYMMDDHHMMSS_설명.sql` 형식의 새 파일로 추가한다. UTC 기준으로 기존 파일보다 큰 고유 버전을 사용하고, 이미 적용된 SQL 파일은 수정하거나 삭제하지 않는다.
- `20260930000000_baseline.sql`은 기존 운영 DB의 기준 구조다. 기존 DB에 수동으로 다시 실행하지 않는다. `db/supabase.sql`과 `db/migrations/`는 자동화 이전의 참고 자료이며 새 변경은 이곳에 추가하지 않는다.
- 새 SQL은 현재 운영 중인 코드와도 호환되도록 작성한다. 삭제·데이터 손실을 일으키는 변경은 사용자 확인 없이 실행하지 않는다.
- 명시적인 요청 없이 커밋·푸시하지 않는다. `main` 직접 푸시와 강제 푸시는 하지 않는다.
- 운영 배포를 요청받으면 검증 후 운영 브랜치에 반영하고 GitHub Actions의 최종 결과를 확인한다. SQL 단계를 건너뛰는 별도 Vercel 배포는 하지 않는다.
- 시크릿은 GitHub Actions Secrets와 Vercel 환경변수로 관리한다. `.env*`, 인증 정보, 운영 환경 파일을 커밋하거나 로그에 출력하지 않는다.
- 검증 결과와 남은 작업을 한국어로 간결하게 보고한다.
