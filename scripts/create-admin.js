const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const Admin = require("../models/Admin");

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB Connected");

    const adminExists = await Admin.findOne({
      email: process.env.ADMIN_EMAIL
    });

    if (adminExists) {
      console.log("❌ Admin already exists");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD,
      10
    );

    await Admin.create({
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword
    });

    console.log("Admin created successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
