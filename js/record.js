// record.js —— 我要记账：账单表单 + 最近账单表格
(function (global) {
  'use strict';

  let editingWid = null; // 正在编辑的账单编号，null 表示是新增

  const COMBO_ARROW = `<button class="combo-arrow" tabindex="-1">${global.SvgIcons.get('chevron-down')}</button>`;

  function render() {
    const el = document.getElementById('page-record');
    const d = global.DB.get();

    el.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="bar"></span><span id="rf-title">记一笔</span></div>
        <div class="field field-row"><label>记账时间</label><input type="datetime-local" id="rf-time"></div>
        <div class="field field-row"><label>记账类型</label>
          <div class="radio-row">
            <div class="radio-chip income" data-v="1"><span class="dot"></span>收入</div>
            <div class="radio-chip expense on" data-v="2"><span class="dot"></span>支出</div>
          </div>
        </div>
        <div class="field field-row"><label>金额（元）</label><input type="number" id="rf-amount" placeholder="0.00" inputmode="decimal" step="0.01" min="0"></div>
        <div class="field"><label>款项名目（可从列表选，也可输入新名目）</label><div class="combo"><input type="text" id="rf-name" placeholder="选择或双击输入款项名目">${COMBO_ARROW}</div></div>
        <div class="field"><label>支付工具（可从列表选，也可输入新工具）</label><div class="combo"><input type="text" id="rf-tool" placeholder="选择或双击输入支付工具">${COMBO_ARROW}</div></div>
        <div class="field"><label>交易账户（必选，从账户管理筛选）</label><select id="rf-acct">
          <option value="">请选择交易账户</option>
          ${acctOptionsHtml(d)}
        </select></div>
        <div class="field"><label>交易路径</label>
          <div class="radio-row">
            <div class="radio-chip path on" data-v="1"><span class="dot"></span>线上</div>
            <div class="radio-chip path" data-v="2"><span class="dot"></span>线下</div>
          </div>
        </div>
        <div class="field"><label>商户名称（可自定义）</label><div class="combo"><input type="text" id="rf-payname" list="" placeholder="超市 / 路边摊 / 淘宝 …或双击输入新商户">${COMBO_ARROW}</div></div>
        <div class="field"><label>备注（可选）</label><input type="text" id="rf-note" placeholder="备注"></div>
        <div class="rf-actions">
          <button id="rf-cancel" class="btn-ghost" style="flex:1;display:none">取消编辑</button>
          <button id="rf-save" class="btn-primary" style="flex:2">保存账单</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="bar"></span>最近账单</div>
        <div class="table-wrap"><table class="tbl" id="rf-table"></table></div>
      </div>`;

    // 表单的值收在一个对象里，省得到处传参
    const inp = {
      name: el.querySelector('#rf-name'),
      tool: el.querySelector('#rf-tool'),
      acct: el.querySelector('#rf-acct'),
      pay: el.querySelector('#rf-payname'),
      time: el.querySelector('#rf-time'),
      type: 2, // 记账类型：1 收入 2 支出
      path: 1  // 交易路径：1 线上 2 线下
    };

    bindRadioChips(el, '.radio-chip.income,.radio-chip.expense', (v) => { inp.type = v; });
    bindRadioChips(el, '.radio-chip.path', (v) => { inp.path = v; });

    // 三个可编辑下拉，选项随时取最新的数据
    global.UI.combo(inp.name, () => d.mingmu
      .filter((m) => !m.mhide)
      .map((m) => ({ v: m.mname, label: '编号 ' + m.mid })), null);

    global.UI.combo(inp.tool, () => d.gongju
      .filter((q) => !q.qhide)
      .map((q) => ({ v: q.qname, label: q.qtype })), null);

    global.UI.combo(inp.pay, () => d.shanghu.map((s) => ({ v: s })), null);

    inp.time.value = toLocalInput(new Date());

    el.querySelector('#rf-save').addEventListener('click', () => {
      const bill = collectBill(el, inp);
      if (!bill) return;

      if (editingWid === null) {
        bill.wid = global.DB.nextWid();
        global.DB.addBill(bill);
        global.UI.toast('记账成功 ✓', 'ok');
      } else {
        bill.wid = editingWid;
        global.DB.updateBill(editingWid, bill);
        global.UI.toast('账单已更新', 'ok');
      }
      resetForm();
      renderTable();
    });

    el.querySelector('#rf-cancel').addEventListener('click', resetForm);

    // 清空表单，回到「记一笔」的初始状态
    function resetForm() {
      editingWid = null;
      inp.name.value = '';
      inp.tool.value = '';
      inp.acct.value = '';
      el.querySelector('#rf-amount').value = '';
      el.querySelector('#rf-note').value = '';
      inp.time.value = toLocalInput(new Date());
      el.querySelector('#rf-title').textContent = '记一笔';
      el.querySelector('#rf-cancel').style.display = 'none';
      el.querySelector('#rf-save').textContent = '保存账单';
      inp.type = 2;
      inp.path = 1;
      setChips(el, '.radio-chip.income,.radio-chip.expense', inp.type);
      setChips(el, '.radio-chip.path', inp.path);
    }

    // 把一条账单填进表单，转成编辑状态
    function editBill(wid) {
      // 这里现取数据，不用渲染页面时抓的那份，免得中途记过账之后回填到旧值
      const b = global.DB.get().walletdiary.find((x) => x.wid === wid);
      if (!b) return;
      editingWid = wid;
      inp.time.value = (b.wtime || '').length > 10 ? b.wtime.replace(' ', 'T') : b.wtime + 'T12:00';
      el.querySelector('#rf-amount').value = Number(b.wamount) || 0;
      el.querySelector('#rf-note').value = b.wnote || '';
      inp.pay.value = b.wpayname || '';
      inp.name.value = global.DB.mingmuName(b.wname);
      inp.tool.value = global.DB.gongjuName(b.wtool);
      // 旧账单没有账户，得让用户自己补一个
      const accVal = String(b.wacct || 0);
      inp.acct.value = inp.acct.querySelector(`option[value="${accVal}"]`) ? accVal : '';
      inp.type = b.wtype;
      inp.path = b.wqtype || 2;
      setChips(el, '.radio-chip.income,.radio-chip.expense', inp.type);
      setChips(el, '.radio-chip.path', inp.path);
      el.querySelector('#rf-title').textContent = '编辑账单 #' + wid;
      el.querySelector('#rf-cancel').style.display = 'block';
      el.querySelector('#rf-save').textContent = '更新账单';
      document.getElementById('pages').scrollTop = 0;
    }

    global._rfReset = resetForm;
    global._rfEdit = editBill;

    renderTable();
  }

  // 交易账户下拉里的选项
  function acctOptionsHtml(d) {
    return d.accounts.filter((a) => !a.acchide).map((a) =>
      `<option value="${a.accid}">${global.UI.esc(a.accname)}（${global.UI.esc(acctTypeLabel(a))} · ¥${global.UI.fmtMoney(a.accmny)}）</option>`
    ).join('');
  }

  // 读表单，组装成一条账单；校验不过就弹提示，返回 null
  function collectBill(el, inp) {
    let amount = parseFloat(el.querySelector('#rf-amount').value);
    if (!(amount > 0)) { global.UI.toast('请输入正确金额', 'err'); return null; }
    amount = Math.round(amount * 100) / 100;

    const nameVal = inp.name.value.trim();
    const toolVal = inp.tool.value.trim();
    if (!nameVal) { global.UI.toast('请选择款项名目', 'err'); return null; }
    if (!toolVal) { global.UI.toast('请选择支付工具', 'err'); return null; }

    // 交易账户必选
    const acctId = +inp.acct.value || 0;
    if (!acctId) { global.UI.toast('请选择交易账户', 'err'); return null; }

    // 下拉里选了新名目/新工具就直接建一个
    let mid = (global.DB.get().mingmu.find((x) => x.mname === nameVal && !x.mhide) || {}).mid || 0;
    if (!mid) {
      global.DB.addMingmu(nameVal);
      mid = global.DB.nextMid() - 1;
    }
    let qid = (global.DB.get().gongju.find((x) => x.qname === toolVal && !x.qhide) || {}).qid || 0;
    if (!qid) {
      global.DB.addGongju(toolVal, '自定义', 0, '');
      qid = global.DB.nextQid() - 1;
    }

    const payname = (inp.pay.value || '').trim();
    if (payname) global.DB.addShanghu(payname);

    const t = inp.time.value ? new Date(inp.time.value) : new Date();
    return {
      wtime: fmtTime(t),
      wyear: t.getFullYear(), wmon: t.getMonth() + 1, wday: t.getDate(),
      Wmoney: amount.toFixed(2), wamount: amount,
      wtype: inp.type, wname: mid, wtool: qid, wacct: acctId, wqtype: inp.path,
      wpayname: payname,
      wnote: el.querySelector('#rf-note').value.trim()
    };
  }

  // 银行卡/借记卡/信用卡/数字人民币后面跟账号后四位，如 借记卡6688
  function acctTypeLabel(a) {
    const type = a.acctype || '';
    if (type === '借记卡' || type === '信用卡' || type === '银行卡' || type === '数字人民币') {
      const last4 = String(a.accuid || '').replace(/\D/g, '').slice(-4);
      return type + (last4 ? last4 : '');
    }
    return type;
  }

  const fmtTime = (t) => `${t.getFullYear()}-${global.UI.pad(t.getMonth() + 1)}-${global.UI.pad(t.getDate())} ${global.UI.pad(t.getHours())}:${global.UI.pad(t.getMinutes())}`;

  // datetime-local 控件要的是 'YYYY-MM-DDTHH:mm'
  const toLocalInput = (t) => `${t.getFullYear()}-${global.UI.pad(t.getMonth() + 1)}-${global.UI.pad(t.getDate())}T${global.UI.pad(t.getHours())}:${global.UI.pad(t.getMinutes())}`;

  // 一组单选按钮，同组里只能选一个
  function bindRadioChips(root, sel, onChange) {
    root.querySelectorAll(sel).forEach((chip) => {
      chip.addEventListener('click', () => {
        root.querySelectorAll(sel).forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
        onChange(+chip.dataset.v);
      });
    });
  }

  // 按值高亮某一组里的某个按钮
  function setChips(root, sel, value) {
    root.querySelectorAll(sel).forEach((c) => c.classList.toggle('on', +c.dataset.v === value));
  }

  function renderTable() {
    const d = global.DB.get();
    const tbl = document.getElementById('rf-table');
    if (!tbl) return;

    const list = d.walletdiary.slice()
      .sort((a, b) => (b.wtime || '').localeCompare(a.wtime || ''))
      .slice(0, 30);

    tbl.innerHTML = `
      <thead><tr><th>序号</th><th>日期</th><th>类型</th><th>款项名目</th><th>支付工具</th><th>交易账户</th><th>路径</th><th>商户</th><th style="text-align:right">金额</th><th>操作</th></tr></thead>
      <tbody>${list.length ? list.map(billRowHtml).join('') : '<tr><td colspan="10" class="empty-tip">暂无账单</td></tr>'}</tbody>`;

    tbl.querySelectorAll('.row-logo').forEach((el) => global.Icons.fillLogo(el, el.dataset.tool));
  }

  // 表格里的一行
  function billRowHtml(b) {
    const isIn = b.wtype === 1;
    const tool = global.DB.gongjuName(b.wtool);
    return `
      <tr>
        <td class="num c-muted">${b.wid}</td>
        <td class="num">${global.UI.esc(b.wtime || '')}</td>
        <td>${isIn ? '<span class="c-green">收入</span>' : '<span class="c-red">支出</span>'}</td>
        <td>${global.UI.esc(global.DB.mingmuName(b.wname))}</td>
        <td><span class="cell-flex"><span class="row-logo" data-tool="${global.UI.esc(tool)}"></span>${global.UI.esc(tool)}</span></td>
        <td>${global.UI.esc(global.DB.accountName(b.wacct) || '-')}</td>
        <td>${b.wqtype === 1 ? '线上' : '线下'}</td>
        <td>${global.UI.esc(b.wpayname || '-')}</td>
        <td class="num" style="text-align:right">${isIn ? '<span class="c-green">+' : '<span class="c-red">-'}${global.UI.fmtMoney(b.wamount)}</span></td>
        <td><div class="op-btns">
          <button class="op-btn" title="编辑" onclick="window._rfEdit(${b.wid})">${global.SvgIcons.get('pencil')}</button>
          <button class="op-btn del" title="删除" onclick="window._rfDel(${b.wid})">${global.SvgIcons.get('trash')}</button>
        </div></td>
      </tr>`;
  }

  // 删除一条账单，表格里的删除按钮调它
  global._rfDel = (wid) => {
    global.UI.confirm('删除账单', `确定删除账单 #${wid} 吗？此操作不可恢复。`, () => {
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
