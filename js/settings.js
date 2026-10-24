// settings.js —— 显示模式、发薪日、生日、节日、春节等设置
(function (global) {
  'use strict';

  let nextId = 1;

  // 固定项的显示/隐藏开关，按钮上的 data-id 对应这里
  const FIXED_TOGGLE = { payday: 'payday', myBirthday: 'myBirthday', cny: 'cny' };

  // 生日和节日两张表长得几乎一样：名字 + 日期 + 显示开关 + 删除
  const LISTS = {
    birth: {
      cls: 'bd', tag: 'birth', list: 'birthdays', box: '#settings-birthdays',
      add: '#settings-add-birthday', empty: '还没有添加生日',
      namePh: '姓名/称呼', hasCal: true
    },
    fest: {
      cls: 'ft', tag: 'fest', list: 'festivals', box: '#settings-festivals',
      add: '#settings-add-festival', empty: '还没有添加节日',
      namePh: '节日名称', hasCal: false
    }
  };

  const TRASH_SVG = global.SvgIcons.get('trash');

  const uid = () => Date.now() + '-' + (nextId++);

  // date 控件的值转成 MM-DD，取不到就原样返回
  const inputToMmdd = (v) => {
    const m = /^\d{4}-(\d{1,2}-\d{1,2})$/.exec(v || '');
    return m ? m[1] : (v || '');
  };

  // MM-DD 转回 date 控件能认的值，年份取今年
  const mmddToInput = (v) => {
    if (/^\d{1,2}-\d{1,2}$/.test(v || '')) return new Date().getFullYear() + '-' + v;
    return v || '';
  };

  // 农历只认 月-日，月 1-12、日 1-30
  const validLunarMd = (v) => {
    const m = /^(\d{1,2})-(\d{1,2})$/.exec((v || '').trim());
    return !!(m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 30);
  };

  // 公历/农历下拉，forWhat 区分是我的生日还是别人的生日
  const calSelectHtml = (forWhat, cal) => `
    <select class="cal-sel" data-cal-for="${forWhat}" style="width:88px;flex:none">
      <option value="solar"${cal !== 'lunar' ? ' selected' : ''}>公历</option>
      <option value="lunar"${cal === 'lunar' ? ' selected' : ''}>农历</option>
    </select>`;

  function render() {
    const el = document.getElementById('page-settings');
    const s = global.DB.getSettings();

    // 农历生日用月-日文本框，公历生日用 date 控件
    const myBirthdayInput = s.myBirthday.cal === 'lunar'
      ? `<input type="text" id="settings-birthday" placeholder="农历 月-日，如 8-15" value="${global.UI.esc(s.myBirthday.date || '')}">`
      : `<input type="date" id="settings-birthday" value="${global.UI.esc(mmddToInput(s.myBirthday.date))}">`;

    el.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="bar"></span>显示模式</div>
        <div class="chip-row" id="settings-theme">
          <button class="chip${s.theme === 'auto' ? ' on' : ''}" data-tv="auto">自动</button>
          <button class="chip${s.theme === 'light' ? ' on' : ''}" data-tv="light">浅色模式</button>
          <button class="chip${s.theme === 'dark' ? ' on' : ''}" data-tv="dark">深色模式</button>
        </div>
        <p class="set-tip">自动：白天 7:00-18:00 浅色模式，夜晚 18:00-7:00 深色模式。</p>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>发薪日</div>
        <div class="set-row">
          <div class="set-field"><input type="number" id="settings-payday" min="1" max="31" placeholder="每月几号发薪，如 10" value="${s.payday.day || ''}"></div>
          <button class="chip st-toggle" data-id="payday">${s.payday.show ? '显示中' : '已隐藏'}</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>我的生日</div>
        <div class="set-row">
          <div class="set-field set-inline">
            ${calSelectHtml('myb', s.myBirthday.cal)}
            ${myBirthdayInput}
          </div>
          <button class="chip st-toggle" data-id="myBirthday">${s.myBirthday.show ? '显示中' : '已隐藏'}</button>
        </div>
        <p class="set-tip">生日每年重复提醒；农历生日会自动换算成公历日期倒计时。</p>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>春节日期</div>
        <div class="set-row">
          <div class="set-field"><input type="date" id="settings-cny" value="${s.cny.date || ''}"></div>
          <button class="chip st-toggle" data-id="cny">${s.cny.show ? '显示中' : '已隐藏'}</button>
        </div>
        <p class="set-tip">留空则按内置农历春节表自动计算；也可手动指定某年的春节日期。</p>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>其他人的生日</div>
        <div id="settings-birthdays"></div>
        <button id="settings-add-birthday" class="btn-ghost btn-block">+ 添加生日</button>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>我喜欢的节日</div>
        <div id="settings-festivals"></div>
        <button id="settings-add-festival" class="btn-ghost btn-block">+ 添加节日</button>
      </div>`;

    renderList(el, s, 'birth');
    renderList(el, s, 'fest');

    bindToggles(el, s);
    bindFixed(el, s);

    el.querySelectorAll('#settings-theme .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        s.theme = chip.dataset.tv;
        global.DB.saveSettings();
        try { global.localStorage.setItem('WalletDiaryTheme', s.theme); } catch (e) { /* ignore */ }
        if (global.UI.applyTheme) global.UI.applyTheme(s.theme);
        render();
      });
    });

    el.querySelector('#settings-add-birthday').addEventListener('click', () => {
      s.birthdays.push({ id: uid(), name: '', date: '', show: true });
      global.DB.saveSettings();
      render();
    });
    el.querySelector('#settings-add-festival').addEventListener('click', () => {
      s.festivals.push({ id: uid(), name: '', date: '', show: true });
      global.DB.saveSettings();
      render();
    });
  }

  // 画生日/节日列表
  function renderList(el, s, kind) {
    const cfg = LISTS[kind];
    const box = el.querySelector(cfg.box);
    const list = s[cfg.list];
    if (!list.length) {
      box.innerHTML = `<div class="empty-tip">${cfg.empty}</div>`;
      return;
    }

    box.innerHTML = list.map((it) => {
      const calSel = cfg.hasCal ? calSelectHtml('birth', it.cal) : '';
      const dateInput = cfg.hasCal && it.cal === 'lunar'
        ? `<input type="text" class="${cfg.cls}-date" placeholder="农历 月-日，如 8-15" value="${global.UI.esc(it.date || '')}">`
        : `<input type="date" class="${cfg.cls}-date" value="${global.UI.esc(cfg.hasCal ? mmddToInput(it.date) : it.date)}">`;
      return `
        <div class="set-row" data-id="${it.id}">
          <div class="set-field set-inline">
            ${calSel}
            <input type="text" class="${cfg.cls}-name" placeholder="${cfg.namePh}" value="${global.UI.esc(it.name)}">
            ${dateInput}
          </div>
          <button class="chip st-toggle" data-id="${cfg.tag}-${it.id}">${it.show ? '显示中' : '已隐藏'}</button>
          <button class="op-btn del set-del" data-del="${cfg.tag}" data-id="${it.id}" title="删除">${TRASH_SVG}</button>
        </div>`;
    }).join('');

    bindRows(box, cfg, s);
  }

  // 列表行的改名、改日期、切历法、删除
  function bindRows(box, cfg, s) {
    const list = s[cfg.list];
    box.querySelectorAll('.set-row').forEach((row) => {
      const id = row.dataset.id;

      const save = () => {
        const it = list.find((x) => x.id === id);
        if (!it) return;
        it.name = row.querySelector('.' + cfg.cls + '-name').value.trim();
        const dv = row.querySelector('.' + cfg.cls + '-date').value;
        if (cfg.hasCal && it.cal === 'lunar') {
          if (!validLunarMd(dv)) { global.UI.toast('农历日期格式：月-日，如 8-15（日 1-30）', 'err'); return; }
          it.date = dv.trim();
        } else {
          // 生日按每年循环，只存 MM-DD；节日存完整日期
          it.date = cfg.hasCal ? inputToMmdd(dv) : dv;
        }
        global.DB.saveSettings();
      };

      row.querySelector('.' + cfg.cls + '-name').addEventListener('change', save);
      row.querySelector('.' + cfg.cls + '-date').addEventListener('change', save);

      // 历法一换输入控件类型就变了，得重画
      const calSel = row.querySelector('.cal-sel');
      if (calSel) {
        calSel.addEventListener('change', () => {
          const it = list.find((x) => x.id === id);
          if (!it) return;
          it.cal = calSel.value;
          global.DB.saveSettings();
          render();
        });
      }

      row.querySelector('.set-del').addEventListener('click', () => {
        s[cfg.list] = s[cfg.list].filter((x) => x.id !== id);
        global.DB.saveSettings();
        global.UI.toast('已删除', 'ok');
        render();
      });
    });
  }

  // 显示/隐藏开关：固定三项和列表项都走这里
  function bindToggles(el, s) {
    el.querySelectorAll('.st-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        let tgt = null;
        if (FIXED_TOGGLE[id]) tgt = s[FIXED_TOGGLE[id]];
        else if (id.indexOf('birth-') === 0) tgt = s.birthdays.find((x) => 'birth-' + x.id === id);
        else if (id.indexOf('fest-') === 0) tgt = s.festivals.find((x) => 'fest-' + x.id === id);
        if (!tgt) return;
        tgt.show = !tgt.show;
        global.DB.saveSettings();
        render();
      });
    });
  }

  // 发薪日、我的生日、春节的保存
  function bindFixed(el, s) {
    el.querySelector('#settings-payday').addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      s.payday.day = (v >= 1 && v <= 31) ? v : 0;
      global.DB.saveSettings();
    });

    // 我的生日换历法后输入控件要换，重画一遍
    el.querySelector('.cal-sel[data-cal-for="myb"]').addEventListener('change', (e) => {
      s.myBirthday.cal = e.target.value;
      global.DB.saveSettings();
      render();
    });

    el.querySelector('#settings-birthday').addEventListener('change', (e) => {
      if (s.myBirthday.cal === 'lunar') {
        if (!validLunarMd(e.target.value)) { global.UI.toast('农历日期格式：月-日，如 8-15（日 1-30）', 'err'); return; }
        s.myBirthday.date = e.target.value.trim();
      } else {
        // 生日每年循环，只存 MM-DD
        s.myBirthday.date = inputToMmdd(e.target.value);
      }
      global.DB.saveSettings();
    });

    el.querySelector('#settings-cny').addEventListener('change', (e) => {
      s.cny.date = e.target.value;
      global.DB.saveSettings();
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.settings = { render: render };
})(window);
