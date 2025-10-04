import mongoose from "mongoose";

const lostItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  imageUrl: { type: String }, // 🔧 FIXED: Changed from Buffer to String URL
  contactName: { type: String }, // 🔧 ADDED: Missing contact fields
  contactPhone: { type: String },
  contactEmail: { type: String },
  dateLost: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("LostItem", lostItemSchema);