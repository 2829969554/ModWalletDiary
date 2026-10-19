/* ============================================================
 * settings.js — 设置：发薪日 / 我的生日 / 其他人生日 / 喜欢的节日 / 春节
 * 每个选项后有"显示/隐藏"按钮，控制仪表盘顶部显示距离该日期还有多少天
 * ============================================================ */
(function (global) {
  'use strict';

  var nextId = 1;
  function uid() { return Date.now() + '-' + (nextId++); }

  // 生日存取规范化：date 控件给 YYYY-MM-DD，存储/倒计时用 MM-DD（每年循环）
  function inputToMmdd(v) {
    var m = /^\d{4}-(\d{1,2}-\d{1,2})$/.exec(v || '');
    return m ? m[1] : (v || '');
  }
  function mmddToInput(v) {
    if (/^\d{1,2}-\d{1,2}$/.test(v || '')) return new Date().getFullYear() + '-' + v;
    return v || '';
  }
  // 历法下拉：公历/农历
  function calSelectHtml(forWhat, cal) {
    return '<select class="cal-sel" data-cal-for="' + forWhat + '" style="width:88px;flex:none">' +
      '<option value="solar"' + (cal !== 'lunar' ? ' selected' : '') + '>公历</option>' +
      '<option value="lunar"' + (cal === 'lunar' ? ' selected' : '') + '>农历</option>' +
    '</select>';
  }
  // 校验农历 月-日（月1-12，日1-30）
  function validLunarMd(v) {
    var m = /^(\d{1,2})-(\d{1,2})$/.exec((v || '').trim());
    return !!(m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 30);
  }

  function render() {
    var el = document.getElementById('page-settings');
    var s = global.DB.getSettings();

    el.innerHTML =
      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>发薪日</div>' +
        '<div class="set-row">' +
          '<div class="set-field"><input type="number" id="st-payday" min="1" max="31" placeholder="每月几号发薪，如 10" value="' + (s.payday.day || '') + '"></div>' +
          '<button class="chip st-toggle" data-id="payday">' + (s.payday.show ? '显示中' : '已隐藏') + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>我的生日</div>' +
        '<div class="set-row">' +
          '<div class="set-field set-inline">' +
            calSelectHtml('myb', s.myBirthday.cal) +
            (s.myBirthday.cal === 'lunar'
              ? '<input type="text" id="st-mybirth" placeholder="农历 月-日，如 8-15" value="' + global.UI.esc(s.myBirthday.date || '') + '">'
              : '<input type="date" id="st-mybirth" value="' + global.UI.esc(mmddToInput(s.myBirthday.date)) + '">') +
          '</div>' +
          '<button class="chip st-toggle" data-id="myBirthday">' + (s.myBirthday.show ? '显示中' : '已隐藏') + '</button>' +
        '</div>' +
        '<p class="set-tip">生日每年重复提醒；农历生日会自动换算成公历日期倒计时。</p>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>春节日期</div>' +
        '<div class="set-row">' +
          '<div class="set-field"><input type="date" id="st-cny" value="' + (s.cny.date || '') + '"></div>' +
          '<button class="chip st-toggle" data-id="cny">' + (s.cny.show ? '显示中' : '已隐藏') + '</button>' +
        '</div>' +
        '<p class="set-tip">留空则按内置农历春节表自动计算；也可手动指定某年的春节日期。</p>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>其他人的生日</div>' +
        '<div id="st-birthdays"></div>' +
        '<button id="st-add-birth" class="btn-ghost btn-block">+ 添加生日</button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>我喜欢的节日</div>' +
        '<div id="st-festivals"></div>' +
        '<button id="st-add-fest" class="btn-ghost btn-block">+ 添加节日</button>' +
      '</div>';

    function renderBirthdays() {
      var box = el.querySelector('#st-birthdays');
      if (!s.birthdays.length) { box.innerHTML = '<div class="empty-tip">还没有添加生日</div>'; return; }
      box.innerHTML = s.birthdays.map(function (b) {
        return '<div class="set-row" data-id="' + b.id + '">' +
          '<div class="set-field set-inline">' +
            calSelectHtml('birth', b.cal) +
            '<input type="text" class="bd-name" placeholder="姓名/称呼" value="' + global.UI.esc(b.name) + '">' +
            (b.cal === 'lunar'
              ? '<input type="text" class="bd-date" placeholder="农历 月-日，如 8-15" value="' + global.UI.esc(b.date || '') + '">'
              : '<input type="date" class="bd-date" value="' + global.UI.esc(mmddToInput(b.date)) + '">') +
          '</div>' +
          '<button class="chip st-toggle" data-id="birth-' + b.id + '">' + (b.show ? '显示中' : '已隐藏') + '</button>' +
          '<button class="op-btn del set-del" data-del="birth" data-id="' + b.id + '" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>' +
        '</div>';
      }).join('');
      bindListRows(box, 'birth');
    }

    function renderFestivals() {
      var box = el.querySelector('#st-festivals');
      if (!s.festivals.length) { box.innerHTML = '<div class="empty-tip">还没有添加节日</div>'; return; }
      box.innerHTML = s.festivals.map(function (f) {
        return '<div class="set-row" data-id="' + f.id + '">' +
          '<div class="set-field set-inline"><input type="text" class="ft-name" placeholder="节日名称" value="' + global.UI.esc(f.name) + '">' +
          '<input type="date" class="ft-date" value="' + global.UI.esc(f.date) + '"></div>' +
          '<button class="chip st-toggle" data-id="fest-' + f.id + '">' + (f.show ? '显示中' : '已隐藏') + '</button>' +
          '<button class="op-btn del set-del" data-del="fest" data-id="' + f.id + '" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>' +
        '</div>';
      }).join('');
      bindListRows(box, 'fest');
    }

    function bindListRows(box, kind) {
      box.querySelectorAll('.set-row').forEach(function (row) {
        var id = row.dataset.id;
        var list = kind === 'birth' ? s.birthdays : s.festivals;
        // 名称/日期编辑即时保存
        var nameInput = row.querySelector(kind === 'birth' ? '.bd-name' : '.ft-name');
        var dateInput = row.querySelector(kind === 'birth' ? '.bd-date' : '.ft-date');
        nameInput.addEventListener('change', function () { saveRow(kind, id); });
        dateInput.addEventListener('change', function () { saveRow(kind, id); });
        // 历法切换（公历/农历）→ 保存并重渲染（切换输入控件类型）
        var calSel = row.querySelector('.cal-sel');
        if (calSel) calSel.addEventListener('change', function () {
          var it = list.find(function (x) { return x.id === id; });
          if (!it) return;
          it.cal = calSel.value;
          global.DB.saveSettings();
          render();
        });
        row.querySelector('.set-del').addEventListener('click', function () {
          if (kind === 'birth') s.birthdays = s.birthdays.filter(function (x) { return x.id !== id; });
          else s.festivals = s.festivals.filter(function (x) { return x.id !== id; });
          global.DB.saveSettings();
          global.UI.toast('已删除', 'ok');
          render();
        });
      });
    }

    function saveRow(kind, id) {
      var list = kind === 'birth' ? s.birthdays : s.festivals;
      var row = el.querySelector('.set-row[data-id="' + id + '"]');
      if (!row) return;
      var it = list.find(function (x) { return x.id === id; });
      if (!it) return;
      it.name = row.querySelector(kind === 'birth' ? '.bd-name' : '.ft-name').value.trim();
      var dv = row.querySelector(kind === 'birth' ? '.bd-date' : '.ft-date').value;
      if (kind === 'birth' && it.cal === 'lunar') {
        if (!validLunarMd(dv)) { global.UI.toast('农历日期格式：月-日，如 8-15（日 1-30）', 'err'); return; }
        it.date = dv.trim();
      } else {
        it.date = kind === 'birth' ? inputToMmdd(dv) : dv; // 生日存 MM-DD（每年循环），节日存完整日期
      }
      global.DB.saveSettings();
    }

    renderBirthdays();
    renderFestivals();

    /* 显示/隐藏切换按钮（三个固定项 + 动态列表项） */
    el.querySelectorAll('.st-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.id;
        var tgt;
        if (id === 'payday') tgt = s.payday;
        else if (id === 'myBirthday') tgt = s.myBirthday;
        else if (id === 'cny') tgt = s.cny;
        else if (id.indexOf('birth-') === 0) {
          var b = s.birthdays.find(function (x) { return 'birth-' + x.id === id; });
          if (!b) return; tgt = b;
        } else if (id.indexOf('fest-') === 0) {
          var f = s.festivals.find(function (x) { return 'fest-' + x.id === id; });
          if (!f) return; tgt = f;
        } else return;
        tgt.show = !tgt.show;
        global.DB.saveSettings();
        render();
      });
    });

    /* 固定项保存 */
    el.querySelector('#st-payday').addEventListener('change', function (e) {
      var v = parseInt(e.target.value, 10);
      s.payday.day = (v >= 1 && v <= 31) ? v : 0;
      global.DB.saveSettings();
    });
    // 我的生日：历法切换 → 重渲染
    el.querySelector('.cal-sel[data-cal-for="myb"]').addEventListener('change', function (e) {
      s.myBirthday.cal = e.target.value;
      global.DB.saveSettings();
      render();
    });
    el.querySelector('#st-mybirth').addEventListener('change', function (e) {
      if (s.myBirthday.cal === 'lunar') {
        if (!validLunarMd(e.target.value)) { global.UI.toast('农历日期格式：月-日，如 8-15（日 1-30）', 'err'); return; }
        s.myBirthday.date = e.target.value.trim();
      } else {
        s.myBirthday.date = inputToMmdd(e.target.value); // 存 MM-DD，每年循环提醒
      }
      global.DB.saveSettings();
    });
    el.querySelector('#st-cny').addEventListener('change', function (e) {
      s.cny.date = e.target.value;
      global.DB.saveSettings();
    });

    /* 添加生日 / 节日 */
    el.querySelector('#st-add-birth').addEventListener('click', function () {
      s.birthdays.push({ id: uid(), name: '', date: '', show: true });
      global.DB.saveSettings();
      render();
    });
    el.querySelector('#st-add-fest').addEventListener('click', function () {
      s.festivals.push({ id: uid(), name: '', date: '', show: true });
      global.DB.saveSettings();
      render();
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.settings = { render: render };
})(window);
