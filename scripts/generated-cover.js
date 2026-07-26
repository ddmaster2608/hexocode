/* 为没有封面的文章生成确定性 SVG 封面（与 admin-ui 管理台同款算法）。
   - before_post_render：无 cover/banner/thumbnail 的文章指向 /images/gen-covers/<hash>.svg
   - generator：构建时产出对应的 SVG 文件
   同一标题永远生成同一张图；已设置封面的文章不受影响。 */
'use strict';

const COVER_HUES = [16, 34, 150, 205, 262, 336];
const GEN_DIR = 'images/gen-covers';

function hashString(value) {
  let hash = 5381;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function coverPathFor(title) {
  return `${GEN_DIR}/${hashString(title).toString(36)}.svg`;
}

function buildSvg(title) {
  const hash = hashString(title);
  const hue = COVER_HUES[hash % COVER_HUES.length];
  const hue2 = hue + 24 + ((hash >> 4) % 22);
  const angle = (hash >> 6) % 360;
  const cx1 = 30 + ((hash >> 10) % 150);
  const cy1 = 15 + ((hash >> 14) % 85);
  const r1 = 36 + ((hash >> 18) % 26);
  const cx2 = 110 + ((hash >> 20) % 110);
  const cy2 = 55 + ((hash >> 24) % 70);
  const initial = [...String(title).trim()][0] || '?';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0" stop-color="hsl(${hue} 62% 66%)"/>
      <stop offset="1" stop-color="hsl(${hue2} 58% 46%)"/>
    </linearGradient>
  </defs>
  <rect width="240" height="135" fill="url(#g)"/>
  <circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="hsl(${hue2} 72% 82%)" opacity="0.32"/>
  <circle cx="${cx2}" cy="${cy2}" r="26" fill="hsl(${hue} 75% 88%)" opacity="0.26"/>
  <text x="120" y="86" text-anchor="middle" font-size="52" font-weight="600"
    font-family="Georgia, 'STZhongsong', 'Noto Serif SC', serif" fill="rgba(255,255,255,0.9)">${escapeXml(initial)}</text>
</svg>
`;
}

function hasOwnCover(data) {
  return Boolean(data.cover || data.banner || data.thumbnail);
}

hexo.extend.filter.register('before_post_render', (data) => {
  if (!data.source || !data.source.startsWith('_posts/')) return data;
  if (hasOwnCover(data)) return data;
  data.cover = `/${coverPathFor(data.title)}`;
  return data;
});

hexo.extend.generator.register('generated-covers', (locals) => {
  const routes = [];
  const seen = new Set();

  locals.posts.forEach((post) => {
    const cover = String(post.cover || '');
    // 只为使用生成封面的文章产出文件（包括本轮由过滤器赋值的和缓存里已带路径的）
    if (!cover.includes(`/${GEN_DIR}/`)) return;
    const filePath = coverPathFor(post.title);
    if (seen.has(filePath)) return;
    seen.add(filePath);
    routes.push({ path: filePath, data: buildSvg(post.title) });
  });

  return routes;
});
