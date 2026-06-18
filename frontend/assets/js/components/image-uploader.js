/* ==========================================================================
   图片上传组件
   - 支持点击选择和拖拽上传
   - 支持剪贴板粘贴（Ctrl+V）
   - 图片预览
   - 客户端压缩（Canvas，高度1080px，quality=0.8）
   - 上传到 R2（presign + direct upload）
   - 标题和菜名输入框
   - 最多6张限制
   ========================================================================== */

(function (global) {
  'use strict';

  var MAX_HEIGHT = 1080;
  var QUALITY = 0.8;
  var ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

  /**
   * 压缩图片
   * @param {File|Blob} file - 图片文件
   * @returns {Promise<Blob>} 压缩后的 Blob
   */
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file.type || ACCEPTED_TYPES.indexOf(file.type) === -1) {
        reject(new Error('不支持该文件类型，请上传jpg/png格式'));
        return;
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          try {
            var width = img.width;
            var height = img.height;

            // 等比缩放，高度不超过 1080
            if (height > MAX_HEIGHT) {
              width = Math.round(width * (MAX_HEIGHT / height));
              height = MAX_HEIGHT;
            }

            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(function (blob) {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('图片压缩失败'));
              }
            }, 'image/jpeg', QUALITY);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = function () {
          reject(new Error('图片加载失败'));
        };
        img.src = e.target.result;
      };
      reader.onerror = function () {
        reject(new Error('文件读取失败'));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * 初始化图片上传组件
   * @param {object} options
   * @param {HTMLElement} options.container - 容器元素
   * @param {number} [options.max=6] - 最大数量
   * @param {boolean} [options.withDishName=true] - 是否显示菜名输入框
   * @param {Array} [options.defaultTitles] - 默认标题数组
   * @param {string} options.date - 日期 YYYY-MM-DD（用于 presign）
   * @param {string} options.type - daily / weekly
   * @param {Array} [options.initialData] - 初始数据（编辑模式加载已有图片）
   * @param {Function} [options.onChange] - 数据变化回调
   */
  function ImageUploader(options) {
    this.container = options.container;
    this.max = options.max || 6;
    this.withDishName = options.withDishName !== false;
    this.defaultTitles = options.defaultTitles || [];
    this.date = options.date;
    this.type = options.type || 'daily';
    this.onChange = options.onChange || function () {};

    // items 结构：{ id, title, dishName, file, blob, previewUrl, uploaded, url, filename, mediaId, uploading, progress }
    this.items = [];
    this._orderCounter = 0;

    this._buildUI();

    if (options.initialData && options.initialData.length) {
      this._loadInitial(options.initialData);
    }
  }

  ImageUploader.prototype._buildUI = function () {
    var self = this;
    var container = this.container;
    container.className = 'uploader-section';

    // 网格容器
    var grid = document.createElement('div');
    grid.className = 'uploader-grid';
    this.grid = grid;

    // 添加按钮 slot
    var addSlot = document.createElement('div');
    addSlot.className = 'upload-slot';
    addSlot.style.cursor = 'pointer';
    addSlot.innerHTML =
      '<div class="upload-slot-empty">' +
      '<div style="font-size:32px;margin-bottom:8px;">＋</div>' +
      '<div>点击或拖拽上传图片</div>' +
      '<div class="text-xs text-muted mt-sm">支持粘贴 (Ctrl+V)</div>' +
      '</div>';
    this.addSlot = addSlot;

    // 隐藏的文件输入
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    this.fileInput = fileInput;

    addSlot.appendChild(fileInput);
    grid.appendChild(addSlot);
    container.appendChild(grid);

    // 事件绑定
    addSlot.addEventListener('click', function (e) {
      if (e.target === fileInput) return;
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', function (e) {
      self._handleFiles(e.target.files);
    });

    // 拖拽上传
    addSlot.addEventListener('dragover', function (e) {
      e.preventDefault();
      addSlot.classList.add('dragover');
    });

    addSlot.addEventListener('dragleave', function () {
      addSlot.classList.remove('dragover');
    });

    addSlot.addEventListener('drop', function (e) {
      e.preventDefault();
      addSlot.classList.remove('dragover');
      self._handleFiles(e.dataTransfer.files);
    });

    // 粘贴上传（绑定到容器，允许在备注框等位置粘贴）
    this._pasteHandler = function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      var imageFiles = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          var f = items[i].getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        self._handleFiles(imageFiles);
      }
    };
    document.addEventListener('paste', this._pasteHandler);
  };

  ImageUploader.prototype._handleFiles = function (fileList) {
    var self = this;
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return f.type && f.type.indexOf('image/') === 0;
    });

    if (files.length === 0) return;

    var remaining = this.max - this.items.length;
    if (remaining <= 0) {
      if (global.showNotification) {
        global.showNotification('最多上传' + this.max + '张图片', 'warning');
      }
      return;
    }

    if (files.length > remaining) {
      if (global.showNotification) {
        global.showNotification('最多上传' + this.max + '张图片，已自动截取', 'warning');
      }
      files = files.slice(0, remaining);
    }

    files.forEach(function (file) {
      self._addFile(file);
    });
  };

  ImageUploader.prototype._addFile = function (file) {
    var self = this;
    var order = ++this._orderCounter;
    var title = this.defaultTitles[this.items.length] || '';

    var item = {
      id: 'img_' + Date.now() + '_' + order,
      title: title,
      dishName: '',
      file: file,
      blob: null,
      previewUrl: URL.createObjectURL(file),
      uploaded: false,
      url: null,
      filename: null,
      mediaId: null,
      uploading: false,
      progress: 0
    };

    this.items.push(item);
    this._renderSlot(item);
    this._updateAddSlot();

    // 压缩图片
    if (global.showNotification) {
      global.showNotification('正在压缩图片，请稍候...', 'info', 1500);
    }

    compressImage(file).then(function (blob) {
      item.blob = blob;
      self._renderSlot(item);
    }).catch(function (err) {
      if (global.showNotification) {
        global.showNotification(err.message || '图片压缩失败', 'error');
      }
      self._removeItem(item.id);
    });

    this.onChange(this.getData());
  };

  ImageUploader.prototype._loadInitial = function (initialData) {
    var self = this;
    initialData.forEach(function (data) {
      var order = ++self._orderCounter;
      var item = {
        id: data.id || ('img_init_' + order),
        title: data.title || '',
        dishName: data.dishName || '',
        file: null,
        blob: null,
        previewUrl: data.url || data.previewUrl || null,
        uploaded: true,
        url: data.url || null,
        filename: data.filename || null,
        mediaId: data.id || null,
        uploading: false,
        progress: 100
      };
      self.items.push(item);
      self._renderSlot(item);
    });
    self._updateAddSlot();
  };

  ImageUploader.prototype._renderSlot = function (item) {
    var self = this;
    var slot = item._slot;
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'upload-slot has-file';
      slot.dataset.itemId = item.id;
      this.grid.insertBefore(slot, this.addSlot);
      item._slot = slot;
    }

    var previewHtml = '';
    if (item.previewUrl) {
      previewHtml = '<img src="' + item.previewUrl + '" alt="预览">';
    } else {
      previewHtml = '<div class="upload-slot-empty">无预览</div>';
    }

    var progressHtml = '';
    if (item.uploading) {
      progressHtml = '<div class="upload-progress" style="width:' + (item.progress || 0) + '%"></div>';
    }

    var dishNameHtml = '';
    if (this.withDishName) {
      dishNameHtml =
        '<input type="text" class="form-input upload-dish-input" placeholder="菜名（必填）" value="' + escapeHtml(item.dishName) + '" data-field="dishName">';
    }

    slot.innerHTML =
      '<div class="upload-slot-preview">' + previewHtml + progressHtml + '</div>' +
      '<input type="text" class="form-input upload-title-input" placeholder="标题" value="' + escapeHtml(item.title) + '" data-field="title">' +
      dishNameHtml +
      '<div class="upload-slot-actions">' +
      (item.uploaded && !item.uploading ? '<span class="badge badge-success">已上传</span>' : '') +
      (item.uploading ? '<span class="text-xs text-muted">上传中...</span>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm upload-remove-btn">删除</button>' +
      '</div>';

    // 绑定输入事件
    var inputs = slot.querySelectorAll('input[data-field]');
    inputs.forEach(function (input) {
      input.addEventListener('input', function (e) {
        var field = e.target.dataset.field;
        item[field] = e.target.value;
        self.onChange(self.getData());
      });
      // 阻止点击 input 时触发 slot 的粘贴等
      input.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    });

    slot.querySelector('.upload-remove-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      self._removeItem(item.id);
    });
  };

  ImageUploader.prototype._removeItem = function (id) {
    var idx = this.items.findIndex(function (it) { return it.id === id; });
    if (idx === -1) return;
    var item = this.items[idx];
    if (item.previewUrl && item.previewUrl.indexOf('blob:') === 0) {
      URL.revokeObjectURL(item.previewUrl);
    }
    if (item._slot && item._slot.parentNode) {
      item._slot.parentNode.removeChild(item._slot);
    }
    this.items.splice(idx, 1);
    this._updateAddSlot();
    this.onChange(this.getData());
  };

  ImageUploader.prototype._updateAddSlot = function () {
    if (this.items.length >= this.max) {
      this.addSlot.style.display = 'none';
    } else {
      this.addSlot.style.display = '';
    }
  };

  /**
   * 上传单张图片到 R2
   */
  ImageUploader.prototype._uploadOne = function (item) {
    var self = this;
    if (item.uploaded) return Promise.resolve(item);
    if (!item.blob) {
      return Promise.reject(new Error('图片尚未压缩完成'));
    }

    item.uploading = true;
    item.progress = 0;
    this._renderSlot(item);

    var order = this.items.indexOf(item) + 1;
    var fileType = item.blob.type || 'image/jpeg';

    var presignBody = {
      fileType: fileType,
      order: order,
      type: self.type
    };
    // Weekly recipes send yearWeek, daily recipes send date
    if (self.type === 'weekly') {
      presignBody.yearWeek = self.date;
    } else {
      presignBody.date = self.date;
    }

    return api.post('/api/upload/presign', presignBody).then(function (res) {
      var data = res.data || {};
      var uploadUrl = data.uploadUrl;
      var fileKey = data.fileKey || data.fileUrl;
      var filename = data.filename;

      if (!uploadUrl || !fileKey) {
        throw new Error('获取上传地址失败');
      }

      // 添加 fileKey 作为 query 参数
      var fullUploadUrl = uploadUrl + '?key=' + encodeURIComponent(fileKey);

      return api.putToPresigned(fullUploadUrl, item.blob, fileType).then(function (uploadRes) {
        if (!uploadRes.ok && uploadRes.status !== 200) {
          throw new Error('上传到存储失败');
        }
        item.uploaded = true;
        item.url = fileKey;
        item.filename = filename;
        item.progress = 100;
        item.uploading = false;
        self._renderSlot(item);
        return item;
      });
    }).catch(function (err) {
      item.uploading = false;
      self._renderSlot(item);
      throw err;
    });
  };

  /**
   * 上传所有未上传的图片
   * @returns {Promise<Array>} 上传完成的 items
   */
  ImageUploader.prototype.uploadAll = function () {
    var self = this;
    var pending = this.items.filter(function (it) { return !it.uploaded && it.blob; });

    if (pending.length === 0) {
      return Promise.resolve(this.items);
    }

    var chain = Promise.resolve();
    var results = [];
    pending.forEach(function (item) {
      chain = chain.then(function () {
        return self._uploadOne(item).then(function (r) {
          results.push(r);
        });
      });
    });

    return chain.then(function () {
      return self.items;
    });
  };

  /**
   * 获取当前数据（用于保存食谱）
   * @param {boolean} onlyUploaded - 是否只返回已上传的
   */
  ImageUploader.prototype.getData = function (onlyUploaded) {
    return this.items
      .filter(function (it) {
        return onlyUploaded ? it.uploaded : true;
      })
      .map(function (it, idx) {
        return {
          id: it.mediaId || undefined,
          title: it.title || '',
          dishName: it.dishName || '',
          url: it.url || '',
          filename: it.filename || '',
          order: idx + 1,
          uploaded: it.uploaded
        };
      });
  };

  /**
   * 更新日期（切换日期时调用）
   */
  ImageUploader.prototype.setDate = function (date, type) {
    this.date = date;
    if (type) this.type = type;
  };

  /**
   * 销毁组件，移除事件监听
   */
  ImageUploader.prototype.destroy = function () {
    if (this._pasteHandler) {
      document.removeEventListener('paste', this._pasteHandler);
    }
    this.items.forEach(function (it) {
      if (it.previewUrl && it.previewUrl.indexOf('blob:') === 0) {
        URL.revokeObjectURL(it.previewUrl);
      }
    });
  };

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  global.ImageUploader = ImageUploader;
  global.compressImage = compressImage;
})(window);
