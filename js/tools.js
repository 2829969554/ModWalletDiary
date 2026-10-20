/* ============================================================
 * tools.js — 支付工具管理：增加 / 重命名 / 隐藏(删除)
 * 序号 qid 只正向增加；工具类型排第一位；
 * 银行卡/借记卡/信用卡 需填卡号后四位；信用卡/花呗/借呗 需填账单日
 * 账单日临近一周黄色横幅、临近3天红色横幅（仪表盘顶部）
 * ============================================================ */
(function (global) {
  'use strict';

  // 工具类型排第一位（下拉与展示都以此为序）
  var TYPES = ['微信支付', '支付宝', '抖音支付', '云闪付', '翼支付', '支付平台', '借记卡', '银行卡', '信用卡', '花呗', '借呗', '现金', '自定义'];
  var CREDIT_TYPES = ['信用卡', '花呗', '借呗'];      // 需账单日
  var CARD_TYPES = ['银行卡', '借记卡', '信用卡'];    // 需卡号后四位
  function isCredit(t) { return CREDIT_TYPES.indexOf(t) !== -1; }
  function isCard(t) { return CARD_TYPES.indexOf(t) !== -1; }

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
        '<div class="field" id="tl-day-field" style="display:none;margin:10px 0 0">' +
          '<label>账单日（每月几号出账，1-31）</label>' +
          '<input type="number" id="tl-day" min="1" max="31" placeholder="例如：每月 10 号出账就填 10">' +
        '</div>' +
        '<div class="field" id="tl-last4-field" style="display:none;margin:10px 0 0">' +
          '<label>卡号后四位</label>' +
          '<input type="text" id="tl-last4" maxlength="4" pattern="[0-9]{4}" placeholder="4 位数字">' +
        '</div>' +
        '<p style="color:var(--muted);font-size:11.5px;margin-top:8px">序号 qid 只正向增加，不复用。常见支付工具自动匹配 LOGO，自定义显示随机颜色图标。银行卡/借记卡/信用卡需填卡号后四位；信用卡/花呗/借呗需填账单日，出账日前一周（黄）三天（红）会在仪表盘顶部提醒。</p>' +
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
        '<div class="field"><label>工具名称</label><input type="text" id="md-add-name" placeholder="例如：微信余额、招商银行信用卡…"></div>' +
        '<div class="field" id="md-add-day-field" style="display:none"><label>账单日（每月几号出账，1-31）</label>' +
          '<input type="number" id="md-add-day" min="1" max="31" placeholder="例如：每月 10 号出账就填 10"></div>' +
        '<div class="field" id="md-add-last4-field" style="display:none;margin-bottom:0"><label>卡号后四位</label>' +
          '<input type="text" id="md-add-last4" maxlength="4" pattern="[0-9]{4}" placeholder="4 位数字"></div>';
      var sel = body.querySelector('#md-add-type');
      var dayField = body.querySelector('#md-add-day-field');
      var last4Field = body.querySelector('#md-add-last4-field');
      function tgl() {
        dayField.style.display = isCredit(sel.value) ? '' : 'none';
        last4Field.style.display = isCard(sel.value) ? '' : 'none';
      }
      sel.addEventListener('change', tgl);
      tgl();

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
          var day = isCredit(sel.value) ? (+body.querySelector('#md-add-day').value || 0) : 0;
          if (isCredit(sel.value) && !(day >= 1 && day <= 31)) {
            global.UI.toast('信用卡 / 花呗 / 借呗 需填写账单日（1-31）', 'err');
            dayField.style.display = '';
            return false;
          }
          var last4 = body.querySelector('#md-add-last4').value.trim();
          if (isCard(sel.value) && !/^\d{4}$/.test(last4)) {
            global.UI.toast('银行卡 / 借记卡 / 信用卡 需填写卡号后四位', 'err');
            last4Field.style.display = '';
            return false;
          }
          global.DB.addGongju(v, sel.value, day, last4);
          global.UI.toast('已添加「' + v + '」', 'ok');
          render();
        }
      });
    }

    var typeSel = el.querySelector('#tl-type');
    var inlineDayField = el.querySelector('#tl-day-field');
    var inlineLast4Field = el.querySelector('#tl-last4-field');
    function tglInline() {
      inlineDayField.style.display = isCredit(typeSel.value) ? '' : 'none';
      inlineLast4Field.style.display = isCard(typeSel.value) ? '' : 'none';
    }
    typeSel.addEventListener('change', tglInline);

    function add() {
      var v = el.querySelector('#tl-input').value.trim();
      if (!v) { global.UI.toast('请输入工具名称', 'err'); return; }
      if (d.gongju.some(function (q) { return q.qname === v && !q.qhide; })) {
        global.UI.toast('该工具已存在', 'err'); return;
      }
      var day = isCredit(typeSel.value) ? (+el.querySelector('#tl-day').value || 0) : 0;
      if (isCredit(typeSel.value) && !(day >= 1 && day <= 31)) {
        global.UI.toast('信用卡 / 花呗 / 借呗 需填写账单日（1-31）', 'err');
        inlineDayField.style.display = '';
        return;
      }
      var last4 = el.querySelector('#tl-last4').value.trim();
      if (isCard(typeSel.value) && !/^\d{4}$/.test(last4)) {
        global.UI.toast('银行卡 / 借记卡 / 信用卡 需填写卡号后四位', 'err');
        inlineLast4Field.style.display = '';
        return;
      }
      global.DB.addGongju(v, typeSel.value, day, last4);
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
            '<div class="field"><label>工具名称</label><input type="text" id="md-name" value="' + global.UI.esc(q.qname) + '"></div>' +
            '<div class="field" id="md-day-field" style="display:none"><label>账单日（每月几号出账，1-31）</label>' +
            '<input type="number" id="md-day" min="1" max="31" value="' + (q.qday || '') + '"></div>' +
            '<div class="field" id="md-last4-field" style="display:none;margin-bottom:0"><label>卡号后四位</label>' +
            '<input type="text" id="md-last4" maxlength="4" pattern="[0-9]{4}" value="' + global.UI.esc(q.qlast4 || '') + '"></div>';
          var sel = body.querySelector('#md-type');
          var dayField = body.querySelector('#md-day-field');
          var last4Field = body.querySelector('#md-last4-field');
          function tgl() {
            dayField.style.display = isCredit(sel.value) ? '' : 'none';
            last4Field.style.display = isCard(sel.value) ? '' : 'none';
          }
          sel.addEventListener('change', tgl);
          tgl();

          UI.modal({
            title: '编辑支付工具 #' + q.qid,
            body: body,
            onOk: function () {
              var v = body.querySelector('#md-name').value.trim();
              if (!v) { global.UI.toast('名称不能为空', 'err'); return false; }
              var day = isCredit(sel.value) ? (+body.querySelector('#md-day').value || 0) : 0;
              if (isCredit(sel.value) && !(day >= 1 && day <= 31)) {
                global.UI.toast('信用卡 / 花呗 / 借呗 需填写账单日（1-31）', 'err');
                dayField.style.display = '';
                return false;
              }
              var last4 = body.querySelector('#md-last4').value.trim();
              if (isCard(sel.value) && !/^\d{4}$/.test(last4)) {
                global.UI.toast('银行卡 / 借记卡 / 信用卡 需填写卡号后四位', 'err');
                last4Field.style.display = '';
                return false;
              }
              global.DB.renameGongju(q.qid, v, sel.value, day, last4);
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
