#!/usr/bin/env bash
# MS전자 (partfinder-kr) 서버 1대 초기 설정 — Ubuntu 24.04 LTS (AWS Lightsail 2GB 권장)
#
#   sudo bash setup-server.sh --domain example.com
#
# 한 번만 실행한다. 다시 실행해도 기존 비밀번호·DB 는 덮어쓰지 않는다.
# 설치: Node.js 24, PostgreSQL 18(로컬 전용), Caddy(HTTPS 자동), systemd 서비스, cron 정기 작업, DB 백업, 방화벽, 스왑
set -euo pipefail

DOMAIN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    *) echo "알 수 없는 인자: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$DOMAIN" ]] || { echo "사용법: sudo bash setup-server.sh --domain example.com" >&2; exit 2; }
[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "도메인 형식이 올바르지 않습니다: $DOMAIN" >&2; exit 2; }
[[ $EUID -eq 0 ]] || { echo "root 로 실행해 주세요 (sudo)" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/partfinder
ENV_FILE=/etc/partfinder/env
export DEBIAN_FRONTEND=noninteractive

log() { echo -e "\n==> $*"; }
rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

log "시간대 (로그·cron 기준은 UTC 유지), 스왑 2GB"
timedatectl set-timezone UTC || true
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "기본 패키지, 자동 보안 업데이트"
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https
dpkg-reconfigure -f noninteractive unattended-upgrades

log "Node.js 24 (NodeSource)"
if ! node -v 2>/dev/null | grep -q '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

log "PostgreSQL 18 (PGDG, 로컬 접속만)"
if ! command -v /usr/lib/postgresql/18/bin/postgres >/dev/null; then
  apt-get install -y postgresql-common
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt-get install -y postgresql-18
fi

log "Caddy (HTTPS 인증서 자동 발급·갱신)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

log "사용자: partfinder(앱 실행), deploy(배포 업로드)"
id partfinder >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin partfinder
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys && chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

log "디렉터리"
install -d -m 755 "$APP" "$APP/releases" "$APP/bin" "$APP/tools"
install -d -m 770 -o deploy -g deploy "$APP/incoming"
install -d -m 750 -o root -g partfinder /etc/partfinder
install -d -m 750 -o partfinder -g partfinder /var/log/partfinder
install -d -m 750 -o postgres -g postgres /var/backups/partfinder

log "DB·역할 (비밀번호는 처음 한 번만 생성)"
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASS="$(rand 32)"
  ADMIN_PASS="$(rand 24)"
  CRON_SECRET="$(rand 40)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE partfinder WITH LOGIN PASSWORD '${DB_PASS}';" || true
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE partfinder OWNER partfinder;" || true
  sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__DB_PASS__|${DB_PASS}|g" -e "s|__ADMIN_PASS__|${ADMIN_PASS}|g" -e "s|__CRON_SECRET__|${CRON_SECRET}|g" \
    "$HERE/env.production.template" > "$ENV_FILE"
  chown root:partfinder "$ENV_FILE" && chmod 640 "$ENV_FILE"
  NEW_ADMIN_PASS="$ADMIN_PASS"
fi

log "마이그레이션 도구 (Prisma CLI, 앱과 같은 버전)"
PRISMA_VERSION="$(node -p "require('$HERE/../package.json').devDependencies.prisma.replace(/^[^0-9]*/, '')")"
cp "$HERE/tools/prisma.config.mjs" "$APP/tools/prisma.config.mjs"
[[ -f "$APP/tools/package.json" ]] || echo '{"private":true,"type":"module"}' > "$APP/tools/package.json"
npm install --prefix "$APP/tools" --no-audit --no-fund "prisma@${PRISMA_VERSION}"

log "서버 스크립트·서비스·웹서버·cron"
install -m 755 -o root -g root "$HERE/bin/activate-release" "$HERE/bin/cron-call" "$HERE/bin/backup-db" "$APP/bin/"
install -m 644 "$HERE/partfinder.service" /etc/systemd/system/partfinder.service
sed "s|__DOMAIN__|${DOMAIN}|g" "$HERE/Caddyfile" > /etc/caddy/Caddyfile
install -m 644 "$HERE/partfinder.cron" /etc/cron.d/partfinder
install -m 644 "$HERE/partfinder.logrotate" /etc/logrotate.d/partfinder
# deploy 는 릴리스 활성화 스크립트만 root 로 실행할 수 있다
echo "deploy ALL=(root) NOPASSWD: $APP/bin/activate-release *" > /etc/sudoers.d/partfinder-deploy
chmod 440 /etc/sudoers.d/partfinder-deploy && visudo -cf /etc/sudoers.d/partfinder-deploy
systemctl daemon-reload
systemctl enable partfinder
systemctl reload caddy || systemctl restart caddy

log "방화벽 (SSH, HTTP, HTTPS 만)"
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

log "완료"
echo "다음 단계: docs/DEPLOY.md 의 'GitHub Actions 배포 설정' 을 따라 첫 배포를 실행하세요."
echo "앱 설정 파일: $ENV_FILE (메일·유통사 키 등은 여기서 수정 후 'sudo systemctl restart partfinder')"
if [[ -n "${NEW_ADMIN_PASS:-}" ]]; then
  echo
  echo "관리자 로그인 (지금 한 번만 표시됩니다. 안전한 곳에 보관하세요)"
  echo "  아이디: admin"
  echo "  비밀번호: ${NEW_ADMIN_PASS}"
fi
