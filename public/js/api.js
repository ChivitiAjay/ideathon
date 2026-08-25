/**
 * Personal Gemini Journal - Authenticated API Client
 * Automatically attaches Firebase Auth ID tokens to every request
 */

const ApiClient = (function () {
  
  async function request(endpoint, options = {}) {
    const token = await AuthModule.getIdToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(endpoint, config);
      
      // Handle file downloads (Markdown/JSON export)
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.includes('attachment')) {
        const blob = await response.blob();
        return { isBlob: true, blob, filename: disposition.split('filename=')[1]?.replace(/"/g, '') || 'export.md' };
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error);
      throw error;
    }
  }

  return {
    // Journal Entries
    getEntries: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/journal${query ? '?' + query : ''}`);
    },

    getEntry: (id) => request(`/api/journal/${id}`),

    createEntry: (data) => request('/api/journal', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    deleteEntry: (id) => request(`/api/journal/${id}`, {
      method: 'DELETE'
    }),

    exportEntries: async (format = 'markdown') => {
      const res = await request('/api/journal/export', {
        method: 'POST',
        body: JSON.stringify({ format })
      });

      if (res.isBlob) {
        const url = window.URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
      return res;
    },

    // Multi-turn Gemini Chat
    sendChatMessage: (messages, contextTitle = '') => request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, contextTitle })
    }),

    getChatHistory: () => request('/api/chat/history'),

    // Mindscape Analytics
    getMoodAnalytics: () => request('/api/analytics/mood'),
    getGrowthInsights: () => request('/api/analytics/insights')
  };
})();
