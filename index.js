const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const verifyToken = require('./middleware/verifyToken');
const { districts, upazilas } = require('./data/geoData');

const app = express();
const port = process.env.PORT || 5000;

// Stripe is initialized lazily so the server can still boot without a key during setup
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// ------------------ Middleware ------------------
app.use(cors());
app.use(express.json());

// ------------------ MongoDB Setup ------------------
const uri = process.env.DB_URI || `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    await client.connect(); // ← ADD THIS LINE

    const db = client.db('bloodDonationDB');
    const usersCollection = db.collection('users');
    const donationRequestsCollection = db.collection('donationRequests');
    const fundingCollection = db.collection('fundings');
    // ... rest of the code

    // ------------------ Role check middlewares (need usersCollection, so defined inside run) ------------------
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };

    const verifyAdminOrVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      if (!user || (user.role !== 'admin' && user.role !== 'volunteer')) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };

    // ================= AUTH & USERS =================

    // Register a new user
    app.post('/users', async (req, res) => {
      const { name, email, password, avatar, bloodGroup, district, upazila } = req.body;

      const existing = await usersCollection.findOne({ email });
      if (existing) {
        return res.status(400).send({ message: 'User already exists with this email' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = {
        name,
        email,
        password: hashedPassword,
        avatar,
        bloodGroup,
        district,
        upazila,
        role: 'donor',
        status: 'active',
        createdAt: new Date(),
      };

      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // Login - issue JWT
    app.post('/jwt', async (req, res) => {
      const { email, password } = req.body;
      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(401).send({ message: 'Invalid email or password' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).send({ message: 'Invalid email or password' });
      }

      if (user.status === 'blocked') {
        return res.status(403).send({ message: 'Your account has been blocked. Contact admin.' });
      }

      const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: '7d',
      });

      const { password: pw, ...userWithoutPassword } = user;
      res.send({ token, user: userWithoutPassword });
    });

    // Get single user info (own profile, used for role checking too)
    app.get('/users/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        const requester = await usersCollection.findOne({ email: req.decoded.email });
        if (!requester || requester.role !== 'admin') {
          return res.status(403).send({ message: 'forbidden access' });
        }
      }
      const user = await usersCollection.findOne({ email }, { projection: { password: 0 } });
      res.send(user);
    });

    // Update own profile
    app.patch('/users/profile/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const { name, avatar, bloodGroup, district, upazila } = req.body;
      const result = await usersCollection.updateOne(
        { email },
        { $set: { name, avatar, bloodGroup, district, upazila } }
      );
      res.send(result);
    });

    // Get all users (admin only) - with pagination and status filter
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;

      const query = {};
      if (status && status !== 'all') {
        query.status = status;
      }

      const users = await usersCollection
        .find(query, { projection: { password: 0 } })
        .skip(page * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .toArray();

      const count = await usersCollection.countDocuments(query);
      res.send({ users, count });
    });

    // Block / Unblock user
    app.patch('/users/status/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
      res.send(result);
    });

    // Change user role
    app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role } });
      res.send(result);
    });

    // ================= SEARCH DONORS (public) =================
    app.get('/search-donors', async (req, res) => {
      const { bloodGroup, district, upazila } = req.query;
      const query = { role: { $in: ['donor', 'volunteer'] }, status: 'active' };
      if (bloodGroup) query.bloodGroup = bloodGroup;
      if (district) query.district = district;
      if (upazila) query.upazila = upazila;

      const donors = await usersCollection.find(query, { projection: { password: 0 } }).toArray();
      res.send(donors);
    });

    // ================= GEO (Districts / Upazilas) =================
    app.get('/districts', (req, res) => {
      res.send(districts);
    });

    app.get('/upazilas/:district', (req, res) => {
      const district = req.params.district;
      res.send(upazilas[district] || []);
    });

    // ================= DONATION REQUESTS =================

    // Create a donation request
    app.post('/donation-requests', verifyToken, async (req, res) => {
      const requesterEmail = req.decoded.email;
      const requester = await usersCollection.findOne({ email: requesterEmail });

      if (!requester || requester.status === 'blocked') {
        return res.status(403).send({ message: 'Blocked users cannot create donation requests' });
      }

      const donationRequest = {
        ...req.body,
        requesterEmail,
        donationStatus: 'pending',
        createdAt: new Date(),
      };

      const result = await donationRequestsCollection.insertOne(donationRequest);
      res.send(result);
    });

    // Public: pending donation requests list
    app.get('/donation-requests/pending', async (req, res) => {
      const limit = parseInt(req.query.limit) || 0;
      let cursor = donationRequestsCollection.find({ donationStatus: 'pending' }).sort({ createdAt: -1 });
      if (limit) cursor = cursor.limit(limit);
      const requests = await cursor.toArray();
      res.send(requests);
    });

    // Logged-in donor's own recent 3 requests
    app.get('/donation-requests/recent', verifyToken, async (req, res) => {
      const email = req.decoded.email;
      const requests = await donationRequestsCollection
        .find({ requesterEmail: email })
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();
      res.send(requests);
    });

    // Logged-in donor's own requests (paginated + filter)
    app.get('/donation-requests/mine', verifyToken, async (req, res) => {
      const email = req.decoded.email;
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;

      const query = { requesterEmail: email };
      if (status && status !== 'all') query.donationStatus = status;

      const requests = await donationRequestsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .toArray();
      const count = await donationRequestsCollection.countDocuments(query);
      res.send({ requests, count });
    });

    // Admin / Volunteer: all requests (paginated + filter)
    app.get('/donation-requests/all', verifyToken, verifyAdminOrVolunteer, async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;

      const query = {};
      if (status && status !== 'all') query.donationStatus = status;

      const requests = await donationRequestsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .toArray();
      const count = await donationRequestsCollection.countDocuments(query);
      res.send({ requests, count });
    });

    // Single donation request details
    app.get('/donation-requests/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });
      res.send(request);
    });

    // Edit a donation request (owner or admin)
    app.patch('/donation-requests/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const existing = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });
      const requester = await usersCollection.findOne({ email: req.decoded.email });

      if (!existing) return res.status(404).send({ message: 'Request not found' });

      const isOwner = existing.requesterEmail === req.decoded.email;
      const isAdmin = requester?.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const updateFields = { ...req.body };
      delete updateFields._id;
      delete updateFields.requesterEmail;
      delete updateFields.donationStatus;

      const result = await donationRequestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );
      res.send(result);
    });

    // Update donation status (handles donate / done / cancel / volunteer-admin override)
    app.patch('/donation-requests/:id/status', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status, donorInfo } = req.body;
      const existing = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });
      const actor = await usersCollection.findOne({ email: req.decoded.email });

      if (!existing || !actor) return res.status(404).send({ message: 'Not found' });

      const isOwner = existing.requesterEmail === req.decoded.email;
      const isPrivileged = actor.role === 'admin' || actor.role === 'volunteer';
      const isDonating = status === 'inprogress' && existing.donationStatus === 'pending';

      if (!isOwner && !isPrivileged && !isDonating) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const updateDoc = { donationStatus: status };
      if (status === 'inprogress' && donorInfo) {
        updateDoc.donorInfo = donorInfo;
      }

      const result = await donationRequestsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
      res.send(result);
    });

    // Delete a donation request (owner or admin)
    app.delete('/donation-requests/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const existing = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });
      const requester = await usersCollection.findOne({ email: req.decoded.email });

      if (!existing) return res.status(404).send({ message: 'Request not found' });

      const isOwner = existing.requesterEmail === req.decoded.email;
      const isAdmin = requester?.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const result = await donationRequestsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // ================= STATS (Admin / Volunteer dashboard home) =================
    app.get('/admin-stats', verifyToken, verifyAdminOrVolunteer, async (req, res) => {
      const totalUsers = await usersCollection.countDocuments({ role: { $in: ['donor', 'volunteer'] } });
      const totalRequests = await donationRequestsCollection.countDocuments();
      const fundingAgg = await fundingCollection
        .aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }])
        .toArray();
      const totalFunding = fundingAgg[0]?.total || 0;

      res.send({ totalUsers, totalRequests, totalFunding });
    });

    // Chart data: donation requests grouped by date (last 7 days)
    app.get('/donation-requests-chart', verifyToken, verifyAdminOrVolunteer, async (req, res) => {
      const result = await donationRequestsCollection
        .aggregate([
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 30 },
        ])
        .toArray();
      res.send(result.map((r) => ({ date: r._id, count: r.count })));
    });

    // ================= FUNDING / PAYMENT (Stripe) =================
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      if (!stripe) return res.status(500).send({ message: 'Stripe is not configured on the server' });
      const { amount } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post('/fundings', verifyToken, async (req, res) => {
      const funding = { ...req.body, date: new Date() };
      const result = await fundingCollection.insertOne(funding);
      res.send(result);
    });

    app.get('/fundings', verifyToken, async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;
      const fundings = await fundingCollection
        .find()
        .sort({ date: -1 })
        .skip(page * limit)
        .limit(limit)
        .toArray();
      const count = await fundingCollection.countDocuments();
      res.send({ fundings, count });
    });

    // Confirm DB connection
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Connected to MongoDB successfully!');
  } finally {
    // client stays connected for the lifetime of the server
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('🩸 Lifeline Blood Donation server is running');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Exporting app so Vercel's Node runtime can use it as a serverless function
module.exports = app;
