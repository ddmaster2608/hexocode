import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(__dirname, 'public');
const postsDir = path.join(repoRoot, 'source', '_posts');
const imagesDir = path.join(repoRoot, 'source', 'images');

function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // No admin.env file - environment variables win.
  }
}

loadEnvFile(path.join(__dirname, 'admin.env'));
const host = process.env.ADMIN_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.ADMIN_PORT ?? '4210', 10);
const previewPort = Number.parseInt(process.env.HEXO_PREVIEW_PORT ?? '4000', 10);
const previewHost = process.env.HEXO_PREVIEW_HOST ?? '127.0.0.1';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const previewUrl =
  process.env.PREVIEW_PUBLIC_URL ??
  `http://${previewHost === '0.0.0.0' ? '127.0.0.1' : previewHost}:${previewPort}`;
const siteUrl = process.env.SITE_URL ?? '';
const adminUsername = process.env.ADMIN_USERNAME ?? '';
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
const gitCommitName = process.env.BLOG_GIT_NAME ?? 'Hexo Admin';
const gitCommitEmail = process.env.BLOG_GIT_EMAIL ?? 'hexo-admin@localhost';
const githubToken = process.env.GITHUB_TOKEN ?? '';
const gitPushRemote = process.env.GIT_PUSH_REMOTE ?? 'origin';
const gitPushBranch = process.env.GIT_PUSH_BRANCH ?? '';
const sourcePushRepository = process.env.SOURCE_PUSH_REPOSITORY ?? '';
const pagesDeployEnabled = (process.env.PAGES_DEPLOY_ENABLED ?? 'true').toLowerCase() !== 'false';
const pagesDeployRepository =
  process.env.PAGES_DEPLOY_REPOSITORY ??
  'https://github.com/ddmaster2608/ddmaster2608.github.io.git';
const pagesDeployBranch = process.env.PAGES_DEPLOY_BRANCH ?? 'main';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const cloudflareApiToken = (process.env.CLOUDFLARE_API_TOKEN ?? '').trim();
const cloudflareAccountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
const cloudflarePagesProject = (process.env.CLOUDFLARE_PAGES_PROJECT ?? 'goodnut-blog').trim();
const cloudflarePagesEnabled = Boolean(cloudflareApiToken && cloudflareAccountId);
const knownMetaKeys = new Set(['title', 'date', 'updated', 'tags', 'categories', 'abbrlink']);

let previewProcess = null;
let previewLogs = [];
let taskSequence = 0;
const tasks = new Map();

function sanitizeLogValue(value) {
  let text = String(value ?? '')
    .replace(/https:\/\/x-access-token:[^@]+@github\.com/gi, 'https://x-access-token:***@github.com')
    .replace(/(authorization:\s*basic\s+)[^\s]+/gi, '$1***');
  if (githubToken) text = text.split(githubToken).join('***');
  if (cloudflareApiToken) text = text.split(cloudflareApiToken).join('***');
  return text;
}

function buildAuthenticatedGithubUrl(repositoryUrl) {
  if (!repositoryUrl) {
    return '';
  }

  if (!githubToken) {
    return repositoryUrl;
  }

  try {
    const parsed = new URL(repositoryUrl);
    if (parsed.protocol === 'https:' && /(^|\.)github\.com$/i.test(parsed.hostname)) {
      parsed.username = 'x-access-token';
      parsed.password = githubToken;
      return parsed.toString();
    }
  } catch {
    return repositoryUrl;
  }

  return repositoryUrl;
}

function appendPreviewLog(chunk) {
  if (!chunk) {
    return;
  }

  previewLogs.push(sanitizeLogValue(chunk));
  if (previewLogs.length > 400) {
    previewLogs = previewLogs.slice(-400);
  }
}

function appendTaskLog(task, message) {
  if (!message) {
    return;
  }

  task.log += sanitizeLogValue(message);
  if (task.log.length > 200_000) {
    task.log = task.log.slice(-200_000);
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  response.end(payload);
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request) {
  if (!adminUsername || !adminPassword) {
    return true;
  }

  const authorization = request.headers.authorization ?? '';
  if (!authorization.startsWith('Basic ')) {
    return false;
  }

  const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return false;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return timingSafeEqual(username, adminUsername) && timingSafeEqual(password, adminPassword);
}

function requireAuth(request, response) {
  if (isAuthorized(request)) {
    return true;
  }

  response.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Hexo Admin"',
    'Cache-Control': 'no-store'
  });
  response.end('Authentication required.');
  return false;
}

async function readJsonBody(request, maxBytes = 2_000_000) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw);
}

function sanitizeFileStem(input) {
  return String(input ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim();
}

function ensureMarkdownFilename(stem) {
  const fallback = sanitizeFileStem(stem) || `post-${Date.now()}`;
  return fallback.endsWith('.md') ? fallback : `${fallback}.md`;
}

function resolvePostPath(fileName) {
  const safeName = ensureMarkdownFilename(path.basename(String(fileName ?? '')));
  const targetPath = path.join(postsDir, safeName);

  if (!targetPath.startsWith(postsDir)) {
    throw new Error('Invalid file path.');
  }

  return { safeName, targetPath };
}

function removeWrappingQuotes(value) {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    const body = value.slice(1, -1);
    return value.startsWith("'") ? body.replace(/''/g, "'") : body.replace(/\\"/g, '"');
  }

  return value;
}

function parseScalar(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (trimmed === '') {
    return '';
  }

  const unquoted = removeWrappingQuotes(trimmed);
  if (unquoted === 'true') {
    return true;
  }
  if (unquoted === 'false') {
    return false;
  }

  return unquoted;
}

function parseFrontMatterBlock(block) {
  const result = {};
  const lines = block.split(/\r?\n/);

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!keyMatch) {
      index += 1;
      continue;
    }

    const key = keyMatch[1];
    const inlineValue = keyMatch[2].trim();

    if (inlineValue) {
      result[key] = parseScalar(inlineValue);
      index += 1;
      continue;
    }

    index += 1;
    const blockLines = [];

    while (index < lines.length && !/^([A-Za-z0-9_-]+):(.*)$/.test(lines[index])) {
      if (lines[index].trim()) {
        blockLines.push(lines[index].trim());
      }
      index += 1;
    }

    if (blockLines.length === 0) {
      result[key] = '';
      continue;
    }

    if (blockLines.every((item) => item.startsWith('-'))) {
      result[key] = blockLines.map((item) => {
        if (item.startsWith('- - ')) {
          return [parseScalar(item.slice(4))];
        }
        if (item.startsWith('- ')) {
          return parseScalar(item.slice(2));
        }
        return parseScalar(item);
      });
      continue;
    }

    result[key] = blockLines.join('\n');
  }

  return result;
}

function parsePostFile(rawContent) {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { meta: {}, content: rawContent };
  }

  return {
    meta: parseFrontMatterBlock(match[1]),
    content: rawContent.slice(match[0].length)
  };
}

function serializeScalar(value) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  const normalized = String(value ?? '');
  if (normalized === '') {
    return "''";
  }

  if (/^[A-Za-z0-9._/:-]+$/.test(normalized)) {
    return normalized;
  }

  return `'${normalized.replace(/'/g, "''")}'`;
}

function serializeFrontMatter(meta) {
  const lines = ['---'];
  const orderedKeys = ['title', 'date', 'updated', 'tags', 'categories', 'abbrlink'];
  const extraKeys = Object.keys(meta).filter((key) => !orderedKeys.includes(key));

  for (const key of [...orderedKeys, ...extraKeys]) {
    if (!(key in meta)) {
      continue;
    }

    const value = meta[key];
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      lines.push(`${key}:`);
      for (const item of value) {
        if (Array.isArray(item)) {
          if (item.length === 1) {
            lines.push(`- - ${serializeScalar(item[0])}`);
          } else {
            lines.push('-');
            for (const nestedItem of item) {
              lines.push(`  - ${serializeScalar(nestedItem)}`);
            }
          }
        } else {
          lines.push(`- ${serializeScalar(item)}`);
        }
      }
      continue;
    }

    lines.push(`${key}: ${serializeScalar(value)}`);
  }

  lines.push('---', '');
  return lines.join('\n');
}

function flattenArrayValues(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (Array.isArray(item)) {
      return item.map((nestedItem) => String(nestedItem).trim()).filter(Boolean);
    }

    return [String(item).trim()].filter(Boolean);
  });
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeExtraMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (knownMetaKeys.has(key)) {
      continue;
    }

    if (item === undefined || item === null || item === '') {
      continue;
    }

    if (Array.isArray(item)) {
      result[key] = item;
      continue;
    }

    if (typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number') {
      result[key] = item;
    }
  }

  return result;
}

function formatLocalIso(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${hours}:${minutes}`;
}

async function readPost(fileName) {
  const { safeName, targetPath } = resolvePostPath(fileName);
  const raw = await fsp.readFile(targetPath, 'utf8');
  const { meta, content } = parsePostFile(raw);
  const slug = safeName.replace(/\.md$/i, '');
  const extraMeta = normalizeExtraMeta(meta);

  return {
    file: safeName,
    slug,
    title: meta.title ? String(meta.title) : slug,
    date: meta.date ? String(meta.date) : '',
    updated: meta.updated ? String(meta.updated) : '',
    abbrlink: meta.abbrlink ? String(meta.abbrlink) : '',
    tags: flattenArrayValues(meta.tags),
    categories: flattenArrayValues(meta.categories),
    extraMeta,
    content
  };
}

/* ═══ 自动封面（与 scripts/generated-cover.js 同一套规则） ═══ */

function hashTitle(value) {
  let hash = 5381;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function extractContentImages(content) {
  const urls = [];
  const push = (raw) => {
    const url = String(raw || '').trim();
    if (!/^(https?:\/\/|\/)/i.test(url)) return;
    if (/^data:/i.test(url)) return;
    if (/\.svg([?#]|$)/i.test(url)) return;
    if (!urls.includes(url)) urls.push(url);
  };

  const text = String(content || '');
  let match;
  const mdImage = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
  while ((match = mdImage.exec(text))) push(match[1]);
  const htmlImage = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = htmlImage.exec(text))) push(match[1]);
  return urls;
}

async function listCoverPool() {
  try {
    const entries = await fsp.readdir(path.join(imagesDir, 'cover-pool'));
    return entries.filter((name) => /\.(jpe?g|png|webp)$/i.test(name)).sort();
  } catch {
    return [];
  }
}

function pickAutoCover(title, content, pool) {
  const hash = hashTitle(title);
  const contentImages = extractContentImages(content);
  if (contentImages.length) return contentImages[hash % contentImages.length];
  if (pool.length) return `/images/cover-pool/${pool[hash % pool.length]}`;
  return '';
}

function buildExcerpt(content, maxLength = 110) {
  const text = String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>#|~=-]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

async function listPosts() {
  const entries = await fsp.readdir(postsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name);

  const pool = await listCoverPool();

  const posts = await Promise.all(
    files.map(async (fileName) => {
      const post = await readPost(fileName);
      const stats = await fsp.stat(path.join(postsDir, fileName));
      const cover = typeof post.extraMeta?.cover === 'string' ? post.extraMeta.cover : '';

      return {
        file: post.file,
        slug: post.slug,
        title: post.title,
        date: post.date,
        updated: post.updated,
        tags: post.tags,
        categories: post.categories,
        cover,
        coverAuto: cover ? '' : pickAutoCover(post.title, post.content, pool),
        words: post.content.replace(/\s+/g, '').length,
        excerpt: buildExcerpt(post.content),
        modifiedAt: stats.mtime.toISOString()
      };
    })
  );

  return posts.sort((left, right) => {
    const leftValue = Date.parse(left.updated || left.date || left.modifiedAt);
    const rightValue = Date.parse(right.updated || right.date || right.modifiedAt);
    return rightValue - leftValue;
  });
}

function buildPostPayload(body, fallbackSlug) {
  const slug = sanitizeFileStem(body.slug || fallbackSlug || body.title);
  if (!slug) {
    throw new Error('A title or slug is required.');
  }

  const title = String(body.title ?? '').trim();
  if (!title) {
    throw new Error('Post title is required.');
  }

  const date = String(body.date || formatLocalIso()).trim();
  const updated = String(body.updated || formatLocalIso()).trim();
  const tags = normalizeStringArray(body.tags);
  const categories = normalizeStringArray(body.categories);
  const abbrlink = String(body.abbrlink ?? '').trim();
  const extraMeta = normalizeExtraMeta(body.extraMeta);
  const content = String(body.content ?? '').replace(/\r\n/g, '\n');

  const meta = {
    ...extraMeta,
    title,
    date,
    updated
  };

  if (tags.length > 0) {
    meta.tags = tags;
  }
  if (categories.length > 0) {
    meta.categories = categories.map((item) => [item]);
  }
  if (abbrlink) {
    meta.abbrlink = abbrlink;
  } else if (body.abbrlink !== undefined) {
    meta.abbrlink = '';
  }

  return {
    fileName: ensureMarkdownFilename(slug),
    serialized: `${serializeFrontMatter(meta)}${content}`
  };
}

function createTask(name, runner) {
  const task = {
    id: String(++taskSequence),
    name,
    status: 'running',
    log: '',
    createdAt: new Date().toISOString(),
    finishedAt: null
  };

  tasks.set(task.id, task);

  Promise.resolve()
    .then(() => runner(task))
    .then(() => {
      task.status = 'success';
      task.finishedAt = new Date().toISOString();
    })
    .catch((error) => {
      appendTaskLog(task, `\n[error] ${error.message}\n`);
      task.status = 'error';
      task.finishedAt = new Date().toISOString();
    });

  return task;
}

// Node 18.20+ 在 Windows 上禁止 shell:false 直接启动 .cmd/.bat（CVE-2024-27980），
// 因此对这类命令自动启用 shell。此处所有参数均为固定值，无注入风险。
function spawnProcess(command, args, options = {}) {
  const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  return spawn(command, args, { ...options, shell: needsShell });
}

function runCommand(task, label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    appendTaskLog(task, `\n> ${label}\n$ ${command} ${args.join(' ')}\n`);
    let settled = false;
    let timedOut = false;

    const child = spawnProcess(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env }
    });

    const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
    const timeout = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          appendTaskLog(task, `\n[error] ${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.\n`);
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 5000).unref?.();
        }, timeoutMs)
      : null;

    child.stdout.on('data', (chunk) => {
      appendTaskLog(task, chunk.toString());
    });

    child.stderr.on('data', (chunk) => {
      appendTaskLog(task, chunk.toString());
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (timedOut) {
        reject(new Error(`${label} timed out.`));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with exit code ${code}.`));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runCommandWithRetries(task, label, command, args, options = {}) {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 5000;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await runCommand(
        task,
        attempt === 0 ? label : `${label} (retry ${attempt}/${retries})`,
        command,
        args,
        options
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        break;
      }
      appendTaskLog(task, `\n[warn] ${label} failed: ${error.message}. Retrying in ${Math.round(retryDelayMs / 1000)} seconds.\n`);
      await delay(retryDelayMs);
    }
  }

  throw lastError;
}

function runCommandCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}.\n${stderr}`));
    });
  });
}

async function dependenciesInstalled() {
  try {
    await fsp.access(path.join(repoRoot, 'node_modules', 'hexo', 'package.json'));
    return true;
  } catch {
    return false;
  }
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function clearDirectoryContents(targetPath) {
  const entries = await fsp.readdir(targetPath, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.name !== '.git')
      .map((entry) => fsp.rm(path.join(targetPath, entry.name), { recursive: true, force: true }))
  );
}

async function isGitRepository() {
  try {
    const { stdout } = await runCommandCapture('git', ['rev-parse', '--is-inside-work-tree']);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

async function ensurePagesDeployRepository(task, deployDir, pagesTargetRepository) {
  const deployRunner = (label, command, args) =>
    runCommand(task, label, command, args, { cwd: deployDir });
  const deployCapture = (command, args) => runCommandCapture(command, args, { cwd: deployDir });
  const gitDir = path.join(deployDir, '.git');

  if (!(await pathExists(gitDir))) {
    await fsp.mkdir(deployDir, { recursive: true });

    try {
      await runCommand(task, 'Clone Pages deployment repository', 'git', [
        'clone',
        '--depth',
        '1',
        '--branch',
        pagesDeployBranch,
        pagesTargetRepository,
        deployDir
      ]);
    } catch (error) {
      appendTaskLog(
        task,
        '\n[info] Pages branch clone failed, creating a fresh deployment repository instead.\n'
      );

      await fsp.mkdir(deployDir, { recursive: true });
      await deployRunner('Initialize Pages deployment repository', 'git', ['init']);
      await deployRunner(
        'Configure Pages deployment repository remote',
        'git',
        ['remote', 'add', 'origin', pagesTargetRepository]
      ).catch(async () => {
        await deployRunner(
          'Update Pages deployment repository remote',
          'git',
          ['remote', 'set-url', 'origin', pagesTargetRepository]
        );
      });
      await deployRunner('Create Pages deployment branch', 'git', ['checkout', '--orphan', pagesDeployBranch]);
      await clearDirectoryContents(deployDir);
      return { deployRunner, deployCapture };
    }
  }

  await deployRunner(
    'Update Pages deployment repository remote',
    'git',
    ['remote', 'set-url', 'origin', pagesTargetRepository]
  );

  try {
    await deployRunner('Fetch latest Pages deployment branch', 'git', [
      'fetch',
      '--depth',
      '1',
      'origin',
      pagesDeployBranch
    ]);
    await deployRunner('Reset Pages deployment repository', 'git', [
      'reset',
      '--hard',
      'FETCH_HEAD'
    ]);
  } catch (error) {
    appendTaskLog(
      task,
      '\n[warn] Failed to refresh existing Pages deployment repository, rebuilding local deployment cache.\n'
    );
    await fsp.rm(deployDir, { recursive: true, force: true });
    return ensurePagesDeployRepository(task, deployDir, pagesTargetRepository);
  }

  await clearDirectoryContents(deployDir);
  return { deployRunner, deployCapture };
}

async function deployPublicDirectory(task) {
  if (!(await pathExists(path.join(repoRoot, 'public')))) {
    throw new Error('Build output directory public/ does not exist.');
  }

  const deployDir = path.join(repoRoot, '.deploy_git');
  const pagesTargetRepository = buildAuthenticatedGithubUrl(pagesDeployRepository);
  const deployRunner = (label, command, args, options = {}) =>
    runCommand(task, label, command, args, { cwd: deployDir, timeoutMs: 600_000, ...options });
  const deployRunnerWithRetries = (label, command, args, options = {}) =>
    runCommandWithRetries(task, label, command, args, {
      cwd: deployDir,
      timeoutMs: 600_000,
      ...options
    });
  const deployCapture = (command, args) => runCommandCapture(command, args, { cwd: deployDir });

  // 复用已有部署仓库做增量推送（只传变化的文件）；仓库缺失或刷新失败时会自动回退到重建
  await ensurePagesDeployRepository(task, deployDir, pagesTargetRepository);
  await fsp.cp(path.join(repoRoot, 'public'), deployDir, { recursive: true });

  await deployRunner(
    'Configure Pages deployment commit author',
    'git',
    ['config', 'user.name', gitCommitName]
  );
  await deployRunner(
    'Configure Pages deployment commit email',
    'git',
    ['config', 'user.email', gitCommitEmail]
  );
  await deployRunner('Stage generated site for Pages deployment', 'git', ['add', '-A']);

  const deployStatus = await deployCapture('git', ['status', '--short']);
  if (deployStatus.stdout.trim()) {
    await deployRunner('Commit generated site for Pages deployment', 'git', [
      'commit',
      '-m',
      `Deploy site ${new Date().toISOString()}`
    ]);
  } else {
    appendTaskLog(task, '\n[info] No generated site changes to commit for Pages deployment.\n');
    return;
  }

  await deployRunnerWithRetries(
    `Push generated site to GitHub Pages ${pagesDeployBranch}`,
    'git',
    ['push', '--force', 'origin', `HEAD:${pagesDeployBranch}`],
    { retries: 3, retryDelayMs: 8000, timeoutMs: 180_000 }
  );
}

/* 可选：同步部署到 Cloudflare Pages（配置 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 后启用） */
async function deployCloudflarePages(task) {
  const env = {
    CLOUDFLARE_API_TOKEN: cloudflareApiToken,
    CLOUDFLARE_ACCOUNT_ID: cloudflareAccountId,
    WRANGLER_SEND_METRICS: 'false'
  };
  const deployArgs = [
    'wrangler', 'pages', 'deploy', 'public',
    '--project-name', cloudflarePagesProject,
    '--branch', 'main',
    '--commit-dirty=true'
  ];

  try {
    await runCommand(task, 'Deploy site to Cloudflare Pages', npxCommand, deployArgs, {
      timeoutMs: 900_000,
      env
    });
  } catch (error) {
    // 项目不存在时自动创建后重试一次
    appendTaskLog(task, '\n[info] Cloudflare Pages deploy failed, trying to create the project first.\n');
    await runCommand(
      task,
      'Create Cloudflare Pages project',
      npxCommand,
      ['wrangler', 'pages', 'project', 'create', cloudflarePagesProject, '--production-branch', 'main'],
      { timeoutMs: 300_000, env }
    );
    await runCommand(task, 'Deploy site to Cloudflare Pages', npxCommand, deployArgs, {
      timeoutMs: 900_000,
      env
    });
  }
}

async function getGitStatus() {
  const available = await isGitRepository();
  if (!available) {
    return {
      available: false,
      branch: '',
      dirty: false,
      summary: '',
      remote: '',
      pushRemote: gitPushRemote,
      pushBranch: gitPushBranch,
      message: 'Current deployment directory is not a Git repository.'
    };
  }

  try {
    const [{ stdout: branchStdout }, { stdout: statusStdout }, { stdout: remoteStdout }] =
      await Promise.all([
      runCommandCapture('git', ['branch', '--show-current']),
      runCommandCapture('git', ['status', '--short']),
      runCommandCapture('git', ['remote', 'get-url', gitPushRemote])
    ]);

    return {
      available: true,
      branch: branchStdout.trim() || 'main',
      dirty: Boolean(statusStdout.trim()),
      summary: statusStdout.trim(),
      remote: remoteStdout.trim(),
      pushRemote: gitPushRemote,
      pushBranch: gitPushBranch || branchStdout.trim() || 'main',
      message: ''
    };
  } catch {
    return {
      available: true,
      branch: 'main',
      dirty: false,
      summary: '',
      remote: '',
      pushRemote: gitPushRemote,
      pushBranch: gitPushBranch || 'main',
      message: 'Git metadata is unavailable.'
    };
  }
}

async function getSourcePushTarget(gitStatus) {
  if (sourcePushRepository) {
    return buildAuthenticatedGithubUrl(sourcePushRepository);
  }

  const remoteUrl =
    gitStatus?.remote?.trim() ||
    (await runCommandCapture('git', ['remote', 'get-url', gitPushRemote])).stdout.trim();

  if (!remoteUrl) {
    throw new Error(`Git remote ${gitPushRemote} is not configured.`);
  }

  return buildAuthenticatedGithubUrl(remoteUrl);
}

async function stopPreviewProcess() {
  if (!previewProcess) {
    return;
  }

  const runningPreview = previewProcess;
  previewProcess = null;

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(runningPreview.pid), '/T', '/F'], {
        shell: false
      });
      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }

  runningPreview.kill('SIGTERM');
}

function startPreviewProcess() {
  if (previewProcess) {
    return;
  }

  appendPreviewLog(`\n[preview] starting Hexo preview on ${previewUrl}\n`);

  previewProcess = spawnProcess(
    npmCommand,
    ['run', 'server', '--', '--port', String(previewPort), '--host', previewHost],
    {
      cwd: repoRoot,
      env: { ...process.env }
    }
  );

  previewProcess.stdout.on('data', (chunk) => {
    appendPreviewLog(chunk.toString());
  });

  previewProcess.stderr.on('data', (chunk) => {
    appendPreviewLog(chunk.toString());
  });

  previewProcess.on('exit', (code) => {
    appendPreviewLog(`\n[preview] stopped with exit code ${code ?? 0}\n`);
    previewProcess = null;
  });
}

async function getStatusPayload() {
  const [installed, git] = await Promise.all([dependenciesInstalled(), getGitStatus()]);

  return {
    repoRoot,
    postsDir,
    publicDir: path.join(repoRoot, 'public'),
    previewPort,
    previewUrl,
    siteUrl,
    previewRunning: Boolean(previewProcess),
    previewLogs: previewLogs.slice(-120).join(''),
    dependenciesInstalled: installed,
    githubTokenConfigured: Boolean(githubToken),
    git
  };
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.ico':
      return 'image/x-icon';
    case '.bmp':
      return 'image/bmp';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.ttf':
      return 'font/ttf';
    case '.map':
      return 'application/json; charset=utf-8';
    default:
      return 'text/plain; charset=utf-8';
  }
}

async function serveStaticFile(request, response, pathname) {
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const resolvedPath = path.resolve(publicDir, `.${relativePath}`);

  if (!resolvedPath.startsWith(publicDir)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const contents = await fsp.readFile(resolvedPath);
    response.writeHead(200, {
      'Content-Type': getContentType(resolvedPath),
      'Cache-Control': 'no-store'
    });
    response.end(contents);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif']);

function resolveImageRelativePath(relativePath) {
  const normalized = String(relativePath ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  const targetPath = path.resolve(imagesDir, normalized);
  if (targetPath !== imagesDir && !targetPath.startsWith(imagesDir + path.sep)) {
    throw new Error('Invalid image path.');
  }
  return { relative: path.relative(imagesDir, targetPath).replace(/\\/g, '/'), targetPath };
}

function sanitizeImageFileName(input) {
  const base = path.basename(String(input ?? 'image'));
  const extension = path.extname(base).toLowerCase();
  const stem =
    base
      .slice(0, base.length - extension.length)
      .replace(/[^A-Za-z0-9一-鿿._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'image';
  const safeExtension = imageExtensions.has(extension) ? extension : '.png';
  return `${stem}${safeExtension}`;
}

function buildImageSiteUrl(relative) {
  if (!siteUrl) {
    return '';
  }
  return `${siteUrl.replace(/\/+$/, '')}/images/${relative}`;
}

async function listImages() {
  const results = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fsp.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // 封面图片池与生成封面是系统素材，不进图床管理
        if (currentDir === imagesDir && (entry.name === 'cover-pool' || entry.name === 'gen-covers')) {
          continue;
        }
        await walk(entryPath);
        continue;
      }
      if (!imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      const stats = await fsp.stat(entryPath);
      const relative = path.relative(imagesDir, entryPath).replace(/\\/g, '/');
      results.push({
        file: relative,
        url: `/images/${relative}`,
        siteUrl: buildImageSiteUrl(relative),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        deletable: relative.startsWith('uploads/')
      });
    }
  }

  await walk(imagesDir);
  return results.sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt));
}

async function serveImageFile(response, pathname) {
  try {
    const encoded = pathname.replace(/^\/images\//, '');
    const { targetPath } = resolveImageRelativePath(decodeURIComponent(encoded));
    const contents = await fsp.readFile(targetPath);
    response.writeHead(200, {
      'Content-Type': getContentType(targetPath),
      'Cache-Control': 'no-store'
    });
    response.end(contents);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/images') {
    sendJson(response, 200, { images: await listImages() });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/images') {
    const body = await readJsonBody(request, 30_000_000);
    const dataBase64 = String(body.dataBase64 ?? '').replace(/^data:[^;,]+;base64,/, '');
    if (!dataBase64) {
      sendJson(response, 400, { error: 'Missing image data.' });
      return;
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length === 0) {
      sendJson(response, 400, { error: 'Empty or invalid image data.' });
      return;
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const relativeDir = `uploads/${year}/${month}`;
    const fileName = `${Date.now()}-${sanitizeImageFileName(body.name)}`;
    const relative = `${relativeDir}/${fileName}`;

    await fsp.mkdir(path.join(imagesDir, relativeDir), { recursive: true });
    await fsp.writeFile(path.join(imagesDir, relative), buffer);

    sendJson(response, 201, {
      file: relative,
      url: `/images/${relative}`,
      siteUrl: buildImageSiteUrl(relative)
    });
    return;
  }

  if (request.method === 'DELETE' && url.pathname === '/api/image') {
    const file = url.searchParams.get('file');
    if (!file) {
      sendJson(response, 400, { error: 'Missing file parameter.' });
      return;
    }

    const { relative, targetPath } = resolveImageRelativePath(file);
    if (!relative.startsWith('uploads/')) {
      sendJson(response, 403, { error: 'Only images under uploads/ can be deleted here.' });
      return;
    }

    await fsp.unlink(targetPath);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/posts') {
    sendJson(response, 200, { posts: await listPosts() });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/post') {
    const file = url.searchParams.get('file');
    if (!file) {
      sendJson(response, 400, { error: 'Missing file parameter.' });
      return;
    }

    sendJson(response, 200, { post: await readPost(file) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/posts') {
    const body = await readJsonBody(request);
    const { fileName, serialized } = buildPostPayload(body);
    const target = path.join(postsDir, fileName);

    if (fs.existsSync(target)) {
      sendJson(response, 409, { error: 'A post with this file name already exists.' });
      return;
    }

    await fsp.writeFile(target, serialized, 'utf8');
    sendJson(response, 201, { file: fileName });
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/post') {
    const file = url.searchParams.get('file');
    if (!file) {
      sendJson(response, 400, { error: 'Missing file parameter.' });
      return;
    }

    const body = await readJsonBody(request);
    const current = resolvePostPath(file);
    const next = buildPostPayload(body, current.safeName.replace(/\.md$/i, ''));
    const nextPath = path.join(postsDir, next.fileName);

    if (next.fileName !== current.safeName && fs.existsSync(nextPath)) {
      sendJson(response, 409, { error: 'A different post already uses the target file name.' });
      return;
    }

    if (next.fileName !== current.safeName) {
      await fsp.rename(current.targetPath, nextPath);
    }

    await fsp.writeFile(nextPath, next.serialized, 'utf8');
    sendJson(response, 200, { file: next.fileName });
    return;
  }

  if (request.method === 'DELETE' && url.pathname === '/api/post') {
    const file = url.searchParams.get('file');
    if (!file) {
      sendJson(response, 400, { error: 'Missing file parameter.' });
      return;
    }

    const { targetPath } = resolvePostPath(file);
    await fsp.unlink(targetPath);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/status') {
    sendJson(response, 200, await getStatusPayload());
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/tasks/')) {
    const taskId = url.pathname.split('/').pop();
    const task = tasks.get(taskId);

    if (!task) {
      sendJson(response, 404, { error: 'Task not found.' });
      return;
    }

    sendJson(response, 200, { task });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/actions/install') {
    const task = createTask('install', async (runningTask) => {
      await runCommand(runningTask, 'Install dependencies', npmCommand, ['ci']);
    });

    sendJson(response, 202, { taskId: task.id });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/actions/build') {
    const task = createTask('build', async (runningTask) => {
      await runCommand(runningTask, 'Build Hexo site', npmCommand, ['run', 'build']);
    });

    sendJson(response, 202, { taskId: task.id });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/actions/publish') {
    const body = await readJsonBody(request);
    const commitMessage = String(body.commitMessage || `Update blog ${new Date().toISOString()}`).trim();

    const task = createTask('publish', async (runningTask) => {
      const gitStatus = await getGitStatus();
      if (!gitStatus.available) {
        throw new Error(
          'Current deployment directory is not a Git repository. Reconnect this server copy to the GitHub source repository before publishing.'
        );
      }

      appendTaskLog(runningTask, '\n[phase] 1/4 提交源码\n');
      await runCommand(runningTask, 'Stage repository changes', 'git', ['add', '-A']);

      const status = await runCommandCapture('git', ['status', '--short']);
      if (status.stdout.trim()) {
        await runCommand(runningTask, 'Commit repository changes', 'git', [
          '-c',
          `user.name=${gitCommitName}`,
          '-c',
          `user.email=${gitCommitEmail}`,
          'commit',
          '-m',
          commitMessage
        ]);
      } else {
        appendTaskLog(runningTask, '\n[info] No local changes to commit.\n');
      }

      appendTaskLog(runningTask, '\n[phase] 2/4 构建站点\n');
      await runCommand(runningTask, 'Build Hexo site', npmCommand, ['run', 'build']);

      appendTaskLog(runningTask, '\n[phase] 3/4 推送 GitHub Pages\n');
      if (pagesDeployEnabled) {
        await deployPublicDirectory(runningTask);
        appendTaskLog(runningTask, '\n[info] GitHub Pages repository update completed.\n');
      } else {
        appendTaskLog(runningTask, '\n[info] GitHub Pages deployment is disabled.\n');
      }

      if (cloudflarePagesEnabled) {
        try {
          await deployCloudflarePages(runningTask);
          appendTaskLog(
            runningTask,
            `\n[info] Cloudflare Pages 部署完成：https://${cloudflarePagesProject}.pages.dev\n`
          );
        } catch (error) {
          appendTaskLog(
            runningTask,
            `\n[warn] Cloudflare Pages 部署失败（不影响 GitHub Pages）：${error.message}\n`
          );
        }
      }

      const targetBranch = gitPushBranch || gitStatus.branch;
      if (!targetBranch) {
        throw new Error('Cannot determine which Git branch should be pushed.');
      }

      appendTaskLog(runningTask, '\n[phase] 4/4 推送源码仓库\n');
      const sourcePushTarget = await getSourcePushTarget(gitStatus);
      try {
        await runCommandWithRetries(
          runningTask,
          `Push source repository to ${gitPushRemote}/${targetBranch}`,
          'git',
          ['push', sourcePushTarget, `HEAD:${targetBranch}`],
          { retries: 3, retryDelayMs: 8000, timeoutMs: 600_000 }
        );
        appendTaskLog(runningTask, '\n[info] Source repository push completed.\n');
      } catch (error) {
        appendTaskLog(
          runningTask,
          `\n[warn] Source repository push failed after retries, but the generated site deployment already ran. ${error.message}\n`
        );
      }
    });

    sendJson(response, 202, { taskId: task.id });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/actions/preview/start') {
    if (!(await dependenciesInstalled())) {
      sendJson(response, 400, { error: 'Dependencies are not installed yet.' });
      return;
    }

    if (!previewProcess) {
      startPreviewProcess();
    }

    sendJson(response, 200, { ok: true, previewUrl });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/actions/preview/stop') {
    await stopPreviewProcess();
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (request, response) => {
  try {
    if (!requireAuth(request, response)) {
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/images/')) {
      await serveImageFile(response, url.pathname);
      return;
    }

    await serveStaticFile(request, response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Hexo Admin UI is running at http://${host}:${port}`);
});

process.on('SIGINT', async () => {
  await stopPreviewProcess();
  process.exit(0);
});
