const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// تحديد المسار الحالي للمجلد الرئيسي
const __dirname = path.resolve();

// خدمة الملفات الثابتة من المجلد الرئيسي
app.use(express.static(__dirname));

// متغير البورت من البيئة أو 3000 محليًا
const PORT = process.env.PORT || 3000;

// ... (بقية إعدادات MongoDB والسكيمات تبقى كما هي)

// تعديل المسار الرئيسي لقراءة index.html من المجلد الجذر
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ... (بقية الروتات تبقى كما هي)

// بدء السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📁 Serving files from: ${__dirname}`);
});
