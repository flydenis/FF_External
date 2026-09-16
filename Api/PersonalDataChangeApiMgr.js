const { createEcpApplicationMgr } = require('./EcpApplicationMgr');

// 個人資料變更申請（CUS.ChangeBasicInfo）寫入 + 身分證正反面附件上傳。token 管理／multipart 上傳等共用邏輯都在
// EcpApplicationMgr，這裡只負責「個人資料變更專屬」的部分：savePath／entityUnitId，以及表單欄位怎麼映射成 ECP 欄位（record）。
const mgr = createEcpApplicationMgr({
    savePath: 'CUS.ChangeBasicInfo.Save.data',
    // Qs.Attachment.UploadEntityAttachment 掛附件用的 unitId，PM 已確認為 CUS.ChangeBasicInfo 的 unitId。
    entityUnitId: 'ccb96422-e464-4f8f-9b69-04bb55edc678'
});

// U_CompanyUnified／U_ContractNum／U_InvoiceInfo／U_MemberCode 不屬本流程蒐集範圍或尚無資料來源，
// 依 PM 指示先留空字串，之後有來源再補（U_MemberCode／U_ContractNum 待補）。
class PersonalDataChangeApiMgr {
    // 把表單資料（items/values/contactType/contactValue/idCardFiles）映射成 CUS.ChangeBasicInfo 的欄位。
    // 只有使用者實際勾選要變更的項目才會帶對應欄位（比照 AgentApplicationApiMgr.saveApplication 的作法），
    // 未勾選的項目完全不送，交由 ECP 端維持原值——避免表單裡殘留的舊輸入內容把使用者沒有要改的欄位一併覆蓋掉。
    mapToEcpFields(applyData) {
        const items = applyData.items || {};
        const values = applyData.values || {};
        const isEmail = applyData.contactType === 'email';
        const idCardFiles = Array.isArray(applyData.idCardFiles) ? applyData.idCardFiles : [];

        const record = {
            FName: '', // TODO(PM 確認)： 名稱來源待補
            U_CompanyUnified: '',
            U_ContactEmail: isEmail ? (applyData.contactValue || '') : '',
            U_ContactPhone: isEmail ? '' : (applyData.contactValue || ''),
            U_ContractNum: '', // TODO(PM 確認)：合約編號來源待補
            U_InvoiceInfo: '',
            U_MemberCode: '' // TODO(PM 確認)：會員號碼來源待補
        };
        if (items.contactAddress) record.U_MailingAdd = values.contactAddress || '';
        if (items.mobile) record.U_MobilePhone = values.mobile || '';
        if (items.name) record.U_Name = values.name || '';
        if (items.householdAddress) record.U_RegisteredAdd = values.householdAddress || '';
        if (items.householdAddress || items.name) record.U_MemberIdDoc = idCardFiles.length > 0 ? '1' : '0';

        return record;
    }

    // 新增一筆個人資料變更申請案。回傳 { entityId }：entityId 取自回應 entityIds[0]，供後續身分證附件上傳時帶入。
    async submit({ chatId, applyData, logger }) {
        const record = this.mapToEcpFields(applyData);
        logger && logger.InfoLog(`[PersonalDataChangeApiMgr] 受理個人資料變更申請（chatId=${chatId}）`);
        return mgr.saveApplication(record, logger);
    }

    uploadEntityAttachment(args) {
        return mgr.uploadEntityAttachment(args);
    }
}

module.exports = new PersonalDataChangeApiMgr();
