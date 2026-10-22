/* ============================================================
 * names.js — 款项名目管理：增加 / 重命名 / 隐藏(删除)
 * 序号 mid 只正向增加，不能减少
 * ============================================================ */
(function (global) {
  'use strict';

  function render() {
    var el = document.getElementById('page-names');
    var d = global.DB.get();

    var active = d.mingmu.filter(function (m) { return !m.mhide; });
    var hidden = d.mingmu.filter(function (m) { return m.mhide; });

    el.innerHTML =
      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>新增款项名目</div>' +
        '<div style="display:flex;gap:10px">' +
          '<input type="text" id="nm-input" class="search-input" style="flex:1" placeholder="例如：电话费、电费、吃饭、小零食…（回车快速添加）">' +
          '<button id="nm-add" class="btn-primary">添加</button>' +
        '</div>' +
        '<p style="color:var(--muted);font-size:11.5px;margin-top:8px">序号 mid 只会正向增加，不会因删除（隐藏）而复用，防止数据错乱。</p>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>名目列表 <small style="font-weight:400;color:var(--muted)">共 ' + active.length + ' 个</small></div>' +
        '<div class="table-wrap"><table class="tbl" id="nm-table"></table></div>' +
      '</div>';

    if (hidden.length) {
      el.insertAdjacentHTML('beforeend',
        '<div class="card">' +
          '<div class="card-title"><span class="bar" style="background:var(--muted)"></span>已隐藏名目 <small style="font-weight:400;color:var(--muted)">' + hidden.length + ' 个</small></div>' +
          '<div class="table-wrap"><table class="tbl" id="nm-table-hidden"></table></div>' +
        '</div>');
    }

    function add() {
      var input = el.querySelector('#nm-input');
      var v = input.value.trim();
      if (!v) { global.UI.toast('请输入名目名称', 'err'); return; }
      if (d.mingmu.some(function (m) { return m.mname === v && !m.mhide; })) {
        global.UI.toast('该名目已存在', 'err'); return;
      }
      global.DB.addMingmu(v);
      global.UI.toast('已添加「' + v + '」，编号 ' + global.DB.nextMid() - 1, 'ok');
      render();
    }
    el.querySelector('#nm-add').addEventListener('click', add);
    el.querySelector('#nm-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });

    function tblHtml(list, isHidden) {
      var html = '<thead><tr><th>序号 mid</th><th>名目名称</th><th>使用笔数</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      if (!list.length) html += '<tr><td colspan="5" class="empty-tip">暂无</td></tr>';
      list.forEach(function (m) {
        var cnt = d.walletdiary.filter(function (b) { return b.wname === m.mid; }).length;
        html += '<tr' + (isHidden ? ' class="hidden-row"' : '') + '>' +
          '<td class="num c-muted">' + m.mid + '</td>' +
          '<td><span class="cell-flex nm-link" data-view="' + m.mid + '" title="查看该名目的记账记录"><span class="row-logo" data-nm="' + global.UI.esc(m.mname) + '"></span>' + global.UI.esc(m.mname) + '</span></td>' +
          '<td class="num nm-link" data-view="' + m.mid + '" title="查看该名目的记账记录">' + cnt + ' 笔</td>' +
          '<td>' + (isHidden ? '<span class="c-muted">已隐藏</span>' : '<span style="color:var(--green)">显示中</span>') + '</td>' +
          '<td><div class="op-btns">' +
            '<button class="op-btn" title="重命名" data-act="rename" data-id="' + m.mid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>' +
            (isHidden
              ? '<button class="op-btn" title="恢复显示" data-act="restore" data-id="' + m.mid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>'
              : '<button class="op-btn del" title="隐藏" data-act="hide" data-id="' + m.mid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.9 18.1C16.4 19.3 14.3 20 12 20c-6.5 0-10-7-10-7 1-2 2.4-3.7 4-4.9"/><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3"/><path d="M3 3l18 18"/></svg></button>') +
          '</div></td></tr>';
      });
      html += '</tbody>';
      return html;
    }

    /* 点击名目：弹窗显示该名目全部记账记录（按记账时间从近到远） */
    function openRecords(m) {
      var list = d.walletdiary.filter(function (b) { return b.wname === m.mid; })
        .sort(function (a, b) { return (b.wtime || '').localeCompare(a.wtime || ''); });
      var sumOut = 0, sumIn = 0;
      list.forEach(function (b) {
        if (b.wtype === 1) sumIn += Number(b.wamount) || 0;
        else sumOut += Number(b.wamount) || 0;
      });

      var body = document.createElement('div');
      var html =
        '<div class="nm-sum">' +
          '<span>共 <b>' + list.length + '</b> 笔</span>' +
          '<span>支出 <b class="c-red">¥' + global.UI.fmtMoney(sumOut) + '</b></span>' +
          '<span>收入 <b class="c-green">¥' + global.UI.fmtMoney(sumIn) + '</b></span>' +
        '</div>';
      if (!list.length) {
        html += '<div class="empty-tip">该名目暂无记账记录</div>';
      } else {
        html += '<div class="nm-rec-list">' + list.map(function (b) {
          var isIn = b.wtype === 1;
          var sub = [];
          sub.push(global.DB.gongjuName(b.wtool));
          if (b.wpayname) sub.push(b.wpayname);
          if (b.wnote) sub.push(b.wnote);
          return '<div class="nm-rec">' +
            '<div class="nm-rec-l"><b>' + global.UI.esc(b.wtime || '') + '</b>' +
              '<span class="nm-rec-t ' + (isIn ? 'in' : 'out') + '">' + (isIn ? '收入' : '支出') + '</span></div>' +
            '<div class="nm-rec-r ' + (isIn ? 'in' : 'out') + '">' + (isIn ? '+' : '-') + global.UI.fmtMoney(b.wamount) + '</div>' +
            '<div class="nm-rec-sub">' + global.UI.esc(sub.join(' · ')) + '</div>' +
          '</div>';
        }).join('') + '</div>';
      }
      html += '<button class="btn-ghost nm-close">关闭</button>';
      body.innerHTML = html;

      global.UI.modal({
        title: '「' + m.mname + '」的记账记录',
        body: body,
        buttons: false,
        maskClose: true
      });
      // 记录弹窗：整窗固定，仅中间列表滚动（数据再多也可一直下滑）
      document.getElementById('modal').classList.add('modal-list');
      body.querySelector('.nm-close').addEventListener('click', function () { global.UI.closeModal(); });
    }

    var t1 = el.querySelector('#nm-table');
    t1.innerHTML = tblHtml(active, false);
    var t2 = el.querySelector('#nm-table-hidden');
    if (t2) t2.innerHTML = tblHtml(hidden, true);

    el.querySelectorAll('.row-logo').forEach(function (l) { global.Icons.fillLogo(l, l.dataset.nm); });

    /* 点击名目名称 / 笔数 → 查看该名目的记账记录 */
    el.querySelectorAll('.nm-link').forEach(function (n) {
      n.addEventListener('click', function () {
        var m = d.mingmu.find(function (x) { return x.mid === +n.dataset.view; });
        if (m) openRecords(m);
      });
    });

    el.querySelectorAll('button[data-act]').forEach(function (btn) {
      var id = +btn.dataset.id;
      btn.addEventListener('click', function () {
        var act = btn.dataset.act;
        var m = d.mingmu.find(function (x) { return x.mid === id; });
        if (!m) return;
        if (act === 'rename') {
          var input = document.createElement('input');
          input.type = 'text'; input.value = m.mname;
          input.className = 'search-input'; input.style.cssText = 'width:100%';
          UI.modal({
            title: '重命名名目 #' + m.mid,
            body: input,
            onOk: function () {
              var v = input.value.trim();
              if (!v) { global.UI.toast('名称不能为空', 'err'); return false; }
              global.DB.renameMingmu(m.mid, v);
              global.UI.toast('已重命名', 'ok');
              render();
            }
          });
        } else if (act === 'hide') {
          global.UI.confirm('隐藏名目', '隐藏「' + m.mname + '」？隐藏后不再出现在选择列表，但历史账单不受影响。', function () {
            global.DB.hideMingmu(m.mid, true);
            global.UI.toast('已隐藏', 'ok');
            render();
          }, '隐藏');
        } else if (act === 'restore') {
          global.DB.hideMingmu(m.mid, false);
          global.UI.toast('已恢复显示', 'ok');
          render();
        }
      });
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.names = { render: render };
})(window);
