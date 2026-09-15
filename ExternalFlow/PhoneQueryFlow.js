const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const P = wording.Phone;

// 登記電話查詢：使用者在主流程按下「查詢登記電話」後直接進本節點，
// 一次查詢、一次回覆卡片，無多輪輸入，故 isContinuum 皆為 '0'（回覆後交還主流程）。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class PhoneQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢登記電話 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryPhone({ chatId: this.chatId, key: memberKey, logger: this.logger });
        if (!result.found) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }
        return this.reply({ message: P.buildCard(result.record), isContinuum: '0' });
    }
}

module.exports = PhoneQueryFlow;
