const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// تحديد المسار الحالي للمجلد الرئيسي (جذر المشروع)
const __dirname = path.resolve();

// خدمة الملفات الثابتة من المجلد الجذر (مكان index.html)
app.use(express.static(__dirname));

// متغير البورت من البيئة أو 3000 محليًا
const PORT = process.env.PORT || 3000;

// MongoDB Schemas
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

// MongoDB Connection
mongoose.connect("mongodb+srv://realitylottery:Moataz1234@realitylottery.fzcf67p.mongodb.net/?retryWrites=true&w=majority&appName=realitylottery")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(error => console.error("❌ MongoDB connection error:", error));

// Routes

// الصفحة الرئيسية - خدمة ملف index.html من المجلد الجذر
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API routes
app.post("/api/payment", async (req, res) => {
  // نفس الكود الأصلي
});

app.post("/api/login", async (req, res) => {
  // نفس الكود الأصلي
});

app.post("/api/register", async (req, res) => {
  // نفس الكود الأصلي
});

app.get("/api/pending-payments", async (req, res) => {
  // نفس الكود الأصلي
});

app.post("/api/approve-payment", async (req, res) => {
  // نفس الكود الأصلي
});

// بدء السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${__dirname}`);
});
