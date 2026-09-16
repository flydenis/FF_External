const axios = require('axios');
const ExternalConfig = require('../ExternalConfig');
const ChainseaApiMgr = require('./ChainseaApiMgr');

// 通用「寫入 ECP 申請案 + 上傳附件」管理器工廠。任何流程要做「建單（走舊制 1.0 Basic Auth）→ 逐檔上傳附件到 ECP
// （走 OpenAPI 2.0：先 openapi/qs/user/token/apply 換 token，再 openapi/qs/attachment/upload 帶 token 上傳）」，
// 都呼叫這裡建一個實例，不用每支流程各自重寫一份 token 管理／multipart 上傳／token 失效重試邏輯。
// 各流程唯一不同的只有 savePath（ECP 單元的新增端點）與 entityUnitId（附件掛哪個業務單元）；
// 欄位怎麼從表單資料映射成 ECP 欄位（record），交由呼叫端（各自的 XxxApplicationApiMgr）處理，這裡不管業務邏輯。
// options: { savePath（必填）、entityUnitId（必填）、loginName/password（預設沿用 ExternalConfig.EcpApi）、timeout }
function createEcpApplicationMgr({ savePath, entityUnitId, loginName, password, timeout }) {
    if (!savePath) throw new Error('createEcpApplicationMgr 需要 savePath（ECP 單元的新增端點，如 CUS.AgentApplication.Save.data）');

    const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
    const url = {
        save: base + savePath,
        applyToken: base + 'openapi/qs/user/token/apply',
        uploadAttachment: base + 'openapi/qs/attachment/upload'
    };
    const loginName_ = loginName || (ExternalConfig.EcpApi && ExternalConfig.EcpApi.LoginName) || '';
    const password_ = password || (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Password) || '';
    const requestTimeout = timeout || ExternalConfig.RequestTimeout || 50000;
    // 換到的 token 快取在這個工廠實例上，同一 process 內重複使用；失效時 uploadEntityAttachment 會重新申請。
    // 注意：每個業務單元（代理人／請假…）各自持有一份自己的 token 快取，不是全專案共用一份。
    let tokenId = null;

    // 用帳密換 token（OpenAPI 2.0 token/apply，請求不帶 _header_）。成功寫入 tokenId 並回傳；失敗丟例外。
    async function applyToken(logger) {
        const started = Date.now();
        logger && logger.InfoLog(`[EcpApplicationMgr:${savePath}] → 申請 token ${url.applyToken} loginName=${loginName_}`);
        const resp = await axios.post(url.applyToken, {
            loginName: loginName_,
            password: password_,
            language: 'zh-tw'
        }, { timeout: requestTimeout });
        const header = resp.data && resp.data._header_;
        if (!header || !header.success || !resp.data.tokenId) {
            const detail = header && header.errorMessage ? header.errorMessage : JSON.stringify(resp.data);
            throw new Error(`token 申請失敗: ${detail}`);
        }
        tokenId = resp.data.tokenId;
        logger && logger.InfoLog(`[EcpApplicationMgr:${savePath}] ← token 申請成功（${Date.now() - started}ms）`);
        return tokenId;
    }

    // 新增一筆申請案。record 為呼叫端已映射好的 ECP 欄位物件（key=欄位名，只帶實際蒐集到的欄位）。
    // 回傳 { entityId }：entityId 取自回應 entityIds[0]，供後續附件上傳時帶入。
    async function saveApplication(record, logger) {
        const body = { data: [record] };
        const resp = await ChainseaApiMgr.post(url.save, body, logger);
        const entityId = resp && Array.isArray(resp.entityIds) ? resp.entityIds[0] : undefined;
        if (!entityId) {
            logger && logger.AlertLog(`[EcpApplicationMgr:${savePath}] saveApplication 未取得 entityId，回應=${JSON.stringify(resp)}`);
        }
        return { entityId };
    }

    // 上傳一個附件到指定 entity（OpenAPI 2.0：multipart/form-data，args 帶 {_header_:{tokenId}, unitId, entityId} + file）。
    // fileBuffer 為檔案位元組（Buffer）；fileName 為顯示檔名；boundary/Content-Type 由 FormData 自動帶。
    // token 尚未申請過就先申請；若回應 Qs.Token.Invalid/Required（token 失效或未帶），重新申請一次後重試。
    async function uploadEntityAttachment({ entityId, fileName, fileBuffer, contentType, logger }) {
        if (!fileBuffer || !fileBuffer.length) {
            logger && logger.AlertLog(`[EcpApplicationMgr:${savePath}] uploadEntityAttachment 無檔案內容，略過（entityId=${entityId}, fileName=${fileName}）`);
            return null;
        }
        if (!tokenId) {
            try {
                await applyToken(logger);
            } catch (err) {
                logger && logger.AlertLog(`[EcpApplicationMgr:${savePath}] ✗ token 申請失敗，略過附件上傳：${err.message}`);
                return null;
            }
        }

        const doUpload = () => {
            const args = JSON.stringify({ _header_: { tokenId }, unitId: entityUnitId, entityId });
            const form = new FormData();
            form.append('args', args);
            form.append('file', new Blob([fileBuffer], { type: contentType || 'application/octet-stream' }), fileName);
            return axios.post(url.uploadAttachment, form, {
                timeout: requestTimeout,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
        };

        const started = Date.now();
        logger && logger.InfoLog(`[EcpApplicationMgr:${savePath}] → 上傳附件 ${url.uploadAttachment} entityId=${entityId} file=${fileName}（${fileBuffer.length} bytes）`);
        try {
            let resp = await doUpload();
            let header = resp.data && resp.data._header_;
            if (header && !header.success && (header.errorCode === 'Qs.Token.Invalid' || header.errorCode === 'Qs.Token.Required')) {
                logger && logger.InfoLog(`[EcpApplicationMgr:${savePath}] token 失效（${header.errorCode}），重新申請後重試一次`);
                await applyToken(logger);
                resp = await doUpload();
                header = resp.data && resp.data._header_;
            }
            if (!header || !header.success) {
                logger && logger.AlertLog(`[EcpApplicationMgr:${savePath}] ✗ 附件上傳失敗（${Date.now() - started}ms）：${JSON.stringify(resp.data)}`);
                return null;
            }
            logger && logger.InfoLog(`[EcpApplicationMgr:${savePath}] ← 附件上傳成功（${Date.now() - started}ms）id=${resp.data.id}`);
            return resp.data;
        } catch (err) {
            logger && logger.AlertLog(`[EcpApplicationMgr:${savePath}] ✗ 附件上傳失敗（${Date.now() - started}ms）：${err && err.message ? err.message : err}`);
            return null;
        }
    }

    return { saveApplication, uploadEntityAttachment, applyToken };
}

module.exports = { createEcpApplicationMgr };
