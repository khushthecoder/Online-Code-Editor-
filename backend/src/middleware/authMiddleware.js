const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token format is incorrect" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("[authMiddleware] Token verification failed:", error.message);
    return res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = authMiddleware;
