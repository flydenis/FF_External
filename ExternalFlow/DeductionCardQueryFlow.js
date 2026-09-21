const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const P = wording.DeductionCard;

// 查詢扣款卡片資訊：使用者在主流程按下「扣款卡片資訊」後直接進本節點，一次查詢、一次回覆卡片（isContinuum '0'）。
// PM 已確認先只處理單一合約情境，多合約待之後有需求再補選擇節點（可比照 PaymentHistoryQueryFlow）。
// 卡片下方「前往扣款卡片變更」按鈕：PM 已確認點擊後是送出固定文字（ChangeButtonSubmit）讓平台依既有意圖設定
// 重新路由到對應流程，本流程只負責把按鈕組出來，不接後續步驟。
// TODO(客戶提供)：客戶尚未提供本查詢 API，目前用 Api/DeductionCardApiMgr.js 的 Qbi mock 資料先行開發，
// 待客戶 API 到位後對照欄位調整 normalize()。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class DeductionCardQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢扣款卡片資訊 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryDeductionCard({ chatId: this.chatId, key: memberKey, logger: this.logger });
        if (!result.found) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }

        return this.reply({ message: P.buildCard(result.record) + P.buildChangeButton(), isContinuum: '0' });
    }
}

module.exports = DeductionCardQueryFlow;
