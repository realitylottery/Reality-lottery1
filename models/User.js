const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referral: { type: String, default: null },
  roles: { type: [String], default: [] },
  registeredAt: { type: Date, default: Date.now },
  // الحقول الجديدة
  balance: { type: Number, default: 0 },
  taskProgress: { type: Number, default: 0 },
  // ... الحقول الحالية ...
  // Subscription fields
  subscriptionType: {
    type: String,
    enum: ['', 'BASIC', 'PRO', 'VIP'],
    default: ''
  },
  subscriptionActive: {
    type: Boolean,
    default: false
  },
  subscriptionExpires: {
    type: Date
  },
  // ... الحقول الأخرى
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  totalInvites: {
    type: Number,
    default: 0
  },
  successfulInvites: {
    type: Number,
    default: 0
  },
  // ... باقي الحقول
});
  
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  subscriptionType: { type: String, default: "Free" } // نوع الاشتراك افتراضي = "Free"
});

module.exports = mongoose.model('User', UserSchema);

