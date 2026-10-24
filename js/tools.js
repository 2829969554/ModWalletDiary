// tools.js —— 支付工具的维护
(function (global) {
  'use strict';

  // 工具类型排第一位（下拉与展示都以此为序）
  const TYPES = ['微信支付', '支付宝', '抖音支付', '云闪付', '翼支付', '支付平台', '借记卡', '银行卡', '信用卡', '花呗', '借呗', '现金', '自定义'];

  // 隐藏的工具不算重名，重新显示出来时还能撞上名字
  function toolTaken(name, list) {
    return list.some((q) => q.qname === name && !q.qhide);
  }

  // 工具表格，可见列表和已隐藏列表共用同一张
  function toolTable(list, isHidden, bills) {
    const rows = list.map(function (q) {
      const cnt = bills.filter((b) => b.wtool === q.qid).length;
      const renameBtn = `<button class="op-btn" title="编辑" data-act="rename" data-id="${q.qid}">${global.SvgIcons.get('pencil')}</button>`;
      const toggleBtn = isHidden
        ? `<button class="op-btn" title="恢复显示" data-act="restore" data-id="${q.qid}">${global.SvgIcons.get('eye')}</button>`
        : `<button class="op-btn del" title="隐藏" data-act="hide" data-id="${q.qid}">${global.SvgIcons.get('eye-off')}</button>`;

      return `<tr${isHidden ? ' class="hidden-row"' : ''}>
        <td class="num c-muted">${q.qid}</td>
        <td>${global.UI.esc(q.qtype || '其他')}</td>
        <td><span class="cell-flex"><span class="row-logo" data-tool="${global.UI.esc(q.qname)}"></span>${global.UI.esc(q.qname)}${q.qday ? `<small style="color:var(--muted)"> · 账单日 ${q.qday} 号</small>` : ''}</span></td>
        <td class="num">${q.qlast4 ? '尾号 ' + global.UI.esc(q.qlast4) : '-'}</td>
        <td class="num">${cnt} 笔</td>
        <td>${isHidden ? '<span class="c-muted">已隐藏</span>' : '<span style="color:var(--green)">显示中</span>'}</td>
        <td><div class="op-btns">${renameBtn}${toggleBtn}</div></td>
      </tr>`;
    });

    return `<thead><tr><th>序号</th><th>交易工具类型</th><th>工具名称</th><th>卡号</th><th>使用笔数</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.length ? rows.join('') : '<tr><td colspan="7" class="empty-tip">暂无</td></tr>'}</tbody>`;
  }

  function openAddToolModal(list) {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="field"><label>工具类型</label><select id="md-add-type">${TYPES.map((t) => `<option>${t}</option>`).join('')}</select></div>
      <div class="field" style="margin-bottom:0"><label>工具名称</label><input type="text" id="md-add-name" placeholder="例如：微信余额、招商银行信用卡…"></div>
    `;
    const sel = body.querySelector('#md-add-type');

    global.UI.modal({
      title: '新增支付工具',
      body: body,
      okText: '添加',
      onOk: function () {
        const v = body.querySelector('#md-add-name').value.trim();
        if (!v) { global.UI.toast('请输入工具名称', 'err'); return false; }
        if (toolTaken(v, list)) {
          global.UI.toast('该工具已存在', 'err'); return false;
        }
        global.DB.addGongju(v, sel.value);
        global.UI.toast('已添加「' + v + '」', 'ok');
        render();
      }
    });
  }

  function openEditToolModal(q) {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="field"><label>工具类型</label><select id="md-type">${TYPES.map((t) => `<option${t === q.qtype ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field" style="margin-bottom:0"><label>工具名称</label><input type="text" id="md-name" value="${global.UI.esc(q.qname)}"></div>
    `;
    const sel = body.querySelector('#md-type');

    global.UI.modal({
      title: '编辑支付工具 #' + q.qid,
      body: body,
      onOk: function () {
        const v = body.querySelector('#md-name').value.trim();
        if (!v) { global.UI.toast('名称不能为空', 'err'); return false; }
        global.DB.renameGongju(q.qid, v, sel.value);
        global.UI.toast('已更新', 'ok');
        render();
      }
    });
  }

  function render() {
    const el = document.getElementById('page-tools');
    const d = global.DB.get();

    const active = d.gongju.filter((q) => !q.qhide);
    const hidden = d.gongju.filter((q) => q.qhide);

    el.innerHTML = `
      <div class="card tl-add-card">
        <div class="card-title"><span class="bar"></span>新增支付工具</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <select id="tl-type" class="search-input" style="width:140px">${TYPES.map((t) => `<option>${t}</option>`).join('')}</select>
          <input type="text" id="tl-input" class="search-input" style="flex:1;min-width:160px" placeholder="工具名称，如：微信余额、招商银行信用卡…（回车快速添加）">
          <button id="tl-add" class="btn-primary">添加</button>
        </div>
        <p style="color:var(--muted);font-size:11.5px;margin-top:8px">序号 qid 只正向增加，不复用。常见支付工具自动匹配 LOGO，自定义显示随机颜色图标。</p>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>工具列表 <small style="font-weight:400;color:var(--muted)">共 ${active.length} 个</small></div>
        <div class="table-wrap"><table class="tbl" id="tl-table"></table></div>
      </div>

      <button id="tl-fab" class="tl-fab" title="新增支付工具" aria-label="新增支付工具">${global.SvgIcons.get('plus')}</button>
    `;

    if (hidden.length) {
      el.insertAdjacentHTML('beforeend', `
        <div class="card">
          <div class="card-title"><span class="bar" style="background:var(--muted)"></span>已隐藏工具 <small style="font-weight:400;color:var(--muted)">${hidden.length} 个</small></div>
          <div class="table-wrap"><table class="tbl" id="tl-table-hidden"></table></div>
        </div>
      `);
    }

    const typeSel = el.querySelector('#tl-type');

    const add = () => {
      const v = el.querySelector('#tl-input').value.trim();
      if (!v) { global.UI.toast('请输入工具名称', 'err'); return; }
      if (toolTaken(v, d.gongju)) {
        global.UI.toast('该工具已存在', 'err'); return;
      }
      global.DB.addGongju(v, typeSel.value);
      global.UI.toast('已添加「' + v + '」', 'ok');
      render();
    };
    el.querySelector('#tl-add').addEventListener('click', add);
    el.querySelector('#tl-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    el.querySelector('#tl-fab').addEventListener('click', () => openAddToolModal(d.gongju));

    el.querySelector('#tl-table').innerHTML = toolTable(active, false, d.walletdiary);
    const hiddenTable = el.querySelector('#tl-table-hidden');
    if (hiddenTable) hiddenTable.innerHTML = toolTable(hidden, true, d.walletdiary);

    el.querySelectorAll('.row-logo').forEach((l) => global.Icons.fillLogo(l, l.dataset.tool));

    // 行内操作分派，data-act 对应下面的 key
    const actions = {
      rename: (q) => openEditToolModal(q),
      hide: (q) => {
        global.UI.confirm('隐藏支付工具', '隐藏「' + q.qname + '」？隐藏后不再出现在选择列表，但历史账单不受影响。', function () {
          global.DB.hideGongju(q.qid, true);
          global.UI.toast('已隐藏', 'ok');
          render();
        }, '隐藏');
      },
      restore: (q) => {
        global.DB.hideGongju(q.qid, false);
        global.UI.toast('已恢复显示', 'ok');
        render();
      }
    };

    el.querySelectorAll('button[data-act]').forEach((btn) => {
      const id = +btn.dataset.id;
      btn.addEventListener('click', () => {
        const q = d.gongju.find((x) => x.qid === id);
        if (!q) return;
        const fn = actions[btn.dataset.act];
        if (fn) fn(q);
      });
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.tools = { render: render };
})(window);
