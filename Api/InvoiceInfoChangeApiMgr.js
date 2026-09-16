const { createEcpApplicationMgr } = require('./EcpApplicationMgr');

// U_InvoiceInfo 只能寫入這三個固定字面值其中之一（PM 已確認），用來標記本次變更的是哪一種發票資訊類型。
const TYPE_LABEL = {
    unified: '公司統編',
    memberDevice: '會員載具',
    mobileBarcode: '手機載具'
};

// 發票資訊變更申請（CUS.ChangeBasicInfo）寫入。建單等共用邏輯都在 EcpApplicationMgr，這裡只負責「發票資訊變更
// 專屬」的部分：savePath（與 PersonalDataChangeApiMgr 共用同一個 ECP 單元，PM 已確認），以及表單欄位怎麼映射成
// ECP 欄位（record）。本流程無附件上傳需求，故不帶 entityUnitId。
// 欄位對應（PM 已確認）：統一編號 → U_CompanyUnified；會員載具／手機條碼 → U_MemberDevice；
// U_InvoiceInfo 固定寫入 TYPE_LABEL 對應的類型標籤。
// FName／U_ContractNum／U_MemberCode 不屬本流程蒐集範圍，依 PM 指示先留空字串。
const mgr = createEcpApplicationMgr({
    savePath: 'CUS.ChangeBasicInfo.Save.data'
});

class InvoiceInfoChangeApiMgr {
    // 把表單資料（type/value/contactType/contactValue）映射成 CUS.ChangeBasicInfo 的欄位。
    mapToEcpFields(applyData) {
        const isEmail = applyData.contactType === 'email';
        const record = {
            FName: '', // TODO(PM 確認)：名稱來源待補
            U_CompanyUnified: '',
            U_MemberDevice: '',
            U_InvoiceInfo: TYPE_LABEL[applyData.type] || '',
            U_ContactEmail: isEmail ? (applyData.contactValue || '') : '',
            U_ContactPhone: isEmail ? '' : (applyData.contactValue || ''),
            U_ContractNum: '', // TODO(PM 確認)：合約編號來源待補
            U_MemberCode: '' // TODO(PM 確認)：會員號碼來源待補
        };

        if (applyData.type === 'unified') {
            record.U_CompanyUnified = applyData.value || '';
        } else if (applyData.type === 'memberDevice' || applyData.type === 'mobileBarcode') {
            record.U_MemberDevice = applyData.value || '';
        }

        return record;
    }

    // 新增一筆發票資訊變更申請案。回傳 { entityId }（本流程無附件上傳，entityId 目前無下游用途）。
    async submit({ chatId, applyData, logger }) {
        const record = this.mapToEcpFields(applyData);
        logger && logger.InfoLog(`[InvoiceInfoChangeApiMgr] 受理發票資訊變更申請（chatId=${chatId}）`);
        return mgr.saveApplication(record, logger);
    }
}

module.exports = new InvoiceInfoChangeApiMgr();
