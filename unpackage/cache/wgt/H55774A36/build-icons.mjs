/* ============================================================
 * build-icons.mjs — 采集常用支付软件/平台/银行品牌图标
 * 从 Iconify 聚合图集抓取 SVG（Simple Icons CC0 / Remix Icon Apache-2.0
 * / Arcticons GPL / Logos MIT 等），生成 js/brand-icons.js 本地内置。
 * 运行：node build-icons.mjs
 * ============================================================ */
import { writeFileSync, readFileSync } from 'node:fs';

/* 品牌官方色：simple-icons 数据（si-tmp.json）自动取色，非 simple-icons 来源用手工色 */
const SI_DATA = (() => {
  try { return JSON.parse(readFileSync(new URL('./si-tmp.json', import.meta.url), 'utf8')); }
  catch (e) { return []; }
})();
const SI_TITLES = {
  alipay: 'Alipay', wechat: 'WeChat', tencentqq: 'QQ', taobao: 'Taobao',
  meituan: 'Meituan', xiaohongshu: 'Xiaohongshu', baidu: 'Baidu',
  neteasecloudmusic: 'NetEase Cloud Music', huawei: 'Huawei', xiaomi: 'Xiaomi',
  applepay: 'Apple Pay', apple: 'Apple', paypal: 'PayPal', visa: 'Visa',
  mastercard: 'MasterCard', stripe: 'Stripe', starbucks: 'Starbucks',
  kfc: 'KFC', mcdonalds: "McDonald's", steam: 'Steam', kuaishou: 'Kuaishou',
  douyin: 'TikTok'
};
const MANUAL_COLORS = {
  wechatpay: '07C160', pinduoduo: 'E02E24', jdcom: 'E1251B', jdfinance: 'E1251B',
  eleme: '0085FF', icbc: 'C8000B', boc: 'A6001A', agbank: '009944',
  ccbank: '0066B3', cmbank: 'D22630', didi: 'FF7E33', vipshop: 'E4007F',
  luckincoffee: '1D3F94', microsoft: '00A4EF', unionpay: ''
};

const ICONS = [
  { slug: 'alipay',    tries: ['simple-icons/alipay'] },
  { slug: 'wechat',    tries: ['simple-icons/wechat'] },
  { slug: 'wechatpay', tries: ['ri/wechat-pay-fill', 'simple-icons/wechatpay'] },
  { slug: 'tencentqq', tries: ['simple-icons/tencentqq', 'simple-icons/qq'] },
  { slug: 'taobao',    tries: ['simple-icons/taobao'] },
  { slug: 'pinduoduo', tries: ['arcticons/pinduoduo'] },
  { slug: 'jdcom',     tries: ['arcticons/jd-com'] },
  { slug: 'jdfinance', tries: ['arcticons/jd-finance'] },
  { slug: 'meituan',   tries: ['simple-icons/meituan'] },
  { slug: 'eleme',     tries: ['arcticons/ele-me'] },
  { slug: 'douyin',    tries: ['simple-icons/douyin', 'arcticons/douyin', 'simple-icons/tiktok'] },
  { slug: 'kuaishou',  tries: ['simple-icons/kuaishou'] },
  { slug: 'xiaohongshu', tries: ['simple-icons/xiaohongshu'] },
  { slug: 'baidu',     tries: ['simple-icons/baidu'] },
  { slug: 'neteasecloudmusic', tries: ['simple-icons/neteasecloudmusic'] },
  { slug: 'unionpay',  tries: ['logos/unionpay', 'arcticons/unionpay-app'] },
  { slug: 'huawei',    tries: ['simple-icons/huawei'] },
  { slug: 'xiaomi',    tries: ['simple-icons/xiaomi'] },
  { slug: 'applepay',  tries: ['simple-icons/applepay'] },
  { slug: 'apple',     tries: ['simple-icons/apple'] },
  { slug: 'microsoft', tries: ['simple-icons/microsoft'] },
  { slug: 'paypal',    tries: ['simple-icons/paypal'] },
  { slug: 'visa',      tries: ['simple-icons/visa'] },
  { slug: 'mastercard', tries: ['simple-icons/mastercard'] },
  { slug: 'stripe',    tries: ['simple-icons/stripe'] },
  { slug: 'starbucks', tries: ['simple-icons/starbucks'] },
  { slug: 'luckincoffee', tries: ['arcticons/luckin-coffee', 'simple-icons/luckincoffee'] },
  { slug: 'kfc',       tries: ['simple-icons/kfc'] },
  { slug: 'mcdonalds', tries: ['simple-icons/mcdonalds'] },
  { slug: 'steam',     tries: ['simple-icons/steam'] },
  { slug: 'icbc',      tries: ['arcticons/icbc'] },
  { slug: 'boc',       tries: ['arcticons/boc'] },
  { slug: 'agbank',    tries: ['arcticons/agricultural-bank-of-china'] },
  { slug: 'ccbank',    tries: ['arcticons/china-construction-bank'] },
  { slug: 'cmbank',    tries: ['arcticons/china-merchants-bank'] },
  { slug: 'didi',      tries: ['arcticons/didi'] },
  { slug: 'vipshop',   tries: ['arcticons/vipshop'] }
];

async function getIcon(path) {
  const r = await fetch('https://api.iconify.design/' + path + '.svg');
  if (!r.ok) return null;
  const t = await r.text();
  const vb = /viewBox="([^"]+)"/.exec(t);
  const inner = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(t);
  if (!vb || !inner) return null;
  const s = inner[1]
    .replace(/<title[\s\S]*?<\/title>/gi, '')
    .replace(/\sxmlns[^=]*="[^"]*"/g, '')
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || /<script/i.test(s)) return null;
  return { vb: vb[1], s };
}

const db = {};
const report = [];
for (const it of ICONS) {
  let got = null, used = null;
  for (const p of it.tries) {
    try { got = await getIcon(p); } catch (e) { got = null; }
    if (got) { used = p; break; }
  }
  if (got) {
    // 官方品牌色：simple-icons 来源查数据表，其余用手工色；logos 多色标不置色
    let c = '';
    if (used.startsWith('logos/')) c = '';
    else if (SI_TITLES[it.slug] && used.startsWith('simple-icons/')) {
      const found = SI_DATA.find(x => x.title === SI_TITLES[it.slug]);
      c = found ? found.hex : (MANUAL_COLORS[it.slug] || '');
    } else c = MANUAL_COLORS[it.slug] || '';
    db[it.slug] = { vb: got.vb, s: got.s, c: c };
    report.push(`OK   ${it.slug}  <- ${used}  vb=${got.vb}  #${c || '(multi)'}  ${got.s.length}B`);
  } else {
    report.push(`MISS ${it.slug}`);
  }
  await new Promise(r => setTimeout(r, 120));
}

let out = '/* ============================================================\n';
out += ' * brand-icons.js — 常用支付软件/平台/银行品牌图标（本地内置，离线可用）\n';
out += ' * SVG 数据采集自 Iconify 聚合图集：Simple Icons (CC0)、Remix Icon (Apache-2.0)、\n';
out += ' * Arcticons (GPL-3.0)、Logos (MIT) 等。mono 图标使用 currentColor，\n';
out += ' * 可由外部 color 控制颜色；多色图标（如银联）保留品牌原色。\n';
out += ' * 重新采集：node build-icons.mjs\n';
out += ' * ============================================================ */\n';
out += '(function (global) {\n  \'use strict\';\n';
out += '  global.BRAND_DB = {\n';
for (const slug of Object.keys(db)) {
  const { vb, s, c } = db[slug];
  out += '    ' + JSON.stringify(slug) + ': { vb: ' + JSON.stringify(vb) + ', s: ' + JSON.stringify(s) + ', c: ' + JSON.stringify(c) + ' },\n';
}
out += '  };\n})(window);\n';

writeFileSync(new URL('./js/brand-icons.js', import.meta.url), out);
console.log(report.join('\n'));
console.log('---');
console.log('written: js/brand-icons.js (' + Object.keys(db).length + ' icons)');
