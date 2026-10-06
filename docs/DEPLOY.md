# 배포 가이드 — AWS Lightsail 서버 1대

구성: **Lightsail 2GB (Ubuntu 24.04, 서울)** 한 대에 Next.js + PostgreSQL 18 + Caddy(HTTPS 자동)를 올린다.
배포는 GitHub Actions 에서 빌드해 서버로 올리고, 서버에서 마이그레이션 → 전환 → 상태 확인 → 실패 시 자동 되돌리기 순서로 진행된다.

| 항목 | 월 비용(추정) |
|---|---|
| Lightsail 2GB 플랜 (60GB SSD, 3TB 전송 포함) | $10 |
| DB 백업 (서버 안 14일 보관, S3 는 선택) | $0 ~ 1 |
| Resend (초기 문의량) | $0 |
| 도메인 | 연 $10~15 |

---

## 1. 준비물

- 도메인 (예: `ms-parts.kr`)
- AWS 계정 (결제 수단 등록)
- 이 저장소의 GitHub 관리자 권한

## 2. Lightsail 인스턴스 만들기 (AWS 콘솔)

1. Lightsail → **Create instance**
   - 리전: **Seoul (ap-northeast-2)**
   - 플랫폼: Linux/Unix, 블루프린트: **OS Only → Ubuntu 24.04 LTS**
   - 플랜: **$10 (2 GB RAM)** — 1GB 는 Node.js·PostgreSQL 을 함께 돌리기에 빠듯하다
2. 인스턴스 → **Networking**
   - **Static IP 만들어 연결** (재시작해도 IP 가 바뀌지 않게)
   - IPv4 방화벽에 **HTTPS (443)** 추가 (SSH 22, HTTP 80 은 기본으로 열려 있음)
3. (권장) **Snapshots → Automatic snapshots 켜기** — 서버 전체 하루 1회 스냅샷 (스냅샷 저장 용량만큼 소액 과금)

## 3. 도메인 연결 (DNS)

도메인 관리 화면에서 A 레코드 2개를 고정 IP 로:

| 이름 | 종류 | 값 |
|---|---|---|
| `@` (루트) | A | 고정 IP |
| `www` | A | 고정 IP |

DNS 가 반영된 뒤에 4단계를 해야 Caddy 가 HTTPS 인증서를 받을 수 있다. (`nslookup 도메인` 으로 확인)

## 4. 서버 초기 설정 (한 번만)

Lightsail 콘솔의 **Connect using SSH** (브라우저 터미널) 에서:

```bash
# 저장소가 비공개면: GitHub → Settings → Developer settings 에서 읽기 전용 토큰을 만들어 clone 하거나,
# 내 PC 에서 deploy 폴더와 package.json 만 scp 로 올려도 된다.
git clone https://github.com/Csanoo/partfinder-kr.git
sudo bash partfinder-kr/deploy/setup-server.sh --domain 도메인
```

설치되는 것: Node.js 24, PostgreSQL 18(외부 접속 불가), Caddy, systemd 서비스 `partfinder`, 정기 작업(cron), DB 백업, 방화벽(22/80/443), 스왑 2GB, 자동 보안 업데이트.

**마지막에 관리자 비밀번호가 한 번만 표시된다.** 안전한 곳에 보관한다. (잃어버리면 `/etc/partfinder/env` 의 `ADMIN_PASSWORD` 를 바꾸고 재시작)

## 5. GitHub Actions 배포 설정

### 5-1. 배포용 SSH 키 (내 PC 에서)

```bash
ssh-keygen -t ed25519 -f partfinder_deploy -N "" -C "github-actions-deploy"
```

- `partfinder_deploy.pub` 내용을 서버의 `/home/deploy/.ssh/authorized_keys` 에 붙여 넣는다
  (Lightsail 브라우저 터미널: `sudo nano /home/deploy/.ssh/authorized_keys`)
- 서버 호스트 키 확인: `ssh-keyscan -t ed25519 고정IP`

### 5-2. GitHub 저장소 설정

Settings → Environments → **New environment: `production`**
(선택: Required reviewers 를 켜면 배포마다 승인 후 진행)

이 environment 에 Secrets 추가:

| 이름 | 값 |
|---|---|
| `DEPLOY_HOST` | 고정 IP |
| `DEPLOY_SSH_KEY` | `partfinder_deploy` (개인 키) 파일 내용 전체 |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan` 출력 한 줄 |

개인 키 파일은 GitHub 에 넣은 뒤 PC 에서 지워도 된다.

### 5-3. 첫 배포

GitHub → **Actions → Deploy → Run workflow**.
lint·타입 검사·테스트·빌드를 통과해야 서버에 올라간다. 완료 후 확인:

- `https://도메인/api/health` → `{"ok":true}`
- `https://도메인/` 홈
- `https://도메인/admin` 관리자 로그인

### 5-4. 자동 배포 켜기

첫 수동 배포가 성공하면, main 에 push 할 때마다 자동으로 배포되게 한다.

GitHub → Settings → Secrets and variables → Actions → **Variables** 탭 → New repository variable:

| 이름 | 값 | 역할 |
|---|---|---|
| `AUTO_DEPLOY` | `true` | main push 시 자동 배포 (없거나 `true` 가 아니면 검사만) |
| `SITE_URL` | `https://도메인` | 배포 후 외부에서 `/api/health` 확인 (선택) |

동작:

- main 에 push → lint·타입 검사·테스트·빌드 → 통과하면 서버 배포 → 서버 안 상태 확인 → (설정 시) 외부 상태 확인
- 검사가 하나라도 실패하면 배포하지 않는다. 서버 상태 확인이 실패하면 이전 릴리스로 자동 되돌린다
- 문서(`docs/`, `*.md`)만 바뀐 push 는 배포하지 않는다
- 배포는 한 번에 하나씩, 연속 push 는 마지막 커밋만 배포된다
- 끄려면 `AUTO_DEPLOY` 를 `false` 로 바꾼다 (수동 실행은 계속 가능)
- `production` environment 에 Required reviewers 를 켜 두면 자동 배포도 승인 후 진행된다 (완전 자동을 원하면 끈다)

## 6. 운영 설정 바꾸기

설정 파일: `/etc/partfinder/env` (형식·항목은 `deploy/env.production.template` 참고)

```bash
sudo nano /etc/partfinder/env
sudo systemctl restart partfinder
```

| 하려는 것 | 설정 |
|---|---|
| 문의 알림 메일 실제 발송 | Resend 에서 도메인 DNS 인증 → `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM`, `NOTIFY_EMAIL_QUOTE`, `NOTIFY_EMAIL_SOURCING` → 관리자 "설정" 화면에서 테스트 메일 |
| 구글·네이버 사이트 소유 확인 | `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION` → 확인 후 `https://도메인/sitemap.xml` 제출 |
| 요약 초안(AI) | `SUMMARY_DRAFT_ENABLED=true`, `ANTHROPIC_API_KEY` |
| 부품 페이지 번역(영·일·스페인어) | `TRANSLATION_ENABLED=true`, `ANTHROPIC_API_KEY` (매일 03:45 정기 작업 + 관리자 부품 화면 '번역 만들기') |
| 부품 요청 알림 수신 | `NOTIFY_EMAIL_REQUEST` (없으면 `NOTIFY_EMAIL_QUOTE`) |
| 개인정보 파기 | `PERSONAL_DATA_RETENTION_DAYS` (매일 03:20 KST 자동 실행) |

## 7. 자주 쓰는 명령

```bash
sudo systemctl status partfinder            # 상태
sudo tail -f /var/log/partfinder/app.log    # 앱 로그
sudo tail -n 50 /var/log/partfinder/cron.log  # 정기 작업 기록
sudo journalctl -u caddy -n 50              # HTTPS·웹서버 로그
ls -1t /opt/partfinder/releases             # 릴리스 목록 (최근 5개 보관)
```

**정기 작업** (`/etc/cron.d/partfinder`, 한국 시간): 03:10 색인 재계산 · 03:20 개인정보 파기 · 03:30 제조사 정보 조회 · 03:45 부품 번역 · 04:00 DB 백업

정기 작업 목록(`deploy/partfinder.cron`)이 바뀌면 배포만으로는 서버에 반영되지 않는다. 서버에서 한 번:

```bash
cd ~/partfinder-kr && git pull && sudo install -m 644 deploy/partfinder.cron /etc/cron.d/partfinder
```

### 이전 릴리스로 되돌리기

배포가 상태 확인에 실패하면 자동으로 되돌아간다. 수동으로 되돌릴 때:

```bash
cd /opt/partfinder && ls -1t releases
sudo ln -sfn /opt/partfinder/releases/<이전-릴리스> current && sudo systemctl restart partfinder
```

DB 마이그레이션은 되돌려지지 않는다. 스키마가 바뀐 릴리스를 되돌릴 때는 먼저 백업을 확인한다.

### 백업에서 복구

```bash
ls -1t /var/backups/partfinder
sudo systemctl stop partfinder
gunzip -c /var/backups/partfinder/<파일>.sql.gz | sudo -u postgres psql partfinder
sudo systemctl start partfinder
```

(빈 DB 에 복구하는 것이 원칙. 필요하면 `sudo -u postgres dropdb partfinder && sudo -u postgres createdb -O partfinder partfinder` 후 복구)

## 8. 보안 메모

- PostgreSQL 은 서버 밖에서 접속할 수 없다 (localhost 전용, 방화벽에서도 5432 닫힘)
- `/api/cron/*` 은 Caddy 가 외부에 404 로 막고, 앱도 `CRON_SECRET` 없이는 거부한다
- `deploy` 사용자는 릴리스 활성화 스크립트만 root 로 실행할 수 있다 (`/etc/sudoers.d/partfinder-deploy`)
- 관리자 화면은 Basic Auth + HTTPS. 비밀번호는 서버 설정 파일에만 있다
