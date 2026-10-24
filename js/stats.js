// stats.js —— 统计：选个时间范围，看每个款项名目的收支
(function (global) {
  'use strict';

  const PRESETS = [
    { key: 'all', label: '全部' },
    { key: '1y', label: '一年', months: 12 },
    { key: '6m', label: '半年', months: 6 },
    { key: '3m', label: '一季度', months: 3 },
    { key: '1m', label: '1个月', months: 1 },
    { key: '1w', label: '1周' }
  ];

  const state = { mode: 'preset', preset: '1y', year: '', month: '', from: '', to: '' };

  // 当天最后一秒
  const endOfDay = (t) => new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59);

  const fmt = (d) => `${d.getFullYear()}-${global.UI.pad(d.getMonth() + 1)}-${global.UI.pad(d.getDate())}`;

  // 当前选中的统计范围；范围还没填好返回 null
  function rangeOf() {
    const now = new Date();

    if (state.mode === 'preset') {
      const p = PRESETS.find((x) => x.key === state.preset) || PRESETS[1];
      if (p.key === 'all') {
        // 全部：从最早一笔账单到今天
        let min = null;
        global.DB.get().walletdiary.forEach((b) => {
          const t = global.UI.parseDate(b.wtime);
          if (t && (!min || t < min)) min = t;
        });
        if (!min) min = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: min, to: endOfDay(now), label: '全部' };
      }
      if (p.key === '1w') {
        // 1周：本周一到本周日
        const dow = (now.getDay() + 6) % 7;
        const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
        const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 6);
        return { from: mon, to: endOfDay(sun), label: '本周（1周）' };
      }
      const from = new Date(now.getFullYear(), now.getMonth() - (p.months - 1), 1);
      return { from: from, to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59), label: p.label };
    }

    if (state.mode === 'year') {
      const yy = parseInt(state.year, 10);
      if (!yy) return null;
      return { from: new Date(yy, 0, 1), to: new Date(yy, 11, 31, 23, 59, 59), label: `${yy}年` };
    }

    if (state.mode === 'month') {
      const m = /^(\d{4})-(\d{1,2})$/.exec(state.month);
      if (!m) return null;
      const yr = +m[1], mo = +m[2];
      return { from: new Date(yr, mo - 1, 1), to: new Date(yr, mo, 0, 23, 59, 59), label: `${yr}年${mo}月` };
    }

    if (state.mode === 'range') {
      let f = global.UI.parseDate(state.from), t = global.UI.parseDate(state.to);
      if (!f || !t) return null;
      if (f > t) { const tmp = f; f = t; t = tmp; } // 起止填反了也照样算
      return { from: f, to: endOfDay(t), label: fmt(f) + ' ~ ' + fmt(t) };
    }

    return null;
  }

  // 统计一段时间内的收入和支出，仪表盘的年度/本月数字也用它
  function calcRange(from, to) {
    const r = { in: 0, out: 0 };
    global.DB.get().walletdiary.forEach((b) => {
      const t = global.UI.parseDate(b.wtime);
      if (!t || t < from || t > to) return;
      if (b.wtype === 1) r.in += Number(b.wamount) || 0;
      else r.out += Number(b.wamount) || 0;
    });
    return r;
  }

  // 按名目把范围内的账单归类
  function collectByName(range) {
    const byName = {}; // 名目编号 -> {in, out}
    const total = { in: 0, out: 0 };
    let count = 0;
    global.DB.get().walletdiary.forEach((b) => {
      const t = global.UI.parseDate(b.wtime);
      if (!t || t < range.from || t > range.to) return;
      const mid = b.wname;
      if (!byName[mid]) byName[mid] = { in: 0, out: 0 };
      const amt = Number(b.wamount) || 0;
      if (b.wtype === 1) { byName[mid].in += amt; total.in += amt; }
      else { byName[mid].out += amt; total.out += amt; }
      count++;
    });

    const rows = Object.keys(byName).map((mid) => ({
      mid: +mid,
      name: global.DB.mingmuName(+mid),
      in: byName[mid].in,
      out: byName[mid].out
    })).sort((a, b) => b.out - a.out);

    return { rows: rows, total: total, count: count };
  }

  function render() {
    const el = document.getElementById('page-stats');

    el.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="bar"></span>统计范围</div>
        <div class="chip-row" id="stats-chips">
          ${PRESETS.map((p) => `<button class="chip${state.mode === 'preset' && state.preset === p.key ? ' on' : ''}" data-mode="preset" data-key="${p.key}">${p.label}</button>`).join('')}
          <button class="chip${state.mode === 'year' ? ' on' : ''}" data-mode="year">指定年</button>
          <button class="chip${state.mode === 'month' ? ' on' : ''}" data-mode="month">指定月份</button>
          <button class="chip${state.mode === 'range' ? ' on' : ''}" data-mode="range">指定范围</button>
        </div>
        <div style="margin-top:12px" id="stats-picker"></div>
      </div>
      <div id="stats-result"></div>`;

    el.querySelectorAll('#stats-chips .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.mode = chip.dataset.mode;
        if (state.mode === 'preset') state.preset = chip.dataset.key;
        render();
      });
    });

    renderPicker(el);
    renderResult(el);
  }

  // 范围选择的那一块：指定年 / 指定月份 / 自己划起止
  function renderPicker(el) {
    const picker = el.querySelector('#stats-picker');
    if (state.mode === 'preset') { picker.hidden = true; return; }
    picker.hidden = false;

    if (state.mode === 'year') {
      picker.innerHTML = `
        <div class="field" style="max-width:260px;margin-bottom:0">
          <label>选择年份</label>
          <input type="number" id="stats-year" min="2000" max="2100" step="1" value="${state.year || new Date().getFullYear()}">
        </div>`;
      picker.querySelector('#stats-year').addEventListener('change', (e) => {
        state.year = e.target.value;
        renderResult(el);
      });
      return;
    }

    if (state.mode === 'month') {
      picker.innerHTML = `
        <div class="field" style="max-width:260px;margin-bottom:0">
          <label>选择月份</label>
          <input type="month" id="stats-month" value="${state.month || global.UI.today().slice(0, 7)}">
        </div>`;
      picker.querySelector('#stats-month').addEventListener('change', (e) => {
        state.month = e.target.value;
        renderResult(el);
      });
      return;
    }

    picker.innerHTML = `
      <div class="field" style="max-width:460px;margin-bottom:0">
        <label>起始日期 至 最终日期</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="date" id="stats-from" style="flex:1;min-width:130px" value="${state.from || ''}">
          <span style="color:var(--muted)">至</span>
          <input type="date" id="stats-to" style="flex:1;min-width:130px" value="${state.to || ''}">
        </div>
      </div>`;
    picker.querySelector('#stats-from').addEventListener('change', (e) => {
      state.from = e.target.value;
      renderResult(el);
    });
    picker.querySelector('#stats-to').addEventListener('change', (e) => {
      state.to = e.target.value;
      renderResult(el);
    });
  }

  function renderResult(el) {
    const box = el.querySelector('#stats-result');
    const range = rangeOf();
    if (!range) {
      box.innerHTML = '<div class="card empty-tip">请选择统计范围</div>';
      return;
    }

    const sum = collectByName(range);
    const rows = sum.rows;
    const maxOut = Math.max.apply(null, rows.map((r) => r.out).concat([0.01]));
    const net = sum.total.in - sum.total.out;

    const trs = rows.map((r) => {
      const pct = sum.total.out > 0 ? (r.out / sum.total.out * 100) : 0;
      return `
        <tr>
          <td><span class="cell-flex"><span class="row-logo" data-nm="${global.UI.esc(r.name)}"></span>${global.UI.esc(r.name)}</span></td>
          <td class="num c-red" style="text-align:right">¥ ${global.UI.fmtMoney(r.out)}</td>
          <td class="num c-green" style="text-align:right">¥ ${global.UI.fmtMoney(r.in)}</td>
          <td class="st-pct"><div class="progress-row" style="margin:0"><div class="pr-track"><div class="pr-fill" style="width:${r.out / maxOut * 100}%"></div></div><div class="pr-val">${pct.toFixed(1)}%</div></div></td>
        </tr>`;
    }).join('');

    box.innerHTML = `
      <div class="stat-sums">
        <div class="stat-sum ss-in"><div class="ss-label">总收入 · ${global.UI.esc(range.label)}</div><div class="ss-val green">¥ ${global.UI.fmtMoney(sum.total.in)}</div></div>
        <div class="stat-sum ss-out"><div class="ss-label">总支出 · ${global.UI.esc(range.label)}</div><div class="ss-val red">¥ ${global.UI.fmtMoney(sum.total.out)}</div></div>
        <div class="stat-sum ss-net"><div class="ss-label">结余</div><div class="ss-val" style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">¥ ${global.UI.fmtMoney(net)}</div></div>
        <div class="stat-sum ss-count"><div class="ss-label">账单笔数</div><div class="ss-val">${sum.count}</div></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="bar"></span>按款项名目汇总</div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>款项名目</th><th style="text-align:right">总支出</th><th style="text-align:right">总收入</th><th style="text-align:right">占比(支)</th></tr></thead>
          <tbody>${rows.length ? trs : '<tr><td colspan="4" class="empty-tip">该范围内暂无账单</td></tr>'}</tbody>
        </table></div>
      </div>
      ${rows.length ? `
      <div class="card">
        <div class="card-title"><span class="bar"></span>支出分布图</div>
        <div style="position:relative;height:260px"><canvas id="st-chart"></canvas></div>
      </div>` : ''}`;

    el.querySelectorAll('.row-logo').forEach((l) => { global.Icons.fillLogo(l, l.dataset.nm); });
    if (rows.length) drawChart(rows);
  }

  // 只画支出最多的八个名目
  function drawChart(rows) {
    const cv = document.getElementById('st-chart');
    const top = rows.slice(0, 8);
    new global.Chart(cv, {
      type: 'bar',
      data: {
        labels: top.map((r) => r.name),
        datasets: [{
          label: '总支出',
          data: top.map((r) => r.out.toFixed(2)),
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

  global.Stats = { calcRange: calcRange };
  global.Pages = global.Pages || {};
  global.Pages.stats = { render: render };
})(window);
