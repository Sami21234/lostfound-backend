import mongoose from "mongoose";

const lostItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  image: { type: Buffer }, // 🔥 must be Buffer for multer memoryStorage
  imageMimeType: { type: String }, // optional but good to have
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("LostItem", lostItemSchema);
