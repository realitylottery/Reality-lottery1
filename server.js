// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// ====== إعدادات الأمان والأداء ======
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// إعدادات CORS
const corsOptions = {
  origin: ["https://realitylottery.koyeb.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));

// ====== اتصال قاعدة البيانات مع معالجة محسنة للأخطاء ======
const connectToDatabase = async () => {
  try {
    // استخدام رابط افتراضي إذا لم يتم توفير MONGODB_URI
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://realitylottery:Moataz1234@realitylottery.fzcf67p.mongodb.net/?retryWrites=true&w=majority&appName=realitylottery";
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    
    console.log("✅ MongoDB Connected Successfully");
    
    // إضافة فحص اتصال دوري
    setInterval(() => {
      if (mongoose.connection.readyState !== 1) {
        console.warn("⚠️ MongoDB connection lost. Attempting to reconnect...");
        connectToDatabase();
      }
    }, 30000);
    
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log("⏳ Retrying connection in 5 seconds...");
    setTimeout(connectToDatabase, 5000);
  }
};

connectToDatabase();

// ====== تعريف نموذج الدفع مع تحسينات ======
const paymentSchema = new mongoose.Schema({
  txid: { 
    type: String, 
    required: [true, "Transaction ID is required"],
    unique: true,
    trim: true
  },
  phone: { 
    type: String, 
    required: [true, "Phone number is required"],
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
    index: true
  }
}, {
  timestamps: true // إضافة created_at و updated_at تلقائياً
});

const Payment = mongoose.model("Payment", paymentSchema);

// ====== Middleware للتحقق من البيانات ======
const validatePaymentInput = (req, res, next) => {
  const { txid, phone } = req.body;
  
  if (!txid || !txid.trim()) {
    return res.status(400).json({ 
      success: false,
      error: "Transaction ID is required" 
    });
  }
  
  if (!phone || !phone.trim()) {
    return res.status(400).json({ 
      success: false,
      error: "Phone number is required" 
    });
  }
  
  next();
};

// ====== مسارات API مع معالجة محسنة للأخطاء ======

// إرسال دفعة جديدة
app.post("/api/payment", validatePaymentInput, async (req, res) => {
  try {
    const { txid, phone } = req.body;
    const cleanTxid = txid.trim();
    const cleanPhone = phone.trim();

    // التحقق من عدم تكرار TXID
    const existingPayment = await Payment.findOne({ txid: cleanTxid });
    if (existingPayment) {
      return res.status(409).json({
        success: false,
        error: "Transaction ID already exists in our system"
      });
    }

    const newPayment = new Payment({
      txid: cleanTxid,
      phone: cleanPhone
    });

    await newPayment.save();
    
    res.status(201).json({ 
      success: true,
      message: "✅ Payment saved successfully", 
      data: newPayment 
    });

  } catch (err) {
    console.error("Payment Save Error:", err);
    
    // معالجة أخطاء MongoDB بشكل أكثر تحديداً
    let errorMessage = "Internal server error";
    if (err.name === "ValidationError") {
      errorMessage = Object.values(err.errors).map(val => val.message).join(", ");
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage
    });
  }
});

// استرجاع الدفعات المعلقة
app.get("/api/pending-payments", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find({ status: { $in: ["pending", "rejected"] } })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments({ status: { $in: ["pending", "rejected"] } })
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error("Pending Payments Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch payments"
    });
  }
});

// تحديث حالة الدفع
app.put("/api/payment/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    // التحقق من صحة حالة الدفع
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status value. Allowed values: approved, rejected"
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
      message: `Payment status updated to ${status}`,
      data: updatedPayment
    });
  } catch (err) {
    console.error("Update Payment Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to update payment"
    });
  }
});

// ====== تقديم الملفات الثابتة ======
app.use(express.static(path.join(__dirname, "public")));

// معالجة تطبيقات الصفحة الواحدة (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== معالجة الأخطاء العامة ======
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  
  // تحديد رسالة الخطأ حسب نوعه
  const statusCode = err.status || 500;
  const message = statusCode === 500 ? "Internal server error" : err.message;
  
  res.status(statusCode).json({
    success: false,
    error: message
  });
});

// ====== تشغيل السيرفر ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📅 Server started at: ${new Date().toLocaleString()}`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
});

// ====== معالجة إشارات الإغلاق ======
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

function gracefulShutdown() {
  console.log("🛑 Shutting down server...");
  
  mongoose.connection.close(false, () => {
    console.log("✅ MongoDB connection closed");
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error("❌ Forcing shutdown after timeout");
    process.exit(1);
  }, 5000);
}
