const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const M = wording.MemberInfo;

// 會員體驗資訊查詢：使用者在主流程按下「會員資料查詢」後直接進本節點，
// 一次查詢、一次回覆卡片，無多輪輸入，故 isContinuum 皆為 '0'（回覆後交還主流程）。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class MemberInfoQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢會員體驗資訊 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryMemberInfo({ chatId: this.chatId, key: memberKey, logger: this.logger });
        if (!result.found) {
            return this.reply({ message: M.NotFound, isContinuum: '0' });
        }
        return this.reply({ message: M.buildCard(result.record), isContinuum: '0' });
    }
}

module.exports = MemberInfoQueryFlow;
