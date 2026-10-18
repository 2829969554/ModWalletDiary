/* ============================================================
 * manage.js — 管理：导出 / 导入 / 修改密码
 * ============================================================ */
(function (global) {
  'use strict';

  function render() {
    var el = document.getElementById('page-manage');

    el.innerHTML =
      '<div class="manage-grid">' +
        // —— 导出 ——
        '<div class="card">' +
          '<div class="card-title"><span class="bar"></span>导出数据</div>' +
          '<p style="color:var(--ink2);font-size:12.5px;line-height:1.8;margin-bottom:14px">' +
            '将 localStorage 中 <b>WalletDiary</b> 加密数据文件下载到本地。<br>文件内容为 AES 加密密文，需密码才能解密，可放心备份。</p>' +
          '<button id="mg-export" class="btn-primary btn-block">下载 WalletDiary 数据文件</button>' +
        '</div>' +

        // —— 导入 ——
        '<div class="card">' +
          '<div class="card-title"><span class="bar"></span>导入数据</div>' +
          '<p style="color:var(--ink2);font-size:12.5px;line-height:1.8;margin-bottom:10px">' +
            '选择本机的数据文件导入到 localStorage 的 WalletDiary。文件需密码才能解密（覆盖式保留文件原密码）。</p>' +
          '<div class="field"><label>导入方式</label>' +
            '<div class="radio-row">' +
              '<div class="radio-chip path imp-mode on" data-v="merge"><span class="dot"></span>合并式</div>' +
              '<div class="radio-chip expense imp-mode" data-v="overwrite"><span class="dot"></span>覆盖式</div>' +
            '</div>' +
          '</div>' +
          '<p id="mg-imp-tip" style="color:var(--muted);font-size:11.5px;line-height:1.7;margin-bottom:12px">' +
            '合并式：与当前数据合并，同名名目/工具沿用现有编号，账单按时间去重，不丢失任何一边数据。</p>' +
          '<input type="file" id="mg-import-file" accept=".json,.txt,.wdb,application/json,text/plain" style="display:none">' +
          '<button id="mg-import" class="btn-ghost btn-block" style="height:44px">选择本机文件导入…</button>' +
        '</div>' +

        // —— 修改密码 ——
        '<div class="card">' +
          '<div class="card-title"><span class="bar"></span>修改密码</div>' +
          '<div class="field"><label>老密码</label><input type="password" id="mg-old" autocomplete="current-password"></div>' +
          '<div class="field"><label>新密码</label><input type="password" id="mg-new1" autocomplete="new-password"></div>' +
          '<div class="field"><label>再次输入新密码</label><input type="password" id="mg-new2" autocomplete="new-password"></div>' +
          '<button id="mg-chpwd" class="btn-primary btn-block">确认修改</button>' +
          '<p style="color:var(--muted);font-size:11.5px;margin-top:10px">修改成功后页面将刷新，请使用新密码解锁。</p>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title"><span class="bar"></span>存储信息</div>' +
        '<div class="table-wrap"><table class="tbl">' +
        '<tbody>' +
          '<tr><td>存储位置</td><td>localStorage · WalletDiary</td></tr>' +
          '<tr><td>加密方式</td><td>AES（CryptoJS）→ Base64</td></tr>' +
          '<tr><td>数据大小</td><td class="num">' + sizeText() + '</td></tr>' +
          '<tr><td>账单 / 名目 / 工具</td><td class="num">' + global.DB.get().walletdiary.length + ' / ' + global.DB.get().mingmu.length + ' / ' + global.DB.get().gongju.length + '</td></tr>' +
        '</tbody></table></div>' +
      '</div>';

    /* 导出 */
    el.querySelector('#mg-export').addEventListener('click', function () {
      var raw = global.DB.exportRaw();
      if (!raw) { global.UI.toast('没有可导出的数据', 'err'); return; }
      var payload = JSON.stringify({
        app: 'ModWalletDiary',
        key: global.DB.KEY,
        exported: new Date().toISOString(),
        data: raw
      }, null, 2);
      var name = 'WalletDiary_' + global.UI.today().replace(/-/g, '') + '.json';
      download(name, payload);
    });

    /* 导入 */
    var impMode = 'merge';
    el.querySelectorAll('.imp-mode').forEach(function (chip) {
      chip.addEventListener('click', function () {
        el.querySelectorAll('.imp-mode').forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        impMode = chip.dataset.v;
        el.querySelector('#mg-imp-tip').textContent = impMode === 'merge'
          ? '合并式：与当前数据合并，同名名目/工具沿用现有编号，账单按时间去重，不丢失任何一边数据。'
          : '覆盖式：用文件内容完全替换当前全部数据（当前数据将丢失），解锁密码变为文件加密时的密码。';
      });
    });

    var fileInput = el.querySelector('#mg-import-file');
    el.querySelector('#mg-import').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '').trim();
        var raw = text;
        try {
          var obj = JSON.parse(text);
          if (obj && typeof obj.data === 'string') raw = obj.data; // 兼容导出的包裹格式
        } catch (err) { /* 可能是裸密文 */ }
        if (!raw) { global.UI.toast('文件内容无效', 'err'); return; }
        showImportChoices(raw, f.name, impMode);
      };
      reader.readAsText(f);
      fileInput.value = '';
    });

    /* 修改密码 */
    el.querySelector('#mg-chpwd').addEventListener('click', function () {
      var old1 = el.querySelector('#mg-old').value;
      var n1 = el.querySelector('#mg-new1').value;
      var n2 = el.querySelector('#mg-new2').value;
      if (!old1) { global.UI.toast('请输入老密码', 'err'); return; }
      if (!n1 || n1.length < 4) { global.UI.toast('新密码至少 4 位', 'err'); return; }
      if (n1 !== n2) { global.UI.toast('两次输入的新密码不一致', 'err'); return; }
      try {
        global.DB.changePassword(old1, n1);
        global.UI.toast('密码修改成功，页面即将刷新', 'ok');
        setTimeout(function () { global.location.reload(); }, 900);
      } catch (err) {
        global.UI.toast('老密码错误', 'err');
      }
    });
    /* 导入确认：预检文件 -> 按模式展示影响 -> 执行
     * 文件密码与当前密码不同时，弹出密码输入框验证文件的密码
     */
    function showImportChoices(raw, fileName, mode) {
      var pre = global.DB.inspectRaw(raw);
      var cur = global.DB.get();
      var needPw = !pre.ok && /^U2FsdGVkX1/.test(raw); // 解不开 = 密码不同（格式校验在读取时已做）

      if (mode === 'merge') {
        var body1 = document.createElement('div');
        body1.style.cssText = 'color:var(--ink2);line-height:1.9;font-size:13.5px';
        body1.innerHTML =
          '文件 <b>' + global.UI.esc(fileName) + '</b>' + (pre.ok ? '：账单 ' + pre.bills + ' 笔 · 名目 ' + pre.mingmu + ' 个 · 工具 ' + pre.gongju + ' 个' : '') + '<br>' +
          '当前账本：账单 ' + cur.walletdiary.length + ' 笔<br>' +
          '<span style="color:var(--muted);font-size:12px">合并后：同名名目/工具沿用现有编号，账单按内容去重，历史数据不受影响，仍用当前密码保存。</span>';
        if (needPw) {
          body1.innerHTML +=
            '<div class="field" style="margin:12px 0 0"><label style="color:var(--orange)">该文件使用了不同的密码，请输入<b>文件的密码</b>以解密合并</label>' +
            '<input type="password" id="mg-file-pw" autocomplete="off" placeholder="文件的密码"></div>';
        }
        global.UI.modal({
          title: '合并式导入',
          body: body1,
          okText: '开始合并',
          onOk: function () {
            var filePwd = null;
            if (needPw) {
              filePwd = body1.querySelector('#mg-file-pw').value;
              if (!filePwd) { global.UI.toast('请输入文件的密码', 'err'); return false; }
              if (!global.DB.verifyRaw(raw, filePwd)) {
                global.UI.toast('文件密码错误，请重试', 'err');
                var ip = body1.querySelector('#mg-file-pw');
                ip.value = ''; ip.focus();
                return false; // 弹窗保持打开
              }
            }
            var r = global.DB.mergeImport(raw, filePwd);
            global.UI.toast('合并完成：新增账单 ' + r.added + ' 笔（去重跳过 ' + r.skipped + '），新增名目 ' + r.addedNames + '、工具 ' + r.addedTools, 'ok');
            render();
          }
        });
      } else {
        var body2 = document.createElement('div');
        body2.style.cssText = 'color:var(--ink2);line-height:1.9;font-size:13.5px';
        body2.innerHTML =
          '文件 <b>' + global.UI.esc(fileName) + '</b>' + (pre.ok ? '：账单 ' + pre.bills + ' 笔 · 名目 ' + pre.mingmu + ' 个 · 工具 ' + pre.gongju + ' 个' : '') + '<br>' +
          '<span style="color:var(--red)">覆盖后将完全替换当前数据（当前账单 ' + cur.walletdiary.length + ' 笔将丢失），</span>' +
          (pre.ok ? '解锁密码不变。' : '且文件密码与当前密码不同，导入后请用<b>文件的密码</b>解锁。');
        if (needPw) {
          body2.innerHTML +=
            '<div class="field" style="margin:12px 0 0"><label style="color:var(--orange)">该文件使用了不同的密码，请输入<b>文件的密码</b>以确认导入</label>' +
            '<input type="password" id="mg-file-pw" autocomplete="off" placeholder="文件的密码"></div>';
        }
        global.UI.modal({
          title: '覆盖式导入',
          body: body2,
          okText: '覆盖导入',
          onOk: function () {
            if (needPw) {
              var pw = body2.querySelector('#mg-file-pw').value;
              if (!pw) { global.UI.toast('请输入文件的密码', 'err'); return false; }
              if (!global.DB.verifyRaw(raw, pw)) {
                global.UI.toast('文件密码错误，请重试', 'err');
                var ip2 = body2.querySelector('#mg-file-pw');
                ip2.value = ''; ip2.focus();
                return false; // 弹窗保持打开
              }
            }
            try {
              global.DB.importRaw(raw);
              global.UI.toast('覆盖导入成功，页面即将刷新', 'ok');
              setTimeout(function () { global.location.reload(); }, 800);
            } catch (err) {
              global.UI.toast('导入失败：' + err.message, 'err');
            }
          }
        });
      }
    }
  }

  function download(name, text) {
    // 浏览器：Blob 下载；H5+ APP：写入应用文档目录
    if (window.plus) {
      try {
        plus.io.requestFileSystem(plus.io.PUBLIC_DOCUMENTS, function (fs) {
          fs.root.getFile(name, { create: true }, function (entry) {
            entry.createWriter(function (writer) {
              writer.onwrite = function () {
                global.UI.toast('已导出到：' + entry.fullPath, 'ok', 5000);
              };
              writer.onerror = function () { global.UI.toast('导出失败', 'err'); };
              writer.write(text);
            }, function () { global.UI.toast('导出失败', 'err'); });
          }, function () { global.UI.toast('导出失败', 'err'); });
        }, function () { global.UI.toast('导出失败', 'err'); });
        return;
      } catch (e) { /* 回退浏览器方式 */ }
    }
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    global.UI.toast('已开始下载 ' + name, 'ok');
  }

  function sizeText() {
    var raw = global.DB.exportRaw();
    if (!raw) return '-';
    var kb = raw.length / 1024;
    return kb < 1024 ? kb.toFixed(1) + ' KB' : (kb / 1024).toFixed(2) + ' MB';
  }

  global.Pages = global.Pages || {};
  global.Pages.manage = { render: render };
})(window);
