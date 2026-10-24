// accounts.js —— 账户列表、总额统计与账户间转账
(function (global) {
  'use strict';

  const ACCT_TYPES = ['余额', '零钱', '零钱通', '余额宝', '数字人民币', '现金', '借记卡', '信用卡', '花呗', '分付', '月付', '白条', '金条'];

  // 卡号类账户要带后四位展示，邮箱之类没有数字的账号就退化成末尾四个字符
  function typeLabel(account) {
    const t = account.acctype || '';
    if (t !== '借记卡' && t !== '信用卡' && t !== '银行卡' && t !== '数字人民币') return t;
    const last4 = String(account.accuid || '').replace(/\D/g, '').slice(-4);
    return t + (last4 ? last4 : '');
  }

  // 账户名称可以重复，但「名称 + 卡号」这个组合不能再有
  function dupCombo(name, uid, excludeAccid) {
    const u = String(uid || '').trim();
    const hit = global.DB.get().accounts.some(function (a) {
      if (excludeAccid && a.accid === excludeAccid) return false;
      return a.accname === name && String(a.accuid || '').trim() === u && !a.acchide;
    });
    if (hit) {
      global.UI.toast('「' + name + (uid ? ' - ' + uid : '') + '」已存在：账户名称可重复，但名称+卡号组合不能重复', 'err');
    }
    return hit;
  }

  // 信用类账户没有账单日和额度就算不出负债
  function checkCredit(isCredit, day, limit) {
    if (!isCredit) return true;
    if (!(day >= 1 && day <= 31)) {
      global.UI.toast('信用类账户需填写账单日（1-31）', 'err');
      return false;
    }
    if (!(limit > 0)) {
      global.UI.toast('信用类账户需填写信用额度', 'err');
      return false;
    }
    return true;
  }

  // 单张卡的净额 = 额度 − 可用资金，正数是欠款，负数是溢缴款
  function cardNet(card) {
    return (Number(card.acclimit) || 0) - (Number(card.accmny) || 0);
  }

  // 同一账户名下多张信用卡共用一份额度，组内取最大的那个额度
  function groupCreditCards(accounts) {
    const groups = {};
    accounts.forEach(function (a) {
      if (a.acctype !== '信用卡') return;
      const g = groups[a.accname] || (groups[a.accname] = { limit: 0, cards: [] });
      g.cards.push(a);
      g.limit = Math.max(g.limit, Number(a.acclimit) || 0);
    });
    return groups;
  }

  // 组还能刷多少 = 共享额度 − 组内净额之和
  function groupAvailable(group) {
    const sum = group.cards.reduce(function (s, c) { return s + cardNet(c); }, 0);
    const v = group.limit - sum;
    return v >= 0 ? v : 0;
  }

  // 界面上要显示的那套数字：可用额度、净额、额度、是不是共享额度
  function creditView(account, cardGroups) {
    if (account.acctype === '信用卡' && !account.acchide) {
      const g = cardGroups[account.accname];
      if (g) {
        return {
          mny: groupAvailable(g),
          net: cardNet(account),
          limit: g.limit,
          shared: g.cards.length > 1
        };
      }
    }
    return {
      mny: Number(account.accmny) || 0,
      net: cardNet(account),
      limit: Number(account.acclimit) || 0,
      shared: false
    };
  }

  function netText(net) {
    if (net > 0) return '负债 ¥' + global.UI.fmtMoney(net);
    if (net < 0) return '存款 ¥' + global.UI.fmtMoney(-net);
    return '';
  }

  // 可用资金超出额度的部分是溢缴款，属于真持有的钱，要算进总资产
  function creditDeposit(account) {
    const lim = Number(account.acclimit) || 0;
    if (lim <= 0) return 0;
    return Math.max(0, (Number(account.accmny) || 0) - lim);
  }

  function sumStats(accounts, cardGroups) {
    // 信用类不计入总资产，只算溢缴款那部分
    const assets = accounts.reduce(function (s, a) {
      if (!global.DB.isCreditAcct(a.acctype)) return s + (Number(a.accmny) || 0);
      return s + creditDeposit(a);
    }, 0);
    // 负债只算欠款，溢缴款不算
    const debt = accounts.reduce(function (s, a) {
      return s + Math.max(0, creditView(a, cardGroups).net);
    }, 0);
    // 总授信按名字去重，同名多卡只算最大的那个额度
    const byName = {};
    accounts.forEach(function (a) {
      if (!global.DB.isCreditAcct(a.acctype)) return;
      const lim = Number(a.acclimit) || 0;
      if (lim <= 0) return;
      if (!byName[a.accname] || lim > byName[a.accname]) byName[a.accname] = lim;
    });
    const credit = Object.keys(byName).reduce(function (s, k) { return s + byName[k]; }, 0);
    return { assets: assets, debt: debt, credit: credit };
  }

  // 账户表格，可见列表和已隐藏列表共用同一张
  function accountTable(list, isHidden, bills, cardGroups) {
    const rows = list.map(function (a) {
      const cnt = bills.filter(function (b) { return b.wacct === a.accid; }).length;
      const isCreditAcc = global.DB.isCreditAcct(a.acctype);
      const cv = isCreditAcc ? creditView(a, cardGroups) : { mny: Number(a.accmny) || 0, net: 0, limit: 0, shared: false };

      let mnyHtml = `<span style="font-weight:700;color:${cv.net > 0 ? 'var(--red)' : 'var(--green)'}">¥ ${global.UI.fmtMoney(cv.mny)}</span>`;
      if (isCreditAcc) {
        const nt = netText(cv.net);
        mnyHtml += `<small style="display:block;color:var(--muted);font-size:11px;margin-top:2px">额度 ¥${global.UI.fmtMoney(cv.limit)}${nt ? ' · ' + nt : ''}${a.accday ? ' · 账单日 ' + a.accday + ' 号' : ''}</small>`;
      }

      const uidStr = String(a.accuid || '');
      const uidLast4 = uidStr.replace(/\D/g, '').slice(-4) || uidStr.slice(-4);
      const uidHtml = a.accuid
        ? `<span class="uid-full">${global.UI.esc(a.accuid)}</span><span class="uid-last">尾号 ${global.UI.esc(uidLast4)}</span>`
        : '-';

      const renameBtn = `<button class="op-btn" title="重命名" data-act="rename" data-id="${a.accid}">${global.SvgIcons.get('pencil')}</button>`;
      const toggleBtn = isHidden
        ? `<button class="op-btn" title="恢复显示" data-act="restore" data-id="${a.accid}">${global.SvgIcons.get('eye')}</button>`
        : `<button class="op-btn del" title="隐藏" data-act="hide" data-id="${a.accid}">${global.SvgIcons.get('eye-off')}</button>`;

      // 信用类账户行尾多挂一个单元格，手机端左边额度右边负债
      const creditCell = isCreditAcc
        ? `<td class="acct-credit-cell"><span class="cs-left">信用额度 ¥${global.UI.fmtMoney(cv.limit)}${cv.shared ? '（共享）' : ''}</span><span class="cs-right">${netText(cv.net) || '负债 ¥0.00'}${a.accday ? ' · 账单日 ' + a.accday + ' 号' : ''}</span></td>`
        : '';

      return `<tr${isHidden ? ' class="hidden-row"' : ''}>
        <td class="num c-muted">${a.accid}</td>
        <td>${global.UI.esc(a.accname)}</td>
        <td>${global.UI.esc(a.acctype || '余额')}<span class="typ-last">${a.accuid ? ' (尾号 ' + global.UI.esc(uidLast4) + ')' : ''}</span></td>
        <td class="num acct-uid${isCreditAcc ? ' acct-uid-credit' : ''}">${uidHtml}</td>
        <td style="text-align:right">${mnyHtml}</td>
        <td class="num">${cnt} 笔</td>
        <td>${isHidden ? '<span class="c-muted">已隐藏</span>' : '<span style="color:var(--green)">显示中</span>'}</td>
        <td><div class="op-btns">${renameBtn}${toggleBtn}</div></td>
        ${creditCell}
      </tr>`;
    });

    return `<thead><tr><th>序号 accid</th><th>账户名称</th><th>账户类型</th><th>账号/卡号</th><th style="text-align:right">可用资金</th><th>使用笔数</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.length ? rows.join('') : '<tr><td colspan="8" class="empty-tip">暂无</td></tr>'}</tbody>`;
  }

  function bindCreditToggle(root) {
    const sel = root.querySelector('#md-ac-type');
    const box = root.querySelector('#md-ac-credit');
    const tgl = () => {
      box.style.display = global.DB.isCreditAcct(sel.value) ? '' : 'none';
    };
    sel.addEventListener('change', tgl);
    tgl();
  }

  function openAddAccountModal() {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="field"><label>账户类型</label><select id="md-ac-type">${ACCT_TYPES.map((t) => `<option>${t}</option>`).join('')}</select></div>
      <div class="field"><label>账户名称</label><input type="text" id="md-ac-name" placeholder="如：支付宝、微信、抖音、快手"></div>
      <div class="field" id="md-ac-credit" style="display:none"><label>信用信息</label>
        <div style="display:flex;gap:8px">
          <input type="number" id="md-ac-day" min="1" max="31" placeholder="账单日 1-31">
          <input type="number" id="md-ac-limit" step="0.01" inputmode="decimal" placeholder="信用额度（元）">
        </div></div>
      <div class="field"><label>账号/卡号（可选）</label><input type="text" id="md-ac-uid" placeholder="如卡号后四位或邮箱"></div>
      <div class="field" style="margin-bottom:0"><label>可用资金（信用类填当前可用额度）</label><input type="number" id="md-ac-mny" step="0.01" inputmode="decimal" placeholder="0.00"></div>
    `;
    bindCreditToggle(body);
    global.UI.modal({
      title: '新增账户',
      body: body,
      okText: '添加',
      onOk: function () {
        const name = body.querySelector('#md-ac-name').value.trim();
        if (!name) { global.UI.toast('请输入账户名称', 'err'); return false; }
        const uid = body.querySelector('#md-ac-uid').value.trim();
        if (dupCombo(name, uid)) return false;
        const type = body.querySelector('#md-ac-type').value;
        const isC = global.DB.isCreditAcct(type);
        const day = parseInt(body.querySelector('#md-ac-day').value, 10) || 0;
        const limit = parseFloat(body.querySelector('#md-ac-limit').value) || 0;
        if (!checkCredit(isC, day, limit)) return false;
        global.DB.addAccount(name, type, uid,
          parseFloat(body.querySelector('#md-ac-mny').value) || 0, isC ? day : 0, isC ? limit : 0);
        global.UI.toast('已添加「' + name + '」', 'ok');
        render();
      }
    });
  }

  function openEditAccountModal(a) {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="field"><label>账户类型</label><select id="md-ac-type">${ACCT_TYPES.map((t) => `<option${t === a.acctype ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>账户名称</label><input type="text" id="md-ac-name" value="${global.UI.esc(a.accname)}"></div>
      <div class="field" id="md-ac-credit" style="display:none"><label>信用信息</label>
        <div style="display:flex;gap:8px">
          <input type="number" id="md-ac-day" min="1" max="31" placeholder="账单日 1-31" value="${a.accday || ''}">
          <input type="number" id="md-ac-limit" step="0.01" inputmode="decimal" placeholder="信用额度（元）" value="${a.acclimit || ''}">
        </div></div>
      <div class="field"><label>账号/卡号</label><input type="text" id="md-ac-uid" value="${global.UI.esc(a.accuid || '')}"></div>
      <div class="field" style="margin-bottom:0"><label>可用资金</label><input type="number" id="md-ac-mny" step="0.01" inputmode="decimal" value="${Number(a.accmny) || 0}">
        <p class="set-tip" style="margin-top:4px">直接修改将覆盖按记账自动计算的余额（历史账单不回溯重算）。</p></div>
    `;
    bindCreditToggle(body);
    global.UI.modal({
      title: '编辑账户 #' + a.accid,
      body: body,
      onOk: function () {
        const name = body.querySelector('#md-ac-name').value.trim();
        if (!name) { global.UI.toast('名称不能为空', 'err'); return false; }
        const type = body.querySelector('#md-ac-type').value;
        const day = parseInt(body.querySelector('#md-ac-day').value, 10) || 0;
        const limit = parseFloat(body.querySelector('#md-ac-limit').value) || 0;
        const uid = body.querySelector('#md-ac-uid').value.trim();
        if (dupCombo(name, uid, a.accid)) return false;
        if (!checkCredit(global.DB.isCreditAcct(type), day, limit)) return false;
        const mny = parseFloat(body.querySelector('#md-ac-mny').value);
        global.DB.renameAccount(a.accid, name, type, uid, day, limit,
          isNaN(mny) ? 0 : Math.round(mny * 100) / 100);
        global.UI.toast('已更新', 'ok');
        render();
      }
    });
  }

  function addAccountInline(root) {
    const name = root.querySelector('#ac-input').value.trim();
    if (!name) { global.UI.toast('请输入账户名称', 'err'); return; }
    const uid = root.querySelector('#ac-uid').value.trim();
    if (dupCombo(name, uid)) return;
    const type = root.querySelector('#ac-type').value;
    const isC = global.DB.isCreditAcct(type);
    const day = parseInt(root.querySelector('#ac-day').value, 10) || 0;
    const limit = parseFloat(root.querySelector('#ac-limit').value) || 0;
    if (!checkCredit(isC, day, limit)) return;
    global.DB.addAccount(name, type, uid,
      parseFloat(root.querySelector('#ac-mny').value) || 0, isC ? day : 0, isC ? limit : 0);
    global.UI.toast('已添加「' + name + '」', 'ok');
    render();
  }

  // 信用类只能转入（还款），只有信用卡存在溢缴款时才能转出存款部分
  function pickTransferCap(a) {
    if (!a) return 0;
    if (!global.DB.isCreditAcct(a.acctype)) return Number(a.accmny) || 0;
    return creditDeposit(a);
  }

  function openTransferModal() {
    const list = global.DB.get().accounts.filter((a) => !a.acchide);
    const cardGroups = groupCreditCards(list);
    // 信用类只能当转入方，信用卡有溢缴款时才能往外转
    const outList = list.filter(function (a) {
      if (!global.DB.isCreditAcct(a.acctype)) return true;
      return a.acctype === '信用卡' && creditDeposit(a) > 0;
    });
    if (list.length < 2 || !outList.length) {
      global.UI.toast('至少需要一个可转出的账户和一个转入账户', 'err');
      return;
    }

    const optionHtml = (a, forOut) => {
      let extra = '';
      if (global.DB.isCreditAcct(a.acctype)) {
        if (forOut) {
          const dep = creditDeposit(a);
          extra = dep > 0 ? ' · 可转出存款 ¥' + global.UI.fmtMoney(dep) : '';
        } else {
          extra = ' · 转入即还款';
        }
      }
      return `<option value="${a.accid}">${global.UI.esc(a.accname)}（${global.UI.esc(typeLabel(a))} · 可用 ¥${global.UI.fmtMoney(a.accmny)}${extra}）</option>`;
    };

    const detailRows = list.map(function (a) {
      const cv = global.DB.isCreditAcct(a.acctype) ? creditView(a, cardGroups) : { net: 0 };
      const nt = netText(cv.net);
      return `<div class="tr-detail-row"><span>${global.UI.esc(a.accname)}（${global.UI.esc(typeLabel(a))}）</span><span>可用 ¥${global.UI.fmtMoney(a.accmny)}${nt ? ' · ' + nt : ''}${a.accday ? ' · 账单日 ' + a.accday + ' 号' : ''}</span></div>`;
    });

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="tr-detail"><div class="tr-detail-title">账户明细</div>${detailRows.join('')}</div>
      <div class="field"><label>转出账户</label><select id="md-tr-from">${outList.map((a) => optionHtml(a, true)).join('')}</select></div>
      <div class="field"><label>转入账户</label><select id="md-tr-to">${list.map((a) => optionHtml(a, false)).join('')}</select></div>
      <div class="field"><label>转账金额（元）</label><input type="number" id="md-tr-amt" step="0.01" inputmode="decimal" placeholder="0.00"></div>
      <div id="md-tr-preview" class="tr-preview"></div>
    `;
    if (list.length > 1) body.querySelector('#md-tr-to').value = String(list[1].accid);

    const fromSel = body.querySelector('#md-tr-from');
    const toSel = body.querySelector('#md-tr-to');
    const amtInput = body.querySelector('#md-tr-amt');
    const preview = body.querySelector('#md-tr-preview');

    const updatePreview = () => {
      const from = list.find((a) => a.accid === +fromSel.value);
      const to = list.find((a) => a.accid === +toSel.value);
      const amt = parseFloat(amtInput.value) || 0;
      if (!from || !to) { preview.textContent = ''; return; }
      if (from.accid === to.accid) {
        preview.style.color = '';
        preview.textContent = '转出与转入不能是同一个账户';
        return;
      }
      const cap = pickTransferCap(from);
      if (amt > 0 && amt > cap) {
        preview.style.color = 'var(--red)';
        preview.textContent = global.DB.isCreditAcct(from.acctype)
          ? '转出金额超出存款金额（可转出存款 ¥' + global.UI.fmtMoney(cap) + '）'
          : '转出金额超出可用资金（可用 ¥' + global.UI.fmtMoney(cap) + '）';
        return;
      }
      let txt = '转出后「' + from.accname + '」可用 ¥' + global.UI.fmtMoney((Number(from.accmny) || 0) - amt);
      txt += ' → 转入后「' + to.accname + '」可用 ¥' + global.UI.fmtMoney((Number(to.accmny) || 0) + amt);
      if (global.DB.isCreditAcct(to.acctype) && (Number(to.acclimit) || 0) > 0) {
        // 还款后的净额 = 信用额度 − (可用资金 + 还款额)
        const afterNet = (Number(to.acclimit) || 0) - ((Number(to.accmny) || 0) + amt);
        if (afterNet > 0) txt += '，负债 ¥' + global.UI.fmtMoney(afterNet) + '（还款）';
        else if (afterNet < 0) txt += '，存款 ¥' + global.UI.fmtMoney(-afterNet) + '（还款）';
        else txt += '，负债 ¥0.00（还款）';
      }
      preview.style.color = '';
      preview.textContent = txt;
    };
    fromSel.addEventListener('change', updatePreview);
    toSel.addEventListener('change', updatePreview);
    amtInput.addEventListener('input', updatePreview);
    updatePreview();

    global.UI.modal({
      title: '账户转账',
      body: body,
      okText: '确认转账',
      onOk: function () {
        const from = +fromSel.value;
        const to = +toSel.value;
        const amt = parseFloat(amtInput.value);
        if (!(amt > 0)) { global.UI.toast('转账金额必须大于 0', 'err'); return false; }
        if (from === to) { global.UI.toast('转出与转入不能是同一个账户', 'err'); return false; }
        const fromAcc = list.find((a) => a.accid === from);
        const cap = pickTransferCap(fromAcc);
        if (amt > cap) {
          const msg = fromAcc && global.DB.isCreditAcct(fromAcc.acctype)
            ? '转出金额不能超过「' + fromAcc.accname + '」的存款金额 ¥' + global.UI.fmtMoney(cap)
            : '转出金额不能超过「' + (fromAcc ? fromAcc.accname : '') + '」的可用资金 ¥' + global.UI.fmtMoney(cap);
          global.UI.toast(msg, 'err');
          return false;
        }
        try {
          const r = global.DB.transfer(from, to, amt);
          global.UI.toast('已转账 ¥' + global.UI.fmtMoney(r.amount) + '：' + r.from + ' → ' + r.to, 'ok');
          render();
        } catch (err) {
          global.UI.toast('转账失败：' + err.message, 'err');
          return false;
        }
      }
    });
  }

  function render() {
    const el = document.getElementById('page-accounts');
    const d = global.DB.get();

    const active = d.accounts.filter((a) => !a.acchide);
    const hidden = d.accounts.filter((a) => a.acchide);
    const cardGroups = groupCreditCards(active);
    const stats = sumStats(active, cardGroups);

    el.innerHTML = `
      <div class="card asset-strip">
        <div class="as-grid">
          <div class="as-block"><span class="as-label">总资产</span><span class="as-val" style="color:${stats.assets >= 0 ? '#fff' : '#fecdd3'}">¥ ${global.UI.fmtMoney(stats.assets)}</span></div>
          <div class="as-block"><span class="as-label">负债</span><span class="as-val">¥ ${global.UI.fmtMoney(stats.debt)}</span></div>
          <div class="as-block"><span class="as-label">总授信</span><span class="as-val">¥ ${global.UI.fmtMoney(stats.credit)}</span></div>
          <div class="as-act"><button id="ac-transfer" class="btn-primary" style="height:40px">${global.SvgIcons.get('transfer')}转账</button></div>
        </div>
      </div>

      <div class="card tl-add-card">
        <div class="card-title"><span class="bar"></span>新增账户</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input type="text" id="ac-input" class="search-input" style="flex:1;min-width:150px" placeholder="账户名称，如：支付宝、微信、抖音、快手…（回车快速添加）">
          <select id="ac-type" class="search-input" style="width:130px">${ACCT_TYPES.map((t) => `<option>${t}</option>`).join('')}</select>
          <input type="text" id="ac-uid" class="search-input" style="width:150px" placeholder="账号/卡号（可选）">
          <input type="number" id="ac-mny" class="search-input" style="width:120px" placeholder="可用资金" inputmode="decimal" step="0.01">
          <button id="ac-add" class="btn-primary">添加</button>
        </div>
        <div class="field" id="ac-credit-fields" style="display:none;margin:10px 0 0">
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <input type="number" id="ac-day" class="search-input" style="width:150px" min="1" max="31" placeholder="账单日（1-31）">
            <input type="number" id="ac-limit" class="search-input" style="width:150px" placeholder="信用额度（元）" inputmode="decimal" step="0.01">
          </div>
        </div>
        <p style="color:var(--muted);font-size:11.5px;margin-top:8px">可用资金随每次记账自动增减（收入 +、支出 −）。信用卡/花呗/分付/月付/白条/金条 为信用类：不计入总资产，负债 = 信用额度 − 可用资金，可填账单日在仪表盘提醒还款。序号 accid 只正向增加。</p>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>账户列表 <small style="font-weight:400;color:var(--muted)">共 ${active.length} 个</small></div>
        <div class="table-wrap"><table class="tbl" id="ac-table"></table></div>
      </div>

      <button id="ac-fab" class="tl-fab" title="新增账户" aria-label="新增账户">${global.SvgIcons.get('plus')}</button>
    `;

    if (hidden.length) {
      el.insertAdjacentHTML('beforeend', `
        <div class="card">
          <div class="card-title"><span class="bar" style="background:var(--muted)"></span>已隐藏账户 <small style="font-weight:400;color:var(--muted)">${hidden.length} 个</small></div>
          <div class="table-wrap"><table class="tbl" id="ac-table-hidden"></table></div>
        </div>
      `);
    }

    el.querySelector('#ac-add').addEventListener('click', () => addAccountInline(el));
    el.querySelector('#ac-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addAccountInline(el); });
    el.querySelector('#ac-type').addEventListener('change', () => {
      el.querySelector('#ac-credit-fields').style.display = global.DB.isCreditAcct(el.querySelector('#ac-type').value) ? '' : 'none';
    });
    el.querySelector('#ac-fab').addEventListener('click', openAddAccountModal);
    el.querySelector('#ac-transfer').addEventListener('click', openTransferModal);

    el.querySelector('#ac-table').innerHTML = accountTable(active, false, d.walletdiary, cardGroups);
    const hiddenTable = el.querySelector('#ac-table-hidden');
    if (hiddenTable) hiddenTable.innerHTML = accountTable(hidden, true, d.walletdiary, cardGroups);

    // 行内操作分派，data-act 对应下面的 key
    const actions = {
      rename: (a) => openEditAccountModal(a),
      hide: (a) => {
        global.UI.confirm('隐藏账户', '隐藏「' + a.accname + '」？隐藏后不再出现在记账的账户列表，但历史账单与资金不受影响。', function () {
          global.DB.hideAccount(a.accid, true);
          global.UI.toast('已隐藏', 'ok');
          render();
        }, '隐藏');
      },
      restore: (a) => {
        global.DB.hideAccount(a.accid, false);
        global.UI.toast('已恢复显示', 'ok');
        render();
      }
    };

    el.querySelectorAll('button[data-act]').forEach((btn) => {
      const id = +btn.dataset.id;
      btn.addEventListener('click', () => {
        const a = d.accounts.find((x) => x.accid === id);
        if (!a) return;
        const fn = actions[btn.dataset.act];
        if (fn) fn(a);
      });
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.accounts = { render: render };
})(window);
