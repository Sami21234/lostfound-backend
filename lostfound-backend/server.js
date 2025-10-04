import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import lostRoutes from "./routes/lost.js";
import foundRoutes from "./routes/found.js";
import userRoutes from "./routes/user.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔥 MATCHING ALGORITHM - Find similar items
function findMatches(newItem, existingItems) {
  const matches = [];
  const newItemName = newItem.itemName.toLowerCase();
  const newDescription = (newItem.description || '').toLowerCase();
  const newLocation = (newItem.location || '').toLowerCase();

  for (const item of existingItems) {
    let score = 0;
    const itemName = item.itemName.toLowerCase();
    const itemDescription = (item.description || '').toLowerCase();
    const itemLocation = (item.location || '').toLowerCase();

    // Check item name similarity
    if (itemName.includes(newItemName) || newItemName.includes(itemName)) {
      score += 50;
    }

    // Check if same words exist
    const newWords = newItemName.split(' ');
    const itemWords = itemName.split(' ');
    const commonWords = newWords.filter(word => itemWords.includes(word));
    score += commonWords.length * 10;

    // Check description similarity
    if (newDescription && itemDescription) {
      const descWords = newDescription.split(' ');
      const itemDescWords = itemDescription.split(' ');
      const commonDescWords = descWords.filter(word => 
        word.length > 3 && itemDescWords.includes(word)
      );
      score += commonDescWords.length * 5;
    }

    // Check location similarity
    if (newLocation && itemLocation) {
      if (itemLocation.includes(newLocation) || newLocation.includes(itemLocation)) {
        score += 30;
      }
    }

    // Check date proximity (within 7 days)
    const newDate = new Date(newItem.dateFound || newItem.dateLost);
    const itemDate = new Date(item.dateLost || item.dateFound);
    const daysDiff = Math.abs((newDate - itemDate) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) {
      score += 20;
    }

    // If score is high enough, consider it a match
    if (score >= 60) {
      matches.push({
        item: item,
        matchScore: score
      });
    }
  }

  // Sort by match score (highest first)
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

// 🔧 Handle found item reports with AUTO-MATCHING
app.post('/api/report-found', upload.single('image'), async (req, res) => {
  try {
    console.log('📤 Report Found Body:', req.body);
    console.log('📸 Uploaded File:', req.file);

    const FoundItem = (await import("./models/foundItems.js")).default;
    const LostItem = (await import("./models/lostItems.js")).default;

    // Create found item
    const foundItem = new FoundItem({
      itemName: req.body.itemName,
      description: req.body.description,
      location: req.body.location,
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      dateFound: req.body.dateFound,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null
    });

    const savedItem = await foundItem.save();
    console.log('✅ Found item saved:', savedItem);

    // 🔍 AUTO-MATCH: Find similar lost items
    const lostItems = await LostItem.find();
    const matches = findMatches(savedItem.toObject(), lostItems);

    console.log(`🎯 Found ${matches.length} potential matches`);

    // Auto-remove matched lost items if high confidence match (score >= 80)
    const removedItems = [];
    for (const match of matches) {
      if (match.matchScore >= 80) {
        await LostItem.findByIdAndDelete(match.item._id);
        removedItems.push(match.item);
        console.log(`🗑️ Auto-removed lost item: ${match.item.itemName} (Score: ${match.matchScore})`);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Found item reported successfully',
      item: savedItem,
      matches: matches.map(m => ({
        item: m.item,
        matchScore: m.matchScore,
        autoRemoved: m.matchScore >= 80
      })),
      autoRemovedCount: removedItems.length
    });
  } catch (error) {
    console.error('❌ Error saving found item:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving found item',
      error: error.message
    });
  }
});

// 🔧 Handle lost item reports
app.post('/api/report-lost', upload.single('image'), async (req, res) => {
  try {
    console.log('📤 Report Lost Body:', req.body);
    console.log('📸 Uploaded File:', req.file);

    const LostItem = (await import("./models/lostItems.js")).default;

    const lostItem = new LostItem({
      itemName: req.body.itemName,
      description: req.body.description,
      location: req.body.location,
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      dateLost: req.body.dateLost,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null
    });

    const savedItem = await lostItem.save();
    console.log('✅ Lost item saved:', savedItem);

    res.status(201).json({
      success: true,
      message: 'Lost item reported successfully',
      item: savedItem
    });
  } catch (error) {
    console.error('❌ Error saving lost item:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving lost item',
      error: error.message
    });
  }
});

// 🆕 Manual match endpoint - Mark lost item as found
app.post('/api/mark-as-found/:lostItemId', async (req, res) => {
  try {
    const LostItem = (await import("./models/lostItems.js")).default;
    const { foundItemId, foundBy } = req.body;

    const lostItem = await LostItem.findById(req.params.lostItemId);
    if (!lostItem) {
      return res.status(404).json({ message: 'Lost item not found' });
    }

    // Option 1: Delete the lost item
    await LostItem.findByIdAndDelete(req.params.lostItemId);

    // Option 2: Or mark as found (if you add a 'status' field to your model)
    // lostItem.status = 'found';
    // lostItem.foundItemId = foundItemId;
    // lostItem.foundBy = foundBy;
    // await lostItem.save();

    res.json({
      success: true,
      message: 'Lost item marked as found and removed from dashboard'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking item as found',
      error: error.message
    });
  }
});

// 🗑️ DELETE Lost Item - User must verify ownership
app.delete('/api/lost/:id', async (req, res) => {
  try {
    const LostItem = (await import("./models/lostItems.js")).default;
    const { contactPhone, contactEmail } = req.body;

    const item = await LostItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found' 
      });
    }

    // Verify ownership - user must provide matching contact info
    const phoneMatch = contactPhone && item.contactPhone === contactPhone;
    const emailMatch = contactEmail && item.contactEmail === contactEmail;

    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Contact information does not match.'
      });
    }

    await LostItem.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Lost item deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting item',
      error: error.message
    });
  }
});

// 🗑️ DELETE Found Item - User must verify ownership
app.delete('/api/found/:id', async (req, res) => {
  try {
    const FoundItem = (await import("./models/foundItems.js")).default;
    const { contactPhone, contactEmail } = req.body;

    const item = await FoundItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found' 
      });
    }

    // Verify ownership
    const phoneMatch = contactPhone && item.contactPhone === contactPhone;
    const emailMatch = contactEmail && item.contactEmail === contactEmail;

    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Contact information does not match.'
      });
    }

    await FoundItem.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Found item deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting item',
      error: error.message
    });
  }
});

// Original routes
app.use("/api/lost", lostRoutes);
app.use("/api/found", foundRoutes);
app.use("/api/user", userRoutes);

// Combined items endpoint
app.get("/api/items", async (req, res) => {
  try {
    const LostItem = (await import("./models/lostItems.js")).default;
    const FoundItem = (await import("./models/foundItems.js")).default;
    
    const lostItems = await LostItem.find();
    const foundItems = await FoundItem.find();
    
    const allItems = [
      ...lostItems.map(item => ({ ...item.toObject(), type: 'lost' })),
      ...foundItems.map(item => ({ ...item.toObject(), type: 'found' }))
    ];
    
    res.json(allItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Authentication routes
app.post("/api/login", async (req, res) => {
  try {
    const User = (await import("./models/user.js")).default;
    const bcrypt = (await import("bcryptjs")).default;
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    res.json({ 
      message: "Login successful", 
      user: { id: user._id, name: user.name, email: user.email } 
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const User = (await import("./models/user.js")).default;
    const bcrypt = (await import("bcryptjs")).default;
    
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

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

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

// Test route
app.get("/", (req, res) => {
  res.send("Lost & Found API with Auto-Matching running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Available endpoints:`);
  console.log(`   POST /api/report-found (auto-matches & removes lost items)`);
  console.log(`   POST /api/report-lost`);
  console.log(`   POST /api/mark-as-found/:lostItemId (manual match)`);
  console.log(`   GET  /api/items`);
  console.log(`   POST /api/login`);
  console.log(`   POST /api/register`);
});

// import express from "express";
// import mongoose from "mongoose";
// import cors from "cors";
// import dotenv from "dotenv";
// import multer from "multer";
// import path from "path";
// import fs from "fs";
// import nodemailer from "nodemailer";
// import { fileURLToPath } from 'url';
// import lostRoutes from "./routes/lost.js";
// import foundRoutes from "./routes/found.js";
// import userRoutes from "./routes/user.js";

// dotenv.config();

// const app = express();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Create uploads directory if it doesn't exist
// const uploadsDir = path.join(__dirname, 'uploads');
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
// }

// // Configure email transporter
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

// // Verify email configuration on startup
// transporter.verify((error, success) => {
//   if (error) {
//     console.log('Email configuration error:', error);
//   } else {
//     console.log('Email server ready to send messages');
//   }
// });

// // Configure multer
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/')
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + '-' + file.originalname)
//   }
// });

// const upload = multer({ 
//   storage: storage,
//   limits: {
//     fileSize: 5 * 1024 * 1024
//   },
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype.startsWith('image/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only image files are allowed!'), false);
//     }
//   }
// });

// // Middlewares
// app.use(cors());
// app.use(express.json());
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // Email sending function
// async function sendMatchNotification(lostItem, foundItem, matchScore) {
//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: lostItem.contactEmail,
//     subject: `Good News! We Found a Match for Your Lost ${lostItem.itemName}`,
//     html: `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: #4CAF50;">Great News!</h2>
//         <p>Hi ${lostItem.contactName},</p>
//         <p>Someone has reported finding an item that matches your lost <strong>${lostItem.itemName}</strong>!</p>
        
//         <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
//           <h3>Found Item Details:</h3>
//           <p><strong>Item:</strong> ${foundItem.itemName}</p>
//           <p><strong>Description:</strong> ${foundItem.description}</p>
//           <p><strong>Location Found:</strong> ${foundItem.location}</p>
//           <p><strong>Date Found:</strong> ${new Date(foundItem.dateFound).toLocaleDateString()}</p>
//           <p><strong>Match Confidence:</strong> ${matchScore}%</p>
//         </div>

//         <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
//           <h3>Contact the Finder:</h3>
//           <p><strong>Name:</strong> ${foundItem.contactName}</p>
//           <p><strong>Phone:</strong> ${foundItem.contactPhone}</p>
//           <p><strong>Email:</strong> ${foundItem.contactEmail}</p>
//         </div>

//         <p>Please reach out to them to verify and retrieve your item!</p>
        
//         <p style="color: #666; font-size: 12px; margin-top: 30px;">
//           This is an automated notification from Lost & Found App.<br>
//           If this doesn't match your item, you can ignore this email.
//         </p>
//       </div>
//     `
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     console.log(`Email sent to ${lostItem.contactEmail}`);
//     return true;
//   } catch (error) {
//     console.error('Error sending email:', error);
//     return false;
//   }
// }

// // Matching algorithm
// function findMatches(newItem, existingItems) {
//   const matches = [];
//   const newItemName = newItem.itemName.toLowerCase();
//   const newDescription = (newItem.description || '').toLowerCase();
//   const newLocation = (newItem.location || '').toLowerCase();

//   for (const item of existingItems) {
//     let score = 0;
//     const itemName = item.itemName.toLowerCase();
//     const itemDescription = (item.description || '').toLowerCase();
//     const itemLocation = (item.location || '').toLowerCase();

//     if (itemName.includes(newItemName) || newItemName.includes(itemName)) {
//       score += 50;
//     }

//     const newWords = newItemName.split(' ');
//     const itemWords = itemName.split(' ');
//     const commonWords = newWords.filter(word => itemWords.includes(word));
//     score += commonWords.length * 10;

//     if (newDescription && itemDescription) {
//       const descWords = newDescription.split(' ');
//       const itemDescWords = itemDescription.split(' ');
//       const commonDescWords = descWords.filter(word => 
//         word.length > 3 && itemDescWords.includes(word)
//       );
//       score += commonDescWords.length * 5;
//     }

//     if (newLocation && itemLocation) {
//       if (itemLocation.includes(newLocation) || newLocation.includes(itemLocation)) {
//         score += 30;
//       }
//     }

//     const newDate = new Date(newItem.dateFound || newItem.dateLost);
//     const itemDate = new Date(item.dateLost || item.dateFound);
//     const daysDiff = Math.abs((newDate - itemDate) / (1000 * 60 * 60 * 24));
//     if (daysDiff <= 7) {
//       score += 20;
//     }

//     if (score >= 60) {
//       matches.push({
//         item: item,
//         matchScore: score
//       });
//     }
//   }

//   return matches.sort((a, b) => b.matchScore - a.matchScore);
// }

// // Handle found item reports with AUTO-MATCHING and EMAIL NOTIFICATIONS
// app.post('/api/report-found', upload.single('image'), async (req, res) => {
//   try {
//     console.log('Report Found Body:', req.body);
//     console.log('Uploaded File:', req.file);

//     const FoundItem = (await import("./models/foundItems.js")).default;
//     const LostItem = (await import("./models/lostItems.js")).default;

//     const foundItem = new FoundItem({
//       itemName: req.body.itemName,
//       description: req.body.description,
//       location: req.body.location,
//       contactName: req.body.contactName,
//       contactPhone: req.body.contactPhone,
//       contactEmail: req.body.contactEmail,
//       dateFound: req.body.dateFound,
//       imageUrl: req.file ? `/uploads/${req.file.filename}` : null
//     });

//     const savedItem = await foundItem.save();
//     console.log('Found item saved:', savedItem);

//     // Find similar lost items
//     const lostItems = await LostItem.find();
//     const matches = findMatches(savedItem.toObject(), lostItems);

//     console.log(`Found ${matches.length} potential matches`);

//     // Send email notifications and auto-remove high confidence matches
//     const removedItems = [];
//     const emailsSent = [];

//     for (const match of matches) {
//       if (match.matchScore >= 70) {
//         // Send email notification
//         if (match.item.contactEmail) {
//           const emailSent = await sendMatchNotification(
//             match.item, 
//             savedItem.toObject(), 
//             match.matchScore
//           );
          
//           if (emailSent) {
//             emailsSent.push(match.item.contactEmail);
//           }
//         }

//         // Auto-remove if very high confidence
//         if (match.matchScore >= 85) {
//           await LostItem.findByIdAndDelete(match.item._id);
//           removedItems.push(match.item);
//           console.log(`Auto-removed lost item: ${match.item.itemName} (Score: ${match.matchScore})`);
//         }
//       }
//     }

//     res.status(201).json({
//       success: true,
//       message: 'Found item reported successfully',
//       item: savedItem,
//       matches: matches.map(m => ({
//         item: m.item,
//         matchScore: m.matchScore,
//         autoRemoved: m.matchScore >= 85,
//         emailSent: emailsSent.includes(m.item.contactEmail)
//       })),
//       autoRemovedCount: removedItems.length,
//       emailsSentCount: emailsSent.length
//     });
//   } catch (error) {
//     console.error('Error saving found item:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error saving found item',
//       error: error.message
//     });
//   }
// });

// // Handle lost item reports
// app.post('/api/report-lost', upload.single('image'), async (req, res) => {
//   try {
//     console.log('Report Lost Body:', req.body);
//     console.log('Uploaded File:', req.file);

//     const LostItem = (await import("./models/lostItems.js")).default;

//     const lostItem = new LostItem({
//       itemName: req.body.itemName,
//       description: req.body.description,
//       location: req.body.location,
//       contactName: req.body.contactName,
//       contactPhone: req.body.contactPhone,
//       contactEmail: req.body.contactEmail,
//       dateLost: req.body.dateLost,
//       imageUrl: req.file ? `/uploads/${req.file.filename}` : null
//     });

//     const savedItem = await lostItem.save();
//     console.log('Lost item saved:', savedItem);

//     res.status(201).json({
//       success: true,
//       message: 'Lost item reported successfully',
//       item: savedItem
//     });
//   } catch (error) {
//     console.error('Error saving lost item:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error saving lost item',
//       error: error.message
//     });
//   }
// });

// // Manual match endpoint
// app.post('/api/mark-as-found/:lostItemId', async (req, res) => {
//   try {
//     const LostItem = (await import("./models/lostItems.js")).default;
//     const { foundItemId, foundBy } = req.body;

//     const lostItem = await LostItem.findById(req.params.lostItemId);
//     if (!lostItem) {
//       return res.status(404).json({ message: 'Lost item not found' });
//     }

//     await LostItem.findByIdAndDelete(req.params.lostItemId);

//     res.json({
//       success: true,
//       message: 'Lost item marked as found and removed from dashboard'
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Error marking item as found',
//       error: error.message
//     });
//   }
// });

// // DELETE Lost Item
// app.delete('/api/lost/:id', async (req, res) => {
//   try {
//     const LostItem = (await import("./models/lostItems.js")).default;
//     const { contactPhone, contactEmail, adminPassword } = req.body;

//     const ADMIN_PASSWORD = "delete2025";

//     const item = await LostItem.findById(req.params.id);
//     if (!item) {
//       return res.status(404).json({ 
//         success: false, 
//         message: 'Item not found' 
//       });
//     }

//     // Check admin password
//     if (adminPassword === ADMIN_PASSWORD) {
//       await LostItem.findByIdAndDelete(req.params.id);
//       return res.json({
//         success: true,
//         message: 'Item deleted by admin'
//       });
//     }

//     // Verify ownership
//     const phoneMatch = contactPhone && item.contactPhone === contactPhone;
//     const emailMatch = contactEmail && item.contactEmail === contactEmail;

//     if (!phoneMatch && !emailMatch) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized. Contact information does not match.'
//       });
//     }

//     await LostItem.findByIdAndDelete(req.params.id);

//     res.json({
//       success: true,
//       message: 'Lost item deleted successfully'
//     });
//   } catch (error) {
//     console.error('Delete error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting item',
//       error: error.message
//     });
//   }
// });

// // DELETE Found Item
// app.delete('/api/found/:id', async (req, res) => {
//   try {
//     const FoundItem = (await import("./models/foundItems.js")).default;
//     const { contactPhone, contactEmail, adminPassword } = req.body;

//     const ADMIN_PASSWORD = "delete2025";

//     const item = await FoundItem.findById(req.params.id);
//     if (!item) {
//       return res.status(404).json({ 
//         success: false, 
//         message: 'Item not found' 
//       });
//     }

//     // Check admin password
//     if (adminPassword === ADMIN_PASSWORD) {
//       await FoundItem.findByIdAndDelete(req.params.id);
//       return res.json({
//         success: true,
//         message: 'Item deleted by admin'
//       });
//     }

//     // Verify ownership
//     const phoneMatch = contactPhone && item.contactPhone === contactPhone;
//     const emailMatch = contactEmail && item.contactEmail === contactEmail;

//     if (!phoneMatch && !emailMatch) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized. Contact information does not match.'
//       });
//     }

//     await FoundItem.findByIdAndDelete(req.params.id);

//     res.json({
//       success: true,
//       message: 'Found item deleted successfully'
//     });
//   } catch (error) {
//     console.error('Delete error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting item',
//       error: error.message
//     });
//   }
// });

// // Original routes
// app.use("/api/lost", lostRoutes);
// app.use("/api/found", foundRoutes);
// app.use("/api/user", userRoutes);

// // Combined items endpoint
// app.get("/api/items", async (req, res) => {
//   try {
//     const LostItem = (await import("./models/lostItems.js")).default;
//     const FoundItem = (await import("./models/foundItems.js")).default;
    
//     const lostItems = await LostItem.find();
//     const foundItems = await FoundItem.find();
    
//     const allItems = [
//       ...lostItems.map(item => ({ ...item.toObject(), type: 'lost' })),
//       ...foundItems.map(item => ({ ...item.toObject(), type: 'found' }))
//     ];
    
//     res.json(allItems);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // Authentication routes
// app.post("/api/login", async (req, res) => {
//   try {
//     const User = (await import("./models/user.js")).default;
//     const bcrypt = (await import("bcryptjs")).default;
    
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ message: "Email and password are required" });
//     }

//     const user = await User.findOne({ email });
//     if (!user) return res.status(400).json({ message: "Invalid email or password" });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

//     res.json({ 
//       message: "Login successful", 
//       user: { id: user._id, name: user.name, email: user.email } 
//     });
//   } catch (err) {
//     console.error("Login error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });

// app.post("/api/register", async (req, res) => {
//   try {
//     const User = (await import("./models/user.js")).default;
//     const bcrypt = (await import("bcryptjs")).default;
    
//     const { name, email, password } = req.body;

//     if (!name || !email || !password) {
//       return res.status(400).json({ message: "Name, email, and password are required" });
//     }

//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).json({ message: "User already exists" });

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const user = new User({ name, email, password: hashedPassword });
//     await user.save();

//     res.status(201).json({ 
//       message: "User registered successfully", 
//       user: { id: user._id, name: user.name, email: user.email } 
//     });
//   } catch (err) {
//     console.error("Register error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });

// // MongoDB connection
// mongoose.connect(process.env.MONGO_URI)
// .then(() => console.log("MongoDB connected"))
// .catch(err => console.error("MongoDB error:", err));

// // Test route
// app.get("/", (req, res) => {
//   res.send("Lost & Found API with Email Notifications running...");
// });

// // Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
//   console.log(`Available endpoints:`);
//   console.log(`   POST   /api/report-found (with email notifications)`);
//   console.log(`   POST   /api/report-lost`);
//   console.log(`   DELETE /api/lost/:id`);
//   console.log(`   DELETE /api/found/:id`);
//   console.log(`   GET    /api/items`);
//   console.log(`   POST   /api/login`);
//   console.log(`   POST   /api/register`);
// });