# Lifeline - Blood Donation Platform (Server)

This is the backend (Node.js + Express + MongoDB) for **Lifeline**, a blood donation
platform that connects donors with people who need blood, with role-based dashboards
for Donors, Volunteers, and Admins.

## Live API
https://your-server-link.vercel.app

## Features
- JWT based authentication & API protection
- Role-based access control (Admin / Donor / Volunteer)
- Donation request lifecycle: pending → inprogress → done/canceled
- Donor search by blood group, district & upazila
- Stripe payment integration for funding
- Pagination & filtering on donation requests and users
- Aggregated stats & chart data for the admin dashboard

## NPM Packages Used
- express
- mongodb
- cors
- dotenv
- jsonwebtoken
- bcryptjs
- stripe
- nodemon (dev)

## Setup Instructions (local)
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your own MongoDB Atlas, JWT secret, and Stripe keys
3. `npm run dev` (uses nodemon) or `npm start`

The server will start on `http://localhost:5000`
