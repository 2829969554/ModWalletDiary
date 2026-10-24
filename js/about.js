// about.js —— 应用内「关于」页
(function (global) {
  'use strict';

  global.Pages = global.Pages || {};
  global.Pages.about = {
    render() {
      const el = document.getElementById('page-about');
      const content = global.AboutContent;
      el.innerHTML = content.hero() + content.privacy() + content.terms();
    }
  };
})(window);
