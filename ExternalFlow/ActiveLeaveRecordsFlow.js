const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const P = wording.ActiveLeaveRecord;

// 當前已生效請假紀錄查詢：使用者按下「當前已生效請假紀錄」後直接進本節點，一次查詢、一次回覆
// （isContinuum '0'）。僅顯示已審核且生效中之 1 筆，查無資料回 NotFound。
// TODO(客戶提供)：客戶尚未提供本查詢 API，目前用 Api/ActiveLeaveRecordApiMgr.js 的 Qbi mock 資料先行開發。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class ActiveLeaveRecordsFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢當前已生效請假紀錄 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryActiveLeaveRecord({ chatId: this.chatId, key: memberKey, logger: this.logger });
        if (!result.found) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }

        const message = P.Intro + P.buildCard(result.record) + `<div style="color:#e5484d;font-size:12px;margin-top:8px;">${P.FooterDisclaimer}</div>`;
        return this.reply({ message, isContinuum: '0' });
    }
}

module.exports = ActiveLeaveRecordsFlow;
