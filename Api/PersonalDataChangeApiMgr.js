const ExternalConfig = require('../ExternalConfig');
const ChainseaApiMgr = require('./ChainseaApiMgr');

// 個人資料變更申請受理：資料回寫 ECP 單元 CUS.ChangeBasicInfo（PM 已確認欄位對應如下）。
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

    async submit({ chatId, applyData, logger }) {
        const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
        if (!base) {
            logger && logger.InfoLog('[PersonalDataChangeApiMgr] EcpApi.Url 未設定，略過回寫（僅記錄申請內容）');
            logger && logger.InfoLog(`[PersonalDataChangeApiMgr] 申請內容: ${JSON.stringify(applyData)}`);
            return { ok: true, skipped: true };
        }

        const unitPath = (ExternalConfig.PersonalDataChangeApi && ExternalConfig.PersonalDataChangeApi.EcpUnitPath) || '';
        const url = base + unitPath;
        const body = { data: [this.mapToEcpFields(applyData)] };
        logger && logger.InfoLog(`[PersonalDataChangeApiMgr] 受理個人資料變更申請（chatId=${chatId}）`);
        const resp = await ChainseaApiMgr.post(url, body, logger);
        return resp ? { ok: true, data: resp } : { ok: false };
    }
}

module.exports = new PersonalDataChangeApiMgr();
