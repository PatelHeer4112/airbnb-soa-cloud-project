# Deployment Guide (for Member 3)

> **Nothing has been deployed.** Member 1 prepared the code and this guide only. No AWS resources,
> accounts, credentials or paid services were created or used. Deployment is Member 3's responsibility
> and should only be done with the team's agreement on cost.

## 1. What the backend needs

| Item | Value |
|---|---|
| Runtime | Node.js 20 or newer (developed and tested on Node.js 26.13.0) |
| Install | `npm ci --omit=dev` (production dependencies only) |
| Start command | `npm start` (= `node src/server.js`) |
| Port | `PORT` env var (default `5000`) |
| Database | MongoDB 6.0+ reachable via `MONGODB_URI` (developed on MongoDB 9.0.4) |
| Health check | `GET /health` → `200` when healthy, `503` when the DB is down |
| Shutdown | handles `SIGTERM` (closes HTTP server then DB connection, 10 s timeout) |
| Proxy | `trust proxy` = 1 hop, suitable behind one load balancer / Nginx |
| State | stateless: no sessions or local files, so several instances can run behind a load balancer |

### Environment variables

| Variable | Example (production) | Notes |
|---|---|---|
| `NODE_ENV` | `production` | enables Apache-style logs; seed refuses to run without `--force` |
| `PORT` | `5000` | |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/airbnb_soa` or an Atlas `mongodb+srv://...` URI | **secret if it contains a password**: never commit it |
| `CORS_ORIGIN` | `https://your-frontend-domain` | exact frontend origin(s), comma-separated; avoid `*` |

Store secrets in the server's environment (or AWS Systems Manager Parameter Store / Secrets Manager;
check their pricing first), never in git.

### Measured resource use (local laptop, 2026-11-11)

| Measurement | Result |
|---|---|
| Node process memory, idle, production mode | ≈ 82 MB |
| Memory after 300 sequential search requests | ≈ 88 MB |
| 300 sequential `GET /api/search` requests from PowerShell (includes client overhead) | 3.9 s total |

This is **not** a load test; it only shows the process is small. Member 3's load tests should measure real
throughput and latency. A 1 GB RAM instance comfortably fits Node.js; running MongoDB on the **same**
instance needs more headroom (MongoDB's cache uses about 50% of (RAM − 1 GB), minimum 256 MB), so 1 GB is tight and 2 GB is safer.

## 2. Deployment steps (generic Linux server)

```bash
# On the server
sudo apt-get update && sudo apt-get install -y git
# install Node.js 20+ (e.g. from NodeSource or nvm) and MongoDB, or use an external MongoDB URI

git clone https://github.com/PatelHeer4112/airbnb-soa-cloud-project.git
cd airbnb-soa-cloud-project/backend
npm ci --omit=dev

cat > .env <<'EOF'
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/airbnb_soa
CORS_ORIGIN=https://your-frontend-domain
EOF

npm run seed -- --force   # only once, only for a demo database: it deletes existing data
npm start                 # or use a process manager, see below
curl http://localhost:5000/health
```

Keep the process running and restart it on crashes or reboots with a process manager such as
**PM2** (`npm i -g pm2 && pm2 start src/server.js --name airbnb-api && pm2 save && pm2 startup`)
or a `systemd` service. Put **Nginx** in front for port 80/443 and TLS if not using a load balancer.

## 3. Database options and their costs

| Option | Cost facts (verify before use) | Notes |
|---|---|---|
| **MongoDB on the same server** | No extra service charge; uses the instance's CPU/RAM/disk, which you pay for (or which use your AWS free credits) | Simplest. Back up the data yourself. |
| **MongoDB Atlas M0 (free cluster)** | Free cluster tier with a storage cap of 512 MB and shared, throttled resources; no credit card needed for M0 at the time of writing | Hosted outside your AWS bill. Limits on connections/throughput can distort load tests. Never click "upgrade" (M10+ is paid). |
| Amazon DocumentDB | **Paid**: no always-free tier | Not recommended for this project. |

The backend works with all of these because it does **not** rely on multi-document transactions
(see `ARCHITECTURE.md` §4).

## 4. AWS cost warnings (please read before creating anything)

- AWS's free offer depends on **when the account was created**. Accounts created on or after
  15 July 2025 get a *Free plan* with sign-up credits (currently advertised as up to US $200) for a limited
  period, instead of the older 12-month free tier. Older accounts may still have the legacy 12-month free tier.
  **Check <https://aws.amazon.com/free/> and the Billing console for your own account's terms.**
- The free offer does **not** guarantee a zero bill. Common surprise charges:
  - public IPv4 addresses (charged hourly, including Elastic IPs),
  - NAT gateways and Application Load Balancers (hourly + per-GB),
  - data transfer out to the internet beyond the free allowance,
  - EBS volumes and snapshots that keep existing after an instance is stopped or terminated,
  - CloudWatch logs/metrics beyond free limits,
  - load-testing traffic itself.
- **Before deploying:** set an AWS Budget with an email alert at a small amount (e.g. $1), and enable
  Free Tier usage alerts in the Billing console.
- **After the evaluation:** terminate instances, delete EBS volumes/snapshots, release Elastic IPs and
  delete load balancers.

Free alternatives for a demo with zero cloud spend: run the backend on a laptop and expose it temporarily with a
free tunnelling tool, or record the demo locally.

## 5. Suggested low-cost AWS layout (for Member 3 to decide)

```
Browser ──HTTPS──► (optional) ALB  ──►  EC2 t3.micro / t4g.small (Node.js + PM2 + Nginx)
                                             │
                                             └──► MongoDB on the same instance  or  Atlas M0
```

For the holiday-traffic-spike study, scaling out means running more copies of the stateless Node.js process
(more PM2 workers, or more instances behind a load balancer). The database then becomes the shared bottleneck,
which is a useful finding for the report. Load balancers and Auto Scaling groups can cost money; check pricing first.

## 6. Smoke test after deployment

```bash
BASE=https://your-api-host
curl -s $BASE/health
curl -s "$BASE/api/listings?limit=1"
curl -s "$BASE/api/search?city=London"
```

Expected: `200` responses with `"success":true`.
