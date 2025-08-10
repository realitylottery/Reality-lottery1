// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:    { type: String },
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  referral: { type: String, default: null },
  roles:    { type: [String], default: ['user'] },
  registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
