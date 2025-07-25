const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const router = express.Router();

// Get chat messages for user
router.get('/messages/:sessionId', async (req, res) => {
  try {
    const messages = await ChatMessage.find({ sessionId: req.params.sessionId })
      .sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
});

module.exports = router;