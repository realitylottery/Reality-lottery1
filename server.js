require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const User = require('./models/User');
const News = require('./models/News');
const Withdrawal = require('./models/Withdrawal');
const NewsTicker = require('./models/NewsTicker');
const Banner = require('./models/Banner');

const app = express();
app.use(express.json());

// ================= CORS =================
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_ORIGIN || 'https://realitylottery.koyeb.app',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) === -1) {
      const msg = 'CORS policy does not allow access from this origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

// ================= CONFIG =================
const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// ================= DATABASE =================
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
});

// ================= HELPERS =================
function generateToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username, roles: user.roles },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Invalid token format' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ================= ROUTES =================


// Create withdrawal
app.post("/api/withdrawals", authMiddleware, async (req, res) => {
  try {
    const { amount, wallet } = req.body;

    if (!amount || !wallet) {
      return res.status(400).json({ message: "Amount and wallet required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const withdrawal = new Withdrawal({
      userId: user._id,
      amount,
      walletAddress: wallet
    });

    await withdrawal.save();

    user.balance -= amount; // خصم الرصيد مؤقتًا
    await user.save();

    res.json({ message: "Withdrawal request submitted", withdrawal });

  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ message: err.message || "Error submitting withdrawal" });
  }
});
// Update user (Admin only)
app.put("/api/admin/users/:id", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const { id } = req.params;
    const { subscriptionType, balance, taskProgress } = req.body;

    const updateFields = {};
    if (subscriptionType !== undefined) updateFields.subscriptionType = subscriptionType;
    if (balance !== undefined) updateFields.balance = balance;
    if (taskProgress !== undefined) updateFields.taskProgress = taskProgress;

    const user = await User.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User updated successfully", user });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// News Ticker
app.get("/api/ticker", async (req, res) => {
  const tickers = await NewsTicker.find().sort({ createdAt: -1 });
  res.json({ tickers });
});

app.post("/api/admin/ticker", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  const ticker = new NewsTicker({ text: req.body.text });
  await ticker.save();
  res.json({ message: "Ticker added", ticker });
});

app.delete("/api/admin/ticker/:id", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  await NewsTicker.findByIdAndDelete(req.params.id);
  res.json({ message: "Ticker deleted" });
});

// Banners
app.get("/api/banners", async (req, res) => {
  const banners = await Banner.find().sort({ createdAt: -1 });
  res.json({ banners });
});

app.post("/api/admin/banners", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  const banner = new Banner(req.body);
  await banner.save();
  res.json({ message: "Banner added", banner });
});

app.delete("/api/admin/banners/:id", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  await Banner.findByIdAndDelete(req.params.id);
  res.json({ message: "Banner deleted" });
});

// جلب جميع طلبات السحب
// ================= WITHDRAWALS ROUTES =================

// // Get all withdrawals (admin)
app.get("/api/admin/withdrawals", async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find().populate("userId", "username email");
    res.json({ withdrawals });
  } catch (err) {
    res.status(500).json({ message: "Error fetching withdrawals" });
  }
});

// Approve withdrawal
app.post("/api/admin/withdrawals/:id/approve", async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate("userId");
    if (!withdrawal) return res.status(404).json({ message: "Not found" });

    withdrawal.status = "Approved";
    await withdrawal.save();

    res.json({ message: "Withdrawal approved" });
  } catch (err) {
    res.status(500).json({ message: "Error approving withdrawal" });
  }
});

// Reject withdrawal
app.post("/api/admin/withdrawals/:id/reject", async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate("userId");
    if (!withdrawal) return res.status(404).json({ message: "Not found" });

    // استرجاع الرصيد للمستخدم عند الرفض
    const user = await User.findById(withdrawal.user._id);
    user.balance += withdrawal.amount;
    await user.save();

    withdrawal.status = "Rejected";
    await withdrawal.save();

    res.json({ message: "Withdrawal rejected, balance refunded" });
  } catch (err) {
    res.status(500).json({ message: "Error rejecting withdrawal" });
  }
});

// 

app.get("/api/withdrawals", authMiddleware, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/admin/withdrawals", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  const all = await Withdrawal.find().populate("userId", "username email").sort({ createdAt: -1 });
  res.json({ withdrawals: all });
});

app.put("/api/admin/withdrawals/:id", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  try {
    const w = await Withdrawal.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ withdrawal: w });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get user balance
app.get("/api/user/balance", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ balance: user.balance || 0 });
  } catch (err) {
    console.error("Balance error:", err);
    res.status(500).json({ message: "Error fetching balance" });
  }
});

// News
app.get('/api/news', async (req, res) => {
  try {
    const news = await News.find().sort({ createdAt: -1 });
    res.json(news);
  } catch (err) {
    console.error('News fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

app.post("/api/admin/news", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  try {
    const n = new News(req.body);
    await n.save();
    res.json({ message: "News added", news: n });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/admin/news/:id", authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  try {
    await News.findByIdAndDelete(req.params.id);
    res.json({ message: "News deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date() })
);

// Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, username, password, referral } = req.body;
    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });
    if (existing)
      return res.status(409).json({ message: 'Email or username already used' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = new User({
      fullName,
      email: email.toLowerCase(),
      phone,
      username,
      password: hash,
      referral: referral || null
    });

    await user.save();

    const token = generateToken(user);

    return res.status(201).json({
      message: 'User registered',
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email
      },
      token
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const query = usernameOrEmail.includes('@')
      ? { email: usernameOrEmail.toLowerCase() }
      : { username: usernameOrEmail };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Admin login
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'RealityLottery@2023';

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign(
      { username, roles: ['admin'] },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ message: 'Admin login successful', token });
  } else {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }
});

app.get('/api/admin/users', authMiddleware, async (req, res) => {
  try {
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const users = await User.find().select('-password').sort({ registeredAt: -1 });
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= STATIC FILES =================
const FRONTEND_PATH = process.env.FRONTEND_PATH || path.join(__dirname, 'public');
app.use(express.static(FRONTEND_PATH));

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

const MEDIA_PATH = process.env.MEDIA_PATH || path.join(__dirname, 'media');
app.use('/media', express.static(MEDIA_PATH));

const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOADS_PATH));

const DOCS_PATH = process.env.DOCS_PATH || path.join(__dirname, 'docs');
app.use('/docs', express.static(DOCS_PATH));

// SPA fallback (always last)
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend served from: ${FRONTEND_PATH}`);
  console.log(`🗂 Media path: ${MEDIA_PATH}`);
});
















