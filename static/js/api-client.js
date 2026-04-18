const API = {
  baseUrl: window.API_BASE || 'http://localhost:3000',
  project: window.API_PROJECT || 'crebortoli',
  token: window.API_TOKEN || null,

  setConfig(baseUrl, project, token) {
    this.baseUrl = baseUrl;
    this.project = project;
    this.token = token;
  },

  headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  },

  async request(endpoint, options = {}) {
    if (!this.token) {
      console.error('API_TOKEN não configurado');
      return { success: false, error: 'API_TOKEN não configurado' };
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...this.headers(), ...options.headers }
    });

    return res.json();
  },

  async list(table, options = {}) {
    const { filters = {}, columns = ['*'], order_by = 'created_at', order_dir = 'DESC', limit = 100, offset = 0 } = options;
    return this.request('/api/read', {
      method: 'POST',
      body: JSON.stringify({ project: this.project, table, filters, columns, order_by, order_dir, limit, offset })
    });
  },

  async create(table, data) {
    return this.request('/api/create', {
      method: 'POST',
      body: JSON.stringify({ project: this.project, table, data })
    });
  },

  async update(table, id, data) {
    return this.request('/api/update', {
      method: 'POST',
      body: JSON.stringify({ project: this.project, table, id, data })
    });
  },

  async delete(table, id) {
    return this.request('/api/delete', {
      method: 'POST',
      body: JSON.stringify({ project: this.project, table, id })
    });
  },

  async upload(file) {
    if (!this.token) return { success: false, error: 'API_TOKEN não configurado' };

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData
    });

    return res.json();
  },

  async tables() {
    return this.request(`/api/tables/${this.project}`, { method: 'GET' });
  }
};

window.API = API;