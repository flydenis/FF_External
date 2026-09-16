const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const P = wording.PaymentDueDate;

// 查詢月費扣款日：使用者在主流程按下「月費扣款日」後直接進本節點，一次查詢、一次回覆卡片（isContinuum '0'）。
// PM 已確認先只處理單一合約情境，多合約（各合約扣款日可能不同）待之後有需求再補選擇節點（可比照 PaymentHistoryQueryFlow）。
// TODO(客戶提供)：客戶尚未提供本查詢 API，目前用 Api/PaymentDueDateApiMgr.js 的 Qbi mock 資料先行開發，
// 待客戶 API 到位後對照欄位調整 normalize()。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class PaymentDueDateQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢月費扣款日 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryPaymentDueDate({ chatId: this.chatId, key: memberKey, logger: this.logger });
        if (!result.found) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }

        const record = result.record;
        if (record.billingType === 'prepaid') {
            return this.reply({ message: P.PrepaidNote, isContinuum: '0' });
        }

        return this.reply({ message: P.buildCard(record), isContinuum: '0' });
    }
}

module.exports = PaymentDueDateQueryFlow;
