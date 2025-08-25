require('dotenv').config();



const express = require('express');



const mongoose = require('mongoose');



const bcrypt = require('bcryptjs');



const jwt = require('jsonwebtoken');



const cors = require('cors');



const path = require('path');



const User = require('./models/User');



const News = require('./models/News');



const Withdrawal = require('./models/Withdrawal');



const NewsTicker = require('./models/NewsTicker');



const Banner = require('./models/Banner');



const Payment = require('./models/Payment'); // Added Payment model







const app = express();



app.use(express.json());







// ================= CORS =================



const ALLOWED_ORIGINS = [



  process.env.FRONTEND_ORIGIN || 'https://realitylottery.koyeb.app',



  'http://localhost:3000',



  'http://localhost:5000',



  'http://127.0.0.1:5500',



  'http://localhost:5500'



];







app.use(cors({



  origin: function (origin, callback) {



    if (!origin) return callback(null, true);



    if (ALLOWED_ORIGINS.indexOf(origin) === -1) {



      const msg = 'CORS policy does not allow access from this origin.';



      return callback(new Error(msg), false);



    }



    return callback(null, true);



  }



}));







// ================= CONFIG =================



const PORT = process.env.PORT || 8000;



const MONGO_URI = process.env.MONGO_URI;



const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';







// ================= DATABASE =================



mongoose.connect(MONGO_URI, {



  useNewUrlParser: true,



  useUnifiedTopology: true



}).then(() => {



  console.log('✅ MongoDB connected');



}).catch(err => {



  console.error('❌ MongoDB connection error:', err.message);



});







// ================= HELPERS =================



function generateToken(user) {



  return jwt.sign(



    { id: user._id, username: user.username, roles: user.roles },



    JWT_SECRET,



    { expiresIn: '7d' }



  );



}



function calculateTaskReward(subscriptionType, progress) {

  const rewards = {

    'BASIC': { 2: 5, 3: 8, 6: 12 },

    'PRO': { 2: 8, 3: 12, 6: 15 },

    'VIP': { 2: 12, 3: 15, 6: 20 },

    'NONE': { 2: 2, 3: 3, 6: 6 },      // غير إلى 'NONE' (كبيرة)

    '': { 2: 2, 3: 3, 6: 6 }           // أضف هذا للقيم الفارغة

  };

  

  // تحويل إلى uppercase للتأكد من المطابقة

  const subscription = (subscriptionType || 'NONE').toUpperCase();

  const rewardTable = rewards[subscription] || rewards['NONE'];

  

  return rewardTable[progress] || 0;

}







async function authMiddleware(req, res, next) {



  const authHeader = req.headers['authorization'];



  if (!authHeader) return res.status(401).json({ message: 'No token provided' });







  const token = authHeader.split(' ')[1];



  if (!token) return res.status(401).json({ message: 'Invalid token format' });







  try {



    const decoded = jwt.verify(token, JWT_SECRET);



    req.user = decoded;



    next();



  } catch (err) {



    return res.status(401).json({ message: 'Invalid or expired token' });



  }



}







// ================= ROUTES =================


// ========= NOTIFICATION ROUTES =========

// GET /api/notifications - Get active notifications (public)
app.get('/api/notifications', async (req, res) => {
  try {
    const { active } = req.query;
    let query = {};
    
    if (active === 'true') {
      query.isActive = true;
    }
    
    const notifications = await Notification.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .select('-__v');
    
    res.json({
      success: true,
      notifications,
      count: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching notifications'
    });
  }
});

// GET /api/admin/notifications - Get all notifications (admin only)
app.get('/api/admin/notifications', authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.json({
      success: true,
      notifications,
      count: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching notifications'
    });
  }
});

// POST /api/admin/notifications - Create notification (admin only)
app.post('/api/admin/notifications', authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  
  try {
    const { title, message, link, linkText, priority, isActive } = req.body;
    
    // Validation
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }
    
    const notification = new Notification({
      title,
      message,
      link: link || '',
      linkText: linkText || 'Learn more',
      priority: priority || 1,
      isActive: isActive !== undefined ? isActive : true
    });
    
    await notification.save();
    
    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating notification'
    });
  }
});

// PUT /api/admin/notifications/:id - Update notification (admin only)
app.put('/api/admin/notifications/:id', authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const notification = await Notification.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).select('-__v');
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification updated successfully',
      notification
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating notification'
    });
  }
});

// DELETE /api/admin/notifications/:id - Delete notification (admin only)
app.delete('/api/admin/notifications/:id', authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  
  try {
    const { id } = req.params;
    
    const notification = await Notification.findByIdAndDelete(id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting notification'
    });
  }
});


/* ==== API spin العجلة ==== */

app.post("/api/wheel/spin", authMiddleware, async (req, res) => {

  try {

    const { prize, amount } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ msg: "User not found" });



    if (!user.subscriptionActive) return res.status(400).json({ msg: "No active subscription" });

    if (user.hasSpunWheel) return res.status(400).json({ msg: "You already used your spin" });



    let message = "";



    if (prize === "lose") {

      user.hasSpunWheel = true;

      message = "Better luck next time!";

    } else if (prize === "extra") {

      message = "You earned an extra spin!";

    } else if (prize.startsWith("$") && amount > 0) {

      user.balance += amount;

      user.hasSpunWheel = true;

      message = `You won ${prize}! Balance updated.`;

    }



    await user.save();



    res.json({

      success: true,

      prize,

      amount: amount || 0,

      balance: user.balance,

      hasSpunWheel: user.hasSpunWheel,

      message

    });

  } catch (err) {

    console.error("Wheel Spin Error:", err);

    res.status(500).json({ msg: "Server error" });

  }

});



// Create withdrawal



app.post("/api/withdrawals", authMiddleware, async (req, res) => {



  try {



    const { amount, wallet } = req.body;







    if (!amount || !wallet) {



      return res.status(400).json({ message: "Amount and wallet required" });



    }







    const user = await User.findById(req.user.id);



    if (!user) return res.status(404).json({ message: "User not found" });







    if (user.balance < amount) {



      return res.status(400).json({ message: "Insufficient balance" });



    }







    const withdrawal = new Withdrawal({



      userId: user._id,



      amount,



      walletAddress: wallet



    });







    await withdrawal.save();







    user.balance -= amount; // Temporary balance deduction



    await user.save();







    res.json({ message: "Withdrawal request submitted", withdrawal });







  } catch (err) {



    console.error("Withdraw error:", err);



    res.status(500).json({ message: err.message || "Error submitting withdrawal" });



  }



});




// الحصول على جميع التيكرات
app.get('/api/newstickers', async (req, res) => {
  try {
    const tickers = await NewsTicker.find().sort({ priority: -1, createdAt: -1 });
    res.json(tickers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news tickers' });
  }
});

// إضافة تيكر جديد
app.post('/api/admin/newstickers', authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  
  try {
    const { text, isActive = true, priority = 1 } = req.body;
    const ticker = new NewsTicker({ text, isActive, priority });
    await ticker.save();
    res.json({ message: "News ticker added", ticker });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// تحديث تيكر
app.put('/api/admin/newstickers/:id', authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  
  try {
    const { text, isActive, priority } = req.body;
    const ticker = await NewsTicker.findByIdAndUpdate(
      req.params.id,
      { text, isActive, priority, updatedAt: new Date() },
      { new: true }
    );
    res.json({ message: "News ticker updated", ticker });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// حذف تيكر
app.delete('/api/admin/newstickers/:id', authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });
  
  try {
    await NewsTicker.findByIdAndDelete(req.params.id);
    res.json({ message: "News ticker deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// Update user (Admin only)



app.put("/api/admin/users/:id", authMiddleware, async (req, res) => {



  if (!req.user.roles?.includes("admin")) {



    return res.status(403).json({ message: "Forbidden" });



  }







  try {



    const { id } = req.params;



    const { subscriptionType, balance, completedTasks } = req.body;







    // Validate subscription type



    if (subscriptionType && !['', 'BASIC', 'PRO', 'VIP'].includes(subscriptionType)) {



      return res.status(400).json({ message: "Invalid subscription type" });



    }







    const updateFields = {};



    if (subscriptionType !== undefined) updateFields.subscriptionType = subscriptionType;



    if (balance !== undefined) updateFields.balance = balance;



    if (completedTasks !== undefined) updateFields.completedTasks = completedTasks;







    // If subscription is being set, activate it



    if (subscriptionType && subscriptionType !== '') {



      updateFields.subscriptionActive = true;



      updateFields.subscriptionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);



    } else if (subscriptionType === '') {



      updateFields.subscriptionActive = false;



      updateFields.subscriptionExpires = null;



    }







    const user = await User.findByIdAndUpdate(



      id,



      updateFields,



      { new: true }



    ).select("-password");







    if (!user) {



      return res.status(404).json({ message: "User not found" });



    }







    res.json({ message: "User updated successfully", user });



  } catch (err) {



    console.error("Update user error:", err);



    res.status(500).json({ message: "Server error" });



  }



});



app.get('/api/profile', authMiddleware, async (req, res) => {

  try {

    const user = await User.findById(req.user.id).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });



    const referralLink = `${process.env.FRONTEND_ORIGIN || 'https://realitylottery.koyeb.app'}/register?ref=${user.referralCode}`;



    res.json({

      user: {

        id: user._id,

        username: user.username,

        fullName: user.fullName,

        email: user.email,

        phone: user.phone,

        balance: user.balance,

        subscriptionType: user.subscriptionType,

        subscriptionActive: user.subscriptionActive,

        subscriptionExpires: user.subscriptionExpires,

        completedTasks: user.completedTasks,

        currentTaskProgress: user.currentTaskProgress,

        referralCode: user.referralCode,

        referralLink,

        totalInvites: user.totalInvites,

        successfulInvites: user.successfulInvites

      }

    });

  } catch (err) {

    console.error('Profile error:', err);

    res.status(500).json({ message: 'Error fetching profile' });

  }

});



// Get invites and subscriptions statistics (admin only)



app.get("/api/admin/invites", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    // الحصول على جميع المستخدمين مع إحصائيات الدعوات والاشتراكات



    const users = await User.find()



      .select("username email totalInvites successfulInvites subscriptionType subscriptionActive subscriptionExpires createdAt")



      .sort({ createdAt: -1 });







    res.json({ 



      users: users.map(user => ({



        _id: user._id,



        username: user.username,



        email: user.email,



        totalInvites: user.totalInvites || 0,



        successfulInvites: user.successfulInvites || 0,



        subscriptionType: user.subscriptionType || 'None',



        subscriptionStatus: user.subscriptionActive && user.subscriptionExpires > new Date() ? 'Active' : 'Inactive',



        joinDate: user.createdAt



      }))



    });







  } catch (err) {



    console.error("Invites stats error:", err);



    res.status(500).json({ message: "Error fetching invites statistics" });



  }



});







// Get detailed user information (admin only)



app.get("/api/admin/users/:id", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const user = await User.findById(req.params.id)



      .select("-password");







    if (!user) {



      return res.status(404).json({ message: "User not found" });



    }







    // الحصول على معلومات إضافية إذا لزم الأمر



    const userPayments = await Payment.find({ userId: user._id })



      .sort({ createdAt: -1 })



      .limit(5);







    const userWithdrawals = await Withdrawal.find({ userId: user._id })



      .sort({ createdAt: -1 })



      .limit(5);







    res.json({



      user: {



        _id: user._id,



        username: user.username,



        email: user.email,



        fullName: user.fullName,



        phone: user.phone,



        balance: user.balance,



        totalInvites: user.totalInvites || 0,



        successfulInvites: user.successfulInvites || 0,



        subscriptionType: user.subscriptionType,



        subscriptionActive: user.subscriptionActive,



        subscriptionExpires: user.subscriptionExpires,



        completedTasks: user.completedTasks,



        createdAt: user.createdAt,



        // معلومات إضافية



        payments: userPayments,



        withdrawals: userWithdrawals



      }



    });







  } catch (err) {



    console.error("User details error:", err);



    res.status(500).json({ message: "Error fetching user details" });



  }



});







// Update user invites (admin only)



app.put("/api/admin/users/:id/invites", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const { totalInvites, successfulInvites } = req.body;







    const updateFields = {};



    if (totalInvites !== undefined) updateFields.totalInvites = totalInvites;



    if (successfulInvites !== undefined) updateFields.successfulInvites = successfulInvites;







    const user = await User.findByIdAndUpdate(



      req.params.id,



      updateFields,



      { new: true }



    ).select("-password");







    if (!user) {



      return res.status(404).json({ message: "User not found" });



    }







    res.json({ 



      message: "User invites updated successfully",



      user: {



        _id: user._id,



        username: user.username,



        totalInvites: user.totalInvites,



        successfulInvites: user.successfulInvites



      }



    });







  } catch (err) {



    console.error("Update user invites error:", err);



    res.status(500).json({ message: "Error updating user invites" });



  }



});







// News Ticker



app.get("/api/ticker", async (req, res) => {



  const tickers = await NewsTicker.find().sort({ createdAt: -1 });



  res.json({ tickers });



});







app.post("/api/admin/ticker", authMiddleware, async (req, res) => {



  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });



  const ticker = new NewsTicker({ text: req.body.text });



  await ticker.save();



  res.json({ message: "Ticker added", ticker });



});







app.delete("/api/admin/ticker/:id", authMiddleware, async (req, res) => {



  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });



  await NewsTicker.findByIdAndDelete(req.params.id);



  res.json({ message: "Ticker deleted" });



});







// Banners

app.get('/api/banners', async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json({ success: true, banners });
  } catch (err) {
    console.error("Public banners error:", err);
    res.status(500).json({ success: false, message: "Error fetching banners" });
  }
});

app.get('/api/admin/banners', authMiddleware, async (req, res) => {
try {
// التحقق من وجود المستخدم أولاً
if (!req.user) {
return res.status(401).json({
success: false,
message: "Unauthorized: User not authenticated"
});
}

// التحقق من صلاحية الأدمن - مع معالجة حالات عدم وجود roles  
const userRoles = req.user.roles || [];  
if (!userRoles.includes("admin")) {  
  return res.status(403).json({   
    success: false,  
    message: "Forbidden: Admin access required"   
  });  
}  
  
// جلب البانرات من قاعدة البيانات  
const banners = await Banner.find().sort({ createdAt: -1 });  
  
res.json({   
  success: true,  
  banners: banners   
});

} catch (err) { // <-- هذا القوس كان ناقصاً
console.error("Banners error:", err);
res.status(500).json({
success: false,
message: "Error fetching banners"
});
}
}); // <-- وهذا القوس أيضاً كان ناقصاً




app.post("/api/admin/banners", authMiddleware, async (req, res) => {



  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });



  const banner = new Banner(req.body);



  await banner.save();



  res.json({ message: "Banner added", banner });



});







app.delete("/api/admin/banners/:id", authMiddleware, async (req, res) => {



  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });



  await Banner.findByIdAndDelete(req.params.id);



  res.json({ message: "Banner deleted" });



});







// ================= PAYMENT ROUTES =================







// Create new payment request



app.post("/api/payments", authMiddleware, async (req, res) => {



  try {



    const { plan, amount, transactionId, phone } = req.body;







    if (!plan || !amount || !transactionId || !phone) {



      return res.status(400).json({ message: "All fields are required" });



    }







    // Validate plan type



    if (!['BASIC', 'PRO', 'VIP'].includes(plan)) {



      return res.status(400).json({ message: "Invalid plan type" });



    }







    const user = await User.findById(req.user.id);



    if (!user) return res.status(404).json({ message: "User not found" });







    // Check if payment with same transactionId already exists



    const existingPayment = await Payment.findOne({ transactionId });



    if (existingPayment) {



      return res.status(400).json({ message: "Transaction ID already used" });



    }







    const payment = new Payment({



      userId: user._id,



      plan,



      amount,



      transactionId,



      phone,



      status: 'pending'



    });







    await payment.save();







    res.json({ 



      message: "Payment request submitted successfully. It will be reviewed within 24 hours",



      payment 



    });







  } catch (err) {



    console.error("Payment error:", err);



    res.status(500).json({ message: err.message || "Error creating payment request" });



  }



});







// Get user payments



app.get("/api/payments", authMiddleware, async (req, res) => {



  try {



    const payments = await Payment.find({ userId: req.user.id })



      .sort({ createdAt: -1 });



    res.json({ payments });



  } catch (err) {



    console.error("Get payments error:", err);



    res.status(500).json({ message: "Error fetching payments" });



  }



});







// ================= ADMIN PAYMENT ROUTES =================







// Get all payments (admin only)



app.get("/api/admin/payments", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const payments = await Payment.find()



      .populate("userId", "username email")



      .sort({ createdAt: -1 });







    res.json({ payments });



  } catch (err) {



    console.error("Error fetching payments:", err);



    res.status(500).json({ message: "Error fetching payments" });



  }



});











app.post("/api/debug/update", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    console.log("Received update request:", req.body);



    res.json({ 



      message: "Debug received", 



      receivedData: req.body 



    });



  } catch (err) {



    console.error("Debug error:", err);



    res.status(500).json({ message: "Debug error" });



  }



});











// Verify payment and activate subscription



app.post("/api/admin/payments/:id/verify", authMiddleware, async (req, res) => {



  try {





    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const payment = await Payment.findById(req.params.id).populate("userId");



    if (!payment) return res.status(404).json({ message: "Payment not found" });







    if (payment.status !== 'pending') {



      return res.status(400).json({ message: "Payment already processed" });



    }







    const user = await User.findById(payment.userId._id);



    if (!user) return res.status(404).json({ message: "User not found" });



     // Give user a spin when they subscribe

    user.spinsUsed = false; // Reset spins

    await user.save();



    // Update payment status



    payment.status = 'verified';



    payment.verifiedAt = new Date();



    payment.verifiedBy = req.user.id;



    await payment.save();







    // Update user subscription based on plan



    user.subscriptionType = payment.plan;



    user.subscriptionActive = true;



    



    // Set subscription expiration based on plan



    const expirationDays = {



      'BASIC': 30,



      'PRO': 30,



      'VIP': 30



    };



    



    user.subscriptionExpires = new Date(Date.now() + expirationDays[payment.plan] * 24 * 60 * 60 * 1000);



    await user.save();



    



      // 🔥 زيادة successfulInvites للمدعِي إذا كان هذا المستخدم لديه مدعٍ

    if (user.referredBy) {

  try {

    // البحث عن المدعِي باستخدام كود الدعوة

    const referrer = await User.findOne({ referralCode: user.referredBy });

    if (referrer) {

      referrer.successfulInvites += 1;

      referrer.currentTaskProgress += 1;

      await referrer.save();

      console.log(`✅ Increased successfulInvites for referrer: ${referrer.username}`);

    }

  } catch (referralError) {

    console.error("Error updating referrer successfulInvites:", referralError);

    // لا نوقف العملية إذا حدث خطأ في تحديث الإحصائيات

  }

    }



    res.json({ 

      message: "Payment verified and subscription activated successfully",

      payment 

    });



  } catch (err) {

    console.error("Verify payment error:", err);

    res.status(500).json({ message: "Error verifying payment" });

  }

});







// Reject payment



app.post("/api/admin/payments/:id/reject", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const payment = await Payment.findById(req.params.id);



    if (!payment) return res.status(404).json({ message: "Payment not found" });







    if (payment.status !== 'pending') {



      return res.status(400).json({ message: "Payment already processed" });



    }







    payment.status = 'rejected';



    payment.rejectedAt = new Date();



    payment.rejectedBy = req.user.id;



    payment.rejectionReason = req.body.reason || "No reason provided";



    await payment.save();







    res.json({ 



      message: "Payment rejected successfully",



      payment 



    });







  } catch (err) {



    console.error("Reject payment error:", err);



    res.status(500).json({ message: "Error rejecting payment" });



  }



});







// Payment statistics



app.get("/api/admin/stats/payments", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const totalPayments = await Payment.countDocuments();



    const pendingPayments = await Payment.countDocuments({ status: 'pending' });



    const verifiedPayments = await Payment.countDocuments({ status: 'verified' });



    const rejectedPayments = await Payment.countDocuments({ status: 'rejected' });



    const totalRevenue = await Payment.aggregate([



      { $match: { status: 'verified' } },



      { $group: { _id: null, total: { $sum: '$amount' } } }



    ]);







    res.json({



      totalPayments,



      pendingPayments,



      verifiedPayments,



      rejectedPayments,



      totalRevenue: totalRevenue[0]?.total || 0



    });







  } catch (err) {



    console.error("Payment stats error:", err);



    res.status(500).json({ message: "Error fetching payment statistics" });



  }



});



// Get user spins

app.get("/api/user/spins", authMiddleware, async (req, res) => {

  try {

    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "User not found" });



    // User gets 1 spin when they subscribe

    const hasSubscription = user.subscriptionActive && user.subscriptionExpires > new Date();

    const spinsAvailable = hasSubscription ? 1 : 0;



    res.json({ 

      spinsAvailable,

      hasSubscription 

    });

  } catch (err) {

    console.error("Spins error:", err);

    res.status(500).json({ message: "Error checking spins" });

  }

});



// Add to user balance

app.post("/api/user/add-balance", authMiddleware, async (req, res) => {

  try {

    const { amount } = req.body;

    if (!amount) return res.status(400).json({ message: "Amount is required" });



    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "User not found" });



    user.balance = (user.balance || 0) + amount;

    await user.save();



    res.json({ 

      success: true,

      message: `$${amount} added to your balance`,

      newBalance: user.balance

    });

  } catch (err) {

    console.error("Add balance error:", err);

    res.status(500).json({ message: "Error adding balance" });

  }

});



// Reset spins when user subscribes (call this when payment is verified)

app.post("/api/user/reset-spins", authMiddleware, async (req, res) => {

  try {

    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "User not found" });



    // Reset spins used flag when user subscribes

    user.spinsUsed = false;

    await user.save();



    res.json({ 

      success: true,

      message: "Spins reset for new subscription"

    });

  } catch (err) {

    console.error("Reset spins error:", err);

    res.status(500).json({ message: "Error resetting spins" });

  }

});



// Check subscription status



app.get("/api/subscription/status", authMiddleware, async (req, res) => {



  try {



    const user = await User.findById(req.user.id);



    if (!user) return res.status(404).json({ message: "User not found" });







    const now = new Date();



    const isActive = user.subscriptionActive && user.subscriptionExpires > now;







    res.json({



      subscriptionType: user.subscriptionType,



      subscriptionActive: isActive,



      subscriptionExpires: user.subscriptionExpires,



      daysRemaining: isActive ? 



        Math.ceil((user.subscriptionExpires - now) / (1000 * 60 * 60 * 24)) : 0



    });



  } catch (err) {



    console.error("Subscription status error:", err);



    res.status(500).json({ message: "Error checking subscription status" });



  }



});







// ================= WITHDRAWALS ROUTES =================







// Get all withdrawals (admin only)



app.get("/api/admin/withdrawals", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const withdrawals = await Withdrawal.find()



      .populate("userId", "username")



      .sort({ createdAt: -1 });







    res.json({ withdrawals });



  } catch (err) {



    console.error("Error fetching withdrawals:", err);



    res.status(500).json({ message: "Error fetching withdrawals" });



  }



});







// Approve withdrawal



app.post("/api/admin/withdrawals/:id/approve", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const withdrawal = await Withdrawal.findById(req.params.id).populate("userId", "username");



    if (!withdrawal) return res.status(404).json({ message: "Not found" });







    withdrawal.status = "approved";



    await withdrawal.save();







    res.json({ message: "Withdrawal approved" });



  } catch (err) {



    console.error("Approve error:", err);



    res.status(500).json({ message: "Error approving withdrawal" });



  }



});







// Reject withdrawal + refund balance



app.post("/api/admin/withdrawals/:id/reject", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const withdrawal = await Withdrawal.findById(req.params.id).populate("userId");



    if (!withdrawal) return res.status(404).json({ message: "Not found" });







    const user = await User.findById(withdrawal.userId._id);



    if (user) {



      user.balance += withdrawal.amount;



      await user.save();



    }







    withdrawal.status = "rejected";



    await withdrawal.save();







    res.json({ message: "Withdrawal rejected, balance refunded" });



  } catch (err) {



    console.error("Reject error:", err);



    res.status(500).json({ message: "Error rejecting withdrawal" });



  }



});







// Get user withdrawals



app.get("/api/withdrawals", authMiddleware, async (req, res) => {



  try {



    const withdrawals = await Withdrawal.find({ userId: req.user.id })



      .sort({ createdAt: -1 });



    res.json({ withdrawals });



  } catch (err) {



    console.error("User withdrawals error:", err);



    res.status(500).json({ message: "Server error" });



  }



});







// Get user balance



app.get("/api/user/balance", authMiddleware, async (req, res) => {



  try {



    const user = await User.findById(req.user.id);



    if (!user) return res.status(404).json({ message: "User not found" });



    res.json({ balance: user.balance || 0 });



  } catch (err) {



    console.error("Balance error:", err);



    res.status(500).json({ message: "Error fetching balance" });



  }



});







// News



app.get('/api/news', async (req, res) => {



  try {



    const news = await News.find().sort({ createdAt: -1 });



    res.json(news);



  } catch (err) {



    console.error('News fetch error:', err);



    res.status(500).json({ error: 'Failed to fetch news' });



  }



});







app.post("/api/admin/news", authMiddleware, async (req, res) => {



  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });



  try {



    const n = new News(req.body);



    await n.save();



    res.json({ message: "News added", news: n });



  } catch (err) {



    res.status(500).json({ message: "Server error" });



  }



});



app.get('/api/admin/news', authMiddleware, async (req, res) => {
  if (!req.user.roles?.includes("admin")) {
    return res.status(403).json({ message: "Forbidden" });
  }
  
  try {
    const news = await News.find().sort({ createdAt: -1 });
    res.json(news);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});




app.delete("/api/admin/news/:id", authMiddleware, async (req, res) => {



  if (!req.user.roles?.includes("admin")) return res.status(403).json({ message: "Forbidden" });



  try {



    await News.findByIdAndDelete(req.params.id);



    res.json({ message: "News deleted" });



  } catch (err) {



    res.status(500).json({ message: "Server error" });



  }



});







// Health check



app.get('/api/health', (req, res) =>



  res.json({ status: 'ok', time: new Date() })



);







// Auth



app.post('/api/auth/register', async (req, res) => {

  try {

    const { fullName, email, phone, username, password, referralCode } = req.body;



    if (!fullName || !email || !username || !password) {

      return res.status(400).json({ message: 'Missing required fields' });

    }



    const existing = await User.findOne({

      $or: [{ email: email.toLowerCase() }, { username }]

    });

    

    if (existing) {

      return res.status(409).json({ message: 'Email or username already used' });

    }



    let referredBy = null;

    let referrer = null;



    // البحث عن المستخدم باستخدام كود الدعوة (ref)

    if (referralCode) {

      console.log('🔍 Searching for referrer with code:', referralCode);

      

      referrer = await User.findOne({ 

        $or: [

          { referralCode: referralCode },  // البحث بكود الدعوة أولاً

          { username: referralCode }       // ثم البحث باسم المستخدم

        ]

      });



      if (referrer) {

        console.log('✅ Found referrer:', referrer.username);

        referredBy = referrer.referralCode;

        

        // إذا كان البحث باسم مستخدم ولم يكن لديه كود دعوة، ننشئ له واحد

        if (!referrer.referralCode) {

          referrer.referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

          await referrer.save();

          referredBy = referrer.referralCode;

        }

      } else {

        console.log('❌ No referrer found with code:', ref);

      }

    }



    const salt = await bcrypt.genSalt(10);

    const hash = await bcrypt.hash(password, salt);



    const user = new User({

      fullName,

      email: email.toLowerCase(),

      phone,

      username,

      password: hash,

      referredBy: referredBy // ⚠️ هذا هو الحقل المهم

    });



    await user.save();

    console.log('✅ User saved with referredBy:', user.referredBy);



    // إذا كان هناك مدعٍ، تحديث إحصائياته

    if (referrer) {

      try {

        await User.findByIdAndUpdate(referrer._id, {

          $inc: { totalInvites: 1 }

        });

        console.log(`✅ Updated totalInvites for referrer: ${referrer.username}`);

      } catch (updateError) {

        console.error('Error updating referrer stats:', updateError);

      }

    }



    // إنشاء كود دعوة للمستخدم الجديد إذا لم يكن لديه

    if (!user.referralCode) {

      user.referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      await user.save();

    }



    const token = generateToken(user);



    return res.status(201).json({

      message: 'User registered',

      user: {

        id: user._id,

        username: user.username,

        fullName: user.fullName,

        email: user.email,

        referralCode: user.referralCode,

        referredBy: user.referredBy // للتأكد من القيمة

      },

      token

    });



  } catch (err) {

    console.error('Registration error:', err);

    return res.status(500).json({ message: 'Server error', error: err.message });

  }

});







// إضافة route جديد عند اشتراك مدعو

app.post("/api/referrals/subscribed", authMiddleware, async (req, res) => {

  try {

    const { referredUserId } = req.body;

    

    // البحث عن المستخدم المدعو

    const referredUser = await User.findById(referredUserId);

    if (!referredUser || !referredUser.referredBy) {

      return res.status(404).json({ message: "Referred user not found or no referrer" });

    }



    // البحث عن المدعِي باستخدام كود الدعوة

    const referrer = await User.findOne({ referralCode: referredUser.referredBy });

    if (!referrer) {

      return res.status(404).json({ message: "Referrer not found" });

    }



    // زيادة successfulInvites فقط

    referrer.successfulInvites += 1;

    await referrer.save();



    res.json({ 

      success: true, 

      message: "Successful invite counted",

      referrer: {

        username: referrer.username,

        successfulInvites: referrer.successfulInvites

      }

    });



  } catch (err) {

    console.error("Subscribed referral error:", err);

    res.status(500).json({ message: "Error counting successful referral" });

  }

});



app.post('/api/auth/login', async (req, res) => {



  try {



    const { usernameOrEmail, password } = req.body;



    if (!usernameOrEmail || !password) {



      return res.status(400).json({ message: 'Missing credentials' });



    }







    const query = usernameOrEmail.includes('@')



      ? { email: usernameOrEmail.toLowerCase() }



      : { username: usernameOrEmail };







    const user = await User.findOne(query);



    if (!user) return res.status(401).json({ message: 'Invalid credentials' });







    const match = await bcrypt.compare(password, user.password);



    if (!match) return res.status(401).json({ message: 'Invalid credentials' });







    const token = generateToken(user);







    return res.json({



      message: 'Login successful',



      token,



      user: {



        id: user._id,



        username: user.username,



        fullName: user.fullName,



        email: user.email



      }



    });



  } catch (err) {



    console.error(err);



    return res.status(500).json({ message: 'Server error' });



  }



});







/// الحصول على رابط الدعوة للمستخدم الحالي



app.get('/api/user/referral-link', authMiddleware, async (req, res) => {



  try {



    const user = await User.findById(req.user.id);



    if (!user) return res.status(404).json({ message: 'User not found' });







    // إنشاء الرابط باستخدام كود الدعوة فقط



    const baseUrl = process.env.FRONTEND_ORIGIN || 'https://realitylottery.koyeb.app';



    const referralLink = `${baseUrl}/register?ref=${user.referralCode}`;







    res.json({ 



      referralLink,



      referralCode: user.referralCode



    });



  } catch (err) {



    console.error('Referral link error:', err);



    res.status(500).json({ message: 'Error generating referral link' });



  }



});







/// إكمال المهمة وإضافة المكافأة



app.post("/api/tasks/complete", authMiddleware, async (req, res) => {

  try {

    const { userId, isReset } = req.body;

    if (!userId) return res.status(400).json({ message: "userId is required" });



    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });



    // حساب التقدم الصحيح

    const progress = Math.min(6, user.currentTaskProgress || 0);

    

    // مكافأة حسب التقدم

    const rewardAmount = calculateTaskReward(user.subscriptionType, progress);



    // 🔥 التصفير التلقائي عندما تصل المهمة إلى 6/6 (حتى بدون isReset)

    const shouldAutoReset = progress === 6;



    if (!isReset && !shouldAutoReset) {

      return res.json({ 

        success: true, 

        message: "Nothing to do without reset", 

        progress, 

        reward: rewardAmount 

      });

    }



    // يُسمح بالريست فقط لو التقدم >= 2

    if (progress < 2) {

      return res.status(400).json({ 

        message: "Progress too low to reset/claim", 

        progress 

      });

    }



    // إضافة المكافأة + زيادة المهام المنجزة + تصفير تقدم الدورة

    user.balance = (user.balance || 0) + rewardAmount;

    user.completedTasks = (user.completedTasks || 0) + 1;

    user.currentTaskProgress = 0;



    await user.save();



    return res.json({

      success: true,

      message: shouldAutoReset ? "Task auto-completed & reward claimed" : "Task reset & reward claimed",

      reward: rewardAmount,

      newBalance: user.balance,

      completedTasks: user.completedTasks,

      currentTaskProgress: user.currentTaskProgress,

      successfulInvites: user.successfulInvites,

      autoReset: shouldAutoReset // إضافة هذا الحقل للتمييز بين التلقائي واليدوي

    });



  } catch (err) {

    console.error("Complete task error:", err);

    res.status(500).json({ message: "Error completing task" });

  }

});



// تحديث تقدم المهمة عند اشتراك مدعو



app.post("/api/tasks/update-progress", authMiddleware, async (req, res) => {



  try {



    const { referrerId } = req.body;



    



    const referrer = await User.findById(referrerId);



    if (!referrer) return res.status(404).json({ message: "Referrer not found" });







    // زيادة تقدم المهمة الحالية بمقدار 1



    referrer.currentTaskProgress += 1;



    

if (referrer.currentTaskProgress >= 6) {

      const rewardAmount = calculateTaskReward(referrer.subscriptionType, 6);

      referrer.balance = (referrer.balance || 0) + rewardAmount;

      referrer.completedTasks = (referrer.completedTasks || 0) + 1;

      referrer.currentTaskProgress = 0;

      

      console.log(`🎉 Auto-completed task for ${referrer.username}! Reward: $${rewardAmount}`);

}

    

    // زيادة عدد الدعوات الناجحة



    referrer.successfulInvites += 1;







    await referrer.save();







    res.json({ 



      success: true, 



      message: "Progress updated successfully",



      currentTaskProgress: referrer.currentTaskProgress,



      successfulInvites: referrer.successfulInvites



    });







  } catch (err) {



    console.error("Update progress error:", err);



    res.status(500).json({ message: "Error updating progress" });



  }



});







// الحصول على معلومات المهمة للمستخدم



app.get("/api/user/task-info", authMiddleware, async (req, res) => {



  try {



    const user = await User.findById(req.user.id);



    if (!user) return res.status(404).json({ message: "User not found" });







    // حساب المكافأة المتوقعة



    const expectedReward = calculateTaskReward(user.subscriptionType, user.currentTaskProgress);



    



    res.json({



      completedTasks: user.completedTasks,



      currentTaskProgress: user.currentTaskProgress,



      successfulInvites: user.successfulInvites,



      expectedReward: expectedReward,



      canReset: user.currentTaskProgress >= 2 // يمكن إعادة المهمة عند التقدم 2 أو أكثر



    });







  } catch (err) {



    console.error("Task info error:", err);



    res.status(500).json({ message: "Error fetching task info" });



  }



});











// الحصول على إحصائيات الدعوات للمستخدم الحالي



app.get('/api/user/referral-stats', authMiddleware, async (req, res) => {



  try {



    const user = await User.findById(req.user.id);



    if (!user) return res.status(404).json({ message: 'User not found' });







    // البحث عن المستخدمين الذين سجلوا عبر كود الدعوة الخاص بالمستخدم



    const invitedUsers = await User.find({ referredBy: user.referralCode })



      .select('subscriptionActive subscriptionExpires');







    // العدد الإجمالي لكل من سجل



    const totalInvites = invitedUsers.length;







    // العدد الذين اشتركوا في أي خطة



    const successfulInvites = invitedUsers.filter(u =>



      u.subscriptionActive && u.subscriptionExpires > new Date()



    ).length;







    // حساب تقدم المهمة الحالي



    const currentProgress = Math.min(6, user.completedTasks || 0);







    res.json({



      totalInvites,



      successfulInvites,



      currentProgress // إرجاع التقدم الحالي المحسوب



    });



  } catch (err) {



    console.error('Referral stats error:', err);



    res.status(500).json({ message: 'Error fetching referral stats' });



  }



});







// الحصول على قائمة المستخدمين الذين تم دعوتهم



app.get('/api/user/invited-users', authMiddleware, async (req, res) => {



  try {



    const user = await User.findById(req.user.id);



    if (!user) return res.status(404).json({ message: 'User not found' });







    // البحث عن المستخدمين الذين قام هذا المستخدم بدعوتهم باستخدام referralCode



    const invitedUsers = await User.find({ referredBy: user.referralCode })



      .select('username email createdAt subscriptionType subscriptionActive subscriptionExpires')



      .sort({ createdAt: -1 });







    res.json({



      invitedUsers: invitedUsers.map(u => ({



        username: u.username,



        email: u.email,



        createdAt: u.createdAt,



        subscriptionType: u.subscriptionType,



        subscriptionActive: u.subscriptionActive && u.subscriptionExpires > new Date(),



        subscriptionExpires: u.subscriptionExpires



      }))



    });



  } catch (err) {



    console.error('Invited users error:', err);



    res.status(500).json({ message: 'Error fetching invited users' });



  }



});







// إحصائيات الدعوات للمسؤولين



app.get("/api/admin/referral-stats", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles || !req.user.roles.includes('admin')) {



      return res.status(403).json({ message: "Forbidden" });



    }







    // إحصائيات عامة عن الدعوات



    const totalReferrals = await User.countDocuments({ referredBy: { $ne: null } });



    



    // المستخدمون الأكثر دعوة



    const topReferrers = await User.aggregate([



      { $match: { totalInvites: { $gt: 0 } } },



      { $sort: { successfulInvites: -1 } },



      { $limit: 10 },



      { $project: { 



        username: 1, 



        email: 1, 



        totalInvites: 1, 



        successfulInvites: 1,



        referralCode: 1 



      } }



    ]);







    // معدل التحويل (الناجح/الكلي)



    const totalSuccessful = await User.aggregate([



      { $group: { _id: null, total: { $sum: "$successfulInvites" } } }



    ]);



    



    const conversionRate = totalReferrals > 0 



      ? (totalSuccessful[0]?.total || 0) / totalReferrals * 100 



      : 0;







    res.json({



      totalReferrals,



      topReferrers,



      conversionRate: conversionRate.toFixed(2)



    });







  } catch (err) {



    console.error("Referral stats error:", err);



    res.status(500).json({ message: "Error fetching referral statistics" });



  }



});







// Admin login



const ADMIN_USER = process.env.ADMIN_USER || 'admin';



const ADMIN_PASS = process.env.ADMIN_PASS || 'RealityLottery@2023';







app.post('/api/admin/login', (req, res) => {



  const { username, password } = req.body;



  if (username === ADMIN_USER && password === ADMIN_PASS) {



    const token = jwt.sign(



      { id: username, roles: ['admin'] },



      JWT_SECRET,



      { expiresIn: '7d' }



    );



    return res.json({ message: 'Admin login successful', token });



  } else {



    return res.status(401).json({ message: 'Invalid admin credentials' });



  }



});







app.get('/api/admin/users', authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles || !req.user.roles.includes('admin')) {



      return res.status(403).json({ message: 'Forbidden' });



    }



    const users = await User.find().select('-password').sort({ registeredAt: -1 });



    res.json({ 



      users: users.map(u => ({



        _id: u._id,



        username: u.username,



        email: u.email,



        fullName: u.fullName,



        referralCode: u.referralCode,        // تأكد من وجود هذا



        totalInvites: u.totalInvites,        // تأكد من وجود هذا



        successfulInvites: u.successfulInvites, // تأكد من وجود هذا



        referredBy: u.referredBy,            // تأكد من وجود هذا



        balance: u.balance,



        subscriptionType: u.subscriptionType,



        subscriptionActive: u.subscriptionActive,



        registeredAt: u.registeredAt



      }))



    });



  } catch (err) {



    console.error(err);



    res.status(500).json({ message: 'Server error' });



  }



});







app.get('/api/auth/me', authMiddleware, async (req, res) => {

  try {

    const user = await User.findById(req.user.id).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });



    // التقدم الحقيقي: الدعوات الناجحة + نقطة البونس لو عنده اشتراك

    const currentProgress = Math.min(6, (user.successfulInvites || 0) + (user.subscriptionActive ? 1 : 0));



    const expectedReward = calculateTaskReward(user.subscriptionType, currentProgress);



    return res.json({

      id: user._id,

      username: user.username,

      fullName: user.fullName,

      email: user.email,

      phone: user.phone,

      balance: user.balance,

      subscriptionType: user.subscriptionType,

      subscriptionActive: user.subscriptionActive,

      subscriptionExpires: user.subscriptionExpires,

      referralCode: user.referralCode,

      referredBy: user.referredBy,

      totalInvites: user.totalInvites,

      successfulInvites: user.successfulInvites,

      currentTaskProgress: user.currentTaskProgress || 0,

      completedTasks: user.completedTasks,

      currentProgress: currentProgress,

      expectedReward,

      canReset: currentProgress >= 2

    });

  } catch (err) {

    console.error('Me error:', err);

    return res.status(500).json({ message: 'Server error' });

  }

});







// نقطة نهاية التصحيح - التحقق من الحقول



app.get('/api/debug/fields', authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    // الحصول على عينة من المستخدمين



    const users = await User.find().limit(5).select('username completedTasks taskProgress');



    



    // التحقق من وجود الحقول في النموذج



    const userSchema = User.schema.obj;



    const hasCompletedTasks = userSchema.completedTasks !== undefined;



    const hasTaskProgress = userSchema.taskProgress !== undefined;



    



    res.json({



      schemaFields: {



        completedTasks: hasCompletedTasks,



        taskProgress: hasTaskProgress



      },



      sampleUsers: users.map(u => ({



        username: u.username,



        completedTasks: u.completedTasks,



        taskProgress: u.taskProgress



      })),



      message: hasCompletedTasks ? 



        "completedTasks field exists in schema" : 



        "WARNING: completedTasks field missing from schema"



    });



  } catch (err) {



    console.error("Debug fields error:", err);



    res.status(500).json({ message: "Debug error", error: err.message });



  }



});







// Admin stats



app.get("/api/admin/stats", authMiddleware, async (req, res) => {



  try {



    if (!req.user.roles?.includes("admin")) {



      return res.status(403).json({ message: "Forbidden" });



    }







    const totalUsers = await User.countDocuments();



    const paidUsers = await User.countDocuments({ subscriptionActive: true });



    const spins = 0;



    



    // إحصائيات الدعوات



    const totalInvites = await User.aggregate([



      { $group: { _id: null, total: { $sum: "$totalInvites" } } }



    ]);



    const successfulInvites = await User.aggregate([



      { $group: { _id: null, total: { $sum: "$successfulInvites" } } }



    ]);



    



    const totalWithdrawals = await Withdrawal.countDocuments();



    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });



    



    const totalPayments = await Payment.countDocuments();



    const pendingPayments = await Payment.countDocuments({ status: 'pending' });







    res.json({



      totalUsers,



      paidUsers,



      spins,



      totalInvites: totalInvites[0]?.total || 0,



      successfulInvites: successfulInvites[0]?.total || 0,



      totalWithdrawals,



      pendingWithdrawals,



      totalPayments,



      pendingPayments



    });







  } catch (err) {



    console.error("Stats error:", err);



    res.status(500).json({ message: "Error fetching stats" });



  }



});







// ================= STATIC FILES =================



const FRONTEND_PATH = process.env.FRONTEND_PATH || path.join(__dirname, 'public');



app.use(express.static(FRONTEND_PATH));







app.get('/', (req, res) => {



  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));



});







const MEDIA_PATH = process.env.MEDIA_PATH || path.join(__dirname, 'media');



app.use('/media', express.static(MEDIA_PATH));







const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');



app.use('/uploads', express.static(UPLOADS_PATH));







const DOCS_PATH = process.env.DOCS_PATH || path.join(__dirname, 'docs');



app.use('/docs', express.static(DOCS_PATH));







// SPA fallback (always last)



app.get('*', (req, res) => {



  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));



});







// ================= START =================



app.listen(PORT, () => {

  console.log(`🚀 Server running on port ${PORT}`);

  console.log(`🌐 Frontend served from: ${FRONTEND_PATH}`);

  console.log(`🗂 Media path: ${MEDIA_PATH}`);

});

























































