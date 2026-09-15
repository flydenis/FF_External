const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const A = wording.ContactAddress;

// 登記地址查詢：使用者在主流程按下「查詢登記地址」後直接進本節點，
// 一次查詢、一次回覆卡片，無多輪輸入，故 isContinuum 皆為 '0'（回覆後交還主流程）。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class ContactAddressQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢登記地址 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryContactAddress({ chatId: this.chatId, key: memberKey, logger: this.logger });
        if (!result.found) {
            return this.reply({ message: A.NotFound, isContinuum: '0' });
        }
        return this.reply({ message: A.buildCard(result.record), isContinuum: '0' });
    }
}

module.exports = ContactAddressQueryFlow;
