const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phone:    { type: String },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referral: { type: String, default: null },
  roles:    { type: [String], default: [] },
  registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
