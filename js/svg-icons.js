// svg-icons.js —— 全站用到的线性图标
// 统一放这儿，改图形只改这一处；页面里用 <span data-icon="nav-record"></span> 占位，
// 由 mount() 填上真正的 SVG（保持内联，currentColor 才能跟着主题变色）
(function (global) {
  'use strict';

  const ICONS = {
    // —— 侧栏 ——
    'nav-dashboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    'nav-names': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    'nav-tools': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
    'nav-accounts': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/><circle cx="16" cy="15" r="1"/></svg>',
    'nav-stats': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 20V10"/><path d="M12 20V4"/><path d="M18 20v-7"/></svg>',
    'nav-manage': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 21v-6"/><path d="M4 11V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-4"/><path d="M20 13V3"/><circle cx="4" cy="13" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="20" cy="15" r="2"/></svg>',
    'nav-settings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    'nav-about': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8" r="1"/></svg>',
    'lock': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    'menu': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>',

    // —— 通用操作 ——
    'pencil': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    'eye': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    'eye-off': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.9 18.1C16.4 19.3 14.3 20 12 20c-6.5 0-10-7-10-7 1-2 2.4-3.7 4-4.9"/><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3"/><path d="M3 3l18 18"/></svg>',
    'trash': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    'chevron-down': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
    'plus': '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    'plus-sm': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    'transfer': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px"><path d="M17 3l4 4-4 4"/><path d="M21 7H9"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h12"/></svg>',

    // —— 仪表盘 ——
    'arrow-up': '<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>',
    'arrow-down': '<svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>',
    'card-alert': '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',

    // —— 应用图标（尺寸和渐变各用一处不同，形状一样）——
    'logo-auth': '<svg viewBox="0 0 48 48" width="64" height="64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><rect width="48" height="48" rx="13" fill="url(#lg)"/><path d="M12 17a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="#fff"/><path d="M32 22h6v6h-6a3 3 0 0 1 0-6z" fill="#c7d2fe"/><circle cx="32.5" cy="25" r="1.4" fill="#4f46e5"/></svg>',
    'logo-side': '<svg viewBox="0 0 48 48" width="34" height="34"><defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs><rect width="48" height="48" rx="13" fill="url(#lg2)"/><path d="M12 17a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="#fff"/><path d="M32 22h6v6h-6a3 3 0 0 1 0-6z" fill="#c7d2fe"/><circle cx="32.5" cy="25" r="1.4" fill="#4f46e5"/></svg>',
    'logo-about': '<svg viewBox="0 0 48 48" width="72" height="72"><defs><linearGradient id="aboutlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><rect width="48" height="48" rx="13" fill="url(#aboutlg)"/><path d="M12 17a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="#fff"/><path d="M32 22h6v6h-6a3 3 0 0 1 0-6z" fill="#c7d2fe"/><circle cx="32.5" cy="25" r="1.4" fill="#4f46e5"/></svg>'
  };

  // 取一个图标；名字写错会拿到空串，方便一眼看出来
  function get(name) {
    return ICONS[name] || '';
  }

  // 把页面里的 data-icon 占位替换成真正的图形
  function mount(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-icon]').forEach((el) => {
      el.innerHTML = get(el.dataset.icon);
    });
  }

  global.SvgIcons = { get, mount };
})(window);
