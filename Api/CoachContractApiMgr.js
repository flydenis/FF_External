const axios = require('axios');
const path = require('path');
const fs = require('fs');
const ExternalConfig = require('../ExternalConfig');
const CommonMethod = require('../ExternalMethod/CommonMethod');

// 查教練合約資料（一個會員可能有多筆教練課程合約）。Product/development → 呼叫客戶 API；Qbi → 讀本機 data/ mock。
// TODO(PM 確認)：query() 目前用 key 當查詢條件的預留欄位，實際 request 要帶什麼欄位（會員編號對應識別碼）待客戶 API 規格確定後調整。
class CoachContractApiMgr {
    async query({ chatId, key, logger }) {
        const cfg = (ExternalConfig.CoachContractQuery && ExternalConfig.CoachContractQuery[ExternalConfig.Mode]) || {};
        const started = Date.now();

        let source;
        if (ExternalConfig.Mode === 'Qbi') {
            // 防 Path Manipulation（CWE-22）：只讀 data/ 目錄、檔名取 basename，確認解析後未逸出 data/。
            const dataDir = path.join(__dirname, '..', 'data');
            const filePath = path.join(dataDir, path.basename(cfg.Url || ''));
            if (filePath !== dataDir && !filePath.startsWith(dataDir + path.sep)) {
                throw new Error('invalid Qbi data path');
            }
            logger && logger.InfoLog(`[CoachContractApiMgr] → 讀本機 mock: ${filePath}`);
            source = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            logger && logger.InfoLog(`[CoachContractApiMgr] ← mock 回傳（${Date.now() - started}ms）Body: ${JSON.stringify(source)}`);
        } else {
            const body = { name: 'CoachContractQuery', from: 'csr', sessionId: chatId || CommonMethod.makeSessionId(), formData: { key } };
            logger && logger.InfoLog(`[CoachContractApiMgr] → 呼叫 API: ${cfg.Url}`);
            logger && logger.InfoLog(`[CoachContractApiMgr] → Request Body: ${JSON.stringify(body)}`);
            const resp = await axios.post(cfg.Url, body, {
                timeout: ExternalConfig.RequestTimeout,
                headers: { 'Content-Type': 'application/json' }
            });
            logger && logger.InfoLog(`[CoachContractApiMgr] ← 回傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
            source = this.parseSource(resp.data);
        }
        const result = this.normalize(source, key);
        logger && logger.InfoLog(`[CoachContractApiMgr] 解析結果: found=${result.found}, 筆數=${result.records.length}`);
        return result;
    }

    parseSource(response) {
        const src = response && response.result ? response.result.source : response;
        if (typeof src === 'string') { try { return JSON.parse(src); } catch { return {}; } }
        return src || {};
    }

    // 依 status_code 判無資料；有 key 就篩出符合的所有合約，無 key 就回全部（最多 10 筆）。
    normalize(source, key) {
        const code = String((source && (source.status_code ?? source.statusCode)) || '');
        if (code === '0002') return { found: false, records: [] };
        const rows = Array.isArray(source && source.data) ? source.data : [];
        const records = (key ? rows.filter(r => String(r.key || '').toUpperCase() === String(key).toUpperCase()) : rows).slice(0, 10);
        return { found: records.length > 0, records };
    }
}

module.exports = new CoachContractApiMgr();
