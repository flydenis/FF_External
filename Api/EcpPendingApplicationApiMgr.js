const axios = require('axios');
const path = require('path');
const fs = require('fs');
const ExternalConfig = require('../ExternalConfig');
const CommonMethod = require('../ExternalMethod/CommonMethod');

// 查 ECP 待處理表單（不分類，上限 10 筆）。Product/development → 呼叫客戶 API；Qbi → 讀本機 data/ mock。
// TODO(架構待確認)：目前沒有單一端點可一次查到所有 CUS.* 申請類型的待處理案件，Qbi 先假設已整合好的結果；
// 待確認真正查詢機制（單一端點 or 逐類查詢彙整）後再調整這裡的呼叫方式。
class EcpPendingApplicationApiMgr {
    async query({ chatId, key, logger }) {
        const cfg = (ExternalConfig.EcpPendingApplicationQuery && ExternalConfig.EcpPendingApplicationQuery[ExternalConfig.Mode]) || {};
        const started = Date.now();

        let source;
        if (ExternalConfig.Mode === 'Qbi') {
            // 防 Path Manipulation（CWE-22）：只讀 data/ 目錄、檔名取 basename，確認解析後未逸出 data/。
            const dataDir = path.join(__dirname, '..', 'data');
            const filePath = path.join(dataDir, path.basename(cfg.Url || ''));
            if (filePath !== dataDir && !filePath.startsWith(dataDir + path.sep)) {
                throw new Error('invalid Qbi data path');
            }
            logger && logger.InfoLog(`[EcpPendingApplicationApiMgr] → 讀本機 mock: ${filePath}`);
            source = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            logger && logger.InfoLog(`[EcpPendingApplicationApiMgr] ← mock 回傳（${Date.now() - started}ms）Body: ${JSON.stringify(source)}`);
        } else {
            const body = { name: 'EcpPendingApplicationQuery', from: 'csr', sessionId: chatId || CommonMethod.makeSessionId(), formData: { key } };
            logger && logger.InfoLog(`[EcpPendingApplicationApiMgr] → 呼叫 API: ${cfg.Url}`);
            logger && logger.InfoLog(`[EcpPendingApplicationApiMgr] → Request Body: ${JSON.stringify(body)}`);
            const resp = await axios.post(cfg.Url, body, {
                timeout: ExternalConfig.RequestTimeout,
                headers: { 'Content-Type': 'application/json' }
            });
            logger && logger.InfoLog(`[EcpPendingApplicationApiMgr] ← 回傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
            source = this.parseSource(resp.data);
        }
        const result = this.normalize(source, key);
        logger && logger.InfoLog(`[EcpPendingApplicationApiMgr] 解析結果: found=${result.found}`);
        return result;
    }

    parseSource(response) {
        const src = response && response.result ? response.result.source : response;
        if (typeof src === 'string') { try { return JSON.parse(src); } catch { return {}; } }
        return src || {};
    }

    // 依 status_code 判無資料，否則取第一筆符合 key 的紀錄；無 key 時取第一筆。
    normalize(source, key) {
        const code = String((source && (source.status_code ?? source.statusCode)) || '');
        if (code === '0002') return { found: false, record: null };
        const rows = Array.isArray(source && source.data) ? source.data : [];
        const record = key
            ? (rows.find(r => String(r.key || '').toUpperCase() === String(key).toUpperCase()) || null)
            : (rows[0] || null);
        return { found: !!record, record };
    }
}

module.exports = new EcpPendingApplicationApiMgr();
