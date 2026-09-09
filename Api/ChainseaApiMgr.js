const axios = require('axios');
const ExternalConfig = require('../ExternalConfig');

// ECP 對話紀錄管理器：每輪把對話寫回 ECP、可還原狀態、查節點路由、寫滿意度，供事後統整/報表。
// 端點由 ExternalConfig.EcpApi.Url 組出；內部自簽憑證改用 NODE_EXTRA_CA_CERTS，不關閉 TLS 驗證。
class ChainseaApiMgr {
    constructor() {
        const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
        this.url = {
            getFlow: base + 'CUS.ChatBotExternalFlowStep.getListData.data',
            addRecord: base + 'CUS.ChatBotExternalRecord.Save.data',
            getRecord: base + 'CUS.ChatBotExternalRecord.getListData.data',
            addSatisfy: base + 'CUS.AsrSatisfactionRawData.Save.data'
        };
        this.authorization = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Authorization) || '';
        this.timeout = ExternalConfig.RequestTimeout || 50000;
    }

    // 查節點路由：U_CurrentStep + U_FlowYN → U_NextStep（節點流程存 ECP 時用）
    getExternalFlow({ currentStep, isFlowYN, logger }) {
        const body = {
            fieldNames: ['U_NextStep'],
            conditions: [
                { fieldName: 'U_CurrentStep', operator: 'Equal', value: currentStep },
                { fieldName: 'U_FlowYN', operator: 'Equal', value: isFlowYN }
            ],
            order: ['FUpdateTime desc']
        };
        return this.post(this.url.getFlow, body, logger);
    }

    // 每輪寫一筆對話紀錄（供還原與事後統整）
    addExternalRecord({ chatId, currentStep, nextStep, flowData, isFlowStop, flowName, logger }) {
        const body = {
            data: [{
                U_UserID: chatId,
                U_CurrentStep: currentStep,
                U_NextStep: nextStep,
                U_ExternalFlowInfo: flowData,
                U_IsFlowStop: isFlowStop,
                FName: flowName
            }]
        };
        return this.post(this.url.addRecord, body, logger);
    }

    // 取回最近一小時該 chatId + 流程 的紀錄以還原狀態
    getExternalRecord({ chatId, flowName, logger }) {
        const body = {
            fieldNames: ['U_UserID', 'U_ExternalFlowInfo', 'FCreateTime', 'U_IsFlowStop'],
            conditions: [
                { fieldName: 'U_UserID', operator: 'Equal', value: chatId },
                { fieldName: 'FName', operator: 'Equal', value: flowName },
                { fieldName: 'FCreateTime', operator: 'Great', value: this.hoursAgo(1) }
            ],
            order: ['FCreateTime desc']
        };
        return this.post(this.url.getRecord, body, logger);
    }

    // 滿意度原始資料
    addSatisfyRecord({ data, logger }) {
        return this.post(this.url.addSatisfy, { data: [data] }, logger);
    }

    async post(url, body, logger) {
        const started = Date.now();
        logger && logger.InfoLog(`[ChainseaApiMgr] → POST ${url}`);
        logger && logger.InfoLog(`[ChainseaApiMgr] → Request Body: ${JSON.stringify(body)}`);
        try {
            const resp = await axios.post(url, body, {
                timeout: this.timeout,
                headers: { 'Content-Type': 'application/json', Authorization: this.authorization }
            });
            logger && logger.InfoLog(`[ChainseaApiMgr] ← 回傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
            return resp.data;
        } catch (err) {
            logger && logger.AlertLog(`[ChainseaApiMgr] ✗ ${url} 失敗（${Date.now() - started}ms）：${err && err.message ? err.message : err}`);
            return null;   // 紀錄失敗不阻斷主流程
        }
    }

    hoursAgo(h) {
        const d = new Date(Date.now() - h * 3600 * 1000);
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
}

module.exports = new ChainseaApiMgr();
