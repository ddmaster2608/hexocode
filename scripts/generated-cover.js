/* 无封面文章的自动封面（与 admin-ui 管理台同一套规则）：
   1. front-matter 已有 cover/banner/thumbnail → 不动
   2. 正文里插过图 → 按标题哈希从中固定选一张（"随机"但每次构建结果一致）
   3. 没有插图 → 从 source/images/cover-pool/ 图片池按哈希选一张（CC0 图源，自托管）
   4. 图片池为空时 → 兜底生成纯渐变 SVG
   .md 源文件永远不被修改。 */
'use strict';

const fs = require('fs');
const path = require('path');

const COVER_HUES = [16, 34, 150, 205, 262, 336];
const GEN_DIR = 'images/gen-covers';
const POOL_DIR = 'images/cover-pool';

function hashString(value) {
  let hash = 5381;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/* 提取正文里的图片链接（markdown 与 <img>），只收绝对路径/站内路径，跳过 data: 与 svg 徽章 */
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

let poolCache = null;
function listPool() {
  if (poolCache) return poolCache;
  try {
    const dir = path.join(hexo.source_dir, 'images', 'cover-pool');
    poolCache = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  } catch {
    poolCache = [];
  }
  return poolCache;
}

function coverPathFor(title) {
  return `${GEN_DIR}/${hashString(title).toString(36)}.svg`;
}

function buildSvg(title) {
  const hash = hashString(title);
  const hue = COVER_HUES[hash % COVER_HUES.length];
  const hue2 = hue + 24 + ((hash >> 4) % 22);
  const angle = (hash >> 6) % 360;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0" stop-color="hsl(${hue} 62% 66%)"/>
      <stop offset="1" stop-color="hsl(${hue2} 58% 46%)"/>
    </linearGradient>
  </defs>
  <rect width="240" height="135" fill="url(#g)"/>
</svg>
`;
}

function pickAutoCover(title, content) {
  const hash = hashString(title);
  const contentImages = extractContentImages(content);
  if (contentImages.length) return contentImages[hash % contentImages.length];
  const pool = listPool();
  if (pool.length) return `/${POOL_DIR}/${pool[hash % pool.length]}`;
  return `/${coverPathFor(title)}`;
}

hexo.extend.filter.register('before_post_render', (data) => {
  if (!data.source || !data.source.startsWith('_posts/')) return data;
  if (data.cover || data.banner || data.thumbnail) return data;
  data.cover = pickAutoCover(data.title, data.content);
  return data;
});

/* 仅为仍在使用渐变兜底的文章产出 SVG 文件 */
hexo.extend.generator.register('generated-covers', (locals) => {
  const routes = [];
  const seen = new Set();

  locals.posts.forEach((post) => {
    const cover = String(post.cover || '');
    if (!cover.includes(`/${GEN_DIR}/`)) return;
    const filePath = coverPathFor(post.title);
    if (seen.has(filePath)) return;
    seen.add(filePath);
    routes.push({ path: filePath, data: buildSvg(post.title) });
  });

  return routes;
});
