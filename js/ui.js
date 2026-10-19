/* ============================================================
 * ui.js — 通用 UI：弹窗 / Toast / 下拉面板 / 侧栏
 * ============================================================ */
(function (global) {
  'use strict';

  var UI = {};

  /* ---------- Toast ---------- */
  var toastTimer = null;
  UI.toast = function (msg, type) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = type === 'err' ? 'toast-err' : (type === 'ok' ? 'toast-ok' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  };

  /* ---------- 模态弹窗 ---------- */
  UI.modal = function (opts) {
    var overlay = document.getElementById('modal-overlay');
    var modal = document.getElementById('modal');
    modal.innerHTML = '';

    var h = document.createElement('h3');
    h.textContent = opts.title || '';
    modal.appendChild(h);

    var body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    modal.appendChild(body);

    if (opts.buttons !== false) {
      var btns = document.createElement('div');
      btns.className = 'modal-btns';
      var cancel = document.createElement('button');
      cancel.className = 'btn-ghost';
      cancel.textContent = opts.cancelText || '取消';
      var ok = document.createElement('button');
      ok.className = 'btn-primary' + (opts.danger ? ' btn-danger-ok' : '');
      ok.textContent = opts.okText || '确定';
      ok.addEventListener('click', function () {
        if (opts.onOk && opts.onOk() === false) return; // 返回 false 阻止关闭
        UI.closeModal();
      });
      cancel.addEventListener('click', UI.closeModal);
      btns.appendChild(cancel);
      btns.appendChild(ok);
      modal.appendChild(btns);
    }

    overlay.hidden = false;
    modal.onclick = function (e) { e.stopPropagation(); };
    overlay.onclick = function () { if (opts.maskClose !== false) UI.closeModal(); };

    var firstInput = modal.querySelector('input, select, textarea');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 60);

    return body;
  };

  UI.closeModal = function () {
    document.getElementById('modal-overlay').hidden = true;
    document.getElementById('modal').innerHTML = '';
  };

  UI.confirm = function (title, msg, onOk, okText) {
    var body = document.createElement('div');
    body.style.cssText = 'color:var(--ink2);line-height:1.7;font-size:13.5px';
    body.textContent = msg;
    UI.modal({ title: title, body: body, okText: okText || '确定', danger: true, onOk: onOk });
  };

  /* ---------- 带选项面板的可编辑下拉 ----------
   * 单击：只弹出选项面板供选择（输入框保持只读，手机上不会弹出输入法）
   * 双击：解除只读并聚焦，可输入关键字过滤 / 自定义新值
   */
  // el: input 元素；options: [{v:显示值, label:附加显示}]；onPick: 选中回调
  UI.combo = function (el, options, onPick) {
    var panel = null, idx = -1;
    el.readOnly = true; // 默认只读：单击只能选择

    function close() {
      if (panel) { panel.remove(); panel = null; idx = -1; }
      document.removeEventListener('mousedown', onDoc, true);
    }
    function onDoc(e) { if (panel && !panel.contains(e.target) && e.target !== el) close(); }

    function render(filter) {
      var kw = (filter || '').trim().toLowerCase();
      var list = options().filter(function (o) {
        return !kw || o.v.toLowerCase().indexOf(kw) !== -1;
      });
      if (!list.length) { close(); return; }
      var rect = el.getBoundingClientRect();
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'combo-panel';
        document.body.appendChild(panel);
        document.addEventListener('mousedown', onDoc, true);
      }
      panel.innerHTML = '';
      list.forEach(function (o, i) {
        var item = document.createElement('div');
        item.className = 'combo-item';
        item.innerHTML = '<span>' + esc(o.v) + '</span>' +
          (o.label ? '<small>' + esc(o.label) + '</small>' : '');
        item.addEventListener('mousedown', function (e) {
          e.preventDefault();
          el.value = o.v;
          el.readOnly = true; // 选完恢复只读
          close();
          if (onPick) onPick(o.v);
        });
        panel.appendChild(item);
      });
      // 定位
      panel.style.left = rect.left + 'px';
      panel.style.width = rect.width + 'px';
      var ph = Math.min(list.length * 40 + 10, 240);
      var below = window.innerHeight - rect.bottom;
      if (below < ph + 8 && rect.top > ph + 8) {
        panel.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
        panel.style.top = 'auto';
      } else {
        panel.style.top = rect.bottom + 4 + 'px';
        panel.style.bottom = 'auto';
      }
    }

    el.addEventListener('focus', function () { idx = -1; render(el.value); });
    // mousedown 兜底：个别环境程序化 focus 不派发事件，真实点击一定触发
    el.addEventListener('mousedown', function () { idx = -1; render(el.value); });
    el.addEventListener('input', function () { idx = -1; render(el.value); });
    // 双击：解除只读，允许输入过滤/自定义（focus 不会重复触发，这里手动渲染）
    el.addEventListener('dblclick', function () {
      el.readOnly = false;
      el.focus();
      idx = -1;
      render(el.value);
    });
    el.addEventListener('keydown', function (e) {
      if (!panel) return;
      var items = panel.children;
      if (e.key === 'ArrowDown') { idx = Math.min(idx + 1, items.length - 1); paint(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = Math.max(idx - 1, 0); paint(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        if (idx >= 0 && items[idx]) { items[idx].dispatchEvent(new MouseEvent('mousedown')); }
        e.preventDefault();
      } else if (e.key === 'Escape') close();
    });
    function paint() {
      var items = panel ? panel.children : [];
      for (var i = 0; i < items.length; i++) items[i].classList.toggle('hover', i === idx);
    }
    el.addEventListener('blur', function () {
      setTimeout(function () { close(); el.readOnly = true; }, 120); // 失焦关闭并恢复只读
    });
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  UI.esc = esc;

  /* ---------- 日期工具 ---------- */
  UI.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  UI.today = function () {
    var t = new Date();
    return t.getFullYear() + '-' + UI.pad(t.getMonth() + 1) + '-' + UI.pad(t.getDate());
  };
  UI.nowStr = function () {
    var t = new Date();
    return UI.today() + ' ' + UI.pad(t.getHours()) + ':' + UI.pad(t.getMinutes());
  };
  // 解析 'YYYY-MM-DD HH:mm' / 'YYYY-MM-DD'
  UI.parseDate = function (s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  };

  UI.fmtMoney = function (n) {
    return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  global.UI = UI;
})(window);
