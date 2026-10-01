# partfinder-kr

전자부품 품번(MPN) 검색과 문의 리드 수집 MVP. 목적은 수요 검증 데이터 수집이다.

## 시작하기

```bash
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npm install
npm run dev            # http://localhost:3000
```

개발 환경에서는 mock Provider(`PROVIDER_MOCK_ENABLED=true`)와 fixture JSON만 사용한다.
실제 유통사 Provider는 모두 기본 비활성이며 feature flag로만 켠다.

## 로컬 DB

프로젝트 안의 개발 전용 PostgreSQL 18 클러스터(`.pgdata`, 포트 5434)를 쓴다. 접속 정보는 `.env`의 `DATABASE_URL`.

```bash
npm run db:start     # 개발 DB 실행 (재부팅 후 한 번)
npm run db:migrate   # 스키마 변경 반영
```

처음 만들 때(이미 만들어져 있으면 생략): `initdb -D .pgdata -U partfinder --auth=scram-sha-256 --pwfile=<비밀번호 파일>` 후 `.env`에 `DATABASE_URL="postgresql://partfinder:<비밀번호>@localhost:5434/partfinder"`.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | ESLint |

## mock fixture 시나리오

`src/lib/providers/mock/fixtures/` 의 품번:

| 품번 | 시나리오 |
|---|---|
| `MOCK-STOCK-OK` | 두 유통사 모두 재고 충분 |
| `MOCK-STOCK-ZERO` | 모든 유통사 재고 0 |
| `MOCK-LOW-STOCK` | 재고 소량 (수량 초과 테스트용) |
| `MOCK-NRND` | NRND / 단종 |
| `MOCK-PARTIAL-ERROR` | 유통사 B 조회 실패 (호출 한도) |
| 그 외 | 결과 없음 |

## 구조

```
src/lib/providers/   Provider 인터페이스, 레지스트리(feature flag), mock·미구현 Provider
src/lib/search/      정규화, 가격 계산·정렬, 짧은 TTL 캐시, 병렬 검색
src/components/      검색 폼, 정식 유통사 결과 표
src/app/             / (검색), /search (결과)
```
