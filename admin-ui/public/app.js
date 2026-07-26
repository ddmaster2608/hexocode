/* Goodnut 博客管理台 —— 前端逻辑 */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const views = {
    overview: $('#view-overview'),
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

  function iconSvg(name) {
    return `<svg class="i"><use href="#${name}"/></svg>`;
  }

  /* ═══════════ 生成式封面 ═══════════
     没有封面的文章，用标题哈希确定性地生成一张纯色渐变封面：
     精选色板取主色 → 邻近色渐变，角度由哈希决定 */

  function hashString(value) {
    let hash = 5381;
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  const COVER_HUES = [16, 34, 150, 205, 262, 336];

  function generatedCover(title) {
    const hash = hashString(title);
    const hue = COVER_HUES[hash % COVER_HUES.length];
    const hue2 = hue + 24 + ((hash >> 4) % 22);
    const angle = (hash >> 6) % 360;
    const gid = 'gc' + hash.toString(36);
    return `<svg class="gen-cover" viewBox="0 0 88 66" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="${gid}" gradientTransform="rotate(${angle} 0.5 0.5)">
        <stop offset="0" stop-color="hsl(${hue} 62% 66%)"/>
        <stop offset="1" stop-color="hsl(${hue2} 58% 46%)"/>
      </linearGradient></defs>
      <rect width="88" height="66" fill="url(#${gid})"/>
    </svg>`;
  }

  function toast(message, type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    const icon = type === 'success' ? 'i-check' : type === 'error' ? 'i-warn' : '';
    if (icon) node.innerHTML = iconSvg(icon);
    const text = document.createElement('span');
    text.textContent = message;
    node.appendChild(text);
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

  function parseDateValue(value) {
    if (!value) return 0;
    const parsed = Date.parse(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  // 弹窗内 Tab 循环，避免焦点跑到遮罩背后
  function trapTab(event, modal) {
    if (event.key !== 'Tab') return;
    const focusables = modal.querySelectorAll('button, input, a[href]');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function showConfirm(title, text, okLabel = '确认删除') {
    return new Promise((resolve) => {
      $('#confirm-title').textContent = title;
      $('#confirm-text').textContent = text;
      $('#confirm-ok').textContent = okLabel;
      const mask = $('#confirm-modal');
      const opener = document.activeElement;
      mask.hidden = false;

      const done = (result) => {
        mask.hidden = true;
        document.removeEventListener('keydown', onKeydown, true);
        $('#confirm-ok').onclick = null;
        $('#confirm-cancel').onclick = null;
        if (opener && typeof opener.focus === 'function') opener.focus();
        resolve(result);
      };

      const onKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          done(false);
        } else {
          trapTab(event, mask);
        }
      };

      document.addEventListener('keydown', onKeydown, true);
      $('#confirm-cancel').focus();

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
  let pendingRoute = false;
  let currentHash = '';
  let suppressNextRoute = false;

  async function route() {
    if (routing) {
      pendingRoute = true;
      return;
    }
    routing = true;

    try {
      const hash = location.hash || '#/overview';
      const [, page, param] = hash.match(/^#\/([a-z]+)(?:\/(.*))?$/) || [null, 'overview', ''];

      // 离开编辑器时：有未保存修改先确认（涵盖导航点击与浏览器前进/后退）
      if (views.editor.hidden === false && page !== 'edit' && page !== 'new') {
        if (state.dirty) {
          const confirmed = await leaveEditorGuard();
          if (!confirmed) {
            pendingRoute = false;
            if (location.hash !== currentHash) {
              suppressNextRoute = true;
              location.hash = currentHash;
            }
            return;
          }
          clearDirty();
        }
        destroyEditor();
      }

      for (const view of Object.values(views)) view.hidden = true;
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));

      if (page === 'edit' || page === 'new') {
        views.editor.hidden = false;
        $('[data-nav="posts"]').classList.add('active');
        await openEditor(page === 'edit' ? decodeURIComponent(param || '') : null);
      } else if (page === 'posts') {
        views.posts.hidden = false;
        $('[data-nav="posts"]').classList.add('active');
        await refreshPosts();
      } else if (page === 'images') {
        views.images.hidden = false;
        $('[data-nav="images"]').classList.add('active');
        await refreshImages();
      } else if (page === 'deploy') {
        views.deploy.hidden = false;
        $('[data-nav="deploy"]').classList.add('active');
        await refreshStatus();
      } else {
        views.overview.hidden = false;
        $('[data-nav="overview"]').classList.add('active');
        await refreshOverview();
      }

      currentHash = hash;
    } finally {
      routing = false;
      if (pendingRoute) {
        pendingRoute = false;
        route();
      }
    }
  }

  window.addEventListener('hashchange', () => {
    if (suppressNextRoute) {
      suppressNextRoute = false;
      return;
    }
    route();
  });

  window.addEventListener('beforeunload', (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  /* ═══════════ 概览 ═══════════ */

  function renderGreeting() {
    const now = new Date();
    const hour = now.getHours();
    const greeting =
      hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    $('#overview-greeting').textContent = `${greeting}，GoodNut`;
    $('#overview-date').textContent = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }

  function renderRecentPosts() {
    const list = $('#recent-posts');
    if (!state.posts.length) {
      list.innerHTML = `<div class="empty-tip">${iconSvg('i-doc')}还没有文章，点击右上角"新建文章"开始写作</div>`;
      return;
    }

    list.innerHTML = state.posts
      .slice(0, 5)
      .map((post) => {
        const sub = [(post.categories || [])[0], post.words ? `${post.words} 字` : '']
          .filter(Boolean)
          .join(' · ');
        return `
        <button class="recent-item" type="button" data-file="${escapeHtml(post.file)}">
          <span class="recent-ic">${post.cover ? `<img src="${escapeHtml(post.cover)}" loading="lazy" alt="">` : generatedCover(post.title)}</span>
          <span class="recent-main">
            <span class="recent-title">${escapeHtml(post.title)}</span>
            ${sub ? `<span class="recent-sub">${escapeHtml(sub)}</span>` : ''}
          </span>
          <span class="recent-date">${escapeHtml(formatDate(post.date))}</span>
        </button>`;
      })
      .join('');
  }

  async function refreshOverview() {
    renderGreeting();

    const [postsResult, imagesResult, statusResult] = await Promise.allSettled([
      api('/api/posts'),
      api('/api/images'),
      api('/api/status')
    ]);

    if (postsResult.status === 'fulfilled') {
      state.posts = postsResult.value.posts;
      $('#nav-post-count').textContent = state.posts.length || '';
      $('#stat-posts').textContent = state.posts.length;
      renderRecentPosts();
    } else {
      $('#recent-posts').innerHTML = `<div class="empty-tip">${iconSvg('i-warn')}加载失败：${escapeHtml(postsResult.reason?.message || '')}</div>`;
    }

    if (imagesResult.status === 'fulfilled') {
      state.images = imagesResult.value.images;
      $('#stat-images').textContent = state.images.length;
    }

    if (statusResult.status === 'fulfilled') {
      const status = statusResult.value;
      state.status = status;
      const git = status.git || {};
      $('#stat-repo').textContent = git.available ? (git.dirty ? '有未提交更改' : '工作区干净') : '非 Git 仓库';
      $('#stat-repo-label').textContent = git.available && git.branch ? `分支 ${git.branch}` : '仓库状态';
      $('#stat-preview').textContent = status.previewRunning ? '运行中' : '未启动';
      $('#overview-token-warn').hidden = Boolean(status.githubTokenConfigured);
      syncStatusUi(status);
    }
  }

  $('#ov-new-post').addEventListener('click', () => navigate('#/new'));
  $('#qa-new').addEventListener('click', () => navigate('#/new'));
  $('#qa-upload').addEventListener('click', () => navigate('#/images'));
  $('#qa-publish').addEventListener('click', () => {
    navigate('#/deploy');
    setTimeout(() => $('#btn-publish').focus(), 300);
  });

  $('#recent-posts').addEventListener('click', (event) => {
    const item = event.target.closest('.recent-item');
    if (!item) return;
    navigate(`#/edit/${encodeURIComponent(item.dataset.file)}`);
  });

  /* ═══════════ 文章列表 ═══════════ */

  async function refreshPosts() {
    try {
      const { posts } = await api('/api/posts');
      state.posts = posts;
      $('#nav-post-count').textContent = posts.length || '';
      renderPosts();
    } catch (error) {
      $('#post-list').innerHTML = `<div class="empty-tip">${iconSvg('i-warn')}加载文章失败：${escapeHtml(error.message)}</div>`;
      toast(`加载文章失败：${error.message}`, 'error');
    }
  }

  function sortPosts(posts) {
    const mode = $('#post-sort').value;
    const copy = [...posts];
    if (mode === 'title') {
      copy.sort((left, right) => String(left.title).localeCompare(String(right.title), 'zh'));
    } else if (mode === 'date') {
      copy.sort((left, right) => parseDateValue(right.date) - parseDateValue(left.date));
    }
    // 'recent' 保持服务端顺序（最近更新优先）
    return copy;
  }

  function renderPosts() {
    const keyword = $('#post-search').value.trim().toLowerCase();
    const filtered = sortPosts(state.posts).filter((post) => {
      if (!keyword) return true;
      const haystack = [post.title, ...(post.tags || []), ...(post.categories || [])].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });

    $('#posts-sub').textContent = keyword
      ? `匹配 ${filtered.length} / ${state.posts.length} 篇`
      : `共 ${state.posts.length} 篇文章`;

    const list = $('#post-list');
    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-tip">${iconSvg('i-search')}没有找到文章。换个关键词，或点击右上角"新建文章"开始写作</div>`;
      return;
    }

    list.innerHTML = filtered
      .map((post) => {
        const categories = (post.categories || []).map((c) => `<span class="chip cat">${escapeHtml(c)}</span>`).join('');
        const tags = (post.tags || []).slice(0, 3).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('');
        const cover = post.cover
          ? `<img src="${escapeHtml(post.cover)}" loading="lazy" alt="">`
          : generatedCover(post.title);
        const words = post.words ? `<span class="meta-plain">${post.words} 字</span>` : '';
        return `
        <article class="post-card" data-file="${escapeHtml(post.file)}">
          <div class="post-cover">${cover}</div>
          <div class="post-card-main">
            <h2 class="post-title">${escapeHtml(post.title)}</h2>
            ${post.excerpt ? `<p class="post-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
            <div class="post-meta">
              <span class="meta-plain">${iconSvg('i-calendar')}${escapeHtml(formatDate(post.date))}</span>
              ${words}${categories}${tags}
            </div>
          </div>
          <div class="post-actions">
            <button class="icon-btn" data-op="edit" title="编辑">${iconSvg('i-pen')}</button>
            <button class="icon-btn del" data-op="delete" title="删除">${iconSvg('i-trash')}</button>
          </div>
        </article>`;
      })
      .join('');
  }

  $('#post-search').addEventListener('input', renderPosts);
  $('#post-sort').addEventListener('change', renderPosts);
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

  let wordCountTimer = null;

  function updateWordCount() {
    const length = getEditorMarkdown().replace(/\s+/g, '').length;
    $('#editor-words').textContent = length ? `${length} 字` : '';
  }

  function scheduleWordCount() {
    clearTimeout(wordCountTimer);
    wordCountTimer = setTimeout(updateWordCount, 400);
  }

  function onEditorChange() {
    markDirty();
    scheduleWordCount();
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
      fallback.oninput = onEditorChange;
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
        change: onEditorChange
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
    updateWordCount();

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

  // 未保存时的确认由 route() 统一处理
  $('#btn-back').addEventListener('click', () => navigate('#/posts'));

  $('#btn-save').addEventListener('click', async () => {
    try {
      await savePost();
      toast('已保存', 'success');
    } catch (error) {
      toast(`保存失败：${error.message}`, 'error');
    }
  });

  // Ctrl+S / Cmd+S 保存
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      if (!views.editor.hidden) {
        event.preventDefault();
        $('#btn-save').click();
      }
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
      watchTask(taskId, '发布', 'publish');
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
      $('#image-grid').innerHTML = `<div class="empty-tip">${iconSvg('i-warn')}加载图片失败：${escapeHtml(error.message)}</div>`;
      toast(`加载图片失败：${error.message}`, 'error');
    }
  }

  function renderImages() {
    const grid = $('#image-grid');
    if (!state.images.length) {
      grid.innerHTML = `<div class="empty-tip">${iconSvg('i-image')}图床还是空的，拖拽或粘贴上传第一张图片吧</div>`;
      return;
    }

    grid.innerHTML = state.images
      .map((image, index) => {
        const shortName = image.file.split('/').pop();
        return `
        <div class="image-card" data-index="${index}">
          <div class="image-thumb-wrap" title="点击复制链接">
            <img class="image-thumb" src="${escapeHtml(image.url)}" loading="lazy" alt="${escapeHtml(shortName)}">
            <div class="image-overlay">
              <button class="overlay-btn" data-op="copy" title="复制链接">${iconSvg('i-copy')}</button>
              ${image.deletable ? `<button class="overlay-btn del" data-op="delete" title="删除">${iconSvg('i-trash')}</button>` : ''}
            </div>
          </div>
          <div class="image-info">
            <div class="image-name" title="${escapeHtml(image.file)}">${escapeHtml(shortName)}</div>
            <div class="image-sub">${formatSize(image.size)}</div>
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
          <button class="btn small" data-copy-value="${escapeHtml(row.value)}" type="button">${iconSvg('i-copy')}复制</button>
        </div>
      </div>`
      )
      .join('');

    const mask = $('#copy-modal');
    copyModalOpener = document.activeElement;
    mask.hidden = false;
    $('#copy-modal-close').focus();

    $('#copy-rows').querySelectorAll('[data-copy-value]').forEach((button) => {
      button.onclick = () => copyText(button.dataset.copyValue);
    });
  }

  let copyModalOpener = null;

  function closeCopyModal() {
    $('#copy-modal').hidden = true;
    if (copyModalOpener && typeof copyModalOpener.focus === 'function') copyModalOpener.focus();
    copyModalOpener = null;
  }

  $('#copy-modal-close').addEventListener('click', closeCopyModal);
  $('#copy-modal').addEventListener('click', (event) => {
    if (event.target === $('#copy-modal')) closeCopyModal();
  });
  document.addEventListener('keydown', (event) => {
    if ($('#copy-modal').hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCopyModal();
    } else {
      trapTab(event, $('#copy-modal'));
    }
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

  function syncStatusUi(status) {
    const running = Boolean(status.previewRunning);
    const sideLink = $('#link-preview');
    sideLink.hidden = !running;
    sideLink.href = status.previewUrl || '#';

    if (status.siteUrl) {
      const label = status.siteUrl.replace(/^https?:\/\//, '');
      const siteLink = $('#link-site');
      siteLink.href = status.siteUrl;
      siteLink.querySelector('.side-link-text').textContent = label;
      const quickSite = $('#qa-site');
      if (quickSite) quickSite.href = status.siteUrl;
    }
  }

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

    syncStatusUi(status);
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

  // 已到达的最大阶段跨轮询保留：日志超长被截断丢掉早期标记时进度条不回退
  let publishPhase = 0;

  function updatePublishSteps(log, statusText) {
    // 只认行首的服务端标记（如 "[phase] 2/4 构建站点"），避免提交信息里的同款文本干扰
    const phasePattern = /^\[phase\] (\d)\/4/gm;
    let match;
    while ((match = phasePattern.exec(log))) {
      publishPhase = Math.max(publishPhase, Number(match[1]));
    }

    let current = publishPhase;
    // 还没打出任何阶段标记就失败了，至少把第一步标红
    if (statusText === 'error') current = Math.max(current, 1);

    document.querySelectorAll('#publish-steps .pstep').forEach((step) => {
      const number = Number(step.dataset.step);
      step.classList.remove('done', 'doing', 'fail');
      if (statusText === 'success') {
        step.classList.add('done');
      } else if (number < current) {
        step.classList.add('done');
      } else if (number === current) {
        step.classList.add(statusText === 'error' ? 'fail' : 'doing');
      }
    });
  }

  function watchTask(taskId, label, kind = '') {
    if (state.taskTimer) clearInterval(state.taskTimer);
    state.watchingTaskId = taskId;
    setTaskBadge('running');

    const steps = $('#publish-steps');
    steps.hidden = kind !== 'publish';
    if (kind === 'publish') {
      publishPhase = 0;
      updatePublishSteps('', 'running');
    }

    const consoleNode = $('#task-console');
    consoleNode.textContent = `[${label}] 任务 #${taskId} 已启动…\n`;

    state.taskTimer = setInterval(async () => {
      try {
        const { task } = await api(`/api/tasks/${taskId}`);
        consoleNode.textContent = task.log || '（暂无输出）';
        consoleNode.scrollTop = consoleNode.scrollHeight;
        if (kind === 'publish') updatePublishSteps(task.log || '', task.status);

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
      watchTask(taskId, '发布', 'publish');
    } catch (error) {
      toast(`发布失败：${error.message}`, 'error');
    }
  });

  $('#btn-build').addEventListener('click', async () => {
    try {
      const { taskId } = await api('/api/actions/build', { method: 'POST' });
      watchTask(taskId, '构建', 'build');
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
