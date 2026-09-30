# 공통 SQL 적용과 배포

사용자와 교수님 모두 같은 저장소의 배포 자동화를 사용합니다. 각 컴퓨터에 DB 비밀번호나 Vercel 토큰을 따로 저장할 필요가 없습니다. GitHub 저장소의 쓰기 권한과 Codex의 저장소 접근 권한은 필요합니다.

운영 브랜치 `codex/initial-homepage`에 변경이 반영되면 GitHub Actions의 **운영 배포**가 다음 순서로 실행됩니다.

1. 의존성 설치, 코드 검사, 테스트
2. Vercel 운영 환경으로 빌드, 타입 검사, 로컬 HTTP 검증
3. 아직 적용하지 않은 Supabase SQL 실행
4. 검증한 빌드를 Vercel에 배포하고 운영 홈페이지와 논문 목록 조회 확인

앞 단계가 실패하면 다음 단계는 실행하지 않습니다. Vercel의 운영 브랜치 Git 자동 배포는 꺼 두어 SQL 적용 단계를 건너뛰지 않도록 했습니다. 동시에 배포를 요청해도 진행 중인 작업은 취소하지 않습니다.

## 평소 사용 방법

Codex에 수정할 내용과 커밋·푸시·배포를 요청하면 됩니다. GitHub 웹에서 수정한 내용도 운영 브랜치에 반영되면 같은 절차를 거칩니다. 다른 브랜치의 변경은 운영 브랜치로 병합해야 합니다.

진행 상황은 [GitHub Actions](https://github.com/gangriver/PathologyLab/actions/workflows/deploy-production.yml)에서 확인합니다. 실패 원인을 수정한 뒤 새 커밋을 반영하거나 **Run workflow**로 운영 브랜치를 다시 실행할 수 있습니다.

## DB 변경 작성

새 SQL은 `supabase/migrations/YYYYMMDDHHMMSS_설명.sql`에 추가합니다. 버전은 UTC 기준의 고유한 14자리 시각이며 기존 버전보다 커야 합니다. 이미 적용한 파일은 수정하지 않고 후속 파일로 변경합니다.

첫 파일 `20260930000000_baseline.sql`은 2026-09-30에 확인한 기존 운영 DB의 구조입니다. 운영 DB에는 이 SQL을 다시 실행하지 않고 적용 이력만 등록했습니다. `db/supabase.sql`과 `db/migrations/`의 예전 SQL을 다시 실행하지 마세요.

SQL 적용 후 Vercel 배포가 실패해도 적용된 SQL이 자동으로 되돌아가지는 않습니다. 기존 코드와 호환되는 변경으로 작성하고, 필요한 수정은 후속 SQL로 적용합니다. 테이블 삭제나 데이터 삭제는 별도로 검토해야 합니다.

## 인증 정보

GitHub 저장소의 Actions Secrets에서 다음 세 항목을 관리합니다.

| 이름 | 용도 |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase 프로젝트 연결 설정 조회 |
| `SUPABASE_DB_PASSWORD` | DB 연결과 SQL 적용 |
| `VERCEL_TOKEN` | 운영 설정 조회, 빌드와 배포 |

Supabase 토큰은 해당 프로젝트에 대해 `Project Settings`, `API Keys`, `API Key Secrets`, `Connection Pooling`의 **Read** 권한이 필요합니다. DB SQL은 별도의 DB 비밀번호로 실행합니다. 토큰 만료·폐기 또는 비밀번호 변경 시 해당 Secret을 갱신해야 합니다.

앱에서 사용하는 Supabase 서버 키와 R2 설정 등은 기존 Vercel 환경변수를 사용합니다. 비밀값이나 내려받은 운영 환경 파일을 저장소에 올리지 마세요.
