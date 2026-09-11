const axios = require('axios');
const ExternalConfig = require('../ExternalConfig');
const ChainseaApiMgr = require('./ChainseaApiMgr');

// 代理人申請案（CUS.AgentApplication）寫入 + 附件實體上傳（Qs.Attachment.UploadEntityAttachment）。
// 申請案走 ChainseaApiMgr.post()（JSON）；附件是 multipart/form-data（args + file），故另用 axios 直送。
class AgentApplicationApiMgr {
    constructor() {
        const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
        this.url = {
            saveApplication: base + 'CUS.AgentApplication.Save.data',
            uploadAttachment: base + 'Qs.Attachment.UploadEntityAttachment.data'
        };
        // 附件所掛 entity 的單元 ID（args.unitId）。
        // TODO(PM 確認)：此值須為 CUS.AgentApplication 的 unitId；你 Postman 範例用的是 00000000-0000-0000-0001-020000001002，
        //   若上傳掛錯 entity 就改這個值。
        this.entityUnitId = '1a0656b6-2030-043b-6d18-00505693a3c1';
        this.authorization = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Authorization) || '';
        this.timeout = ExternalConfig.RequestTimeout || 50000;
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

    // 上傳一個附件到指定 entity：multipart/form-data，args 帶 {unitId, entityId}、file 帶實際檔案內容。
    // fileBuffer 為檔案位元組（Buffer）；fileName 為顯示檔名（如「切結書.png」）；boundary/Content-Type 由 FormData 自動帶。
    async uploadEntityAttachment({ entityId, fileName, fileBuffer, contentType, logger }) {
        if (!fileBuffer || !fileBuffer.length) {
            logger && logger.AlertLog(`[AgentApplicationApiMgr] uploadEntityAttachment 無檔案內容，略過（entityId=${entityId}, fileName=${fileName}）`);
            return null;
        }
        const started = Date.now();
        const args = JSON.stringify({ unitId: this.entityUnitId, entityId });
        const form = new FormData();
        form.append('args', args);
        form.append('file', new Blob([fileBuffer], { type: contentType || 'application/octet-stream' }), fileName);

        logger && logger.InfoLog(`[AgentApplicationApiMgr] → 上傳附件 ${this.url.uploadAttachment} args=${args} file=${fileName}（${fileBuffer.length} bytes）`);
        try {
            const resp = await axios.post(this.url.uploadAttachment, form, {
                timeout: this.timeout,
                headers: { Authorization: this.authorization },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            logger && logger.InfoLog(`[AgentApplicationApiMgr] ← 附件上傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
            return resp.data;
        } catch (err) {
            logger && logger.AlertLog(`[AgentApplicationApiMgr] ✗ 附件上傳失敗（${Date.now() - started}ms）：${err && err.message ? err.message : err}`);
            return null;
        }
    }
}

module.exports = new AgentApplicationApiMgr();
