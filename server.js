const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;
const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  txid: String,
  approved: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const Payment = mongoose.model("Payment", paymentSchema);

// Endpoint to submit payment
app.post("/api/payment", async (req, res) => {
  const { userId, txid } = req.body;
  if (!userId || !txid) return res.status(400).json({ message: "Missing data" });

  const payment = new Payment({ userId, txid });
  await payment.save();
  res.json({ message: "Payment submitted. Waiting for admin approval." });
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect("mongodb+srv://realitylottery:Moataz1234@realitylottery.fzcf67p.mongodb.net/?retryWrites=true&w=majority&appName=realitylottery", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ Connected to MongoDB");
})
.catch((error) => {
  console.error("❌ MongoDB connection error:", error);
});

// Schema for users
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  country: String,
  isApproved: { type: Boolean, default: false }
});
const User = mongoose.model("User", userSchema);

// API login route
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username, password });
  if (!user) {
    return res.json({ success: false, message: "Invalid credentials" });
  }

  if (!user.isApproved) {
    return res.json({ success: false, message: "Your payment is under review." });
  }

  res.json({ success: true, message: "Login successful", user });
});

// Simple Test Route
app.get("/", (req, res) => {
  res.send("🎉 Reality Lottery Server is running!");
});

// Get all pending payments
app.get("/api/pending-payments", async (req, res) => {
  const payments = await Payment.find({ approved: false }).populate("userId", "username");
  const formatted = payments.map(p => ({
    _id: p._id,
    txid: p.txid,
    user: {
      _id: p.userId._id,
      username: p.userId.username
    }
  }));
  res.json(formatted);
});

// Approve payment
app.post("/api/approve-payment", async (req, res) => {
  const { paymentId, userId } = req.body;

  await Payment.findByIdAndUpdate(paymentId, { approved: true });
  await User.findByIdAndUpdate(userId, { isApproved: true });

  res.json({ message: "✅ Payment approved and user activated." });
});

// 🔐 Login Route
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    // يمكن إضافة JWT لاحقًا إذا أردت
    res.json({
      message: "Login successful",
      user: {
        username: user.username,
        paymentApproved: user.paymentApproved
      },
      token: "mock-token" // رمزي فقط
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔐 Register Route
app.post("/api/register", async (req, res) => {
  const { username, password, email, country, referrer } = req.body;

  try {
    // تحقق إذا كان اسم المستخدم موجود مسبقًا
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // إنشاء مستخدم جديد
    const newUser = new User({
      username,
      password,
      email,
      country,
      referrer: referrer || null
    });

    await newUser.save();

    // إذا تم التسجيل عبر رابط إحالة referrer
    if (referrer) {
      await User.findOneAndUpdate(
        { username: referrer },
        { $inc: { refCount: 1 } }
      );
    }

    res.status(201).json({ message: "User registered successfully" });

  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
});
 

// ✅ Default route
app.get("/", (req, res) => {
  res.send("🎉 Reality Lottery Server is running!");
});
 
// Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
