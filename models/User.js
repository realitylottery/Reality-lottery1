// ملف: models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // استبدال enum بخيار صحيح
  roles: { 
    type: [String], 
    default: ['user'],
    validate: {
      validator: function(roles) {
        return roles.every(role => ['user', 'admin'].includes(role));
      },
      message: 'Roles must be either user or admin'
    }
  },
  
  balance: { type: Number, default: 0 },
  completedTasks: { type: Number, default: 0, min: 0, max: 6 },
  currentTaskProgress: { type: Number, default: 0, min: 0, max: 6 },
  // حقول نظام الدعوات
  referredBy: {
    type: String,
    default: null
  },
  autoProgress: {
    type: Number,
    default: 0
  },
  
  // التقدم اليدوي (Manual) - من لوحة الإدارة
  manualProgress: {
    type: Number,
    default: 0
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
  
  // حقول الاشتراك
  subscriptionType: { type: String, enum: ['', 'BASIC', 'PRO', 'VIP'], default: '' },
  subscriptionActive: { type: Boolean, default: false },
  subscriptionExpires: { type: Date, default: null },
  
  // الطوابع الزمنية
  registeredAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

// // إنشاء كود دعوة تلقائي قبل الحفظ
userSchema.pre('save', function(next) {
  if (this.isNew && !this.referralCode) {
    // إنشاء كود فريد من 8 أحرف/أرقام
    this.referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  next();
});

// طريقة للتحقق من صلاحية الاشتراك
userSchema.virtual('isSubscriptionValid').get(function() {
  return this.subscriptionActive && this.subscriptionExpires > new Date();
});

// طريقة للحصول على رابط الدعوة
userSchema.methods.getReferralLink = function() {
  const baseUrl = process.env.FRONTEND_ORIGIN || 'https://realitylottery.koyeb.app';
  return `${baseUrl}/register?ref=${this.referralCode}`;
};

module.exports = mongoose.model('User', userSchema);
