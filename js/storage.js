// storage.js —— 账本数据的加解密、读写与导入导出
(function (global) {
  'use strict';

  const KEY = 'WalletDiary';
  const A = global.CryptoJS.AES;
  const U = global.CryptoJS.enc.Utf8;

  // 信用/贷款类账户：不计入总资产，负债 = 信用额度 - 可用资金
  const CREDIT_ACCT_TYPES = ['信用卡', '花呗', '分付', '月付', '白条', '金条'];

  let DB = null;       // 解密后的数据树（只在内存里）
  let PASSWORD = null; // 当前密码，改密码时要用

  const isCreditAcct = (type) => CREDIT_ACCT_TYPES.indexOf(type) !== -1;

  function defaultSettings() {
    return {
      // 显示模式：auto 自动（7:00-18:00 浅色）/ light 浅色 / dark 深色
      theme: 'auto',
      // 发薪日：每月几号（0=未设置）
      payday: { day: 0, show: true },
      // 我的生日 'MM-DD'
      myBirthday: { date: '', show: true },
      // 春节日期 'YYYY-MM-DD'（留空则按内置农历表自动算）
      cny: { date: '', show: true },
      // 别人的生日 [{id,name,date:'MM-DD',show}]
      birthdays: [],
      // 我喜欢的节日 [{id,name,date:'YYYY-MM-DD'|'MM-DD',show}]
      festivals: []
    };
  }

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
      // —— 商户名目 ——
      shanghu: ['超市', '路边摊', '淘宝', '拼多多', '饭店', '水果店'],
      // —— 设置（发薪日/生日/节日/春节）——
      settings: defaultSettings(),
      // —— 系统元数据 ——
      meta: { ver: 2, created: '' }
    };
  }

  function encrypt(data, pwd) {
    return A.encrypt(JSON.stringify(data), pwd).toString();
  }

  function decrypt(cipherB64, pwd) {
    const txt = A.decrypt(cipherB64, pwd).toString(U);
    if (!txt) throw new Error('decrypt-empty');
    return JSON.parse(txt);
  }

  // 当前时间 'YYYY-MM-DD HH:mm'
  function now() {
    const t = new Date();
    const p = (n) => (n < 10 ? '0' : '') + n;
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
  }

  // 老版本的数据缺字段，补齐后再用；已有的值一律不动
  function migrate(d) {
    const def = defaultData();
    ['walletdiary', 'mingmu', 'gongju', 'shanghu', 'meta'].forEach((k) => {
      if (d[k] === undefined) d[k] = def[k];
    });
    // v1 没有 accounts 字段，补一份默认账户；已经有（哪怕是空数组）就保留
    if (d.accounts === undefined) d.accounts = def.accounts;
    // 字段类型被改坏的情况，直接当成空列表处理，别让后面的循环崩掉
    ['walletdiary', 'mingmu', 'gongju', 'shanghu', 'accounts'].forEach((k) => {
      if (!Array.isArray(d[k])) d[k] = [];
    });

    let st = d.settings;
    if (!st || typeof st !== 'object') st = defaultSettings();
    d.settings = st;
    if (!st.theme) st.theme = 'auto';
    if (!st.payday) st.payday = { day: 0, show: true };
    if (!st.myBirthday) st.myBirthday = { date: '', show: true };
    if (!st.cny) st.cny = { date: '', show: true };
    if (!Array.isArray(st.birthdays)) st.birthdays = [];
    if (!Array.isArray(st.festivals)) st.festivals = [];
    // 生日后来加了公历/农历，老数据没标记的一律按公历算
    if (!st.myBirthday.cal) st.myBirthday.cal = 'solar';
    st.birthdays.forEach((b) => { if (!b.cal) b.cal = 'solar'; });

    d.walletdiary.forEach((b) => {
      if (b.wamount === undefined) b.wamount = Number(b.Wmoney) || 0;
      if (b.Wmoney === undefined) b.Wmoney = (Number(b.wamount) || 0).toFixed(2);
      if (b.wacct === undefined) b.wacct = 0;
    });
    d.gongju.forEach((q) => {
      if (q.qlast4 === undefined) q.qlast4 = '';
      if (q.qday === undefined) q.qday = 0;
    });
    d.accounts.forEach((a) => {
      if (a.acclimit === undefined) a.acclimit = 0; // 信用额度
      if (a.accday === undefined) a.accday = 0;     // 账单日
    });
  }

  // 显示模式同步到页面，并镜像一份到 localStorage（解锁前的页面也要用）
  function syncTheme() {
    if (!global.UI || !global.UI.applyTheme) return;
    global.UI.applyTheme(DB.settings.theme);
    try { global.localStorage.setItem('WalletDiaryTheme', DB.settings.theme); } catch (e) { /* 存不下就算了 */ }
  }

  function setup(password) {
    const d = defaultData();
    d.meta.created = now();
    global.localStorage.setItem(KEY, encrypt(d, password));
    DB = d;
    PASSWORD = password;
    syncTheme();
  }

  function unlock(password) {
    const cipher = global.localStorage.getItem(KEY);
    if (!cipher) throw new Error('no-data');
    const d = decrypt(cipher, password); // 密码不对会抛异常或解出空
    migrate(d);
    DB = d;
    PASSWORD = password;
    syncTheme();
  }

  function save() {
    if (DB === null) throw new Error('not-unlocked');
    global.localStorage.setItem(KEY, encrypt(DB, PASSWORD));
  }

  /**
   * 改密码：老密码解密，再用新密码加密回写
   * @param {string} oldPwd 老密码
   * @param {string} newPwd 新密码
   */
  function changePassword(oldPwd, newPwd) {
    const cipher = global.localStorage.getItem(KEY);
    if (!cipher) throw new Error('no-data');
    const d = decrypt(cipher, oldPwd); // 老密码错了这里就抛
    global.localStorage.setItem(KEY, encrypt(d, newPwd));
    DB = d;
    PASSWORD = newPwd;
  }

  /**
   * 导入前的预检：能不能解开、里面大概多少条
   * @param {string} raw 文件内容（Base64 密文）
   * @param {string} pwd 密码，不传就用当前密码
   * @returns {object} 能解开返回 {ok:true, bills, mingmu, gongju, accounts}，否则 {ok:false}
   */
  function inspectRaw(raw, pwd) {
    try {
      const d = decrypt(raw, pwd || PASSWORD);
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

  function verifyRaw(raw, pwd) {
    try {
      decrypt(raw, pwd);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 覆盖式导入：直接替换 WalletDiary，密码沿用文件里的那个
  function importRaw(raw) {
    if (!/^U2FsdGVkX1/.test(raw)) throw new Error('bad-format');
    global.localStorage.setItem(KEY, raw);
  }

  // 下一个编号 = 现有最大编号 + 1，编号只增不减，删掉的也不回收
  function nextId(list, key) {
    let max = 0;
    list.forEach((it) => { if (it[key] > max) max = it[key]; });
    return max + 1;
  }

  const nextWid = () => nextId(DB.walletdiary, 'wid');
  const nextMid = () => nextId(DB.mingmu, 'mid');
  const nextQid = () => nextId(DB.gongju, 'qid');
  const nextAccid = () => nextId(DB.accounts, 'accid');

  // —— 账单 ——

  // 一笔账单对账户可用资金的影响：收入为正，支出为负；sign=1 计入，-1 冲销
  function accountEffect(b, sign) {
    if (!b.wacct) return;
    const a = DB.accounts.find((x) => x.accid === b.wacct);
    if (!a) return;
    const amt = Number(b.wamount) || 0;
    const delta = b.wtype === 1 ? amt : -amt;
    a.accmny = Math.round(((Number(a.accmny) || 0) + delta * sign) * 100) / 100;
  }

  function addBill(b) {
    DB.walletdiary.push(b);
    accountEffect(b, 1);
    save();
  }

  // 改一笔账单：先把旧账从账户资金里冲销，再按新账计入
  function updateBill(wid, patch) {
    const b = DB.walletdiary.find((x) => x.wid === wid);
    if (b) {
      accountEffect(b, -1);
      Object.assign(b, patch);
      accountEffect(b, 1);
    }
    save();
  }

  // 删一笔账单：真从列表里去掉，账户资金同步退回来
  function deleteBill(wid) {
    const b = DB.walletdiary.find((x) => x.wid === wid);
    if (b) accountEffect(b, -1);
    DB.walletdiary = DB.walletdiary.filter((x) => x.wid !== wid);
    save();
  }

  // —— 名目与支付工具 ——

  function addMingmu(name) {
    DB.mingmu.push({ mid: nextMid(), mname: name, mhide: 0 });
    save();
  }

  function renameMingmu(mid, name) {
    DB.mingmu.forEach((m) => { if (m.mid === mid) m.mname = name; });
    save();
  }

  // 隐藏名目：只是不显示了，编号留着也不再复用
  function hideMingmu(mid, hide) {
    DB.mingmu.forEach((m) => { if (m.mid === mid) m.mhide = hide ? 1 : 0; });
    save();
  }

  // 账单日只认 1-31，别的按没设处理
  function normDay(day) {
    return (day >= 1 && day <= 31) ? +day : 0;
  }

  function addGongju(name, type, day, last4) {
    DB.gongju.push({
      qid: nextQid(),
      qname: name,
      qtype: type || '其他',
      qhide: 0,
      qlast4: last4 || '',
      qday: normDay(day)
    });
    save();
  }

  // 改支付工具，type/day/last4 传 undefined 表示这一项不动
  function renameGongju(qid, name, type, day, last4) {
    DB.gongju.forEach((q) => {
      if (q.qid !== qid) return;
      q.qname = name;
      if (type !== undefined) q.qtype = type;
      if (day !== undefined) q.qday = normDay(day);
      if (last4 !== undefined) q.qlast4 = String(last4 || '').slice(-4);
    });
    save();
  }

  // 隐藏支付工具：同名目，编号留着
  function hideGongju(qid, hide) {
    DB.gongju.forEach((q) => { if (q.qid === qid) q.qhide = hide ? 1 : 0; });
    save();
  }

  // 标记信用卡类工具本期已还款（到下个账单日临近时再提醒）
  function markToolPaid(qid, billDay) {
    DB.gongju.forEach((q) => { if (q.qid === qid) q.qpaid = billDay; });
    save();
  }

  // 标记信用卡类账户本期已还款
  function markAccountPaid(accid, billDay) {
    DB.accounts.forEach((a) => { if (a.accid === accid) a.accpaid = billDay; });
    save();
  }

  // —— 账户 ——

  function addAccount(name, type, uid, mny, day, limit) {
    const a = {
      accid: nextAccid(),
      accname: name,
      acctype: type || '余额',
      accuid: uid || '',
      accmny: Number(mny) || 0
    };
    if (isCreditAcct(a.acctype)) {
      a.accday = normDay(day);         // 账单日
      a.acclimit = Number(limit) || 0; // 信用额度
    } else {
      a.accday = 0;
      a.acclimit = 0;
    }
    DB.accounts.push(a);
    save();
  }

  // 改账户，type/uid/day/limit/mny 传 undefined 表示这一项不动
  function renameAccount(accid, name, type, uid, day, limit, mny) {
    DB.accounts.forEach((a) => {
      if (a.accid !== accid) return;
      a.accname = name;
      if (type !== undefined) a.acctype = type;
      if (uid !== undefined) a.accuid = uid;
      if (mny !== undefined) a.accmny = Math.round(Number(mny) * 100) / 100;
      // 改成非信用类就把额度和账单日清掉
      if (!isCreditAcct(a.acctype)) {
        a.accday = 0;
        a.acclimit = 0;
        return;
      }
      if (day !== undefined) a.accday = normDay(day) || (a.accday || 0);
      if (limit !== undefined) a.acclimit = Number(limit) || 0;
    });
    save();
  }

  // 隐藏账户：同名目，编号留着
  function hideAccount(accid, hide) {
    DB.accounts.forEach((a) => { if (a.accid === accid) a.acchide = hide ? 1 : 0; });
    save();
  }

  function adjustAccount(accid, delta) {
    const a = DB.accounts.find((x) => x.accid === accid);
    if (!a) return;
    a.accmny = Math.round(((Number(a.accmny) || 0) + delta) * 100) / 100;
    save();
  }

  // 信用类账户里的溢缴款：可用资金超出额度的那部分，没填额度就是 0
  function creditDeposit(a) {
    const lim = Number(a.acclimit) || 0;
    if (lim <= 0) return 0;
    return (Number(a.accmny) || 0) - lim;
  }

  /**
   * 转账：任意两个账户之间划转可用资金，转入信用卡就是还款，负债随之减少
   * 信用类账户默认只能转入；信用卡有溢缴款时可以转出存款那部分
   * @param {number} fromAccid 转出账户编号
   * @param {number} toAccid 转入账户编号
   * @param {number} amount 金额，单位元
   * @returns {object} {from:转出账户名, to:转入账户名, amount:金额}
   */
  function transfer(fromAccid, toAccid, amount) {
    amount = Math.round(Number(amount) * 100) / 100;
    if (!(amount > 0)) throw new Error('金额必须大于 0');
    if (!fromAccid || !toAccid) throw new Error('请选择转出/转入账户');
    if (fromAccid === toAccid) throw new Error('转出与转入不能是同一个账户');
    const from = DB.accounts.find((x) => x.accid === fromAccid);
    const to = DB.accounts.find((x) => x.accid === toAccid);
    if (!from || !to) throw new Error('账户不存在');
    const avail = Number(from.accmny) || 0;
    if (isCreditAcct(from.acctype)) {
      const deposit = creditDeposit(from);
      if (from.acctype !== '信用卡' || deposit <= 0) {
        throw new Error('信用类账户只能作为转入账户（还款），不能转出');
      }
      if (amount > deposit) throw new Error('转出金额不能超过存款金额 ¥' + deposit.toFixed(2));
    } else if (amount > avail) {
      throw new Error('转出金额不能超过可用资金 ¥' + avail.toFixed(2));
    }
    from.accmny = Math.round((avail - amount) * 100) / 100;
    to.accmny = Math.round(((Number(to.accmny) || 0) + amount) * 100) / 100;
    save();
    return { from: from.accname, to: to.accname, amount: amount };
  }

  function addShanghu(name) {
    name = (name || '').trim();
    if (!name) return;
    if (DB.shanghu.indexOf(name) === -1) { DB.shanghu.push(name); save(); }
  }

  // —— 导入合并 ——

  // 按名字对齐：同名沿用现有编号，新名字在现有列表后面追加编号（编号只增不减）
  // same 是额外的匹配条件，给账户用：名字一样但卡号不一样的不算同一个账户
  function alignByName(existing, incoming, idKey, nameKey, build, same) {
    const map = {};
    let added = 0;
    incoming.forEach((it) => {
      const hit = existing.find((x) => x[nameKey] === it[nameKey] && (!same || same(x, it)));
      if (hit) {
        map[it[idKey]] = hit[idKey];
        return;
      }
      const rec = build(it);
      existing.push(rec);
      map[it[idKey]] = rec[idKey];
      added++;
    });
    return { map: map, added: added };
  }

  // 账户重名是允许的，所以还得看卡号：两边都有卡号且不一样，就当成两个账户
  function sameAccount(a, b) {
    const ua = String(a.accuid || '').trim();
    const ub = String(b.accuid || '').trim();
    return !ua || !ub || ua === ub;
  }

  // 商户名目按名字去重后合并，重复的只算一次
  function mergeShanghu(imported) {
    const seen = {};
    DB.shanghu.forEach((s) => { seen[s] = 1; });
    let added = 0;
    imported.shanghu.forEach((s) => {
      if (seen[s]) return;
      seen[s] = 1;
      DB.shanghu.push(s);
      added++;
    });
    return added;
  }

  // 账单指纹：合并导入靠它认出是不是同一笔账
  function billKey(wtime, wtype, wname, wtool, wamount, wpayname) {
    return `${wtime}|${wtype}|${wname}|${wtool}|${wamount}|${wpayname || ''}`;
  }

  // 账单合并：指纹去重后重新编号，账户可用资金跟着联动
  function mergeBills(imported, nameMap, toolMap, acctMap) {
    const existKeys = {};
    DB.walletdiary.forEach((b) => {
      existKeys[billKey(b.wtime, b.wtype, b.wname, b.wtool, b.wamount, b.wpayname)] = 1;
    });
    let added = 0, skipped = 0;
    imported.walletdiary.forEach((b) => {
      const nm = nameMap[b.wname] !== undefined ? nameMap[b.wname] : b.wname;
      const qt = toolMap[b.wtool] !== undefined ? toolMap[b.wtool] : b.wtool;
      const ac = acctMap[b.wacct] !== undefined ? acctMap[b.wacct] : (b.wacct || 0);
      const key = billKey(b.wtime, b.wtype, nm, qt, b.wamount, b.wpayname);
      if (existKeys[key]) { skipped++; return; }
      const bill = {
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
    return { added: added, skipped: skipped };
  }

  /**
   * 合并式导入：和当前数据合并，编号按现有数据往下续
   * @param {string} raw 文件内容（Base64 密文）
   * @param {string} filePwd 文件自己的密码，和当前密码不同时传这个
   * @returns {object} 各类新增/跳过的数量
   */
  function mergeImport(raw, filePwd) {
    const imported = decrypt(raw, filePwd || PASSWORD);
    const def = defaultData();
    ['walletdiary', 'mingmu', 'gongju', 'shanghu', 'accounts', 'settings'].forEach((k) => {
      if (imported[k] === undefined) imported[k] = def[k];
    });
    // 导入的文件可能是老版本存的，字段不全，先补齐再用，不然金额和指纹都对不上
    migrate(imported);
    const names = alignByName(DB.mingmu, imported.mingmu, 'mid', 'mname', (m) => ({
      mid: nextMid(), mname: m.mname, mhide: 0
    }));
    const tools = alignByName(DB.gongju, imported.gongju, 'qid', 'qname', (q) => ({
      qid: nextQid(), qname: q.qname, qtype: q.qtype || '其他', qhide: 0,
      qlast4: q.qlast4 || '', qday: q.qday || 0
    }));
    const accts = alignByName(DB.accounts, imported.accounts, 'accid', 'accname', (a) => ({
      accid: nextAccid(), accname: a.accname, acctype: a.acctype || '余额', accuid: a.accuid || '',
      accmny: Number(a.accmny) || 0, accday: a.accday || 0, acclimit: Number(a.acclimit) || 0
    }), sameAccount);
    const addedSh = mergeShanghu(imported);
    const bills = mergeBills(imported, names.map, tools.map, accts.map);
    save();
    return {
      added: bills.added,
      skipped: bills.skipped,
      addedNames: names.added,
      addedTools: tools.added,
      addedAccounts: accts.added,
      addedSh: addedSh
    };
  }

  // —— 查询 ——

  const get = () => DB;
  const isUnlocked = () => DB !== null;
  const getSettings = () => DB.settings;
  const saveSettings = () => save();
  const exportRaw = () => global.localStorage.getItem(KEY) || '';

  function mingmuName(mid) {
    const m = DB.mingmu.find((x) => x.mid === mid);
    return m ? m.mname : ('名目#' + mid);
  }

  function gongjuName(qid) {
    const q = DB.gongju.find((x) => x.qid === qid);
    return q ? q.qname : ('工具#' + qid);
  }

  // 没选账户时返回空串，查不到才显示 账户#编号
  function accountName(accid) {
    if (!accid) return '';
    const a = DB.accounts.find((x) => x.accid === accid);
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
    isUnlocked: isUnlocked,
    exportRaw: exportRaw,
    importRaw: importRaw,
    mergeImport: mergeImport,
    inspectRaw: inspectRaw,
    verifyRaw: verifyRaw
  };
})(window);
