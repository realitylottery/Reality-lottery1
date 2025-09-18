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
  referrals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  referralEarnings: { 
    type: Number, 
    default: 0 
  },
  referralEarningsHistory: [{
    referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    date: { type: Date, default: Date.now },
    description: String
  }],
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

// داخل models/User.js بعد تعريف schema
userSchema.methods.calculateAvailableSpins = function() {
  // على سبيل المثال: كل اشتراك فعّال يعطي دورة واحدة
  if (this.subscriptionActive && this.subscriptionExpires && this.subscriptionExpires > new Date()) {
    return this.availableSpins ?? 1; // أو أي منطق تحب حسب مشروعك
  }
  return 0;
};

// داخل models/User.js
userSchema.methods.calculateAvailableSpins = function() {
  let spins = 0;

  // 1️⃣ الاشتراك في أي خطة يعطي دورة واحدة
  if (this.subscriptionActive && this.subscriptionExpires && this.subscriptionExpires > new Date()) {
    spins += 1;
  }

  // 2️⃣ كل 3 successfulInvites تعطي دورة إضافية
  spins += Math.floor(this.successfulInvites / 3);

  // 3️⃣ نطرح الدورات المستخدمة (spinsUsed)
  spins -= this.spinsUsed ?? 0;

  // ضمان عدم ظهور قيمة سالبة
  return Math.max(spins, 0);
};
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
// بعد السطر: userSchema.methods.getReferralLink = function() { ... };

// طريقة لإضافة أرباح من الإحالات
userSchema.methods.addReferralEarning = async function(referralId, amount, description) {
  try {
    // حساب العمولة (10%)
    const commission = amount * 0.1;
    
    // إضافة العمولة إلى الرصيد
    this.balance += commission;
    this.referralEarnings += commission;
    
    // تسجيل في السجل
    this.referralEarningsHistory.push({
      referralId,
      amount: commission,
      description: `${description} - 10% commission`,
      date: new Date()
    });
    
    await this.save();
    return commission;
  } catch (error) {
    console.error('Error adding referral earnings:', error);
    throw error;
  }
};

// طريقة للحصول على تفاصيل الأرباح الثانوية
userSchema.methods.getReferralEarningsDetails = function() {
  return {
    totalReferralEarnings: this.referralEarnings,
    totalInvites: this.totalInvites,
    successfulInvites: this.successfulInvites,
    earningsHistory: this.referralEarningsHistory
  };
};

// طريقة لتحديث عدد الإحالات الناجحة
userSchema.methods.incrementSuccessfulInvites = async function() {
  this.successfulInvites += 1;
  await this.save();
};

// طريقة للحصول على إحالات المستخدم مع تفاصيلهم
userSchema.methods.getUserReferrals = async function() {
  return await mongoose.model('User')
    .find({ _id: { $in: this.referrals } })
    .select('username email subscriptionActive subscriptionType balance createdAt')
    .sort({ createdAt: -1 });
};

// قبل module.exports;

module.exports = mongoose.model('User', userSchema);
