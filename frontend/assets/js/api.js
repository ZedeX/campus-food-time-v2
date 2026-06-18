/* ==========================================================================
   API 调用工具
   - 封装 fetch 请求
   - 自动添加 Authorization header
   - 统一错误处理
   - 导出 window.api 对象
   ========================================================================== */

(function (global) {
  'use strict';

  // 默认超时时间（毫秒）
  var DEFAULT_TIMEOUT = 30000;

  // 错误码到提示文案的映射（参考 PRD 5.6 节）
  var ERROR_MESSAGES = {
    0: '操作成功',
    1001: '请检查输入信息是否正确',
    1002: '请填写完整信息',
    1003: '输入格式不正确，请检查后重试',
    2001: '请先登录',
    2002: '登录已过期，请重新登录',
    2003: '登录状态异常，请重新登录',
    2004: '您没有权限执行此操作',
    2005: '您的账号已被禁用，请联系管理员',
    2006: '您的账号已在其他设备登录，请重新登录',
    2007: '账号已被锁定，请稍后再试',
    3001: '用户不存在，请检查输入',
    3002: '密码错误，请重新输入',
    3003: '该手机号已被注册，请直接登录',
    3004: '学生信息不存在，请核对姓名、身份证号和班级',
    3005: '班级信息不存在，请重新选择',
    4001: '暂无食谱信息',
    4002: '该日期已有食谱，请使用更新功能',
    4003: '保存失败，请稍后重试',
    4004: '删除失败，请稍后重试',
    5001: '文件上传失败，请重试',
    5002: '文件大小超出限制，请压缩后上传',
    5003: '不支持该文件类型，请上传jpg/png/mp4格式',
    5004: '文件处理失败，请重试',
    6001: '学校信息不存在',
    6002: '学期信息不存在',
    7001: '归档创建失败，请稍后重试',
    7002: '归档文件不存在',
    9001: '系统繁忙，请稍后重试',
    9002: '网络连接失败，请检查网络后重试',
    9003: '服务暂时不可用，请稍后重试'
  };

  /**
   * 获取存储的 token
   */
  function getToken() {
    try {
      var raw = localStorage.getItem('cft_token');
      return raw || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 清除登录状态并跳转登录页
   */
  function clearAuthAndRedirect() {
    try {
      localStorage.removeItem('cft_token');
      localStorage.removeItem('cft_user');
      localStorage.removeItem('cft_role');
    } catch (e) { /* ignore */ }

    var path = global.location.pathname;
    var loginUrl = '/';
    if (path.indexOf('/teacher/') !== -1) {
      loginUrl = '/teacher/login.html';
    } else if (path.indexOf('/parent/') !== -1) {
      loginUrl = '/parent/login.html';
    } else if (path.indexOf('/admin/') !== -1) {
      loginUrl = '/admin/login.html';
    }
    global.location.href = loginUrl;
  }

  /**
   * 显示通知（如果 notification 组件已加载）
   */
  function notify(message, type) {
    if (typeof global.showNotification === 'function') {
      global.showNotification(message, type || 'error');
    } else {
      console.error('[API] ' + message);
    }
  }

  /**
   * 核心请求函数
   */
  function request(method, path, body, options) {
    options = options || {};

    var url = path;
    var timeout = options.timeout || DEFAULT_TIMEOUT;
    var skipAuth = options.skipAuth === true;
    var rawResponse = options.rawResponse === true;

    var headers = {
      'Accept': 'application/json'
    };

    if (!(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth) {
      var token = getToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
    }

    // 合并自定义 headers
    if (options.headers && typeof options.headers === 'object') {
      Object.keys(options.headers).forEach(function (k) {
        headers[k] = options.headers[k];
      });
    }

    var fetchOptions = {
      method: method,
      headers: headers,
      credentials: 'same-origin'
    };

    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        fetchOptions.body = body;
      } else {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    // 超时控制
    var controller;
    var timeoutId;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      fetchOptions.signal = controller.signal;
      timeoutId = setTimeout(function () {
        controller.abort();
      }, timeout);
    }

    return fetch(url, fetchOptions).then(function (res) {
      if (timeoutId) clearTimeout(timeoutId);

      if (rawResponse) {
        return res;
      }

      // 处理非 JSON 响应
      var contentType = res.headers.get('content-type') || '';
      if (contentType.indexOf('application/json') === -1) {
        if (!res.ok) {
          throw { code: 9001, message: '服务暂时不可用，请稍后重试', status: res.status };
        }
        return res.text();
      }

      return res.json().then(function (data) {
        // 后端返回 { code, message, data }
        if (data && typeof data.code !== 'undefined') {
          if (data.code === 0) {
            return data;
          }

          // 未授权相关错误，清除登录态
          if ([2001, 2002, 2003, 2005, 2006].indexOf(data.code) !== -1) {
            notify(data.message || ERROR_MESSAGES[data.code] || '请重新登录', 'warning');
            clearAuthAndRedirect();
            throw data;
          }

          var errMsg = data.message || ERROR_MESSAGES[data.code] || '操作失败';
          throw data;
        }

        // 兼容直接返回数据的格式
        if (!res.ok) {
          throw { code: 9001, message: '系统繁忙，请稍后重试', status: res.status };
        }

        return { code: 0, message: '成功', data: data };
      });
    }).catch(function (err) {
      if (timeoutId) clearTimeout(timeoutId);

      // AbortError（超时）
      if (err && err.name === 'AbortError') {
        var timeoutErr = { code: 9003, message: '请求超时，请稍后重试' };
        notify(timeoutErr.message, 'error');
        throw timeoutErr;
      }

      // 网络错误
      if (err instanceof TypeError) {
        var netErr = { code: 9002, message: '网络连接失败，请检查网络后重试' };
        notify(netErr.message, 'error');
        throw netErr;
      }

      // 已经是业务错误对象
      if (err && typeof err.code !== 'undefined') {
        if (err.code !== 0 && !err._notified) {
          notify(err.message || '操作失败', 'error');
        }
        throw err;
      }

      // 未知错误
      var unknownErr = { code: 9001, message: '系统繁忙，请稍后重试', raw: err };
      notify(unknownErr.message, 'error');
      throw unknownErr;
    });
  }

  var api = {
    /**
     * GET 请求
     * @param {string} path - 请求路径
     * @param {object} [options] - 选项
     * @returns {Promise<object>} 返回 { code, message, data }
     */
    get: function (path, options) {
      return request('GET', path, null, options);
    },

    /**
     * POST 请求
     */
    post: function (path, body, options) {
      return request('POST', path, body, options);
    },

    /**
     * PUT 请求
     */
    put: function (path, body, options) {
      return request('PUT', path, body, options);
    },

    /**
     * DELETE 请求
     */
    delete: function (path, options) {
      return request('DELETE', path, null, options);
    },

    /**
     * 上传文件（FormData）
     */
    upload: function (path, formData, options) {
      return request('POST', path, formData, options);
    },

    /**
     * 直接 PUT 文件到上传接口（携带 Authorization）
     * @param {string} uploadUrl - 上传 URL（含 key 参数）
     * @param {Blob} blob - 文件内容
     * @param {string} contentType - 文件 MIME 类型
     * @returns {Promise<Response>}
     */
    putToPresigned: function (uploadUrl, blob, contentType) {
      var headers = { 'Content-Type': contentType || 'application/octet-stream' };
      var token = getToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      return fetch(uploadUrl, {
        method: 'PUT',
        headers: headers,
        body: blob
      });
    },

    /**
     * 获取错误提示文案
     */
    getErrorMessage: function (code) {
      return ERROR_MESSAGES[code] || '操作失败';
    },

    /**
     * 获取 token
     */
    getToken: getToken,

    /**
     * 清除登录态并跳转
     */
    clearAuthAndRedirect: clearAuthAndRedirect
  };

  global.api = api;
})(window);
