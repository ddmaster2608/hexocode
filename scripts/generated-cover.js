/* 为没有封面的文章生成确定性 SVG 封面（与 admin-ui 管理台同款算法）。
   - before_post_render：无 cover/banner/thumbnail 的文章指向 /images/gen-covers/<hash>.svg
   - generator：构建时产出对应的 SVG 文件
   同一标题永远生成同一张图（纯渐变色块）；已设置封面的文章不受影响。 */
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
