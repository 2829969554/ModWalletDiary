/* ============================================================
 * stats.js — 统计：时间范围 / 指定年 / 指定月份 / 指定范围
 * 范围：全部、一年、半年、一季度、1个月、1周、指定年、指定月份、指定范围
 * 表格：每个款项名目的总支出、总收入
 * ============================================================ */
(function (global) {
  'use strict';

  // 预设范围
  var PRESETS = [
    { key: 'all', label: '全部' },
    { key: '1y', label: '一年', months: 12 },
    { key: '6m', label: '半年', months: 6 },
    { key: '3m', label: '一季度', months: 3 },
    { key: '1m', label: '1个月', months: 1 },
    { key: '1w', label: '1周', week: true }
  ];

  var state = { mode: 'preset', preset: '1y', year: '', month: '', week: '', from: '', to: '' };

  function endOfDay(t) { return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59); }

  function rangeOf() {
    var now = new Date();
    if (state.mode === 'preset') {
      var p = PRESETS.find(function (x) { return x.key === state.preset; }) || PRESETS[1];
      if (p.key === 'all') {
        // 全部：从最早一笔账单到今天
        var d = global.DB.get();
        var min = null;
        d.walletdiary.forEach(function (b) {
          var t0 = global.UI.parseDate(b.wtime);
          if (t0 && (!min || t0 < min)) min = t0;
        });
        if (!min) min = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: min, to: endOfDay(now), label: '全部' };
      }
      if (p.key === '1w') {
        var dow = (now.getDay() + 6) % 7; // 周一=0
        var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
        return { from: mon, to: endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 6)), label: '本周（1周）' };
      }
      var from = new Date(now.getFullYear(), now.getMonth() - (p.months - 1), 1);
      return { from: from, to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59), label: p.label };
    }
    if (state.mode === 'year') {
      var yy = parseInt(state.year, 10);
      if (!yy) return null;
      return { from: new Date(yy, 0, 1), to: new Date(yy, 11, 31, 23, 59, 59), label: yy + '年' };
    }
    if (state.mode === 'month') {
      if (!state.month) return null;
      var m = /^(\d{4})-(\d{1,2})$/.exec(state.month);
      if (!m) return null;
      var yr = +m[1], mo = +m[2];
      return { from: new Date(yr, mo - 1, 1), to: new Date(yr, mo, 0, 23, 59, 59), label: yr + '年' + mo + '月' };
    }
    if (state.mode === 'week') {
      if (!state.week) return null;
      var dd = global.UI.parseDate(state.week);
      if (!dd) return null;
      var dw = (dd.getDay() + 6) % 7;
      var mon2 = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() - dw);
      var sun = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() - dw + 6, 23, 59, 59);
      return { from: mon2, to: sun, label: fmt(mon2) + ' ~ ' + fmt(sun) + '（周）' };
    }
    if (state.mode === 'range') {
      var f = global.UI.parseDate(state.from), t = global.UI.parseDate(state.to);
      if (!f || !t) return null;
      if (f > t) { var tmp = f; f = t; t = tmp; }
      return { from: f, to: endOfDay(t), label: fmt(f) + ' ~ ' + fmt(t) };
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

    el.innerHTML =
      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>统计范围</div>' +
        '<div class="chip-row" id="st-chips">' +
          PRESETS.map(function (p) {
            return '<button class="chip' + (state.mode === 'preset' && state.preset === p.key ? ' on' : '') + '" data-mode="preset" data-key="' + p.key + '">' + p.label + '</button>';
          }).join('') +
          '<button class="chip' + (state.mode === 'year' ? ' on' : '') + '" data-mode="year">指定年</button>' +
          '<button class="chip' + (state.mode === 'month' ? ' on' : '') + '" data-mode="month">指定月份</button>' +
          '<button class="chip' + (state.mode === 'range' ? ' on' : '') + '" data-mode="range">指定范围</button>' +
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
    var now = new Date();
    if (state.mode === 'preset') { picker.hidden = true; return; }
    picker.hidden = false;
    if (state.mode === 'year') {
      picker.innerHTML =
        '<div class="field" style="max-width:260px;margin-bottom:0"><label>选择年份</label>' +
        '<input type="number" id="st-year" min="2000" max="2100" step="1" value="' + (state.year || now.getFullYear()) + '"></div>';
      picker.querySelector('#st-year').addEventListener('change', function (e) {
        state.year = e.target.value;
        renderResult(el);
      });
    } else if (state.mode === 'month') {
      picker.innerHTML =
        '<div class="field" style="max-width:260px;margin-bottom:0"><label>选择月份</label>' +
        '<input type="month" id="st-month" value="' + (state.month || global.UI.today().slice(0, 7)) + '"></div>';
      picker.querySelector('#st-month').addEventListener('change', function (e) {
        state.month = e.target.value;
        renderResult(el);
      });
    } else if (state.mode === 'week') {
      picker.innerHTML =
        '<div class="field" style="max-width:260px;margin-bottom:0"><label>选择周内任意一天</label>' +
        '<input type="date" id="st-week" value="' + (state.week || global.UI.today()) + '"></div>';
      picker.querySelector('#st-week').addEventListener('change', function (e) {
        state.week = e.target.value;
        renderResult(el);
      });
    } else { // range 指定范围：起始 至 最终
      picker.innerHTML =
        '<div class="field" style="max-width:460px;margin-bottom:0"><label>起始日期 至 最终日期</label>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<input type="date" id="st-rfrom" style="flex:1;min-width:130px" value="' + (state.from || '') + '">' +
        '<span style="color:var(--muted)">至</span>' +
        '<input type="date" id="st-rto" style="flex:1;min-width:130px" value="' + (state.to || '') + '">' +
        '</div></div>';
      picker.querySelector('#st-rfrom').addEventListener('change', function (e) {
        state.from = e.target.value;
        renderResult(el);
      });
      picker.querySelector('#st-rto').addEventListener('change', function (e) {
        state.to = e.target.value;
        renderResult(el);
      });
    }
  }

  function renderResult(el) {
    var box = el.querySelector('#st-result');
    var range = rangeOf();
    if (!range) {
      box.innerHTML = '<div class="card empty-tip">请选择统计范围</div>';
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
        '<div class="stat-sum ss-in"><div class="ss-label">总收入 · ' + global.UI.esc(range.label) + '</div><div class="ss-val green">¥ ' + global.UI.fmtMoney(total.in) + '</div></div>' +
        '<div class="stat-sum ss-out"><div class="ss-label">总支出 · ' + global.UI.esc(range.label) + '</div><div class="ss-val red">¥ ' + global.UI.fmtMoney(total.out) + '</div></div>' +
        '<div class="stat-sum ss-net"><div class="ss-label">结余</div><div class="ss-val" style="color:' + (total.in - total.out >= 0 ? 'var(--green)' : 'var(--red)') + '">¥ ' + global.UI.fmtMoney(total.in - total.out) + '</div></div>' +
        '<div class="stat-sum ss-count"><div class="ss-label">账单笔数</div><div class="ss-val">' + count + '</div></div>' +
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
        '<td class="st-pct"><div class="progress-row" style="margin:0"><div class="pr-track"><div class="pr-fill" style="width:' + (r.out / maxOut * 100) + '%"></div></div><div class="pr-val">' + pct.toFixed(1) + '%</div></div></td>' +
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
