const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// السماح لأي مصدر (لتجنب مشاكل CORS أثناء التطوير)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(bodyParser.json());

// تقديم الملفات الثابتة من مجلد public (بما فيها admin-dashboard.html)
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// تعريف سكيمات Mongoose
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  phone: String,          // إضافة رقم الهاتف
  country: String,
  isApproved: { type: Boolean, default: false },
  referrer: String,
  refCount: { type: Number, default: 0 }
});
const User = mongoose.model("User", userSchema);

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  txid: String,
  phone: String,
  approved: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});
const Payment = mongoose.model("Payment", paymentSchema);

// الاتصال بقاعدة البيانات
mongoose.connect(
  process.env.MONGODB_URI || "mongodb+srv://realitylottery:Moataz1234@realitylottery.fzcf67p.mongodb.net/?retryWrites=true&w=majority&appName=realitylottery"
)
.then(() => {
  console.log("✅ Connected to MongoDB");
})
.catch((error) => {
  console.error("❌ MongoDB connection error:", error);
});

// المسارات

// الصفحة الرئيسية (يمكنك تعديلها حسب الحاجة)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// إضافة دفعة جديدة
app.post("/api/payment", async (req, res) => {
    try {
        const { txid, phone } = req.body;

        if (!txid || !phone) {
            return res.status(400).json({ success: false, message: "البيانات ناقصة" });
        }

        const newPayment = new Payment({ txid, phone });
        await newPayment.save();

        res.json({ success: true, message: "تم تسجيل الدفع بنجاح" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "خطأ في السيرفر" });
    }
});

// تسجيل دخول المستخدم (عادي)
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

    res.json({
  message: "Login successful",
  user: {
    _id: user._id,           // أضف هذا السطر
    username: user.username,
    email: user.email,
    phone: user.phone,
    isApproved: user.isApproved
  },
  token: "mock-token"
});
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// تسجيل مستخدم جديد
app.post("/api/register", async (req, res) => {
  const { username, password, email, phone, country, referrer } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const newUser = new User({
      username,
      password,
      email,
      phone,
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

    // إرجاع بيانات المستخدم مع _id
    res.status(201).json({
      message: "User registered successfully",
      user: {
        _id: newUser._id,
        username: newUser.username
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// جلب الدفعات المعلقة (pending أو rejected)
app.get("/api/pending-payments", async (req, res) => {
  try {
    const payments = await Payment.find({ status: { $in: ["pending", "rejected"] } })
      .populate("username phone");

    const formatted = payments.map(p => ({
      txid: p.txid,
      status: p.status,
      user: {
        username: p.userId.username,
        phone: p.phone || "-"
      }
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res.status(500).json({ message: "Server error fetching payments" });
  }
});

// الموافقة على الدفع
app.post("/api/approve-payment", async (req, res) => {
  const { paymentId } = req.body;

  try {
    await Payment.findByIdAndUpdate(paymentId, { status: "approved" });
    await User.findByIdAndUpdate(userId, { isApproved: true });

    res.json({ message: "✅ Payment approved and user activated." });
  } catch (error) {
    console.error("Error approving payment:", error);
    res.status(500).json({ message: "Server error approving payment" });
  }
});

// رفض الدفع
app.post("/api/reject-payment", async (req, res) => {
  const { paymentId } = req.body;

  try {
    await Payment.findByIdAndUpdate(paymentId, { status: "rejected" });
    res.json({ message: "❌ Payment rejected." });
  } catch (error) {
    console.error("Error rejecting payment:", error);
    res.status(500).json({ message: "Server error rejecting payment" });
  }
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});





