/* ============================================================
 * app.js — 应用入口：解锁流程 / 路由 / 侧栏 / H5+ 双击返回退出
 * ============================================================ */
(function (global) {
  'use strict';

  var PAGES = {
    dashboard: { title: '仪表盘', render: function () { global.Pages.dashboard.render(); } },
    record: { title: '我要记账', render: function () { global.Pages.record.render(); } },
    names: { title: '款项名目', render: function () { global.Pages.names.render(); } },
    tools: { title: '支付工具', render: function () { global.Pages.tools.render(); } },
    stats: { title: '统计', render: function () { global.Pages.stats.render(); } },
    manage: { title: '管理', render: function () { global.Pages.manage.render(); } }
  };
  var current = 'dashboard';

  function init() {
    detectEnv();
    bindSidebar();
    bindNav();
    bindAuth();
    bindBack();
    showAuth();
    // 联网时预取品牌图标到本地缓存，之后离线也能显示真图标
    if (global.Icons && global.Icons.prefetch) setTimeout(global.Icons.prefetch, 1500);
  }

  /* ---------- 环境检测：浏览器 / H5+（HBuilderX 打包 APK） ---------- */
  function detectEnv() {
    if (global.plus) {
      document.documentElement.classList.add('app-env');
      global.addEventListener('plusready', function () {
        document.documentElement.classList.add('app-env');
      });
    }
  }

  /* ---------- 解锁页 ---------- */
  function showAuth() {
    var auth = document.getElementById('auth');
    var setupBox = document.getElementById('auth-setup');
    var loginBox = document.getElementById('auth-login');
    var hasData = !!global.localStorage.getItem(global.DB.KEY);

    auth.hidden = false;
    document.getElementById('app').hidden = true;

    if (hasData) {
      loginBox.hidden = false;
      setupBox.hidden = true;
      setTimeout(function () { document.getElementById('login-pw').focus(); }, 100);
    } else {
      loginBox.hidden = true;
      setupBox.hidden = false;
      setTimeout(function () { document.getElementById('setup-pw1').focus(); }, 100);
    }
    document.getElementById('auth-err').textContent = '';
  }

  function bindAuth() {
    // 首次设置密码：两遍一致 -> 默认数据用该密码加密转 base64 写入 WalletDiary
    document.getElementById('setup-btn').addEventListener('click', doSetup);
    document.getElementById('setup-pw2').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSetup(); });

    function doSetup() {
      var p1 = document.getElementById('setup-pw1').value;
      var p2 = document.getElementById('setup-pw2').value;
      var err = document.getElementById('auth-err');
      if (!p1 || p1.length < 4) { err.textContent = '密码至少 4 位'; return; }
      if (p1 !== p2) { err.textContent = '两次输入的密码不一致'; return; }
      try {
        global.DB.setup(p1);
        enterApp();
      } catch (e) {
        err.textContent = '初始化失败：' + e.message;
      }
    }

    // 每次打开输入密码解锁
    document.getElementById('login-btn').addEventListener('click', doLogin);
    document.getElementById('login-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

    function doLogin() {
      var pw = document.getElementById('login-pw').value;
      var err = document.getElementById('auth-err');
      if (!pw) { err.textContent = '请输入密码'; return; }
      try {
        global.DB.unlock(pw);
        enterApp();
      } catch (e) {
        err.textContent = '密码错误，请重试';
        document.getElementById('login-pw').value = '';
        document.getElementById('login-pw').focus();
      }
    }

    // 锁定按钮
    document.getElementById('lock-btn').addEventListener('click', function () {
      global.UI.closeModal();
      showAuth();
    });
  }

  function enterApp() {
    document.getElementById('auth').hidden = true;
    document.getElementById('app').hidden = false;
    document.getElementById('login-pw').value = '';
    document.getElementById('setup-pw1').value = '';
    document.getElementById('setup-pw2').value = '';
    navigate('dashboard', true);
  }

  /* ---------- 路由 ---------- */
  function navigate(page, force) {
    if (current === page && !force) return;
    current = page;
    Object.keys(PAGES).forEach(function (k) {
      document.getElementById('page-' + k).hidden = (k !== page);
    });
    var navItems = document.querySelectorAll('#nav .nav-item');
    navItems.forEach(function (a) {
      a.classList.toggle('active', a.dataset.page === page);
    });
    document.getElementById('page-title').textContent = PAGES[page].title;
    closeMobileSidebar();
    PAGES[page].render();
    document.getElementById('pages').scrollTop = 0;
  }

  function bindNav() {
    document.querySelectorAll('#nav .nav-item').forEach(function (a) {
      a.addEventListener('click', function () { navigate(a.dataset.page); });
    });
    var t = new Date();
    var week = ['日', '一', '二', '三', '四', '五', '六'][t.getDay()];
    document.getElementById('page-date').textContent =
      t.getFullYear() + '-' + global.UI.pad(t.getMonth() + 1) + '-' + global.UI.pad(t.getDate()) + ' 周' + week;
  }

  /* ---------- 侧栏：桌面收缩 / 移动抽屉 ---------- */
  function bindSidebar() {
    var sidebar = document.getElementById('sidebar');
    var mask = document.getElementById('mask');

    document.getElementById('collapse-btn').addEventListener('click', function () {
      sidebar.classList.toggle('mini');
    });
    document.getElementById('menu-btn').addEventListener('click', function () {
      sidebar.classList.toggle('mobile-open');
      mask.classList.toggle('show', sidebar.classList.contains('mobile-open'));
    });
    mask.addEventListener('click', closeMobileSidebar);
  }

  function closeMobileSidebar() {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('mobile-open');
      document.getElementById('mask').classList.remove('show');
    }
  }

  /* ---------- H5+ 安卓：双击返回退出 ---------- */
  var lastBack = 0;
  function bindBack() {
    // HBuilderX 5+ runtime：plusready 后拦截 back 键
    document.addEventListener('plusready', function () {
      global.plus.key.addEventListener('backbutton', function () {
        var now = Date.now();
        if (now - lastBack < 2000) {
          global.plus.runtime.quit();
        } else {
          lastBack = now;
          global.UI.toast('再按一次退出应用');
        }
      }, false);
    });

    // 浏览器环境模拟：ESC 键（便于调试）
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !document.getElementById('app').hidden &&
          document.getElementById('modal-overlay').hidden) {
        var now = Date.now();
        if (now - lastBack < 2000) {
          global.UI.toast('（浏览器模拟）双击退出');
        } else {
          lastBack = now;
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
