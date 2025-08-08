const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

// Middlewares - يجب أن تكون قبل الراوتات
app.use(cors());
app.use(bodyParser.json());

// متغير البورت من البيئة أو 3000 محليًا
const PORT = process.env.PORT || 3000;

// سكيمات mongoose
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  country: String,
  isApproved: { type: Boolean, default: false },
  referrer: String,
  refCount: { type: Number, default: 0 }
});
const User = mongoose.model("User", userSchema);

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  txid: String,
  approved: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});
const Payment = mongoose.model("Payment", paymentSchema);

// الاتصال بقاعدة البيانات
mongoose.connect("mongodb+srv://realitylottery:Moataz1234@realitylottery.fzcf67p.mongodb.net/?retryWrites=true&w=majority&appName=realitylottery")
.then(() => {
  console.log("✅ Connected to MongoDB");
})
.catch((error) => {
  console.error("❌ MongoDB connection error:", error);
});

// Routes

// Health check or default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'main', 'index.html'));
});

// إرسال الدفع
app.post("/api/payment", async (req, res) => {
  const { userId, txid } = req.body;
  if (!userId || !txid) return res.status(400).json({ message: "Missing data" });

  const payment = new Payment({ userId, txid });
  await payment.save();
  res.json({ message: "Payment submitted. Waiting for admin approval." });
});

// تسجيل الدخول
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    if (!user.isApproved) {
      return res.status(403).json({ message: "Your payment is under review." });
    }

    // هنا ممكن تضيف JWT لاحقاً
    res.json({
      message: "Login successful",
      user: {
        username: user.username,
        email: user.email,
        isApproved: user.isApproved
      },
      token: "mock-token" // رمزي فقط
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// تسجيل مستخدم جديد
app.post("/api/register", async (req, res) => {
  const { username, password, email, country, referrer } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const newUser = new User({
      username,
      password,
      email,
      country,
      referrer: referrer || null
    });

    await newUser.save();

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

// الحصول على الدفعات المعلقة
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

// الموافقة على الدفع
app.post("/api/approve-payment", async (req, res) => {
  const { paymentId, userId } = req.body;

  await Payment.findByIdAndUpdate(paymentId, { approved: true });
  await User.findByIdAndUpdate(userId, { isApproved: true });

  res.json({ message: "✅ Payment approved and user activated." });
});

// بدء السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});



