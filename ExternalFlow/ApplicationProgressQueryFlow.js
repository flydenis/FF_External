const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const P = wording.ApplicationProgress;

// 合約異動申辦進度查詢（FF-06-01，會籍版）：使用者按下「合約異動申辦進度查詢」後直接進本節點，一次查詢、
// 一次回覆（isContinuum '0'）。兩段資料來源並行查詢後整合顯示（比照流程圖：TO ECP／TO 會員系統 → 整合資料）：
//   第一段：ECP 待處理（不分類，上限 10 筆）。
//   第二段：健身工廠會員系統各類別一年內最近一筆（最多 9 類）。
// PM 已確認本輪只做會籍版（9 類），教練合約異動類別（課程轉讓／課程終止／更換教練）屬於 FF-07-01，這次不做。
// TODO(架構待確認)：ECP 待處理目前沒有單一端點可一次查到所有 CUS.* 申請類型，PM 已確認先用
// Api/EcpPendingApplicationApiMgr.js 的 Qbi mock 假設已整合好的結果，待確認真正查詢機制後再調整。
// TODO(客戶提供)：健身工廠會員系統各類別最近一筆，客戶尚未提供 API，用 Api/MemberSystemApplicationApiMgr.js
// 的 Qbi mock 先行開發。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class ApplicationProgressQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢合約異動申辦進度 memberKey=${memberKey || '(未帶入)'}`);

        const [pendingResult, memberSystemResult] = await Promise.all([
            ai3Api.queryEcpPendingApplications({ chatId: this.chatId, key: memberKey, logger: this.logger }),
            ai3Api.queryMemberSystemApplications({ chatId: this.chatId, key: memberKey, logger: this.logger })
        ]);

        const pendingApplications = (pendingResult.found && pendingResult.record && Array.isArray(pendingResult.record.applications))
            ? pendingResult.record.applications.slice(0, 10) : [];
        const memberSystemApplications = (memberSystemResult.found && memberSystemResult.record && Array.isArray(memberSystemResult.record.applications))
            ? memberSystemResult.record.applications.slice(0, 9) : [];

        if (!pendingApplications.length && !memberSystemApplications.length) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }

        // 第一段是 ECP 端已簡化過的字面狀態（待處理／已送單），不用再轉換；第二段要依代碼查 MemberSystemStatusLabel。
        const tier1 = P.buildSection(P.Tier1Title, pendingApplications, r => r.status || '');
        const tier2 = P.buildSection(P.Tier2Title, memberSystemApplications, r => P.MemberSystemStatusLabel[String(r.statusCode)] || r.statusCode || '');

        return this.reply({ message: P.Intro + tier1 + tier2, isContinuum: '0' });
    }
}

module.exports = ApplicationProgressQueryFlow;
