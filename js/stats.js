/* ============================================================
 * stats.js — 统计：时间范围 / 指定月份 / 指定周
 * 表格：每个款项名目的总支出、总收入
 * ============================================================ */
(function (global) {
  'use strict';

  // 预设：3年 1年 半年 3个月
  var PRESETS = [
    { key: '3y', label: '3年', months: 36 },
    { key: '1y', label: '1年', months: 12 },
    { key: '6m', label: '半年', months: 6 },
    { key: '3m', label: '3个月', months: 3 }
  ];

  var state = { mode: 'preset', preset: '1y', month: '', week: '' };

  function rangeOf() {
    var now = new Date();
    if (state.mode === 'preset') {
      var p = PRESETS.find(function (x) { return x.key === state.preset; }) || PRESETS[1];
      var from = new Date(now.getFullYear(), now.getMonth() - (p.months - 1), 1);
      return { from: from, to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59), label: p.label };
    }
    if (state.mode === 'month') {
      if (!state.month) return null;
      var m = /^(\d{4})-(\d{1,2})$/.exec(state.month);
      if (!m) return null;
      var y = +m[1], mo = +m[2];
      return { from: new Date(y, mo - 1, 1), to: new Date(y, mo, 0, 23, 59, 59), label: y + '年' + mo + '月' };
    }
    if (state.mode === 'week') {
      if (!state.week) return null;
      var d = global.UI.parseDate(state.week);
      if (!d) return null;
      var dow = (d.getDay() + 6) % 7; // 周一=0
      var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
      var sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 6, 23, 59, 59);
      return { from: mon, to: sun, label: fmt(mon) + ' ~ ' + fmt(sun) + '（周）' };
    }
    return null;
  }
  function fmt(d) { return d.getFullYear() + '-' + global.UI.pad(d.getMonth() + 1) + '-' + global.UI.pad(d.getDate()); }

  /* 供 dashboard 调用 */
  function calcRange(from, to) {
    var d = global.DB.get();
    var r = { in: 0, out: 0 };
    d.walletdiary.forEach(function (b) {
      var t = global.UI.parseDate(b.wtime);
      if (!t) return;
      if (t >= from && t <= to) {
        if (b.wtype === 1) r.in += Number(b.wamount) || 0;
        else r.out += Number(b.wamount) || 0;
      }
    });
    return r;
  }

  function render() {
    var el = document.getElementById('page-stats');
    var d = global.DB.get();

    // 可选月份集合（有账单的月份 + 最近12个月）
    var months = {};
    d.walletdiary.forEach(function (b) {
      var t = global.UI.parseDate(b.wtime);
      if (t) months[t.getFullYear() + '-' + global.UI.pad(t.getMonth() + 1)] = 1;
    });
    var now = new Date();
    for (var i = 0; i < 12; i++) {
      months[now.getFullYear() + '-' + global.UI.pad(now.getMonth() + 1 - i + 12 * Math.floor(i / 12) * 0)] = 1;
    }
    var monthOpts = Object.keys(months).sort().reverse().slice(0, 24);

    el.innerHTML =
      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>统计范围</div>' +
        '<div class="chip-row" id="st-chips">' +
          PRESETS.map(function (p) {
            return '<button class="chip' + (state.mode === 'preset' && state.preset === p.key ? ' on' : '') + '" data-mode="preset" data-key="' + p.key + '">' + p.label + '</button>';
          }).join('') +
          '<button class="chip' + (state.mode === 'month' ? ' on' : '') + '" data-mode="month">指定月份</button>' +
          '<button class="chip' + (state.mode === 'week' ? ' on' : '') + '" data-mode="week">指定周</button>' +
        '</div>' +
        '<div style="margin-top:12px" id="st-picker"></div>' +
      '</div>' +
      '<div id="st-result"></div>';

    bindChips(el);
    renderPicker(el);
    renderResult(el);
  }

  function bindChips(el) {
    el.querySelectorAll('#st-chips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.mode = chip.dataset.mode;
        if (state.mode === 'preset') state.preset = chip.dataset.key;
        render();
      });
    });
  }

  function renderPicker(el) {
    var picker = el.querySelector('#st-picker');
    if (state.mode === 'preset') { picker.hidden = true; return; }
    picker.hidden = false;
    if (state.mode === 'month') {
      picker.innerHTML =
        '<div class="field" style="max-width:260px;margin-bottom:0"><label>选择月份</label>' +
        '<input type="month" id="st-month" value="' + (state.month || global.UI.today().slice(0, 7)) + '"></div>';
      picker.querySelector('#st-month').addEventListener('change', function (e) {
        state.month = e.target.value;
        renderResult(el);
      });
    } else {
      picker.innerHTML =
        '<div class="field" style="max-width:260px;margin-bottom:0"><label>选择周内任意一天</label>' +
        '<input type="date" id="st-week" value="' + (state.week || global.UI.today()) + '"></div>';
      picker.querySelector('#st-week').addEventListener('change', function (e) {
        state.week = e.target.value;
        renderResult(el);
      });
    }
  }

  function renderResult(el) {
    var box = el.querySelector('#st-result');
    var range = rangeOf();
    if (!range) {
      box.innerHTML = '<div class="card empty-tip">请选择' + (state.mode === 'month' ? '月份' : '周') + '</div>';
      return;
    }

    var d = global.DB.get();
    var byName = {}; // mid -> {in, out}
    var total = { in: 0, out: 0 };
    var count = 0;
    d.walletdiary.forEach(function (b) {
      var t = global.UI.parseDate(b.wtime);
      if (!t || t < range.from || t > range.to) return;
      var mid = b.wname;
      if (!byName[mid]) byName[mid] = { in: 0, out: 0 };
      var amt = Number(b.wamount) || 0;
      if (b.wtype === 1) { byName[mid].in += amt; total.in += amt; }
      else { byName[mid].out += amt; total.out += amt; }
      count++;
    });

    var rows = Object.keys(byName).map(function (mid) {
      return { mid: +mid, name: global.DB.mingmuName(+mid), in: byName[mid].in, out: byName[mid].out };
    }).sort(function (a, b) { return b.out - a.out; });

    var maxOut = Math.max.apply(null, rows.map(function (r) { return r.out; }).concat([0.01]));

    var html =
      '<div class="stat-sums">' +
        '<div class="stat-sum"><div class="ss-label">总收入 · ' + global.UI.esc(range.label) + '</div><div class="ss-val green">¥ ' + global.UI.fmtMoney(total.in) + '</div></div>' +
        '<div class="stat-sum"><div class="ss-label">总支出 · ' + global.UI.esc(range.label) + '</div><div class="ss-val red">¥ ' + global.UI.fmtMoney(total.out) + '</div></div>' +
        '<div class="stat-sum"><div class="ss-label">结余</div><div class="ss-val" style="color:' + (total.in - total.out >= 0 ? 'var(--green)' : 'var(--red)') + '">¥ ' + global.UI.fmtMoney(total.in - total.out) + '</div></div>' +
        '<div class="stat-sum"><div class="ss-label">账单笔数</div><div class="ss-val">' + count + '</div></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>按款项名目汇总</div>' +
        '<div class="table-wrap"><table class="tbl">' +
        '<thead><tr><th>款项名目</th><th style="text-align:right">总支出</th><th style="text-align:right">总收入</th><th style="text-align:right">占比(支)</th></tr></thead><tbody>';
    if (!rows.length) {
      html += '<tr><td colspan="4" class="empty-tip">该范围内暂无账单</td></tr>';
    }
    rows.forEach(function (r) {
      var pct = total.out > 0 ? (r.out / total.out * 100) : 0;
      html += '<tr>' +
        '<td><span class="cell-flex"><span class="row-logo" data-nm="' + global.UI.esc(r.name) + '"></span>' + global.UI.esc(r.name) + '</span></td>' +
        '<td class="num c-red" style="text-align:right">¥ ' + global.UI.fmtMoney(r.out) + '</td>' +
        '<td class="num c-green" style="text-align:right">¥ ' + global.UI.fmtMoney(r.in) + '</td>' +
        '<td style="min-width:140px"><div class="progress-row" style="margin:0"><div class="pr-track"><div class="pr-fill" style="width:' + (r.out / maxOut * 100) + '%"></div></div><div class="pr-val">' + pct.toFixed(1) + '%</div></div></td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div>';

    // 名目支出分布图
    if (rows.length) {
      html += '<div class="card"><div class="card-title"><span class="bar"></span>支出分布图</div>' +
        '<div style="position:relative;height:260px"><canvas id="st-chart"></canvas></div></div>';
    }

    box.innerHTML = html;
    el.querySelectorAll('.row-logo').forEach(function (l) { global.Icons.fillLogo(l, l.dataset.nm); });

    if (rows.length) {
      var cv = document.getElementById('st-chart');
      var top = rows.slice(0, 8);
      new global.Chart(cv, {
        type: 'bar',
        data: {
          labels: top.map(function (r) { return r.name; }),
          datasets: [{
            label: '总支出',
            data: top.map(function (r) { return r.out.toFixed(2); }),
            backgroundColor: 'rgba(99,102,241,.75)',
            borderRadius: 8,
            maxBarThickness: 42
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8a90a3' } },
            y: { beginAtZero: true, ticks: { color: '#8a90a3' } }
          }
        }
      });
    }
  }

  global.Stats = { calcRange: calcRange };
  global.Pages = global.Pages || {};
  global.Pages.stats = { render: render };
})(window);
