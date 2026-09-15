const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual routing modules with isolated CMS/session boundaries.
function load(file, deps, env = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: id => {
      if (id in deps) return deps[id];
      if (id === '@/lib/contentScope') return load('lib/contentScope.ts', {}, env);
      throw Error(`Unexpected dependency: ${id}`);
    },
    console, process: { env: { OPTIMIZELY_GRAPH_SINGLE_KEY: 'test', NEXT_PUBLIC_SITE_URL: 'https://site.test', ...env } },
    Headers, URL, URLSearchParams, Response, crypto: globalThis.crypto,
    setTimeout: () => 0,
  });
  return exports;
}
const locales = load('lib/i18n/config.ts', {});
function makeProxy() {
  const respond = (kind, url, options, status) => ({
    kind, url: url?.toString(), status,
    locale: options?.request?.headers?.get('X-NEXT-INTL-LOCALE'),
    cookies: { set() {} },
  });
  return load('proxy.ts', {
    'next/server': { NextResponse: {
      next: options => respond('next', null, options),
      rewrite: (url, options) => respond('rewrite', url, options),
      redirect: (url, status) => respond('redirect', url, null, status),
    } },
    '@/lib/i18n/config': locales,
    '@/lib/admin/auth': { verifySessionToken: async s => s === 'valid', SESSION_COOKIE: 'session' },
    '@/lib/redirects': { resolveRedirect: async () => null },
  }).default;
}
function request(path, session) {
  const nextUrl = new URL(`https://site.test${path}`);
  nextUrl.clone = () => new URL(nextUrl);
  return { nextUrl, headers: new Headers(), cookies: {
    get: name => name === 'session' && session ? { value: session } : undefined,
    set() {},
  } };
}
test('all localized admin destinations require a session', async () => {
  const proxy = makeProxy();
  for (const prefix of ['', '/en', '/fr', '/es', '/de', '/sv']) {
    for (const session of [undefined, 'invalid']) {
      const result = await proxy(request(`${prefix}/opti-admin`, session));
      assert.equal(result.kind, 'redirect');
      assert.equal(new URL(result.url).pathname, '/opti-admin/login');
    }
  }
  const result = await proxy(request('/fr/opti-admin?tab=1', 'valid'));
  assert.equal(result.url, 'https://site.test/opti-admin?tab=1');
  assert.equal((await proxy(request('/opti-admin/login'))).kind, 'next');
});
test('English normalization preserves queries and rewrites previews', async () => {
  const proxy = makeProxy();
  for (const [input, output] of [['/en?x=1', '/?x=1'], ['/en/about?x=1', '/about?x=1']]) {
    const result = await proxy(request(input));
    assert.equal(result.status, 308);
    assert.equal(result.url, `https://site.test${output}`);
  }
  const result = await proxy(request('/en?preview_token=test&ver=2&ctx=preview'));
  assert.equal(result.kind, 'rewrite');
  assert.equal(result.locale, 'en');
  assert.equal(result.url, 'https://site.test/?preview_token=test&ver=2&ctx=preview');
});
test('translation lookup finds English-prefixed source and preserves variants', async () => {
  const calls = [];
  const translated = { _metadata: { key: 'a', locale: 'fr' } };
  const lib = load('lib/optimizely.ts', {
    react: { cache: f => f }, 'next/headers': {},
    '@optimizely/cms-sdk': { config() {}, getClient: () => ({
      getContentByPath: async (path, options) => {
        calls.push({ path, options });
        return path === '/en/about' ? [{ _metadata: { key: 'a', locale: 'en', variation: options.variation ? 'B' : null } }] : [];
      },
      getItems: async () => [translated],
    }) },
    '@/lib/i18n/config': locales, '@/lib/theme-axes': {}, 'next-intl/server': {},
  });
  assert.equal(await lib.getLocalizedContentByPath('/about', 'fr', 'https://site.test'), translated);
  const variant = await lib.getLocalizedContentByPath('/about', 'fr', 'https://site.test', 'B');
  assert.equal(variant._metadata.variation, 'B');
  assert.equal(calls.at(-1).options.variation.value[0], 'B');
});
test('draft redirect preserves context and supports legacy path links', async () => {
  const route = load('app/api/draft/route.ts', {
    'next/headers': { draftMode: async () => ({ enable() {} }) },
    'next/navigation': { redirect: url => url },
  });
  // redirect throws in Next.js; capture its destination with a mock.
  let destination;
  const handler = load('app/api/draft/route.ts', {
    'next/headers': { draftMode: async () => ({ enable() {} }) },
    'next/navigation': { redirect: url => { destination = url; } },
  }).GET;
  for (const query of ['path=/article&ctx=preview', 'ctx=/article&ext_preview=1']) {
    await handler({ url: `https://site.test/api/draft?preview_token=test&${query}` });
    const url = new URL(destination, 'https://site.test');
    assert.equal(url.pathname, '/article');
    assert.equal(url.searchParams.get('ctx'), 'preview');
    assert.equal(url.searchParams.get('preview_token'), 'test');
  }
  assert.equal((await route.GET({ url: 'https://site.test/api/draft' })).status, 401);
});
test('versioned draft routing preserves preview mode for pages and blocks', async () => {
  for (const type of ['_Experience', '_Page', '_Component']) {
    for (const ctx of ['edit', 'preview']) {
      let destination;
      const { GET } = load('app/api/draft/[...slug]/route.ts', {
        'next/headers': { draftMode: async () => ({ enable() {} }) },
        'next/navigation': { redirect: url => { destination = url; throw new Error('REDIRECT'); } },
        '@/lib/optimizely': { getClient: () => ({ request: async () => ({
          _Content: { item: { _metadata: { types: [type], url: { default: '/en/article' } } } },
        }) }) },
      });
      await assert.rejects(GET({ url: `https://site.test/api/draft/item?preview_token=test&key=a&ver=2&loc=en&ctx=${ctx}` }, { params: Promise.resolve({ slug: ['edit'] }) }), /REDIRECT/);
      const url = new URL(destination, 'https://site.test');
      assert.equal(url.searchParams.get('ctx'), ctx);
      assert.equal(url.searchParams.get('ver'), '2');
      assert.equal(url.pathname, type === '_Component' ? '/preview' : '/en/article');
    }
  }
});
test('Graph lookup stays on the configured site even when a different host has the page', async () => {
  const calls = [];
  const lib = load('lib/optimizely.ts', {
    react: { cache: f => f }, 'next/headers': {},
    '@optimizely/cms-sdk': { config() {}, getClient: () => ({
      getContentByPath: async (path, options) => {
        calls.push(options.host);
        return options.host ? [] : [{ _metadata: { key: 'foreign', locale: 'en' } }];
      },
    }) },
    '@/lib/i18n/config': locales, '@/lib/theme-axes': {}, 'next-intl/server': {},
  });
  assert.equal(await lib.getLocalizedContentByPath('/about', 'en', 'https://preview.test'), null);
  assert.ok(calls.length > 0);
  assert.ok(calls.every(host => ['https://site.test', 'http://site.test'].includes(host)));
});
test('CMS folder ancestors are excluded without reintroducing URL-derived links', async () => {
  const { getBreadcrumbTrail } = load('lib/ancestors.ts', {
    react: { cache: f => f },
    '@/lib/optimizely': { getClient: () => ({ getPath: async () => [
      { _metadata: { displayName: 'Folder', types: ['OT_FolderPage', '_Page'], url: { default: '/folder' } } },
      { _metadata: { displayName: 'Page', types: ['_Page'], url: { default: '/folder/page' } } },
    ] }) },
  });
  const trail = await getBreadcrumbTrail('page', 'en', 'https://site.test');
  assert.equal(trail.length, 1);
  assert.equal(trail[0].name, 'Page');
});
test('sitemap covers all routable types, paginates, and excludes other applications', async () => {
  const calls = [];
  const make = (key, base = 'https://site.test') => ({ _metadata: { url: { default: `/en/${key}`, base } } });
  const { default: sitemap } = load('app/sitemap.ts', {
    '@/lib/i18n/config': locales,
    '@/lib/optimizely': { getClient: () => ({ request: async (query, { skip }) => {
      const type = query.match(/query Sitemap_(\w+)/)[1];
      calls.push({ type, skip });
      const items = type === 'BlankExperience'
        ? (skip === 0 ? Array.from({ length: 100 }, (_, i) => make(`page-${i}`)) : [make('last'), make('foreign', 'https://other.test')])
        : [make(type)];
      return { [type]: { items } };
    } }) },
  });
  const entries = await sitemap();
  assert.equal(entries.length, 106);
  assert.ok(entries.some(e => e.url === 'https://site.test/last'));
  assert.ok(!entries.some(e => e.url.includes('foreign')));
  assert.equal(new Set(calls.map(c => c.type)).size, 6);
  assert.ok(calls.some(c => c.skip === 100));
});
test('blog membership follows container ancestry after a folder rename', async () => {
  const item = (key, path, ancestors, base = 'https://site.test') => ({
    _metadata: { key, path: ancestors, url: { default: path, base } },
  });
  const { getBlogIndex } = load('lib/blogIndex.ts', {
    react: { cache: f => f },
    '@/lib/optimizely': { getRequestLocale: async () => 'en', getClient: () => ({ request: async () => ({
      BlankExperience: { items: [
        item('yes', '/en/insights/nested/article', ['root', 'blog-container', 'nested']),
        item('no', '/en/blog/looks-like-an-article', ['other-container']),
        item('foreign', '/en/insights/article', ['blog-container'], 'https://other.test'),
      ] },
    }) }) },
  }, { CMS_BLOG_CONTAINER_KEY: 'blog-container' });
  const posts = await getBlogIndex();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].key, 'yes');
});
test('Swedish URLs set the locale and retain the public prefix', async () => {
  const result = await makeProxy()(request('/sv?x=1'));
  assert.equal(result.kind, 'rewrite');
  assert.equal(result.locale, 'sv');
  assert.equal(result.url, 'https://site.test/?x=1');
});
test('CMS path-based preview context survives the draft redirect', async () => {
  let destination;
  const { GET } = load('app/api/draft/[...slug]/route.ts', {
    'next/headers': { draftMode: async () => ({ enable() {} }) },
    'next/navigation': { redirect: url => { destination = url; throw new Error('REDIRECT'); } },
    '@/lib/optimizely': { getClient: () => ({ request: async () => ({
      _Content: { item: { _metadata: { types: ['_Experience'], url: { default: '/sv/' } } } },
    }) }) },
  });
  await assert.rejects(GET({ url: 'https://site.test/api/draft/preview?preview_token=test&key=a&ver=2&loc=sv' },
    { params: Promise.resolve({ slug: ['preview'] }) }), /REDIRECT/);
  assert.equal(new URL(destination, 'https://site.test').searchParams.get('ctx'), 'preview');
});
test('only explicitly configured application hosts match, including Swedish localhost', () => {
  const scope = load('lib/contentScope.ts', {}, {
    CMS_GRAPH_SITE_ORIGINS: 'https://lnsfrskringar-demo.vercel.app,http://localhost:3000',
  });
  assert.equal(scope.belongsToSite('https://lnsfrskringar-demo.vercel.app'), true);
  assert.equal(scope.belongsToSite('http://localhost:3000'), true);
  assert.equal(scope.belongsToSite('http://localhost:3001'), false);
  assert.equal(scope.belongsToSite('https://lf-skane-demo.vercel.app'), false);
});
