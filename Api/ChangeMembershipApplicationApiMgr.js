const { createEcpApplicationMgr } = require('./EcpApplicationMgr');

// 會籍升等/轉館/轉館加升等申請（本人申辦）寫入 ECP。共用建單邏輯在 EcpApplicationMgr，
// 這裡只負責 savePath／entityUnitId 與表單欄位 → ECP 欄位（CUS.ChangeMembership）的對應。
// entityUnitId 取自 ECP 匯出的單元 SQL（TsUnit.FId）；本流程無附件，目前用不到但工廠要求必填。
const mgr = createEcpApplicationMgr({
    savePath: 'CUS.ChangeMembership.Save.data',
    entityUnitId: '1a01d37b-f860-0d7c-691c-00505693a3c1'
});

class ChangeMembershipApplicationApiMgr {
    // 欄位對應：
    //   會員姓名 -> FName、會員編號 -> U_MemberCode、合約編號 -> U_ContractNum
    //   申請時間 -> FCreateTime（比照請假流程）＋ U_ChangeDate（本單元未停用此欄，一併寫入）
    //   聯絡方式：手機 -> U_ContactPhone；Email -> U_ContactEmail（依 contactType 擇一）
    //   異動類型 -> U_ChangeType（U 升等／T 轉館／A 轉館加升等）、升等卡別 -> U_UpCardType（card_name 代碼）
    //   啟用日 -> U_NewActDate、繳費方式 -> U_PayType（C／T）、統編 -> U_CompanyUnified（有填才送）
    //   表單狀態 -> U_Status：W（待處理，照需求書；ECP 字典改正前須先通知同事）
    //   升等後資格 -> U_Remark（ECP 尚無對應欄位，待 SA 確認 Q11 前的暫時做法）
    async saveApplication({ memberCode, memberName, contractNo, applyTime, contactType, contactValue, changeType, upCardType, actDate, payType, taxId, remark, logger }) {
        const record = {
            U_MemberCode: memberCode,
            FName: memberName,
            U_ContractNum: contractNo,
            FCreateTime: applyTime,
            U_ChangeDate: applyTime,
            U_ChangeType: changeType,
            U_UpCardType: upCardType,
            U_NewActDate: actDate,
            U_PayType: payType,
            U_Status: 'W'
        };
        if (contactType === 'phone') record.U_ContactPhone = contactValue;
        else if (contactType === 'email') record.U_ContactEmail = contactValue;
        if (taxId) record.U_CompanyUnified = taxId;
        if (remark) record.U_Remark = remark;
        return mgr.saveApplication(record, logger);
    }
}

module.exports = new ChangeMembershipApplicationApiMgr();
