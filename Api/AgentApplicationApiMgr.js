const axios = require('axios');
const ExternalConfig = require('../ExternalConfig');
const ChainseaApiMgr = require('./ChainseaApiMgr');

// 代理人申請案（CUS.AgentApplication）寫入（走舊制 1.0 Basic Auth，經 ChainseaApiMgr.post）
// + 附件實體上傳（走 OpenAPI 2.0：先 openapi/qs/user/token/apply 換 token，再 openapi/qs/attachment/upload 帶 token 上傳）。
class AgentApplicationApiMgr {
    constructor() {
        const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
        this.url = {
            saveApplication: base + 'CUS.AgentApplication.Save.data',
            applyToken: base + 'openapi/qs/user/token/apply',
            uploadAttachment: base + 'openapi/qs/attachment/upload'
        };
        // 附件所掛 entity 的單元 ID（args.unitId）。
        // TODO(PM 確認)：此值須為 CUS.AgentApplication 的 unitId；你 Postman 範例用的是 00000000-0000-0000-0001-020000001002，
        //   若上傳掛錯 entity 就改這個值。
        this.entityUnitId = '1a0656b6-2030-043b-6d18-00505693a3c1';
        this.loginName = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.LoginName) || '';
        this.password = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Password) || '';
        this.timeout = ExternalConfig.RequestTimeout || 50000;
        // 換到的 token 快取在 instance 上，同一 process 內重複使用；失效時 uploadEntityAttachment 會重新申請。
        this.tokenId = null;
    }

    // 用帳密換 token（OpenAPI 2.0 token/apply，請求不帶 _header_）。成功寫入 this.tokenId 並回傳；失敗丟例外。
    async applyToken(logger) {
        const started = Date.now();
        logger && logger.InfoLog(`[AgentApplicationApiMgr] → 申請 token ${this.url.applyToken} loginName=${this.loginName}`);
        const resp = await axios.post(this.url.applyToken, {
            loginName: this.loginName,
            password: this.password,
            language: 'zh-tw'
        }, { timeout: this.timeout });
        const header = resp.data && resp.data._header_;
        if (!header || !header.success || !resp.data.tokenId) {
            const detail = header && header.errorMessage ? header.errorMessage : JSON.stringify(resp.data);
            throw new Error(`token 申請失敗: ${detail}`);
        }
        this.tokenId = resp.data.tokenId;
        logger && logger.InfoLog(`[AgentApplicationApiMgr] ← token 申請成功（${Date.now() - started}ms）`);
        return this.tokenId;
    }

    // 新增一筆代理人申請案。fields 只帶實際蒐集到的欄位（未蒐集的欄位不送，維持資料表預設值）。
    // 回傳 { entityId }：entityId 取自回應 entityIds[0]，供後續附件上傳時帶入。
    async saveApplication({ applicationType, agentName, agentPhone, agentIdDocUploaded, logger }) {
        const record = { U_ApplicationType: applicationType };
        if (agentName !== undefined) record.U_AgentName = agentName;
        if (agentPhone !== undefined) record.U_AgentContactNum = agentPhone;
        if (agentIdDocUploaded !== undefined) record.U_AgentIdDoc = !!agentIdDocUploaded;

        const body = { data: [record] };
        const resp = await ChainseaApiMgr.post(this.url.saveApplication, body, logger);
        const entityId = resp && Array.isArray(resp.entityIds) ? resp.entityIds[0] : undefined;
        if (!entityId) {
            logger && logger.AlertLog(`[AgentApplicationApiMgr] saveApplication 未取得 entityId，回應=${JSON.stringify(resp)}`);
        }
        return { entityId };
    }

    // 上傳一個附件到指定 entity（OpenAPI 2.0：multipart/form-data，args 帶 {_header_:{tokenId}, unitId, entityId} + file）。
    // fileBuffer 為檔案位元組（Buffer）；fileName 為顯示檔名（如「切結書.png」）；boundary/Content-Type 由 FormData 自動帶。
    // token 尚未申請過就先申請；若回應 Qs.Token.Invalid/Required（token 失效或未帶），重新申請一次後重試。
    async uploadEntityAttachment({ entityId, fileName, fileBuffer, contentType, logger }) {
        if (!fileBuffer || !fileBuffer.length) {
            logger && logger.AlertLog(`[AgentApplicationApiMgr] uploadEntityAttachment 無檔案內容，略過（entityId=${entityId}, fileName=${fileName}）`);
            return null;
        }
        if (!this.tokenId) {
            try {
                await this.applyToken(logger);
            } catch (err) {
                logger && logger.AlertLog(`[AgentApplicationApiMgr] ✗ token 申請失敗，略過附件上傳：${err.message}`);
                return null;
            }
        }

        const doUpload = () => {
            const args = JSON.stringify({ _header_: { tokenId: this.tokenId }, unitId: this.entityUnitId, entityId });
            const form = new FormData();
            form.append('args', args);
            form.append('file', new Blob([fileBuffer], { type: contentType || 'application/octet-stream' }), fileName);
            return axios.post(this.url.uploadAttachment, form, {
                timeout: this.timeout,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
        };

        const started = Date.now();
        logger && logger.InfoLog(`[AgentApplicationApiMgr] → 上傳附件 ${this.url.uploadAttachment} entityId=${entityId} file=${fileName}（${fileBuffer.length} bytes）`);
        try {
            let resp = await doUpload();
            let header = resp.data && resp.data._header_;
            if (header && !header.success && (header.errorCode === 'Qs.Token.Invalid' || header.errorCode === 'Qs.Token.Required')) {
                logger && logger.InfoLog(`[AgentApplicationApiMgr] token 失效（${header.errorCode}），重新申請後重試一次`);
                await this.applyToken(logger);
                resp = await doUpload();
                header = resp.data && resp.data._header_;
            }
            if (!header || !header.success) {
                logger && logger.AlertLog(`[AgentApplicationApiMgr] ✗ 附件上傳失敗（${Date.now() - started}ms）：${JSON.stringify(resp.data)}`);
                return null;
            }
            logger && logger.InfoLog(`[AgentApplicationApiMgr] ← 附件上傳成功（${Date.now() - started}ms）id=${resp.data.id}`);
            return resp.data;
        } catch (err) {
            logger && logger.AlertLog(`[AgentApplicationApiMgr] ✗ 附件上傳失敗（${Date.now() - started}ms）：${err && err.message ? err.message : err}`);
            return null;
        }
    }
}

module.exports = new AgentApplicationApiMgr();
