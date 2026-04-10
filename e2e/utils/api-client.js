// @ts-check
'use strict';

const { testConfig } = require('../../tests/config/test.config');

/**
 * Lightweight fetch wrapper for calling Netlify functions directly.
 * Stores an auth token so authenticated requests can be made after login.
 */
class ApiClient {
  constructor() {
    this._idToken = null;
  }

  setAuthToken(idToken) {
    this._idToken = idToken;
  }

  clearAuthToken() {
    this._idToken = null;
  }

  _headers(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (this._idToken) {
      headers['Authorization'] = `Bearer ${this._idToken}`;
    }
    return headers;
  }

  async get(path, params = {}) {
    const url = new URL(`${testConfig.functionsUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this._headers(),
    });
    return res;
  }

  async post(path, body = {}) {
    const res = await fetch(`${testConfig.functionsUrl}${path}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
    });
    return res;
  }
}

module.exports = { ApiClient };
