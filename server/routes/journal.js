/**
 * Journal REST API Routes
 * Implements Directives #2 (Input Validation), #3 (User Data Isolation), and #6 (Payload Hygiene)
 */

const express = require('express');
const router = express.Router();
const { authenticateFirebaseUser } = require('../middleware/auth');
const {
  saveJournalEntry,
  getUserJournalEntries,
  getUserJournalEntryById,
  deleteUserJournalEntry
} = require('../services/firestore');
const { generateJournalReflection } = require('../services/gemini');

// All journal routes require Firebase Authentication
router.use(authenticateFirebaseUser);

/**
 * GET /api/journal
 * List all journal entries for the authenticated user with optional search and tag filtering
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { search, tag, limit } = req.query;

    let entries = await getUserJournalEntries(userId, limit ? parseInt(limit, 10) : 100);

    // Apply optional client search filter
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      entries = entries.filter(e =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.content && e.content.toLowerCase().includes(q)) ||
        (e.summary && e.summary.toLowerCase().includes(q))
      );
    }

    // Apply optional tag filter
    if (tag && typeof tag === 'string') {
      const targetTag = tag.toLowerCase();
      entries = entries.filter(e =>
        Array.isArray(e.tags) && e.tags.some(t => t.toLowerCase() === targetTag)
      );
    }

    res.json({
      success: true,
      count: entries.length,
      entries
    });
  } catch (err) {
    console.error('[Journal Route] Error fetching entries:', err);
    res.status(500).json({ error: 'Failed to retrieve journal entries', message: err.message });
  }
});

/**
 * POST /api/journal
 * Create and analyze a new journal entry
 * Directive #6: Transaction verification ensuring user entry and AI summary are both persisted.
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    // Defensive Payload Ingestion (Directive #6)
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const mood = typeof body.mood === 'string' ? body.mood.trim() : 'Reflective';
    const audioTranscript = typeof body.audioTranscript === 'string' ? body.audioTranscript : null;

    if (!content) {
      return res.status(400).json({ error: 'Journal content is required' });
    }

    // 1. Generate AI Reflection, Key Takeaways, Mood Scores, and Tags with Gemini
    const reflection = await generateJournalReflection(content, title);

    // 2. Build structured entry payload
    const entryData = {
      title: title || `Reflection - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      content,
      userMood: mood,
      audioTranscript,
      summary: reflection.summary,
      keyTakeaways: reflection.keyTakeaways || [],
      actionItems: reflection.actionItems || [],
      coachQuestion: reflection.coachQuestion || '',
      tags: reflection.tags || ['journal'],
      sentiment: reflection.sentiment || mood,
      emotions: reflection.emotions || { gratitude: 50, clarity: 50, stress: 20, joy: 50, focus: 50 },
      modelUsed: reflection.modelUsed || 'gemini'
    };

    // 3. Persist to isolated Firestore path: /users/{userId}/entries/{entryId}
    const savedEntry = await saveJournalEntry(userId, entryData);

    res.status(201).json({
      success: true,
      entry: savedEntry
    });
  } catch (err) {
    console.error('[Journal Route] Error creating entry:', err);
    res.status(500).json({ error: 'Failed to save journal entry', message: err.message });
  }
});

/**
 * GET /api/journal/:id
 * Retrieve a specific entry with ownership check
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const entryId = req.params.id;

    const entry = await getUserJournalEntryById(userId, entryId);
    if (!entry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    res.json({ success: true, entry });
  } catch (err) {
    console.error('[Journal Route] Error retrieving entry:', err);
    res.status(500).json({ error: 'Failed to fetch journal entry', message: err.message });
  }
});

/**
 * DELETE /api/journal/:id
 * Delete a specific entry with ownership check
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const entryId = req.params.id;

    const success = await deleteUserJournalEntry(userId, entryId);
    if (!success) {
      return res.status(404).json({ error: 'Journal entry not found or already removed' });
    }

    res.json({ success: true, message: 'Entry successfully deleted' });
  } catch (err) {
    console.error('[Journal Route] Error deleting entry:', err);
    res.status(500).json({ error: 'Failed to delete entry', message: err.message });
  }
});

/**
 * POST /api/journal/export
 * Export user's journal entries into Markdown or JSON
 */
router.post('/export', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { format = 'markdown' } = req.body;
    const entries = await getUserJournalEntries(userId, 500);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="gemini-journal-${new Date().toISOString().slice(0, 10)}.json"`);
      return res.json({ user: req.user.email || userId, exportedAt: new Date().toISOString(), entries });
    }

    // Markdown Format
    let markdown = `# My Personal Gemini Journal\n*Exported on ${new Date().toLocaleDateString()} for ${req.user.name || req.user.email}*\n\n---\n\n`;

    for (const entry of entries) {
      markdown += `## ${entry.title}\n`;
      markdown += `*Date: ${new Date(entry.createdAt).toLocaleString()} | Mood: ${entry.sentiment || entry.userMood}*\n\n`;
      markdown += `### Entry\n${entry.content}\n\n`;
      if (entry.summary) {
        markdown += `### ✨ Gemini Summary\n> ${entry.summary}\n\n`;
      }
      if (entry.keyTakeaways && entry.keyTakeaways.length > 0) {
        markdown += `### 💡 Key Takeaways\n`;
        entry.keyTakeaways.forEach(k => { markdown += `- ${k}\n`; });
        markdown += '\n';
      }
      if (entry.coachQuestion) {
        markdown += `### 🧠 Socratic Reflection\n*${entry.coachQuestion}*\n\n`;
      }
      if (entry.tags && entry.tags.length > 0) {
        markdown += `*Tags: ${entry.tags.map(t => '#' + t).join(' ')}*\n\n`;
      }
      markdown += `---\n\n`;
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gemini-journal-${new Date().toISOString().slice(0, 10)}.md"`);
    res.send(markdown);
  } catch (err) {
    console.error('[Journal Route] Error exporting entries:', err);
    res.status(500).json({ error: 'Failed to export entries', message: err.message });
  }
});

module.exports = router;
