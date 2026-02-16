require("dotenv").config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const changePinRoutes = require('./routes/changePin.routes');
const verifyPinRoute = require('./routes/verify-pin');
const forgetPinRoutes = require('./routes/forget-pin');
const walletRoutes = require('./routes/walletRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const easebuzzRoutes = require('./routes/easebuzz.routes');
const bbpsRoutes = require('./routes/bbps.routes');
const adminRoutes = require("./routes/admin.routes");
const adminDashboardRoutes = require("./routes/admin.dashboard");
const userTicketRoutes = require('./routes/userTicket.routes');
const adminTicketRoutes = require('./routes/adminTicket.routes');
const app = express();

        // app.use(cors());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// app.options('*', cors());


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/change-pin', changePinRoutes);
app.use('/api/verify-pin', verifyPinRoute);
app.use('/api/forget-pin', forgetPinRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/easebuzz', easebuzzRoutes);
app.use('/api/bbps', bbpsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/user/tickets', userTicketRoutes);
app.use('/api/admin/tickets', adminTicketRoutes);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected, starting server...");
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }
};


startServer();