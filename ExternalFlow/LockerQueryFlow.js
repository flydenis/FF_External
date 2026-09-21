const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const L = wording.LockerInfo;

// 鞋櫃租賃資訊查詢：使用者按下「鞋櫃租賃資訊查詢」後直接進本節點，一次查詢、一次回覆（可能多張卡片），
// 無多輪輸入，故 isContinuum 皆為 '0'（回覆後交還主流程）。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值；
// 目前尚無正式 API，Qbi 模式讀 data/LockerQbiResponse.json 假資料展示效果。
class LockerQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢鞋櫃租賃資訊 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryLockerRental({ chatId: this.chatId, key: memberKey, logger: this.logger });
        if (!result.found) {
            return this.reply({ message: L.NotFound, isContinuum: '0' });
        }
        return this.reply({ message: L.buildCards(result.records), isContinuum: '0' });
    }
}

module.exports = LockerQueryFlow;
