/* ============================================================
 * icons.js — 图标库：支付工具 / 平台 logo 采集 + 自定义随机色
 * 品牌图标优先使用本地内置库 brand-icons.js（global.BRAND_DB，
 * SVG 采集自 Iconify 聚合图集：Simple Icons CC0 / Remix Icon Apache-2.0
 * / Arcticons GPL-3.0 / Logos MIT 等），完全离线可用；
 * 内置库没有的 slug 再尝试 Simple Icons CDN，最后回退"随机颜色 + 首字"。
 * ============================================================ */
(function (global) {
  'use strict';

  var SI_BASE = 'https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/';

  // 名称匹配关键词 -> 图标 slug（对应 global.BRAND_DB；空 slug = 随机色回退）
  var PLATFORM_MAP = [
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
  var PALETTE = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b'];

  function hashStr(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  }

  // 返回 {type:'svg'|'none', slug, brandName, color}
  function matchPlatform(name) {
    if (!name) return { type: 'none', slug: '', brandName: '', color: PALETTE[hashStr('x') % PALETTE.length] };
    var n = String(name).toLowerCase();
    for (var i = 0; i < PLATFORM_MAP.length; i++) {
      var m = PLATFORM_MAP[i];
      for (var j = 0; j < m.keys.length; j++) {
        if (n.indexOf(m.keys[j].toLowerCase()) !== -1) {
          if (m.slug) return { type: 'svg', slug: m.slug, brandName: m.name || name, color: '' };
          // 命中了品牌但无 slug：用稳定的随机色
          return { type: 'none', slug: '', brandName: '', color: PALETTE[hashStr(String(name).trim()) % PALETTE.length] };
        }
      }
    }
    return { type: 'none', slug: '', brandName: '', color: PALETTE[hashStr(String(name).trim()) % PALETTE.length] };
  }

  // 已加载的 slug 内存缓存
  var loaded = {};

  // 离线缓存：localStorage 存 slug -> {vb, s}，断网后仍可显示品牌图标
  function cacheRead(slug) {
    try {
      var c = JSON.parse(localStorage.getItem('WDBIcos') || '{}');
      return c[slug];
    } catch (e) { return undefined; }
  }
  function cacheWrite(slug, data) {
    try {
      var c = JSON.parse(localStorage.getItem('WDBIcos') || '{}');
      c[slug] = data;
      localStorage.setItem('WDBIcos', JSON.stringify(c));
    } catch (e) { /* ignore */ }
  }

  // 读取一个 slug 的图标数据 {vb, s}：
  // 1) 本地内置 BRAND_DB（离线可用） 2) localStorage 缓存 3) Simple Icons CDN
  function loadIcon(slug) {
    if (loaded[slug] !== undefined) return Promise.resolve(loaded[slug]);
    var db = global.BRAND_DB || {};
    if (db[slug]) { loaded[slug] = db[slug]; return Promise.resolve(db[slug]); }
    var cached = cacheRead(slug);
    if (cached && cached.vb && cached.s && cached.s.indexOf('<') === -1) {
      loaded[slug] = cached; return Promise.resolve(cached);
    }
    return fetch(SI_BASE + slug + '.svg')
      .then(function (r) { if (!r.ok) throw 0; return r.text(); })
      .then(function (txt) {
        var vb = /viewBox="([^"]+)"/.exec(txt);
        var inner = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(txt);
        var data = null;
        if (vb && inner) {
          var s = inner[1]
            .replace(/<title[\s\S]*?<\/title>/gi, '')
            .replace(/\sxmlns[^=]*="[^"]*"/g, '')
            .replace(/\sclass="[^"]*"/g, '')
            .replace(/\s+/g, ' ').trim();
          if (s && !/<script/i.test(s)) data = { vb: vb[1], s: s };
        }
        loaded[slug] = data;
        if (data) cacheWrite(slug, data);
        return data;
      })
      .catch(function () { loaded[slug] = null; return null; });
  }

  // 联网时预取全部品牌图标到本地缓存（内置库已有则跳过）
  function prefetch() {
    var db = global.BRAND_DB || {};
    allSlugs().forEach(function (slug) {
      if (!db[slug] && !cacheRead(slug)) loadIcon(slug);
    });
  }

  // 给一个容器填充 logo：优先品牌 SVG，否则随机色 + 首字
  function fillLogo(el, name) {
    if (!el) return;
    var info = matchPlatform(name);
    el.innerHTML = '';
    if (info.type === 'svg') {
      loadIcon(info.slug).then(function (data) {
        if (!el) return;
        if (data) {
          el.innerHTML = '<svg viewBox="' + data.vb + '" fill="currentColor" width="60%" height="60%">' + data.s + '</svg>';
          el.style.background = '#fff';
          el.style.color = '#1e2233';
        } else {
          setFallback();
        }
      });
    } else {
      setFallback();
    }
    function setFallback() {
      var ch = (name || '?').trim().charAt(0).toUpperCase() || '?';
      el.textContent = ch;
      el.style.background = info.color || PALETTE[hashStr(name || 'x') % PALETTE.length];
      el.style.color = '#fff';
    }
  }

  // 收集全部 slug，供离线预下载
  function allSlugs() {
    var s = {};
    PLATFORM_MAP.forEach(function (m) { if (m.slug) s[m.slug] = 1; });
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
