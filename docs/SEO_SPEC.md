# 개발 명세: 부품 페이지 SEO·AEO 노출

> Claude Code 작업 지시용. `docs/SPEC.md`(검색·문의·관리자)에 이어지는 명세다.
> "제약" 항목은 협상 불가. 불명확한 부분은 임의로 정하지 말고 `TODO(확인필요)`를 남긴다.

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-10-01 | AI 크롤러 기본값 결정 (6.2) |
| 2026-10-01 | 수신. 진행 결정. 가격은 모든 화면(`/search` 포함)에서 제거 결정 (10장 마지막 항목 해소) |

## 1. 목적

부품별 상세 페이지를 검색엔진(구글·네이버)과 AI 답변 엔진에 노출해, 단종·수급난 부품을 찾는
국내 구매·개발 담당자의 소싱 문의를 유입시킨다.

첫 단계는 **수백 개 규모의 고품질 페이지로 "검색 유입 → 문의"가 실제로 일어나는지 검증**하는 것이다.
페이지 수를 늘리는 기능보다 페이지 품질 관리와 측정 기능이 우선이다.

## 2. 제약 (반드시 지킬 것)

1. **얇은 페이지 대량 생성 금지.** 품번만 바꾼 템플릿 페이지를 색인시키지 않는다.
   구글은 검색 순위 조작이 주목적인 대량 페이지를 생성 방식(AI·자동화·사람)과 무관하게 스팸으로 본다.
   품질 기준(5.3)을 통과한 페이지만 색인을 허용한다.
2. **사용자 검색으로 색인 페이지를 자동 생성하지 않는다.** `/search` 결과 페이지는 항상 `noindex`.
   부품 페이지는 관리자가 등록·검토·게시한 것만 존재한다.
3. **유통사 API 데이터를 페이지 콘텐츠로 저장하거나 서버 렌더링하지 않는다.**
   정식 유통사 재고 정보는 사용자 브라우저에서 클라이언트 측으로만 불러온다(6.4).
   (DigiKey는 API 데이터로 자체 DB 구축 금지, Mouser는 일일 호출 한도가 있어 크롤러 방문마다 호출하면 안 됨)
4. **가격은 어디에도 표시하지 않는다.** 구조화 데이터의 `offers`, `price`도 넣지 않는다.
5. **외부 콘텐츠 복제 금지.** 유통사 상품 설명, 데이터시트 본문, 타 사이트 문구를 복사하지 않는다.
   데이터시트는 제조사 공식 URL 링크만 건다. 제조사·유통사 로고 사용 금지.
6. **운영 주체 고지.** 모든 부품 페이지 하단과 소개 페이지에 "본 사이트는 독립 운영되며, 소싱 문의는
   협력 업체를 통해 처리됩니다. 제조사·정식 유통사와 무관합니다." 취지의 문구를 표시한다.
   정확한 문구는 `TODO(확인필요)`.

## 3. 데이터 모델

```
part
  id, mpn_display(원본 표기), mpn_key(정규화: 대문자, 공백·하이픈 제거),
  manufacturer_id, category_id, package, summary_ko(한국어 요약),
  key_specs(JSON: [{label, value}] 관리자 입력),
  lifecycle_status(active|nrnd|ltb|eol|unknown), lifecycle_checked_at, lifecycle_source(텍스트),
  eol_date(nullable), datasheet_url(제조사 공식만),
  page_status(draft|review|published|unpublished), indexable(bool, 계산값),
  reviewed_by, reviewed_at, created_at, updated_at

part_alternative
  part_id, alt_part_id 또는 alt_mpn_text, relation(drop_in|similar|upgrade),
  note_ko, verified(bool), verified_by

part_faq
  part_id, question_ko, answer_ko, source(inquiry|manual), published(bool)

manufacturer / category
  id, slug, name_ko, name_en, description_ko

part_variant   (패키징 접미사 등 변형 품번)
  part_id, mpn_variant, mpn_variant_key
```

- 원본 품번 표기는 절대 덮어쓰지 않는다.
- 변형 품번(릴·테이프 접미사 등)은 별도 페이지를 만들지 않고 기준 부품 페이지에 묶는다.
  변형 판정 규칙은 `TODO(확인필요)`. 초기에는 관리자가 수동으로 묶는다.

## 4. URL 구조

| 페이지 | URL | 색인 |
|---|---|---|
| 부품 상세 | `/parts/{manufacturer-slug}/{mpn-slug}` | 품질 기준 통과 시 |
| 제조사 허브 | `/manufacturers/{slug}` | 게시 부품 5개 이상일 때 |
| 카테고리 허브 | `/categories/{slug}` | 게시 부품 5개 이상일 때 |
| 단종 부품 목록 | `/eol` | 색인 |
| 검색 결과 | `/search?q=` | 항상 noindex |
| 관리자 | `/admin/*` | 차단 |

- `mpn-slug`: 소문자, URL 안전 문자로 인코딩. `/`, `#`, `,`, 공백 등은 규칙에 따라 치환하고
  slug ↔ mpn_key 매핑을 DB에 저장해 충돌을 막는다.
- 변형 품번 URL로 접근하면 기준 부품 URL로 301 리다이렉트.
- 대소문자·하이픈 차이로 들어온 URL은 정규 URL로 301.
- 비게시(unpublished) 전환 시 410 응답.

## 5. 부품 상세 페이지

### 5.1 구성 (위에서 아래 순서)

1. **H1**: `{mpn_display}` + 제조사명
2. **핵심 요약 (답변 우선 문단)**: 이 부품이 무엇인지, 현재 수명주기 상태, 대체품 존재 여부를 2~3문장으로.
   AI 답변 엔진이 인용하기 쉽도록 사실 문장으로 쓰고 기준일을 포함한다. 예: "2026년 10월 기준 단종(EOL) 상태이며, 핀 호환 대체품 2종이 확인되어 있습니다."
3. **기본 정보 표**: 제조사, 카테고리, 패키지, 주요 스펙(key_specs), 데이터시트 링크
4. **수명주기**: 상태, 단종 시점, 확인일, 출처
5. **대체품 표**: 대체 품번(내부 페이지 있으면 링크), 관계 유형, 비고, 검증 여부 표시
6. **정식 유통사 재고**: 클라이언트 측 로딩(6.4). 재고 있음/없음과 유통사 링크만. 가격 없음.
7. **소싱 문의**: `docs/SPEC.md`의 소싱 문의 폼. 시각적으로 분리하고 기존 고지 문구 유지.
8. **FAQ**: `part_faq` 중 published만. 실제 문의에서 나온 질문 또는 관리자가 쓴 질문만. 템플릿 자동 생성 FAQ 금지.
9. **관련 부품**: 같은 카테고리·제조사 부품 내부 링크 최대 10개
10. **운영 주체 고지**

### 5.2 메타 태그

- `<title>`: `{mpn_display} 단종·대체품·재고 문의 | {제조사명}` (60자 내외, 상태에 따라 문구 조정)
  - lifecycle_status가 active면 "단종" 대신 "재고·구매 문의"
- `meta description`: summary_ko에서 120자 이내 생성
- `canonical`: 정규 URL
- Open Graph: title, description, url, type=website
- `robots`: indexable=false면 `noindex, follow`

### 5.3 색인 품질 기준 (`indexable` 계산)

아래를 모두 만족해야 `indexable=true`:
- page_status = published, reviewed_by 존재
- summary_ko 80자 이상
- lifecycle_status ≠ unknown, lifecycle_checked_at이 12개월 이내
- 다음 중 2개 이상 충족: key_specs 3개 이상 / 검증된 대체품 1개 이상 / 게시 FAQ 1개 이상 / eol_date 존재

기준 값은 환경설정으로 조정 가능하게 한다. 관리자 화면에 미충족 항목을 체크리스트로 보여준다.

### 5.4 구조화 데이터 (JSON-LD)

- `Product`: name, mpn, brand(Organization: 제조사명), category, description(summary_ko), url
  - `offers`, `aggregateRating`, `review`는 넣지 않는다.
- `BreadcrumbList`: 홈 > 카테고리 > 제조사 > 부품
- `FAQPage`: 게시 FAQ가 있을 때만, 화면에 보이는 내용과 동일하게
- 홈에는 `Organization`, `WebSite`
- 화면에 없는 내용을 구조화 데이터에만 넣지 않는다.

## 6. 기술 요구사항

### 6.1 렌더링
- 부품·허브 페이지는 서버 렌더링 또는 정적 생성(ISR). 핵심 콘텐츠가 JS 없이 HTML에 있어야 한다.
- 게시·수정 시 해당 페이지와 연관 허브 페이지 재생성.

### 6.2 사이트맵·robots
- `sitemap.xml`은 사이트맵 인덱스 + 유형별 분할(parts, manufacturers, categories). 파일당 URL 50,000개 이하.
- indexable=true인 페이지만 포함, `lastmod`는 실제 콘텐츠 수정 시각.
- `robots.txt`: `/admin`, `/search`, `/api` 차단, 사이트맵 경로 명시.
- AI 크롤러(GPTBot, ClaudeBot, PerplexityBot, Google-Extended 등) 허용 여부는 환경설정 목록으로 관리.
  - 기본값 (결정 2026-10-01): **검색·답변용은 허용, 학습용은 차단.**
    - 허용(검색·답변·사용자 요청): OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User
    - 차단(모델 학습): GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot, Bytespider, meta-externalagent
    - 목록은 환경변수로 덮어쓸 수 있게 한다 (봇 이름은 각 사 공지에 따라 바뀔 수 있음).

### 6.3 성능
- Core Web Vitals 기준 충족을 목표로: 부품 페이지 LCP 요소는 텍스트, 이미지 최소화, 폰트 subset.
- 정식 유통사 재고 영역은 레이아웃 이동이 없도록 고정 높이 스켈레톤.

### 6.4 정식 유통사 재고 (클라이언트 측)
- 페이지 로드 후 브라우저에서 내부 API(`/api/availability?mpn=`)를 호출하고, 서버는 `docs/SPEC.md`의 Provider 어댑터·rate limiter·짧은 TTL 캐시를 그대로 사용한다.
- 알려진 검색엔진 봇 User-Agent 요청에는 호출하지 않고 "조회는 방문 시 제공" 문구만 표시한다.
- 일일 쿼터 소진 시 "일시적으로 조회 불가"로 표시. 페이지 나머지는 정상.
- 결과는 재고 있음/없음 + 유통사명 + 조회 시각 + 유통사 링크. 가격·정확한 수량은 표시하지 않는다.

### 6.5 네이버
- 네이버 서치어드바이저 사이트 소유 확인용 메타 태그를 환경변수로 주입할 수 있게 한다.
- 구글 Search Console 확인 태그도 동일.

## 7. 관리자 기능 (`/admin/parts`)

- 부품 목록: page_status, indexable, lifecycle_checked_at 경과일 필터
- CSV 가져오기: mpn, manufacturer, category, package, lifecycle_status, eol_date 등 기본 필드. 가져온 부품은 draft로 생성.
- 부품 편집: 모든 필드, 대체품·FAQ·변형 품번 관리, 품질 체크리스트 표시, 미리보기
- 요약 초안 생성(선택): 관리자가 입력한 사실 필드만 근거로 LLM이 summary_ko 초안 작성. 초안은 draft 상태로만 저장되고 사람 검토 후 게시. 입력되지 않은 사실을 만들어내지 않도록 프롬프트에 명시.
- 문의 → FAQ 전환: 문의 내용을 FAQ 후보로 보내는 버튼(개인정보 제거 후 관리자 편집)
- 일괄 게시 상한: 한 번에 50건 이하
- lifecycle_checked_at 12개월 경과 부품은 목록 상단에 "재확인 필요" 표시

## 8. 측정

- 문의(inquiry)에 랜딩 페이지 URL, referrer, UTM, 첫 방문 시각을 저장한다(`docs/SPEC.md`의 inquiry에 필드 추가).
- 이벤트: 부품 페이지 조회, 재고 영역 조회, 소싱 문의 폼 열기, 문의 제출.
- 관리자 지표에 추가: 부품 페이지별 조회 수·문의 수·전환율, 유입 경로별(구글/네이버/AI 답변/직접) 문의 수, indexable 페이지 수 추이.
- Search Console API 연동은 다음 단계. 지금은 수동 확인.

## 9. 작업 순서와 완료 기준

1. 데이터 모델, URL·slug 규칙, 리다이렉트
   - 완료 기준: 특수문자 품번 fixture 20종의 slug 왕복 변환·충돌 테스트 통과
2. 관리자 부품 CRUD, CSV 가져오기, 품질 체크리스트, indexable 계산
   - 완료 기준: 5.3 기준 경계값 단위 테스트 통과
3. 부품 상세 페이지 렌더링(5.1), 메타 태그, JSON-LD
   - 완료 기준: JSON-LD 스키마 검증 통과, noindex 조건별 테스트
4. 허브 페이지, `/eol`, 내부 링크
5. 사이트맵·robots, 검색엔진 확인 태그
6. 클라이언트 측 재고 조회(6.4), 봇 요청 분기
7. 측정 필드·이벤트·지표
8. 요약 초안 생성(선택), 문의 → FAQ 전환

각 단계 완료 시 변경 요약과 남은 `TODO(확인필요)` 목록을 보고한다.

## 10. 미정 사항 (임의 결정 금지)

- 운영 주체 고지 정확한 문구
- ~~AI 크롤러 허용 기본값~~ → 2026-10-01 결정: 검색·답변용 허용, 학습용 차단 (6.2)
- 변형 품번 판정 규칙
- 도메인 (사이트명은 MS유통로 결정)
- 초기 게시 부품 목록(지인 거래 이력 기반 300~500개 예정)
- ~~`docs/SPEC.md` 4.2 결과 화면의 가격 구간·단가 표시를 제거할지 여부~~ → 2026-10-01 결정: 모든 화면에서 가격 제거
