// manage.js —— 数据导出、导入与密码修改
(function (global) {
  'use strict';

  function render() {
    const el = document.getElementById('page-manage');
    const d = global.DB.get();
    const raw = global.DB.exportRaw();
    const kb = raw ? raw.length / 1024 : 0;
    const size = raw ? (kb < 1024 ? kb.toFixed(1) + ' KB' : (kb / 1024).toFixed(2) + ' MB') : '-';

    el.innerHTML = `
      <div class="manage-grid">
        <div class="card">
          <div class="card-title"><span class="bar"></span>导出数据</div>
          <p style="color:var(--ink2);font-size:12.5px;line-height:1.8;margin-bottom:14px">
            将 localStorage 中 <b>WalletDiary</b> 加密数据文件下载到本地。<br>文件内容为 AES 加密密文，需密码才能解密，可放心备份。
          </p>
          <button id="mg-export" class="btn-primary btn-block">下载 WalletDiary 数据文件</button>
        </div>

        <div class="card">
          <div class="card-title"><span class="bar"></span>导入数据</div>
          <p style="color:var(--ink2);font-size:12.5px;line-height:1.8;margin-bottom:10px">
            选择本机的数据文件导入到 localStorage 的 WalletDiary。文件需密码才能解密（覆盖式保留文件原密码）。
          </p>
          <div class="field">
            <label>导入方式</label>
            <div class="radio-row">
              <div class="radio-chip path imp-mode on" data-v="merge"><span class="dot"></span>合并式</div>
              <div class="radio-chip expense imp-mode" data-v="overwrite"><span class="dot"></span>覆盖式</div>
            </div>
          </div>
          <p id="mg-imp-tip" style="color:var(--muted);font-size:11.5px;line-height:1.7;margin-bottom:12px">
            合并式：与当前数据合并，同名名目/工具沿用现有编号，账单按时间去重，不丢失任何一边数据。
          </p>
          <input type="file" id="mg-import-file" accept=".json,.txt,.wdb,application/json,text/plain" style="display:none">
          <button id="mg-import" class="btn-ghost btn-block" style="height:44px">选择本机文件导入…</button>
        </div>

        <div class="card">
          <div class="card-title"><span class="bar"></span>修改密码</div>
          <div class="field"><label>老密码</label><input type="password" id="mg-old" autocomplete="current-password"></div>
          <div class="field"><label>新密码</label><input type="password" id="mg-new1" autocomplete="new-password"></div>
          <div class="field"><label>再次输入新密码</label><input type="password" id="mg-new2" autocomplete="new-password"></div>
          <button id="mg-chpwd" class="btn-primary btn-block">确认修改</button>
          <p style="color:var(--muted);font-size:11.5px;margin-top:10px">修改成功后页面将刷新，请使用新密码解锁。</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar"></span>存储信息</div>
        <div class="table-wrap"><table class="tbl">
          <tbody>
            <tr><td>存储位置</td><td>localStorage · WalletDiary</td></tr>
            <tr><td>加密方式</td><td>AES（CryptoJS）→ Base64</td></tr>
            <tr><td>数据大小</td><td class="num">${size}</td></tr>
            <tr><td>账单 / 名目 / 工具</td><td class="num">${d.walletdiary.length} / ${d.mingmu.length} / ${d.gongju.length}</td></tr>
          </tbody>
        </table></div>
      </div>`;

    el.querySelector('#mg-export').addEventListener('click', () => {
      const cipher = global.DB.exportRaw();
      if (!cipher) { global.UI.toast('没有可导出的数据', 'err'); return; }
      const payload = JSON.stringify({
        app: 'ModWalletDiary',
        key: global.DB.KEY,
        exported: new Date().toISOString(),
        data: cipher
      }, null, 2);
      download('WalletDiary.json', payload);
    });

    let impMode = 'merge';
    el.querySelectorAll('.imp-mode').forEach((chip) => {
      chip.addEventListener('click', () => {
        el.querySelectorAll('.imp-mode').forEach((c) => { c.classList.remove('on'); });
        chip.classList.add('on');
        impMode = chip.dataset.v;
        el.querySelector('#mg-imp-tip').textContent = impMode === 'merge'
          ? '合并式：与当前数据合并，同名名目/工具沿用现有编号，账单按时间去重，不丢失任何一边数据。'
          : '覆盖式：用文件内容完全替换当前全部数据（当前数据将丢失），解锁密码变为文件加密时的密码。';
      });
    });

    const fileInput = el.querySelector('#mg-import-file');
    el.querySelector('#mg-import').addEventListener('click', () => { fileInput.click(); });
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        // 导出文件套了一层 JSON，裸密文也照收
        const text = String(reader.result || '').trim();
        let cipher = text;
        try {
          const obj = JSON.parse(text);
          if (obj && typeof obj.data === 'string') cipher = obj.data;
        } catch (err) { /* 裸密文，解析不了就按原文走 */ }
        if (!cipher) { global.UI.toast('文件内容无效', 'err'); return; }
        openImportDialog(cipher, f.name, impMode);
      };
      reader.readAsText(f);
      fileInput.value = '';
    });

    el.querySelector('#mg-chpwd').addEventListener('click', () => {
      const old1 = el.querySelector('#mg-old').value;
      const n1 = el.querySelector('#mg-new1').value;
      const n2 = el.querySelector('#mg-new2').value;
      if (!old1) { global.UI.toast('请输入老密码', 'err'); return; }
      if (!n1 || n1.length < 4) { global.UI.toast('新密码至少 4 位', 'err'); return; }
      if (n1 !== n2) { global.UI.toast('两次输入的新密码不一致', 'err'); return; }
      try {
        global.DB.changePassword(old1, n1);
        global.UI.toast('密码修改成功，页面即将刷新', 'ok');
        setTimeout(() => { global.location.reload(); }, 900);
      } catch (err) {
        global.UI.toast('老密码错误', 'err');
      }
    });
  }

  // 导入弹窗：合并式和覆盖式共用，差别只在文案和收尾动作
  function openImportDialog(cipher, fileName, mode) {
    const pre = global.DB.inspectRaw(cipher);
    const cur = global.DB.get();
    // 先拿当前密码试着解开，解不开才问用户要文件密码
    const needPw = !pre.ok && /^U2FsdGVkX1/.test(cipher);
    const merge = mode === 'merge';
    const summary = pre.ok
      ? '：账单 ' + pre.bills + ' 笔 · 名目 ' + pre.mingmu + ' 个 · 工具 ' + pre.gongju + ' 个'
      : '';

    const body = document.createElement('div');
    body.style.cssText = 'color:var(--ink2);line-height:1.9;font-size:13.5px';
    body.innerHTML = merge
      ? '文件 <b>' + global.UI.esc(fileName) + '</b>' + summary + '<br>' +
        '当前账本：账单 ' + cur.walletdiary.length + ' 笔<br>' +
        '<span style="color:var(--muted);font-size:12px">合并后：同名名目/工具沿用现有编号，账单按内容去重，历史数据不受影响，仍用当前密码保存。</span>'
      : '文件 <b>' + global.UI.esc(fileName) + '</b>' + summary + '<br>' +
        '<span style="color:var(--red)">覆盖后将完全替换当前数据（当前账单 ' + cur.walletdiary.length + ' 笔将丢失），</span>' +
        (pre.ok ? '解锁密码不变。' : '且文件密码与当前密码不同，导入后请用<b>文件的密码</b>解锁。');

    if (needPw) {
      body.innerHTML += '<div class="field" style="margin:12px 0 0"><label style="color:var(--orange)">' +
        (merge ? '该文件使用了不同的密码，请输入<b>文件的密码</b>以解密合并'
               : '该文件使用了不同的密码，请输入<b>文件的密码</b>以确认导入') +
        '</label><input type="password" id="mg-file-pw" autocomplete="off" placeholder="文件的密码"></div>';
    }

    global.UI.modal({
      title: merge ? '合并式导入' : '覆盖式导入',
      body: body,
      okText: merge ? '开始合并' : '覆盖导入',
      onOk: function () {
        let filePwd = null;
        if (needPw) {
          const ip = body.querySelector('#mg-file-pw');
          filePwd = ip.value;
          if (!filePwd) { global.UI.toast('请输入文件的密码', 'err'); return false; }
          if (!global.DB.verifyRaw(cipher, filePwd)) {
            global.UI.toast('文件密码错误，请重试', 'err');
            ip.value = '';
            ip.focus();
            return false; // 密码不对，弹窗先别关
          }
        }

        if (merge) {
          const r = global.DB.mergeImport(cipher, filePwd);
          global.UI.toast('合并完成：新增账单 ' + r.added + ' 笔（去重跳过 ' + r.skipped + '），新增名目 ' + r.addedNames + '、工具 ' + r.addedTools, 'ok');
          render();
          return;
        }

        try {
          // 覆盖式连密码一起换掉，之后得用文件的密码解锁
          global.DB.importRaw(cipher);
          global.UI.toast('覆盖导入成功，页面即将刷新', 'ok');
          setTimeout(() => { global.location.reload(); }, 800);
        } catch (err) {
          global.UI.toast('导入失败：' + err.message, 'err');
        }
      }
    });
  }

  // 导出：安卓走 H5+ 写文件，普通浏览器走 Blob 下载
  function download(name, text) {
    if (window.plus && window.plus.io && exportByPlus(name, text)) return;
    downloadByBrowser(name, text);
  }

  // H5+ 环境导出：SD 卡 Documents/backups 和应用私有目录 _doc/backups 各写一份，再调系统分享
  function exportByPlus(name, text) {
    try {
      const dateStr = (global.UI.today() || '').replace(/-/g, '');
      const base = name.replace(/\.[^.]+$/, '');
      const ext = (name.match(/\.([^.]+)$/) || [0, 'json'])[1];
      const prefix = base + '_' + dateStr + '_';

      writeBackupFile(plus.io.PUBLIC_DOCUMENTS, prefix, ext, text, (err, entry) => {
        if (err) { global.UI.toast('SD 卡导出失败：' + err.message, 'err'); return; }
        global.UI.toast('已导出：Documents/backups/' + entry.name);
        shareBackup(entry);
      });
      // 应用私有目录会被系统清掉，SD 卡那份才是真正的备份
      writeBackupFile(plus.io.PRIVATE_DOC, prefix, ext, text, (err) => {
        if (err) global.UI.toast('应用目录导出失败：' + err.message, 'err');
      });
      return true;
    } catch (e) {
      return false; // H5+ 用不了就退回浏览器方式
    }
  }

  // 往指定文件系统目录里写备份文件，文件名带当天正序序号
  function writeBackupFile(fsId, prefix, ext, text, cb) {
    plus.io.requestFileSystem(fsId, (fs) => {
      fs.root.getDirectory('backups', { create: true }, (dir) => {
        nextBackupName(dir, prefix, ext, (nn) => {
          const fname = prefix + nn + '.' + ext;
          dir.getFile(fname, { create: true }, (entry) => {
            entry.createWriter((writer) => {
              writer.onwrite = () => { cb(null, entry); };
              writer.onerror = () => { cb(new Error('写入失败')); };
              writer.write(text);
            }, () => { cb(new Error('创建写入器失败')); });
          }, () => { cb(new Error('创建文件失败')); });
        });
      }, () => { cb(new Error('创建 backups 目录失败')); });
    }, () => { cb(new Error('打开文件系统失败')); });
  }

  // 算这个备份文件当天是第几个，序号正着排（01、02…）
  function nextBackupName(dir, prefix, ext, cb) {
    const reader = dir.createReader();
    const re = new RegExp('^' + prefix + '(\\d{2})\\.' + ext + '$');
    const pad = (n) => (n < 10 ? '0' : '') + n;
    let max = 0, pages = 0;
    (function readPage() {
      reader.readEntries((entries) => {
        if (!entries.length || ++pages > 20) return cb(pad(max + 1));
        entries.forEach((e) => {
          const m = re.exec(e.name);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        readPage();
      }, () => { cb(pad(max + 1)); });
    })();
  }

  // 调起系统分享面板，让用户把备份文件发出去
  function shareBackup(entry) {
    if (!window.plus.share || !plus.share.sendWithSystem) return;
    plus.share.sendWithSystem({
      type: 'text',
      content: '导出文件地址: ' + entry.fullPath + '\n请你打开文件管理器到此路径,手动将此文件转移至安全位置并妥善保存。（例如：发送到微信或者网盘）'
    }, () => {
      global.UI.toast('已调起系统分享，可将备份文件发出');
    }, () => {
      global.UI.toast('备份已导出（系统分享不可用）');
    });
  }

  // 浏览器环境导出：Blob 下载，文件名带日期
  function downloadByBrowser(name, text) {
    const dateTag = (global.UI.today() || '').replace(/-/g, '');
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/\.json$/, '_' + dateTag + '.json');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    global.UI.toast('已开始下载 ' + a.download, 'ok');
  }

  global.Pages = global.Pages || {};
  global.Pages.manage = { render: render };
})(window);
