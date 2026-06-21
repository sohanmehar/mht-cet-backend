const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const preferenceRoutes = require('./routes/preference');
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🔌 Connected to MongoDB Atlas Cloud Cluster Success!"))
  .catch((err) => console.error("❌ Database Connection Error:", err));

// Routes Configuration
app.use('/api', require('./routes/predictor'));
app.use('/api/auth', authRoutes);
app.use('/api/preferences', preferenceRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running smoothly on port ${PORT}`));