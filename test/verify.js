// 會籍資格升等（ChangeMembershipFlow，含 FF-04-02 學生寒暑假轉館）建置後自我驗證：用 data/ 假資料，逐情境模擬會員操作。
// 跑法：npm run verify。全綠（exit 0）才算完成。
// 注意：
//   1. 本測試強制關閉 ECP 連線（EcpApi.Url 清空），並把「寫入 ECP 申請單」「上傳附件」換成假的，不會動到任何真實 ECP 資料。
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
// 學生證明附件上傳也換成假的，只記錄呼叫（不打 ECP）。
const attachments = [];
applicationApiMgr.uploadEntityAttachment = async ({ logger, fileBuffer, ...args }) => {
    attachments.push({ ...args, size: fileBuffer.length });
    return true;
};

const app = require('../app');
const UpgradeRule = require('../ExternalMethod/UpgradeRule');
const ruleResult = require('./upgradeRule.test');
const studentRuleResult = require('./studentTransferRule.test');

// 學生寒暑假轉館（FF-04-02）：每條情境前在 uploads/student/ 放好假的學生證明，模擬前端已先上傳。
const fs = require('fs');
const path = require('path');
const studentUploadMgr = require('../Api/StudentTransferUploadMgr');
function makeProof(count) {
    return Array.from({ length: count }, (_, i) => {
        const fileId = `verify-${Date.now()}-${crypto.randomInt(100000, 999999)}-${i}.jpg`;
        fs.writeFileSync(path.join(studentUploadMgr.uploadDir, fileId), Buffer.from('fake-image'));
        return { fileId, fileName: `學生證${i + 1}.jpg` };
    });
}
function cleanProof() {
    for (const f of fs.readdirSync(studentUploadMgr.uploadDir)) if (f.startsWith('verify-')) fs.unlinkSync(path.join(studentUploadMgr.uploadDir, f));
}
// 測試用今天 2027-07-10（六）：暑假受理期間，Y 啟用日 7/15～9/30、O 最早 7/15 不限最晚。
const STUDENT_TODAY = '2027-07-10';
const sform = (student, extra) => JSON.stringify({
    action: 'SUBMIT', contactType: 'phone', contactValue: '0912345678',
    upgradeOption: '', newVenue: 'PX001', actDate: '2027-07-15', payType: '', taxId: '', ...extra,
    student: { agreed: true, studentType: 'Y', proof: makeProof(2), ...student }
});
// 學生轉館不另開按鈕：從「會籍廠館轉移」（T）或「廠館轉移加卡別升等」（A）進入，受理期間表單帶 student 區塊。
const openForm = (type) => [
    { input: '開始', expect: { isContinuum: '1', excludes: ['學生寒暑假轉館'] } },
    { input: type, expect: { isContinuum: '1', includes: ['本人申辦'] } },
    { input: '本人申辦', expect: { isContinuum: '1', includes: ['ChangeMembershipForm', '"student"'] } }
];
const studentOpen = openForm('會籍廠館轉移');
const studentOpenA = openForm('廠館轉移加卡別升等');

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
        { input: '會籍資格升等／會籍廠館轉移', expect: { isContinuum: '1', includes: ['請選擇要申辦的項目', 'submit="會籍資格升等"'] } },
        { input: '會籍資格升等', expect: { isContinuum: '1', includes: ['本人申辦', '代理他人申辦'] } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['ChangeMembershipForm', 'CFM20250610150231093', '4:region', '單館銀卡（屏東潮州）', minDate] } },
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
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['4:single', '1:region', '6:national'], excludes: ['1:single', '1:dual'] } }
    ] },
    { name: '按鈕文字也能選（點「會籍資格升等」文字）', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1', includes: ['本人申辦'] } }
    ] },
    { name: '申辦項目三選一都出現', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1', includes: ['submit="會籍資格升等"', 'submit="會籍廠館轉移"', 'submit="廠館轉移加卡別升等"'] } },
        { input: '亂打', expect: { isContinuum: '1', includes: ['請點選要申辦的項目'] } }
    ] },
    // ---- 會籍廠館轉移（T）----
    { name: '轉館 happy path（屏東潮州 → 台北信義）', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1', includes: ['本人申辦'] } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['ChangeMembershipForm', '"changeType":"T"', 'PX001'], excludes: ['"code":"PW046"'] } },
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
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '', newVenue: 'PW046' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '轉館沒選館 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '全國白金卡也能轉館（換主要使用廠館）', member: 'TEST0003', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['ChangeMembershipForm'] } }
    ] },
    // ---- 次要使用區域（雙區身分適用，選填；需求書 p.88 兩區不可相同）----
    { name: '轉館＋次要使用區域（北區台北信義＋南區高雄博愛）→ 寫第二館', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '', newVenue: 'PX001', secondVenue: 'PW001' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.transfer && r.transfer.storeCode === 'PX001' && r.transfer2 && r.transfer2.storeCode === 'PW001'
            && r.transfer2.city === '高雄市' && r.transfer2.region === '2' && r.remark.includes('次要使用廠館：高雄博愛');
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '轉館不填次要使用區域 → 不寫第二館', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '', newVenue: 'PX001', secondVenue: '' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        return !r.transfer2 && !r.remark.includes('次要使用廠館') ? '' : `不該寫第二館：${JSON.stringify(r)}`;
    } },
    { name: '次要與主要同區（台北信義＋台北健康）→ 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '', newVenue: 'PX001', secondVenue: 'PW048' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '次要選原廠館（竄改）→ 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '', newVenue: 'PX001', secondVenue: 'PW046' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '主要澎湖馬公（其他）＋次要台北信義 → 通過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '', newVenue: 'PW086', secondVenue: 'PX001' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        return r.transfer.storeCode === 'PW086' && r.transfer2.storeCode === 'PX001' ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '轉館加升等＋次要使用區域（區域金卡北區＋南區）→ 寫第二館', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '廠館轉移加卡別升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '4:region:6', newVenue: 'PX001', secondVenue: 'PW001' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        return r.changeType === 'A' && r.transfer2 && r.transfer2.storeCode === 'PW001' ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    // ---- 廠館轉移加卡別升等（A）----
    { name: '轉館加升等 happy path（單館銀卡 → 區域金卡北區＋台北信義）', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '廠館轉移加卡別升等', expect: { isContinuum: '1', includes: ['本人申辦'] } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['"changeType":"A"', '4:region:6', '4:region:2', '4:single'], excludes: ['"code":"PW046"', '1:single', '6:national'] } },
        { input: form({ upgradeOption: '4:region:6', newVenue: 'PX001' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'A' && r.upCardType === '4' && r.transfer && r.transfer.storeCode === 'PX001'
            && r.detail && r.detail.upMembership === '6' && r.remark.includes('區域金卡（北區）') && r.remark.includes('台北信義');
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '轉館加升等：選北區卻選南區的館 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '廠館轉移加卡別升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '4:region:6', newVenue: 'PW001' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '轉館加升等：澎湖馬公各區都可選', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '廠館轉移加卡別升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '4:region:6', newVenue: 'PW086' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ] },
    { name: '轉館加升等：選原廠館 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '廠館轉移加卡別升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '4:single', newVenue: 'PW046' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '轉館加升等：全國白金 → 無可升選項並提示改選轉館', member: 'TEST0003', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '廠館轉移加卡別升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '0', includes: ['會籍廠館轉移'] } }
    ] },
    { name: '轉館加升等：區域金卡 → 無可選項並提示改走升等／轉館（A 不含全國白金）', member: 'TEST0002', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '廠館轉移加卡別升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '0', includes: ['會籍資格升等', '會籍廠館轉移'], excludes: ['最高等級'] } }
    ] },
    { name: '轉館加升等：送全國白金 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '廠館轉移加卡別升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '6:national', newVenue: 'PX001' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '取消申請', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: JSON.stringify({ action: 'CANCEL' }), expect: { isContinuum: '0', includes: ['已為您取消'] } }
    ] },
    { name: '選了不能升的卡（竄改成降級選項）→ 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ upgradeOption: '1:single' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '啟用日太早 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ actDate: tooEarly }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '手機格式錯 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ contactValue: '0812345678' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: '統編不是 8 碼 → 核實不過', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ taxId: '1234' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ] },
    { name: 'Email 聯絡＋有統編 → 成功', member: 'TEST0007', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['區域鈦銀卡（北區）'] } },
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
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '0', includes: ['最高等級'] } }
    ] },
    { name: '行政終止 → 合約欠款提示', member: 'TEST0004', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '0', includes: ['合約欠款'] } }
    ] },
    { name: '無合約 → 無符合合約狀態', member: 'TEST0005', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '0', includes: ['無符合合約狀態'] } }
    ] },
    { name: '只有到期合約 → 無符合合約狀態', member: 'TEST0008', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '0', includes: ['無符合合約狀態'] } }
    ] },
    { name: '沒帶會員識別＋未設 Qbi 預設會員 → 無符合合約狀態（不誤帶別人資料）', member: '', qbiDefault: '', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '0', includes: ['無符合合約狀態'] } }
    ] },
    { name: '沒帶會員識別＋Qbi 預設會員 TEST0001 → 可開表單（測試 WebChat 未登入用）', member: '', qbiDefault: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1', includes: ['submit="會籍資格升等"', 'submit="會籍廠館轉移"'], excludes: ['background-color:#2563eb', 'submit="UPGRADE"'] } },
        { input: '會籍資格升等', expect: { isContinuum: '1', includes: ['submit="本人申辦"'] } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['ChangeMembershipForm'] } }
    ] },
    { name: '升等：澎湖馬公單館鈦銀卡自選區域（北區金卡）', member: 'TEST0006', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['ChangeMembershipForm', '4:region:2', '4:region:6', '13:region:4', '單館鈦銀卡（澎湖馬公）'] } },
        { input: form({ upgradeOption: '4:region:6' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'U' && r.upCardType === '4' && r.remark.includes('區域金卡（北區）')
            && r.detail && r.detail.upMembership === '6' && r.detail.oldAvailableVenue === '澎湖馬公';
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '代理他人申辦 → 交給代理人表單', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '代理他人申辦', expect: { isContinuum: '1', includes: ['AgentForm'] } }
    ] },
    { name: 'ECP 建單失敗 → 告知送出失敗', member: 'TEST0001', failSave: true, turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: form({ payType: 'T' }), expect: { isContinuum: '0', includes: ['申請送出失敗'] } }
    ] },
    { name: '走完後同 chatId 重新開始', member: 'TEST0001', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: JSON.stringify({ action: 'CANCEL' }), expect: { isContinuum: '0' } },
        { input: '再一次', expect: { isContinuum: '1', includes: ['請選擇要申辦的項目'] } }
    ] },
    // ---- 學生寒暑假轉館（FF-04-02）----
    { name: '學生：不在受理期間（10/6）→ 轉館表單不帶學生區塊，一般轉館照常送件', member: 'TEST0001', today: '2026-10-06', turns: [
        { input: '開始', expect: { isContinuum: '1', excludes: ['學生寒暑假轉館'] } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['"changeType":"T"'], excludes: ['"student"'] } },
        { input: form({ upgradeOption: '', newVenue: 'PX001', actDate: UpgradeRule.minActivationDate('2026-10-06') }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => { const r = saved[saved.length - 1]; return !r.student ? '' : '非學生件不應寫 U_StudentOnly'; } },
    { name: '學生：不在受理期間硬送學生資料 → 核實不過', member: 'TEST0001', today: '2026-10-06', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1' } },
        { input: sform({}, { actDate: '2026-10-12' }), expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ], check: (sc) => (saved.length !== sc.savedBefore ? '不應寫 ECP' : '') },
    { name: '學生：受理期間 12/10 → 轉館表單帶學生區塊，Y 啟用日從 1/1 起', member: 'TEST0001', today: '2026-12-10', turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍廠館轉移', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['"student"', '"periodName":"2027 寒假"', '"minActDate":"2027-01-01"', '"maxActDate":"2027-02-28"'] } }
    ] },
    { name: '學生：會籍資格升等不帶學生區塊', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        { input: '開始', expect: { isContinuum: '1' } },
        { input: '會籍資格升等', expect: { isContinuum: '1' } },
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['"changeType":"U"'], excludes: ['"student"'] } }
    ] },
    { name: '學生：轉館表單帶須知、Y／O 啟用日範圍、上傳限制', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        studentOpen[0], studentOpen[1],
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['"changeType":"T"', '"applyDate":"2027-07-10"', '本項限受理時間為每年 12/01~2/29、06/01~09/30 止', '"value":"Y"', '"minActDate":"2027-07-15"', '"maxActDate":"2027-09-30"', '"value":"O"', '"maxActDate":""', 'PX001', '"maxFileCount":5'], excludes: ['"code":"PW046"', 'transferTypes'] } }
    ] },
    { name: '學生：轉館加升等表單也有轉出／轉回（SA 2026-10-06）', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        studentOpenA[0], studentOpenA[1],
        { input: '本人申辦', expect: { isContinuum: '1', includes: ['"changeType":"A"', '"value":"Y"', '"value":"O"', '4:region:6'] } }
    ] },
    { name: '學生：廠館轉移加卡別升等＋轉回原廠館（A／O）→ U_StudentOnly=O、升等卡別正確', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        ...studentOpenA,
        { input: sform({ studentType: 'O' }, { upgradeOption: '4:region:6', payType: 'C', actDate: '2027-12-01' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'A' && r.upCardType === '4' && r.student.studentOnly === 'O' && r.remark.startsWith('學生寒暑假轉館（轉回原廠館）') && attachments.length === 2;
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '學生：會籍廠館轉移＋轉出新廠館（T／Y）→ 寫 U_StudentOnly=Y、附件 2 檔、繳費方式免填', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        ...studentOpen,
        { input: sform(), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'T' && !r.upCardType && r.payType === '' && r.actDate === '2027-07-15'
            && r.student && r.student.studentOnly === 'Y' && r.student.validStudentIdDoc === true
            && r.transfer && r.transfer.storeCode === 'PX001' && r.remark.startsWith('學生寒暑假轉館（轉出新廠館）')
            && attachments.length === 2 && attachments.every(a => a.entityId === `fake-${saved.length}` && a.contentType === 'image/jpeg')
            && attachments[0].fileName === '學生證1.jpg';
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}／附件 ${JSON.stringify(attachments)}`;
    } },
    { name: '學生：廠館轉移加卡別升等＋轉出新廠館（A／Y）→ 升等卡別正確、繳費方式必填', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        ...studentOpenA,
        { input: sform({}, { upgradeOption: '4:region:6', payType: 'T', actDate: '2027-09-30' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'A' && r.upCardType === '4' && r.payType === 'T' && r.actDate === '2027-09-30'
            && r.student.studentOnly === 'Y' && r.detail.upMembership === '6' && r.remark.includes('區域金卡（北區）') && attachments.length === 2;
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '學生：會籍廠館轉移＋轉回原廠館（T／O）→ U_StudentOnly=O、啟用日可超過暑假期末', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        ...studentOpen,
        { input: sform({ studentType: 'O' }, { actDate: '2027-12-01', payType: 'C' }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => {
        const r = saved[saved.length - 1];
        const ok = r.changeType === 'T' && r.payType === 'C' && r.student.studentOnly === 'O' && r.remark.startsWith('學生寒暑假轉館（轉回原廠館）');
        return ok ? '' : `寫入 ECP 內容不符：${JSON.stringify(r)}`;
    } },
    { name: '學生：受理期間內不勾學生 → 一般轉館（繳費方式仍必填、不寫學生欄位）', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        ...studentOpen,
        { input: form({ upgradeOption: '', newVenue: 'PX001', actDate: '2027-07-15', student: { studentType: '' } }), expect: { isContinuum: '0', includes: ['線上申請需約三個工作日'] } }
    ], check: () => { const r = saved[saved.length - 1]; return !r.student && r.payType === 'C' && attachments.length === 0 ? '' : `不應是學生件：${JSON.stringify(r)}`; } },
    ...[
        ['轉館', '未勾須知', sform({ agreed: false })],
        ['轉館', '沒附學生證明', sform({ proof: [] })],
        ['轉館', '學生證明超過 5 檔', sform({ proof: makeProof(6) })],
        ['轉館', '學生證明 fileId 不存在', sform({ proof: [{ fileId: 'not-exist.jpg', fileName: 'x.jpg' }] })],
        ['轉館', '學生證明 fileId 路徑穿越', sform({ proof: [{ fileId: '../../package.json', fileName: 'x.jpg' }] })],
        ['轉館', 'Y 啟用日早於最早日（7/14）', sform({}, { actDate: '2027-07-14' })],
        ['轉館', 'Y 啟用日超過暑假期末（10/1）', sform({}, { actDate: '2027-10-01' })],
        ['轉館', 'O 啟用日早於最早日（7/14）', sform({ studentType: 'O' }, { actDate: '2027-07-14' })],
        ['轉館加升等', '沒填繳費方式', sform({}, { upgradeOption: '4:region:6' }), studentOpenA],
        ['轉館加升等', '選了不可升的卡', sform({}, { upgradeOption: '6:national', payType: 'C' }), studentOpenA],
        ['轉館', '選原廠館', sform({}, { newVenue: 'PW046' })],
        ['轉館', '轉出／轉回亂填', sform({ studentType: 'X' })]
    ].map(([kind, label, input, open]) => ({ name: `學生（${kind}）：${label} → 核實不過、不寫 ECP、不上傳附件`, member: 'TEST0001', today: STUDENT_TODAY, turns: [
        ...(open || studentOpen),
        { input, expect: { isContinuum: '0', includes: ['表單資料不完整或有誤'] } }
    ], check: (sc) => (saved.length !== sc.savedBefore ? '不應寫 ECP' : attachments.length ? `不應上傳附件，實際 ${attachments.length}` : '') })),
    { name: '學生：建單失敗 → 告知送出失敗、不上傳附件', member: 'TEST0001', today: STUDENT_TODAY, failSave: true, turns: [
        ...studentOpen,
        { input: sform(), expect: { isContinuum: '0', includes: ['申請送出失敗'] } }
    ], check: () => (attachments.length ? `不應上傳附件，實際 ${attachments.length}` : '') },
    { name: '學生：取消 → 不寫 ECP', member: 'TEST0001', today: STUDENT_TODAY, turns: [
        ...studentOpen,
        { input: JSON.stringify({ action: 'CANCEL' }), expect: { isContinuum: '0', includes: ['已為您取消'] } }
    ], check: (sc) => (saved.length !== sc.savedBefore ? '不應寫 ECP' : '') }
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
        const cm = ExternalConfig.ChangeMembership;
        const prevDefault = cm.QbiDefaultMemberKey;
        if ('qbiDefault' in sc) cm.QbiDefaultMemberKey = sc.qbiDefault;
        cm.Student.QbiTestToday = sc.today || '';
        attachments.length = 0;
        sc.savedBefore = saved.length;
        let detail = '';
        for (let i = 0; i < sc.turns.length && !detail; i++) {
            const t = sc.turns[i];
            if (t.wait) await new Promise(r => setTimeout(r, t.wait));   // 同 chatId 500ms 內同輸入會被去重
            const resp = await post(port, { ask_chatId: chatId, ask_input: t.input, ask_platform: 'web', customerData: { memberKey: sc.member } });
            const fails = check(resp, t.expect);
            if (fails.length) detail = `第${i + 1}輪：` + fails.join('；');
        }
        cm.QbiDefaultMemberKey = prevDefault;
        cm.Student.QbiTestToday = '';
        if (!detail && sc.check) detail = sc.check(sc);
        if (!detail) { pass++; console.log(`  [PASS] ${sc.name}`); }
        else { fail++; console.log(`  [FAIL] ${sc.name} — ${detail}`); }
    }
    console.log(`\n流程結果：${pass} 過 / ${fail} 失敗`);
    console.log(`總計：升等規則 ${ruleResult.pass}/${ruleResult.pass + ruleResult.fail}、學生轉館規則 ${studentRuleResult.pass}/${studentRuleResult.pass + studentRuleResult.fail}、流程 ${pass}/${pass + fail}\n`);
    cleanProof();
    server.close();
    process.exit(fail || ruleResult.fail || studentRuleResult.fail ? 1 : 0);
})();
