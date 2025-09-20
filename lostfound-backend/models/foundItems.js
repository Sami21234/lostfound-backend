import mongoose from "mongoose";

const foundItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  image: { type: String }, // will store URL or base64
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("FoundItem", foundItemSchema);