const axios = require('axios');
const ExternalConfig = require('../ExternalConfig');

// 個人資料變更申請受理：資料回寫 ECP 單元。
// TODO(PM 確認)：ExternalConfig.PersonalDataChangeApi.EcpUnitPath 目前為佔位字串，待確認正式 ECP 單元名稱與欄位對應。
class PersonalDataChangeApiMgr {
    async submit({ chatId, applyData, logger }) {
        const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
        if (!base) {
            logger && logger.InfoLog('[PersonalDataChangeApiMgr] EcpApi.Url 未設定，略過回寫（僅記錄申請內容）');
            logger && logger.InfoLog(`[PersonalDataChangeApiMgr] 申請內容: ${JSON.stringify(applyData)}`);
            return { ok: true, skipped: true };
        }

        const unitPath = (ExternalConfig.PersonalDataChangeApi && ExternalConfig.PersonalDataChangeApi.EcpUnitPath) || '';
        const url = base + unitPath;
        const body = { data: [{ U_UserID: chatId, U_ApplyInfo: JSON.stringify(applyData) }] };
        const started = Date.now();
        logger && logger.InfoLog(`[PersonalDataChangeApiMgr] → POST ${url}`);
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
