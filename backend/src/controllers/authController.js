const prisma = require("../prismaClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = async (req, res) => {
  const { username, email, password } = req.body;

  // Input validation (prevents crashes like bcrypt.hash(undefined) and bad data).
  if (!username || typeof username !== "string" || username.trim().length < 2) {
    return res.status(400).json({ message: "Username must be at least 2 characters." });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ message: "A valid email is required." });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    if (!process.env.JWT_SECRET) {
      console.error("[register] CRITICAL: JWT_SECRET is missing in environment variables.");
      throw new Error("Server misconfiguration: Missing JWT_SECRET");
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "3d" },
    );

    const userDetails = {
      id: user.id,
      email: user.email,
      username: user.username,
    };

    res.status(201).json({ user: userDetails, token });
  } catch (error) {
    console.error("[register] Error:", error.message);

    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ message: "Username or email already exists" });
    }

    res.status(500).json({ message: "Server error during registration." });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ message: "Account exists, please log in with Google" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "3d" },
    );

    const userDetails = {
      id: user.id,
      email: user.email,
      username: user.username,
    };

    res.json({ user: userDetails, token });
  } catch (error) {
    console.error("[login] Login Error:", error);
    res.status(500).json({ message: "Server error during login. Please try again later." });
  }
};

const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, username: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found in database" });
    }
    res.json(user);
  } catch (error) {
    console.error("[getMe] Server Error:", error);
    res.status(500).json({ message: "Server error while fetching user" });
  }
};

module.exports = {
  register,
  login,
  getMe,
};
