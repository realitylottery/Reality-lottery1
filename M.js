// createAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/User");

(async () => {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const username = "admin";
    const email = "admin@site.com";
    const fullName = "Main Administrator";
    const password = "RealityLottery@2023";

    // تشفير الباسورد
    const hashedPassword = await bcrypt.hash(password, 10);

    // إنشاء الأدمن
    const admin = new User({
      fullName,
      email,
      username,
      password: hashedPassword,
      roles: ["admin"],   // لو حابب تستخدم المصفوفة
      role: "admin",      // ولو حابب تستخدم الحقل الواحد
      balance: 0,
      subscriptionType: "Free",
    });

    await admin.save();
    console.log("✅ Admin user created successfully");
    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error creating admin:", err.message);
    mongoose.connection.close();
  }
})();
