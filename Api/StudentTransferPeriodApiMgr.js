const ExternalConfig = require('../ExternalConfig');
const ChainseaApiMgr = require('./ChainseaApiMgr');
const StudentTransferRule = require('../ExternalMethod/StudentTransferRule');

// 學生寒暑假轉館期間參數（FF-04-02）：從 ECP 參數單元（預設 CUS.StudentTransferPeriod，健工自行維護）讀取。
//   一筆＝一個期間：FName 期間名稱（單元內建名稱欄位）、U_OpenFrom／U_OpenTo 開放顯示起迄、U_ActFrom／U_ActTo 啟用日起迄、U_Enabled 啟用。
//   查詢走 ECP 既有的 getListData（與 ChainseaApiMgr 讀對話紀錄同一套機制），只讀不寫。
//   讀不到（未設 EcpApi.Url、連線失敗、沒有啟用中且日期完整的期間）→ 回 ExternalConfig 預設值展開後的期間，並記 AlertLog。
class StudentTransferPeriodApiMgr {
    async getPeriods({ today, logger }) {
        const settings = (ExternalConfig.ChangeMembership && ExternalConfig.ChangeMembership.Student) || {};
        const fromEcp = await this.queryEcp(settings.PeriodUnit, logger);
        if (fromEcp.length) return { periods: fromEcp, source: 'ECP' };
        return { periods: StudentTransferRule.expandDefaultPeriods(settings.DefaultPeriods, today), source: 'Config' };
    }

    async queryEcp(unit, logger) {
        const base = (ExternalConfig.EcpApi && ExternalConfig.EcpApi.Url) || '';
        if (!base || !unit) return [];
        const body = {
            fieldNames: ['FName', 'U_OpenFrom', 'U_OpenTo', 'U_ActFrom', 'U_ActTo', 'U_Enabled'],
            conditions: [],
            order: ['U_ActFrom asc']
        };
        const resp = await ChainseaApiMgr.post(`${base}${unit}.getListData.data`, body, logger);
        const periods = this.rows(resp)
            .filter(r => this.isEnabled(r.U_Enabled))
            .map(r => ({
                name: r.FName || '',
                openFrom: StudentTransferRule.normalizeDate(r.U_OpenFrom),
                openTo: StudentTransferRule.normalizeDate(r.U_OpenTo),
                actFrom: StudentTransferRule.normalizeDate(r.U_ActFrom),
                actTo: StudentTransferRule.normalizeDate(r.U_ActTo)
            }))
            .filter(StudentTransferRule.isValidPeriod);
        if (!periods.length) logger && logger.AlertLog(`[StudentTransferPeriodApiMgr] ECP ${unit} 沒有可用的期間，改用 ExternalConfig 預設值`);
        return periods;
    }

    // getListData 回應的資料列：ECP 實測為 { data:{ records:[...] } }（2026-10-06 讀 CUS.ChangeMembership 確認）；
    // 另容忍 { data:[...] }／陣列／{ result:{ data } } 幾種包法。
    rows(resp) {
        if (!resp) return [];
        if (Array.isArray(resp)) return resp;
        if (resp.data && Array.isArray(resp.data.records)) return resp.data.records;
        if (Array.isArray(resp.data)) return resp.data;
        if (resp.result && Array.isArray(resp.result.data)) return resp.result.data;
        return [];
    }

    // 勾選框在 ECP 可能回 1／'1'／true／'true'／'Y'。
    isEnabled(v) {
        return v === 1 || v === true || ['1', 'true', 'Y'].includes(String(v));
    }
}

module.exports = new StudentTransferPeriodApiMgr();
