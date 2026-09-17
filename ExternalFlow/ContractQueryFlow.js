const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

const P = wording.Contract;

// 會籍合約資料查詢（FF-04-00）：使用者在主流程按下「會籍合約資料查詢」後直接進本節點，一次查詢、一次回覆
// （isContinuum '0'）。PM 已確認顯示最近兩筆合約時直接一次全部顯示，不用像 PaymentHistoryQueryFlow 那樣
// 先列清單讓使用者選一筆。
// TODO(客戶提供)：客戶尚未提供本查詢 API，目前用 Api/ContractApiMgr.js 的 Qbi mock 資料先行開發，
// 待客戶 API 到位後對照欄位調整 normalize()。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
// 備註：規格【功能說明】2. 提到行政終止合約後續所有查詢/申請都要擋下，PM 已確認本輪先只做查詢本身
// （行政終止合約狀態欄位已依規格顯示「合約欠款，請洽會員服務中心」），是否回頭串進其他既有流程待之後再議。
class ContractQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢會籍合約資料 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryContract({ chatId: this.chatId, key: memberKey, logger: this.logger });
        const contracts = (result.found && result.record && Array.isArray(result.record.contracts)) ? result.record.contracts : [];
        if (!contracts.length) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }

        // 規格【功能目的】：顯示最近兩筆（含到期／終止／轉讓），供會員回溯查詢舊合約與款項。
        const recent = contracts.slice(0, 2);
        const cards = recent.map(c => P.buildCard(c)).join('');
        return this.reply({ message: P.Intro + cards, isContinuum: '0' });
    }
}

module.exports = ContractQueryFlow;
