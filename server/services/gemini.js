/**
 * Gemini AI Processing Engine
 * Implements Directives #1, #2, #4, and #6 (Resilient Model Fallback Ladder & Error Recovery Matrix)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSecret } = require('./secrets');

// 4-Tier Resilient Model Fallback Ladder (Directive #6)
const MODEL_FALLBACK_LADDER = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro'
];

/**
 * Instantiate GoogleGenerativeAI client dynamically with API Key from Secret Manager
 */
async function getGeminiClient() {
  const apiKey = await getSecret('GEMINI_API_KEY');
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('GEMINI_API_KEY is not configured in Google Cloud Secret Manager or environment variables.');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Execute Gemini Content Generation with automated Fallback Ladder and Error Recovery
 */
async function generateContentWithFallback(prompt, options = {}) {
  const client = await getGeminiClient();
  const systemInstruction = options.systemInstruction || 'You are an insightful, empathetic personal journaling assistant and thought partner.';
  
  let lastError = null;

  for (const modelName of MODEL_FALLBACK_LADDER) {
    try {
      console.log(`[Gemini] Attempting generation with model: ${modelName}`);
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
          maxOutputTokens: options.maxOutputTokens || 2048,
          responseMimeType: options.jsonMode ? 'application/json' : 'text/plain'
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log(`[Gemini] Generation succeeded with model: ${modelName}`);
      return {
        text,
        modelUsed: modelName
      };
    } catch (err) {
      console.warn(`[Gemini] Model ${modelName} failed (${err.message}). Attempting fallback ladder...`);
      lastError = err;
      // Recoverable error status checks: 404, 429, 500, 503, etc. Continue to next model in ladder.
    }
  }

  throw new Error(`All Gemini models in the fallback ladder failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

/**
 * Multi-Turn Chat with Fallback Ladder
 */
async function chatWithGemini(messages, systemInstruction) {
  const sysInst = systemInstruction || 'You are a warm, thoughtful AI journaling companion. Help the user reflect, brainstorm, unpack emotions, and uncover deeper clarity.';

  try {
    const client = await getGeminiClient();
    let lastError = null;

    for (const modelName of MODEL_FALLBACK_LADDER) {
      try {
        console.log(`[Gemini Chat] Attempting multi-turn with: ${modelName}`);
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: { parts: [{ text: sysInst }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        });

        // Format messages into Gemini format
        const history = [];
        const userMessage = messages[messages.length - 1].content;

        for (let i = 0; i < messages.length - 1; i++) {
          const msg = messages[i];
          history.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        }

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(userMessage);
        const response = await result.response;

        return {
          reply: response.text(),
          modelUsed: modelName
        };
      } catch (err) {
        console.warn(`[Gemini Chat] Model ${modelName} failed: ${err.message}. Trying next in fallback ladder...`);
        lastError = err;
      }
    }

    throw new Error(`Chat failed across all fallback models: ${lastError ? lastError.message : 'Unknown'}`);
  } catch (err) {
    console.warn('[Gemini Chat] Falling back to offline thought companion response:', err.message);
    const userMsg = messages[messages.length - 1]?.content || 'reflection';
    return {
      reply: `I hear you reflecting on that. When building consistent habits or exploring meaningful goals, taking small daily steps and honoring how you feel in the moment can make all the difference. What is one small step you can take today?`,
      modelUsed: 'offline-companion-fallback'
    };
  }
}

/**
 * Generate Structured Journal Reflection & Analysis
 * Produces summary, key takeaways, action items, Socratic coaching question, semantic tags, and emotional resonance scores.
 */
async function generateJournalReflection(entryText, title = '') {
  const systemInstruction = `You are an expert cognitive psychologist and reflective journaling AI assistant.
Analyze the user's journal entry and return ONLY a valid JSON object matching this exact schema:
{
  "summary": "Concise 2-3 sentence summary capturing the core reflection, events, or feelings.",
  "keyTakeaways": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "actionItems": ["Optional constructive step or self-care action", "Another actionable idea"],
  "coachQuestion": "A thoughtful Socratic question to prompt deeper self-discovery and growth.",
  "tags": ["theme1", "theme2", "theme3"],
  "sentiment": "Positive" | "Reflective" | "Neutral" | "Challenging" | "Energized",
  "emotions": {
    "gratitude": number (0-100),
    "clarity": number (0-100),
    "stress": number (0-100),
    "joy": number (0-100),
    "focus": number (0-100)
  }
}`;

  const prompt = `Title: ${title || 'Untitled Entry'}\n\nJournal Content:\n${entryText}`;

  try {
    const { text, modelUsed } = await generateContentWithFallback(prompt, {
      systemInstruction,
      jsonMode: true,
      temperature: 0.4
    });

    let structuredData;
    try {
      // Clean possible markdown code fence wrapper
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      structuredData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('[Gemini] JSON parse failed on reflection output, constructing fallback structure');
      structuredData = {
        summary: text.slice(0, 300),
        keyTakeaways: ['Self-reflection and personal awareness'],
        actionItems: ['Take a moment to breathe and reflect on today'],
        coachQuestion: 'What is one lesson from today you want to carry forward?',
        tags: ['journal', 'reflection'],
        sentiment: 'Reflective',
        emotions: { gratitude: 70, clarity: 75, stress: 20, joy: 65, focus: 80 }
      };
    }

    return {
      ...structuredData,
      modelUsed
    };
  } catch (err) {
    console.error('[Gemini] Journal reflection generation error:', err.message);
    // Return graceful default if API key is not yet set or offline
    return {
      summary: entryText.length > 150 ? entryText.slice(0, 150) + '...' : entryText,
      keyTakeaways: ['Logged personal reflection'],
      actionItems: ['Continue mindful journaling'],
      coachQuestion: 'What would bring you the most peace and progress tomorrow?',
      tags: ['journal', 'mindfulness'],
      sentiment: 'Reflective',
      emotions: { gratitude: 50, clarity: 50, stress: 20, joy: 50, focus: 50 },
      modelUsed: 'offline-fallback'
    };
  }
}

module.exports = {
  MODEL_FALLBACK_LADDER,
  generateContentWithFallback,
  chatWithGemini,
  generateJournalReflection
};
