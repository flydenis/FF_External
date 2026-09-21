const { createEcpApplicationMgr } = require('./EcpApplicationMgr');

// 會籍解約申請（本人申辦）寫入。單元編碼／unitId／欄位對應皆由 PM 提供並確認。
const mgr = createEcpApplicationMgr({
    savePath: 'CUS.TerminateMembership.Save.data',
    entityUnitId: '1a03819b-d2a0-0e5a-5651-00505693a3c1'
});

const MAX_CONTRACTS = 2;
// 終止原因勾選這兩項時，前端會多開一個輸入框讓 user 填品牌／說明文字；送進 U_TerminationReason 時
// 要把選項本身的文字換成 user 實際填的內容（跟 CoachContractTerminationApiMgr 同一套邏輯）。
// 此清單須與前端 MembershipTerminationForm.js 的 OTHER_REASON_TRIGGERS 逐字一致。
const OTHER_REASON_TRIGGERS = ['轉移他牌', '其他'];

class MembershipTerminationApiMgr {
    // 新增一筆會籍解約申請案。fields 只帶實際蒐集到的欄位（未蒐集的欄位不送，維持資料表預設值）。
    // 回傳 { entityId }：entityId 取自回應 entityIds[0]。
    // 欄位對應（PM 已確認）：
    //   受理通知聯絡方式：手機 -> U_ContactPhone；Email -> U_ContactEmail（依 contactType 擇一寫入，另一個不送）
    //   解約合約（目前前端為單選，最多支援 2 筆）-> U_ContractNum1 ~ U_ContractNum2，依序填入
    //   最後使用日 -> U_LastDate
    //   終止原因（可複選）-> U_TerminationReason，多個原因文字以半形逗號「,」串接成單一字串；
    //   其中「轉移他牌」「其他」改送 otherReason（user 填的品牌／說明文字），不是選項標籤本身
    async saveApplication({ contactType, contactValue, contractNo, lastUseDate, reason, otherReason, logger }) {
        const record = {};
        if (contactValue !== undefined) {
            if (contactType === 'phone') record.U_ContactPhone = contactValue;
            else if (contactType === 'email') record.U_ContactEmail = contactValue;
        }
        const nos = Array.isArray(contractNo) ? contractNo : (contractNo ? [contractNo] : []);
        nos.slice(0, MAX_CONTRACTS).forEach((no, i) => {
            record[`U_ContractNum${i + 1}`] = no;
        });
        if (lastUseDate !== undefined) record.U_LastDate = lastUseDate;
        if (Array.isArray(reason) && reason.length) {
            const mapped = reason.map(r => (OTHER_REASON_TRIGGERS.includes(r) && otherReason) ? otherReason : r);
            record.U_TerminationReason = mapped.join(',');
        }
        return mgr.saveApplication(record, logger);
    }
}

module.exports = new MembershipTerminationApiMgr();
