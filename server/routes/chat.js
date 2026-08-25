/**
 * Multi-Turn Conversational Journaling API
 * Implements Multi-Turn Gemini Interaction & Firestore Interaction Logging
 */

const express = require('express');
const router = express.Router();
const { authenticateFirebaseUser } = require('../middleware/auth');
const { chatWithGemini } = require('../services/gemini');
const { saveUserInteraction, getUserInteractions } = require('../services/firestore');

router.use(authenticateFirebaseUser);

/**
 * POST /api/chat
 * Multi-turn journaling and brainstorming chat with Gemini
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { messages = [], contextTitle = '' } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const systemInstruction = `You are a supportive, insightful, and empathetic AI Journaling Companion and Brainstorming Partner.
You listen attentively, ask clarifying questions, help unknot complex thoughts, and guide the user toward actionable clarity and inner peace.
Current Journal Context: "${contextTitle || 'General Reflection'}"`;

    // 1. Execute multi-turn conversation with fallback ladder
    const { reply, modelUsed } = await chatWithGemini(messages, systemInstruction);

    // 2. Persist interaction log to Firestore: /users/{userId}/interactions/{interactionId}
    const interactionLog = await saveUserInteraction(userId, {
      contextTitle,
      userMessage: messages[messages.length - 1].content,
      assistantReply: reply,
      modelUsed,
      messageCount: messages.length + 1
    });

    res.json({
      success: true,
      reply,
      modelUsed,
      interactionId: interactionLog.id
    });
  } catch (err) {
    console.error('[Chat Route] Error in chat interaction:', err);
    res.status(500).json({ error: 'Failed to process chat message', message: err.message });
  }
});

/**
 * GET /api/chat/history
 * Retrieve user's previous interaction logs
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.uid;
    const interactions = await getUserInteractions(userId, 30);
    res.json({ success: true, count: interactions.length, interactions });
  } catch (err) {
    console.error('[Chat Route] Error fetching history:', err);
    res.status(500).json({ error: 'Failed to retrieve interaction history', message: err.message });
  }
});

module.exports = router;
