const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');
const ExternalConfig = require('../ExternalConfig');

const P = wording.InvoiceInfoChange;
const MOBILE_PATTERN = /^09\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIFIED_PATTERN = /^\d{8}$/;
// 三選一單選互斥（PM 已確認）：mobileBarcode 前端先隱藏不開放勾選，但資料結構先支援，供未來新系統開放使用。
const VALID_TYPES = ['unified', 'memberDevice', 'mobileBarcode'];

// 發票資訊變更申請：C010 回固定提示語，由前端 invoice-info-change-form.js 監看比對後彈出表單；
// 使用者在表單送出後，前端把整份表單 JSON 當 ask_input 送回，本流程在 C020 收下並驗證/受理。
class InvoiceInfoChangeFlow extends IntentBaseFlow {
    async C010() {
        this.logger.InfoLog(`[${this.FlowName}] C010 進入發票資訊變更申請`);
        const memberKey = this.customerData && this.customerData.memberKey;
        const overdueNotice = await this.checkOverdueNotice({ key: memberKey });
        const parts = [overdueNotice, P.ReminderNotice, P.OpenMarker].filter(Boolean);
        return this.reply({ message: parts.join('\n\n'), isContinuum: '1', nextStep: 'C020' });
    }

    async C020() {
        let payload = null;
        try { payload = JSON.parse(this.askInput); } catch (e) { payload = null; }

        const errorMessage = this.validate(payload);
        if (errorMessage) {
            this.errorCount++;
            this.logger.InfoLog(`[${this.FlowName}] C020 驗證失敗 errorCount=${this.errorCount}: ${errorMessage}`);
            if (this.errorCount >= (ExternalConfig.ErrorMaxCount || 3)) {
                return this.reply({ message: wording.Public.ReturnSystemErrorMessage, isContinuum: '0' });
            }
            return this.reply({ message: errorMessage, isContinuum: '1', nextStep: 'C020' });
        }

        this.logger.InfoLog(`[${this.FlowName}] C020 申請驗證通過，受理送出`);
        await ai3Api.submitInvoiceInfoChange({ chatId: this.chatId, applyData: payload, logger: this.logger });
        return this.reply({ message: P.SubmitDone, isContinuum: '0' });
    }

    // 依【功能說明】檢核：三選一（單選）且有填值、統一編號需 8 碼數字、聯絡方式擇一格式正確。
    validate(payload) {
        if (!payload || typeof payload !== 'object') return P.MissingSelection;

        const type = payload.type;
        const value = String(payload.value || '').trim();
        if (!VALID_TYPES.includes(type) || !value) return P.MissingSelection;
        if (type === 'unified' && !UNIFIED_PATTERN.test(value)) return P.InvalidUnified;

        const contactType = payload.contactType;
        const contactValue = String(payload.contactValue || '').trim();
        const contactOk = (contactType === 'phone' && MOBILE_PATTERN.test(contactValue)) ||
            (contactType === 'email' && EMAIL_PATTERN.test(contactValue));
        if (!contactOk) return P.InvalidContact;

        return null;
    }
}

module.exports = InvoiceInfoChangeFlow;
