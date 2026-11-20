#!/usr/bin/env bash
# One-command deploy for Scope Quest (Docker Compose: app + Caddy with automatic HTTPS).
#   On the droplet, inside the repo:   ./deploy.sh
#   From your laptop:                  ./deploy.sh root@YOUR_DROPLET_IP
set -euo pipefail
cd "$(dirname "$0")"

if [[ $# -ge 1 ]]; then
  TARGET="$1"; DIR="${2:-/opt/scope-quest}"
  echo "▶ Syncing to $TARGET:$DIR"
  ssh "$TARGET" "mkdir -p $DIR"
  rsync -az --delete --exclude node_modules --exclude dist --exclude data --exclude .env --exclude screenshots --exclude .git ./ "$TARGET:$DIR/"
  [[ -f .env ]] && ssh "$TARGET" "test -f $DIR/.env" || { [[ -f .env ]] && scp .env "$TARGET:$DIR/.env"; }
  ssh -t "$TARGET" "cd $DIR && ./deploy.sh"
  exit 0
fi

command -v docker >/dev/null || { echo "▶ Installing Docker"; curl -fsSL https://get.docker.com | sh; }
if [[ ! -f .env ]]; then
  cp .env.example .env
  sed -i "s/change-me-to-a-long-random-string/$(openssl rand -hex 16)/" .env
  echo "✋ Created .env. Set DOMAIN, PUBLIC_URL and HOST_PIN in .env, then run ./deploy.sh again."; exit 1
fi
set -a; source .env; set +a
[[ "$DOMAIN" == "ghg.yourdomain.com" ]] && { echo "✋ Set DOMAIN in .env first (and point its DNS A record at this server)."; exit 1; }
mkdir -p data && chown 1000:1000 data 2>/dev/null || true

echo "▶ Building and starting"
docker compose up -d --build
echo "▶ Waiting for health"
for i in $(seq 1 40); do
  if docker compose exec -T app wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "✅ Scope Quest is up"
    echo "   Audience: $PUBLIC_URL"
    echo "   Host:     $PUBLIC_URL/host?k=$HOST_KEY   (PIN: in .env)"
    echo "   Screen:   $PUBLIC_URL/screen?k=$HOST_KEY"
    echo "   Admin:    $PUBLIC_URL/admin?k=$HOST_KEY"
    exit 0
  fi
  sleep 3
done
echo "❌ App did not become healthy. Logs:"; docker compose logs --tail 80 app; exit 1
