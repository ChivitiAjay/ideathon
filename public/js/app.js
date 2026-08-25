/**
 * Personal Gemini Journal - Main Application Controller
 * Handles UI interactions, state management, Gemini AI insights, voice dictation, and analytics.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // App State
  // ==========================================
  let currentEntries = [];
  let selectedEntryId = null;
  let activeTagFilter = null;
  let chatMessagesHistory = [];
  let isSpeechRecognizing = false;
  let speechRecognitionInstance = null;

  // ==========================================
  // DOM Element References
  // ==========================================
  const landingHero = document.getElementById('landingHero');
  const dashboardWrapper = document.getElementById('dashboardWrapper');
  const navTabs = document.getElementById('navTabs');
  const tabButtons = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  const btnSignIn = document.getElementById('btnSignIn');
  const heroSignInBtn = document.getElementById('heroSignInBtn');
  const demoModeBtn = document.getElementById('demoModeBtn');
  const btnSignOut = document.getElementById('btnSignOut');
  const userProfile = document.getElementById('userProfile');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  // Sidebar & Entries
  const btnNewEntry = document.getElementById('btnNewEntry');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const tagFilterBar = document.getElementById('tagFilterBar');
  const entriesList = document.getElementById('entriesList');
  const entriesCount = document.getElementById('entriesCount');
  const btnExportMarkdown = document.getElementById('btnExportMarkdown');
  const btnExportJson = document.getElementById('btnExportJson');

  // Editor Elements
  const entryTitle = document.getElementById('entryTitle');
  const entryMood = document.getElementById('entryMood');
  const entryContent = document.getElementById('entryContent');
  const wordCounter = document.getElementById('wordCounter');
  const btnDiscardEntry = document.getElementById('btnDiscardEntry');
  const btnSaveAndAnalyze = document.getElementById('btnSaveAndAnalyze');
  const btnVoiceDictation = document.getElementById('btnVoiceDictation');
  const micIcon = document.getElementById('micIcon');
  const micText = document.getElementById('micText');

  // Insights Card
  const geminiInsightsCard = document.getElementById('geminiInsightsCard');
  const modelUsedBadge = document.getElementById('modelUsedBadge');
  const insightSummary = document.getElementById('insightSummary');
  const insightTakeaways = document.getElementById('insightTakeaways');
  const insightActions = document.getElementById('insightActions');
  const insightCoach = document.getElementById('insightCoach');
  const btnContinueInChat = document.getElementById('btnContinueInChat');
  const emotionMetersContainer = document.getElementById('emotionMetersContainer');
  const insightTags = document.getElementById('insightTags');

  // Chat Elements
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const btnSendMessage = document.getElementById('btnSendMessage');
  const btnClearChat = document.getElementById('btnClearChat');

  // Analytics Elements
  const metricTotalEntries = document.getElementById('metricTotalEntries');
  const metricStreak = document.getElementById('metricStreak');
  const metricTopMood = document.getElementById('metricTopMood');
  const analyticsEmotionBars = document.getElementById('analyticsEmotionBars');
  const analyticsThemes = document.getElementById('analyticsThemes');
  const holisticInsightsText = document.getElementById('holisticInsightsText');
  const btnRefreshInsights = document.getElementById('btnRefreshInsights');

  // Toast
  const toastNotification = document.getElementById('toastNotification');

  // ==========================================
  // Authentication & Session Observer
  // ==========================================
  AuthModule.onAuthChange((user) => {
    if (user) {
      // User is Authenticated
      landingHero.style.display = 'none';
      dashboardWrapper.style.display = 'flex';
      navTabs.style.display = 'flex';
      btnSignIn.style.display = 'none';
      userProfile.style.display = 'flex';

      userName.textContent = user.displayName || 'Journal User';
      userEmail.textContent = user.email || '';
      userAvatar.src = user.photoURL || 'https://lh3.googleusercontent.com/a/default-user=s96-c';

      showToast(`Welcome back, ${user.displayName || 'Friend'}!`, 'success');
      loadEntries();
      loadAnalytics();
    } else {
      // User is Logged Out
      landingHero.style.display = 'flex';
      dashboardWrapper.style.display = 'none';
      navTabs.style.display = 'none';
      btnSignIn.style.display = 'inline-flex';
      userProfile.style.display = 'none';
      currentEntries = [];
    }
  });

  // Auth Button Handlers
  btnSignIn.addEventListener('click', () => AuthModule.signInWithGoogle());
  heroSignInBtn.addEventListener('click', () => AuthModule.signInWithGoogle());
  demoModeBtn.addEventListener('click', () => AuthModule.startDemoMode('demo-scholar'));
  btnSignOut.addEventListener('click', () => AuthModule.signOut());

  // ==========================================
  // Theme Toggle (Dark / Light Mode)
  // ==========================================
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', target);
    themeIcon.textContent = target === 'light' ? 'dark_mode' : 'light_mode';
    localStorage.setItem('gemini_theme', target);
  });

  const savedTheme = localStorage.getItem('gemini_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeIcon.textContent = savedTheme === 'light' ? 'dark_mode' : 'light_mode';
  }

  // ==========================================
  // Navigation Tabs Switching
  // ==========================================
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'analytics-tab') {
        loadAnalytics();
      }
    });
  });

  // ==========================================
  // Journal Editor & AI Reflection Engine
  // ==========================================
  entryContent.addEventListener('input', () => {
    const words = entryContent.value.trim().split(/\s+/).filter(Boolean).length;
    wordCounter.textContent = `${words} word${words === 1 ? '' : 's'}`;
  });

  btnDiscardEntry.addEventListener('click', () => {
    resetEditor();
  });

  btnSaveAndAnalyze.addEventListener('click', async () => {
    const title = entryTitle.value.trim();
    const content = entryContent.value.trim();
    const mood = entryMood.value;

    if (!content) {
      showToast('Please write something in your journal entry first.', 'error');
      return;
    }

    btnSaveAndAnalyze.disabled = true;
    btnSaveAndAnalyze.innerHTML = `<span class="material-symbols-outlined spin">sync</span> Analyzing with Gemini...`;

    try {
      const res = await ApiClient.createEntry({
        title,
        content,
        mood
      });

      if (res.success && res.entry) {
        showToast('Reflection analyzed & saved securely!', 'success');
        renderInsightsCard(res.entry);
        loadEntries();
        selectedEntryId = res.entry.id;
      }
    } catch (err) {
      showToast(err.message || 'Failed to save entry.', 'error');
    } finally {
      btnSaveAndAnalyze.disabled = false;
      btnSaveAndAnalyze.innerHTML = `<span class="material-symbols-outlined">auto_awesome</span> Save & Reflect with Gemini`;
    }
  });

  function renderInsightsCard(entry) {
    geminiInsightsCard.classList.remove('hidden');
    modelUsedBadge.textContent = entry.modelUsed || 'Gemini 2.5 Flash';
    insightSummary.textContent = entry.summary || 'Summary generated.';

    // Key Takeaways
    insightTakeaways.innerHTML = '';
    if (Array.isArray(entry.keyTakeaways) && entry.keyTakeaways.length > 0) {
      entry.keyTakeaways.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        insightTakeaways.appendChild(li);
      });
    } else {
      insightTakeaways.innerHTML = '<li>Gained mindful perspective</li>';
    }

    // Action Items
    insightActions.innerHTML = '';
    if (Array.isArray(entry.actionItems) && entry.actionItems.length > 0) {
      entry.actionItems.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        insightActions.appendChild(li);
      });
    } else {
      insightActions.innerHTML = '<li>Maintain positive momentum</li>';
    }

    // Socratic Coach Question
    insightCoach.textContent = entry.coachQuestion || 'What is one lesson from today you want to remember?';

    // Emotion Meters Radar
    emotionMetersContainer.innerHTML = '';
    if (entry.emotions) {
      for (const [emotion, score] of Object.entries(entry.emotions)) {
        const card = document.createElement('div');
        card.className = 'emotion-meter-card';
        card.innerHTML = `
          <div class="meter-header">
            <span>${emotion}</span>
            <span>${score}%</span>
          </div>
          <div class="meter-bar-track">
            <div class="meter-bar-fill" style="width: ${score}%"></div>
          </div>
        `;
        emotionMetersContainer.appendChild(card);
      }
    }

    // Tags
    insightTags.innerHTML = '';
    if (Array.isArray(entry.tags)) {
      entry.tags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'chip-tag';
        chip.textContent = `#${tag}`;
        insightTags.appendChild(chip);
      });
    }

    geminiInsightsCard.scrollIntoView({ behavior: 'smooth' });
  }

  function resetEditor() {
    entryTitle.value = '';
    entryContent.value = '';
    entryMood.value = 'Reflective';
    wordCounter.textContent = '0 words';
    geminiInsightsCard.classList.add('hidden');
    selectedEntryId = null;
    document.querySelectorAll('.entry-item').forEach(el => el.classList.remove('active'));
  }

  btnNewEntry.addEventListener('click', () => {
    resetEditor();
    tabButtons[0].click();
    entryContent.focus();
  });

  // Continue in Gemini Companion Chat Button
  btnContinueInChat.addEventListener('click', () => {
    const question = insightCoach.textContent;
    const title = entryTitle.value.trim() || 'My Recent Reflection';
    tabButtons[1].click(); // Switch to Chat Tab
    chatInput.value = `I was reflecting on "${title}". Gemini asked: "${question}" - I'd like to explore this deeper.`;
    chatInput.focus();
  });

  // ==========================================
  // Voice Dictation (Web Speech API - Enhancement #4)
  // ==========================================
  btnVoiceDictation.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('Voice dictation is not supported in this browser.', 'error');
      return;
    }

    if (isSpeechRecognizing) {
      speechRecognitionInstance.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognitionInstance = new SpeechRecognition();
    speechRecognitionInstance.continuous = true;
    speechRecognitionInstance.interimResults = true;
    speechRecognitionInstance.lang = 'en-US';

    speechRecognitionInstance.onstart = () => {
      isSpeechRecognizing = true;
      btnVoiceDictation.classList.add('dictating');
      micIcon.textContent = 'graphic_eq';
      micText.textContent = 'Listening...';
      showToast('Voice recording active. Speak naturally.', 'success');
    };

    speechRecognitionInstance.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        entryContent.value += (entryContent.value ? ' ' : '') + finalTranscript;
        entryContent.dispatchEvent(new Event('input'));
      }
    };

    speechRecognitionInstance.onerror = (event) => {
      console.warn('[Speech] Error:', event.error);
      stopDictation();
    };

    speechRecognitionInstance.onend = () => {
      stopDictation();
    };

    speechRecognitionInstance.start();
  });

  function stopDictation() {
    isSpeechRecognizing = false;
    btnVoiceDictation.classList.remove('dictating');
    micIcon.textContent = 'mic';
    micText.textContent = 'Dictate';
  }

  // ==========================================
  // Entry History, Search & Tag Filters
  // ==========================================
  async function loadEntries() {
    try {
      const params = {};
      if (searchInput.value.trim()) params.search = searchInput.value.trim();
      if (activeTagFilter) params.tag = activeTagFilter;

      const res = await ApiClient.getEntries(params);
      currentEntries = res.entries || [];
      renderEntriesList(currentEntries);
      renderTagFilterBar(currentEntries);
    } catch (err) {
      console.error('Error loading entries:', err);
    }
  }

  function renderEntriesList(entries) {
    entriesCount.textContent = entries.length;

    if (entries.length === 0) {
      entriesList.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined">draw</span>
          <p>No reflections found.<br>Start writing to see them here.</p>
        </div>
      `;
      return;
    }

    entriesList.innerHTML = '';
    entries.forEach(entry => {
      const el = document.createElement('div');
      el.className = `entry-item ${selectedEntryId === entry.id ? 'active' : ''}`;
      el.dataset.id = entry.id;

      const dateStr = new Date(entry.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      el.innerHTML = `
        <div class="entry-item-title">${escapeHtml(entry.title)}</div>
        <div class="entry-item-preview">${escapeHtml(entry.summary || entry.content)}</div>
        <div class="entry-item-meta">
          <span>${dateStr}</span>
          <span class="mood-badge">${escapeHtml(entry.sentiment || entry.userMood || 'Reflective')}</span>
        </div>
      `;

      el.addEventListener('click', () => {
        selectEntry(entry);
      });

      entriesList.appendChild(el);
    });
  }

  function selectEntry(entry) {
    selectedEntryId = entry.id;
    document.querySelectorAll('.entry-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === entry.id);
    });

    entryTitle.value = entry.title || '';
    entryContent.value = entry.content || '';
    entryMood.value = entry.userMood || 'Reflective';
    entryContent.dispatchEvent(new Event('input'));

    renderInsightsCard(entry);
    tabButtons[0].click();
  }

  function renderTagFilterBar(entries) {
    const tags = new Set();
    entries.forEach(e => {
      if (Array.isArray(e.tags)) {
        e.tags.forEach(t => tags.add(t.toLowerCase()));
      }
    });

    tagFilterBar.innerHTML = '';
    if (tags.size === 0) return;

    // All Tag Pill
    const allPill = document.createElement('span');
    allPill.className = `tag-pill ${!activeTagFilter ? 'active' : ''}`;
    allPill.textContent = 'All';
    allPill.addEventListener('click', () => {
      activeTagFilter = null;
      loadEntries();
    });
    tagFilterBar.appendChild(allPill);

    tags.forEach(tag => {
      const pill = document.createElement('span');
      pill.className = `tag-pill ${activeTagFilter === tag ? 'active' : ''}`;
      pill.textContent = `#${tag}`;
      pill.addEventListener('click', () => {
        activeTagFilter = activeTagFilter === tag ? null : tag;
        loadEntries();
      });
      tagFilterBar.appendChild(pill);
    });
  }

  searchInput.addEventListener('input', () => {
    clearSearchBtn.classList.toggle('hidden', !searchInput.value);
    debounce(loadEntries, 300)();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    loadEntries();
  });

  // Export Handlers
  btnExportMarkdown.addEventListener('click', () => ApiClient.exportEntries('markdown'));
  btnExportJson.addEventListener('click', () => ApiClient.exportEntries('json'));

  // ==========================================
  // Multi-Turn Gemini Companion Chat
  // ==========================================
  btnSendMessage.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Append User Message to UI
    appendChatBubble('user', text);
    chatInput.value = '';

    chatMessagesHistory.push({ role: 'user', content: text });

    btnSendMessage.disabled = true;
    const typingIndicator = appendChatBubble('assistant', 'Thinking with Gemini...', true);

    try {
      const res = await ApiClient.sendChatMessage(chatMessagesHistory, entryTitle.value || 'Journal Session');
      typingIndicator.remove();

      if (res.success && res.reply) {
        appendChatBubble('assistant', res.reply);
        chatMessagesHistory.push({ role: 'assistant', content: res.reply });
      }
    } catch (err) {
      typingIndicator.remove();
      appendChatBubble('assistant', `⚠️ Error: ${err.message}`);
    } finally {
      btnSendMessage.disabled = false;
    }
  }

  function appendChatBubble(role, content, isTemporary = false) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    const icon = role === 'assistant' ? 'auto_awesome' : 'person';

    const renderedContent = typeof marked !== 'undefined' && !isTemporary ? marked.parse(content) : `<p>${escapeHtml(content)}</p>`;

    bubble.innerHTML = `
      <div class="bubble-avatar"><span class="material-symbols-outlined">${icon}</span></div>
      <div class="bubble-content">${renderedContent}</div>
    `;

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble;
  }

  btnClearChat.addEventListener('click', () => {
    chatMessagesHistory = [];
    chatMessages.innerHTML = `
      <div class="chat-bubble assistant">
        <div class="bubble-avatar"><span class="material-symbols-outlined">auto_awesome</span></div>
        <div class="bubble-content">
          <p>Chat reset. What would you like to reflect on or brainstorm next?</p>
        </div>
      </div>
    `;
  });

  // ==========================================
  // Mindscape Analytics & Emotional Tracking
  // ==========================================
  async function loadAnalytics() {
    try {
      const data = await ApiClient.getMoodAnalytics();
      metricTotalEntries.textContent = data.totalEntries || 0;
      metricStreak.textContent = `${data.streakDays || 0} Day${data.streakDays === 1 ? '' : 's'}`;
      
      const dominantSentiment = Object.entries(data.sentimentDistribution || {})
        .sort((a, b) => b[1] - a[1])[0];
      metricTopMood.textContent = dominantSentiment ? dominantSentiment[0] : 'Reflective';

      // Emotion Bars
      analyticsEmotionBars.innerHTML = '';
      if (data.emotionsAverage && data.totalEntries > 0) {
        for (const [emo, val] of Object.entries(data.emotionsAverage)) {
          const row = document.createElement('div');
          row.className = 'emotion-meter-card';
          row.style.marginBottom = '0.75rem';
          row.innerHTML = `
            <div class="meter-header">
              <span>${emo}</span>
              <span>${val}%</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill" style="width: ${val}%"></div>
            </div>
          `;
          analyticsEmotionBars.appendChild(row);
        }
      } else {
        analyticsEmotionBars.innerHTML = '<div class="empty-state-sm">Record reflections to visualize emotion metrics</div>';
      }

      // Themes
      analyticsThemes.innerHTML = '';
      if (Array.isArray(data.topTags) && data.topTags.length > 0) {
        data.topTags.forEach(t => {
          const chip = document.createElement('span');
          chip.className = 'chip-tag';
          chip.textContent = `#${t.tag} (${t.count})`;
          analyticsThemes.appendChild(chip);
        });
      } else {
        analyticsThemes.innerHTML = '<div class="empty-state-sm">No themes detected yet</div>';
      }

      // Growth Insights
      loadGrowthInsights();
    } catch (err) {
      console.warn('Analytics error:', err);
    }
  }

  async function loadGrowthInsights() {
    try {
      holisticInsightsText.innerHTML = '<p>Generating AI growth insights with Gemini...</p>';
      const res = await ApiClient.getGrowthInsights();
      if (res.insight) {
        holisticInsightsText.innerHTML = typeof marked !== 'undefined' ? marked.parse(res.insight) : `<p>${escapeHtml(res.insight)}</p>`;
      }
    } catch (err) {
      holisticInsightsText.innerHTML = `<p>Growth review will appear as you add reflections.</p>`;
    }
  }

  btnRefreshInsights.addEventListener('click', () => {
    loadGrowthInsights();
  });

  // ==========================================
  // Helper Utilities
  // ==========================================
  function showToast(msg, type = 'success') {
    toastNotification.textContent = msg;
    toastNotification.className = `toast ${type}`;
    setTimeout(() => {
      toastNotification.className = 'toast hidden';
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  let debounceTimer;
  function debounce(func, delay) {
    return (...args) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
  }
});
