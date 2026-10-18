/* ============================================================
 * storage.js — 数据存储层
 * localStorage 键: WalletDiary = AES(JSON) -> Base64
 * 字段总命名: WalletDiary（json 树根），其余分组为分类名
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'WalletDiary';
  var A = global.CryptoJS.AES, U = global.CryptoJS.enc.Utf8;

  /* 默认数据（首次设置密码后用该密码加密写入） */
  function defaultData() {
    return {
      // —— WalletDiary 总命名下的分类：账单 ——
      walletdiary: [
        // 单笔账单
        // { wid:1, wtime:'2026-10-18 12:30', wyear:2026, wmon:10, wday:18,
        //   wtype:1|2, wname:3, wtool:2, wqtype:1|2, wpayname:'超市', wamount: 25.5, wnote:'' }
      ],
      // —— 款项名目（mid 只增不减）——
      mingmu: [
        { mid: 1, mname: '吃饭', mhide: 0 },
        { mid: 2, mname: '电话费', mhide: 0 },
        { mid: 3, mname: '电费', mhide: 0 },
        { mid: 4, mname: '小零食', mhide: 0 },
        { mid: 5, mname: '网购', mhide: 0 },
        { mid: 6, mname: '生活用品类', mhide: 0 }
      ],
      // —— 支付工具（qid 只增不减）——
      gongju: [
        { qid: 1, qname: '微信余额', qtype: '余额', qhide: 0 },
        { qid: 2, qname: '支付宝余额', qtype: '余额', qhide: 0 },
        { qid: 3, qname: '借记卡', qtype: '银行卡', qhide: 0 },
        { qid: 4, qname: '信用卡', qtype: '银行卡', qhide: 0 },
        { qid: 5, qname: '花呗', qtype: '信用', qhide: 0 }
      ],
      // —— 商户名目（可自定义，默认给几个常用）——
      shanghu: ['超市', '路边摊', '淘宝', '拼多多', '饭店', '水果店'],
      // —— 系统元数据 ——
      meta: { ver: 1, created: '' }
    };
  }

  var DB = null;        // 解密后的数据树（内存）
  var PASSWORD = null;  // 当前密码（改密码用）

  function encrypt(data, pwd) {
    return A.encrypt(JSON.stringify(data), pwd).toString(); // AES -> Base64
  }
  function decrypt(cipherB64, pwd) {
    var bytes = A.decrypt(cipherB64, pwd);
    var txt = bytes.toString(U);
    if (!txt) throw new Error('decrypt-empty');
    return JSON.parse(txt);
  }

  /* ---------- 首次设置 ---------- */
  function setup(password) {
    var d = defaultData();
    d.meta.created = now();
    var cipher = encrypt(d, password);
    global.localStorage.setItem(KEY, cipher);
    DB = d;
    PASSWORD = password;
  }

  /* ---------- 用密码解锁已有数据 ---------- */
  function unlock(password) {
    var cipher = global.localStorage.getItem(KEY);
    if (!cipher) throw new Error('no-data');
    var d = decrypt(cipher, password); // 密码错误会抛异常/解出空
    // 兼容缺失分类
    var def = defaultData();
    ['walletdiary', 'mingmu', 'gongju', 'shanghu', 'meta'].forEach(function (k) {
      if (d[k] === undefined) d[k] = def[k];
    });
    DB = d;
    PASSWORD = password;
  }

  /* ---------- 保存（加密回写） ---------- */
  function save() {
    if (DB === null) throw new Error('not-unlocked');
    global.localStorage.setItem(KEY, encrypt(DB, PASSWORD));
  }

  /* ---------- 修改密码：老密码解密 -> 新密码加密回写 ---------- */
  function changePassword(oldPwd, newPwd) {
    var cipher = global.localStorage.getItem(KEY);
    if (!cipher) throw new Error('no-data');
    var d = decrypt(cipher, oldPwd);   // 老密码错误则抛异常
    global.localStorage.setItem(KEY, encrypt(d, newPwd));
    DB = d;
    PASSWORD = newPwd;
  }

  /* ---------- 导入预检：能否用密码解密、数据概况 ---------- */
  function inspectRaw(raw, pwd) {
    try {
      var d = decrypt(raw, pwd || PASSWORD);
      if (!d || typeof d !== 'object') return { ok: false };
      return {
        ok: true,
        bills: (d.walletdiary || []).length,
        mingmu: (d.mingmu || []).length,
        gongju: (d.gongju || []).length
      };
    } catch (e) {
      return { ok: false };
    }
  }

  /* ---------- 用指定密码验证文件能否解密 ---------- */
  function verifyRaw(raw, pwd) {
    try {
      decrypt(raw, pwd);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 覆盖式导入：直接替换 WalletDiary（保留文件原密码） ---------- */
  function importRaw(raw) {
    if (!/^U2FsdGVkX1/.test(raw)) throw new Error('bad-format');
    global.localStorage.setItem(KEY, raw);
  }

  /* ---------- 合并式导入：与当前数据合并（filePwd 为文件自身的密码） ----------
   * 名目/工具按名称对齐：同名沿用现有编号，新名称追加编号（mid/qid 只增不减）
   * 账单按 内容指纹 去重后重新编号（wid 只增），交易路径/备注等原样保留
   * 合并结果仍用当前密码加密保存
   */
  function mergeImport(raw, filePwd) {
    var imported = decrypt(raw, filePwd || PASSWORD); // 文件密码与当前密码不同时传 filePwd
    var def = defaultData();
    ['walletdiary', 'mingmu', 'gongju', 'shanghu', 'meta'].forEach(function (k) {
      if (imported[k] === undefined) imported[k] = def[k];
    });

    // 名目对齐：导入 mid -> 当前 mid
    var nameMap = {}, addedNames = 0;
    imported.mingmu.forEach(function (m) {
      var exist = DB.mingmu.find(function (x) { return x.mname === m.mname; });
      if (exist) {
        nameMap[m.mid] = exist.mid;
        if (m.mhide && !exist.mhide) { /* 保留当前显示状态，不动 */ }
      } else {
        var nid = nextMid();
        DB.mingmu.push({ mid: nid, mname: m.mname, mhide: 0 });
        nameMap[m.mid] = nid;
        addedNames++;
      }
    });

    // 工具对齐：导入 qid -> 当前 qid
    var toolMap = {}, addedTools = 0;
    imported.gongju.forEach(function (q) {
      var exist = DB.gongju.find(function (x) { return x.qname === q.qname; });
      if (exist) {
        toolMap[q.qid] = exist.qid;
      } else {
        var nq = nextQid();
        DB.gongju.push({ qid: nq, qname: q.qname, qtype: q.qtype || '其他', qhide: 0 });
        toolMap[q.qid] = nq;
        addedTools++;
      }
    });

    // 商户合并
    var shSet = {};
    DB.shanghu.forEach(function (s) { shSet[s] = 1; });
    var addedSh = 0;
    imported.shanghu.forEach(function (s) {
      if (!shSet[s]) { DB.shanghu.push(s); addedSh++; }
    });

    // 账单合并：指纹去重 + 续号
    var existKeys = {};
    DB.walletdiary.forEach(function (b) {
      existKeys[b.wtime + '|' + b.wtype + '|' + b.wname + '|' + b.wtool + '|' + b.wamount + '|' + (b.wpayname || '')] = 1;
    });
    var added = 0, skipped = 0;
    imported.walletdiary.forEach(function (b) {
      var nm = nameMap[b.wname] !== undefined ? nameMap[b.wname] : b.wname;
      var qt = toolMap[b.wtool] !== undefined ? toolMap[b.wtool] : b.wtool;
      var key = b.wtime + '|' + b.wtype + '|' + nm + '|' + qt + '|' + b.wamount + '|' + (b.wpayname || '');
      if (existKeys[key]) { skipped++; return; }
      DB.walletdiary.push({
        wid: nextWid(),
        wtime: b.wtime, wyear: b.wyear, wmon: b.wmon, wday: b.wday,
        wtype: b.wtype, wname: nm, wtool: qt, wqtype: b.wqtype,
        wpayname: b.wpayname || '', wamount: b.wamount, wnote: b.wnote || ''
      });
      existKeys[key] = 1;
      added++;
    });

    save();
    return { added: added, skipped: skipped, addedNames: addedNames, addedTools: addedTools, addedSh: addedSh };
  }

  function now() {
    var t = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()) + ' ' +
      p(t.getHours()) + ':' + p(t.getMinutes());
  }

  /* ---------- 数据访问 ---------- */
  function get() { return DB; }

  /* 账单 */
  function addBill(b) { DB.walletdiary.push(b); save(); }
  function updateBill(wid, patch) {
    for (var i = 0; i < DB.walletdiary.length; i++) {
      if (DB.walletdiary[i].wid === wid) { Object.assign(DB.walletdiary[i], patch); break; }
    }
    save();
  }
  function deleteBill(wid) {
    DB.walletdiary = DB.walletdiary.filter(function (b) { return b.wid !== wid; });
    save();
  }
  function nextWid() {
    var max = 0;
    DB.walletdiary.forEach(function (b) { if (b.wid > max) max = b.wid; });
    return max + 1;
  }

  /* 名目（mid 只正向增加） */
  function nextMid() {
    var max = 0;
    DB.mingmu.forEach(function (m) { if (m.mid > max) max = m.mid; });
    return max + 1;
  }
  function addMingmu(name) {
    DB.mingmu.push({ mid: nextMid(), mname: name, mhide: 0 });
    save();
  }
  function renameMingmu(mid, name) {
    DB.mingmu.forEach(function (m) { if (m.mid === mid) m.mname = name; });
    save();
  }
  function hideMingmu(mid, hide) {
    DB.mingmu.forEach(function (m) { if (m.mid === mid) m.mhide = hide ? 1 : 0; });
    save();
  }

  /* 支付工具（qid 只正向增加） */
  function nextQid() {
    var max = 0;
    DB.gongju.forEach(function (q) { if (q.qid > max) max = q.qid; });
    return max + 1;
  }
  function addGongju(name, type, day) {
    var q = { qid: nextQid(), qname: name, qtype: type || '其他', qhide: 0 };
    if (day >= 1 && day <= 31) q.qday = +day; // 账单日（信用卡/花呗/借呗）
    DB.gongju.push(q);
    save();
  }
  function renameGongju(qid, name, type, day) {
    DB.gongju.forEach(function (q) {
      if (q.qid === qid) {
        q.qname = name;
        if (type !== undefined) q.qtype = type;
        if (day !== undefined) {
          if (day >= 1 && day <= 31) q.qday = +day;
          else delete q.qday;
        }
      }
    });
    save();
  }
  function hideGongju(qid, hide) {
    DB.gongju.forEach(function (q) { if (q.qid === qid) q.qhide = hide ? 1 : 0; });
    save();
  }

  /* ---------- 信用卡类：标记本期已还款（到下个账单日临近时再提醒） ---------- */
  function markToolPaid(qid, billDay) {
    DB.gongju.forEach(function (q) { if (q.qid === qid) q.qpaid = billDay; });
    save();
  }

  /* 商户 */
  function addShanghu(name) {
    name = (name || '').trim();
    if (!name) return;
    if (DB.shanghu.indexOf(name) === -1) { DB.shanghu.push(name); save(); }
  }

  /* 查询辅助 */
  function mingmuName(mid) {
    var m = DB.mingmu.find(function (x) { return x.mid === mid; });
    return m ? m.mname : ('名目#' + mid);
  }
  function gongjuName(qid) {
    var q = DB.gongju.find(function (x) { return x.qid === qid; });
    return q ? q.qname : ('工具#' + qid);
  }

  global.DB = {
    KEY: KEY,
    setup: setup,
    unlock: unlock,
    save: save,
    changePassword: changePassword,
    get: get,
    addBill: addBill, updateBill: updateBill, deleteBill: deleteBill, nextWid: nextWid,
    addMingmu: addMingmu, renameMingmu: renameMingmu, hideMingmu: hideMingmu, nextMid: nextMid,
    addGongju: addGongju, renameGongju: renameGongju, hideGongju: hideGongju, nextQid: nextQid,
    markToolPaid: markToolPaid,
    addShanghu: addShanghu,
    mingmuName: mingmuName, gongjuName: gongjuName,
    isUnlocked: function () { return DB !== null; },
    exportRaw: function () { return global.localStorage.getItem(KEY) || ''; },
    importRaw: importRaw,
    mergeImport: mergeImport,
    inspectRaw: inspectRaw,
    verifyRaw: verifyRaw
  };
})(window);
