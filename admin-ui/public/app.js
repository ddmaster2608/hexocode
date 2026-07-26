/* Goodnut 博客管理台 —— 前端逻辑 */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const views = {
    posts: $('#view-posts'),
    editor: $('#view-editor'),
    images: $('#view-images'),
    deploy: $('#view-deploy')
  };

  const state = {
    posts: [],
    images: [],
    status: null,
    editingFile: null, // null = 新文章
    editingPost: null,
    dirty: false,
    editor: null,
    watchingTaskId: null,
    taskTimer: null
  };

  /* ═══════════ 基础工具 ═══════════ */

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      /* 非 JSON 响应 */
    }

    if (!response.ok) {
      throw new Error(payload.error || `请求失败（${response.status}）`);
    }

    return payload;
  }

  function toast(message, type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    $('#toasts').appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(value) {
    if (!value) return '未设置日期';
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 10);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function showConfirm(title, text, okLabel = '确认删除') {
    return new Promise((resolve) => {
      $('#confirm-title').textContent = title;
      $('#confirm-text').textContent = text;
      $('#confirm-ok').textContent = okLabel;
      const mask = $('#confirm-modal');
      mask.hidden = false;

      const done = (result) => {
        mask.hidden = true;
        $('#confirm-ok').onclick = null;
        $('#confirm-cancel').onclick = null;
        resolve(result);
      };

      $('#confirm-ok').onclick = () => done(true);
      $('#confirm-cancel').onclick = () => done(false);
      mask.onclick = (event) => {
        if (event.target === mask) done(false);
      };
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('已复制到剪贴板', 'success');
    } catch {
      toast('复制失败，请手动选择复制', 'error');
    }
  }

  /* ═══════════ 主题 ═══════════ */

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('admin-theme', theme);
    $('#theme-label').textContent = theme === 'dark' ? '浅色模式' : '深色模式';
    applyEditorTheme();
  }

  function applyEditorTheme() {
    const root = document.querySelector('#editor-host .toastui-editor-defaultUI');
    if (root) {
      root.classList.toggle('toastui-editor-dark', document.documentElement.dataset.theme === 'dark');
    }
  }

  $('#theme-toggle').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ═══════════ 路由 ═══════════ */

  function navigate(hash) {
    if (location.hash === hash) {
      route();
    } else {
      location.hash = hash;
    }
  }

  async function leaveEditorGuard() {
    if (!views.editor.hidden && state.dirty) {
      return showConfirm('放弃未保存的修改？', '当前文章有未保存的更改，离开后将丢失。', '放弃修改');
    }
    return true;
  }

  let routing = false;

  async function route() {
    if (routing) return;
    routing = true;

    try {
      const hash = location.hash || '#/posts';
      const [, page, param] = hash.match(/^#\/([a-z]+)(?:\/(.*))?$/) || [null, 'posts', ''];

      // 离开编辑器时清理
      if (views.editor.hidden === false && page !== 'edit' && page !== 'new') {
        destroyEditor();
      }

      for (const view of Object.values(views)) view.hidden = true;
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));

      if (page === 'edit' || page === 'new') {
        views.editor.hidden = false;
        $('[data-nav="posts"]').classList.add('active');
        await openEditor(page === 'edit' ? decodeURIComponent(param || '') : null);
      } else if (page === 'images') {
        views.images.hidden = false;
        $('[data-nav="images"]').classList.add('active');
        await refreshImages();
      } else if (page === 'deploy') {
        views.deploy.hidden = false;
        $('[data-nav="deploy"]').classList.add('active');
        await refreshStatus();
      } else {
        views.posts.hidden = false;
        $('[data-nav="posts"]').classList.add('active');
        await refreshPosts();
      }
    } finally {
      routing = false;
    }
  }

  window.addEventListener('hashchange', route);

  window.addEventListener('beforeunload', (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  /* ═══════════ 文章列表 ═══════════ */

  async function refreshPosts() {
    try {
      const { posts } = await api('/api/posts');
      state.posts = posts;
      $('#nav-post-count').textContent = posts.length || '';
      renderPosts();
    } catch (error) {
      toast(`加载文章失败：${error.message}`, 'error');
    }
  }

  function renderPosts() {
    const keyword = $('#post-search').value.trim().toLowerCase();
    const filtered = state.posts.filter((post) => {
      if (!keyword) return true;
      const haystack = [post.title, ...(post.tags || []), ...(post.categories || [])].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });

    $('#posts-sub').textContent = keyword
      ? `匹配 ${filtered.length} / ${state.posts.length} 篇`
      : `共 ${state.posts.length} 篇文章`;

    const list = $('#post-list');
    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-tip">没有找到文章。点击右上角"新建文章"开始写作 ✎</div>';
      return;
    }

    list.innerHTML = filtered
      .map((post) => {
        const categories = (post.categories || []).map((c) => `<span class="chip cat">${escapeHtml(c)}</span>`).join('');
        const tags = (post.tags || []).slice(0, 4).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('');
        return `
        <div class="post-card" data-file="${escapeHtml(post.file)}">
          <div class="post-card-main">
            <h2 class="post-title">${escapeHtml(post.title)}</h2>
            <div class="post-meta"><span>${formatDate(post.date)}</span>${categories}${tags}</div>
          </div>
          <div class="post-actions">
            <button class="icon-btn" data-op="edit" title="编辑">✎</button>
            <button class="icon-btn del" data-op="delete" title="删除">✕</button>
          </div>
        </div>`;
      })
      .join('');
  }

  $('#post-search').addEventListener('input', renderPosts);
  $('#btn-new-post').addEventListener('click', () => navigate('#/new'));

  $('#post-list').addEventListener('click', async (event) => {
    const card = event.target.closest('.post-card');
    if (!card) return;
    const file = card.dataset.file;
    const op = event.target.closest('[data-op]')?.dataset.op;

    if (op === 'delete') {
      const confirmed = await showConfirm('删除文章', `确定要删除「${file}」吗？该操作会直接删除本地文件。`);
      if (!confirmed) return;
      try {
        await api(`/api/post?file=${encodeURIComponent(file)}`, { method: 'DELETE' });
        toast('文章已删除', 'success');
        await refreshPosts();
      } catch (error) {
        toast(`删除失败：${error.message}`, 'error');
      }
      return;
    }

    navigate(`#/edit/${encodeURIComponent(file)}`);
  });

  /* ═══════════ 编辑器 ═══════════ */

  function markDirty() {
    if (!state.dirty) {
      state.dirty = true;
      $('#editor-dirty').hidden = false;
    }
  }

  function clearDirty() {
    state.dirty = false;
    $('#editor-dirty').hidden = true;
  }

  function destroyEditor() {
    if (state.editor) {
      try {
        state.editor.destroy();
      } catch {
        /* 忽略销毁异常 */
      }
      state.editor = null;
    }
    state.editingFile = null;
    state.editingPost = null;
    clearDirty();
  }

  function getEditorMarkdown() {
    if (state.editor) return state.editor.getMarkdown();
    return $('#editor-fallback').value;
  }

  function createEditor(initialValue) {
    const host = $('#editor-host');
    host.innerHTML = '';

    if (typeof window.toastui === 'undefined' || !window.toastui.Editor) {
      // 依赖缺失时退化为纯文本编辑
      const fallback = $('#editor-fallback');
      fallback.hidden = false;
      fallback.value = initialValue;
      fallback.oninput = markDirty;
      toast('未找到 Toast UI Editor 资源，已切换为纯 Markdown 模式', 'error');
      return;
    }

    $('#editor-fallback').hidden = true;

    state.editor = new window.toastui.Editor({
      el: host,
      height: 'calc(100vh - 320px)',
      minHeight: '420px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      usageStatistics: false,
      language: 'zh-CN',
      initialValue,
      placeholder: '开始写作…（工具栏最右侧可切换 Markdown / 所见即所得）',
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          try {
            const uploaded = await uploadImageBlob(blob, blob.name || 'pasted-image.png');
            callback(uploaded.url, blob.name || 'image');
            toast('图片已上传到图床', 'success');
          } catch (error) {
            toast(`图片上传失败：${error.message}`, 'error');
          }
        }
      },
      events: {
        change: markDirty
      }
    });

    applyEditorTheme();
  }

  async function openEditor(file) {
    destroyEditor();

    const fields = {
      title: $('#f-title'),
      tags: $('#f-tags'),
      categories: $('#f-categories'),
      slug: $('#f-slug'),
      abbrlink: $('#f-abbrlink'),
      date: $('#f-date'),
      cover: $('#f-cover')
    };

    let content = '';

    if (file) {
      try {
        const { post } = await api(`/api/post?file=${encodeURIComponent(file)}`);
        state.editingFile = post.file;
        state.editingPost = post;
        fields.title.value = post.title || '';
        fields.tags.value = (post.tags || []).join(', ');
        fields.categories.value = (post.categories || []).join(', ');
        fields.slug.value = post.slug || '';
        fields.abbrlink.value = post.abbrlink || '';
        fields.date.value = post.date || '';
        fields.cover.value = post.extraMeta?.cover || '';
        content = post.content || '';
        $('#editor-file').textContent = post.file;
      } catch (error) {
        toast(`加载文章失败：${error.message}`, 'error');
        navigate('#/posts');
        return;
      }
    } else {
      state.editingFile = null;
      state.editingPost = null;
      for (const input of Object.values(fields)) input.value = '';
      $('#editor-file').textContent = '新文章';
      $('#meta-panel').open = true;
    }

    updateCoverPreview();
    updateMetaBrief();
    createEditor(content);
    clearDirty();

    for (const input of Object.values(fields)) {
      input.oninput = () => {
        markDirty();
        updateMetaBrief();
        if (input === fields.cover) updateCoverPreview();
      };
    }
  }

  function updateMetaBrief() {
    const parts = [];
    const tags = $('#f-tags').value.trim();
    const categories = $('#f-categories').value.trim();
    if (categories) parts.push(`分类：${categories}`);
    if (tags) parts.push(`标签：${tags}`);
    $('#meta-brief').textContent = parts.length ? `· ${parts.join(' · ')}` : '';
  }

  function updateCoverPreview() {
    const url = $('#f-cover').value.trim();
    const preview = $('#cover-preview');
    if (url) {
      preview.src = url;
      preview.hidden = false;
    } else {
      preview.hidden = true;
      preview.removeAttribute('src');
    }
  }

  function collectPostPayload() {
    const title = $('#f-title').value.trim();
    if (!title) {
      throw new Error('请填写文章标题');
    }

    const extraMeta = { ...(state.editingPost?.extraMeta || {}) };
    const cover = $('#f-cover').value.trim();
    if (cover) {
      extraMeta.cover = cover;
    } else {
      delete extraMeta.cover;
    }

    return {
      title,
      slug: $('#f-slug').value.trim() || title,
      tags: $('#f-tags').value,
      categories: $('#f-categories').value,
      abbrlink: $('#f-abbrlink').value.trim(),
      date: $('#f-date').value.trim() || undefined,
      extraMeta,
      content: getEditorMarkdown()
    };
  }

  async function savePost() {
    const payload = collectPostPayload();

    if (state.editingFile) {
      // 保留原始日期（若用户清空则由服务端重新生成）
      if (!payload.date && state.editingPost?.date) payload.date = state.editingPost.date;
      const result = await api(`/api/post?file=${encodeURIComponent(state.editingFile)}`, {
        method: 'PUT',
        body: payload
      });
      state.editingFile = result.file;
    } else {
      const result = await api('/api/posts', { method: 'POST', body: payload });
      state.editingFile = result.file;
      history.replaceState(null, '', `#/edit/${encodeURIComponent(result.file)}`);
    }

    // 重新拉取，保持 extraMeta/date 与磁盘一致
    const { post } = await api(`/api/post?file=${encodeURIComponent(state.editingFile)}`);
    state.editingPost = post;
    $('#f-date').value = post.date || '';
    $('#f-slug').value = post.slug || '';
    $('#editor-file').textContent = post.file;
    clearDirty();
  }

  $('#btn-back').addEventListener('click', async () => {
    if (await leaveEditorGuard()) {
      clearDirty();
      navigate('#/posts');
    }
  });

  $('#btn-save').addEventListener('click', async () => {
    try {
      await savePost();
      toast('已保存', 'success');
    } catch (error) {
      toast(`保存失败：${error.message}`, 'error');
    }
  });

  $('#btn-save-publish').addEventListener('click', async () => {
    try {
      await savePost();
      toast('已保存，开始发布…', 'success');
      const title = $('#f-title').value.trim();
      const { taskId } = await api('/api/actions/publish', {
        method: 'POST',
        body: { commitMessage: `发布：${title}` }
      });
      navigate('#/deploy');
      watchTask(taskId, '发布');
    } catch (error) {
      toast(`操作失败：${error.message}`, 'error');
    }
  });

  $('#btn-cover-upload').addEventListener('click', () => {
    pickFiles(async (files) => {
      if (!files.length) return;
      try {
        const uploaded = await uploadImageBlob(files[0], files[0].name);
        $('#f-cover').value = uploaded.siteUrl || uploaded.url;
        updateCoverPreview();
        markDirty();
        toast('封面已上传', 'success');
      } catch (error) {
        toast(`封面上传失败：${error.message}`, 'error');
      }
    });
  });

  /* ═══════════ 图床 ═══════════ */

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsDataURL(blob);
    });
  }

  async function uploadImageBlob(blob, name) {
    if (blob.size > 25 * 1024 * 1024) {
      throw new Error('图片超过 25MB');
    }
    const dataBase64 = await blobToBase64(blob);
    return api('/api/images', { method: 'POST', body: { name, dataBase64 } });
  }

  function pickFiles(handler) {
    const input = $('#file-input');
    input.onchange = () => {
      handler(Array.from(input.files || []));
      input.value = '';
    };
    input.click();
  }

  async function uploadFiles(files) {
    const imageFiles = files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i.test(f.name));
    if (!imageFiles.length) {
      toast('没有可上传的图片文件', 'error');
      return;
    }
    for (const file of imageFiles) {
      try {
        await uploadImageBlob(file, file.name);
        toast(`已上传 ${file.name}`, 'success');
      } catch (error) {
        toast(`${file.name} 上传失败：${error.message}`, 'error');
      }
    }
    await refreshImages();
  }

  async function refreshImages() {
    try {
      const { images } = await api('/api/images');
      state.images = images;
      renderImages();
    } catch (error) {
      toast(`加载图片失败：${error.message}`, 'error');
    }
  }

  function renderImages() {
    const grid = $('#image-grid');
    if (!state.images.length) {
      grid.innerHTML = '<div class="empty-tip">图床还是空的，上传第一张图片吧 ▣</div>';
      return;
    }

    grid.innerHTML = state.images
      .map((image, index) => {
        const shortName = image.file.split('/').pop();
        return `
        <div class="image-card" data-index="${index}">
          <img class="image-thumb" src="${escapeHtml(image.url)}" loading="lazy" alt="${escapeHtml(shortName)}" title="点击复制链接">
          <div class="image-info">
            <div class="image-name" title="${escapeHtml(image.file)}">${escapeHtml(shortName)}</div>
            <div class="image-sub">
              <span>${formatSize(image.size)}</span>
              <span class="image-ops">
                <button class="icon-btn" data-op="copy" title="复制链接">⧉</button>
                ${image.deletable ? '<button class="icon-btn del" data-op="delete" title="删除">✕</button>' : ''}
              </span>
            </div>
          </div>
        </div>`;
      })
      .join('');
  }

  function openCopyModal(image) {
    const rows = [
      { label: '站点链接（发布后可访问，可用于外链/封面）', value: image.siteUrl || '（未配置 SITE_URL）' },
      { label: '相对路径（推荐在文章内使用）', value: image.url },
      { label: 'Markdown 插入代码', value: `![${image.file.split('/').pop()}](${image.url})` }
    ];

    $('#copy-rows').innerHTML = rows
      .map(
        (row, index) => `
      <div class="copy-row">
        <label>${escapeHtml(row.label)}</label>
        <div class="copy-row-line">
          <input readonly value="${escapeHtml(row.value)}" data-copy-index="${index}">
          <button class="btn small" data-copy-value="${escapeHtml(row.value)}" type="button">复制</button>
        </div>
      </div>`
      )
      .join('');

    const mask = $('#copy-modal');
    mask.hidden = false;

    $('#copy-rows').querySelectorAll('[data-copy-value]').forEach((button) => {
      button.onclick = () => copyText(button.dataset.copyValue);
    });
  }

  $('#copy-modal-close').addEventListener('click', () => {
    $('#copy-modal').hidden = true;
  });
  $('#copy-modal').addEventListener('click', (event) => {
    if (event.target === $('#copy-modal')) $('#copy-modal').hidden = true;
  });

  $('#btn-upload-image').addEventListener('click', () => pickFiles(uploadFiles));
  $('#dropzone').addEventListener('click', () => pickFiles(uploadFiles));

  const dropzone = $('#dropzone');
  ['dragenter', 'dragover'].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('over');
    })
  );
  ['dragleave', 'drop'].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove('over');
    })
  );
  dropzone.addEventListener('drop', (event) => {
    uploadFiles(Array.from(event.dataTransfer?.files || []));
  });

  document.addEventListener('paste', (event) => {
    if (views.images.hidden) return;
    const files = Array.from(event.clipboardData?.files || []);
    if (files.length) uploadFiles(files);
  });

  $('#image-grid').addEventListener('click', async (event) => {
    const card = event.target.closest('.image-card');
    if (!card) return;
    const image = state.images[Number(card.dataset.index)];
    if (!image) return;

    const op = event.target.closest('[data-op]')?.dataset.op;

    if (op === 'delete') {
      const confirmed = await showConfirm('删除图片', `确定删除「${image.file}」吗？若文章中引用了它，链接会失效。`);
      if (!confirmed) return;
      try {
        await api(`/api/image?file=${encodeURIComponent(image.file)}`, { method: 'DELETE' });
        toast('图片已删除', 'success');
        await refreshImages();
      } catch (error) {
        toast(`删除失败：${error.message}`, 'error');
      }
      return;
    }

    openCopyModal(image);
  });

  /* ═══════════ 发布中心 ═══════════ */

  async function refreshStatus() {
    try {
      state.status = await api('/api/status');
    } catch (error) {
      $('#repo-status').textContent = `无法获取状态：${error.message}`;
      return;
    }

    const status = state.status;
    const git = status.git || {};

    const dirtyChip = git.dirty
      ? '<span class="chip warn">有未提交更改</span>'
      : '<span class="chip ok">工作区干净</span>';

    $('#repo-status').innerHTML = git.available
      ? `分支 <b>${escapeHtml(git.branch)}</b> ${dirtyChip}<br>` +
        `推送目标 <b>${escapeHtml(git.pushRemote)}/${escapeHtml(git.pushBranch)}</b><br>` +
        `依赖 ${status.dependenciesInstalled ? '<span class="chip ok">已安装</span>' : '<span class="chip warn">未安装</span>'}` +
        (git.summary ? `<br><span style="font-family:var(--mono);font-size:11px">${escapeHtml(git.summary.split('\n').slice(0, 6).join('\n')).replace(/\n/g, '<br>')}</span>` : '')
      : `⚠ ${escapeHtml(git.message || '不是 Git 仓库')}`;

    $('#token-warn').hidden = Boolean(status.githubTokenConfigured);

    const running = Boolean(status.previewRunning);
    $('#btn-preview-start').hidden = running;
    $('#btn-preview-stop').hidden = !running;
    const openLink = $('#btn-preview-open');
    openLink.hidden = !running;
    openLink.href = status.previewUrl || '#';

    const sideLink = $('#link-preview');
    sideLink.hidden = !running;
    sideLink.href = status.previewUrl || '#';

    if (status.siteUrl) {
      const siteLink = $('#link-site');
      siteLink.href = status.siteUrl;
      siteLink.lastChild.textContent = status.siteUrl.replace(/^https?:\/\//, '');
    }
  }

  function setTaskBadge(statusText) {
    const badge = $('#task-badge');
    if (!statusText) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    badge.className = `task-badge ${statusText}`;
    badge.textContent = statusText === 'running' ? '运行中' : statusText === 'success' ? '成功' : '失败';
    $('#nav-deploy-dot').hidden = statusText !== 'running';
  }

  function watchTask(taskId, label) {
    if (state.taskTimer) clearInterval(state.taskTimer);
    state.watchingTaskId = taskId;
    setTaskBadge('running');
    const consoleNode = $('#task-console');
    consoleNode.textContent = `[${label}] 任务 #${taskId} 已启动…\n`;

    state.taskTimer = setInterval(async () => {
      try {
        const { task } = await api(`/api/tasks/${taskId}`);
        consoleNode.textContent = task.log || '（暂无输出）';
        consoleNode.scrollTop = consoleNode.scrollHeight;

        if (task.status !== 'running') {
          clearInterval(state.taskTimer);
          state.taskTimer = null;
          setTaskBadge(task.status);
          toast(
            task.status === 'success' ? `${label}完成 ✓` : `${label}失败，请查看日志`,
            task.status === 'success' ? 'success' : 'error'
          );
          refreshStatus();
        }
      } catch {
        /* 轮询失败时下个周期重试 */
      }
    }, 1200);
  }

  $('#btn-publish').addEventListener('click', async () => {
    const message = $('#commit-message').value.trim();
    try {
      const { taskId } = await api('/api/actions/publish', {
        method: 'POST',
        body: message ? { commitMessage: message } : {}
      });
      watchTask(taskId, '发布');
    } catch (error) {
      toast(`发布失败：${error.message}`, 'error');
    }
  });

  $('#btn-build').addEventListener('click', async () => {
    try {
      const { taskId } = await api('/api/actions/build', { method: 'POST' });
      watchTask(taskId, '构建');
    } catch (error) {
      toast(`构建失败：${error.message}`, 'error');
    }
  });

  $('#btn-preview-start').addEventListener('click', async () => {
    try {
      await api('/api/actions/preview/start', { method: 'POST' });
      toast('预览服务启动中，几秒后即可访问', 'success');
      setTimeout(refreshStatus, 1500);
    } catch (error) {
      toast(`启动失败：${error.message}`, 'error');
    }
  });

  $('#btn-preview-stop').addEventListener('click', async () => {
    try {
      await api('/api/actions/preview/stop', { method: 'POST' });
      toast('预览服务已停止', 'success');
      setTimeout(refreshStatus, 800);
    } catch (error) {
      toast(`停止失败：${error.message}`, 'error');
    }
  });

  /* ═══════════ 启动 ═══════════ */

  applyTheme(localStorage.getItem('admin-theme') || 'light');
  refreshStatus();
  route();
})();
