// app.js —— 解锁流程、页面路由、侧栏、安卓返回键
(function (global) {
  'use strict';

  let current = 'dashboard';
  let lastBack = 0; // 上一次按返回键的时间，用来判断是不是连按
  let navItems = []; // 导航本身就是页面清单：data-page -> 标题 + 对应的 section

  function readNav() {
    navItems = [];
    document.querySelectorAll('#nav [data-page]').forEach((a) => {
      const key = a.dataset.page;
      const label = a.querySelector('.side-label');
      navItems.push({
        key: key,
        title: label ? label.textContent.trim() : key,
        link: a,
        panel: document.getElementById('page-' + key)
      });
    });
  }

  function navigate(page, force) {
    if (current === page && !force) return;
    current = page;
    let title = '';
    navItems.forEach((it) => {
      it.panel.hidden = it.key !== page;
      it.link.classList.toggle('active', it.key === page);
      if (it.key === page) title = it.title;
    });
    document.getElementById('header-title').textContent = title;
    closeMobileSidebar();
    global.Pages[page].render();
    document.getElementById('pages').scrollTop = 0;
  }

  function init() {
    // HBuilderX 打包后才有 plus，浏览器里直接跳过
    if (global.plus) {
      document.documentElement.classList.add('app-env');
      global.addEventListener('plusready', () => {
        document.documentElement.classList.add('app-env');
      });
    }
    // 解锁页也要跟着显示模式走，所以先从 localStorage 里镜像的那份读
    if (global.UI && global.UI.applyTheme) {
      global.UI.applyTheme(global.localStorage.getItem('WalletDiaryTheme') || 'auto');
    }

    readNav();
    bindNav();
    bindSidebar();
    bindAuth();
    bindBack();
    // 页面里写的是图标占位，这儿统一填上真正的 SVG
    global.SvgIcons.mount();
    showAuth();

    const t = new Date();
    document.getElementById('header-date').textContent =
      `${t.getFullYear()}-${global.UI.pad(t.getMonth() + 1)}-${global.UI.pad(t.getDate())} 周${'日一二三四五六'[t.getDay()]}`;

    // 联网时预取品牌图标到本地缓存，之后离线也能显示真图标
    if (global.Icons && global.Icons.prefetch) setTimeout(global.Icons.prefetch, 1500);
  }

  // 有账本就显示登录框，没有就显示设密码框
  function showAuth() {
    const hasData = !!global.localStorage.getItem(global.DB.KEY);

    document.getElementById('auth').hidden = false;
    document.getElementById('app').hidden = true;

    if (hasData) {
      document.getElementById('login-panel').hidden = false;
      document.getElementById('setup-panel').hidden = true;
      setTimeout(() => document.getElementById('login-pwd').focus(), 100);
    } else {
      document.getElementById('setup-panel').hidden = false;
      document.getElementById('login-panel').hidden = true;
      setTimeout(() => document.getElementById('setup-pwd').focus(), 100);
    }
    document.getElementById('auth-error').textContent = '';
  }

  function bindAuth() {
    const err = document.getElementById('auth-error');

    // 首次设密码：两遍一致才写库，之后这个密码就是账本的加密密钥
    const doSetup = () => {
      const p1 = document.getElementById('setup-pwd').value;
      const p2 = document.getElementById('setup-pwd-confirm').value;
      if (!p1 || p1.length < 4) { err.textContent = '密码至少 4 位'; return; }
      if (p1 !== p2) { err.textContent = '两次输入的密码不一致'; return; }
      try {
        global.DB.setup(p1);
        enterApp();
      } catch (e) {
        err.textContent = '初始化失败：' + e.message;
      }
    };

    const doLogin = () => {
      const pw = document.getElementById('login-pwd').value;
      if (!pw) { err.textContent = '请输入密码'; return; }
      try {
        global.DB.unlock(pw);
        enterApp();
      } catch (e) {
        err.textContent = '密码错误，请重试';
        document.getElementById('login-pwd').value = '';
        document.getElementById('login-pwd').focus();
      }
    };

    document.getElementById('setup-btn').addEventListener('click', doSetup);
    document.getElementById('setup-pwd-confirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSetup(); });
    document.getElementById('login-btn').addEventListener('click', doLogin);
    document.getElementById('login-pwd').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

    document.getElementById('lock-btn').addEventListener('click', () => {
      global.UI.closeModal();
      showAuth();
    });
  }

  function enterApp() {
    document.getElementById('auth').hidden = true;
    document.getElementById('app').hidden = false;
    document.getElementById('login-pwd').value = '';
    document.getElementById('setup-pwd').value = '';
    document.getElementById('setup-pwd-confirm').value = '';
    navigate('dashboard', true);
  }

  function bindNav() {
    navItems.forEach((it) => {
      it.link.addEventListener('click', () => navigate(it.key));
    });
  }

  function bindSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mask = document.getElementById('sidebar-mask');

    document.getElementById('sidebar-collapse').addEventListener('click', () => {
      sidebar.classList.toggle('mini');
    });
    document.getElementById('menu-toggle').addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      mask.classList.toggle('show', sidebar.classList.contains('mobile-open'));
    });
    mask.addEventListener('click', closeMobileSidebar);
  }

  // 手机上侧栏是抽屉，宽屏下没有这回事
  function closeMobileSidebar() {
    if (window.innerWidth > 768) return;
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-mask').classList.remove('show');
  }

  // 返回键两秒内按两次才退出，第一次先给个提示
  function checkDoubleBack(onQuit, onFirst) {
    const now = Date.now();
    if (now - lastBack < 2000) {
      onQuit();
      return;
    }
    lastBack = now;
    if (onFirst) onFirst();
  }

  function bindBack() {
    // HBuilderX 5+ runtime：plusready 后才拦得到 back 键
    document.addEventListener('plusready', () => {
      global.plus.key.addEventListener('backbutton', () => {
        checkDoubleBack(
          () => global.plus.runtime.quit(),
          () => global.UI.toast('再按一次退出应用')
        );
      }, false);
    });

    // 浏览器环境模拟：ESC 键（便于调试）
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.getElementById('app').hidden) return;
      if (!document.getElementById('modal-mask').hidden) return;
      checkDoubleBack(() => global.UI.toast('（浏览器模拟）双击退出'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
