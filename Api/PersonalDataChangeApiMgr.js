const axios = require('axios');
const ExternalConfig = require('../ExternalConfig');
const ChainseaApiMgr = require('./ChainseaApiMgr');

// Qs.Attachment.UploadEntityAttachment 掛附件用的 unitId，PM 已確認為 CUS.ChangeBasicInfo 的 unitId。
const ATTACHMENT_ENTITY_UNIT_ID = 'ccb96422-e464-4f8f-9b69-04bb55edc678';

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
        const entityId = resp && Array.isArray(resp.entityIds) ? resp.entityIds[0] : undefined;
        if (resp && !entityId) {
            logger && logger.AlertLog(`[PersonalDataChangeApiMgr] submit 未取得 entityId，回應=${JSON.stringify(resp)}`);
        }
        return resp ? { ok: true, entityId, data: resp } : { ok: false };
    }

    // 上傳一份身分證附件到指定 entity：multipart/form-data，args 帶 {unitId, entityId}、file 帶實際檔案內容。
    // 作法比照 Api/AgentApplicationApiMgr.js 的 uploadEntityAttachment（main a6325b9「附件上傳完成」）。
    async uploadEntityAttachment({ entityId, fileName, fileBuffer, contentType, logger }) {
        if (!fileBuffer || !fileBuffer.length) {
            logger && logger.AlertLog(`[PersonalDataChangeApiMgr] uploadEntityAttachment 無檔案內容，略過（entityId=${entityId}, fileName=${fileName}）`);
            return null;
        }
        const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
        const url = base + 'Qs.Attachment.UploadEntityAttachment.data';
        const authorization = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Authorization) || '';
        const timeout = ExternalConfig.RequestTimeout || 50000;

        const started = Date.now();
        const args = JSON.stringify({ unitId: ATTACHMENT_ENTITY_UNIT_ID, entityId });
        const form = new FormData();
        form.append('args', args);
        form.append('file', new Blob([fileBuffer], { type: contentType || 'application/octet-stream' }), fileName);

        logger && logger.InfoLog(`[PersonalDataChangeApiMgr] → 上傳附件 ${url} args=${args} file=${fileName}（${fileBuffer.length} bytes）`);
        try {
            const resp = await axios.post(url, form, {
                timeout,
                headers: { Authorization: authorization },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            logger && logger.InfoLog(`[PersonalDataChangeApiMgr] ← 附件上傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
            return resp.data;
        } catch (err) {
            logger && logger.AlertLog(`[PersonalDataChangeApiMgr] ✗ 附件上傳失敗（${Date.now() - started}ms）：${err && err.message ? err.message : err}`);
            return null;
        }
    }
}

module.exports = new PersonalDataChangeApiMgr();
