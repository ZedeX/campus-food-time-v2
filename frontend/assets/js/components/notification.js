/* ==========================================================================
   通知组件（toast 样式）
   - 非阻塞式通知
   - 支持 success/error/warning/info 类型
   - 自动消失（3秒）
   - 导出 window.showNotification(message, type)
   ========================================================================== */

(function (global) {
  'use strict';

  var DEFAULT_DURATION = 3000;
  var ICONS = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'i'
  };

  var container = null;

  /**
   * 获取或创建 toast 容器
   */
  function getContainer() {
    if (container && document.body.contains(container)) {
      return container;
    }
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  /**
   * 显示通知
   * @param {string} message - 通知内容
   * @param {string} [type='info'] - 类型：success/error/warning/info
   * @param {number} [duration=3000] - 显示时长（毫秒），0 表示不自动关闭
   * @returns {HTMLElement} toast 元素
   */
  function showNotification(message, type, duration) {
    type = type || 'info';
    duration = duration === undefined ? DEFAULT_DURATION : duration;

    var toastContainer = getContainer();

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = ICONS[type] || ICONS.info;

    var body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = message;

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.textContent = '×';

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(closeBtn);

    var removeTimer = null;

    function removeToast() {
      if (removeTimer) {
        clearTimeout(removeTimer);
        removeTimer = null;
      }
      if (!toast.parentNode) return;
      toast.classList.add('toast-out');
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }

    closeBtn.addEventListener('click', removeToast);

    toastContainer.appendChild(toast);

    if (duration > 0) {
      removeTimer = setTimeout(removeToast, duration);
    }

    return toast;
  }

  // 便捷方法
  showNotification.success = function (message, duration) {
    return showNotification(message, 'success', duration);
  };

  showNotification.error = function (message, duration) {
    return showNotification(message, 'error', duration);
  };

  showNotification.warning = function (message, duration) {
    return showNotification(message, 'warning', duration);
  };

  showNotification.info = function (message, duration) {
    return showNotification(message, 'info', duration);
  };

  global.showNotification = showNotification;
})(window);
