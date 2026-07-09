# Piston Self-Hosting Runbook

DuecIt can use either the public Piston API or a self-hosted Piston instance. Production should use a private Piston deployment behind TLS and basic auth because Piston executes untrusted code and has no built-in authentication.

## Production VPS

Provision an Ubuntu 24.04 VPS with Docker installed. A 2 vCPU / 4 GB RAM host is a reasonable starting point. Point a real domain or subdomain, such as `piston.example.com`, at the VPS so Caddy can issue a TLS certificate.

Only expose SSH, HTTP, and HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Generate a Caddy bcrypt password hash:

```bash
docker run --rm caddy:2 caddy hash-password --plaintext 'choose-a-long-random-password-here'
```

Create `/opt/piston-stack/docker-compose.yml` on the VPS:

```yaml
services:
  piston:
    image: ghcr.io/engineer-man/piston
    container_name: piston_api
    restart: unless-stopped
    privileged: true
    tmpfs:
      - /piston/jobs:exec
    volumes:
      - piston_data:/piston
    ports:
      - "127.0.0.1:2000:2000"

  caddy:
    image: caddy:2
    container_name: piston_caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddyfile
      - caddy_data:/data
      - caddy_config:/config
    command: caddy run --config /etc/caddyfile --adapter caddyfile

volumes:
  piston_data:
  caddy_data:
  caddy_config:
```

Create `/opt/piston-stack/Caddyfile`:

```caddyfile
piston.example.com {
    basicauth {
        duecit-backend <bcrypt-hash-from-caddy>
    }
    reverse_proxy piston:2000
}
```

Start the stack:

```bash
cd /opt/piston-stack
docker compose up -d
docker compose logs -f caddy
```

## Install Runtimes

Piston starts with no language runtimes installed. Check the available package versions from the live server before installing:

```bash
curl -u duecit-backend:<password> https://piston.example.com/api/v2/packages
```

Install the languages used by `duecit/internal/judge/judge.go`: `python`, `javascript`, `cpp`, `java`, `c`, and `go`.

```bash
curl -u duecit-backend:<password> -X POST https://piston.example.com/api/v2/packages \
  -H "Content-Type: application/json" \
  -d '{"language":"python","version":"3.12.0"}'
```

Repeat with exact version strings returned by `/api/v2/packages`.

Smoke test the deployment:

```bash
curl -u duecit-backend:<password> -X POST https://piston.example.com/api/v2/execute \
  -H "Content-Type: application/json" \
  -d '{"language":"python","version":"*","files":[{"content":"print(1+1)"}]}'
```

Expect `run.stdout` to be `2\n`.

## Backend Environment

Local development with the repo `docker-compose.yml`:

```env
PISTON_URL=http://localhost:2000/api/v2
PISTON_AUTH_USER=
PISTON_AUTH_PASS=
```

Production:

```env
PISTON_URL=https://piston.example.com/api/v2
PISTON_AUTH_USER=duecit-backend
PISTON_AUTH_PASS=<plaintext-basic-auth-password>
```

`PISTON_AUTH_USER` and `PISTON_AUTH_PASS` are optional. The backend only sends a basic-auth header when both are set.
