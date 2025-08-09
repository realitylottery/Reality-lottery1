// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();

/* ---------- Middlewares ---------- */
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // serve frontend

/* ---------- Config ---------- */
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI ||
  "mongodb+srv://realitylottery:Moataz1234@realitylottery.fzcf67p.mongodb.net/?retryWrites=true&w=majority&appName=realitylottery";

/* ---------- Mongoose Schemas & Models ---------- */
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // hashed
  email: { type: String, unique: true, required: true },
  country: String,
  isApproved: { type: Boolean, default: false },
  referrer: String,
  refCount: { type: Number, default: 0 }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

const paymentSchema = new mongoose.Schema({
  txid: { type: String, required: true, unique: true },
  phone: String,
  status: { type: String, default: "pending" }, // pending, approved, rejected
  date: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

const Payment = mongoose.model("Payment", paymentSchema);

/* ---------- Connect MongoDB ---------- */
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

/* ---------- Routes ---------- */

// Serve index (optional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ---- Register ----
   body: { username, password, email, country, referrer? }
*/
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, email, country, referrer } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ message: "username, email and password are required." });
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.status(400).json({ message: "Username or email already taken" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      password: hashed,
      email,
      country,
      referrer: referrer || null
    });

    await newUser.save();

    if (referrer) {
      await User.findOneAndUpdate({ username: referrer }, { $inc: { refCount: 1 } });
    }

    return res.status(201).json({ message: "User registered successfully", userId: newUser._id });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Server error during registration", details: err.message });
  }
});

/* ---- Login ----
   Accepts usernameOrEmail + password
   body: { usernameOrEmail, password }
*/
app.post("/api/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: "Please provide username/email and password" });
    }

    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid username/email or password." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid username/email or password." });
    }

    if (!user.isApproved) {
      return res.status(403).json({ message: "Your payment is under review." });
    }

    // For simplicity we return a mock token — replace with JWT if needed
    return res.json({
      message: "Login successful",
      user: { username: user.username, email: user.email, isApproved: user.isApproved, id: user._id },
      token: "mock-token"
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ---- Submit Payment ----
   body: { txid, phone, userId }
   NOTE: frontend must send userId (objectId) when submitting payment
*/
app.post("/api/payment", async (req, res) => {
  try {
    const { txid, phone, userId } = req.body;
    if (!txid || !userId) {
      return res.status(400).json({ message: "txid and userId are required" });
    }

    const existing = await Payment.findOne({ txid });
    if (existing) {
      return res.status(409).json({ error: "Transaction ID already exists" });
    }

    const newPayment = new Payment({
      txid,
      phone: phone || null,
      userId,
      status: "pending",
      date: new Date()
    });

    await newPayment.save();
    console.log("✅ Saved payment:", newPayment._id);

    return res.json({ success: true, message: "Payment submitted successfully", paymentId: newPayment._id });
  } catch (err) {
    console.error("Save error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/* ---- Get pending/review payments (admin) ----
   returns array of payments with user info
*/
app.get("/api/payment", async (req, res) => {
  try {
    const payments = await Payment.find({ status: { $in: ["pending", "rejected"] } })
      .sort({ date: -1 })
      .populate("userId", "username email");

    const formatted = payments.map(p => ({
      _id: p._id.toString(),
      txid: p.txid,
      phone: p.phone,
      status: p.status,
      date: p.date ? p.date.toISOString().split("T")[0] : "N/A",
      user: p.userId ? { id: p.userId._id, username: p.userId.username, email: p.userId.email } : null
    }));

    return res.json(formatted);
  } catch (err) {
    console.error("Error in pending-payments:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/* ---- Update payment status (admin) ----
   PUT /api/payment/:id
   body: { status } // 'approved' | 'rejected'
   When approved -> set user.isApproved = true
*/
app.put("/api/payment/:id", async (req, res) => {
  try {
    const paymentId = req.params.id;
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    payment.status = status;
    await payment.save();

    // إذا تمت الموافقة عدّل حالة المستخدم
    if (status === "approved" && payment.userId) {
      await User.findByIdAndUpdate(payment.userId, { isApproved: true });
      console.log(`✅ User ${payment.userId} set to isApproved=true`);
    }

    return res.json({ message: "Payment status updated successfully", userId: payment.userId });
  } catch (err) {
    console.error("Update payment error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---- Convenience route: approve-payment (POST) ----
   body: { paymentId }
   This sets payment.status = 'approved' and user.isApproved = true
*/
app.post("/api/approve-payment", async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ message: "paymentId required" });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    payment.status = "approved";
    await payment.save();

    if (payment.userId) {
      await User.findByIdAndUpdate(payment.userId, { isApproved: true });
    }

    return res.json({ message: "Payment approved and user activated", paymentId });
  } catch (err) {
    console.error("approve-payment error:", err);
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

/* ---- Check approval (for waiting.html) ----
   body: { username }  OR { userId }
   returns { approved: true/false }
*/
app.post("/api/check-approval", async (req, res) => {
  try {
    const { username, userId } = req.body;

    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (username) {
      user = await User.findOne({ username });
    } else {
      return res.status(400).json({ message: "username or userId required" });
    }

    if (!user) return res.status(404).json({ message: "User not found" });

    // approved if user.isApproved true OR if there's an approved payment for this user
    if (user.isApproved) return res.json({ approved: true });

    const approvedPayment = await Payment.findOne({ userId: user._id, status: "approved" });
    return res.json({ approved: !!approvedPayment });
  } catch (err) {
    console.error("check-approval error:", err);
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

/* ---- Optional: get winners (for frontend home page) ----
   example endpoint used in your frontend
*/
app.get("/api/winners", async (req, res) => {
  try {
    // افتراضياً: الفائزين محفوظين في مكان آخر. هنا نعيد آخر دفعات موافقة كمثال "فائزين"
    const winners = await Payment.find({ status: "approved" }).sort({ date: -1 }).limit(10).populate("userId", "username");
    const formatted = winners.map(w => ({ username: w.userId ? w.userId.username : "Unknown", prize: "Some Prize", date: w.date }));
    return res.json(formatted);
  } catch (err) {
    console.error("winners error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ---------- Start server ---------- */
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
