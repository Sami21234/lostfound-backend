import express from "express";
import FoundItem from "../models/foundItems.js";

const router = express.Router();

// POST report found item
router.post("/", async (req, res) => {
  try {
    const item = new FoundItem(req.body);
    await item.save();
    res.status(201).json({ message: "Found item reported", item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all found items
router.get("/", async (req, res) => {
  try {
    const items = await FoundItem.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
