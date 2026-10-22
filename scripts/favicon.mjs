import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, 'public', 'images', 'site', 'generated');
const GENERATED_MARKER_FILE = path.join(GENERATED_DIR, '.favicon-generated.json');
const MARKER_FILE = path.join(ROOT, 'tools', 'favicon-generated.json');

const readSiteSettings = () => {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'settings', 'site.json'), 'utf8'));
  } catch {
    return {};
  }
};

const toPublicFile = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().replace(/^\/+/, '');
  const filePath = path.join(ROOT, 'public', ...normalized.split('/'));
  return existsSync(filePath) ? filePath : null;
};

const resolveSourceImage = (favicon) =>
  toPublicFile(favicon.png)
  ?? toPublicFile(favicon.source)
  ?? toPublicFile(favicon.svg)
  ?? toPublicFile('/favicon-32x32.png')
  ?? toPublicFile('/favicon.svg');

const pngAt = (source, size) =>
  sharp(source, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer();

const createIco = async (source) => {
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map((size) => pngAt(source, size)));
  const headerSize = 6 + sizes.length * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  sizes.forEach((size, index) => {
    const entryOffset = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entryOffset);
    header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(images[index].length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += images[index].length;
  });

  return Buffer.concat([header, ...images]);
};

const basePath = (() => {
  const raw = String(process.env.ASTRO_VERSICARIUM_BASE_PATH ?? '/').trim();
  const segment = raw.replace(/^\/+|\/+$/g, '');
  return segment ? `/${segment}/` : '/';
})();

const main = async () => {
  const settings = readSiteSettings();
  const favicon = settings.favicon ?? {};
  const source = resolveSourceImage(favicon);
  if (!source) {
    console.warn('[favicon] no source image found; leaving existing icons untouched');
    return;
  }

  mkdirSync(GENERATED_DIR, { recursive: true });
  const generated = {};

  const writeGenerated = async (name, buffer) => {
    const filePath = path.join(GENERATED_DIR, name);
    writeFileSync(filePath, buffer);
    generated[name] = true;
  };

  await writeGenerated('favicon-16x16.png', await pngAt(source, 16));
  await writeGenerated('favicon-32x32.png', await pngAt(source, 32));
  await writeGenerated('apple-touch-icon.png', await pngAt(source, 180));
  await writeGenerated('icon-192.png', await pngAt(source, 192));
  await writeGenerated('icon-512.png', await pngAt(source, 512));
  await writeGenerated('favicon.ico', await createIco(source));

  const title = typeof settings.title === 'string' && settings.title.trim()
    ? settings.title.trim()
    : 'Versicarium';
  const manifest = {
    name: title,
    short_name: title,
    start_url: basePath,
    scope: basePath,
    display: 'standalone',
    background_color: '#fffefc',
    theme_color: '#b91c1c',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
  writeFileSync(path.join(GENERATED_DIR, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const rootIco = path.join(ROOT, 'public', 'favicon.ico');
  const previousMarker = (() => {
    try {
      return JSON.parse(readFileSync(MARKER_FILE, 'utf8'));
    } catch {
      return {};
    }
  })();
  const generatedIcoBuffer = readFileSync(path.join(GENERATED_DIR, 'favicon.ico'));
  const generatedIcoHash = createHash('sha256').update(generatedIcoBuffer).digest('hex');
  const currentRootIcoHash = existsSync(rootIco)
    ? createHash('sha256').update(readFileSync(rootIco)).digest('hex')
    : null;
  // 只有「文件缺失」「内容与本次生成一致」或「仍是上次生成的版本」才写入；
  // 用户替换过且与生成结果不同的 ICO 永不覆盖。
  const rootIcoIsOurs = currentRootIcoHash === null
    || currentRootIcoHash === generatedIcoHash
    || (previousMarker.rootIco === true && previousMarker.rootIcoHash === currentRootIcoHash);
  if (rootIcoIsOurs) {
    writeFileSync(rootIco, generatedIcoBuffer);
  }

  const markerPayload = {
    ...generated,
    rootIco: rootIcoIsOurs,
    rootIcoHash: createHash('sha256').update(readFileSync(rootIco)).digest('hex'),
    source: path.relative(ROOT, source).replace(/\\/g, '/')
  };
  mkdirSync(path.dirname(MARKER_FILE), { recursive: true });
  writeFileSync(MARKER_FILE, `${JSON.stringify(markerPayload, null, 2)}\n`, 'utf8');
  writeFileSync(GENERATED_MARKER_FILE, `${JSON.stringify(markerPayload, null, 2)}\n`, 'utf8');

  console.log(`[favicon] generated icons from ${path.relative(ROOT, source)}`);
};

main().catch((error) => {
  console.error('[favicon] generation failed:', error);
  process.exitCode = 1;
});
