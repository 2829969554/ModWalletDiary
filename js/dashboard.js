/* ============================================================
 * dashboard.js — 仪表盘
 * 顶部：还款提醒横幅（账单日临近7天黄色 / 3天红色）
 *      倒计时条（发薪日/我的生日/春节/其他生日/节日）
 * 今天第几天 / 四个圆环 / 时光轴
 * ============================================================ */
(function (global) {
  'use strict';

  var PAGE_SIZE = 20; // 时光轴每次加载数量
  var shown = 0;
  var TEMP_DISMISS = {}; // 「临时关闭」的还款提醒（仅本次会话有效）

  function render() {
    var el = document.getElementById('page-dashboard');
    var d = global.DB.get();
    var now = new Date();
    var y = now.getFullYear();

    // 每次回到仪表盘时刷新显示模式（auto 模式跨越 7:00/18:00 边界自动切换）
    if (global.UI && global.UI.applyTheme) global.UI.applyTheme(global.DB.getSettings().theme);

    // —— 今天是今年第几天 / 距年尾 / 距过年 ——
    var start = new Date(y, 0, 1);
    var today = new Date(y, now.getMonth(), now.getDate());
    var dayOfYear = Math.floor((today - start) / 86400000) + 1;
    var yearLen = ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
    var daysLeft = yearLen - dayOfYear;
    // 下一个春节（内置 2026-2036 简表，可外推 / 或手动指定）
    var cny = nextCny(y, now);
    var cnyDays = Math.ceil((cny - today) / 86400000);
    var cnyNum = cnyDays > 0 ? cnyDays : 0;
    // 手机端：距离年底/距离春节只显示数字更小的一个；且距离春节不受设置页隐藏按钮管理
    var isMobile = window.innerWidth <= 768;
    var stripMid;
    if (isMobile) {
      stripMid = (cnyNum <= daysLeft)
        ? '<div class="ds-sep"></div><div class="ds-item"><div class="ds-num">' + cnyNum + '</div><div class="ds-label">距离春节</div></div>'
        : '<div class="ds-sep"></div><div class="ds-item"><div class="ds-num">' + daysLeft + '</div><div class="ds-label">距离年底</div></div>';
    } else {
      stripMid =
        '<div class="ds-sep"></div><div class="ds-item"><div class="ds-num">' + daysLeft + '</div><div class="ds-label">距离年底</div></div>' +
        '<div class="ds-sep"></div><div class="ds-item"><div class="ds-num">' + cnyNum + '</div><div class="ds-label">距离春节</div></div>';
    }

    var week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    var dateStr = y + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · 星期' + week;

    // —— 汇总 ——
    var s = global.Stats.calcRange(new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59));
    var sm = global.Stats.calcRange(new Date(y, now.getMonth(), 1), new Date(y, now.getMonth() + 1, 0, 23, 59, 59));

    var alertsHtml = payAlertsHtml(today);
    el.innerHTML =
      (alertsHtml ? '<div class="pay-alert-layer">' + alertsHtml + '</div>' : '') +
      countdownHtml(today) +
      '<div class="day-strip">' +
        '<div class="ds-today">' + dateStr + '<b>' + y + '年的第 ' + dayOfYear + ' 天</b></div>' +
        stripMid +
      '</div>' +

      '<div class="rings">' +
        ring('year-in', '今年总收入', s.in, '#10b981', arrowUp()) +
        ring('year-out', '今年总支出', s.out, '#f43f5e', arrowDown()) +
        ring('mon-in', '本月总收入', sm.in, '#10b981', arrowUp()) +
        ring('mon-out', '本月总支出', sm.out, '#f43f5e', arrowDown()) +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>时光轴 <small style="font-weight:400;color:var(--muted)">最近收支明细</small></div>' +
        '<div id="timeline" class="timeline"></div>' +
        '<button id="tl-more" class="tl-more" style="display:none">加载更多 ↓</button>' +
      '</div>' +

      '<button id="db-fab" class="tl-fab fab-rec" title="记一笔" aria-label="记一笔">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' +
        '<span class="fab-rec-label">记账</span>' +
      '</button>';

    drawRings(s, sm);
    shown = 0;
    document.getElementById('timeline').innerHTML = '';
    loadMore();
    document.getElementById('tl-more').addEventListener('click', loadMore);
    var fab = document.getElementById('db-fab');
    if (fab) fab.addEventListener('click', openQuickRecord);

    /* 还款提醒横幅按钮 */
    el.querySelectorAll('.pay-alert .pa-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.act === 'paid') {
          var id = +btn.dataset.id;
          var bill = btn.dataset.bill;
          if (btn.dataset.kind === 'acct') global.DB.markAccountPaid(id, bill);
          else global.DB.markToolPaid(id, bill);
          global.UI.toast('已记录「' + btn.dataset.name + '」本期还款', 'ok');
          render();
        } else {
          TEMP_DISMISS[btn.dataset.key] = 1;
          var card = btn.closest('.pay-alert');
          if (card) card.remove();
        }
      });
    });
  }

  function arrowUp() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  }
  function arrowDown() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
  }

  function ring(id, label, val, color, icon) {
    return '<div class="ring-card">' +
      '<div class="ring-wrap"><canvas id="' + id + '"></canvas>' +
      '<div class="ring-center"><span class="rc-icon">' + icon + '</span><span class="rc-label">' + label + '</span></div></div>' +
      '<div class="ring-val ' + (label.indexOf('收入') > -1 ? 'green' : 'red') + '">¥ ' + global.UI.fmtMoney(val) + '</div>' +
      '<div class="ring-sub">' + label + '</div>' +
      '</div>';
  }

  function drawRings(s, sm) {
    function mk(id, val, color) {
      var cv = document.getElementById(id);
      if (!cv) return;
      var pct = Math.max(0, Math.min(1, val / 100000)); // 10万封顶为满圈
      var size = 108;
      cv.width = size * 2; cv.height = size * 2;
      cv.style.width = size + 'px'; cv.style.height = size + 'px';
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
    mk('year-in', s.in, '#10b981');
    mk('year-out', s.out, '#f43f5e');
    mk('mon-in', sm.in, '#10b981');
    mk('mon-out', sm.out, '#f43f5e');
  }

  /* ==================== 信用卡还款提醒横幅 ====================
   * 出账日（账单日）之后开始提醒；最晚还款日 = 账单日 + 15 天
   * 颜色随剩余还款天数逐渐加深：橙黄 → 橙 → 橙红 → 红 → 深红；
   * 超出最晚还款日（逾期）为深红 + 橙色结合
   */
  var DUE_OFFSET = 15; // 最晚还款日 = 账单日后 15 天

  // 最近一个已到的账单日（<= today），即当前账单周期
  function currentBillDate(day, today0) {
    var y = today0.getFullYear(), m = today0.getMonth();
    var b = billDateIn(y, m, day);
    if (b > today0) b = billDateIn(y, m - 1, day);
    return b;
  }

  function alertLevel(left) { // left = 距最晚还款日剩余天数
    if (left < 0) return 'overdue';
    if (left === 0) return 'due';
    if (left <= 2) return 'red';
    if (left <= 4) return 'deep';
    if (left <= 7) return 'orange';
    return 'yellow';
  }

  function payAlertsHtml(today0) {
    var d = global.DB.get();
    var list = [];

    function pushItem(key, kind, id, name, type, last4, day, paidMark) {
      var B = currentBillDate(day, today0);                       // 本期账单日
      var D = new Date(B.getFullYear(), B.getMonth(), B.getDate() + DUE_OFFSET); // 最晚还款日
      if (paidMark === fmtDay(B)) return;                         // 本期已还款
      if (TEMP_DISMISS[key]) return;                              // 临时关闭
      var left = Math.round((D - today0) / 86400000);
      list.push({ key: key, kind: kind, id: id, name: name, type: type, last4: last4, B: B, D: D, left: left });
    }

    d.gongju.forEach(function (q) {
      if (!q.qday || q.qhide) return;
      pushItem('q' + q.qid, 'tool', q.qid, q.qname, q.qtype || '信用卡',
        String(q.qlast4 || '').replace(/\D/g, '').slice(-4), +q.qday, q.qpaid);
    });
    d.accounts.forEach(function (a) {
      if (!global.DB.isCreditAcct(a.acctype) || !a.accday || a.acchide) return;
      pushItem('a' + a.accid, 'acct', a.accid, a.accname, (a.acctype || '信用卡') + '账户',
        String(a.accuid || '').replace(/\D/g, '').slice(-4), +a.accday, a.accpaid);
    });
    list.sort(function (x, y) { return x.left - y.left; });

    return list.map(function (x) {
      var level = alertLevel(x.left);
      var status;
      if (x.left > 0) status = '距最晚还款还有 ' + x.left + ' 天';
      else if (x.left === 0) status = '今天是最晚还款日';
      else status = '已逾期 ' + (-x.left) + ' 天，请立即还款';
      return '<div class="pay-alert ' + level + '">' +
        '<div class="pa-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg></div>' +
        '<div class="pa-main"><b>' + global.UI.esc(x.name) + '</b>（' + global.UI.esc(x.type) + (x.last4 ? '-' + x.last4 : '') + '）账单日 ' +
          (x.B.getMonth() + 1) + '月' + x.B.getDate() + '日出账，最晚还款日 ' + (x.D.getMonth() + 1) + '月' + x.D.getDate() + '日' +
          '<small>' + status + '</small></div>' +
        '<button class="pa-btn paid" data-act="paid" data-kind="' + x.kind + '" data-id="' + x.id + '" data-bill="' + fmtDay(x.B) + '" data-name="' + global.UI.esc(x.name) + '">已还款</button>' +
        '<button class="pa-btn temp" data-act="temp" data-key="' + x.key + '">临时关闭</button>' +
      '</div>';
    }).join('');
  }

  function nextBillDate(day, today0) {
    var y = today0.getFullYear(), m = today0.getMonth();
    var d1 = billDateIn(y, m, day);
    if (d1 >= today0) return d1;
    return billDateIn(y, m + 1, day);
  }
  function billDateIn(y, m, day) {
    var last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day, last));
  }
  function fmtDay(dt) {
    return dt.getFullYear() + '-' + global.UI.pad(dt.getMonth() + 1) + '-' + global.UI.pad(dt.getDate());
  }

  /* ==================== 倒计时条（设置里的日期项） ==================== */
  function countdownHtml(today0) {
    var st = global.DB.getSettings();
    var items = [];

    function push(label, dateObj, maxDays) {
      if (!dateObj || dateObj.show === false) return;
      var dt = dateObj._date || null;
      if (!dt) return;
      var days = Math.round((new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) - today0) / 86400000);
      if (maxDays !== undefined && (days > maxDays || days < -3)) return; // 生日类：仅临近 30 天内显示（已过超过 3 天不再显示）
      var txt = days === 0 ? '就是今天' : (days > 0 ? '还有 ' + days + ' 天' : '已过 ' + (-days) + ' 天');
      items.push({ label: label, txt: txt, days: days, tone: '' });
    }

    // 发薪日（每月循环）
    if (st.payday && st.payday.show && st.payday.day >= 1 && st.payday.day <= 31) {
      var pd = nextBillDate(st.payday.day, today0);
      push('发薪日', { _date: pd, show: true });
    }
    // 我的生日（公历/农历，每年循环，临近 30 天才显示）
    if (st.myBirthday && st.myBirthday.show && /^\d{1,2}-\d{1,2}$/.test(st.myBirthday.date)) {
      var isLunar = st.myBirthday.cal === 'lunar';
      var mbDate = isLunar ? nextLunarMonthDay(st.myBirthday.date, today0) : nextMonthDay(st.myBirthday.date, today0);
      push('我的生日' + (isLunar ? '（农历）' : ''), { _date: mbDate, show: true }, 30);
    }
    // 春节（优先手动，其次内置）
    if (st.cny && st.cny.show && st.cny.date) {
      var c = global.UI.parseDate(st.cny.date);
      if (c) push('春节', { _date: c, show: true });
    }
    // 其他人生日（公历/农历，临近 30 天才显示）
    (st.birthdays || []).forEach(function (b) {
      if (b.show && b.date) {
        var bl = b.cal === 'lunar';
        var bd = bl ? nextLunarMonthDay(b.date, today0) : nextMonthDay(b.date, today0);
        push((b.name || '生日') + (bl ? '（农历）' : ''), { _date: bd, show: true }, 30);
      }
    });
    // 喜欢的节日（完整日期，一次性）
    (st.festivals || []).forEach(function (f) {
      if (f.show && f.date) {
        var fd = global.UI.parseDate(f.date);
        if (fd) push(f.name || '节日', { _date: fd, show: true }, '');
      }
    });

    if (!items.length) return '';
    items.sort(function (a, b) { return a.days - b.days; });
    return '<div class="count-strip">' +
      items.map(function (it) {
        return '<span class="count-chip' + (it.days === 0 ? ' today' : '') + '"><b>' + global.UI.esc(it.label) + '</b>' +
          '<span class="cc-days">' + it.txt + '</span></span>';
      }).join('') +
      '</div>';
  }

  // 解析 'MM-DD'（或 'YYYY-MM-DD' 取月日），返回下一个循环日期
  function nextMonthDay(md, today0) {
    var mm = /^(\d{1,2})-(\d{1,2})/.exec(String(md).trim());
    if (!mm) return null;
    var mo = +mm[1], dy = +mm[2];
    var y = today0.getFullYear();
    var d1 = new Date(y, mo - 1, Math.min(dy, new Date(y, mo, 0).getDate()));
    if (d1 < today0) d1 = new Date(y + 1, mo - 1, Math.min(dy, new Date(y + 1, mo, 0).getDate()));
    return d1;
  }

  // 农历 'MM-DD'（农历月-日）→ 下一个对应的公历日期（用本地 solarlunar 库换算）
  function nextLunarMonthDay(md, today0) {
    var mm = /^(\d{1,2})-(\d{1,2})$/.exec(String(md).trim());
    if (!mm) return null;
    var SL = global.solarlunar;
    if (!SL || !SL.lunar2solar) return null;
    var mo = +mm[1], dy = +mm[2];
    var years = [today0.getFullYear(), today0.getFullYear() + 1];
    for (var i = 0; i < years.length; i++) {
      var r = null;
      try { r = SL.lunar2solar(years[i], mo, dy); } catch (e) { r = null; }
      if (r && r.cYear) {
        var dt = new Date(r.cYear, r.cMonth - 1, r.cDay);
        if (dt >= today0) return dt;
      }
    }
    return null;
  }

  /* ---------- 时光轴 ---------- */
  function loadMore() {
    var d = global.DB.get();
    var list = d.walletdiary.slice().sort(function (a, b) {
      return (b.wtime || '').localeCompare(a.wtime || '');
    });
    var tl = document.getElementById('timeline');
    var moreBtn = document.getElementById('tl-more');
    var frag = document.createDocumentFragment();

    var batch = list.slice(shown, shown + PAGE_SIZE);
    var lastDay = shown > 0 ? dayOf(list[shown - 1]) : null;
    batch.forEach(function (b) {
      var day = dayOf(b);
      if (day !== lastDay) {
        var daySum = daySums(list, day);
        var head = document.createElement('div');
        head.className = 'tl-day';
        head.innerHTML = '<div class="tl-date">' + day +
          '<span class="tl-sum-in">收 ' + global.UI.fmtMoney(daySum.in) + '</span>' +
          '<span class="tl-sum-out">支 ' + global.UI.fmtMoney(daySum.out) + '</span></div>';
        frag.appendChild(head);
        lastDay = day;
      }
      frag.appendChild(item(b));
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

  function dayOf(b) { return (b.wtime || '').slice(0, 10); }

  function daySums(list, day) {
    var r = { in: 0, out: 0 };
    list.forEach(function (b) {
      if (dayOf(b) !== day) return;
      if (b.wtype === 1) r.in += Number(b.wamount) || 0;
      else r.out += Number(b.wamount) || 0;
    });
    return r;
  }

  /* 支付工具(账户) 显示格式：
   * 普通账户：工具名(账户类型)，如 微信支付(零钱)、微信支付(零钱通)、支付宝(余额)
   * 借记卡/信用卡账户：工具名(账户名称+类型-后四位)
   *   如 微信支付(中国银行信用卡-8888)、支付宝(招商银行借记卡-8888)
   * 后四位优先取工具的卡号后四位 qlast4，其次取账户卡号尾号
   */
  function toolAcctLabel(b) {
    var tool = global.DB.gongjuName(b.wtool);
    if (!b.wacct) return tool;
    var a = (global.DB.get().accounts || []).find(function (x) { return x.accid === b.wacct; });
    if (!a) return tool;
    var t = a.acctype || '';
    if (t === '借记卡' || t === '信用卡') {
      var q = (global.DB.get().gongju || []).find(function (x) { return x.qid === b.wtool; });
      var last4 = (q && q.qlast4) || String(a.accuid || '').replace(/\D/g, '').slice(-4);
      return tool + '(' + (a.accname || '') + t + (last4 ? '-' + last4 : '') + ')';
    }
    return t ? tool + '(' + t + ')' : tool;
  }

  function item(b) {
    var div = document.createElement('div');
    div.className = 'tl-item';
    var isIn = b.wtype === 1;
    var tool = global.DB.gongjuName(b.wtool);
    var name = global.DB.mingmuName(b.wname);
    div.innerHTML =
      '<div class="tl-logo" data-tool="' + global.UI.esc(tool) + '"></div>' +
      '<div class="tl-main">' +
        '<div class="tl-name">' + global.UI.esc(name) +
          '<span class="tag">' + (isIn ? '收入' : '支出') + '</span>' +
          (b.wqtype === 1 ? '<span class="tag">线上</span>' : '<span class="tag">线下</span>') +
        '</div>' +
        '<div class="tl-meta"><span>' + global.UI.esc(toolAcctLabel(b)) + '</span>' +
          (b.wpayname ? '<span>' + global.UI.esc(b.wpayname) + '</span>' : '') +
          '<span>' + global.UI.esc((b.wtime || '').slice(11, 16)) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="tl-amt ' + (isIn ? 'in' : 'out') + '">' + (isIn ? '+' : '-') + global.UI.fmtMoney(b.wamount) + '</div>';
    var logoEl = div.querySelector('.tl-logo');
    global.Icons.fillLogo(logoEl, tool);
    return div;
  }

  /* 春节日期（2026-2036，农历正月初一公历日期） */
  var CNYS = {
    2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03',
    2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08',
    2036: '01-28'
  };
  function nextCny(y, now) {
    // 优先使用设置里的春节日期
    try {
      var st = global.DB.getSettings();
      if (st && st.cny && st.cny.date) {
        var c = global.UI.parseDate(st.cny.date);
        if (c) return c;
      }
    } catch (e) { /* ignore */ }
    var m;
    if (CNYS[y]) {
      m = /^(\d{2})-(\d{2})$/.exec(CNYS[y]);
      var d1 = new Date(y, +m[1] - 1, +m[2]);
      if (d1 >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return d1;
    }
    if (CNYS[y + 1]) {
      m = /^(\d{2})-(\d{2})$/.exec(CNYS[y + 1]);
      return new Date(y + 1, +m[1] - 1, +m[2]);
    }
    return new Date(y + 1, 1, 10); // 兜底
  }

  /* ==================== 手机端悬浮「+记账」：弹窗内嵌「记一笔」表单 ==================== */
  function openQuickRecord() {
    var d = global.DB.get();
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    var t0 = new Date();
    var nowVal = t0.getFullYear() + '-' + p2(t0.getMonth() + 1) + '-' + p2(t0.getDate()) + 'T' + p2(t0.getHours()) + ':' + p2(t0.getMinutes());
    var arrow = '<button class="combo-arrow" tabindex="-1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>';
    var acctOpts = '<option value="">请选择交易账户</option>' + d.accounts.filter(function (a) { return !a.acchide; }).map(function (a) {
      var t = a.acctype || '';
      if (t === '借记卡' || t === '信用卡' || t === '银行卡') {
        var l4 = String(a.accuid || '').replace(/\D/g, '').slice(-4);
        t = t + (l4 || '');
      }
      return '<option value="' + a.accid + '">' + global.UI.esc(a.accname) + '（' + global.UI.esc(t) + ' · ¥' + global.UI.fmtMoney(a.accmny) + '）</option>';
    }).join('');

    var body = document.createElement('div');
    body.className = 'qr-form';
    body.innerHTML =
      '<div class="field field-row"><label>记账时间</label><input type="datetime-local" id="db-time" value="' + nowVal + '"></div>' +
      '<div class="field field-row"><label>记账类型</label><div class="radio-row">' +
        '<div class="radio-chip income" data-v="1"><span class="dot"></span>收入</div>' +
        '<div class="radio-chip expense on" data-v="2"><span class="dot"></span>支出</div></div></div>' +
      '<div class="field field-row"><label>金额（元）</label><input type="number" id="db-amount" placeholder="0.00" step="0.01" min="0" inputmode="decimal"></div>' +
      '<div class="field"><label>款项名目</label><div class="combo"><input type="text" id="db-name" placeholder="选择或双击输入款项名目">' + arrow + '</div></div>' +
      '<div class="field"><label>支付工具</label><div class="combo"><input type="text" id="db-tool" placeholder="选择或双击输入支付工具">' + arrow + '</div></div>' +
      '<div class="field"><label>交易账户（必选）</label><select id="db-acct">' + acctOpts + '</select></div>' +
      '<div class="field"><label>交易路径</label><div class="radio-row">' +
        '<div class="radio-chip path on" data-v="1"><span class="dot"></span>线上</div>' +
        '<div class="radio-chip path" data-v="2"><span class="dot"></span>线下</div></div></div>' +
      '<div class="field"><label>商户名称</label><div class="combo"><input type="text" id="db-payname" placeholder="超市 / 路边摊 / 淘宝 …或双击输入新商户">' + arrow + '</div></div>' +
      '<div class="field" style="margin-bottom:0"><label>备注（可选）</label><input type="text" id="db-note" placeholder="备注"></div>';

    var typeVal = 2, pathVal = 1;
    body.querySelectorAll('.radio-chip.income,.radio-chip.expense').forEach(function (chip) {
      chip.addEventListener('click', function () {
        body.querySelectorAll('.radio-chip.income,.radio-chip.expense').forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        typeVal = +chip.dataset.v;
      });
    });
    body.querySelectorAll('.radio-chip.path').forEach(function (chip) {
      chip.addEventListener('click', function () {
        body.querySelectorAll('.radio-chip.path').forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        pathVal = +chip.dataset.v;
      });
    });

    var nameI = body.querySelector('#db-name');
    var toolI = body.querySelector('#db-tool');
    var payI = body.querySelector('#db-payname');
    global.UI.combo(nameI, function () {
      return d.mingmu.filter(function (m) { return !m.mhide; }).map(function (m) { return { v: m.mname, label: '编号 ' + m.mid }; });
    }, null);
    global.UI.combo(toolI, function () {
      return d.gongju.filter(function (q) { return !q.qhide; }).map(function (q) { return { v: q.qname, label: q.qtype }; });
    }, null);
    global.UI.combo(payI, function () {
      return d.shanghu.map(function (s) { return { v: s }; });
    }, null);

    global.UI.modal({
      title: '记一笔',
      body: body,
      okText: '保存账单',
      onOk: function () {
        var amount = parseFloat(body.querySelector('#db-amount').value);
        if (!(amount > 0)) { global.UI.toast('请输入正确金额', 'err'); return false; }
        amount = Math.round(amount * 100) / 100;
        var nameVal = nameI.value.trim();
        var toolVal = toolI.value.trim();
        if (!nameVal) { global.UI.toast('请选择款项名目', 'err'); return false; }
        if (!toolVal) { global.UI.toast('请选择支付工具', 'err'); return false; }
        var acctId = +body.querySelector('#db-acct').value || 0;
        if (!acctId) { global.UI.toast('请选择交易账户', 'err'); return false; }

        var dd = global.DB.get();
        var m = dd.mingmu.find(function (x) { return x.mname === nameVal && !x.mhide; });
        var mid = m ? m.mid : 0;
        if (!mid) { global.DB.addMingmu(nameVal); mid = global.DB.nextMid() - 1; }
        var q = dd.gongju.find(function (x) { return x.qname === toolVal && !x.qhide; });
        var qid = q ? q.qid : 0;
        if (!qid) { global.DB.addGongju(toolVal, '自定义', 0, ''); qid = global.DB.nextQid() - 1; }

        var payname = payI.value.trim();
        if (payname) global.DB.addShanghu(payname);

        var tv = body.querySelector('#db-time').value;
        var t = tv ? new Date(tv) : new Date();
        global.DB.addBill({
          wid: global.DB.nextWid(),
          wtime: t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()) + ' ' + p2(t.getHours()) + ':' + p2(t.getMinutes()),
          wyear: t.getFullYear(), wmon: t.getMonth() + 1, wday: t.getDate(),
          Wmoney: amount.toFixed(2), wamount: amount,
          wtype: typeVal, wname: mid, wtool: qid, wacct: acctId, wqtype: pathVal,
          wpayname: payname, wnote: body.querySelector('#db-note').value.trim()
        });
        global.UI.toast('记账成功 ✓', 'ok');
        render(); // 时光轴、圆环、还款横幅、账户余额动态刷新
        return true;
      }
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.dashboard = { render: render };
})(window);
