const axios = require('axios');
const path = require('path');
const fs = require('fs');
const ExternalConfig = require('../ExternalConfig');
const CommonMethod = require('../ExternalMethod/CommonMethod');

// 查「會籍合約異動申辦初始頁資料」（需求書 API 總覽 ① 第 10 項：合約編號、原卡別、原會員資格、原可用分館）。
// Product/development → 呼叫客戶 API；Qbi → 讀本機 data/ mock。
// TODO(客戶提供)：客戶尚未提供本 API 規格。mock 欄位（cardName／membership／storeCode／contractStatus 皆為規格代碼）
// 是依需求書代碼表自訂的假設格式，待 API 到位後對照欄位調整 normalize()。
class ChangeMembershipInitApiMgr {
    async query({ chatId, key, logger }) {
        const cfg = (ExternalConfig.ChangeMembershipInitQuery && ExternalConfig.ChangeMembershipInitQuery[ExternalConfig.Mode]) || {};
        const started = Date.now();

        let source;
        if (ExternalConfig.Mode === 'Qbi') {
            // 防 Path Manipulation（CWE-22）：只讀 data/ 目錄、檔名取 basename，確認解析後未逸出 data/。
            const dataDir = path.join(__dirname, '..', 'data');
            const filePath = path.join(dataDir, path.basename(cfg.Url || ''));
            if (filePath !== dataDir && !filePath.startsWith(dataDir + path.sep)) {
                throw new Error('invalid Qbi data path');
            }
            logger && logger.InfoLog(`[ChangeMembershipInitApiMgr] → 讀本機 mock: ${filePath}`);
            source = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            logger && logger.InfoLog(`[ChangeMembershipInitApiMgr] ← mock 回傳（${Date.now() - started}ms）Body: ${JSON.stringify(source)}`);
        } else {
            const body = { name: 'ChangeMembershipInit', from: 'csr', sessionId: chatId || CommonMethod.makeSessionId(), formData: { key } };
            logger && logger.InfoLog(`[ChangeMembershipInitApiMgr] → 呼叫 API: ${cfg.Url}`);
            logger && logger.InfoLog(`[ChangeMembershipInitApiMgr] → Request Body: ${JSON.stringify(body)}`);
            const resp = await axios.post(cfg.Url, body, {
                timeout: ExternalConfig.RequestTimeout,
                headers: { 'Content-Type': 'application/json' }
            });
            logger && logger.InfoLog(`[ChangeMembershipInitApiMgr] ← 回傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
            source = this.parseSource(resp.data);
        }
        const result = this.normalize(source, key);
        logger && logger.InfoLog(`[ChangeMembershipInitApiMgr] 解析結果: found=${result.found}`);
        return result;
    }

    parseSource(response) {
        const src = response && response.result ? response.result.source : response;
        if (typeof src === 'string') { try { return JSON.parse(src); } catch { return {}; } }
        return src || {};
    }

    // 依 status_code 判無資料，否則取符合 key 的會員。沒有 key 時一律視為查無，避免誤帶其他會員的資料。
    normalize(source, key) {
        const code = String((source && (source.status_code ?? source.statusCode)) || '');
        if (code === '0002' || !key) return { found: false, record: null };
        const rows = Array.isArray(source && source.data) ? source.data : [];
        const record = rows.find(r => String(r.key || '').toUpperCase() === String(key).toUpperCase()) || null;
        return { found: !!record, record };
    }
}

module.exports = new ChangeMembershipInitApiMgr();
