/* ============================================================
 * tools.js — 支付工具管理：增加 / 重命名 / 隐藏(删除)
 * 序号 qid 只正向增加；工具类型排第一位
 * ============================================================ */
(function (global) {
  'use strict';

  // 工具类型排第一位（下拉与展示都以此为序）
  var TYPES = ['微信支付', '支付宝', '抖音支付', '云闪付', '翼支付', '支付平台', '借记卡', '银行卡', '信用卡', '花呗', '借呗', '现金', '自定义'];

  function render() {
    var el = document.getElementById('page-tools');
    var d = global.DB.get();

    var active = d.gongju.filter(function (q) { return !q.qhide; });
    var hidden = d.gongju.filter(function (q) { return q.qhide; });

    el.innerHTML =
      '<div class="card tl-add-card">' +
        '<div class="card-title"><span class="bar"></span>新增支付工具</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<select id="tl-type" class="search-input" style="width:140px">' +
            TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') +
          '</select>' +
          '<input type="text" id="tl-input" class="search-input" style="flex:1;min-width:160px" placeholder="工具名称，如：微信余额、招商银行信用卡…（回车快速添加）">' +
          '<button id="tl-add" class="btn-primary">添加</button>' +
        '</div>' +
        '<p style="color:var(--muted);font-size:11.5px;margin-top:8px">序号 qid 只正向增加，不复用。常见支付工具自动匹配 LOGO，自定义显示随机颜色图标。</p>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>工具列表 <small style="font-weight:400;color:var(--muted)">共 ' + active.length + ' 个</small></div>' +
        '<div class="table-wrap"><table class="tbl" id="tl-table"></table></div>' +
      '</div>' +

      '<button id="tl-fab" class="tl-fab" title="新增支付工具" aria-label="新增支付工具">' +
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' +
      '</button>';

    if (hidden.length) {
      el.insertAdjacentHTML('beforeend',
        '<div class="card">' +
          '<div class="card-title"><span class="bar" style="background:var(--muted)"></span>已隐藏工具 <small style="font-weight:400;color:var(--muted)">' + hidden.length + ' 个</small></div>' +
          '<div class="table-wrap"><table class="tbl" id="tl-table-hidden"></table></div>' +
        '</div>');
    }

    function openAddModal() {
      var body = document.createElement('div');
      body.innerHTML =
        '<div class="field"><label>工具类型</label><select id="md-add-type">' +
          TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field" style="margin-bottom:0"><label>工具名称</label><input type="text" id="md-add-name" placeholder="例如：微信余额、招商银行信用卡…"></div>';
      var sel = body.querySelector('#md-add-type');

      global.UI.modal({
        title: '新增支付工具',
        body: body,
        okText: '添加',
        onOk: function () {
          var v = body.querySelector('#md-add-name').value.trim();
          if (!v) { global.UI.toast('请输入工具名称', 'err'); return false; }
          if (d.gongju.some(function (q) { return q.qname === v && !q.qhide; })) {
            global.UI.toast('该工具已存在', 'err'); return false;
          }
          global.DB.addGongju(v, sel.value);
          global.UI.toast('已添加「' + v + '」', 'ok');
          render();
        }
      });
    }

    var typeSel = el.querySelector('#tl-type');

    function add() {
      var v = el.querySelector('#tl-input').value.trim();
      if (!v) { global.UI.toast('请输入工具名称', 'err'); return; }
      if (d.gongju.some(function (q) { return q.qname === v && !q.qhide; })) {
        global.UI.toast('该工具已存在', 'err'); return;
      }
      global.DB.addGongju(v, typeSel.value);
      global.UI.toast('已添加「' + v + '」', 'ok');
      render();
    }
    el.querySelector('#tl-add').addEventListener('click', add);
    el.querySelector('#tl-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    el.querySelector('#tl-fab').addEventListener('click', openAddModal);

    function tblHtml(list, isHidden) {
      var html = '<thead><tr><th>序号</th><th>交易工具类型</th><th>工具名称</th><th>卡号</th><th>使用笔数</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      if (!list.length) html += '<tr><td colspan="7" class="empty-tip">暂无</td></tr>';
      list.forEach(function (q) {
        var cnt = d.walletdiary.filter(function (b) { return b.wtool === q.qid; }).length;
        html += '<tr' + (isHidden ? ' class="hidden-row"' : '') + '>' +
          '<td class="num c-muted">' + q.qid + '</td>' +
          '<td>' + global.UI.esc(q.qtype || '其他') + '</td>' +
          '<td><span class="cell-flex"><span class="row-logo" data-tool="' + global.UI.esc(q.qname) + '"></span>' + global.UI.esc(q.qname) +
            (q.qday ? '<small style="color:var(--muted)"> · 账单日 ' + q.qday + ' 号</small>' : '') + '</span></td>' +
          '<td class="num">' + (q.qlast4 ? '尾号 ' + global.UI.esc(q.qlast4) : '-') + '</td>' +
          '<td class="num">' + cnt + ' 笔</td>' +
          '<td>' + (isHidden ? '<span class="c-muted">已隐藏</span>' : '<span style="color:var(--green)">显示中</span>') + '</td>' +
          '<td><div class="op-btns">' +
            '<button class="op-btn" title="编辑" data-act="rename" data-id="' + q.qid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>' +
            (isHidden
              ? '<button class="op-btn" title="恢复显示" data-act="restore" data-id="' + q.qid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>'
              : '<button class="op-btn del" title="隐藏" data-act="hide" data-id="' + q.qid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.9 18.1C16.4 19.3 14.3 20 12 20c-6.5 0-10-7-10-7 1-2 2.4-3.7 4-4.9"/><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3"/><path d="M3 3l18 18"/></svg></button>') +
          '</div></td></tr>';
      });
      html += '</tbody>';
      return html;
    }

    el.querySelector('#tl-table').innerHTML = tblHtml(active, false);
    var t2 = el.querySelector('#tl-table-hidden');
    if (t2) t2.innerHTML = tblHtml(hidden, true);

    el.querySelectorAll('.row-logo').forEach(function (l) { global.Icons.fillLogo(l, l.dataset.tool); });

    el.querySelectorAll('button[data-act]').forEach(function (btn) {
      var id = +btn.dataset.id;
      btn.addEventListener('click', function () {
        var act = btn.dataset.act;
        var q = d.gongju.find(function (x) { return x.qid === id; });
        if (!q) return;
        if (act === 'rename') {
          var body = document.createElement('div');
          body.innerHTML =
            '<div class="field"><label>工具类型</label><select id="md-type">' +
            TYPES.map(function (t) { return '<option' + (t === q.qtype ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field" style="margin-bottom:0"><label>工具名称</label><input type="text" id="md-name" value="' + global.UI.esc(q.qname) + '"></div>';
          var sel = body.querySelector('#md-type');

          UI.modal({
            title: '编辑支付工具 #' + q.qid,
            body: body,
            onOk: function () {
              var v = body.querySelector('#md-name').value.trim();
              if (!v) { global.UI.toast('名称不能为空', 'err'); return false; }
              global.DB.renameGongju(q.qid, v, sel.value);
              global.UI.toast('已更新', 'ok');
              render();
            }
          });
        } else if (act === 'hide') {
          global.UI.confirm('隐藏支付工具', '隐藏「' + q.qname + '」？隐藏后不再出现在选择列表，但历史账单不受影响。', function () {
            global.DB.hideGongju(q.qid, true);
            global.UI.toast('已隐藏', 'ok');
            render();
          }, '隐藏');
        } else if (act === 'restore') {
          global.DB.hideGongju(q.qid, false);
          global.UI.toast('已恢复显示', 'ok');
          render();
        }
      });
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.tools = { render: render };
})(window);
