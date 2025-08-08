const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// ====== Middleware ======
app.use(express.json());
app.use(cors({
  origin: ["https://realitylottery.koyeb.app"],
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

// ====== Database Connection ======
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/realitylottery";

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Error:", err));

// ====== Payment Model ======
const paymentSchema = new mongoose.Schema({
  txid: String,
  phone: String,
  status: { type: String, default: "pending" },
  date: { type: Date, default: Date.now }
});

const Payment = mongoose.model("Payment", paymentSchema);

// ====== API Routes - Fixed ======

// 1. Submit Payment (GET instead of POST for testing)
app.get("/api/payment", (req, res) => {
  res.json({ message: "Payment endpoint works!" });
});

// 2. Get Pending Payments (Simplified)
app.get("/api/pending-payments", (req, res) => {
  res.json([{ test: "Success" }]);
});

// 3. Update Payment Status (Fixed parameter syntax)
app.put("/api/payment/:id", (req, res) => {
  res.json({ 
    message: "Update endpoint works!",
    id: req.params.id 
  });
});

// ====== Static Files ======
app.use(express.static(path.join(__dirname, "public")));

// ====== SPA Handler ======
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== Start Server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
