const { createEcpApplicationMgr } = require('./EcpApplicationMgr');

// 會籍請假暫停申請（本人申辦）寫入 + 證明文件上傳。token 管理／multipart 上傳等共用邏輯都在 EcpApplicationMgr，
// 這裡只負責「請假流程專屬」的部分：savePath／entityUnitId，以及表單欄位怎麼映射成 ECP 欄位（record）。
// savePath／entityUnitId／各欄位代碼皆已由 PM 確認（見下方 saveApplication 欄位對應）。
const mgr = createEcpApplicationMgr({
    savePath: 'CUS.StopMembership.Save.data',
    entityUnitId: '1a037cef-c3a0-0b7e-328a-00505693a3c1'
});

class LeaveApplicationApiMgr {
    // 新增一筆請假暫停申請案。fields 只帶實際蒐集到的欄位（未蒐集的欄位不送，維持資料表預設值）。
    // 回傳 { entityId }：entityId 取自回應 entityIds[0]，供後續證明文件上傳時帶入。
    // 欄位對應（PM 已確認）：
    //   會員編號 -> U_MemberCode、姓名 -> FName、申請日期 -> FCreateTime
    //   聯絡方式：手機 -> U_ContactPhone；Email -> U_ContactEmail（依 contactType 擇一寫入，另一個不送）
    //   暫停原因 -> U_StopReason、暫停月數 -> U_StopMonths（只送數字，如 1，不帶「個月」）、暫停起始日 -> U_StopActDate
    async saveApplication({ memberNo, memberName, applyDate, contactType, contactValue, reason, months, startDate, logger }) {
        const record = {};
        if (memberNo !== undefined) record.U_MemberCode = memberNo;
        if (memberName !== undefined) record.FName = memberName;
        if (applyDate !== undefined) record.FCreateTime = applyDate;
        if (contactValue !== undefined) {
            if (contactType === 'phone') record.U_ContactPhone = contactValue;
            else if (contactType === 'email') record.U_ContactEmail = contactValue;
        }
        if (reason !== undefined) record.U_StopReason = reason;
        if (months !== undefined) record.U_StopMonths = Number(months);
        if (startDate !== undefined) record.U_StopActDate = startDate;
        return mgr.saveApplication(record, logger);
    }

    uploadEntityAttachment(args) {
        return mgr.uploadEntityAttachment(args);
    }
}

module.exports = new LeaveApplicationApiMgr();
