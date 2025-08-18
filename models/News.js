const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  text: { type: String },
  image: { type: String },
  buttonLabel: { type: String },
  buttonUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('News', NewsSchema);
