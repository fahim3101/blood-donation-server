<div align="center">

# 🩸 Lifeline — Blood Donation Platform (Server)

### Stateless REST API for Bangladesh's blood donation network

Built with **Node.js • Express • MongoDB Atlas** — serverless-ready for Vercel

<br/>

[![Node](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com/atlas)
[![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io)

<br/>

[![Live API](https://img.shields.io/badge/Live_API-Vercel-2c3e50?style=for-the-badge&logo=vercel)](https://blood-donation-server-brown-eight.vercel.app)
[![Live Client](https://img.shields.io/badge/Live_Client-Vercel-c0392b?style=for-the-badge&logo=vercel)](https://blood-donation-client-indol.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[🌐 Live API](https://blood-donation-server-brown-eight.vercel.app) • [💻 Live Client](https://blood-donation-client-indol.vercel.app) • [📖 Root Docs](../README.md) • [🎨 Client Docs](../client/README.md)

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Live Links](#-live-links)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Data Model](#-data-model)
- [API Endpoints](#-api-endpoints)
- [Authentication & Authorization](#-authentication--authorization)
- [Email Service](#-email-service)
- [Environment Variables](#-environment-variables)
- [Local Development](#-local-development)
- [Deployment](#-deployment)
- [Security Notes](#-security-notes)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🌟 Overview

**Lifeline Server** is the single source of truth for auth, RBAC, donation lifecycle, donor search, and Stripe funding. Stateless JSON API — runs as a Node process locally and as a **serverless function on Vercel** in production.

<div align="center">

| Feature | Detail |
|---------|--------|
| 🔐 **Auth** | JWT 7-day, `bcryptjs` 10 rounds, role re-checked from DB |
| 👥 **Roles** | `donor` (default) • `volunteer` • `admin` — middleware enforced |
| 🔄 **Lifecycle** | `pending → inprogress → done \| canceled` + auto-cancel expired |
| 🔍 **Search** | Protected `/search-donors` by bloodGroup / district / upazila |
| 💳 **Funding** | Stripe PaymentIntents ($1–$500), paginated history |
| 📊 **Stats** | Admin charts (30-day) + public stats for Home |
| ✉️ **Emails** | Nodemailer + Gmail SMTP — reset, new request, status updates |
| 🛡️ **Hardening** | `helmet` • `cors` • `express-rate-limit` |

</div>

---

## 🔗 Live Links

| Resource | Link |
|----------|------|
| ⚡ **Live API** | [blood-donation-server-brown-eight.vercel.app](https://blood-donation-server-brown-eight.vercel.app) |
| 🌐 **Live Client** | [blood-donation-client-indol.vercel.app](https://blood-donation-client-indol.vercel.app) |
| 🔧 Server Repo | [fahim3101/blood-donation-server](https://github.com/fahim3101/blood-donation-server) |
| 💻 Client Repo | [fahim3101/blood-donation-client](https://github.com/fahim3101/blood-donation-client) |

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Framework** | Express 4 |
| **Database** | MongoDB Atlas (native `mongodb` driver) |
| **Auth** | `jsonwebtoken` (JWT, 7d expiry) |
| **Hashing** | `bcryptjs` (10 rounds) |
| **Payments** | `stripe` (Payment Intents API, lazy-initialized) |
| **Email** | `nodemailer` (Gmail SMTP, App Password) |
| **Security** | `helmet`, `cors`, `express-rate-limit` |
| **Tokens** | `crypto-js` + `crypto.randomBytes` for reset |
| **Config** | `dotenv` |
| **Dev** | `nodemon` |
| **Deploy** | Vercel Serverless (`@vercel/node`) |

---

## 🏗 Architecture

Single-file Express app for **low cold-start** on Vercel. Cross-cutting concerns extracted.

```text
server/
├── index.js                 # Express app, MongoDB, all routes, role middlewares
├── middleware/
│   └── verifyToken.js       # JWT → req.decoded (Bearer <token>)
├── data/
│   └── geoData.js           # Static Bangladesh districts & upazilas
├── utils/
│   ├── emailService.js      # Nodemailer + 3 HTML templates
│   └── tokens.js            # generateResetToken / hashToken
├── vercel.json              # { "src": "index.js", "use": "@vercel/node" }
├── .env.example
├── package.json
└── README.md
```

**Design notes:**
- `verifyToken` is shared; `verifyAdmin` / `verifyAdminOrVolunteer` live inside `run()` to close over `usersCollection`
- Stripe is **lazy-initialized** — server boots without `STRIPE_SECRET_KEY`, funding endpoints return `500`
- `passwordResets` collection has a **TTL index** (`expireAfterSeconds: 0` on `expiresAt` → 15 min)
- `autoCancelExpired()` runs at the start of list endpoints — `pending` requests with `donationDate < today` → `canceled`

---

## 🗃 Data Model

### `users`

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Display name |
| `email` | string | Unique, login ID |
| `password` | string | `bcrypt` hash, **never returned** (`projection: { password: 0 }`) |
| `avatar` | string | ImageBB URL |
| `bloodGroup` | string | `A+` `A-` `B+` `B-` `O+` `O-` `AB+` `AB-` |
| `district` | string | Bangladesh district |
| `upazila` | string | Bangladesh upazila |
| `role` | string | `donor` (default) \| `volunteer` \| `admin` |
| `status` | string | `active` (default) \| `blocked` |
| `isAvailable` | boolean | Donor availability toggle (default `true`) |
| `createdAt` | date | Server timestamp |

### `donationRequests`

| Field | Type | Notes |
|-------|------|-------|
| `recipientName` | string |  |
| `recipientDistrict` / `recipientUpazila` | string |  |
| `hospitalName` | string |  |
| `fullAddress` | string |  |
| `bloodGroup` | string |  |
| `donationDate` | string | ISO date (`YYYY-MM-DD`), validated `≥ today` |
| `donationTime` | string |  |
| `requestMessage` | string |  |
| `requesterEmail` | string | FK → `users.email` |
| `donationStatus` | string | `pending` \| `inprogress` \| `done` \| `canceled` |
| `donorInfo` | object | `{ name, email }` — **server-set from JWT**, never trusted from client |
| `createdAt` | date |  |

### `fundings`

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Donor name |
| `email` | string | Donor email |
| `amount` | number | USD (1–500) |
| `date` | date | Server timestamp |

### `passwordResets` *(TTL)*

| Field | Type | Notes |
|-------|------|-------|
| `email` | string |  |
| `tokenHash` | string | `SHA-256` of raw token |
| `expiresAt` | date | `now + 15m`, TTL index |
| `createdAt` | date |  |

---

## 🔌 API Endpoints

Base URL locally: `http://localhost:5000` • Production: `https://blood-donation-server-brown-eight.vercel.app`

> 🔒 = requires `Authorization: Bearer <token>`

### Auth & Users

| Method | Route | Auth | Role | Description |
|--------|-------|------|------|-------------|
| POST | `/users` | — | — | Register (role forced to `donor`, `isAvailable: true`) |
| POST | `/jwt` | — | — | Login → `{ token, user }` |
| GET | `/users/:email` | 🔒 | self or admin | Single user (password omitted) |
| PATCH | `/users/profile/:email` | 🔒 | self | Update `name, avatar, bloodGroup, district, upazila, isAvailable` |
| PATCH | `/users/availability/:email` | 🔒 | self | Quick `isAvailable` toggle `{ isAvailable: boolean }` |
| GET | `/users` | 🔒 | admin | List users — `?page=0&limit=10&status=active|blocked|all` → `{ users, count }` |
| PATCH | `/users/status/:id` | 🔒 | admin | Block/unblock `{ status: "active"|"blocked" }` |
| PATCH | `/users/role/:id` | 🔒 | admin | Change role `{ role: "donor"|"volunteer"|"admin" }` |

### Password Reset

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/forgot-password` | — | Request reset link → emails `CLIENT_URL/reset-password?token=...&email=...` (always `200`, no email enumeration) |
| POST | `/reset-password` | — | Submit `{ email, token, newPassword }` (min 6 chars) |

### Donor Directory & Geo

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/search-donors` | 🔒 | Filter donors — `?bloodGroup=&district=&upazila=&availableOnly=false` (default hides `isAvailable=false`) |
| GET | `/districts` | — | All Bangladesh districts |
| GET | `/upazilas/:district` | — | Upazilas for a district |

### Donation Requests

| Method | Route | Auth | Role | Description |
|--------|-------|------|------|-------------|
| POST | `/donation-requests` | 🔒 | active user | Create — validates `donationDate ≥ today`, notifies matching donors (up to 25, fire-and-forget) |
| GET | `/donation-requests/pending` | — | public | Pending list — `?page=0&limit=12` → `{ requests, count }` (auto-cancels expired) |
| GET | `/donation-requests/recent` | 🔒 | any | Own 3 most recent |
| GET | `/donation-requests/mine` | 🔒 | any | Own — `?page=0&limit=10&status=...` → `{ requests, count }` |
| GET | `/donation-requests/all` | 🔒 | admin / volunteer | All — `?page=0&limit=10&status=...` → `{ requests, count }` |
| GET | `/donation-requests/:id` | 🔒 | any | Single request |
| PATCH | `/donation-requests/:id` | 🔒 | owner or admin | Edit body (strips `_id`, `requesterEmail`, `donationStatus`) |
| PATCH | `/donation-requests/:id/status` | 🔒 | owner / privileged / donating donor | `pending→inprogress→done/canceled`; `donorInfo` set from actor's DB record; notifies requester |
| DELETE | `/donation-requests/:id` | 🔒 | owner or admin | Delete |

### Statistics

| Method | Route | Auth | Role | Description |
|--------|-------|------|------|-------------|
| GET | `/admin-stats` | 🔒 | admin / volunteer | `{ totalUsers, totalRequests, totalFunding }` |
| GET | `/public-stats` | — | public | `{ totalUsers, totalRequests, districts: 64 }` (for Home hero) |
| GET | `/donation-requests-chart` | 🔒 | admin / volunteer | `[{ date: "YYYY-MM-DD", count: N }]` — last 30 buckets |

### Funding (Stripe)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/create-payment-intent` | 🔒 | `{ amount: 1..500 }` → `{ clientSecret }` |
| POST | `/fundings` | 🔒 | Persist funding `{ name, email, amount }` |
| GET | `/fundings` | 🔒 | Paginated — `?page=0&limit=10` → `{ fundings, count }` |

### Health

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | `🩸 Lifeline Blood Donation server is running` |

**Rate limits:** Global `200 / 15m` per IP, Auth routes (`/users`, `/jwt`, `/forgot-password`, `/reset-password`) `10 / 15m`.

---

## 🔐 Authentication & Authorization

```text
POST /jwt  ──►  bcrypt.compare  ──►  jwt.sign({ email, role }, JWT_ACCESS_SECRET, { expiresIn: '7d' })
                                     │
                                     ▼
                          Authorization: Bearer <token>
                                     │
                                     ▼
                          verifyToken → req.decoded
                                     │
                          verifyAdmin / verifyAdminOrVolunteer → DB re-check
```

- **Passwords:** `bcryptjs` 10 rounds, never returned
- **JWT contents:** `{ email, role, iat, exp }` — role re-checked from DB on every privileged call (demotion is immediate)
- **Blocked users:** `status === "blocked"` → `403` on login and on `POST /donation-requests` / status updates

---

## ✉️ Email Service

`utils/emailService.js` via **Nodemailer + Gmail SMTP**.

| Trigger | Template | Recipients |
|---------|----------|------------|
| `POST /forgot-password` | `passwordResetTemplate` | Requester (15-min link) |
| `POST /donation-requests` | `newDonationRequestTemplate` | Up to 25 matching donors by `bloodGroup` |
| `PATCH /donation-requests/:id/status` | `donationStatusTemplate` | Requester (when actor ≠ requester) |

All sends are **best-effort / fire-and-forget** — failures are logged, never block the API response. If `EMAIL_USER`/`EMAIL_PASS` missing, emails are skipped and reset links are logged to stdout (visible in Vercel logs).

```
EMAIL_USER=you@gmail.com
EMAIL_PASS=<16-char App Password>   # https://myaccount.google.com/apppasswords
EMAIL_FROM="Lifeline" <you@gmail.com>
CLIENT_URL=https://blood-donation-client-indol.vercel.app
```

---

## 🌐 Environment Variables

Copy `.env.example` → `.env`. **Never commit `.env`.**

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_USER` | ✅ | MongoDB Atlas username |
| `DB_PASS` | ✅ | MongoDB Atlas password |
| `DB_CLUSTER` | ✅ | Host e.g. `cluster0.abcde.mongodb.net` |
| `DB_URI` | ◻︎ | Full connection string — overrides the three above if set |
| `JWT_ACCESS_SECRET` | ✅ | Long random hex — `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `STRIPE_SECRET_KEY` | ◻︎ | `sk_test_…` — funding `500` if missing (server still boots) |
| `EMAIL_USER` | ◻︎ | Gmail address |
| `EMAIL_PASS` | ◻︎ | Gmail App Password (not account password) |
| `EMAIL_FROM` | ◻︎ | Display from, e.g. `"Lifeline" <you@gmail.com>` |
| `CLIENT_URL` | ◻︎ | Client base for reset links — `http://localhost:5173` locally |
| `PORT` | ◻︎ | Default `5000` |

---

## 🛠 Local Development

**Prerequisites:** Node.js 18+ and a MongoDB Atlas cluster.

```bash
# 1. Install
npm install

# 2. Env
cp .env.example .env
# fill DB_USER, DB_PASS, DB_CLUSTER, JWT_ACCESS_SECRET

# 3. Dev (auto-reload)
npm run dev
# → http://localhost:5000  — logs "✅ Connected to MongoDB successfully!"
```

**Smoke tests:**

```bash
curl http://localhost:5000/
curl http://localhost:5000/districts
curl http://localhost:5000/public-stats

# Auth
curl -X POST http://localhost:5000/jwt \
  -H "Content-Type: application/json" \
  -d '{"email":"abc@gmail.com","password":"Demo@123"}'

# Protected search (use token from above)
curl "http://localhost:5000/search-donors?bloodGroup=A%2B&district=Dhaka" \
  -H "Authorization: Bearer <token>"
```

| Script | Description |
|--------|-------------|
| `npm start` | `node index.js` (production) |
| `npm run dev` | `nodemon index.js` (auto-reload) |

---

## 🚀 Deployment

`vercel.json` wires the app as a serverless function:

```json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "index.js" }]
}
```

**Vercel steps:**
1. Push `server/` as its own repo (or set Vercel **Root Directory** to `server`)
2. Import into Vercel as Node project
3. Add all vars from [Environment Variables](#-environment-variables)
4. Deploy — Vercel exposes `https://<project>.vercel.app`

> Stripe is lazy-loaded: without `STRIPE_SECRET_KEY` the server still boots, funding endpoints return `500` with a clear message.

---

## 🛡 Security Notes

- `helmet` sets secure headers; `cors` (open — restrict via allowlist for production if needed)
- `express-rate-limit` — global + stricter auth limiter
- Passwords hashed, never projected; `verifyToken` returns `401` on missing/invalid JWT
- Role checks hit DB — stale tokens cannot escalate
- Stripe secret server-only; publishable key lives in client
- **Before production:** rotate `JWT_ACCESS_SECRET`, lock Atlas IP allowlist, switch Stripe to live `sk_live_…`

---

## 🧭 Roadmap

- [ ] Refresh-token flow (silent renewal)
- [ ] Email verification on `POST /users`
- [ ] Audit log for admin actions
- [ ] Soft delete (`status: "archived"`) for requests
- [ ] Stripe webhooks for funding reconciliation
- [ ] Per-endpoint rate-limit tuning + IP blocklist

---

## 📄 License

**MIT** © Lifeline contributors

<div align="center">

Made with ❤️ for Bangladesh — *One drop. One life.*

[⬆ Back to Top](#-lifeline--blood-donation-platform-server)

</div>
