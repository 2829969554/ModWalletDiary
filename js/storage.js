/* ============================================================
 * storage.js — 数据存储层
 * localStorage 键: WalletDiary = AES(JSON) -> Base64
 * 字段总命名: WalletDiary（json 树根），其余分组为分类名：
 *   walletdiary 账单 / mingmu 款项名目 / gongju 支付工具 /
 *   accounts 账户 / shanghu 商户 / settings 设置 / meta 元数据
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'WalletDiary';
  var A = global.CryptoJS.AES, U = global.CryptoJS.enc.Utf8;

  /* 信用/贷款类账户类型：不计入总资产，信用额度-可用资金=负债 */
  var CREDIT_ACCT_TYPES = ['信用卡', '花呗', '分付', '月付', '白条', '金条'];
  function isCreditAcct(t) { return CREDIT_ACCT_TYPES.indexOf(t) !== -1; }

  function defaultSettings() {
    return {
      // 发薪日：每月几号（0=未设置）
      payday: { day: 0, show: true },
      // 我的生日 'MM-DD'
      myBirthday: { date: '', show: true },
      // 春节日期 'YYYY-MM-DD'（为空则按内置农历表自动计算）
      cny: { date: '', show: true },
      // 其他人的生日 [{id,name,date:'MM-DD',show}]
      birthdays: [],
      // 我喜欢的节日 [{id,name,date:'YYYY-MM-DD'|'MM-DD',show}]
      festivals: []
    };
  }

  /* 默认数据（首次设置密码后用该密码加密写入） */
  function defaultData() {
    return {
      // —— 账单 ——
      // { wid, wtime:'YYYY-MM-DD HH:mm', wyear, wmon, wday,
      //   Wmoney:'0.00'(两位小数文本), wamount:数字(计算用),
      //   wtype:1|2, wname, wtool, wacct(账户编号,0=未选), wqtype:1|2, wpayname, wnote }
      walletdiary: [],
      // —— 款项名目（mid 只增不减）——
      mingmu: [
        { mid: 1, mname: '吃饭', mhide: 0 },
        { mid: 2, mname: '电话费', mhide: 0 },
        { mid: 3, mname: '电费', mhide: 0 },
        { mid: 4, mname: '小零食', mhide: 0 },
        { mid: 5, mname: '网购', mhide: 0 },
        { mid: 6, mname: '生活用品类', mhide: 0 }
      ],
      // —— 支付工具（qid 只增不减；qlast4=卡号后四位；qday=账单日）——
      gongju: [
        { qid: 1, qname: '微信支付', qtype: '微信支付', qhide: 0, qlast4: '' },
        { qid: 2, qname: '支付宝', qtype: '支付宝', qhide: 0, qlast4: '' },
        { qid: 3, qname: '借记卡', qtype: '借记卡', qhide: 0, qlast4: '' },
        { qid: 4, qname: '信用卡', qtype: '信用卡', qhide: 0, qlast4: '', qday: 0 }
      ],
      // —— 账户（accid 只增不减；accmny=可用资金，随记账增减）——
      accounts: [
        { accid: 1, accname: '微信', acctype: '零钱', accuid: '', accmny: 0 },
        { accid: 2, accname: '支付宝', acctype: '余额宝', accuid: '', accmny: 0 }
      ],
      // —— 商户名目（可自定义，默认给几个常用）——
      shanghu: ['超市', '路边摊', '淘宝', '拼多多', '饭店', '水果店'],
      // —— 设置（发薪日/生日/节日/春节）——
      settings: defaultSettings(),
      // —— 系统元数据 ——
      meta: { ver: 2, created: '' }
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

  /* ---------- 结构迁移/补全：兼容旧版本数据 ---------- */
  function migrate(d) {
    var def = defaultData();
    ['walletdiary', 'mingmu', 'gongju', 'shanghu', 'meta'].forEach(function (k) {
      if (d[k] === undefined) d[k] = def[k];
    });
    // 旧版本（v1）没有 accounts 字段时，补出默认账户；已存在（即使为空）则保留
    if (d.accounts === undefined) d.accounts = def.accounts;
    else if (!Array.isArray(d.accounts)) d.accounts = [];
    if (!d.settings || typeof d.settings !== 'object') d.settings = defaultSettings();
    // 旧设置若是扁平字段则转成新结构（容错）
    var s = d.settings;
    if (!s.payday) s.payday = { day: 0, show: true };
    if (!s.myBirthday) s.myBirthday = { date: '', show: true };
    if (!s.cny) s.cny = { date: '', show: true };
    if (!Array.isArray(s.birthdays)) s.birthdays = [];
    if (!Array.isArray(s.festivals)) s.festivals = [];
    // 生日历法字段补全（solar 公历 / lunar 农历）
    if (!s.myBirthday.cal) s.myBirthday.cal = 'solar';
    s.birthdays.forEach(function (b) { if (!b.cal) b.cal = 'solar'; });
    // 账单字段补全
    d.walletdiary.forEach(function (b) {
      if (b.wamount === undefined) b.wamount = Number(b.Wmoney) || 0;
      if (b.Wmoney === undefined) b.Wmoney = (Number(b.wamount) || 0).toFixed(2);
      if (b.wacct === undefined) b.wacct = 0;
    });
    // 支付工具字段补全
    d.gongju.forEach(function (q) {
      if (q.qlast4 === undefined) q.qlast4 = '';
      if (q.qday === undefined) q.qday = 0;
    });
    // 账户字段补全
    d.accounts.forEach(function (a) {
      if (a.acclimit === undefined) a.acclimit = 0; // 信用额度
      if (a.accday === undefined) a.accday = 0;     // 账单日
    });
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
    migrate(d);
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
        gongju: (d.gongju || []).length,
        accounts: (d.accounts || []).length
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
   * 名目/工具/账户按名称对齐：同名沿用现有编号，新名称追加编号（编号只增不减）
   * 账单按 内容指纹 去重后重新编号（wid 只增）；合并结果仍用当前密码加密保存
   */
  function mergeImport(raw, filePwd) {
    var imported = decrypt(raw, filePwd || PASSWORD); // 文件密码与当前密码不同时传 filePwd
    var def = defaultData();
    ['walletdiary', 'mingmu', 'gongju', 'shanghu', 'accounts', 'settings'].forEach(function (k) {
      if (imported[k] === undefined) imported[k] = def[k];
    });

    // 名目对齐：导入 mid -> 当前 mid
    var nameMap = {}, addedNames = 0;
    imported.mingmu.forEach(function (m) {
      var exist = DB.mingmu.find(function (x) { return x.mname === m.mname; });
      if (exist) {
        nameMap[m.mid] = exist.mid;
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
        DB.gongju.push({ qid: nq, qname: q.qname, qtype: q.qtype || '其他', qhide: 0, qlast4: q.qlast4 || '', qday: q.qday || 0 });
        toolMap[q.qid] = nq;
        addedTools++;
      }
    });

    // 账户对齐：导入 accid -> 当前 accid
    var acctMap = {}, addedAccounts = 0;
    imported.accounts.forEach(function (a) {
      var exist = DB.accounts.find(function (x) { return x.accname === a.accname; });
      if (exist) {
        acctMap[a.accid] = exist.accid;
      } else {
        var na = nextAccid();
        DB.accounts.push({ accid: na, accname: a.accname, acctype: a.acctype || '余额', accuid: a.accuid || '', accmny: Number(a.accmny) || 0, accday: a.accday || 0, acclimit: Number(a.acclimit) || 0 });
        acctMap[a.accid] = na;
        addedAccounts++;
      }
    });

    // 商户合并
    var shSet = {};
    DB.shanghu.forEach(function (s) { shSet[s] = 1; });
    var addedSh = 0;
    imported.shanghu.forEach(function (s) {
      if (!shSet[s]) { DB.shanghu.push(s); addedSh++; }
    });

    // 账单合并：指纹去重 + 续号 + 账户余额联动
    var existKeys = {};
    DB.walletdiary.forEach(function (b) {
      existKeys[b.wtime + '|' + b.wtype + '|' + b.wname + '|' + b.wtool + '|' + b.wamount + '|' + (b.wpayname || '')] = 1;
    });
    var added = 0, skipped = 0;
    imported.walletdiary.forEach(function (b) {
      var nm = nameMap[b.wname] !== undefined ? nameMap[b.wname] : b.wname;
      var qt = toolMap[b.wtool] !== undefined ? toolMap[b.wtool] : b.wtool;
      var ac = acctMap[b.wacct] !== undefined ? acctMap[b.wacct] : (b.wacct || 0);
      var key = b.wtime + '|' + b.wtype + '|' + nm + '|' + qt + '|' + b.wamount + '|' + (b.wpayname || '');
      if (existKeys[key]) { skipped++; return; }
      var bill = {
        wid: nextWid(),
        wtime: b.wtime, wyear: b.wyear, wmon: b.wmon, wday: b.wday,
        Wmoney: (Number(b.wamount) || 0).toFixed(2), wamount: Number(b.wamount) || 0,
        wtype: b.wtype, wname: nm, wtool: qt, wacct: ac, wqtype: b.wqtype,
        wpayname: b.wpayname || '', wnote: b.wnote || ''
      };
      DB.walletdiary.push(bill);
      accountEffect(bill, 1);
      existKeys[key] = 1;
      added++;
    });

    save();
    return { added: added, skipped: skipped, addedNames: addedNames, addedTools: addedTools, addedAccounts: addedAccounts, addedSh: addedSh };
  }

  function now() {
    var t = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()) + ' ' +
      p(t.getHours()) + ':' + p(t.getMinutes());
  }

  /* ---------- 数据访问 ---------- */
  function get() { return DB; }

  /* ============ 账单 ============ */
  function billDelta(b) {
    var amt = Number(b.wamount) || 0;
    return b.wtype === 1 ? amt : -amt;
  }
  // 记账对账户可用资金的影响（sign=1 计入 / -1 冲销）
  function accountEffect(b, sign) {
    if (!b.wacct) return;
    var a = DB.accounts.find(function (x) { return x.accid === b.wacct; });
    if (!a) return;
    a.accmny = Math.round(((Number(a.accmny) || 0) + billDelta(b) * sign) * 100) / 100;
  }

  function addBill(b) {
    DB.walletdiary.push(b);
    accountEffect(b, 1);
    save();
  }
  function updateBill(wid, patch) {
    for (var i = 0; i < DB.walletdiary.length; i++) {
      if (DB.walletdiary[i].wid === wid) {
        accountEffect(DB.walletdiary[i], -1); // 先冲销旧账
        Object.assign(DB.walletdiary[i], patch);
        accountEffect(DB.walletdiary[i], 1);  // 再计入新账
        break;
      }
    }
    save();
  }
  function deleteBill(wid) {
    var b = DB.walletdiary.find(function (x) { return x.wid === wid; });
    if (b) accountEffect(b, -1);
    DB.walletdiary = DB.walletdiary.filter(function (x) { return x.wid !== wid; });
    save();
  }
  function nextWid() {
    var max = 0;
    DB.walletdiary.forEach(function (b) { if (b.wid > max) max = b.wid; });
    return max + 1;
  }

  /* ============ 款项名目（mid 只正向增加） ============ */
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

  /* ============ 支付工具（qid 只正向增加） ============ */
  function nextQid() {
    var max = 0;
    DB.gongju.forEach(function (q) { if (q.qid > max) max = q.qid; });
    return max + 1;
  }
  function addGongju(name, type, day, last4) {
    var q = { qid: nextQid(), qname: name, qtype: type || '其他', qhide: 0, qlast4: last4 || '' };
    if (day >= 1 && day <= 31) q.qday = +day; else q.qday = 0;
    DB.gongju.push(q);
    save();
  }
  function renameGongju(qid, name, type, day, last4) {
    DB.gongju.forEach(function (q) {
      if (q.qid === qid) {
        q.qname = name;
        if (type !== undefined) q.qtype = type;
        if (day !== undefined) {
          if (day >= 1 && day <= 31) q.qday = +day;
          else q.qday = 0;
        }
        if (last4 !== undefined) q.qlast4 = String(last4 || '').slice(-4);
      }
    });
    save();
  }
  function hideGongju(qid, hide) {
    DB.gongju.forEach(function (q) { if (q.qid === qid) q.qhide = hide ? 1 : 0; });
    save();
  }
  /* 信用卡类：标记本期已还款（到下个账单日临近时再提醒） */
  function markToolPaid(qid, billDay) {
    DB.gongju.forEach(function (q) { if (q.qid === qid) q.qpaid = billDay; });
    save();
  }
  /* 信用卡类账户：标记本期已还款 */
  function markAccountPaid(accid, billDay) {
    DB.accounts.forEach(function (a) { if (a.accid === accid) a.accpaid = billDay; });
    save();
  }

  /* ============ 账户（accid 只正向增加） ============ */
  function nextAccid() {
    var max = 0;
    DB.accounts.forEach(function (a) { if (a.accid > max) max = a.accid; });
    return max + 1;
  }
  function addAccount(name, type, uid, mny, day, limit) {
    var a = { accid: nextAccid(), accname: name, acctype: type || '余额', accuid: uid || '', accmny: Number(mny) || 0 };
    if (isCreditAcct(a.acctype)) {
      a.accday = (day >= 1 && day <= 31) ? +day : 0;  // 账单日
      a.acclimit = Number(limit) || 0;                 // 信用额度
    } else {
      a.accday = 0;
      a.acclimit = 0;
    }
    DB.accounts.push(a);
    save();
  }
  function renameAccount(accid, name, type, uid, day, limit, mny) {
    DB.accounts.forEach(function (a) {
      if (a.accid === accid) {
        a.accname = name;
        if (type !== undefined) a.acctype = type;
        if (uid !== undefined) a.accuid = uid;
        if (mny !== undefined) a.accmny = Math.round(Number(mny) * 100) / 100; // 直接修正可用资金
        if (isCreditAcct(a.acctype)) {
          if (day !== undefined) a.accday = (day >= 1 && day <= 31) ? +day : a.accday || 0;
          if (limit !== undefined) a.acclimit = Number(limit) || 0;
        } else {
          a.accday = 0;
          a.acclimit = 0;
        }
      }
    });
    save();
  }
  function hideAccount(accid, hide) {
    DB.accounts.forEach(function (a) { if (a.accid === accid) a.acchide = hide ? 1 : 0; });
    save();
  }
  function adjustAccount(accid, delta) {
    var a = DB.accounts.find(function (x) { return x.accid === accid; });
    if (a) { a.accmny = Math.round(((Number(a.accmny) || 0) + delta) * 100) / 100; save(); }
  }

  /* ---------- 转账：任意两个账户之间划转可用资金（转入信用卡=还款，负债随之减少）
   * 信用类账户（信用卡/花呗/分付/月付/白条/金条）只能作为转入账户，不能转出
   */
  function transfer(fromAccid, toAccid, amount) {
    amount = Math.round(Number(amount) * 100) / 100;
    if (!(amount > 0)) throw new Error('金额必须大于 0');
    if (!fromAccid || !toAccid) throw new Error('请选择转出/转入账户');
    if (fromAccid === toAccid) throw new Error('转出与转入不能是同一个账户');
    var from = DB.accounts.find(function (x) { return x.accid === fromAccid; });
    var to = DB.accounts.find(function (x) { return x.accid === toAccid; });
    if (!from || !to) throw new Error('账户不存在');
    if (isCreditAcct(from.acctype)) throw new Error('信用类账户只能作为转入账户（还款），不能转出');
    from.accmny = Math.round(((Number(from.accmny) || 0) - amount) * 100) / 100;
    to.accmny = Math.round(((Number(to.accmny) || 0) + amount) * 100) / 100;
    save();
    return { from: from.accname, to: to.accname, amount: amount };
  }

  /* ============ 商户 ============ */
  function addShanghu(name) {
    name = (name || '').trim();
    if (!name) return;
    if (DB.shanghu.indexOf(name) === -1) { DB.shanghu.push(name); save(); }
  }

  /* ============ 设置 ============ */
  function getSettings() { return DB.settings; }
  function saveSettings() { save(); }

  /* ---------- 查询辅助 ---------- */
  function mingmuName(mid) {
    var m = DB.mingmu.find(function (x) { return x.mid === mid; });
    return m ? m.mname : ('名目#' + mid);
  }
  function gongjuName(qid) {
    var q = DB.gongju.find(function (x) { return x.qid === qid; });
    return q ? q.qname : ('工具#' + qid);
  }
  function accountName(accid) {
    if (!accid) return '';
    var a = DB.accounts.find(function (x) { return x.accid === accid; });
    return a ? a.accname : ('账户#' + accid);
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
    markAccountPaid: markAccountPaid,
    isCreditAcct: isCreditAcct,
    addAccount: addAccount, renameAccount: renameAccount, hideAccount: hideAccount, nextAccid: nextAccid,
    adjustAccount: adjustAccount, transfer: transfer,
    addShanghu: addShanghu,
    mingmuName: mingmuName, gongjuName: gongjuName, accountName: accountName,
    getSettings: getSettings, saveSettings: saveSettings,
    isUnlocked: function () { return DB !== null; },
    exportRaw: function () { return global.localStorage.getItem(KEY) || ''; },
    importRaw: importRaw,
    mergeImport: mergeImport,
    inspectRaw: inspectRaw,
    verifyRaw: verifyRaw
  };
})(window);
