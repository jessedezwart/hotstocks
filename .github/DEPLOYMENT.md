# Deployment Configuration

## GitHub Repository Setup

### Required Secrets (Settings → Secrets and variables → Actions → Secrets)

1. **VPS_SSH_KEY**
   - Your private SSH key that can access root@95.179.155.133
   - Generate with: `ssh-keygen -t rsa -b 4096`
   - Copy the private key content
   - Add the public key to VPS: `~/.ssh/authorized_keys`

### Required Variables (Settings → Secrets and variables → Actions → Variables)

1. **VPS_HOST**
   - Value: `95.179.155.133`

2. **VITE_API_URL**
   - Value: `https://api.hotones.nl`

3. **VITE_AUTH0_DOMAIN**
   - Value: `dev-jgfuhiegx740ha1c.eu.auth0.com`

4. **VITE_AUTH0_CLIENT_ID**
   - Value: `J9EncMJ2gZnhmBYXwDJoWPHRSbbq3DJ8`

5. **VITE_AUTH0_AUDIENCE**
   - Value: `https://hotstocks-api`

## VPS Setup

The following should already be configured on your VPS at 95.179.155.133:

- ✅ Docker and Docker Compose installed
- ✅ Caddy installed and configured
- ✅ `/var/www/hotstocks/` directory for frontend
- ✅ `/root/hotstocks-backend/` directory for backend
- ✅ `/root/.env` with environment variables
- ✅ `/etc/caddy/Caddyfile` configured

## Deployment Flow

1. Push to `main` branch or manually trigger workflow
2. GitHub Actions:
   - Builds frontend with production env vars
   - Deploys frontend to `/var/www/hotstocks/`
   - Deploys backend code to `/root/hotstocks-backend/`
   - Deploys docker-compose.yml
   - Rebuilds and restarts Docker containers

## Manual Deployment

If you need to deploy manually:

```bash
# Build frontend
cd frontend
npm run build

# Deploy frontend
rsync -avz --delete build/ root@95.179.155.133:/var/www/hotstocks/

# Deploy backend
rsync -avz --exclude node_modules --exclude dist backend/ root@95.179.155.133:/root/hotstocks-backend/

# Restart services
ssh root@95.179.155.133 "cd /root && docker compose up -d --build"
```

## Checking Deployment Status

```bash
# SSH to VPS
ssh root@95.179.155.133

# Check running containers
docker ps

# Check backend logs
docker logs hotstocks-backend --tail 50

# Check Caddy status
systemctl status caddy

# Test endpoints
curl https://hotones.nl
curl https://api.hotones.nl/health
```
