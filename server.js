const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// ====== إعدادات عامة ======
app.use(express.json());
app.use(cors({
  origin: ["https://realitylottery.koyeb.app"], // السماح لموقعك فقط
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

// ====== الاتصال بقاعدة البيانات ======
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Error:", err));

// ====== تعريف Schema ======
const paymentSchema = new mongoose.Schema({
  txid: String,
  phone: String,
  status: { type: String, default: "pending" }, // الحالة الافتراضية
  date: { type: Date, default: Date.now }
});

const Payment = mongoose.model("Payment", paymentSchema);

// ====== API حفظ دفعة ======
app.post("/api/payment", async (req, res) => {
  try {
    const { txid, phone } = req.body;

    if (!txid || !phone) {
      return res.status(400).json({ error: "txid and phone are required" });
    }

    const newPayment = new Payment({
      txid,
      phone,
      status: "pending"
    });

    await newPayment.save();
    res.json({ message: "✅ Payment saved successfully", payment: newPayment });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ====== API عرض الدفعات المعلقة ======
app.get("/api/pending-payments", async (req, res) => {
  try {
    const payments = await Payment.find({ status: { $in: ["pending", "rejected"] } });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ====== API لتغيير حالة الدفع ======
app.put("/api/payment/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const updatedPayment = await Payment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(updatedPayment);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ====== تقديم ملفات الموقع ======
app.use(express.static(path.join(__dirname, "public"))); // مجلد ملفاتك

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== تشغيل السيرفر ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
