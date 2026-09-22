const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const P = wording.CoachContract;

// 教練合約資料查詢（FF-07-01 子項 1）：使用者按下「教練合約資料查詢」後直接進本節點，一次查詢、一次回覆
// （isContinuum '0'）。多筆合約時比照 LockerQueryFlow／ContractQueryFlow：橫向捲動＋左右箭頭切換。
// 規格【功能說明】3.：僅提供合約狀態已結帳/已審核/到期/請假且尚有剩餘堂數者，本輪先假設 Qbi mock
// 資料本身已是符合資格的結果（比照其他查詢類流程，不在流程內另做狀態分支）。
// TODO(客戶提供)：客戶尚未提供本查詢 API，目前用 Api/CoachContractApiMgr.js 的 Qbi mock 資料先行開發。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class CoachContractQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢教練合約資料 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryCoachContract({ chatId: this.chatId, key: memberKey, logger: this.logger });
        if (!result.found) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }

        return this.reply({ message: P.Intro + P.buildCards(result.records), isContinuum: '0' });
    }
}

module.exports = CoachContractQueryFlow;
