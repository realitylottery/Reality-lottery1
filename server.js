const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/realitylottery", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ Connected to MongoDB");
}).catch(err => {
  console.error("❌ MongoDB connection error:", err);
});

const userSchema = new mongoose.Schema({
  userId: { type: String, default: uuidv4, unique: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // كلمة المرور مخزنة نص صريح
  email: { type: String, required: true, unique: true },
  country: String,
  phone: String,
  isApproved: { type: Boolean, default: false },
  referrer: String,
  refCount: { type: Number, default: 0 }
});

const paymentSchema = new mongoose.Schema({
  txid: { type: String, required: true, unique: true },
  phone: String,
  status: { type: String, default: "pending" },
  date: { type: Date, default: Date.now },
  userId: String,
});

const User = mongoose.model("User", userSchema);
const Payment = mongoose.model("Payment", paymentSchema);

app.post("/api/register", async (req, res) => {
  const { username, email, country, password, phone, referrer } = req.body;

  if (!username || !email || !password || !phone) {
    return res.status(400).json({ message: "جميع الحقول المطلوبة مطلوبة" });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: "اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً" });
    }

    // تخزين كلمة المرور نص صريح
    const newUser = new User({
      username,
      email,
      country,
      password,
      phone,
      referrer
    });

    await newUser.save();

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

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).json({ success: false, message: "الرجاء إدخال اسم المستخدم وكلمة المرور" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ success: false, message: "المستخدم غير موجود" });

    // التحقق من كلمة المرور نص صريح
    if (password !== user.password) {
      return res.status(401).json({ success: false, message: "كلمة المرور خاطئة" });
    }

    if (!user.isApproved) {
      return res.status(403).json({ success: false, message: "لم يتم الموافقة على حسابك بعد" });
    }

    res.json({ success: true, message: "تم تسجيل الدخول بنجاح", user: { username: user.username, userId: user.userId } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "خطأ في السيرفر" });
  }
});

// باقي الكود كما هو بدون تغيير

app.post("/api/payment", async (req, res) => {
  const { txid, phone } = req.body;

  if (!txid || !phone) return res.status(400).json({ message: "رقم العملية ورقم الهاتف مطلوبان" });

  try {
    const existingPayment = await Payment.findOne({ txid });
    if (existingPayment) {
      return res.status(400).json({ message: "رقم العملية هذا تم تسجيله مسبقاً" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "لم يتم العثور على مستخدم بهذا الرقم" });
    }

    const newPayment = new Payment({
      txid,
      phone,
      status: "pending",
      userId: user.userId
    });

    await newPayment.save();

    res.json({ message: "تم تسجيل عملية الدفع بنجاح، في انتظار الموافقة" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

app.get("/api/payment", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ date: -1 });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

app.put("/api/payment/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "حالة غير صحيحة" });
  }

  try {
    const payment = await Payment.findByIdAndUpdate(id, { status }, { new: true });

    if (!payment) return res.status(404).json({ error: "عملية الدفع غير موجودة" });

    if (status === "approved") {
      await User.findOneAndUpdate({ userId: payment.userId }, { isApproved: true });
    }

    res.json({ message: `تم تحديث حالة الدفع إلى ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
