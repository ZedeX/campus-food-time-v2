/* ==========================================================================
   本地存储工具
   - token 管理（get/set/clear）
   - 草稿管理（get/set/clear by date）
   - 用户信息管理
   - 导出 window.Storage 工具对象
   ========================================================================== */

(function (global) {
  'use strict';

  var TOKEN_KEY = 'cft_token';
  var USER_KEY = 'cft_user';
  var ROLE_KEY = 'cft_role';
  var DRAFT_PREFIX = 'cft_draft_';

  /* ---------- Token 管理 ---------- */

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) { /* ignore */ }
  }

  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* ignore */ }
  }

  /* ---------- 用户信息管理 ---------- */

  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) { /* ignore */ }
  }

  function clearUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) { /* ignore */ }
  }

  /* ---------- 角色管理 ---------- */

  function getRole() {
    try {
      return localStorage.getItem(ROLE_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  function setRole(role) {
    try {
      localStorage.setItem(ROLE_KEY, role);
    } catch (e) { /* ignore */ }
  }

  function clearRole() {
    try {
      localStorage.removeItem(ROLE_KEY);
    } catch (e) { /* ignore */ }
  }

  /* ---------- 登录状态 ---------- */

  function isLoggedIn() {
    return !!getToken();
  }

  /**
   * 保存登录信息
   * @param {object} data - { token, user, role }
   */
  function saveAuth(data) {
    if (data.token) setToken(data.token);
    if (data.user) setUser(data.user);
    if (data.role) setRole(data.role);
  }

  /**
   * 清除所有登录信息
   */
  function clearAuth() {
    clearToken();
    clearUser();
    clearRole();
  }

  /* ---------- 草稿管理 ---------- */

  /**
   * 生成草稿 key
   * @param {string} type - daily / weekly
   * @param {string} key - 日期 YYYY-MM-DD 或 年周 YYYY-Www
   */
  function draftKey(type, key) {
    return DRAFT_PREFIX + type + '_' + key;
  }

  /**
   * 获取草稿
   * @param {string} type - daily / weekly
   * @param {string} key - 日期或年周
   * @returns {object|null}
   */
  function getDraft(type, key) {
    try {
      var raw = localStorage.getItem(draftKey(type, key));
      if (!raw) return null;
      var data = JSON.parse(raw);
      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * 保存草稿
   * @param {string} type - daily / weekly
   * @param {string} key - 日期或年周
   * @param {object} data - 草稿内容
   */
  function setDraft(type, key, data) {
    try {
      data._savedAt = Date.now();
      localStorage.setItem(draftKey(type, key), JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  /**
   * 清除草稿
   * @param {string} type - daily / weekly
   * @param {string} key - 日期或年周
   */
  function clearDraft(type, key) {
    try {
      localStorage.removeItem(draftKey(type, key));
    } catch (e) { /* ignore */ }
  }

  /**
   * 清除所有草稿
   */
  function clearAllDrafts() {
    try {
      var keys = Object.keys(localStorage);
      keys.forEach(function (k) {
        if (k.indexOf(DRAFT_PREFIX) === 0) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) { /* ignore */ }
  }

  global.Storage = {
    // token
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    // user
    getUser: getUser,
    setUser: setUser,
    clearUser: clearUser,
    // role
    getRole: getRole,
    setRole: setRole,
    clearRole: clearRole,
    // auth
    isLoggedIn: isLoggedIn,
    saveAuth: saveAuth,
    clearAuth: clearAuth,
    // draft
    getDraft: getDraft,
    setDraft: setDraft,
    clearDraft: clearDraft,
    clearAllDrafts: clearAllDrafts
  };
})(window);
