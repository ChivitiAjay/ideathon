/**
 * Mindscape Mood & Emotional Resonance Analytics API
 * Enhancement #1 & #2: Analytics engine computing emotional resonance and growth trends
 */

const express = require('express');
const router = express.Router();
const { authenticateFirebaseUser } = require('../middleware/auth');
const { getUserJournalEntries } = require('../services/firestore');
const { generateContentWithFallback } = require('../services/gemini');

router.use(authenticateFirebaseUser);

/**
 * GET /api/analytics/mood
 * Aggregate mood metrics, emotional resonance scores, tag frequencies, and streak
 */
router.get('/mood', async (req, res) => {
  try {
    const userId = req.user.uid;
    const entries = await getUserJournalEntries(userId, 100);

    if (entries.length === 0) {
      return res.json({
        totalEntries: 0,
        streakDays: 0,
        emotionsAverage: { gratitude: 0, clarity: 0, stress: 0, joy: 0, focus: 0 },
        sentimentDistribution: {},
        topTags: [],
        recentMoods: []
      });
    }

    // Compute Emotion Averages
    let totalGratitude = 0, totalClarity = 0, totalStress = 0, totalJoy = 0, totalFocus = 0;
    let scoredCount = 0;
    const sentimentCounts = {};
    const tagCounts = {};

    entries.forEach(e => {
      // Sentiments
      const s = e.sentiment || e.userMood || 'Reflective';
      sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;

      // Tags
      if (Array.isArray(e.tags)) {
        e.tags.forEach(t => {
          const lower = t.toLowerCase();
          tagCounts[lower] = (tagCounts[lower] || 0) + 1;
        });
      }

      // Emotions
      if (e.emotions && typeof e.emotions === 'object') {
        totalGratitude += (e.emotions.gratitude || 0);
        totalClarity += (e.emotions.clarity || 0);
        totalStress += (e.emotions.stress || 0);
        totalJoy += (e.emotions.joy || 0);
        totalFocus += (e.emotions.focus || 0);
        scoredCount++;
      }
    });

    const divisor = scoredCount || 1;
    const emotionsAverage = {
      gratitude: Math.round(totalGratitude / divisor),
      clarity: Math.round(totalClarity / divisor),
      stress: Math.round(totalStress / divisor),
      joy: Math.round(totalJoy / divisor),
      focus: Math.round(totalFocus / divisor)
    };

    // Sort Top Tags
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    // Calculate Journaling Streak
    const entryDates = new Set(entries.map(e => new Date(e.createdAt).toDateString()));
    let streak = 0;
    let checkDate = new Date();
    
    // Check if wrote today or yesterday
    if (!entryDates.has(checkDate.toDateString())) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (entryDates.has(checkDate.toDateString())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const recentMoods = entries.slice(0, 7).map(e => ({
      id: e.id,
      date: e.createdAt,
      sentiment: e.sentiment || e.userMood,
      emotions: e.emotions
    }));

    res.json({
      totalEntries: entries.length,
      streakDays: streak,
      emotionsAverage,
      sentimentDistribution: sentimentCounts,
      topTags,
      recentMoods
    });
  } catch (err) {
    console.error('[Analytics Route] Error calculating metrics:', err);
    res.status(500).json({ error: 'Failed to compute analytics', message: err.message });
  }
});

/**
 * GET /api/analytics/insights
 * AI-generated holistic personal growth review based on recent entries
 */
router.get('/insights', async (req, res) => {
  try {
    const userId = req.user.uid;
    const entries = await getUserJournalEntries(userId, 10);

    if (entries.length === 0) {
      return res.json({
        insight: "Welcome to your Personal Gemini Journal! Write your first journal entry to unlock AI-powered personal growth insights and emotional resonance mapping."
      });
    }

    const entriesSummary = entries
      .map(e => `- [${new Date(e.createdAt).toLocaleDateString()}] ${e.title}: ${e.summary || e.content.slice(0, 100)} (Mood: ${e.sentiment})`)
      .join('\n');

    const prompt = `Based on these recent journal logs from the user, provide a 3-bullet holistic growth analysis. Highlight recurring themes of progress, emotional shifts, and one inspiring piece of advice for the days ahead:\n\n${entriesSummary}`;

    const { text } = await generateContentWithFallback(prompt, {
      systemInstruction: 'You are an inspiring cognitive coach and mindfulness mentor analyzing personal reflections.'
    });

    res.json({
      insight: text,
      analyzedEntriesCount: entries.length
    });
  } catch (err) {
    console.error('[Analytics Route] Error generating insights:', err);
    res.status(500).json({ error: 'Failed to generate insights', message: err.message });
  }
});

module.exports = router;
