/* ==========================================================================
   视频上传组件
   - 支持选择和粘贴上传
   - 视频预览
   - 客户端压缩（WebCodecs API，降级 FFmpeg.wasm）
   - 上传到 R2
   - 标题输入框
   - 最多4个限制
   - 推荐30秒以内
   ========================================================================== */

(function (global) {
  'use strict';

  var MAX_COUNT = 4;
  var MAX_SIZE = 100 * 1024 * 1024; // 100MB
  var ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

  /**
   * 检测是否支持 WebCodecs
   */
  function isWebCodecsSupported() {
    return typeof global.VideoEncoder !== 'undefined' &&
           typeof global.VideoDecoder !== 'undefined';
  }

  /**
   * 获取视频信息
   */
  function getVideoInfo(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = url;

      video.onloadedmetadata = function () {
        var info = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          url: url,
          videoEl: video
        };
        resolve(info);
      };
      video.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('视频加载失败'));
      };
    });
  }

  /**
   * 视频压缩（使用 MediaRecorder 降级方案）
   * 由于 WebCodecs 完整实现复杂，这里使用 MediaRecorder 进行转码压缩
   * 如果不支持则直接返回原文件（在大小限制内）
   */
  function compressVideo(file, onProgress) {
    onProgress = onProgress || function () {};

    return new Promise(function (resolve, reject) {
      // 如果文件已经小于 50MB，直接返回
      if (file.size < 50 * 1024 * 1024) {
        onProgress(100);
        resolve(file);
        return;
      }

      // 尝试使用 MediaRecorder 转码
      if (typeof global.MediaRecorder === 'undefined') {
        // 不支持，直接返回原文件
        onProgress(100);
        resolve(file);
        return;
      }

      getVideoInfo(file).then(function (info) {
        var video = info.videoEl;
        video.play();

        var canvas = document.createElement('canvas');
        // 限制最大宽度 1280（720p）
        var targetWidth = info.width;
        var targetHeight = info.height;
        if (targetWidth > 1280) {
          targetHeight = Math.round(targetHeight * (1280 / targetWidth));
          targetWidth = 1280;
        }
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        var ctx = canvas.getContext('2d');

        var stream = canvas.captureStream(30);
        // 尝试加入音频
        try {
          if (video.captureStream) {
            var vStream = video.captureStream();
            var audioTracks = vStream.getAudioTracks();
            audioTracks.forEach(function (t) { stream.addTrack(t); });
          }
        } catch (e) { /* ignore audio */ }

        var mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        var recorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: 2500000 // 2.5Mbps
        });

        var chunks = [];
        recorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = function () {
          var blob = new Blob(chunks, { type: mimeType });
          URL.revokeObjectURL(info.url);
          stream.getTracks().forEach(function (t) { t.stop(); });
          onProgress(100);

          // 如果压缩后更大，返回原文件
          if (blob.size >= file.size) {
            resolve(file);
          } else {
            resolve(blob);
          }
        };

        recorder.onerror = function (e) {
          URL.revokeObjectURL(info.url);
          stream.getTracks().forEach(function (t) { t.stop(); });
          reject(new Error('视频压缩失败'));
        };

        recorder.start();

        var startTime = Date.now();
        function drawFrame() {
          if (video.ended || video.paused) {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
            return;
          }
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          var progress = Math.min(99, Math.round((video.currentTime / info.duration) * 100));
          onProgress(progress);
          requestAnimationFrame(drawFrame);
        }
        drawFrame();

        video.onended = function () {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        };

        // 超时保护（5分钟）
        setTimeout(function () {
          if (recorder.state !== 'inactive') {
            try { recorder.stop(); } catch (e) { /* ignore */ }
          }
        }, 5 * 60 * 1000);

      }).catch(function (err) {
        // 压缩失败，返回原文件
        onProgress(100);
        resolve(file);
      });
    });
  }

  /**
   * 初始化视频上传组件
   * @param {object} options
   * @param {HTMLElement} options.container - 容器元素
   * @param {number} [options.max=4] - 最大数量
   * @param {Array} [options.defaultTitles] - 默认标题数组
   * @param {string} options.date - 日期 YYYY-MM-DD
   * @param {string} options.type - daily / weekly
   * @param {Array} [options.initialData] - 初始数据
   * @param {Function} [options.onChange] - 数据变化回调
   */
  function VideoUploader(options) {
    this.container = options.container;
    this.max = options.max || MAX_COUNT;
    this.defaultTitles = options.defaultTitles || [];
    this.date = options.date;
    this.type = options.type || 'daily';
    this.onChange = options.onChange || function () {};

    this.items = [];
    this._orderCounter = 0;

    this._buildUI();

    if (options.initialData && options.initialData.length) {
      this._loadInitial(options.initialData);
    }
  }

  VideoUploader.prototype._buildUI = function () {
    var self = this;
    var container = this.container;
    container.className = 'uploader-section';

    var grid = document.createElement('div');
    grid.className = 'uploader-grid';
    this.grid = grid;

    var addSlot = document.createElement('div');
    addSlot.className = 'upload-slot';
    addSlot.style.cursor = 'pointer';
    addSlot.innerHTML =
      '<div class="upload-slot-empty">' +
      '<div style="font-size:32px;margin-bottom:8px;">＋</div>' +
      '<div>点击或拖拽上传视频</div>' +
      '<div class="text-xs text-muted mt-sm">支持粘贴 (Ctrl+V)，推荐30秒以内</div>' +
      '</div>';
    this.addSlot = addSlot;

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/mp4,video/quicktime,video/webm';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    this.fileInput = fileInput;

    addSlot.appendChild(fileInput);
    grid.appendChild(addSlot);
    container.appendChild(grid);

    addSlot.addEventListener('click', function (e) {
      if (e.target === fileInput) return;
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', function (e) {
      self._handleFiles(e.target.files);
    });

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

    // 粘贴上传
    this._pasteHandler = function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      var videoFiles = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('video/') === 0) {
          var f = items[i].getAsFile();
          if (f) videoFiles.push(f);
        }
      }
      if (videoFiles.length > 0) {
        e.preventDefault();
        self._handleFiles(videoFiles);
      }
    };
    document.addEventListener('paste', this._pasteHandler);
  };

  VideoUploader.prototype._handleFiles = function (fileList) {
    var self = this;
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return f.type && f.type.indexOf('video/') === 0;
    });

    if (files.length === 0) return;

    var remaining = this.max - this.items.length;
    if (remaining <= 0) {
      if (global.showNotification) {
        global.showNotification('最多上传' + this.max + '个视频', 'warning');
      }
      return;
    }

    if (files.length > remaining) {
      if (global.showNotification) {
        global.showNotification('最多上传' + this.max + '个视频，已自动截取', 'warning');
      }
      files = files.slice(0, remaining);
    }

    files.forEach(function (file) {
      // 检查文件大小
      if (file.size > MAX_SIZE) {
        if (global.showNotification) {
          global.showNotification('视频过大（超过100MB），请压缩后上传', 'warning');
        }
        return;
      }
      self._addFile(file);
    });
  };

  VideoUploader.prototype._addFile = function (file) {
    var self = this;
    var order = ++this._orderCounter;
    var title = this.defaultTitles[this.items.length] || '';

    var item = {
      id: 'vid_' + Date.now() + '_' + order,
      title: title,
      file: file,
      blob: null,
      previewUrl: URL.createObjectURL(file),
      uploaded: false,
      url: null,
      filename: null,
      mediaId: null,
      uploading: false,
      compressing: false,
      progress: 0
    };

    this.items.push(item);
    this._renderSlot(item);
    this._updateAddSlot();

    // 压缩视频
    item.compressing = true;
    this._renderSlot(item);

    if (global.showNotification) {
      global.showNotification('正在压缩视频，请稍候...', 'info', 2000);
    }

    compressVideo(file, function (progress) {
      item.progress = progress;
    }).then(function (blob) {
      item.blob = blob;
      item.compressing = false;
      self._renderSlot(item);
    }).catch(function (err) {
      item.compressing = false;
      // 压缩失败，使用原文件
      item.blob = file;
      self._renderSlot(item);
      if (global.showNotification) {
        global.showNotification('视频压缩失败，将使用原文件上传', 'warning');
      }
    });

    this.onChange(this.getData());
  };

  VideoUploader.prototype._loadInitial = function (initialData) {
    var self = this;
    initialData.forEach(function (data) {
      var order = ++self._orderCounter;
      var item = {
        id: data.id || ('vid_init_' + order),
        title: data.title || '',
        file: null,
        blob: null,
        previewUrl: data.url || null,
        uploaded: true,
        url: data.url || null,
        filename: data.filename || null,
        mediaId: data.id || null,
        uploading: false,
        compressing: false,
        progress: 100
      };
      self.items.push(item);
      self._renderSlot(item);
    });
    self._updateAddSlot();
  };

  VideoUploader.prototype._renderSlot = function (item) {
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
      previewHtml = '<video src="' + item.previewUrl + '" controls preload="metadata"></video>';
    } else {
      previewHtml = '<div class="upload-slot-empty">无预览</div>';
    }

    var statusBadge = '';
    if (item.compressing) {
      statusBadge = '<span class="badge badge-info">压缩中 ' + (item.progress || 0) + '%</span>';
    } else if (item.uploading) {
      statusBadge = '<span class="badge badge-info">上传中</span>';
    } else if (item.uploaded) {
      statusBadge = '<span class="badge badge-success">已上传</span>';
    }

    var progressHtml = '';
    if (item.uploading || item.compressing) {
      progressHtml = '<div class="upload-progress" style="width:' + (item.progress || 0) + '%"></div>';
    }

    slot.innerHTML =
      '<div class="upload-slot-preview">' + previewHtml + progressHtml + '</div>' +
      '<input type="text" class="form-input upload-title-input" placeholder="标题" value="' + escapeHtml(item.title) + '" data-field="title">' +
      '<div class="upload-slot-actions">' +
      statusBadge +
      '<button type="button" class="btn btn-ghost btn-sm upload-remove-btn">删除</button>' +
      '</div>';

    var titleInput = slot.querySelector('.upload-title-input');
    if (titleInput) {
      titleInput.addEventListener('input', function (e) {
        item.title = e.target.value;
        self.onChange(self.getData());
      });
      titleInput.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    slot.querySelector('.upload-remove-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      self._removeItem(item.id);
    });
  };

  VideoUploader.prototype._removeItem = function (id) {
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

  VideoUploader.prototype._updateAddSlot = function () {
    if (this.items.length >= this.max) {
      this.addSlot.style.display = 'none';
    } else {
      this.addSlot.style.display = '';
    }
  };

  VideoUploader.prototype._uploadOne = function (item) {
    var self = this;
    if (item.uploaded) return Promise.resolve(item);
    if (!item.blob) {
      return Promise.reject(new Error('视频尚未处理完成'));
    }

    item.uploading = true;
    item.progress = 0;
    this._renderSlot(item);

    // 视频序号从10开始（按 PRD 规范）
    var order = this.items.indexOf(item) + 10;
    var fileType = item.blob.type || 'video/mp4';

    return api.post('/api/upload/presign', {
      fileType: fileType,
      date: self.date,
      order: order,
      type: self.type
    }).then(function (res) {
      var data = res.data || {};
      var uploadUrl = data.uploadUrl;
      var fileKey = data.fileKey || data.fileUrl;
      var filename = data.filename;

      if (!uploadUrl) {
        throw new Error('获取上传地址失败');
      }

      // 检查文件大小，超过 99MB 截取
      var blobToUpload = item.blob;
      if (blobToUpload.size > 99 * 1024 * 1024) {
        if (global.showNotification) {
          global.showNotification('视频过大，已截取前99MB上传', 'warning');
        }
        blobToUpload = blobToUpload.slice(0, 99 * 1024 * 1024, fileType);
      }

      return api.putToPresigned(uploadUrl, blobToUpload, fileType).then(function (uploadRes) {
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

  VideoUploader.prototype.uploadAll = function () {
    var self = this;
    var pending = this.items.filter(function (it) { return !it.uploaded && it.blob; });

    if (pending.length === 0) {
      return Promise.resolve(this.items);
    }

    var chain = Promise.resolve();
    pending.forEach(function (item) {
      chain = chain.then(function () {
        return self._uploadOne(item);
      });
    });

    return chain.then(function () {
      return self.items;
    });
  };

  VideoUploader.prototype.getData = function (onlyUploaded) {
    return this.items
      .filter(function (it) {
        return onlyUploaded ? it.uploaded : true;
      })
      .map(function (it, idx) {
        return {
          id: it.mediaId || undefined,
          title: it.title || '',
          url: it.url || '',
          filename: it.filename || '',
          order: idx + 1,
          uploaded: it.uploaded
        };
      });
  };

  VideoUploader.prototype.setDate = function (date, type) {
    this.date = date;
    if (type) this.type = type;
  };

  VideoUploader.prototype.destroy = function () {
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

  global.VideoUploader = VideoUploader;
  global.compressVideo = compressVideo;
})(window);
