const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  wallet: { type: String, required: true },
  status: { type: String, enum: ["pending", "done"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
