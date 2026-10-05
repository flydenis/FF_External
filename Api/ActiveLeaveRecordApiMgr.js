const axios = require('axios');
const path = require('path');
const fs = require('fs');
const ExternalConfig = require('../ExternalConfig');
const CommonMethod = require('../ExternalMethod/CommonMethod');

// 查當前已生效請假紀錄（僅已審核且生效中之 1 筆）。Product/development → 呼叫客戶 API；Qbi → 讀本機 data/ mock。
// TODO(架構待確認)：規格附錄資料字典裡「已生效請假起訖日」（U_StopDuring）屬於 TpCUSmStartMembership
// （提前開啟請假會籍）單元，之後若改走真實 ECP 查詢，可參考已驗證可用的 getListData 機制。
// TODO(PM 確認)：query() 目前用 key 當查詢條件的預留欄位，實際 request 要帶什麼欄位（會員編號對應識別碼）待客戶 API 規格確定後調整。
class ActiveLeaveRecordApiMgr {
    async query({ chatId, key, logger }) {
        const cfg = (ExternalConfig.ActiveLeaveRecordQuery && ExternalConfig.ActiveLeaveRecordQuery[ExternalConfig.Mode]) || {};
        const started = Date.now();

        let source;
        if (ExternalConfig.Mode === 'Qbi') {
            // 防 Path Manipulation（CWE-22）：只讀 data/ 目錄、檔名取 basename，確認解析後未逸出 data/。
            const dataDir = path.join(__dirname, '..', 'data');
            const filePath = path.join(dataDir, path.basename(cfg.Url || ''));
            if (filePath !== dataDir && !filePath.startsWith(dataDir + path.sep)) {
                throw new Error('invalid Qbi data path');
            }
            logger && logger.InfoLog(`[ActiveLeaveRecordApiMgr] → 讀本機 mock: ${filePath}`);
            source = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            // mock 檔只存「距今幾天」，這裡即時換算成實際日期字串，確保不管哪天測試，
            // 這筆「當前已生效」的請假紀錄起訖日都會涵蓋今天，不會因為時間經過變成過去式。
            if (Array.isArray(source.data)) {
                source.data = source.data.map(r => this.resolveDates(r));
            }
            logger && logger.InfoLog(`[ActiveLeaveRecordApiMgr] ← mock 回傳（${Date.now() - started}ms）Body: ${JSON.stringify(source)}`);
        } else {
            const body = { name: 'ActiveLeaveRecordQuery', from: 'csr', sessionId: chatId || CommonMethod.makeSessionId(), formData: { key } };
            logger && logger.InfoLog(`[ActiveLeaveRecordApiMgr] → 呼叫 API: ${cfg.Url}`);
            logger && logger.InfoLog(`[ActiveLeaveRecordApiMgr] → Request Body: ${JSON.stringify(body)}`);
            const resp = await axios.post(cfg.Url, body, {
                timeout: ExternalConfig.RequestTimeout,
                headers: { 'Content-Type': 'application/json' }
            });
            logger && logger.InfoLog(`[ActiveLeaveRecordApiMgr] ← 回傳（${Date.now() - started}ms, HTTP ${resp.status}）Body: ${JSON.stringify(resp.data)}`);
            source = this.parseSource(resp.data);
        }
        const result = this.normalize(source, key);
        logger && logger.InfoLog(`[ActiveLeaveRecordApiMgr] 解析結果: found=${result.found}`);
        return result;
    }

    // Qbi mock 專用：把 { leaveStartDaysAgo, leaveEndDaysFromNow } 換算成實際日期字串（YYYY-MM-DD），
    // 讓「請假起訖」跟「合約現行結束日」永遠涵蓋當下（起始日固定在過去、結束日固定在未來）。
    resolveDates(record) {
        if (!record || record.leaveStartDaysAgo == null || record.leaveEndDaysFromNow == null) return record;
        const format = (d) => {
            const p = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        };
        const addDays = (days) => {
            const d = new Date();
            d.setDate(d.getDate() + days);
            return d;
        };
        const { leaveStartDaysAgo, leaveEndDaysFromNow, ...rest } = record;
        const endDate = format(addDays(leaveEndDaysFromNow));
        return {
            ...rest,
            leaveStartDate: format(addDays(-leaveStartDaysAgo)),
            leaveEndDate: endDate,
            contractCurrentEndDate: endDate
        };
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

module.exports = new ActiveLeaveRecordApiMgr();
