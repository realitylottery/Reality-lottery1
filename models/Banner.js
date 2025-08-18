const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: { type: String },
  description: { type: String },
  buttonText: { type: String },
  buttonLink: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Banner", bannerSchema);
