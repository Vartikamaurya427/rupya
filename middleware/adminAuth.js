// const jwt = require("jsonwebtoken");

// module.exports = (req, res, next) => {
//   const token = req.headers.authorization;

//   if (!token) {
//     return res.status(403).json({ message: "Token required" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.admin = decoded;
//     next();
//   } catch (err) {
//     res.status(401).json({ message: "Invalid token" });
//   }
// };
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }
  const authHeader = req.headers.authorization; // Get Authorization header
if (!authHeader) {
    return res.status(403).json({ message: "Token required" });
  }
  if (!authHeader) {
    return res.status(403).json({ message: "Token required" });
  }

  // Token format: "Bearer token"
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // decoded contains adminId
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};