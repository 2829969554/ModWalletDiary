/* ============================================================
 * record.js — 我要记账：账单表单 + 最近账单表格
 * 字段：wid/wtime/wyear/wmon/wday/wtype/wname/wtool/wqtype/wpayname
 * ============================================================ */
(function (global) {
  'use strict';

  var editingWid = null; // null=新增，数字=编辑

  function render() {
    var el = document.getElementById('page-record');
    var d = global.DB.get();

    el.innerHTML =
      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span><span id="rf-title">记一笔</span></div>' +
        '<div class="field"><label>日期时间</label><input type="datetime-local" id="rf-time"></div>' +
        '<div class="field"><label>记账类型</label>' +
          '<div class="radio-row">' +
            '<div class="radio-chip income" data-v="1"><span class="dot"></span>收入</div>' +
            '<div class="radio-chip expense on" data-v="2"><span class="dot"></span>支出</div>' +
          '</div>' +
        '</div>' +
        '<div class="field"><label>金额（元）</label><input type="number" id="rf-amount" placeholder="0.00" inputmode="decimal" step="0.01" min="0"></div>' +
        '<div class="field"><label>款项名目（可从列表选，也可输入新名目）</label><div class="combo"><input type="text" id="rf-name" placeholder="选择或输入款项名目">' +
          '<button class="combo-arrow" tabindex="-1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button></div></div>' +
        '<div class="field"><label>支付工具（可从列表选，也可输入新工具）</label><div class="combo"><input type="text" id="rf-tool" placeholder="选择或输入支付工具">' +
          '<button class="combo-arrow" tabindex="-1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button></div></div>' +
        '<div class="field"><label>交易路径</label>' +
          '<div class="radio-row">' +
            '<div class="radio-chip path on" data-v="1"><span class="dot"></span>线上</div>' +
            '<div class="radio-chip path" data-v="2"><span class="dot"></span>线下</div>' +
          '</div>' +
        '</div>' +
        '<div class="field"><label>商户名称（可自定义）</label><div class="combo"><input type="text" id="rf-payname" list="" placeholder="超市 / 路边摊 / 淘宝 …或输入新商户">' +
          '<button class="combo-arrow" tabindex="-1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button></div></div>' +
        '<div class="field"><label>备注（可选）</label><input type="text" id="rf-note" placeholder="备注"></div>' +
        '<div style="display:flex;gap:10px;margin-top:18px">' +
          '<button id="rf-cancel" class="btn-ghost" style="flex:1;display:none">取消编辑</button>' +
          '<button id="rf-save" class="btn-primary" style="flex:2">保存账单</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>最近账单</div>' +
        '<div class="table-wrap"><table class="tbl" id="rf-table"></table></div>' +
      '</div>';

    // 单选框
    var wtype = 2, wqtype = 1;
    el.querySelectorAll('.radio-chip.income,.radio-chip.expense').forEach(function (chip) {
      chip.addEventListener('click', function () {
        el.querySelectorAll('.radio-chip.income,.radio-chip.expense').forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        wtype = +chip.dataset.v;
      });
    });
    el.querySelectorAll('.radio-chip.path').forEach(function (chip) {
      chip.addEventListener('click', function () {
        el.querySelectorAll('.radio-chip.path').forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        wqtype = +chip.dataset.v;
      });
    });

    var nameInput = el.querySelector('#rf-name');
    var toolInput = el.querySelector('#rf-tool');
    var payInput = el.querySelector('#rf-payname');

    // 款项名目下拉（可编辑选择，默认从款项名目选）
    var pickedName = null;
    global.UI.combo(nameInput, function () {
      return d.mingmu.filter(function (m) { return !m.mhide; })
        .map(function (m) { return { v: m.mname, label: '编号 ' + m.mid }; });
    }, function (v) { pickedName = v; });

    // 支付工具下拉（可编辑选择，默认从支付工具选）
    var pickedTool = null;
    global.UI.combo(toolInput, function () {
      return d.gongju.filter(function (q) { return !q.qhide; })
        .map(function (q) { return { v: q.qname, label: q.qtype }; });
    }, function (v) { pickedTool = v; });

    // 商户名称下拉（可编辑 + 自定义）
    global.UI.combo(payInput, function () {
      return d.shanghu.map(function (s) { return { v: s }; });
    }, null);

    // 默认时间 = 当前
    var timeInput = el.querySelector('#rf-time');
    timeInput.value = toLocalInput(new Date());

    // 保存
    el.querySelector('#rf-save').addEventListener('click', function () {
      var amount = parseFloat(el.querySelector('#rf-amount').value);
      if (!amount || amount <= 0) { global.UI.toast('请输入正确金额', 'err'); return; }
      var nameVal = nameInput.value.trim();
      var toolVal = toolInput.value.trim();
      if (!nameVal) { global.UI.toast('请选择款项名目', 'err'); return; }
      if (!toolVal) { global.UI.toast('请选择支付工具', 'err'); return; }

      // 编号下拉式可编辑选择框：输入的新名目/新工具自动创建
      var mid = findMid(d, nameVal);
      if (!mid) { global.DB.addMingmu(nameVal); mid = global.DB.nextMid() - 1; }
      var qid = findQid(d, toolVal);
      if (!qid) { global.DB.addGongju(toolVal, '自定义'); qid = global.DB.nextQid() - 1; }

      var payname = (payInput.value || '').trim();
      if (payname) global.DB.addShanghu(payname);

      var t = timeInput.value ? new Date(timeInput.value) : new Date();
      var bill = {
        wtime: fmtTime(t),
        wyear: t.getFullYear(), wmon: t.getMonth() + 1, wday: t.getDate(),
        wtype: wtype, wname: mid, wtool: qid, wqtype: wqtype,
        wpayname: payname,
        wamount: Math.round(amount * 100) / 100,
        wnote: el.querySelector('#rf-note').value.trim()
      };

      if (editingWid !== null) {
        bill.wid = editingWid;
        global.DB.updateBill(editingWid, bill);
        global.UI.toast('账单已更新', 'ok');
        resetForm();
      } else {
        bill.wid = global.DB.nextWid();
        global.DB.addBill(bill);
        global.UI.toast('记账成功 ✓', 'ok');
        resetForm();
      }
      renderTable();
    });

    el.querySelector('#rf-cancel').addEventListener('click', resetForm);

    function resetForm() {
      editingWid = null;
      pickedName = null; pickedTool = null;
      nameInput.value = ''; toolInput.value = '';
      el.querySelector('#rf-amount').value = ''; el.querySelector('#rf-note').value = '';
      timeInput.value = toLocalInput(new Date());
      el.querySelector('#rf-title').textContent = '记一笔';
      el.querySelector('#rf-cancel').style.display = 'none';
      el.querySelector('#rf-save').textContent = '保存账单';
      // 恢复默认单选
      wtype = 2; wqtype = 1;
      el.querySelectorAll('.radio-chip.income,.radio-chip.expense').forEach(function (c) { c.classList.toggle('on', c.dataset.v === '2'); });
      el.querySelectorAll('.radio-chip.path').forEach(function (c) { c.classList.toggle('on', c.dataset.v === '1'); });
    }

    global._rfReset = resetForm;
    global._rfEdit = function (wid) {
      var b = d.walletdiary.find(function (x) { return x.wid === wid; });
      if (!b) return;
      editingWid = wid;
      timeInput.value = (b.wtime || '').length > 10 ? b.wtime.replace(' ', 'T') : b.wtime + 'T12:00';
      el.querySelector('#rf-amount').value = b.wamount;
      el.querySelector('#rf-note').value = b.wnote || '';
      payInput.value = b.wpayname || '';
      nameInput.value = global.DB.mingmuName(b.wname); pickedName = nameInput.value;
      toolInput.value = global.DB.gongjuName(b.wtool); pickedTool = toolInput.value;
      wtype = b.wtype; wqtype = b.wqtype || 2;
      el.querySelectorAll('.radio-chip.income,.radio-chip.expense').forEach(function (c) { c.classList.toggle('on', +c.dataset.v === wtype); });
      el.querySelectorAll('.radio-chip.path').forEach(function (c) { c.classList.toggle('on', +c.dataset.v === wqtype); });
      el.querySelector('#rf-title').textContent = '编辑账单 #' + wid;
      el.querySelector('#rf-cancel').style.display = 'block';
      el.querySelector('#rf-save').textContent = '更新账单';
      el.querySelector('#pages').scrollTop = 0;
    };

    renderTable();
  }

  function findMid(d, name) {
    var m = d.mingmu.find(function (x) { return x.mname === name.trim() && !x.mhide; });
    return m ? m.mid : 0;
  }
  function findQid(d, name) {
    var q = d.gongju.find(function (x) { return x.qname === name.trim() && !x.qhide; });
    return q ? q.qid : 0;
  }
  function fmtTime(t) {
    return t.getFullYear() + '-' + global.UI.pad(t.getMonth() + 1) + '-' + global.UI.pad(t.getDate()) +
      ' ' + global.UI.pad(t.getHours()) + ':' + global.UI.pad(t.getMinutes());
  }
  function toLocalInput(t) {
    return t.getFullYear() + '-' + global.UI.pad(t.getMonth() + 1) + '-' + global.UI.pad(t.getDate()) +
      'T' + global.UI.pad(t.getHours()) + ':' + global.UI.pad(t.getMinutes());
  }

  function renderTable() {
    var d = global.DB.get();
    var tbl = document.getElementById('rf-table');
    if (!tbl) return;
    var list = d.walletdiary.slice().sort(function (a, b) { return (b.wtime || '').localeCompare(a.wtime || ''); }).slice(0, 30);

    var html = '<thead><tr><th>序号</th><th>日期</th><th>类型</th><th>款项名目</th><th>支付工具</th><th>路径</th><th>商户</th><th style="text-align:right">金额</th><th>操作</th></tr></thead><tbody>';
    if (!list.length) {
      html += '<tr><td colspan="9" class="empty-tip">暂无账单</td></tr>';
    }
    list.forEach(function (b) {
      var isIn = b.wtype === 1;
      html += '<tr>' +
        '<td class="num c-muted">' + b.wid + '</td>' +
        '<td class="num">' + global.UI.esc(b.wtime || '') + '</td>' +
        '<td>' + (isIn ? '<span class="c-green">收入</span>' : '<span class="c-red">支出</span>') + '</td>' +
        '<td>' + global.UI.esc(global.DB.mingmuName(b.wname)) + '</td>' +
        '<td><span class="cell-flex"><span class="row-logo" data-tool="' + global.UI.esc(global.DB.gongjuName(b.wtool)) + '"></span>' + global.UI.esc(global.DB.gongjuName(b.wtool)) + '</span></td>' +
        '<td>' + (b.wqtype === 1 ? '线上' : '线下') + '</td>' +
        '<td>' + global.UI.esc(b.wpayname || '-') + '</td>' +
        '<td class="num" style="text-align:right" class="num">' + (isIn ? '<span class="c-green">+' : '<span class="c-red">-') + global.UI.fmtMoney(b.wamount) + '</span></td>' +
        '<td><div class="op-btns">' +
          '<button class="op-btn" title="编辑" onclick="window._rfEdit(' + b.wid + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>' +
          '<button class="op-btn del" title="删除" onclick="window._rfDel(' + b.wid + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>' +
        '</div></td>' +
        '</tr>';
    });
    html += '</tbody>';
    tbl.innerHTML = html;
    tbl.querySelectorAll('.row-logo').forEach(function (el) {
      global.Icons.fillLogo(el, el.dataset.tool);
    });
  }

  global._rfDel = function (wid) {
    global.UI.confirm('删除账单', '确定删除账单 #' + wid + ' 吗？此操作不可恢复。', function () {
      global.DB.deleteBill(wid);
      global.UI.toast('已删除', 'ok');
      if (typeof global._rfReset === 'function') global._rfReset();
      renderTable();
      return true;
    }, '删除');
  };

  global.Pages = global.Pages || {};
  global.Pages.record = { render: render };
})(window);
