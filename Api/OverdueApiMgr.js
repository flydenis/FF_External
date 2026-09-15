const axios = require('axios');
const path = require('path');
const fs = require('fs');
const ExternalConfig = require('../ExternalConfig');
const CommonMethod = require('../ExternalMethod/CommonMethod');

// 共用欠費查詢：供任何「申請/送單」類流程進入時呼叫，確認會員是否有欠款（僅提示、不擋收單）。
// Product/development → 呼叫客戶 API；Qbi → 讀本機 data/ mock。查詢失敗一律視為「無欠費」，
// 不讓這個非關鍵的提醒檢查擋住主流程受理。
// TODO(PM 確認)：query() 目前用 key 當查詢條件的預留欄位，實際 request 要帶什麼欄位待客戶 API 規格確定後調整。
class OverdueApiMgr {
    async query({ chatId, key, logger }) {
        const cfg = (ExternalConfig.OverdueQuery && ExternalConfig.OverdueQuery[ExternalConfig.Mode]) || {};
        const started = Date.now();

        try {
            let source;
            if (ExternalConfig.Mode === 'Qbi') {
                // 防 Path Manipulation（CWE-22）：只讀 data/ 目錄、檔名取 basename，確認解析後未逸出 data/。
                const dataDir = path.join(__dirname, '..', 'data');
                const filePath = path.join(dataDir, path.basename(cfg.Url || ''));
                if (filePath !== dataDir && !filePath.startsWith(dataDir + path.sep)) {
                    throw new Error('invalid Qbi data path');
                }
                logger && logger.InfoLog(`[OverdueApiMgr] → 讀本機 mock: ${filePath}`);
                source = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                logger && logger.InfoLog(`[OverdueApiMgr] ← mock 回傳（${Date.now() - started}ms）Body: ${JSON.stringify(source)}`);
            } else {
                const body = { name: 'OverdueQuery', from: 'csr', sessionId: chatId || CommonMethod.makeSessionId(), formData: { key } };
                logger && logger.InfoLog(`[OverdueApiMgr] → 呼叫 API: ${cfg.Url}`);
                logger && logger.InfoLog(`[OverdueApiMgr] → Request Body: ${JSON.stringify(body)}`);
                const resp = await axios.post(cfg.Url, body, {
                    timeout: ExternalConfig.RequestTimeout,
                    headers: { 'Content-Type': 'application/json' }
                });
                logger && logger.InfoLog(`[OverdueApiMgr] ← 回傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
                source = this.parseSource(resp.data);
            }
            const overdue = this.normalize(source, key);
            logger && logger.InfoLog(`[OverdueApiMgr] 查詢結果: overdue=${overdue}`);
            return { overdue };
        } catch (err) {
            logger && logger.AlertLog(`[OverdueApiMgr] 查詢失敗（視為無欠費）：${err && err.message ? err.message : err}`);
            return { overdue: false };
        }
    }

    parseSource(response) {
        const src = response && response.result ? response.result.source : response;
        if (typeof src === 'string') { try { return JSON.parse(src); } catch { return {}; } }
        return src || {};
    }

    normalize(source, key) {
        const rows = Array.isArray(source && source.data) ? source.data : [];
        const record = key
            ? (rows.find(r => String(r.key || '').toUpperCase() === String(key).toUpperCase()) || null)
            : (rows[0] || null);
        return !!(record && record.overdue);
    }
}

module.exports = new OverdueApiMgr();
