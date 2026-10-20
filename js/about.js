/* ============================================================
 * about.js — 关于：应用介绍 / 版本号 / 开源声明 / 隐私策略
 * ============================================================ */
(function (global) {
  'use strict';

  var APP_VERSION = '1.0.0';   // 与 manifest.json versionName 保持一致
  var BUILD_YEAR = '2026';

  function render() {
    var el = document.getElementById('page-about');

    el.innerHTML =
      '<div class="card about-hero">' +
        '<div class="about-logo">' +
          '<svg viewBox="0 0 48 48" width="72" height="72">' +
            '<defs><linearGradient id="aboutlg" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/>' +
            '</linearGradient></defs>' +
            '<rect width="48" height="48" rx="13" fill="url(#aboutlg)"/>' +
            '<path d="M12 17a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="#fff"/>' +
            '<path d="M32 22h6v6h-6a3 3 0 0 1 0-6z" fill="#c7d2fe"/>' +
            '<circle cx="32.5" cy="25" r="1.4" fill="#4f46e5"/>' +
          '</svg>' +
        '</div>' +
        '<h2 class="about-name">ModWalletDiary · 钱包日记</h2>' +
        '<p class="about-ver">版本 ' + APP_VERSION + '　·　' + BUILD_YEAR + '</p>' +
        '<p class="about-intro">一款完全离线的个人记账应用：密码解锁、AES 加密本地存储，' +
          '支持收支记账、款项名目与支付工具管理、多账户与信用卡还款提醒、总资产/负债/总授信统计、' +
          '灵活时间范围报表，以及公历/农历生日与节日倒计时。纯前端实现，所有依赖均已本地化。</p>' +
        '<div class="about-badges">' +
          '<span class="about-badge">永久免费</span>' +
          '<span class="about-badge">无需联网</span>' +
          '<span class="about-badge">开源项目</span>' +
        '</div>' +
        '<div class="about-badges about-badges-2">' +
          '<span class="about-badge">无广告</span>' +
          '<span class="about-badge">离线应用</span>' +
          '<span class="about-badge">记账软件</span>' +
        '</div>' +
        '<div class="about-meta">' +
          '<div class="about-meta-row"><span>开发者</span><b>@ModGoSir</b></div>' +
          '<div class="about-meta-row"><span>联系邮箱</span><b><a href="mailto:2829969554@qq.com">2829969554@qq.com</a></b></div>' +
          '<div class="about-meta-row"><span>项目地址</span><b><a href="https://gitee.com/wxgshuju/ModWalletDiary" target="_blank" rel="noopener">gitee.com/wxgshuju/ModWalletDiary</a></b></div>' +
        '</div>' +
      '</div>' +

      '<div class="card about-privacy">' +
        '<div class="card-title"><span class="bar"></span>隐私策略声明</div>' +
        '<div class="privacy-body">' +
          '<p class="privacy-date">生效日期：' + BUILD_YEAR + ' 年</p>' +
          '<h4>一、总则</h4>' +
          '<p>ModWalletDiary（钱包日记，以下简称“本应用”）是一款开源、免费、无广告的离线记账工具。' +
            '我们高度重视你的隐私：<b>本应用不收集、不上传、不分享任何个人数据</b>，你的账本完全属于你自己。</p>' +
          '<h4>二、数据的存储与加密</h4>' +
          '<p>本应用的全部账本数据（账单、款项名目、支付工具、账户、设置等）仅保存在你设备本地' +
            '（浏览器 localStorage / App 本地存储）中，并使用你设置的密码进行 <b>AES 加密</b> 后存储。' +
            '本应用没有服务器，也不存在任何云端账户体系，开发者无法访问你的任何数据。</p>' +
          '<h4>三、网络与第三方</h4>' +
          '<p>本应用核心功能<b>无需联网</b>即可完整使用。应用内不含广告、统计埋点、第三方追踪 SDK；' +
            '不会向任何第三方出售、出租或共享你的信息。</p>' +
          '<h4>四、系统权限说明</h4>' +
          '<p>在安卓 App 环境中，本应用仅在以下场景请求对应能力，且均由你主动触发：</p>' +
          '<p>· <b>文件导出/导入</b>：将加密账本备份写入你的设备目录或从本机选择文件，用于备份与迁移；<br>' +
            '· <b>系统分享</b>：导出备份后调起系统分享面板，是否分享、分享给谁完全由你决定；<br>' +
            '· <b>网络权限</b>：仅用于可选地加载品牌图标 CDN（不影响离线使用）。</p>' +
          '<h4>五、你的权利</h4>' +
          '<p>你可以随时通过「管理」页导出加密备份、导入恢复、修改密码；删除浏览器/App 数据即可彻底清除本应用的全部数据。' +
            '密码一旦遗失，数据无法解密，请务必妥善保管。</p>' +
          '<h4>六、未成年人保护</h4>' +
          '<p>本应用不收集任何个人信息，适合所有年龄段用户使用。</p>' +
          '<h4>七、开源与免责</h4>' +
          '<p>本应用为开源项目，源代码托管于 <a href="https://gitee.com/wxgshuju/ModWalletDiary" target="_blank" rel="noopener">gitee.com/wxgshuju/ModWalletDiary</a>，欢迎查阅与反馈。' +
            '本应用按“现状”提供，不对因误操作、设备故障或密码遗失导致的数据丢失承担责任。建议你定期在「管理」页导出备份。</p>' +
          '<h4>八、联系方式</h4>' +
          '<p>如对本隐私策略有任何疑问，请联系：<a href="mailto:2829969554@qq.com">2829969554@qq.com</a>（开发者 @ModGoSir）。</p>' +
        '</div>' +
      '</div>';
  }

  global.Pages = global.Pages || {};
  global.Pages.about = { render: render };
})(window);
