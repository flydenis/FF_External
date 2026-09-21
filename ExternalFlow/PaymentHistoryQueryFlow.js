const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');
const ExternalConfig = require('../ExternalConfig');

const P = wording.PaymentHistory;

// 帳務查詢及繳款（FF-05-01）：使用者在主流程按下「繳費紀錄」後直接進本節點。
// 單一生效合約 → 一次查詢、一次回覆卡片（isContinuum '0'）；多筆合約 → C010 先讓使用者選合約（HTML 按鈕），
// C020 收選擇結果後回對應合約的卡片。
// TODO(客戶提供)：客戶尚未提供本查詢 API，目前用 Api/PaymentHistoryApiMgr.js 的 Qbi mock 資料先行開發，
// 待客戶 API 到位後對照欄位調整 normalize()。
// TODO(PM 確認)：查詢 key 目前暫由 customerData.memberKey 帶入，實際進線 payload 欄位待確認後調整此處取值。
class PaymentHistoryQueryFlow extends IntentBaseFlow {
    async C010() {
        const memberKey = this.customerData && this.customerData.memberKey;
        this.logger.InfoLog(`[${this.FlowName}] C010 查詢帳務繳款 memberKey=${memberKey || '(未帶入)'}`);

        const result = await ai3Api.queryPaymentHistory({ chatId: this.chatId, key: memberKey, logger: this.logger });
        const contracts = (result.found && result.record && Array.isArray(result.record.contracts)) ? result.record.contracts : [];
        if (!contracts.length) {
            return this.reply({ message: P.NotFound, isContinuum: '0' });
        }

        if (contracts.length === 1) {
            return this.reply({ message: P.Intro + P.buildContractCard(contracts[0]), isContinuum: '0' });
        }

        this.contracts = contracts;
        return this.reply({
            message: P.SelectContractPrompt + this.buildButtons(P.buildSelectButtons(contracts)),
            nextStep: 'C020'
        });
    }

    async C020() {
        const contracts = this.contracts || [];
        const picked = this.parseContractCode(this.askInput, contracts);
        if (!picked) {
            this.errorCount = (this.errorCount || 0) + 1;
            this.logger.InfoLog(`[${this.FlowName}] C020 未選到合約 errorCount=${this.errorCount}`);
            if (this.errorCount >= (ExternalConfig.ErrorMaxCount || 3)) {
                return this.reply({ message: wording.Public.ReturnSystemErrorMessage, isContinuum: '0' });
            }
            return this.reply({
                message: P.SelectContractInvalid + P.SelectContractPrompt + this.buildButtons(P.buildSelectButtons(contracts)),
                nextStep: 'C020'
            });
        }

        this.logger.InfoLog(`[${this.FlowName}] C020 選擇合約 ${picked.contractNo}`);
        return this.reply({ message: P.Intro + P.buildContractCard(picked), isContinuum: '0' });
    }

    // 比對 Web 按鈕的 submit 值（合約編號，HTML 按鈕點擊後平台把 submit 值當 ask_input 回送）。
    parseContractCode(input, contracts) {
        const raw = String(input == null ? '' : input).trim();
        return (contracts || []).find(c => raw === c.contractNo) || null;
    }
}

module.exports = PaymentHistoryQueryFlow;
