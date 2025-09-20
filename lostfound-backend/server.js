import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import lostRoutes from "./routes/lost.js";
import foundRoutes from "./routes/found.js";
import userRoutes from "./routes/user.js";

// Load environment variables
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Original routes (keep these)
app.use("/api/lost", lostRoutes);
app.use("/api/found", foundRoutes);
app.use("/api/user", userRoutes);

// Additional routes to match frontend expectations
// Combined items endpoint (both lost and found)
app.get("/api/items", async (req, res) => {
  try {
    // Import models here to avoid circular imports
    const LostItem = (await import("./models/lostItems.js")).default;
    const FoundItem = (await import("./models/foundItems.js")).default;
    
    const lostItems = await LostItem.find();
    const foundItems = await FoundItem.find();
    
    // Add type field to distinguish between lost and found
    const allItems = [
      ...lostItems.map(item => ({ ...item.toObject(), type: 'lost' })),
      ...foundItems.map(item => ({ ...item.toObject(), type: 'found' }))
    ];
    
    res.json(allItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Direct login route (shortcut to /api/user/login)
app.post("/api/login", async (req, res) => {
  try {
    const User = (await import("./models/user.js")).default;
    const bcrypt = (await import("bcryptjs")).default;
    
    console.log("Login request body:", req.body); // Debug log
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    res.json({ message: "Login successful", user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Direct register route (shortcut to /api/user/register)
app.post("/api/register", async (req, res) => {
  try {
    const User = (await import("./models/user.js")).default;
    const bcrypt = (await import("bcryptjs")).default;
    
    console.log("Register request body:", req.body); // Debug log
    
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ 
      message: "User registered successfully", 
      user: { id: user._id, name: user.name, email: user.email } 
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Direct report-lost route (shortcut to /api/lost)


app.use("/api/report-lost", lostRoutes);


// Register route without /api prefix (for frontend compatibility)
app.post("/register", async (req, res) => {
  try {
    const User = (await import("./models/user.js")).default;
    const bcrypt = (await import("bcryptjs")).default;
    
    console.log("Register request body:", req.body); // Debug log
    
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ 
      message: "User registered successfully", 
      user: { id: user._id, name: user.name, email: user.email } 
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Login route without /api prefix (for frontend compatibility)
app.post("/login", async (req, res) => {
  try {
    const User = (await import("./models/user.js")).default;
    const bcrypt = (await import("bcryptjs")).default;
    
    console.log("Login request body:", req.body); // Debug log
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    res.json({ message: "Login successful", user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

// Test route
app.get("/", (req, res) => {
  res.send("Lost & Found API running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Available endpoints:`);
  console.log(`   GET  /api/items`);
  console.log(`   POST /api/login`);
  console.log(`   POST /api/register`);
  console.log(`   POST /api/report-lost`);
  console.log(`   GET  /api/lost`);
  console.log(`   GET  /api/found`);
  console.log(`   POST /api/user/login`);
  console.log(`   POST /api/user/register`);
});