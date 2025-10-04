import mongoose from "mongoose";

const foundItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  imageUrl: { type: String }, // 🔧 FIXED: Changed from 'image' to 'imageUrl'
  contactName: { type: String }, // 🔧 ADDED: Missing contact fields
  contactPhone: { type: String },
  contactEmail: { type: String },
  dateFound: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("FoundItem", foundItemSchema);