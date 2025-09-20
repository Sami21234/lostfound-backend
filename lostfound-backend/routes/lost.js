import express from "express";
import multer from "multer";
import LostItem from "../models/lostItems.js";

const router = express.Router();

// Configure multer for file upload (memory or disk storage)
const storage = multer.memoryStorage(); // or use diskStorage for saving to disk
const upload = multer({ storage });

// POST /api/report-lost
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { itemName, description, location } = req.body;
    const image = req.file; // this is the uploaded image

    console.log("✅ Report Lost Hit");
    console.log("📥 Body:", req.body);
    console.log("📷 File:", req.file);

    if (!itemName || !description || !location) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 📝 Construct new LostItem
    const newItem = new LostItem({
      itemName,
      description,
      location,
      image: image ? image.buffer : undefined,
      imageMimeType: image ? image.mimetype : undefined,

      // image: image?.buffer, // optional: store image buffer
      // imageMimeType: image?.mimetype, // optional: store MIME type
    });

    await newItem.save();

    res.status(201).json({ message: "Lost item reported", item: newItem });
  } catch (err) {
    console.error("🔥 Error in /report-lost:", err);
    res.status(500).json({ message: err.message });
  }
});
export default router;
