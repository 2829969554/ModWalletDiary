// icons.js —— 支付工具 / 平台 logo 与自定义随机色
// 品牌图标优先用内置库 brand-icons.js（global.BRAND_DB），内置没有的再走
// Simple Icons CDN，断网时用 localStorage 里缓存的那份，再不行就随机色加首字
(function (global) {
  'use strict';

  const SI_BASE = 'https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/';

  // 名称关键词 -> 图标 slug（对应 global.BRAND_DB；slug 为空就是走随机色）
  const PLATFORM_MAP = [
    { keys: ['支付宝', 'alipay', '余利宝', '网商'], slug: 'alipay', name: '支付宝' },
    { keys: ['花呗'], slug: 'alipay', name: '花呗' },
    { keys: ['微信支付', '微信收款'], slug: 'wechatpay', name: '微信支付' },
    { keys: ['微信', 'wechat', 'weixin'], slug: 'wechat', name: '微信' },
    { keys: ['QQ'], slug: 'tencentqq', name: 'QQ' },
    { keys: ['京东白条', '白条', '京东金融', 'jdfinance'], slug: 'jdfinance', name: '京东金融' },
    { keys: ['京东', 'jd', 'jdcom'], slug: 'jdcom', name: '京东' },
    { keys: ['拼多多', 'pdd'], slug: 'pinduoduo', name: '拼多多' },
    { keys: ['淘宝', 'taobao'], slug: 'taobao', name: '淘宝' },
    { keys: ['天猫', 'tmall'], slug: '', name: '' },
    { keys: ['饿了么', 'eleme'], slug: 'eleme', name: '饿了么' },
    { keys: ['抖音', 'douyin', 'tiktok'], slug: 'douyin', name: '抖音' },
    { keys: ['快手', 'kuaishou'], slug: 'kuaishou', name: '快手' },
    { keys: ['小红书', 'xhs', 'rednote'], slug: 'xiaohongshu', name: '小红书' },
    { keys: ['闲鱼', 'xianyu'], slug: '', name: '' },
    { keys: ['苏宁', 'suning'], slug: '', name: '' },
    { keys: ['唯品会', 'vipshop'], slug: 'vipshop', name: '唯品会' },
    { keys: ['滴滴', 'didi'], slug: 'didi', name: '滴滴' },
    { keys: ['百度', 'baidu'], slug: 'baidu', name: '百度' },
    { keys: ['网易云音乐', 'neteasecloudmusic'], slug: 'neteasecloudmusic', name: '网易云音乐' },
    { keys: ['网易', 'netease'], slug: 'neteasecloudmusic', name: '网易' },
    { keys: ['云闪付', '银联', 'unionpay', 'quickpass'], slug: 'unionpay', name: '云闪付' },
    { keys: ['ApplePay', 'apple pay', '苹果支付'], slug: 'applepay', name: 'Apple Pay' },
    { keys: ['工商银行', '工行', 'icbc'], slug: 'icbc', name: '工商银行' },
    { keys: ['建设银行', '建行', 'ccbank'], slug: 'ccbank', name: '建设银行' },
    { keys: ['农业银行', '农行', 'agbank'], slug: 'agbank', name: '农业银行' },
    { keys: ['中国银行', '中行', 'boc'], slug: 'boc', name: '中国银行' },
    { keys: ['交通银行', '交行'], slug: '', name: '' },
    { keys: ['招商银行', '招行', 'cmbank'], slug: 'cmbank', name: '招商银行' },
    { keys: ['邮储', '邮政储蓄', 'psbc'], slug: '', name: '' },
    { keys: ['中信银行', 'citic'], slug: '', name: '' },
    { keys: ['民生银行', 'cmbc'], slug: '', name: '' },
    { keys: ['兴业银行', 'cib'], slug: '', name: '' },
    { keys: ['平安银行', '平安'], slug: '', name: '' },
    { keys: ['华为', 'huawei'], slug: 'huawei', name: '华为' },
    { keys: ['小米', 'xiaomi', 'miui'], slug: 'xiaomi', name: '小米' },
    { keys: ['苹果', 'apple'], slug: 'apple', name: 'Apple' },
    { keys: ['微软', 'microsoft'], slug: 'microsoft', name: 'Microsoft' },
    { keys: ['星巴克', 'starbucks'], slug: 'starbucks', name: '星巴克' },
    { keys: ['瑞幸', 'luckin'], slug: 'luckincoffee', name: '瑞幸咖啡' },
    { keys: ['肯德基', 'kfc'], slug: 'kfc', name: '肯德基' },
    { keys: ['麦当劳', 'mcdonalds'], slug: 'mcdonalds', name: '麦当劳' },
    { keys: ['visa', '维萨'], slug: 'visa', name: 'Visa' },
    { keys: ['mastercard', '万事达'], slug: 'mastercard', name: 'Mastercard' },
    { keys: ['paypal', '贝宝'], slug: 'paypal', name: 'PayPal' },
    { keys: ['stripe', 'stripe支付'], slug: 'stripe', name: 'Stripe' },
    { keys: ['steam', 'Steam平台'], slug: 'steam', name: 'Steam' },
    { keys: ['借记卡', '储蓄卡', 'debit'], slug: '', name: '' },            // 通用卡：随机色
    { keys: ['信用卡', 'credit'], slug: '', name: '' },
    { keys: ['现金', 'cash'], slug: '', name: '' }
  ];

  // 随机色盘（自定义名称用）
  const PALETTE = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b'];

  // djb2，同一个名字永远算出同一个颜色，换台设备也是
  function hashStr(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  }

  // 返回 {type:'svg'|'none', slug, brandName, color}
  function matchPlatform(name) {
    if (!name) return { type: 'none', slug: '', brandName: '', color: PALETTE[hashStr('x') % PALETTE.length] };
    const n = String(name).toLowerCase();
    let hit = null;
    PLATFORM_MAP.some((m) => {
      const matched = m.keys.some((k) => n.indexOf(k.toLowerCase()) !== -1);
      if (matched) { hit = m; return true; }
      return false;
    });
    // 认出来了但没收录 slug，或者压根没认出来，都用随机色
    if (hit && hit.slug) return { type: 'svg', slug: hit.slug, brandName: hit.name || name, color: '' };
    return { type: 'none', slug: '', brandName: '', color: PALETTE[hashStr(String(name).trim()) % PALETTE.length] };
  }

  // 已经加载过的图标，slug -> {vb, s}
  const loaded = {};

  function cacheRead(slug) {
    try {
      const c = JSON.parse(localStorage.getItem('WDBIcos') || '{}');
      return c[slug];
    } catch (e) { return undefined; }
  }

  function cacheWrite(slug, data) {
    try {
      const c = JSON.parse(localStorage.getItem('WDBIcos') || '{}');
      c[slug] = data;
      localStorage.setItem('WDBIcos', JSON.stringify(c));
    } catch (e) { /* ignore */ }
  }

  // 内置库 -> 本地缓存 -> CDN，顺序不能换：离线时前两级才兜得住
  function loadIcon(slug) {
    if (loaded[slug] !== undefined) return Promise.resolve(loaded[slug]);
    const db = global.BRAND_DB || {};
    if (db[slug]) { loaded[slug] = db[slug]; return Promise.resolve(db[slug]); }
    const cached = cacheRead(slug);
    if (cached && cached.vb && cached.s && cached.s.indexOf('<') === -1) {
      loaded[slug] = cached; return Promise.resolve(cached);
    }
    return fetch(SI_BASE + slug + '.svg')
      .then((r) => { if (!r.ok) throw 0; return r.text(); })
      .then((txt) => {
        const data = parseSvg(txt);
        loaded[slug] = data;
        if (data) cacheWrite(slug, data);
        return data;
      })
      .catch(() => { loaded[slug] = null; return null; });
  }

  function parseSvg(txt) {
    const vb = /viewBox="([^"]+)"/.exec(txt);
    const inner = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(txt);
    if (!vb || !inner) return null;
    const s = inner[1]
      .replace(/<title[\s\S]*?<\/title>/gi, '')
      .replace(/\sxmlns[^=]*="[^"]*"/g, '')
      .replace(/\sclass="[^"]*"/g, '')
      .replace(/\s+/g, ' ').trim();
    if (!s || /<script/i.test(s)) return null;
    return { vb: vb[1], s: s };
  }

  // 联网时把所有品牌图标先缓存下来，内置库已有的跳过
  function prefetch() {
    const db = global.BRAND_DB || {};
    allSlugs().forEach((slug) => {
      if (!db[slug] && !cacheRead(slug)) loadIcon(slug);
    });
  }

  function fillLogo(el, name) {
    if (!el) return;
    const info = matchPlatform(name);
    el.innerHTML = '';
    if (info.type !== 'svg') {
      fallbackLogo(el, name, info.color);
      return;
    }
    loadIcon(info.slug).then((data) => {
      if (!el) return;
      if (!data) {
        fallbackLogo(el, name, info.color);
        return;
      }
      el.innerHTML = `<svg viewBox="${data.vb}" fill="currentColor" width="60%" height="60%">${data.s}</svg>`;
      el.style.background = '#fff';
      // 多色标自带 fill 不吃 currentColor，只有单色标才用得上品牌官方色
      el.style.color = data.c ? '#' + data.c : '#1e2233';
    });
  }

  // 随机色 + 首字
  function fallbackLogo(el, name, color) {
    const ch = (name || '?').trim().charAt(0).toUpperCase() || '?';
    el.textContent = ch;
    el.style.background = color || PALETTE[hashStr(name || 'x') % PALETTE.length];
    el.style.color = '#fff';
  }

  function allSlugs() {
    const s = {};
    PLATFORM_MAP.forEach((m) => { if (m.slug) s[m.slug] = 1; });
    return Object.keys(s);
  }

  global.Icons = {
    matchPlatform: matchPlatform,
    fillLogo: fillLogo,
    loadSvg: loadIcon,
    allSlugs: allSlugs,
    prefetch: prefetch
  };
})(window);
