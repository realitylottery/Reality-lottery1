const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User"); // عدل المسار حسب مكان ملف User.js

// اتصال بقاعدة البيانات
mongoose.connect("mongodb+srv://realitylottery:Moataz1234@realitylottery.3l31mmt.mongodb.net/?retryWrites=true&w=majority&appName=realitylottery")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ DB Connection error:", err));

(async () => {
  try {
    const username = "admin"; 
    const password = "RealityLottery@2023"; 
    const email = "admin@site.com";

    // شوف إذا الأدمن موجود أصلاً
    let existing = await User.findOne({ username });
    if (existing) {
      console.log("⚠️ Admin user already exists");
      return mongoose.disconnect();
    }

    // تشفير الباسورد
    const hashed = await bcrypt.hash(password, 10);

    // إنشاء الأدمن
    const admin = new User({
      username,
      email,
      password: hashed,
      role: "admin"
    });

    await admin.save();
    console.log("✅ Admin user created successfully!");
  } catch (err) {
    console.error("❌ Error creating admin:", err);
  } finally {
    mongoose.disconnect();
  }
})();
