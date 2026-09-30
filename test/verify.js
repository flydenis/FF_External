// 會籍資格升等（ChangeMembershipFlow）建置後自我驗證：用 data/ 假資料，逐情境模擬會員操作。
// 跑法：npm run verify。全綠（exit 0）才算完成。
// 注意：
//   1. 本測試強制關閉 ECP 連線（EcpApi.Url 清空），並把「寫入 ECP 申請單」換成假的，不會動到任何真實 ECP 資料。
//   2. 這裡才可 app.listen（測試用臨時埠）；app.js 本身不得 listen。
//   3. 同 chatId 500ms 內送相同 ask_input 會被 runFlow 去重，重試情境要用不同輸入值。
const http = require('http');
const crypto = require('crypto');

const ExternalConfig = require('../ExternalConfig');
ExternalConfig.Mode = 'Qbi';
ExternalConfig.EcpApi = { ...ExternalConfig.EcpApi, Url: '' };

const applicationApiMgr = require('../Api/ChangeMembershipApplicationApiMgr');
const saved = [];
let saveShouldFail = false;
applicationApiMgr.saveApplication = async (args) => {
    const { logger, ...record } = args;
    saved.push(record);
    return { entityId: saveShouldFail ? undefined : `fake-${saved.length}` };
};

const app = require('../app');
const UpgradeRule = require('../ExternalMethod/UpgradeRule');
const ruleResult = require('./upgradeRule.test');

const today = UpgradeRule.toISODate(new Date());
const minDate = UpgradeRule.minActivationDate(today);
const tooEarly = UpgradeRule.toISODate(new Date(Date.now() + 86400000));

const form = (extra) => JSON.stringify({
    action: 'SUBMIT', contactType: 'phone', contactValue: '0912345678',
    upgradeOption: '4:region', actDate: minDate, payType: 'C', taxId: '', ...extra
});

// 每條情境：member＝customerData.memberKey；turns 逐輪送 ask_input。
// expect：isContinuum、includes（message 須含的字）、excludes（不可含的字）、saved（到此為止累計寫入 ECP 的筆數）
const SCENARIOS = [
    { name: '本人升等 happy path（單館銀卡 → 區域金卡）', member: 'TEST0001', turns: [
        { input: '會籍資格升等', expect: { isContinuum: '1', includes: ['請選擇要申辦的項目', 'UPGRADE'] } },
        { input: 'UPGRADE', expect: { isContinuum: '1', includes: ['本人申辦', '代理他人申辦'] } },
        { input: 'SELF', expect: { isContinuum: '1', includes: ['ChangeMembershipForm', 'CFM20250610150231093', '4:region', '單館銀卡（屏東潮州）', minDate] } },
        { input: form(), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'], saved: 1 } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'U' && r.upCardType === '4' && r.contractNo === 'CFM20250610150231093'
            && r.memberCode === 'M0000001' && r.payType === 'C' && r.actDate === minDate && r.remark.includes('區域金卡（南區）')
            && r.detail && r.detail.upMembership === '2' && r.detail.oldCardType === '1' && r.detail.oldMembership === '1'
            && r.detail.oldAvailableVenue === '屏東潮州';
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '預帶資料只帶可升選項（不含降級）', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1', includes: ['4:single', '1:region', '6:national'], excludes: ['1:single', '1:dual'] } }
    ] },
    { name: '按鈕文字也能選（點「會籍資格升等」文字）', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1', includes: ['本人申辦'] } }
    ] },
    { name: '申辦項目三選一都出現', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1', includes: ['UPGRADE', 'TRANSFER', 'TRANSFER_UPGRADE'] } },
        { input: '亂打', expect: { isContinuum: '1', includes: ['請點選要申辦的項目'] } }
    ] },
    // ---- 會籍廠館轉移（T）----
    { name: '轉館 happy path（屏東潮州 → 台北信義）', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER', expect: { isContinuum: '1', includes: ['本人申辦'] } },
        { input: 'SELF', expect: { isContinuum: '1', includes: ['ChangeMembershipForm', '"changeType":"T"', 'PX001'], excludes: ['"code":"PW046"'] } },
        { input: form({ upgradeOption: '', newVenue: 'PX001' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'T' && !r.upCardType && r.transfer && r.transfer.storeCode === 'PX001'
            && r.transfer.city === '台北市' && r.transfer.region === '6' && r.remark.includes('新主要使用廠館：台北信義')
            && r.detail && !r.detail.upMembership && r.detail.oldAvailableVenue === '屏東潮州';
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '轉館選原廠館（竄改）→ 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '', newVenue: 'PW046' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '轉館沒選館 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '全國白金卡也能轉館（換主要使用廠館）', member: 'TEST0003', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1', includes: ['ChangeMembershipForm'] } }
    ] },
    // ---- 廠館轉移加卡別升等（A）----
    { name: '轉館加升等 happy path（單館銀卡 → 區域金卡北區＋台北信義）', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER_UPGRADE', expect: { isContinuum: '1', includes: ['本人申辦'] } },
        { input: 'SELF', expect: { isContinuum: '1', includes: ['"changeType":"A"', '4:region:6', '4:region:2', '4:single'], excludes: ['"code":"PW046"', '1:single', '6:national'] } },
        { input: form({ upgradeOption: '4:region:6', newVenue: 'PX001' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'A' && r.upCardType === '4' && r.transfer && r.transfer.storeCode === 'PX001'
            && r.detail && r.detail.upMembership === '6' && r.remark.includes('區域金卡（北區）') && r.remark.includes('台北信義');
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '轉館加升等：選北區卻選南區的館 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER_UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '4:region:6', newVenue: 'PW001' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '轉館加升等：澎湖馬公各區都可選', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER_UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '4:region:6', newVenue: 'PW086' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ] },
    { name: '轉館加升等：選原廠館 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER_UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '4:single', newVenue: 'PW046' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '轉館加升等：全國白金 → 無可升選項並提示改選轉館', member: 'TEST0003', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER_UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '0', includes: ['會籍廠館轉移'] } }
    ] },
    { name: '轉館加升等：區域金卡 → 無可選項並提示改走升等／轉館（A 不含全國白金）', member: 'TEST0002', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER_UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '0', includes: ['會籍資格升等', '會籍廠館轉移'], excludes: ['最高等級'] } }
    ] },
    { name: '轉館加升等：送全國白金 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'TRANSFER_UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '6:national', newVenue: 'PX001' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '取消申請', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: JSON.stringify({ action: 'CANCEL' }), expect: { isContinuum: '0', includes: ['已為您取消'] } }
    ] },
    { name: '選了不能升的卡（竄改成降級選項）→ 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '1:single' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '啟用日太早 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ actDate: tooEarly }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '手機格式錯 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ contactValue: '0812345678' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '統編不是 8 碼 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ taxId: '1234' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: 'Email 聯絡＋有統編 → 成功', member: 'TEST0007', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1', includes: ['區域鈦銀卡（北區）'] } },
        { input: form({ contactType: 'email', contactValue: 'a@b.com', taxId: '12345678', payType: 'T' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const d = r.detail || {};
        return r.contactType === 'email' && r.taxId === '12345678' && r.payType === 'T'
            && d.oldCardType === '13' && d.oldMembership === '6' && d.oldAvailableVenue === '北區廠館通用'
            && ['6', '7'].includes(d.upMembership) ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '全國白金卡 → 無可升選項，流程結束', member: 'TEST0003', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '0', includes: ['最高等級'] } }
    ] },
    { name: '行政終止 → 合約欠款提示', member: 'TEST0004', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '0', includes: ['合約欠款'] } }
    ] },
    { name: '無合約 → 無符合合約狀態', member: 'TEST0005', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '0', includes: ['無符合合約狀態'] } }
    ] },
    { name: '只有到期合約 → 無符合合約狀態', member: 'TEST0008', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '0', includes: ['無符合合約狀態'] } }
    ] },
    { name: '沒帶會員識別 → 無符合合約狀態（不誤帶別人資料）', member: '', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '0', includes: ['無符合合約狀態'] } }
    ] },
    { name: '代理他人申辦 → 交給代理人表單', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'AGENT', expect: { isContinuum: '1', includes: ['AgentForm'] } }
    ] },
    { name: 'ECP 建單失敗 → 告知送出失敗', member: 'TEST0001', failSave: true, turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: form({ payType: 'T' }), expect: { isContinuum: '0', includes: ['申請送出失敗'] } }
    ] },
    { name: '走完後同 chatId 重新開始', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: 'UPGRADE', expect: { isContinuum: '1' } },
        { input: 'SELF', expect: { isContinuum: '1' } },
        { input: JSON.stringify({ action: 'CANCEL' }), expect: { isContinuum: '0' } },
        { input: '再一次', expect: { isContinuum: '1', includes: ['請選擇要申辦的項目'] } }
    ] }
];

function post(port, body) {
    return new Promise((resolve, reject) => {
        const data = Buffer.from(JSON.stringify(body), 'utf8');
        const req = http.request(
            { host: '127.0.0.1', port, path: '/ChangeMembershipFlow', method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
            res => { let buf = ''; res.setEncoding('utf8'); res.on('data', c => buf += c);
                res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve({ raw: buf }); } }); }
        );
        req.on('error', reject); req.write(data); req.end();
    });
}

function check(resp, expect) {
    const msg = typeof resp.message === 'string' ? resp.message : JSON.stringify(resp.message || '');
    const fails = [];
    if (expect.isContinuum !== undefined && String(resp.isContinuum) !== String(expect.isContinuum))
        fails.push(`isContinuum 期望 ${expect.isContinuum} 得到 ${resp.isContinuum}`);
    for (const s of (expect.includes || [])) if (!msg.includes(s)) fails.push(`回覆應含「${s}」`);
    for (const s of (expect.excludes || [])) if (msg.includes(s)) fails.push(`回覆不應含「${s}」`);
    if (expect.saved !== undefined && saved.length !== expect.saved) fails.push(`ECP 寫入筆數期望 ${expect.saved} 得到 ${saved.length}`);
    return fails;
}

(async () => {
    const server = app.listen(0);
    await new Promise(r => server.once('listening', r));
    const port = server.address().port;
    let pass = 0, fail = 0;
    console.log(`=== 會籍資格升等流程（ChangeMembershipFlow）@ port ${port} ===`);
    for (const sc of SCENARIOS) {
        const chatId = `verify-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
        saveShouldFail = !!sc.failSave;
        let detail = '';
        for (let i = 0; i < sc.turns.length && !detail; i++) {
            const t = sc.turns[i];
            const resp = await post(port, { ask_chatId: chatId, ask_input: t.input, ask_platform: 'web', customerData: { memberKey: sc.member } });
            const fails = check(resp, t.expect);
            if (fails.length) detail = `第${i + 1}輪：` + fails.join('；');
        }
        if (!detail && sc.check) detail = sc.check();
        if (!detail) { pass++; console.log(`  [PASS] ${sc.name}`); }
        else { fail++; console.log(`  [FAIL] ${sc.name} — ${detail}`); }
    }
    console.log(`\n流程結果：${pass} 過 / ${fail} 失敗`);
    console.log(`總計：規則 ${ruleResult.pass}/${ruleResult.pass + ruleResult.fail}、流程 ${pass}/${pass + fail}\n`);
    server.close();
    process.exit(fail || ruleResult.fail ? 1 : 0);
})();
