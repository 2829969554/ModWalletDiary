// dashboard.js —— 仪表盘：还款提醒、倒计时条、收支圆环和时光轴
(function (global) {
  'use strict';

  const PAGE_SIZE = 20;    // 时光轴一次加载多少条
  const DUE_OFFSET = 15;   // 最晚还款日 = 账单日往后 15 天
  const ARROW_UP = global.SvgIcons.get('arrow-up');
  const ARROW_DOWN = global.SvgIcons.get('arrow-down');

  let shown = 0;           // 时光轴已经渲染到第几条
  const TEMP_DISMISS = {}; // 手动关掉的还款提醒，只在本次会话有效

  // 春节：农历正月初一对应的公历日期（2026-2036）
  const CNYS = {
    2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03',
    2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08',
    2036: '01-28'
  };

  function render() {
    const el = document.getElementById('page-dashboard');
    const now = new Date();
    const y = now.getFullYear();
    const today = new Date(y, now.getMonth(), now.getDate());

    // 回到仪表盘时重新算一次显示模式，auto 模式跨过 7:00/18:00 会自动切
    if (global.UI && global.UI.applyTheme) global.UI.applyTheme(global.DB.getSettings().theme);

    const yearSum = global.Stats.calcRange(new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59));
    const monSum = global.Stats.calcRange(new Date(y, now.getMonth(), 1), new Date(y, now.getMonth() + 1, 0, 23, 59, 59));

    const rings = [
      { id: 'year-in', label: '今年总收入', val: yearSum.in, color: '#10b981', icon: ARROW_UP },
      { id: 'year-out', label: '今年总支出', val: yearSum.out, color: '#f43f5e', icon: ARROW_DOWN },
      { id: 'mon-in', label: '本月总收入', val: monSum.in, color: '#10b981', icon: ARROW_UP },
      { id: 'mon-out', label: '本月总支出', val: monSum.out, color: '#f43f5e', icon: ARROW_DOWN }
    ];

    const alerts = payAlertsHtml(today);

    el.innerHTML = `
      ${alerts ? `<div class="pay-alert-layer">${alerts}</div>` : ''}
      ${countdownHtml(today)}
      ${dayStripHtml(now, today)}
      <div class="rings">
        ${rings.map(ringCardHtml).join('')}
      </div>
      <div class="card">
        <div class="card-title"><span class="bar"></span>时光轴 <small style="font-weight:400;color:var(--muted)">最近收支明细</small></div>
        <div id="timeline" class="timeline"></div>
        <button id="tl-more" class="tl-more" style="display:none">加载更多 ↓</button>
      </div>
      <button id="db-fab" class="tl-fab fab-rec" title="记一笔" aria-label="记一笔">
        ${global.SvgIcons.get('plus-sm')}
        <span class="fab-rec-label">记账</span>
      </button>
    `;

    rings.forEach((r) => drawRing(r.id, r.val, r.color));

    shown = 0;
    document.getElementById('timeline').innerHTML = '';
    loadMore();
    document.getElementById('tl-more').addEventListener('click', loadMore);
    const fab = document.getElementById('db-fab');
    if (fab) fab.addEventListener('click', openQuickRecord);
    bindPayAlerts(el);
  }

  function ringCardHtml(r) {
    const tone = r.label.indexOf('收入') > -1 ? 'green' : 'red';
    return `
      <div class="ring-card">
        <div class="ring-wrap">
          <canvas id="${r.id}"></canvas>
          <div class="ring-center"><span class="rc-icon">${r.icon}</span><span class="rc-label">${r.label}</span></div>
        </div>
        <div class="ring-val ${tone}">¥ ${global.UI.fmtMoney(r.val)}</div>
        <div class="ring-sub">${r.label}</div>
      </div>`;
  }

  function drawRing(id, val, color) {
    const cv = document.getElementById(id);
    if (!cv) return;
    const pct = Math.max(0, Math.min(1, val / 100000)); // 十万封顶画满圈
    const size = 108;
    cv.width = size * 2;
    cv.height = size * 2;
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    new global.Chart(cv, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pct, 1 - pct],
          backgroundColor: [color, 'rgba(150,150,170,.14)'],
          borderWidth: 0,
          borderRadius: 20,
          cutout: '78%'
        }]
      },
      options: {
        responsive: false, animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    });
  }

  // 顶部日期条：今天第几天 + 距年底 + 距春节
  function dayStripHtml(now, today) {
    const y = now.getFullYear();
    const dayOfYear = Math.floor((today - new Date(y, 0, 1)) / 86400000) + 1;
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysLeft = (leap ? 366 : 365) - dayOfYear;

    const cny = nextCny(y, now);
    const cnyDays = Math.ceil((cny - today) / 86400000);
    const cnyNum = cnyDays > 0 ? cnyDays : 0;

    const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    const dateStr = `${y}年${now.getMonth() + 1}月${now.getDate()}日 · 星期${week}`;

    // 手机屏幕窄，只留「距离年底」「距离春节」里数字更小的那个
    const items = global.innerWidth <= 768
      ? (cnyNum <= daysLeft ? [['距离春节', cnyNum]] : [['距离年底', daysLeft]])
      : [['距离年底', daysLeft], ['距离春节', cnyNum]];

    return `
      <div class="day-strip">
        <div class="ds-today">${dateStr}<b>${y}年的第 ${dayOfYear} 天</b></div>
        ${items.map(([label, num]) => `
          <div class="ds-sep"></div>
          <div class="ds-item"><div class="ds-num">${num}</div><div class="ds-label">${label}</div></div>
        `).join('')}
      </div>`;
  }

  // 还款提醒：账单日当天银行还没出账，所以从次日开始提醒；最晚还款日 = 账单日 + 15 天
  function payAlertsHtml(today0) {
    const d = global.DB.get();
    const cards = [];

    d.gongju.forEach((q) => {
      if (!q.qday || q.qhide) return;
      cards.push({
        key: 'q' + q.qid, kind: 'tool', id: q.qid, name: q.qname, type: q.qtype || '信用卡',
        last4: String(q.qlast4 || '').replace(/\D/g, '').slice(-4), day: +q.qday, paid: q.qpaid
      });
    });
    d.accounts.forEach((a) => {
      if (!global.DB.isCreditAcct(a.acctype) || !a.accday || a.acchide) return;
      cards.push({
        key: 'a' + a.accid, kind: 'acct', id: a.accid, name: a.accname, type: (a.acctype || '信用卡') + '账户',
        last4: String(a.accuid || '').replace(/\D/g, '').slice(-4), day: +a.accday, paid: a.accpaid
      });
    });

    const due = [];
    cards.forEach((c) => {
      const B = currentBillDate(c.day, today0);                          // 本期账单日
      const D = new Date(B.getFullYear(), B.getMonth(), B.getDate() + DUE_OFFSET); // 最晚还款日
      if (c.paid === fmtDay(B)) return;                                  // 本期已经还过了
      if (TEMP_DISMISS[c.key]) return;                                   // 用户临时关掉了
      due.push({ c, B, D, left: Math.round((D - today0) / 86400000) });
    });
    due.sort((a, b) => a.left - b.left);

    return due.map((x) => {
      const c = x.c;
      const status = x.left > 0 ? `距最晚还款还有 ${x.left} 天`
        : (x.left === 0 ? '今天是最晚还款日' : `已逾期 ${-x.left} 天，请立即还款`);
      return `
        <div class="pay-alert ${alertLevel(x.left)}">
          <div class="pa-icon">${global.SvgIcons.get('card-alert')}</div>
          <div class="pa-main"><b>${global.UI.esc(c.name)}</b>（${global.UI.esc(c.type)}${c.last4 ? '-' + c.last4 : ''}）账单日 ${x.B.getMonth() + 1}月${x.B.getDate()}日出账，最晚还款日 ${x.D.getMonth() + 1}月${x.D.getDate()}日<small>${status}</small></div>
          <button class="pa-btn paid" data-act="paid" data-kind="${c.kind}" data-id="${c.id}" data-bill="${fmtDay(x.B)}" data-name="${global.UI.esc(c.name)}">已还款</button>
          <button class="pa-btn temp" data-act="temp" data-key="${c.key}">临时关闭</button>
        </div>`;
    }).join('');
  }

  function bindPayAlerts(el) {
    el.querySelectorAll('.pay-alert .pa-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.act !== 'paid') {
          TEMP_DISMISS[btn.dataset.key] = 1;
          const card = btn.closest('.pay-alert');
          if (card) card.remove();
          return;
        }
        const id = +btn.dataset.id;
        if (btn.dataset.kind === 'acct') global.DB.markAccountPaid(id, btn.dataset.bill);
        else global.DB.markToolPaid(id, btn.dataset.bill);
        global.UI.toast('已记录「' + btn.dataset.name + '」本期还款', 'ok');
        render();
      });
    });
  }

  // 按剩余天数挑提醒颜色
  function alertLevel(left) {
    if (left < 0) return 'overdue';
    if (left === 0) return 'due';
    if (left <= 2) return 'red';
    if (left <= 4) return 'deep';
    if (left <= 7) return 'orange';
    return 'yellow';
  }

  // 算出最近一个已经出账的账单日
  function currentBillDate(day, today0) {
    const y = today0.getFullYear();
    const m = today0.getMonth();
    let b = billDateIn(y, m, day);
    if (b >= today0) b = billDateIn(y, m - 1, day);
    return b;
  }

  // 算出下一次的账单日
  function nextBillDate(day, today0) {
    const y = today0.getFullYear();
    const m = today0.getMonth();
    const d1 = billDateIn(y, m, day);
    if (d1 >= today0) return d1;
    return billDateIn(y, m + 1, day);
  }

  // 某年某月的账单日，超出当月天数就取当月最后一天
  function billDateIn(y, m, day) {
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day, last));
  }

  function fmtDay(dt) {
    return `${dt.getFullYear()}-${global.UI.pad(dt.getMonth() + 1)}-${global.UI.pad(dt.getDate())}`;
  }

  // 倒计时条：发薪日 / 生日 / 春节 / 节日
  function countdownHtml(today0) {
    const st = global.DB.getSettings();
    const items = [];

    // 生日类只提前 30 天内显示，过了 3 天就不再显示；节日存的是完整日期
    function add(label, dt, maxDays) {
      if (!dt) return;
      const days = Math.round((new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) - today0) / 86400000);
      if (maxDays !== undefined && (days > maxDays || days < -3)) return;
      const txt = days === 0 ? '就是今天' : (days > 0 ? `还有 ${days} 天` : `已过 ${-days} 天`);
      items.push({ label, txt, days });
    }

    // 发薪日，每月循环
    if (st.payday && st.payday.show && st.payday.day >= 1 && st.payday.day <= 31) {
      add('发薪日', nextBillDate(st.payday.day, today0));
    }

    // 我的生日，每年循环，临近 30 天才显示
    if (st.myBirthday && st.myBirthday.show && /^\d{1,2}-\d{1,2}$/.test(st.myBirthday.date)) {
      const lunar = st.myBirthday.cal === 'lunar';
      const dt = lunar ? nextLunarMonthDay(st.myBirthday.date, today0) : nextMonthDay(st.myBirthday.date, today0);
      add('我的生日' + (lunar ? '（农历）' : ''), dt, 30);
    }

    // 春节，设置里手动填了就用填的
    if (st.cny && st.cny.show && st.cny.date) {
      add('春节', global.UI.parseDate(st.cny.date));
    }

    // 别人的生日
    (st.birthdays || []).forEach((b) => {
      if (!b.show || !b.date) return;
      const lunar = b.cal === 'lunar';
      const dt = lunar ? nextLunarMonthDay(b.date, today0) : nextMonthDay(b.date, today0);
      add((b.name || '生日') + (lunar ? '（农历）' : ''), dt, 30);
    });

    // 喜欢的节日
    (st.festivals || []).forEach((f) => {
      if (!f.show || !f.date) return;
      add(f.name || '节日', global.UI.parseDate(f.date));
    });

    if (!items.length) return '';
    items.sort((a, b) => a.days - b.days);
    return `
      <div class="count-strip">
        ${items.map((it) => `<span class="count-chip${it.days === 0 ? ' today' : ''}"><b>${global.UI.esc(it.label)}</b><span class="cc-days">${it.txt}</span></span>`).join('')}
      </div>`;
  }

  // 解析 'MM-DD'，返回今年或明年的下一个循环日期
  function nextMonthDay(md, today0) {
    const mm = /^(\d{1,2})-(\d{1,2})/.exec(String(md).trim());
    if (!mm) return null;
    const mo = +mm[1];
    const dy = +mm[2];
    const y = today0.getFullYear();
    let d1 = new Date(y, mo - 1, Math.min(dy, new Date(y, mo, 0).getDate()));
    if (d1 < today0) d1 = new Date(y + 1, mo - 1, Math.min(dy, new Date(y + 1, mo, 0).getDate()));
    return d1;
  }

  // 农历 'MM-DD' 转成下一个对应的公历日期
  function nextLunarMonthDay(md, today0) {
    const mm = /^(\d{1,2})-(\d{1,2})$/.exec(String(md).trim());
    if (!mm) return null;
    const SL = global.solarlunar;
    if (!SL || !SL.lunar2solar) return null;
    const mo = +mm[1];
    const dy = +mm[2];
    const years = [today0.getFullYear(), today0.getFullYear() + 1];
    for (let i = 0; i < years.length; i++) {
      let r = null;
      try { r = SL.lunar2solar(years[i], mo, dy); } catch (e) { r = null; }
      if (r && r.cYear) {
        const dt = new Date(r.cYear, r.cMonth - 1, r.cDay);
        if (dt >= today0) return dt;
      }
    }
    return null;
  }

  // 算出下一个春节
  function nextCny(y, now) {
    // 设置里手动填了春节就用填的
    try {
      const st = global.DB.getSettings();
      if (st && st.cny && st.cny.date) {
        const c = global.UI.parseDate(st.cny.date);
        if (c) return c;
      }
    } catch (e) { /* 设置读不到就按内置表算 */ }

    if (CNYS[y]) {
      const m = /^(\d{2})-(\d{2})$/.exec(CNYS[y]);
      const d1 = new Date(y, +m[1] - 1, +m[2]);
      if (d1 >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return d1;
    }
    if (CNYS[y + 1]) {
      const m = /^(\d{2})-(\d{2})$/.exec(CNYS[y + 1]);
      return new Date(y + 1, +m[1] - 1, +m[2]);
    }
    return new Date(y + 1, 1, 10); // 内置表里没有就估个大概
  }

  // 时光轴：按时间倒序分页，每页 20 条
  function loadMore() {
    const list = global.DB.get().walletdiary.slice().sort((a, b) => (b.wtime || '').localeCompare(a.wtime || ''));
    const tl = document.getElementById('timeline');
    const moreBtn = document.getElementById('tl-more');
    const frag = document.createDocumentFragment();

    const batch = list.slice(shown, shown + PAGE_SIZE);
    let lastDay = shown > 0 ? dayOf(list[shown - 1]) : null;
    batch.forEach((b) => {
      const day = dayOf(b);
      if (day !== lastDay) {
        frag.appendChild(dayHead(day, daySums(list, day)));
        lastDay = day;
      }
      frag.appendChild(timelineItem(b));
    });

    shown += batch.length;
    tl.appendChild(frag);

    if (shown >= list.length) {
      moreBtn.style.display = 'none';
      if (!list.length && !tl.children.length) {
        tl.innerHTML = '<div class="tl-empty">还没有账单，去「我要记账」记第一笔吧 ~</div>';
      }
    } else {
      moreBtn.style.display = 'block';
    }
  }

  function dayOf(b) {
    return (b.wtime || '').slice(0, 10);
  }

  function daySums(list, day) {
    const r = { in: 0, out: 0 };
    list.forEach((b) => {
      if (dayOf(b) !== day) return;
      if (b.wtype === 1) r.in += Number(b.wamount) || 0;
      else r.out += Number(b.wamount) || 0;
    });
    return r;
  }

  function dayHead(day, sum) {
    const head = document.createElement('div');
    head.className = 'tl-day';
    head.innerHTML = `<div class="tl-date">${day}<span class="tl-sum-in">收 ${global.UI.fmtMoney(sum.in)}</span><span class="tl-sum-out">支 ${global.UI.fmtMoney(sum.out)}</span></div>`;
    return head;
  }

  function timelineItem(b) {
    const div = document.createElement('div');
    div.className = 'tl-item';
    const isIn = b.wtype === 1;
    const tool = global.DB.gongjuName(b.wtool);
    const name = global.DB.mingmuName(b.wname);
    div.innerHTML = `
      <div class="tl-logo" data-tool="${global.UI.esc(tool)}"></div>
      <div class="tl-main">
        <div class="tl-name">${global.UI.esc(name)}<span class="tag">${isIn ? '收入' : '支出'}</span><span class="tag">${b.wqtype === 1 ? '线上' : '线下'}</span></div>
        <div class="tl-meta"><span>${global.UI.esc(toolAcctLabel(b))}</span>${b.wpayname ? `<span>${global.UI.esc(b.wpayname)}</span>` : ''}<span>${global.UI.esc((b.wtime || '').slice(11, 16))}</span></div>
      </div>
      <div class="tl-amt ${isIn ? 'in' : 'out'}">${isIn ? '+' : '-'}${global.UI.fmtMoney(b.wamount)}</div>`;
    global.Icons.fillLogo(div.querySelector('.tl-logo'), tool);
    return div;
  }

  // 支付工具（账户）的显示名
  function toolAcctLabel(b) {
    const tool = global.DB.gongjuName(b.wtool);
    if (!b.wacct) return tool;
    const d = global.DB.get();
    const a = (d.accounts || []).find((x) => x.accid === b.wacct);
    if (!a) return tool;
    const t = a.acctype || '';
    // 卡类账户带账号后四位，后四位优先取工具上的卡号
    if (t === '借记卡' || t === '信用卡') {
      const q = (d.gongju || []).find((x) => x.qid === b.wtool);
      const last4 = (q && q.qlast4) || String(a.accuid || '').replace(/\D/g, '').slice(-4);
      return `${tool}(${a.accname || ''}${t}${last4 ? '-' + last4 : ''})`;
    }
    return t ? `${tool}(${t})` : tool;
  }

  // 手机端悬浮「记账」：弹窗里直接记一笔
  function openQuickRecord() {
    const d = global.DB.get();
    const nowVal = localInputValue(new Date());
    const arrow = `<button class="combo-arrow" tabindex="-1">${global.SvgIcons.get('chevron-down')}</button>`;

    // 卡类和数字人民币带账号后四位，如 借记卡6688、信用卡2588、数字人民币9999
    const acctOpts = '<option value="">请选择交易账户</option>' + d.accounts.filter((a) => !a.acchide).map((a) => {
      let t = a.acctype || '';
      if (t === '借记卡' || t === '信用卡' || t === '银行卡' || t === '数字人民币') {
        const l4 = String(a.accuid || '').replace(/\D/g, '').slice(-4);
        t = t + (l4 || '');
      }
      return `<option value="${a.accid}">${global.UI.esc(a.accname)}（${global.UI.esc(t)} · ¥${global.UI.fmtMoney(a.accmny)}）</option>`;
    }).join('');

    const body = document.createElement('div');
    body.className = 'qr-form';
    body.innerHTML = `
      <div class="field field-row"><label>记账时间</label><input type="datetime-local" id="db-time" value="${nowVal}"></div>
      <div class="field field-row"><label>记账类型</label><div class="radio-row"><div class="radio-chip income" data-v="1"><span class="dot"></span>收入</div><div class="radio-chip expense on" data-v="2"><span class="dot"></span>支出</div></div></div>
      <div class="field field-row"><label>金额（元）</label><input type="number" id="db-amount" placeholder="0.00" step="0.01" min="0" inputmode="decimal"></div>
      <div class="field"><label>款项名目</label><div class="combo"><input type="text" id="db-name" placeholder="选择或双击输入款项名目">${arrow}</div></div>
      <div class="field"><label>支付工具</label><div class="combo"><input type="text" id="db-tool" placeholder="选择或双击输入支付工具">${arrow}</div></div>
      <div class="field"><label>交易账户（必选）</label><select id="db-acct">${acctOpts}</select></div>
      <div class="field"><label>交易路径</label><div class="radio-row"><div class="radio-chip path on" data-v="1"><span class="dot"></span>线上</div><div class="radio-chip path" data-v="2"><span class="dot"></span>线下</div></div></div>
      <div class="field"><label>商户名称</label><div class="combo"><input type="text" id="db-payname" placeholder="超市 / 路边摊 / 淘宝 …或双击输入新商户">${arrow}</div></div>
      <div class="field" style="margin-bottom:0"><label>备注（可选）</label><input type="text" id="db-note" placeholder="备注"></div>`;

    let typeVal = 2;
    let pathVal = 1;
    bindRadioChips(body, '.radio-chip.income,.radio-chip.expense', (v) => { typeVal = v; });
    bindRadioChips(body, '.radio-chip.path', (v) => { pathVal = v; });

    const nameI = body.querySelector('#db-name');
    const toolI = body.querySelector('#db-tool');
    const payI = body.querySelector('#db-payname');

    global.UI.combo(nameI, () => d.mingmu.filter((m) => !m.mhide).map((m) => ({ v: m.mname, label: '编号 ' + m.mid })), null);
    global.UI.combo(toolI, () => d.gongju.filter((q) => !q.qhide).map((q) => ({ v: q.qname, label: q.qtype })), null);
    global.UI.combo(payI, () => d.shanghu.map((s) => ({ v: s })), null);

    global.UI.modal({
      title: '记一笔',
      body,
      okText: '保存账单',
      onOk: () => saveQuickBill(body, nameI, toolI, payI, typeVal, pathVal)
    });
  }

  function saveQuickBill(body, nameI, toolI, payI, typeVal, pathVal) {
    let amount = parseFloat(body.querySelector('#db-amount').value);
    if (!(amount > 0)) { global.UI.toast('请输入正确金额', 'err'); return false; }
    amount = Math.round(amount * 100) / 100;

    const nameVal = nameI.value.trim();
    const toolVal = toolI.value.trim();
    if (!nameVal) { global.UI.toast('请选择款项名目', 'err'); return false; }
    if (!toolVal) { global.UI.toast('请选择支付工具', 'err'); return false; }

    const acctId = +body.querySelector('#db-acct').value || 0;
    if (!acctId) { global.UI.toast('请选择交易账户', 'err'); return false; }

    // 下拉里选了库里没有的名目/工具就直接建一个
    const d = global.DB.get();
    const m = d.mingmu.find((x) => x.mname === nameVal && !x.mhide);
    let mid = m ? m.mid : 0;
    if (!mid) { global.DB.addMingmu(nameVal); mid = global.DB.nextMid() - 1; }
    const q = d.gongju.find((x) => x.qname === toolVal && !x.qhide);
    let qid = q ? q.qid : 0;
    if (!qid) { global.DB.addGongju(toolVal, '自定义', 0, ''); qid = global.DB.nextQid() - 1; }

    const payname = payI.value.trim();
    if (payname) global.DB.addShanghu(payname);

    const tv = body.querySelector('#db-time').value;
    const t = tv ? new Date(tv) : new Date();
    global.DB.addBill({
      wid: global.DB.nextWid(),
      wtime: fmtTime(t),
      wyear: t.getFullYear(), wmon: t.getMonth() + 1, wday: t.getDate(),
      Wmoney: amount.toFixed(2), wamount: amount,
      wtype: typeVal, wname: mid, wtool: qid, wacct: acctId, wqtype: pathVal,
      wpayname: payname, wnote: body.querySelector('#db-note').value.trim()
    });
    global.UI.toast('记账成功 ✓', 'ok');
    render(); // 圆环、时光轴、还款横幅、账户余额跟着刷新
    return true;
  }

  // 给一组单选按钮绑事件，同组里只能选一个
  function bindRadioChips(root, sel, onChange) {
    root.querySelectorAll(sel).forEach((chip) => {
      chip.addEventListener('click', () => {
        root.querySelectorAll(sel).forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
        onChange(+chip.dataset.v);
      });
    });
  }

  function fmtTime(t) {
    return `${t.getFullYear()}-${global.UI.pad(t.getMonth() + 1)}-${global.UI.pad(t.getDate())} ${global.UI.pad(t.getHours())}:${global.UI.pad(t.getMinutes())}`;
  }

  function localInputValue(t) {
    return `${t.getFullYear()}-${global.UI.pad(t.getMonth() + 1)}-${global.UI.pad(t.getDate())}T${global.UI.pad(t.getHours())}:${global.UI.pad(t.getMinutes())}`;
  }

  global.Pages = global.Pages || {};
  global.Pages.dashboard = { render: render };
})(window);
