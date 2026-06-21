const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running smoothly on port ${PORT}`));