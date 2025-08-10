require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const User = require('./models/User');

const app = express();
app.use(express.json());

// Allow CORS only from your front-end origin
const ALLOWED_ORIGINS = [ 
  process.env.FRONTEND_ORIGIN || 'https://realitylottery.koyeb.app', 
  'http://localhost:3000', 
  'http://127.0.0.1:5500',
  'http://localhost:5500' // أضفت هذا للمزيد من المرونة
];
app.use(cors({
  origin: function(origin, callback){
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
});

// Helper: generate JWT
function generateToken(user) {
  return jwt.sign({ id: user._id, username: user.username, roles: user.roles }, JWT_SECRET, { expiresIn: '7d' });
}

// Auth middleware
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

// --- Routes

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, username, password, referral } = req.body;
    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });  
    if (existing) return res.status(409).json({ message: 'Email or username already used' });  

    const salt = await bcrypt.genSalt(10);  
    const hash = await bcrypt.hash(password, salt);  

    const user = new User({  
      fullName,  
      email: email.toLowerCase(),  
      phone,  
      username,  
      password: hash,  
      referral: referral || null  
    });  

    await user.save();  

    const token = generateToken(user);  

    return res.status(201).json({  
      message: 'User registered',  
      user: {  
        id: user._id,  
        username: user.username,  
        fullName: user.fullName,  
        email: user.email  
      },  
      token  
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const query = usernameOrEmail.includes('@') ? { email: usernameOrEmail.toLowerCase() } : { username: usernameOrEmail };  
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

// Admin login (use env ADMIN_USER / ADMIN_PASS)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'RealityLottery@2023';

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ username, roles: ['admin'] }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ message: 'Admin login successful', token });
  } else {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }
});

// Protected admin: list users
app.get('/api/admin/users', authMiddleware, async (req, res) => {
  try {
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const users = await User.find().select('-password').sort({ registeredAt: -1 });
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Example protected route: get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ====================== إضافة تعريف المسار هنا ======================
// 1. خدمة الملفات الثابتة للواجهة الأمامية
const FRONTEND_PATH = process.env.FRONTEND_PATH || path.join(__dirname, 'public');
app.use(express.static(FRONTEND_PATH));

// 2. مسار مباشر للصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

// 2. مسار لخدمة ملفات الصور أو الوسائط
const MEDIA_PATH = process.env.MEDIA_PATH || path.join(__dirname, 'media');
app.use('/media', express.static(MEDIA_PATH));

// 3. مسار لخدمة ملفات التحميلات
const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOADS_PATH));

// 4. مسار لخدمة ملفات PDF أو المستندات
const DOCS_PATH = process.env.DOCS_PATH || path.join(__dirname, 'docs');
app.use('/docs', express.static(DOCS_PATH));

// 5. مسار لجميع الطلبات الأخرى (لتطبيقات SPA مثل React)
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});
// ====================== نهاية إضافة تعريف المسار ======================

// Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving frontend from: ${FRONTEND_PATH}`);
  console.log(`Media files served from: ${MEDIA_PATH}`);
});
