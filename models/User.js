// ملف: models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },

  // الأدوار
  roles: { 
    type: [String],
    enum: ['user', 'admin'],
    default: ['user']
  },

  // الرصيد والتقدم في المهام
  balance: { type: Number, default: 0 },
  completedTasks: { type: Number, default: 0 },
  currentTaskProgress: { type: Number, default: 0, min: 0, max: 6 },
  taskProgressUpdated: {
  type: Boolean,
  default: false
  },
  // نظام الدعوات
  referredBy: { type: String, default: null },
  referralCode: { type: String, unique: true, sparse: true },
  totalInvites: { type: Number, default: 0 },
  extraSpins: { type: Number, default: 0 },
spinsUsed: { type: Number, default: 0 },
  successfulInvites: { type: Number, default: 0 },
  availableSpins: { type: Number, default: 0 },
  // الاشتراك
  subscriptionType: { type: String, enum: ['', 'BASIC', 'PRO', 'VIP'], default: '' },
  subscriptionActive: { type: Boolean, default: false },
  lotteryEntries: { type: Number, default: 0 },
  subscriptionExpires: { type: Date, default: null },
  // الطوابع الزمنية
  registeredAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

// إنشاء كود دعوة تلقائي قبل الحفظ
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.referralCode) {
    let code;
    let exists = true;

    // إنشاء كود فريد من 8 أحرف
    while (exists) {
      code = Math.random().toString(36).substring(2, 10).toUpperCase();
      exists = await mongoose.models.User.findOne({ referralCode: code });
    }

    this.referralCode = code;
  }
  next();
});

// خاصية للتحقق من الاشتراك
userSchema.virtual('isSubscriptionValid').get(function() {
  return this.subscriptionActive && this.subscriptionExpires && this.subscriptionExpires > new Date();
});

// طريقة للحصول على رابط الدعوة
userSchema.methods.getReferralLink = function() {
  const baseUrl = process.env.FRONTEND_ORIGIN || 'https://realitylottery.koyeb.app';
  return `${baseUrl}/register?ref=${this.referralCode}`;
};

module.exports = mongoose.model('User', userSchema);
