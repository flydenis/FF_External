const { createEcpApplicationMgr } = require('./EcpApplicationMgr');

// 提前開啟請假會籍申請（FF-04-05，本人申辦）寫入。
// savePath 依規格書資料表 TpCUSmStartMembership，比照本專案既有命名慣例推得
// （TpCUSmStopMembership -> CUS.StopMembership.Save.data、TpCUSmTerminateMembership -> CUS.TerminateMembership.Save.data、
//   TpCUSmTerminateCoach -> CUS.TerminateCoach.Save.data、TpCUSmAgentApplication -> CUS.AgentApplication.Save.data 皆為此規則，
//   已由 PM 逐一確認為真實值），故此處直接沿用；如與正式環境不符再請 PM 更正。
// 本流程無附件上傳，entityUnitId 用不到（僅 uploadEntityAttachment 才需要），故留 null。
const mgr = createEcpApplicationMgr({
    savePath: 'CUS.StartMembership.Save.data',
    entityUnitId: null
});

class PauseEarlyOpenApiMgr {
    // 新增一筆提前開啟請假會籍申請案。fields 只帶實際蒐集到的欄位（未蒐集的欄位不送，維持資料表預設值）。
    // 回傳 { entityId }：entityId 取自回應 entityIds[0]。
    // 欄位對應（依規格書 TpCUSmStartMembership）：
    //   合約編號 -> U_ContractNum、會員編號 -> U_MemberCode、姓名 -> FName、申請日期 -> U_ChangeDate
    //   聯絡方式：手機 -> U_ContactPhone；Email -> U_ContactEmail（依 contactType 擇一寫入，另一個不送）
    //   已生效請假起訖日 -> U_StopDuring，格式「年-月-日/年-月-日」
    //   開啟使用日期 -> U_StartActDate、繳費方式 -> U_PayType（信用卡 C、轉帳 T，由前端表單直接送代碼）
    async saveApplication({ contractNo, memberNo, memberName, applyDate, contactType, contactValue, leaveStartDate, leaveEndDate, openDate, payType, logger }) {
        const record = {};
        if (contractNo !== undefined) record.U_ContractNum = contractNo;
        if (memberNo !== undefined) record.U_MemberCode = memberNo;
        if (memberName !== undefined) record.FName = memberName;
        if (applyDate !== undefined) record.U_ChangeDate = applyDate;
        if (contactValue !== undefined) {
            if (contactType === 'phone') record.U_ContactPhone = contactValue;
            else if (contactType === 'email') record.U_ContactEmail = contactValue;
        }
        if (leaveStartDate !== undefined && leaveEndDate !== undefined) record.U_StopDuring = `${leaveStartDate}/${leaveEndDate}`;
        if (openDate !== undefined) record.U_StartActDate = openDate;
        if (payType !== undefined) record.U_PayType = payType;
        return mgr.saveApplication(record, logger);
    }
}

module.exports = new PauseEarlyOpenApiMgr();
