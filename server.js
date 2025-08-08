const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// ====== إعدادات عامة محسنة ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: ["https://realitylottery.koyeb.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// ====== اتصال قاعدة بيانات محسن ======
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/realitylottery";

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => console.log("✅ MongoDB Connected Successfully"))
.catch(err => {
  console.error("❌ MongoDB Connection Error:", err.message);
  process.exit(1); // إغلاق التطبيق إذا فشل الاتصال
});

// ====== تعريف Schema محسن ======
const paymentSchema = new mongoose.Schema({
  txid: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  phone: { 
    type: String, 
    required: true,
    trim: true
  },
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"],
    default: "pending" 
  },
  date: { 
    type: Date, 
    default: Date.now,
    index: true // لتحسين أداء الاستعلامات
  }
}, {
  timestamps: true // يضيف createdAt و updatedAt تلقائياً
});

const Payment = mongoose.model("Payment", paymentSchema);

// ====== Middleware للتحقق من البيانات ======
const validatePaymentInput = (req, res, next) => {
  const { txid, phone } = req.body;
  if (!txid || !phone) {
    return res.status(400).json({ 
      success: false,
      error: "txid and phone are required" 
    });
  }
  next();
};

// ====== API حفظ دفعة محسن ======
app.post("/api/payment", validatePaymentInput, async (req, res) => {
  try {
    const { txid, phone } = req.body;

    // التحقق من عدم وجود txid مكرر
    const existingPayment = await Payment.findOne({ txid });
    if (existingPayment) {
      return res.status(409).json({
        success: false,
        error: "Transaction ID already exists"
      });
    }

    const newPayment = new Payment({
      txid,
      phone
    });

    await newPayment.save();
    
    res.status(201).json({ 
      success: true,
      message: "✅ Payment saved successfully", 
      data: newPayment 
    });

  } catch (err) {
    console.error("Payment Save Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Internal server error",
      details: err.message 
    });
  }
});

// ====== API عرض الدفعات المعلقة محسن ======
app.get("/api/pending-payments", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { date: -1 } // الأحدث أولاً
    };

    const result = await Payment.paginate(
      { status: { $in: ["pending", "rejected"] } },
      options
    );

    res.json({
      success: true,
      data: result.docs,
      pagination: {
        total: result.totalDocs,
        pages: result.totalPages,
        page: result.page,
        limit: result.limit
      }
    });
  } catch (err) {
    console.error("Pending Payments Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch payments",
      details: err.message 
    });
  }
});

// ====== API لتغيير حالة الدفع محسن ======
app.put("/api/payment/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status value"
      });
    }

    const updatedPayment = await Payment.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedPayment) {
      return res.status(404).json({
        success: false,
        error: "Payment not found"
      });
    }

    res.json({
      success: true,
      message: "Payment status updated successfully",
      data: updatedPayment
    });
  } catch (err) {
    console.error("Update Payment Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to update payment",
      details: err.message 
    });
  }
});

// ====== تقديم ملفات الموقع ======
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== معالجة الأخطاء العامة ======
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  res.status(500).json({
    success: false,
    error: "An unexpected error occurred",
    details: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

// ====== تشغيل السيرفر ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
});
