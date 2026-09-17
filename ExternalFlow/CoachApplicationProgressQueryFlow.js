const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const P = wording.CoachApplicationProgress;
const Shared = wording.ApplicationProgress;

// 教練合約異動申辦進度查詢（FF-07-01 子項 2）：使用者按下對應按鈕後直接進本節點，一次查詢、一次回覆
// （isContinuum '0'）。PM 已確認本輪只做這個子功能，FF-07-01 的合約 7 欄查詢／帳務繳費紀錄／上課紀錄
// PDF 先不做。
// PM 已確認：結構跟 FF-06-01 會籍版一致，兩段資料來源並行查詢後整合顯示（比照 ApplicationProgressQueryFlow）：
//   第一段：ECP 待處理（不分類，上限 10 筆）。
//   第二段：健身工廠會員系統各類別最近一筆（課程轉讓／課程終止／更換教練，最多 10 筆，同類別可重複出現，
//   不像會籍版每類別只取最新一筆）。狀態代碼轉換沿用 ApplicationProgress.MemberSystemStatusLabel
//   （規格【操作邏輯】會籍與教練共用同一套代碼）。
// TODO(架構待確認)：ECP 待處理段跟會籍版一樣沒有真正的單一查詢端點，PM 已確認先用
// Api/CoachPendingApplicationApiMgr.js 的 Qbi mock。
// TODO(客戶提供)：會員系統段客戶尚未提供 API，用 Api/CoachApplicationApiMgr.js 的 Qbi mock 先行開發。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class CoachApplicationProgressQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢教練合約異動申辦進度 memberKey=${memberKey || '(未帶入)'}`);

        const [pendingResult, memberSystemResult] = await Promise.all([
            ai3Api.queryCoachPendingApplications({ chatId: this.chatId, key: memberKey, logger: this.logger }),
            ai3Api.queryCoachApplications({ chatId: this.chatId, key: memberKey, logger: this.logger })
        ]);

        const pendingApplications = (pendingResult.found && pendingResult.record && Array.isArray(pendingResult.record.applications))
            ? pendingResult.record.applications.slice(0, 10) : [];
        const memberSystemApplications = (memberSystemResult.found && memberSystemResult.record && Array.isArray(memberSystemResult.record.applications))
            ? memberSystemResult.record.applications.slice(0, 10) : [];

        if (!pendingApplications.length && !memberSystemApplications.length) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }

        // 第一段是 ECP 端已簡化過的字面狀態（待處理／已送單），不用再轉換；第二段要依代碼查 MemberSystemStatusLabel。
        const tier1 = Shared.buildSection(P.Tier1Title, pendingApplications, r => r.status || '');
        const tier2 = Shared.buildSection(P.Tier2Title, memberSystemApplications, r => Shared.MemberSystemStatusLabel[String(r.statusCode)] || r.statusCode || '');

        return this.reply({ message: P.Intro + tier1 + tier2, isContinuum: '0' });
    }
}

module.exports = CoachApplicationProgressQueryFlow;
