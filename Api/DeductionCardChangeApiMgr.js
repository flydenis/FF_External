const { createEcpApplicationMgr } = require('./EcpApplicationMgr');

// 扣款卡片變更申請（CUS.ChangeDebitCard）寫入 + 信用卡授權書附件上傳。token 管理／multipart 上傳等共用邏輯都在
// EcpApplicationMgr，這裡只負責「扣款卡片變更專屬」的部分：savePath／entityUnitId，以及表單欄位怎麼映射成 ECP 欄位（record）。
const mgr = createEcpApplicationMgr({
    savePath: 'CUS.ChangeDebitCard.Save.data',
    // Qs.Attachment.UploadEntityAttachment 掛附件用的 unitId，PM 已確認為 CUS.ChangeDebitCard 的 unitId。
    entityUnitId: 'f28428e4-8677-4325-b7f6-e8cb2e0c608f'
});

// 欄位對應（PM 已提供 CUS.ChangeDebitCard 欄位清單）：
// U_ContactPhone／U_ContactEmail＝受理通知聯絡方式；U_CreditCardAuthLetter＝是否已附信用卡授權書（'1'/'0'，
// 比照 PersonalDataChangeApiMgr 的 U_MemberIdDoc 作法，實際檔案內容另走 uploadEntityAttachment）。
// U_ContractNum／U_MemberCode 尚無資料來源，依 PM 指示先留空字串；U_Status 初始值待 PM 確認，先留空由 ECP 端預設。
class DeductionCardChangeApiMgr {
    mapToEcpFields(applyData) {
        const isEmail = applyData.contactType === 'email';
        const authLetterFiles = Array.isArray(applyData.authLetterFiles) ? applyData.authLetterFiles : [];

        return {
            U_ContactEmail: isEmail ? (applyData.contactValue || '') : '',
            U_ContactPhone: isEmail ? '' : (applyData.contactValue || ''),
            U_ContractNum: '', // TODO(PM 確認)：合約編號來源待補
            U_CreditCardAuthLetter: authLetterFiles.length > 0 ? '1' : '0',
            U_MemberCode: '', // TODO(PM 確認)：會員編號來源待補
            U_Remark: '',
            U_Status: '' // TODO(PM 確認)：表單狀態初始值待補
        };
    }

    // 新增一筆扣款卡片變更申請案。回傳 { entityId }：entityId 取自回應 entityIds[0]，供後續授權書附件上傳時帶入。
    async submit({ chatId, applyData, logger }) {
        const record = this.mapToEcpFields(applyData);
        logger && logger.InfoLog(`[DeductionCardChangeApiMgr] 受理扣款卡片變更申請（chatId=${chatId}）`);
        return mgr.saveApplication(record, logger);
    }

    uploadEntityAttachment(args) {
        return mgr.uploadEntityAttachment(args);
    }
}

module.exports = new DeductionCardChangeApiMgr();
