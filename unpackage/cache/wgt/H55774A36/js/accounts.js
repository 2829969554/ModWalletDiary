/* ============================================================
 * accounts.js — 账户管理：增加 / 重命名 / 隐藏(删除) / 转账
 * 字段：accid / accname / acctype / accuid(账号卡号) / accmny(可用资金)
 *       信用类账户（信用卡/花呗/分付/月付/白条/金条）另有 accday(账单日)、acclimit(信用额度)
 * accid 只正向增加；记账联动可用资金；信用类不计入总资产，额度-可用=负债
 * ============================================================ */
(function (global) {
  'use strict';

  var ACCT_TYPES = ['余额', '零钱', '零钱通', '余额宝', '数字人民币', '现金', '借记卡', '信用卡', '花呗', '分付', '月付', '白条', '金条'];

    function debtOf(a) {
      var limit = Number(a.acclimit) || 0;
      if (!global.DB.isCreditAcct(a.acctype) || limit <= 0) return 0;
      return Math.max(0, limit - (Number(a.accmny) || 0));
    }

    // 名称允许重复；「名称 + 卡号」组合不能重复（excludeAccid 用于编辑时排除自身）
    function dupCombo(name, uid, excludeAccid) {
      var u = String(uid || '').trim();
      return global.DB.get().accounts.some(function (a) {
        if (excludeAccid && a.accid === excludeAccid) return false;
        return a.accname === name && String(a.accuid || '').trim() === u && !a.acchide;
      });
    }

  function render() {
    var el = document.getElementById('page-accounts');
    var d = global.DB.get();

    var active = d.accounts.filter(function (a) { return !a.acchide; });
    var hidden = d.accounts.filter(function (a) { return a.acchide; });

    /* 信用卡同名多卡共享额度：
     * - 同一账户名称（同一家银行）的多张信用卡共用一份信用额度（取其中最大额度）
     * - 每张卡的负债单独计算（该卡额度 - 该卡可用资金）
     * - 剩余可用额度 = 共享额度 - 组内所有卡负债之和（所有卡共享）
     */
    function cardDebt(a) {
      var lim = Number(a.acclimit) || 0;
      return Math.max(0, lim - (Number(a.accmny) || 0));
    }
    var cardGroups = {}; // 信用卡组：名称 -> { limit, cards: [] }（只统计可见账户）
    active.forEach(function (a) {
      if (a.acctype !== '信用卡') return;
      var g = cardGroups[a.accname] || (cardGroups[a.accname] = { limit: 0, cards: [] });
      g.cards.push(a);
      g.limit = Math.max(g.limit, Number(a.acclimit) || 0);
    });
    function groupAvailable(g) {
      var debt = g.cards.reduce(function (s, c) { return s + cardDebt(c); }, 0);
      return Math.max(0, g.limit - debt);
    }
    // 信用账户展示用：信用卡显示组共享可用额度 + 本卡负债；其他信用类按原逻辑
    function creditView(a) {
      if (a.acctype === '信用卡' && !a.acchide) {
        var g = cardGroups[a.accname];
        if (g) return { mny: groupAvailable(g), debt: cardDebt(a), limit: g.limit, shared: g.cards.length > 1 };
      }
      return { mny: Number(a.accmny) || 0, debt: debtOf(a), limit: Number(a.acclimit) || 0, shared: false };
    }

    // 统计只算可见账户；总资产 = 非信用类可用资金之和；负债 = 各信用账户负债之和
    var totalAssets = active.reduce(function (s, a) {
      return global.DB.isCreditAcct(a.acctype) ? s : s + (Number(a.accmny) || 0);
    }, 0);
    var totalDebt = active.reduce(function (s, a) { return s + creditView(a).debt; }, 0);
    // 总授信 = 信用类额度之和；名称相同（同名多卡共享额度）只计一次，取最大额度
    var creditByName = {};
    active.forEach(function (a) {
      if (global.DB.isCreditAcct(a.acctype) && (Number(a.acclimit) || 0) > 0) {
        var lim = Number(a.acclimit) || 0;
        if (!creditByName[a.accname] || lim > creditByName[a.accname]) creditByName[a.accname] = lim;
      }
    });
    var totalCredit = Object.keys(creditByName).reduce(function (s, k) { return s + creditByName[k]; }, 0);

    el.innerHTML =
      '<div class="card asset-strip">' +
        '<div class="as-grid">' +
          '<div class="as-block"><span class="as-label">总资产</span>' +
            '<span class="as-val" style="color:' + (totalAssets >= 0 ? '#fff' : '#fecdd3') + '">¥ ' + global.UI.fmtMoney(totalAssets) + '</span></div>' +
          '<div class="as-block"><span class="as-label">负债</span>' +
            '<span class="as-val">¥ ' + global.UI.fmtMoney(totalDebt) + '</span></div>' +
          '<div class="as-block"><span class="as-label">总授信</span>' +
            '<span class="as-val">¥ ' + global.UI.fmtMoney(totalCredit) + '</span></div>' +
          '<div class="as-act"><button id="ac-transfer" class="btn-primary" style="height:40px">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px"><path d="M17 3l4 4-4 4"/><path d="M21 7H9"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h12"/></svg>转账</button></div>' +
        '</div>' +
      '</div>' +

      '<div class="card tl-add-card">' +
        '<div class="card-title"><span class="bar"></span>新增账户</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<input type="text" id="ac-input" class="search-input" style="flex:1;min-width:150px" placeholder="账户名称，如：支付宝、微信、抖音、快手…（回车快速添加）">' +
          '<select id="ac-type" class="search-input" style="width:130px">' +
            ACCT_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') +
          '</select>' +
          '<input type="text" id="ac-uid" class="search-input" style="width:150px" placeholder="账号/卡号（可选）">' +
          '<input type="number" id="ac-mny" class="search-input" style="width:120px" placeholder="可用资金" inputmode="decimal" step="0.01">' +
          '<button id="ac-add" class="btn-primary">添加</button>' +
        '</div>' +
        '<div class="field" id="ac-credit-fields" style="display:none;margin:10px 0 0">' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<input type="number" id="ac-day" class="search-input" style="width:150px" min="1" max="31" placeholder="账单日（1-31）">' +
            '<input type="number" id="ac-limit" class="search-input" style="width:150px" placeholder="信用额度（元）" inputmode="decimal" step="0.01">' +
          '</div>' +
        '</div>' +
        '<p style="color:var(--muted);font-size:11.5px;margin-top:8px">可用资金随每次记账自动增减（收入 +、支出 −）。信用卡/花呗/分付/月付/白条/金条 为信用类：不计入总资产，负债 = 信用额度 − 可用资金，可填账单日在仪表盘提醒还款。序号 accid 只正向增加。</p>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>账户列表 <small style="font-weight:400;color:var(--muted)">共 ' + active.length + ' 个</small></div>' +
        '<div class="table-wrap"><table class="tbl" id="ac-table"></table></div>' +
      '</div>' +

      '<button id="ac-fab" class="tl-fab" title="新增账户" aria-label="新增账户">' +
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' +
      '</button>';

    if (hidden.length) {
      el.insertAdjacentHTML('beforeend',
        '<div class="card">' +
          '<div class="card-title"><span class="bar" style="background:var(--muted)"></span>已隐藏账户 <small style="font-weight:400;color:var(--muted)">' + hidden.length + ' 个</small></div>' +
          '<div class="table-wrap"><table class="tbl" id="ac-table-hidden"></table></div>' +
        '</div>');
    }

    /* 类型切换：信用类显示 账单日/信用额度（内联卡片由 change 监听处理，弹窗内各自绑定） */

    function openAddModal() {
      var body = document.createElement('div');
      body.innerHTML =
        '<div class="field"><label>账户类型</label><select id="md-ac-type">' +
          ACCT_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><label>账户名称</label><input type="text" id="md-ac-name" placeholder="如：支付宝、微信、抖音、快手"></div>' +
        '<div class="field" id="md-ac-credit" style="display:none"><label>信用信息</label>' +
          '<div style="display:flex;gap:8px">' +
            '<input type="number" id="md-ac-day" min="1" max="31" placeholder="账单日 1-31">' +
            '<input type="number" id="md-ac-limit" step="0.01" inputmode="decimal" placeholder="信用额度（元）">' +
          '</div></div>' +
        '<div class="field"><label>账号/卡号（可选）</label><input type="text" id="md-ac-uid" placeholder="如卡号后四位或邮箱"></div>' +
        '<div class="field" style="margin-bottom:0"><label>可用资金（信用类填当前可用额度）</label><input type="number" id="md-ac-mny" step="0.01" inputmode="decimal" placeholder="0.00"></div>';
      // 信用字段开关（类型排在第一位）
      (function () {
        var sel = body.querySelector('#md-ac-type');
        var box = body.querySelector('#md-ac-credit');
        function tgl() { box.style.display = global.DB.isCreditAcct(sel.value) ? '' : 'none'; }
        sel.addEventListener('change', tgl);
        tgl();
      })();
      global.UI.modal({
        title: '新增账户',
        body: body,
        okText: '添加',
        onOk: function () {
          var v = body.querySelector('#md-ac-name').value.trim();
          if (!v) { global.UI.toast('请输入账户名称', 'err'); return false; }
          var uid = body.querySelector('#md-ac-uid').value.trim();
          if (dupCombo(v, uid)) {
            global.UI.toast('「' + v + (uid ? ' - ' + uid : '') + '」已存在：账户名称可重复，但名称+卡号组合不能重复', 'err');
            return false;
          }
          var isC = global.DB.isCreditAcct(body.querySelector('#md-ac-type').value);
          var day = parseInt(body.querySelector('#md-ac-day').value, 10) || 0;
          var limit = parseFloat(body.querySelector('#md-ac-limit').value) || 0;
          if (isC) {
            if (!(day >= 1 && day <= 31)) { global.UI.toast('信用类账户需填写账单日（1-31）', 'err'); return false; }
            if (!(limit > 0)) { global.UI.toast('信用类账户需填写信用额度', 'err'); return false; }
          }
          global.DB.addAccount(v, body.querySelector('#md-ac-type').value,
            uid, parseFloat(body.querySelector('#md-ac-mny').value) || 0,
            isC ? day : 0, isC ? limit : 0);
          global.UI.toast('已添加「' + v + '」', 'ok');
          render();
        }
      });
    }

    function addInline() {
      var v = el.querySelector('#ac-input').value.trim();
      if (!v) { global.UI.toast('请输入账户名称', 'err'); return; }
      var uid = el.querySelector('#ac-uid').value.trim();
      if (dupCombo(v, uid)) {
        global.UI.toast('「' + v + (uid ? ' - ' + uid : '') + '」已存在：账户名称可重复，但名称+卡号组合不能重复', 'err');
        return;
      }
      var type = el.querySelector('#ac-type').value;
      var isC = global.DB.isCreditAcct(type);
      var day = parseInt(el.querySelector('#ac-day').value, 10) || 0;
      var limit = parseFloat(el.querySelector('#ac-limit').value) || 0;
      if (isC) {
        if (!(day >= 1 && day <= 31)) { global.UI.toast('信用类账户需填写账单日（1-31）', 'err'); return; }
        if (!(limit > 0)) { global.UI.toast('信用类账户需填写信用额度', 'err'); return; }
      }
      global.DB.addAccount(v, type, uid,
        parseFloat(el.querySelector('#ac-mny').value) || 0, isC ? day : 0, isC ? limit : 0);
      global.UI.toast('已添加「' + v + '」', 'ok');
      render();
    }
    el.querySelector('#ac-add').addEventListener('click', addInline);
    el.querySelector('#ac-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') addInline(); });
    el.querySelector('#ac-type').addEventListener('change', function () {
      el.querySelector('#ac-credit-fields').style.display = global.DB.isCreditAcct(el.querySelector('#ac-type').value) ? '' : 'none';
    });
    el.querySelector('#ac-fab').addEventListener('click', openAddModal);

    /* 转账：任意两个账户之间划转（转入信用类=还款，负债随之减少）；附账户明细与转账预览
     * 信用类账户（信用卡/花呗/分付/月付/白条/金条）只能作为转入账户，不能转出
     */
    function openTransferModal() {
      var list = d.accounts.filter(function (a) { return !a.acchide; });
      var outList = list.filter(function (a) { return !global.DB.isCreditAcct(a.acctype); });
      if (list.length < 2 || !outList.length) { global.UI.toast('至少需要一个可转出的账户和一个转入账户', 'err'); return; }
      function optsOf(arr) {
        return arr.map(function (a) {
          var repay = global.DB.isCreditAcct(a.acctype) ? ' · 转入即还款' : '';
          return '<option value="' + a.accid + '">' + global.UI.esc(a.accname) + '（' + global.UI.esc(a.acctype || '') + ' · 可用 ¥' + global.UI.fmtMoney(a.accmny) + repay + '）</option>';
        }).join('');
      }
      var outOpts = optsOf(outList);
      var allOpts = optsOf(list);
      // 账户明细
      var detail = '<div class="tr-detail"><div class="tr-detail-title">账户明细</div>' +
        list.map(function (a) {
          var dbt = debtOf(a);
          return '<div class="tr-detail-row"><span>' + global.UI.esc(a.accname) + '（' + global.UI.esc(a.acctype || '') + '）</span>' +
            '<span>可用 ¥' + global.UI.fmtMoney(a.accmny) +
            (dbt > 0 ? ' · 负债 ¥' + global.UI.fmtMoney(dbt) : '') +
            (a.accday ? ' · 账单日 ' + a.accday + ' 号' : '') + '</span></div>';
        }).join('') + '</div>';
      var body = document.createElement('div');
      body.innerHTML =
        detail +
        '<div class="field"><label>转出账户</label><select id="md-tr-from">' + outOpts + '</select></div>' +
        '<div class="field"><label>转入账户</label><select id="md-tr-to">' + allOpts + '</select></div>' +
        '<div class="field"><label>转账金额（元）</label><input type="number" id="md-tr-amt" step="0.01" inputmode="decimal" placeholder="0.00"></div>' +
        '<div id="md-tr-preview" class="tr-preview"></div>';
      if (list.length > 1) body.querySelector('#md-tr-to').value = String(list[1].accid);

      var fromSel = body.querySelector('#md-tr-from');
      var toSel = body.querySelector('#md-tr-to');
      var amtInput = body.querySelector('#md-tr-amt');
      var preview = body.querySelector('#md-tr-preview');
      function findAcc(id) { return list.find(function (a) { return a.accid === id; }); }
      function updatePreview() {
        var f = findAcc(+fromSel.value), t = findAcc(+toSel.value);
        var amt = parseFloat(amtInput.value) || 0;
        if (!f || !t) { preview.textContent = ''; return; }
        if (f.accid === t.accid) { preview.textContent = '转出与转入不能是同一个账户'; return; }
        var txt = '转出后「' + f.accname + '」可用 ¥' + global.UI.fmtMoney((Number(f.accmny) || 0) - amt);
        txt += ' → 转入后「' + t.accname + '」可用 ¥' + global.UI.fmtMoney((Number(t.accmny) || 0) + amt);
        if (global.DB.isCreditAcct(t.acctype) && (Number(t.acclimit) || 0) > 0) {
          txt += '，负债 ¥' + global.UI.fmtMoney(Math.max(0, t.acclimit - (Number(t.accmny) || 0) - amt)) + '（还款）';
        }
        preview.textContent = txt;
      }
      fromSel.addEventListener('change', updatePreview);
      toSel.addEventListener('change', updatePreview);
      amtInput.addEventListener('input', updatePreview);
      updatePreview();

      global.UI.modal({
        title: '账户转账',
        body: body,
        okText: '确认转账',
        onOk: function () {
          var from = +fromSel.value;
          var to = +toSel.value;
          var amt = parseFloat(amtInput.value);
          if (!(amt > 0)) { global.UI.toast('请输入正确的转账金额', 'err'); return false; }
          if (from === to) { global.UI.toast('转出与转入不能是同一个账户', 'err'); return false; }
          try {
            var r = global.DB.transfer(from, to, amt);
            global.UI.toast('已转账 ¥' + global.UI.fmtMoney(r.amount) + '：' + r.from + ' → ' + r.to, 'ok');
            render();
          } catch (err) {
            global.UI.toast('转账失败：' + err.message, 'err');
            return false;
          }
        }
      });
    }
    el.querySelector('#ac-transfer').addEventListener('click', openTransferModal);

    function tblHtml(list, isHidden) {
      var html = '<thead><tr><th>序号 accid</th><th>账户名称</th><th>账户类型</th><th>账号/卡号</th><th style="text-align:right">可用资金</th><th>使用笔数</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      if (!list.length) html += '<tr><td colspan="8" class="empty-tip">暂无</td></tr>';
      list.forEach(function (a) {
        var cnt = d.walletdiary.filter(function (b) { return b.wacct === a.accid; }).length;
        var isCreditAcc = global.DB.isCreditAcct(a.acctype);
        var cv = isCreditAcc ? creditView(a) : { mny: Number(a.accmny) || 0, debt: 0, limit: 0, shared: false };
        var mny = cv.mny;
        var dbt = cv.debt;
        var mnyHtml = '<span style="font-weight:700;color:' + (dbt > 0 ? 'var(--red)' : (mny >= 0 ? 'var(--green)' : 'var(--red)')) + '">¥ ' + global.UI.fmtMoney(mny) + '</span>';
        if (isCreditAcc) {
          mnyHtml += '<small style="display:block;color:var(--muted);font-size:11px;margin-top:2px">额度 ¥' + global.UI.fmtMoney(cv.limit) +
            (dbt > 0 ? ' · 负债 ¥' + global.UI.fmtMoney(dbt) : '') +
            (a.accday ? ' · 账单日 ' + a.accday + ' 号' : '') + '</small>';
        }
        var uidStr = String(a.accuid || '');
        var uidLast4 = uidStr.replace(/\D/g, '').slice(-4) || uidStr.slice(-4);
        var uidHtml = a.accuid
          ? '<span class="uid-full">' + global.UI.esc(a.accuid) + '</span><span class="uid-last">尾号 ' + global.UI.esc(uidLast4) + '</span>'
          : '-';
        html += '<tr' + (isHidden ? ' class="hidden-row"' : '') + '>' +
          '<td class="num c-muted">' + a.accid + '</td>' +
          '<td>' + global.UI.esc(a.accname) + '</td>' +
          '<td>' + global.UI.esc(a.acctype || '余额') + '<span class="typ-last">' + (a.accuid ? ' (尾号 ' + global.UI.esc(uidLast4) + ')' : '') + '</span></td>' +
          '<td class="num acct-uid' + (isCreditAcc ? ' acct-uid-credit' : '') + '">' + uidHtml + '</td>' +
          '<td style="text-align:right">' + mnyHtml + '</td>' +
          '<td class="num">' + cnt + ' 笔</td>' +
          '<td>' + (isHidden ? '<span class="c-muted">已隐藏</span>' : '<span style="color:var(--green)">显示中</span>') + '</td>' +
          '<td><div class="op-btns">' +
            '<button class="op-btn" title="重命名" data-act="rename" data-id="' + a.accid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>' +
            (isHidden
              ? '<button class="op-btn" title="恢复显示" data-act="restore" data-id="' + a.accid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>'
              : '<button class="op-btn del" title="隐藏" data-act="hide" data-id="' + a.accid + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.9 18.1C16.4 19.3 14.3 20 12 20c-6.5 0-10-7-10-7 1-2 2.4-3.7 4-4.9"/><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3"/><path d="M3 3l18 18"/></svg></button>') +
          '</div></td>' +
          // 信用类账户：行尾追加明细单元格（手机端显示一行：左额度 / 右负债+账单日）
          (isCreditAcc
            ? '<td class="acct-credit-cell">' +
                '<span class="cs-left">信用额度 ¥' + global.UI.fmtMoney(cv.limit) + (cv.shared ? '（共享）' : '') + '</span>' +
                '<span class="cs-right">负债 ¥' + global.UI.fmtMoney(dbt) + (a.accday ? ' · 账单日 ' + a.accday + ' 号' : '') + '</span>' +
              '</td>'
            : '') +
          '</tr>';
      });
      html += '</tbody>';
      return html;
    }

    el.querySelector('#ac-table').innerHTML = tblHtml(active, false);
    var t2 = el.querySelector('#ac-table-hidden');
    if (t2) t2.innerHTML = tblHtml(hidden, true);

    el.querySelectorAll('button[data-act]').forEach(function (btn) {
      var id = +btn.dataset.id;
      btn.addEventListener('click', function () {
        var act = btn.dataset.act;
        var a = d.accounts.find(function (x) { return x.accid === id; });
        if (!a) return;
        if (act === 'rename') {
          var isC = global.DB.isCreditAcct(a.acctype);
          var body = document.createElement('div');
          body.innerHTML =
            '<div class="field"><label>账户类型</label><select id="md-ac-type">' +
            ACCT_TYPES.map(function (t) { return '<option' + (t === a.acctype ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field"><label>账户名称</label><input type="text" id="md-ac-name" value="' + global.UI.esc(a.accname) + '"></div>' +
            '<div class="field" id="md-ac-credit" style="display:none"><label>信用信息</label>' +
            '<div style="display:flex;gap:8px">' +
            '<input type="number" id="md-ac-day" min="1" max="31" placeholder="账单日 1-31" value="' + (a.accday || '') + '">' +
            '<input type="number" id="md-ac-limit" step="0.01" inputmode="decimal" placeholder="信用额度（元）" value="' + (a.acclimit || '') + '">' +
            '</div></div>' +
            '<div class="field"><label>账号/卡号</label><input type="text" id="md-ac-uid" value="' + global.UI.esc(a.accuid || '') + '"></div>' +
            '<div class="field" style="margin-bottom:0"><label>可用资金</label><input type="number" id="md-ac-mny" step="0.01" inputmode="decimal" value="' + (Number(a.accmny) || 0) + '">' +
            '<p class="set-tip" style="margin-top:4px">直接修改将覆盖按记账自动计算的余额（历史账单不回溯重算）。</p></div>';
          (function () {
            var sel = body.querySelector('#md-ac-type');
            var box = body.querySelector('#md-ac-credit');
            function tgl() { box.style.display = global.DB.isCreditAcct(sel.value) ? '' : 'none'; }
            sel.addEventListener('change', tgl);
            tgl();
          })();
          global.UI.modal({
            title: '编辑账户 #' + a.accid,
            body: body,
            onOk: function () {
              var v = body.querySelector('#md-ac-name').value.trim();
              if (!v) { global.UI.toast('名称不能为空', 'err'); return false; }
              var type = body.querySelector('#md-ac-type').value;
              var day = parseInt(body.querySelector('#md-ac-day').value, 10) || 0;
              var limit = parseFloat(body.querySelector('#md-ac-limit').value) || 0;
              var uid = body.querySelector('#md-ac-uid').value.trim();
              if (dupCombo(v, uid, a.accid)) {
                global.UI.toast('「' + v + (uid ? ' - ' + uid : '') + '」已存在：账户名称可重复，但名称+卡号组合不能重复', 'err');
                return false;
              }
              if (global.DB.isCreditAcct(type)) {
                if (!(day >= 1 && day <= 31)) { global.UI.toast('信用类账户需填写账单日（1-31）', 'err'); return false; }
                if (!(limit > 0)) { global.UI.toast('信用类账户需填写信用额度', 'err'); return false; }
              }
              var mny = parseFloat(body.querySelector('#md-ac-mny').value);
              global.DB.renameAccount(a.accid, v, type, uid, day, limit,
                isNaN(mny) ? 0 : Math.round(mny * 100) / 100);
              global.UI.toast('已更新', 'ok');
              render();
            }
          });
        } else if (act === 'hide') {
          global.UI.confirm('隐藏账户', '隐藏「' + a.accname + '」？隐藏后不再出现在记账的账户列表，但历史账单与资金不受影响。', function () {
            global.DB.hideAccount(a.accid, true);
            global.UI.toast('已隐藏', 'ok');
            render();
          }, '隐藏');
        } else if (act === 'restore') {
          global.DB.hideAccount(a.accid, false);
          global.UI.toast('已恢复显示', 'ok');
          render();
        }
      });
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.accounts = { render: render };
})(window);
