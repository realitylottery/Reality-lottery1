// server.js أو index.js - ملف السيرفر كامل مع التعديلات المطلوبة

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// ======== Middleware ========
app.use(cors());
app.use(express.json());

// ======== الاتصال بقاعدة البيانات ========
mongoose.connect("mongodb://localhost:27017/realitylottery", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ Connected to MongoDB");
}).catch(err => {
  console.error("❌ MongoDB connection error:", err);
});

// ======== Schema & Models ========

const userSchema = new mongoose.Schema({
  userId: { type: String, default: uuidv4, unique: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  country: String,
  phone: String, // رقم الهاتف مع كود الدولة
  isApproved: { type: Boolean, default: false },
  referrer: String,
  refCount: { type: Number, default: 0 }
});

const paymentSchema = new mongoose.Schema({
  txid: { type: String, required: true, unique: true },
  phone: String,
  status: { type: String, default: "pending" }, // pending, approved, rejected
  date: { type: Date, default: Date.now },
  userId: String, // ربط الدفع بالمستخدم
});

const User = mongoose.model("User", userSchema);
const Payment = mongoose.model("Payment", paymentSchema);

// ======== Routes ========

// تسجيل مستخدم جديد مع حفظ userId و phone مع كود الدولة
app.post("/api/register", async (req, res) => {
  const { username, email, country, password, phone, referrer } = req.body;

  if (!username || !email || !password || !phone) {
    return res.status(400).json({ message: "جميع الحقول المطلوبة مطلوبة" });
  }

  try {
    // التحقق من وجود المستخدم
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: "اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً" });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // إنشاء مستخدم جديد
    const newUser = new User({
      username,
      email,
      country,
      password: hashedPassword,
      phone,
      referrer
    });

    // حفظ المستخدم
    await newUser.save();

    // زيادة عدد الدعوات للمُحيل إذا كان موجود
    if (referrer) {
      const refUser = await User.findOne({ username: referrer });
      if (refUser) {
        refUser.refCount += 1;
        await refUser.save();
      }
    }

    res.json({ message: "تم التسجيل بنجاح" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// تسجيل الدخول
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).json({ success: false, message: "الرجاء إدخال اسم المستخدم وكلمة المرور" });

  try {
    // البحث عن المستخدم حسب اسم المستخدم أو البريد
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ success: false, message: "المستخدم غير موجود" });

    // التحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "كلمة المرور خاطئة" });

    // تحقق من حالة الموافقة
    if (!user.isApproved) {
      return res.status(403).json({ success: false, message: "لم يتم الموافقة على حسابك بعد" });
    }

    // تسجيل الدخول ناجح
    res.json({ success: true, message: "تم تسجيل الدخول بنجاح", user: { username: user.username, userId: user.userId } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "خطأ في السيرفر" });
  }
});

// إضافة دفعة دفع جديدة مع ربطها بالمستخدم حسب رقم الهاتف
app.post("/api/payment", async (req, res) => {
  const { txid, phone } = req.body;

  if (!txid || !phone) return res.status(400).json({ message: "رقم العملية ورقم الهاتف مطلوبان" });

  try {
    // التحقق من وجود دفع بنفس رقم العملية مسبقاً
    const existingPayment = await Payment.findOne({ txid });
    if (existingPayment) {
      return res.status(400).json({ message: "رقم العملية هذا تم تسجيله مسبقاً" });
    }

    // إيجاد المستخدم بناءً على رقم الهاتف
    const user = await User.findOne({ phone });

    // إذا لم يوجد المستخدم بناءً على رقم الهاتف
    if (!user) {
      return res.status(404).json({ message: "لم يتم العثور على مستخدم بهذا الرقم" });
    }

    // إنشاء سجل الدفع مرتبط بالمستخدم
    const newPayment = new Payment({
      txid,
      phone,
      status: "pending",
      userId: user.userId
    });

    await newPayment.save();

    // إرسال رسالة نجاح
    res.json({ message: "تم تسجيل عملية الدفع بنجاح، في انتظار الموافقة" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// استرجاع كل دفعات الدفع (صفحة الأدمن)
app.get("/api/payment", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ date: -1 });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// تحديث حالة الدفع (الموافقة أو الرفض)
app.put("/api/payment/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // approved أو rejected

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "حالة غير صحيحة" });
  }

  try {
    // تحديث حالة الدفع
    const payment = await Payment.findByIdAndUpdate(id, { status }, { new: true });

    if (!payment) return res.status(404).json({ error: "عملية الدفع غير موجودة" });

    // إذا تمت الموافقة على الدفع، يتم تحديث حالة المستخدم
    if (status === "approved") {
      await User.findOneAndUpdate({ userId: payment.userId }, { isApproved: true });
    }

    res.json({ message: `تم تحديث حالة الدفع إلى ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

// API لفحص حالة الموافقة حسب اسم المستخدم (waiting.html)
app.post("/api/check-approval", async (req, res) => {
  const { username } = req.body;

  if (!username) return res.status(400).json({ error: "Missing username" });

  try {
    const user = await User.findOne({ username });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ approved: user.isApproved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----- إضافة endpoint لعرض بيانات مستخدم مفصل (اختياري)

app.get("/api/user/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }, "-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======== بدء تشغيل السيرفر ========
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
