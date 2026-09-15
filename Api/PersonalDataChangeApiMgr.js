const axios = require('axios');
const ExternalConfig = require('../ExternalConfig');

// 個人資料變更申請受理：資料回寫 ECP 單元 CUS.ChangeBasicInfo（PM 已確認欄位對應如下）。
// U_CompanyUnified／U_ContractNum／U_InvoiceInfo／U_MemberCode 不屬本流程蒐集範圍或尚無資料來源，
// 依 PM 指示先留空字串，之後有來源再補（U_MemberCode／U_ContractNum 待補）。
class PersonalDataChangeApiMgr {
    // 把表單資料（items/values/contactType/contactValue/idCardFiles）映射成 CUS.ChangeBasicInfo 的欄位。
    mapToEcpFields(applyData) {
        const items = applyData.items || {};
        const values = applyData.values || {};
        const isEmail = applyData.contactType === 'email';
        const idCardFiles = Array.isArray(applyData.idCardFiles) ? applyData.idCardFiles : [];

        return {
            U_CompanyUnified: '',
            U_ContactEmail: isEmail ? (applyData.contactValue || '') : '',
            U_ContactPhone: isEmail ? '' : (applyData.contactValue || ''),
            U_ContractNum: '', // TODO(PM 確認)：合約編號來源待補
            U_InvoiceInfo: '',
            U_MailingAdd: values.contactAddress || '',
            U_MemberCode: '', // TODO(PM 確認)：會員號碼來源待補
            U_MemberIdDoc: idCardFiles.length > 0 ? '1' : '0',
            U_MobilePhone: values.mobile || '',
            U_Name: values.name || '',
            U_RegisteredAdd: values.householdAddress || ''
        };
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
        const started = Date.now();
        logger && logger.InfoLog(`[PersonalDataChangeApiMgr] → POST ${url}（chatId=${chatId}）`);
        logger && logger.InfoLog(`[PersonalDataChangeApiMgr] → Request Body: ${JSON.stringify(body)}`);
        try {
            const resp = await axios.post(url, body, {
                timeout: ExternalConfig.RequestTimeout,
                headers: { 'Content-Type': 'application/json', Authorization: (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Authorization) || '' }
            });
            logger && logger.InfoLog(`[PersonalDataChangeApiMgr] ← 回傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
            return { ok: true, data: resp.data };
        } catch (err) {
            logger && logger.AlertLog(`[PersonalDataChangeApiMgr] ✗ ${url} 失敗（${Date.now() - started}ms）：${err && err.message ? err.message : err}`);
            return { ok: false };
        }
    }
}

module.exports = new PersonalDataChangeApiMgr();
