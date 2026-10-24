// ui.js —— 弹窗、Toast、下拉面板这些通用界面
(function (global) {
  'use strict';

  const UI = {};

  UI.applyTheme = function (mode) {
    let m = mode || 'auto';
    // auto 模式：7:00-18:00 当白天用浅色，其余时间深色
    if (m !== 'light' && m !== 'dark') {
      const hour = new Date().getHours();
      m = (hour >= 18 || hour < 7) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', m);
  };

  let toastTimer = null;

  UI.toast = function (msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = type === 'err' ? 'toast-err' : (type === 'ok' ? 'toast-ok' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  };

  UI.closeModal = function () {
    document.getElementById('modal-mask').hidden = true;
    const modal = document.getElementById('modal');
    modal.innerHTML = '';
    modal.className = '';
  };

  // opts: title 标题 / body 内容（字符串或节点）/ buttons 是否带按钮 /
  //       cancelText、okText 按钮文案 / danger 危险样式 /
  //       onOk 点确定的回调（返回 false 不关闭）/ maskClose 点遮罩是否关闭
  // 返回内容区容器，调用方往里塞输入框用
  UI.modal = function (opts) {
    const overlay = document.getElementById('modal-mask');
    const modal = document.getElementById('modal');
    modal.innerHTML = '';
    modal.className = ''; // 上一次可能留了 modal-list 之类的修饰类

    const h = document.createElement('h3');
    h.textContent = opts.title || '';
    modal.appendChild(h);

    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    modal.appendChild(body);

    if (opts.buttons !== false) {
      const btns = document.createElement('div');
      btns.className = 'modal-btns';

      const cancel = document.createElement('button');
      cancel.className = 'btn-ghost';
      cancel.textContent = opts.cancelText || '取消';
      cancel.addEventListener('click', UI.closeModal);

      const ok = document.createElement('button');
      ok.className = 'btn-primary' + (opts.danger ? ' btn-danger-ok' : '');
      ok.textContent = opts.okText || '确定';
      ok.addEventListener('click', () => {
        if (opts.onOk && opts.onOk() === false) return; // 返回 false 说明校验没过，弹窗留着
        UI.closeModal();
      });

      btns.appendChild(cancel);
      btns.appendChild(ok);
      modal.appendChild(btns);
    }

    overlay.hidden = false;
    // 点弹窗本身不关，点遮罩才关（maskClose 为 false 时连遮罩也不关）
    modal.onclick = (e) => { e.stopPropagation(); };
    overlay.onclick = () => { if (opts.maskClose !== false) UI.closeModal(); };

    const firstInput = modal.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => { firstInput.focus(); }, 60);

    return body;
  };

  UI.confirm = function (title, msg, onOk, okText) {
    const body = document.createElement('div');
    body.style.cssText = 'color:var(--ink2);line-height:1.7;font-size:13.5px';
    body.textContent = msg;
    UI.modal({ title, body, okText: okText || '确定', danger: true, onOk });
  };

  // 可编辑下拉：单击只弹选项面板，默认只读，手机上不会弹出输入法；
  // 双击才解锁，可以打字过滤，也能自己填一个库里没有的值。
  // options 取选项的函数，返回 [{v: 显示值, label: 附加显示}]
  UI.combo = function (el, options, onPick) {
    let panel = null;
    let idx = -1;
    el.readOnly = true;

    function close() {
      if (panel) { panel.remove(); panel = null; idx = -1; }
      document.removeEventListener('mousedown', onDoc, true);
    }

    function onDoc(e) {
      if (panel && !panel.contains(e.target) && e.target !== el) close();
    }

    function paint() {
      const items = panel ? panel.children : [];
      for (let i = 0; i < items.length; i++) items[i].classList.toggle('hover', i === idx);
    }

    function render(filter) {
      const kw = (filter || '').trim().toLowerCase();
      let list = options();
      if (kw) list = list.filter((o) => o.v.toLowerCase().indexOf(kw) !== -1);
      if (!list.length) { close(); return; }

      const rect = el.getBoundingClientRect();
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'combo-panel';
        document.body.appendChild(panel);
        document.addEventListener('mousedown', onDoc, true);
      }

      panel.innerHTML = '';
      list.forEach((o) => {
        const item = document.createElement('div');
        item.className = 'combo-item';
        item.innerHTML = `<span>${esc(o.v)}</span>${o.label ? `<small>${esc(o.label)}</small>` : ''}`;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          el.value = o.v;
          el.readOnly = true; // 选完回到只读
          close();
          if (onPick) onPick(o.v);
        });
        panel.appendChild(item);
      });

      // 贴着输入框放，下面空间不够就翻到上面
      panel.style.left = rect.left + 'px';
      panel.style.width = rect.width + 'px';
      const ph = Math.min(list.length * 40 + 10, 240);
      const below = window.innerHeight - rect.bottom;
      if (below < ph + 8 && rect.top > ph + 8) {
        panel.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
        panel.style.top = 'auto';
      } else {
        panel.style.top = rect.bottom + 4 + 'px';
        panel.style.bottom = 'auto';
      }
    }

    el.addEventListener('focus', () => { idx = -1; render(el.value); });
    // 兜底：个别环境程序化 focus 不派发事件，真实点击倒是一定会触发
    el.addEventListener('mousedown', () => { idx = -1; render(el.value); });
    el.addEventListener('input', () => { idx = -1; render(el.value); });
    el.addEventListener('dblclick', () => {
      el.readOnly = false;
      el.focus();
      idx = -1;
      render(el.value); // focus 这会儿不会再触发一次，面板得自己开
    });
    el.addEventListener('keydown', (e) => {
      if (!panel) return;
      const items = panel.children;
      if (e.key === 'ArrowDown') { idx = Math.min(idx + 1, items.length - 1); paint(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = Math.max(idx - 1, 0); paint(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        if (idx >= 0 && items[idx]) items[idx].dispatchEvent(new MouseEvent('mousedown'));
        e.preventDefault();
      } else if (e.key === 'Escape') close();
    });
    // 延时再关，不然刚点完选项就被当成失焦收掉了
    el.addEventListener('blur', () => {
      setTimeout(() => { close(); el.readOnly = true; }, 120);
    });
  };

  // 名目、备注这些是用户自己填的，插进 HTML 前必须转义
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
  UI.esc = esc;

  UI.pad = (n) => (n < 10 ? '0' : '') + n;

  UI.today = function () {
    const t = new Date();
    return `${t.getFullYear()}-${UI.pad(t.getMonth() + 1)}-${UI.pad(t.getDate())}`;
  };

  UI.nowStr = function () {
    const t = new Date();
    return `${UI.today()} ${UI.pad(t.getHours())}:${UI.pad(t.getMinutes())}`;
  };

  // 只取到日期，后面的时间部分忽略；格式不对返回 null
  UI.parseDate = function (s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  };

  UI.fmtMoney = (n) => Number(n || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  global.UI = UI;
})(window);
