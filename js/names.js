// names.js —— 款项名目的新增、重命名与隐藏
(function (global) {
  'use strict';

  // 隐藏的名目不算重名，重新显示出来时还能撞上名字
  function nameTaken(name, list) {
    return list.some((m) => m.mname === name && !m.mhide);
  }

  // 名目表格，可见列表和已隐藏列表共用同一张
  function nameTable(list, isHidden, bills) {
    const rows = list.map(function (m) {
      const cnt = bills.filter((b) => b.wname === m.mid).length;
      const renameBtn = `<button class="op-btn" title="重命名" data-act="rename" data-id="${m.mid}">${global.SvgIcons.get('pencil')}</button>`;
      const toggleBtn = isHidden
        ? `<button class="op-btn" title="恢复显示" data-act="restore" data-id="${m.mid}">${global.SvgIcons.get('eye')}</button>`
        : `<button class="op-btn del" title="隐藏" data-act="hide" data-id="${m.mid}">${global.SvgIcons.get('eye-off')}</button>`;

      return `<tr${isHidden ? ' class="hidden-row"' : ''}>
        <td class="num c-muted">${m.mid}</td>
        <td><span class="cell-flex nm-link" data-view="${m.mid}" title="查看该名目的记账记录"><span class="row-logo" data-nm="${global.UI.esc(m.mname)}"></span>${global.UI.esc(m.mname)}</span></td>
        <td class="num nm-link" data-view="${m.mid}" title="查看该名目的记账记录">${cnt} 笔</td>
        <td>${isHidden ? '<span class="c-muted">已隐藏</span>' : '<span style="color:var(--green)">显示中</span>'}</td>
        <td><div class="op-btns">${renameBtn}${toggleBtn}</div></td>
      </tr>`;
    });

    return `<thead><tr><th>序号 mid</th><th>名目名称</th><th>使用笔数</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.length ? rows.join('') : '<tr><td colspan="5" class="empty-tip">暂无</td></tr>'}</tbody>`;
  }

  // 弹窗内容：合计条 + 记录列表
  function recordsHtml(list) {
    let sumOut = 0, sumIn = 0;
    list.forEach(function (b) {
      if (b.wtype === 1) sumIn += Number(b.wamount) || 0;
      else sumOut += Number(b.wamount) || 0;
    });

    let html = `
      <div class="nm-sum">
        <span>共 <b>${list.length}</b> 笔</span>
        <span>支出 <b class="c-red">¥${global.UI.fmtMoney(sumOut)}</b></span>
        <span>收入 <b class="c-green">¥${global.UI.fmtMoney(sumIn)}</b></span>
      </div>
    `;

    if (!list.length) {
      html += '<div class="empty-tip">该名目暂无记账记录</div>';
    } else {
      html += '<div class="nm-rec-list">' + list.map(function (b) {
        const isIn = b.wtype === 1;
        const sub = [global.DB.gongjuName(b.wtool)];
        if (b.wpayname) sub.push(b.wpayname);
        if (b.wnote) sub.push(b.wnote);
        return `<div class="nm-rec">
          <div class="nm-rec-l"><b>${global.UI.esc(b.wtime || '')}</b><span class="nm-rec-t ${isIn ? 'in' : 'out'}">${isIn ? '收入' : '支出'}</span></div>
          <div class="nm-rec-r ${isIn ? 'in' : 'out'}">${isIn ? '+' : '-'}${global.UI.fmtMoney(b.wamount)}</div>
          <div class="nm-rec-sub">${global.UI.esc(sub.join(' · '))}</div>
        </div>`;
      }).join('') + '</div>';
    }
    html += '<button class="btn-ghost nm-close">关闭</button>';
    return html;
  }

  function openRecords(m, bills) {
    const list = bills.filter((b) => b.wname === m.mid)
      .sort((a, b) => (b.wtime || '').localeCompare(a.wtime || ''));

    const body = document.createElement('div');
    body.innerHTML = recordsHtml(list);

    global.UI.modal({
      title: '「' + m.mname + '」的记账记录',
      body: body,
      buttons: false,
      maskClose: true
    });
    // 记录弹窗：整窗固定，仅中间列表滚动（数据再多也可一直下滑）
    document.getElementById('modal').classList.add('modal-list');
    body.querySelector('.nm-close').addEventListener('click', () => global.UI.closeModal());
  }

  function openRenameModal(m) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = m.mname;
    input.className = 'search-input';
    input.style.cssText = 'width:100%';
    global.UI.modal({
      title: '重命名名目 #' + m.mid,
      body: input,
      onOk: function () {
        const v = input.value.trim();
        if (!v) { global.UI.toast('名称不能为空', 'err'); return false; }
        global.DB.renameMingmu(m.mid, v);
        global.UI.toast('已重命名', 'ok');
        render();
      }
    });
  }

  function render() {
    const el = document.getElementById('page-names');
    const d = global.DB.get();

    const active = d.mingmu.filter((m) => !m.mhide);
    const hidden = d.mingmu.filter((m) => m.mhide);

    el.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="bar"></span>新增款项名目</div>
        <div style="display:flex;gap:10px">
          <input type="text" id="nm-input" class="search-input" style="flex:1" placeholder="例如：电话费、电费、吃饭、小零食…（回车快速添加）">
          <button id="nm-add" class="btn-primary">添加</button>
        </div>
        <p style="color:var(--muted);font-size:11.5px;margin-top:8px">序号 mid 只会正向增加，不会因删除（隐藏）而复用，防止数据错乱。</p>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>名目列表 <small style="font-weight:400;color:var(--muted)">共 ${active.length} 个</small></div>
        <div class="table-wrap"><table class="tbl" id="nm-table"></table></div>
      </div>
    `;

    if (hidden.length) {
      el.insertAdjacentHTML('beforeend', `
        <div class="card">
          <div class="card-title"><span class="bar" style="background:var(--muted)"></span>已隐藏名目 <small style="font-weight:400;color:var(--muted)">${hidden.length} 个</small></div>
          <div class="table-wrap"><table class="tbl" id="nm-table-hidden"></table></div>
        </div>
      `);
    }

    const add = () => {
      const v = el.querySelector('#nm-input').value.trim();
      if (!v) { global.UI.toast('请输入名目名称', 'err'); return; }
      if (nameTaken(v, d.mingmu)) {
        global.UI.toast('该名目已存在', 'err'); return;
      }
      global.DB.addMingmu(v);
      global.UI.toast('已添加「' + v + '」，编号 ' + (global.DB.nextMid() - 1), 'ok');
      render();
    };
    el.querySelector('#nm-add').addEventListener('click', add);
    el.querySelector('#nm-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

    el.querySelector('#nm-table').innerHTML = nameTable(active, false, d.walletdiary);
    const hiddenTable = el.querySelector('#nm-table-hidden');
    if (hiddenTable) hiddenTable.innerHTML = nameTable(hidden, true, d.walletdiary);

    el.querySelectorAll('.row-logo').forEach((l) => global.Icons.fillLogo(l, l.dataset.nm));

    // 点名目名称或者笔数都能看这个名目的记账记录
    el.querySelectorAll('.nm-link').forEach((n) => {
      n.addEventListener('click', () => {
        const m = d.mingmu.find((x) => x.mid === +n.dataset.view);
        if (m) openRecords(m, d.walletdiary);
      });
    });

    // 行内操作分派，data-act 对应下面的 key
    const actions = {
      rename: (m) => openRenameModal(m),
      hide: (m) => {
        global.UI.confirm('隐藏名目', '隐藏「' + m.mname + '」？隐藏后不再出现在选择列表，但历史账单不受影响。', function () {
          global.DB.hideMingmu(m.mid, true);
          global.UI.toast('已隐藏', 'ok');
          render();
        }, '隐藏');
      },
      restore: (m) => {
        global.DB.hideMingmu(m.mid, false);
        global.UI.toast('已恢复显示', 'ok');
        render();
      }
    };

    el.querySelectorAll('button[data-act]').forEach((btn) => {
      const id = +btn.dataset.id;
      btn.addEventListener('click', () => {
        const m = d.mingmu.find((x) => x.mid === id);
        if (!m) return;
        const fn = actions[btn.dataset.act];
        if (fn) fn(m);
      });
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.names = { render: render };
})(window);
