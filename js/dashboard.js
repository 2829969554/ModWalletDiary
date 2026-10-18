/* ============================================================
 * dashboard.js — 仪表盘：今年第几天 / 四个圆环 / 时光轴
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

    // —— 今天是今年第几天 / 距年尾 / 距过年 ——
    var start = new Date(y, 0, 1);
    var today = new Date(y, now.getMonth(), now.getDate());
    var dayOfYear = Math.floor((today - start) / 86400000) + 1;
    var yearLen = ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
    var daysLeft = yearLen - dayOfYear;
    // 下一个春节（内置 2026-2030 简表，可外推）
    var cny = nextCny(y, now);
    var cnyDays = Math.ceil((cny - today) / 86400000);

    var week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    var dateStr = y + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · 星期' + week;

    // —— 汇总 ——
    var s = global.Stats.calcRange(new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59));
    var sm = global.Stats.calcRange(new Date(y, now.getMonth(), 1), new Date(y, now.getMonth() + 1, 0, 23, 59, 59));

    el.innerHTML =
      payAlertsHtml(today) +
      '<div class="day-strip">' +
        '<div class="ds-today">' + dateStr + '<b>' + y + '年的第 ' + dayOfYear + ' 天</b></div>' +
        '<div class="ds-sep"></div>' +
        '<div class="ds-item"><div class="ds-num">' + daysLeft + '</div><div class="ds-label">天到年尾</div></div>' +
        '<div class="ds-sep"></div>' +
        '<div class="ds-item"><div class="ds-num">' + (cnyDays > 0 ? cnyDays : 0) + '</div><div class="ds-label">天到过年</div></div>' +
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
      '</div>';

    drawRings(s, sm);
    shown = 0;
    document.getElementById('timeline').innerHTML = '';
    loadMore();
    document.getElementById('tl-more').addEventListener('click', loadMore);

    /* 还款提醒横幅按钮 */
    el.querySelectorAll('.pay-alert .pa-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.act === 'paid') {
          // 已还款：记录本期账单日，到下个账单日临近时再提醒
          global.DB.markToolPaid(+btn.dataset.qid, btn.dataset.bill);
          global.UI.toast('已记录「' + btn.dataset.name + '」本期还款', 'ok');
          render();
        } else {
          // 临时关闭：本次会话内不再显示（刷新后恢复）
          TEMP_DISMISS[+btn.dataset.qid] = 1;
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
    // 按日分组渲染
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
        '<div class="tl-meta"><span>' + global.UI.esc(tool) + '</span>' +
          (b.wpayname ? '<span>' + global.UI.esc(b.wpayname) + '</span>' : '') +
          '<span>' + global.UI.esc((b.wtime || '').slice(11, 16)) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="tl-amt ' + (isIn ? 'in' : 'out') + '">' + (isIn ? '+' : '-') + global.UI.fmtMoney(b.wamount) + '</div>';
    var logoEl = div.querySelector('.tl-logo');
    global.Icons.fillLogo(logoEl, tool);
    return div;
  }

  /* ---------- 信用卡/花呗/借呗 还款提醒横幅（账单日临近一周） ---------- */
  function payAlertsHtml(today0) {
    var d = global.DB.get();
    var list = d.gongju.filter(function (q) { return q.qday && !q.qhide; }).map(function (q) {
      var nb = nextBillDate(+q.qday, today0);
      return { q: q, nb: nb, days: Math.round((nb - today0) / 86400000) };
    }).filter(function (x) {
      return x.days <= 7 && x.q.qpaid !== fmtDay(x.nb) && !TEMP_DISMISS[x.q.qid];
    }).sort(function (a, b) { return a.days - b.days; });

    return list.map(function (x) {
      var ds = x.days === 0 ? '就是今天' : '还有 ' + x.days + ' 天';
      return '<div class="pay-alert">' +
        '<div class="pa-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg></div>' +
        '<div class="pa-main"><b>' + global.UI.esc(x.q.qname) + '</b>（' + global.UI.esc(x.q.qtype || '信用卡') + '）账单日 ' +
          (x.nb.getMonth() + 1) + '月' + x.nb.getDate() + '日，' + ds +
          '<small>出账日临近，请提前安排还款</small></div>' +
        '<button class="pa-btn paid" data-act="paid" data-qid="' + x.q.qid + '" data-bill="' + fmtDay(x.nb) + '" data-name="' + global.UI.esc(x.q.qname) + '">已还款</button>' +
        '<button class="pa-btn temp" data-act="temp" data-qid="' + x.q.qid + '">临时关闭</button>' +
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

  /* 春节日期（2026-2036，农历正月初一公历日期） */
  var CNYS = {
    2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03',
    2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08',
    2036: '01-28'
  };
  function nextCny(y, now) {
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

  global.Pages = global.Pages || {};
  global.Pages.dashboard = { render: render };
})(window);
