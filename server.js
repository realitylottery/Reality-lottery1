require('dotenv').config();
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
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/realitylottery", {
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

// ====== API Routes ======

// Submit Payment
app.post("/api/payment", async (req, res) => {
  try {
    const { txid, phone } = req.body;

    if (!txid || !phone) {
      return res.status(400).json({ error: "txid and phone are required" });
    }

    const newPayment = new Payment({ txid, phone });
    await newPayment.save();
    
    res.json({ 
      message: "✅ Payment saved successfully", 
      payment: newPayment 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Pending Payments
app.get("/api/pending-payments", async (req, res) => {
  try {
    const payments = await Payment.find({ 
      status: { $in: ["pending", "rejected"] } 
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Payment Status
app.put("/api/payment/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );
    res.json(updatedPayment);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ====== Static Files ======
app.use(express.static(path.join(__dirname, "public")));

// Handle SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== Start Server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
