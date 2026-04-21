require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const taskRoutes    = require('./routes/tasks');
const adminRoutes   = require('./routes/admin');
const commentRoutes = require('./routes/comments');

const app = express();

// On HuggingFace, nginx proxies /api/* to this process on 127.0.0.1:5000
// so requests arrive without an Origin header — CORS is only needed for local dev
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return cb(null, true);
    
    // Allow Hugging Face domains or locally allowed origins
    if (origin.endsWith('.hf.space') || origin.includes('huggingface.co') || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    
    // In production, be a bit more flexible if we're on HF
    if (process.env.NODE_ENV === 'production' && origin.includes('hf.space')) {
      return cb(null, true);
    }

    // Allow all in development for easier debugging
    if (process.env.NODE_ENV !== 'production') {
      return cb(null, true);
    }

    cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 500, standardHeaders: true, legacyHeaders: false });
const authLimiter    = rateLimit({ windowMs: 15*60*1000, max: 20,  message: { error: 'Too many attempts. Try again later.' } });

app.use(generalLimiter);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'taskflow-api', ts: new Date().toISOString() })
);

app.use('/api/auth',               authLimiter, authRoutes);
app.use('/api/tasks',              taskRoutes);
app.use('/api/tasks/:id/comments', commentRoutes);
app.use('/api/admin',              adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Global Error Manager]:', err.message || err);
  
  // Specific handling for CORS errors to make them more helpful
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'Security block: origin not allowed.', 
      details: process.env.NODE_ENV === 'production' ? undefined : err.message 
    });
  }

  res.status(500).json({ error: 'An unexpected error occurred.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '127.0.0.1', () =>
  console.log(`Taskflow API on port ${PORT} [${process.env.NODE_ENV || 'production'}]`)
);

module.exports = app;
