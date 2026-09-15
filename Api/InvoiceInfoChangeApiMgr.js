const ExternalConfig = require('../ExternalConfig');
const ChainseaApiMgr = require('./ChainseaApiMgr');

// U_InvoiceInfo 只能寫入這三個固定字面值其中之一（PM 已確認），用來標記本次變更的是哪一種發票資訊類型。
const TYPE_LABEL = {
    unified: '公司統編',
    memberDevice: '會員載具',
    mobileBarcode: '手機載具'
};

// 發票資訊變更申請受理：資料回寫 ECP 單元 CUS.ChangeBasicInfo（與 PersonalDataChangeApiMgr 共用同一單元，PM 已確認）。
// 欄位對應（PM 已確認）：統一編號 → U_CompanyUnified；會員載具／手機條碼 → U_MemberDevice；
// U_InvoiceInfo 固定寫入 TYPE_LABEL 對應的類型標籤。
// FName／U_ContractNum／U_MemberCode 不屬本流程蒐集範圍，依 PM 指示先留空字串。
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

    async submit({ chatId, applyData, logger }) {
        const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
        if (!base) {
            logger && logger.InfoLog('[InvoiceInfoChangeApiMgr] EcpApi.Url 未設定，略過回寫（僅記錄申請內容）');
            logger && logger.InfoLog(`[InvoiceInfoChangeApiMgr] 申請內容: ${JSON.stringify(applyData)}`);
            return { ok: true, skipped: true };
        }

        const unitPath = (ExternalConfig.InvoiceInfoChangeApi && ExternalConfig.InvoiceInfoChangeApi.EcpUnitPath) || '';
        const url = base + unitPath;
        const body = { data: [this.mapToEcpFields(applyData)] };
        logger && logger.InfoLog(`[InvoiceInfoChangeApiMgr] 受理發票資訊變更申請（chatId=${chatId}）`);
        const resp = await ChainseaApiMgr.post(url, body, logger);
        const entityId = resp && Array.isArray(resp.entityIds) ? resp.entityIds[0] : undefined;
        if (resp && !entityId) {
            logger && logger.AlertLog(`[InvoiceInfoChangeApiMgr] submit 未取得 entityId，回應=${JSON.stringify(resp)}`);
        }
        return resp ? { ok: true, entityId, data: resp } : { ok: false };
    }
}

module.exports = new InvoiceInfoChangeApiMgr();
