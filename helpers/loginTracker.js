const UAParser = require("ua-parser-js");
const geoip = require("geoip-lite");
const LoginHistory = require("../models/LoginHistory");
const User = require("../models/User"); // User model import karna zaroori

async function trackLogin(userId, req) {
  try {
    if (!userId) return;

    // 🔹 Fetch user info
    const user = await User.findById(userId).select("name username");

    // 1️⃣ IP detect karo
    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (ip.includes(",")) ip = ip.split(",")[0];
    if (ip === "::1") ip = "127.0.0.1";

    // 2️⃣ Location from IP
    const geo = geoip.lookup(ip);
    const locationData = geo
      ? `${geo.city || "-"}, ${geo.country || "-"}` 
      : "Unknown";

    // 3️⃣ Browser & OS parse karo
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    const browser = ua.browser.name || "-";
    const osName = ua.os.name || "-";
    const deviceType = ua.device.type || "Desktop";

    // 4️⃣ LoginHistory me save karo
    await LoginHistory.create({
      userId,
      user: user ? { name: user.name || "-", username: user.username || "-" } : { name: "-", username: "-" },
      deviceId: "",             
      deviceModel: deviceType,
      deviceManufacturer: "-",  
      os: osName,
      browser: browser,
      location: locationData,
      ipAddress: ip
    });

  } catch (err) {
    console.error("❌ Login Tracker Error:", err);
  }
}

module.exports = { trackLogin };
