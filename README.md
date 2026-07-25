# 🩸 Lifeline — Blood Donation Platform (Server)

A production-grade REST API powering **Lifeline**, a full-stack blood donation platform that connects willing blood donors with patients and families in urgent need across Bangladesh. Built with **Node.js**, **Express**, and **MongoDB Atlas**.

> **Client repo:** [fahim3101/blood-donation-client](https://github.com/fahim3101/blood-donation-client)
> **Server repo:** [fahim3101/blood-donation-server](https://github.com/fahim3101/blood-donation-server)
> **Live API:** https://blood-donation-server-brown-eight.vercel.app
> **Live Client:** https://blood-donation-client-indol.vercel.app

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Architecture & Folder Structure](#-architecture--folder-structure)
- [Data Model](#-data-model)
- [API Endpoints](#-api-endpoints)
- [Authentication & Authorization](#-authentication--authorization)
- [Environment Variables](#-environment-variables)
- [Local Development](#-local-development)
- [Deployment](#-deployment)
- [Security Notes](#-security-notes)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🌟 Overview

The Lifeline server is the single source of truth for authentication, role-based access control, donation request lifecycle management, donor search by blood group and location, and Stripe-powered funding. It is a stateless JSON API designed to run as a Node.js process in development and as a serverless function on Vercel in production.

**Highlights**

- Stateless JWT authentication with a 7-day token lifetime
- Three-tier role system — **Donor**, **Volunteer**, **Admin** — enforced via middleware
- Full donation request lifecycle: `pending → inprogress → done | canceled`
- Public donor directory searchable by blood group, district, and upazila
- Stripe payment integration for platform funding
- Paginated, filterable lists for users, donation requests, and fundings
- Aggregated dashboard statistics and time-series chart data for admins

---

## 🧰 Tech Stack

| Layer       | Technology                       |
|-------------|----------------------------------|
| Runtime     | Node.js                          |
| Framework   | Express 4                        |
| Database    | MongoDB Atlas (native driver)    |
| Auth        | JSON Web Tokens (`jsonwebtoken`) |
| Hashing     | `bcryptjs`                       |
| Payments    | Stripe (Payment Intents API)     |
| CORS        | `cors`                           |
| Config      | `dotenv`                         |
| Dev Server  | `nodemon`                        |
| Deployment  | Vercel (Serverless)              |

---

## 🏗 Architecture & Folder Structure

```
server/
├── index.js              # Express app, MongoDB connection, all routes
├── middleware/
│   └── verifyToken.js    # JWT verification middleware
├── data/
│   └── geoData.js        # Static Bangladesh districts & upazilas dataset
├── vercel.json           # Vercel routing config (serverless entry)
├── .env.example          # Template for required env vars
├── package.json
└── README.md
```

The application is intentionally a single-file Express server to keep cold-start latency low on Vercel's serverless runtime. Cross-cutting concerns (auth, role checks) are extracted into middleware; static geo data lives in a dedicated module.

---

## 🗃 Data Model

### `users` collection

| Field         | Type     | Notes                                          |
|---------------|----------|------------------------------------------------|
| `name`        | string   | Display name                                   |
| `email`       | string   | Unique, used as login ID                       |
| `password`    | string   | bcrypt hash (10 rounds), never returned in API |
| `avatar`      | string   | URL (ImageBB)                                  |
| `bloodGroup`  | string   | `A+`, `A-`, `B+`, `B-`, `O+`, `O-`, `AB+`, `AB-` |
| `district`    | string   | Bangladesh district                            |
| `upazila`     | string   | Bangladesh upazila                             |
| `role`        | string   | `donor` (default) \| `volunteer` \| `admin`   |
| `status`      | string   | `active` (default) \| `blocked`                |
| `createdAt`   | date     | Server timestamp                               |

### `donationRequests` collection

| Field             | Type     | Notes                                                    |
|-------------------|----------|----------------------------------------------------------|
| `recipientName`   | string   |                                                          |
| `recipientDistrict`, `recipientUpazila` | string |                                              |
| `hospitalName`    | string   |                                                          |
| `fullAddress`     | string   |                                                          |
| `bloodGroup`      | string   |                                                          |
| `donationDate`    | string   | ISO date                                                 |
| `donationTime`    | string   |                                                          |
| `requestMessage`  | string   |                                                          |
| `requesterEmail`  | string   | FK → `users.email`                                       |
| `donationStatus`  | string   | `pending` \| `inprogress` \| `done` \| `canceled`        |
| `donorInfo`       | object   | `{ name, email, bloodGroup, district, upazila }` when claimed |
| `createdAt`       | date     |                                                          |

### `fundings` collection

| Field     | Type   | Notes                       |
|-----------|--------|-----------------------------|
| `name`    | string | Donor name                  |
| `email`   | string | Donor email                 |
| `amount`  | number | USD                         |
| `date`    | date   | Server timestamp            |

---

## 🔌 API Endpoints

All endpoints are prefixed with the deployment base URL. Protected routes require an `Authorization: Bearer <token>` header.

### Auth & Users

| Method | Route                          | Auth   | Role            | Description                                      |
|--------|--------------------------------|--------|-----------------|--------------------------------------------------|
| POST   | `/users`                       | —      | —               | Register a new user (role forced to `donor`)     |
| POST   | `/jwt`                         | —      | —               | Login — returns `{ token, user }`                |
| GET    | `/users/:email`                | ✅     | self or admin   | Get a single user (password omitted)             |
| PATCH  | `/users/profile/:email`        | ✅     | self only       | Update own profile                               |
| GET    | `/users`                       | ✅     | admin           | List users (paginated, `?status=active/blocked`) |
| PATCH  | `/users/status/:id`            | ✅     | admin           | Block / unblock a user                           |
| PATCH  | `/users/role/:id`              | ✅     | admin           | Change user role                                 |

### Donor Directory (public)

| Method | Route                  | Auth | Description                                        |
|--------|------------------------|------|----------------------------------------------------|
| GET    | `/search-donors`       | —    | Filter by `bloodGroup`, `district`, `upazila`      |
| GET    | `/districts`           | —    | List of all Bangladesh districts                   |
| GET    | `/upazilas/:district`  | —    | Upazilas for a given district                      |

### Donation Requests

| Method | Route                                  | Auth | Role                       | Description                                       |
|--------|----------------------------------------|------|----------------------------|---------------------------------------------------|
| POST   | `/donation-requests`                   | ✅   | donor (active)             | Create a request                                  |
| GET    | `/donation-requests/pending`           | —    | public                     | Recent pending requests (optional `?limit=N`)     |
| GET    | `/donation-requests/recent`            | ✅   | any                        | Logged-in user's 3 most recent requests           |
| GET    | `/donation-requests/mine`              | ✅   | any                        | Own requests (paginated, `?status=`)             |
| GET    | `/donation-requests/all`               | ✅   | admin / volunteer          | All requests (paginated, `?status=`)              |
| GET    | `/donation-requests/:id`               | ✅   | any                        | Single request                                    |
| PATCH  | `/donation-requests/:id`               | ✅   | owner or admin             | Edit request body                                 |
| PATCH  | `/donation-requests/:id/status`        | ✅   | owner / privileged / donor | `pending → inprogress → done/canceled`            |
| DELETE | `/donation-requests/:id`               | ✅   | owner or admin             | Delete request                                    |

### Statistics

| Method | Route                          | Auth | Role                | Description                                       |
|--------|--------------------------------|------|---------------------|---------------------------------------------------|
| GET    | `/admin-stats`                 | ✅   | admin / volunteer   | `{ totalUsers, totalRequests, totalFunding }`     |
| GET    | `/donation-requests-chart`     | ✅   | admin / volunteer   | Time series of requests per day (last 30)         |

### Funding (Stripe)

| Method | Route                   | Auth | Description                                           |
|--------|-------------------------|------|-------------------------------------------------------|
| POST   | `/create-payment-intent` | ✅  | Create a Stripe PaymentIntent and return `clientSecret` |
| POST   | `/fundings`             | ✅   | Persist a successful funding record                    |
| GET    | `/fundings`             | ✅   | Paginated list of fundings                            |

---

## 🔐 Authentication & Authorization

- **Password storage** — `bcryptjs` with a 10-round salt. The hash, never the plaintext, is stored in MongoDB.
- **JWT** — On `/jwt` login, a token is signed with `JWT_ACCESS_SECRET` and a 7-day expiry. The token is returned to the client and attached as `Authorization: Bearer <token>` on subsequent requests.
- **Middleware chain** — `verifyToken` decodes the JWT and attaches `req.decoded`. The role-specific middlewares (`verifyAdmin`, `verifyAdminOrVolunteer`) live alongside the routes that use them, so they can access the bound `usersCollection`.
- **Token contents** — `{ email, role, iat, exp }`. The role is re-checked on every privileged call from the database, so a demoted user cannot retain access until their token expires.

---

## 🌐 Environment Variables

Copy `.env.example` to `.env` and fill in the values. **Never commit `.env`.**

| Variable               | Required | Description                                                                 |
|------------------------|----------|-----------------------------------------------------------------------------|
| `DB_USER`              | ✅       | MongoDB Atlas username                                                      |
| `DB_PASS`              | ✅       | MongoDB Atlas password                                                      |
| `DB_CLUSTER`           | ✅       | Cluster host (e.g. `cluster0.abcde.mongodb.net`)                            |
| `DB_URI`               | ◻︎       | Optional full connection string; overrides the three above if set           |
| `JWT_ACCESS_SECRET`    | ✅       | Long random string. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `STRIPE_SECRET_KEY`    | ◻︎       | Stripe secret key (test mode starts with `sk_test_…`). If absent, funding endpoints return 500. |
| `PORT`                 | ◻︎       | Defaults to `5000`                                                          |

---

## 🛠 Local Development

**Prerequisites:** Node.js 18+ and a MongoDB Atlas cluster (free tier is fine).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# edit .env with your real values

# 3. Start the dev server (auto-reload via nodemon)
npm run dev
```

The server listens on `http://localhost:5000` by default and logs `✅ Connected to MongoDB successfully!` on a healthy boot.

### Smoke tests

```bash
# Health check
curl http://localhost:5000/

# List districts
curl http://localhost:5000/districts

# Search donors
curl "http://localhost:5000/search-donors?bloodGroup=A%2B&district=Dhaka"
```

### Project scripts

| Script         | Description                       |
|----------------|-----------------------------------|
| `npm start`    | Run with `node` (production)      |
| `npm run dev`  | Run with `nodemon` (auto-reload)  |

---

## 🚀 Deployment

The project ships with a `vercel.json` that wires the entire request space to `index.js` as a serverless function:

```json
{ "version": 2, "builds": [{ "src": "index.js", "use": "@vercel/node" }], "routes": [{ "src": "/(.*)", "dest": "index.js" }] }
```

**Steps**

1. Push the `server/` directory to its own Git repository (or configure Vercel to use the `server` subdirectory as the root).
2. Import the repo into Vercel as a new project.
3. Add every variable from the [Environment Variables](#-environment-variables) table to the Vercel project settings.
4. Deploy. Vercel will detect the Node runtime and expose the server at `https://<project>.vercel.app`.

The Stripe client is **lazy-initialized** — if `STRIPE_SECRET_KEY` is missing, the server still boots so setup is not blocked, but the funding endpoints will respond with `500`.

---

## 🛡 Security Notes

- All write endpoints (except registration) require a valid JWT.
- Role checks re-read the user from the database, so a stale token cannot escalate after a demotion.
- Passwords are never returned by any route — the `password` field is explicitly projected out.
- The Stripe secret key only ever lives server-side; the publishable key is held by the client.
- **Before going live**, rotate the JWT secret, restrict the MongoDB Atlas network access list, and switch Stripe to live mode.

---

## 🧭 Roadmap

- [ ] Refresh-token flow to allow silent session extension
- [ ] Email verification on registration
- [ ] Rate limiting on `/jwt` and `/users`
- [ ] Request-level audit log for admin actions
- [ ] Soft delete (`status: 'archived'`) for donation requests
- [ ] Webhooks from Stripe for funding status reconciliation

---

## 📄 License

MIT © Lifeline contributors
