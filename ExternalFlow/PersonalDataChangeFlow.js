const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');
const ExternalConfig = require('../ExternalConfig');

const P = wording.PersonalDataChange;
const MOBILE_PATTERN = /^09\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 個人資料變更申請：C010 回固定提示語，由前端 personal-data-change-form.js 監看比對後彈出表單；
// 使用者在表單送出後，前端把整份表單 JSON 當 ask_input 送回，本流程在 C020 收下並驗證/受理。
// TODO(PM 確認)：ask_input 表單 JSON 的確切欄位契約與前端一起定案後，如有調整請同步改 validate()。
class PersonalDataChangeFlow extends IntentBaseFlow {
    async C010() {
        this.logger.InfoLog(`[${this.FlowName}] C010 進入個人資料變更申請`);
        const memberKey = this.customerData && this.customerData.memberKey;
        const overdueNotice = await this.checkOverdueNotice({ key: memberKey });
        const message = overdueNotice ? `${overdueNotice}\n\n${P.OpenMarker}` : P.OpenMarker;
        return this.reply({ message, isContinuum: '1', nextStep: 'C020' });
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
        await ai3Api.submitPersonalDataChange({ chatId: this.chatId, applyData: payload, logger: this.logger });
        return this.reply({ message: P.SubmitDone, isContinuum: '0' });
    }

    // 依【功能說明】檢核：四選一至少一項且有填值、聯絡方式擇一格式正確、變更戶籍地址/姓名須有身分證正反面。
    validate(payload) {
        if (!payload || typeof payload !== 'object') return P.MissingSelection;

        const items = payload.items || {};
        const values = payload.values || {};
        const selectedKeys = ['mobile', 'householdAddress', 'contactAddress', 'name'].filter(k => items[k]);
        if (selectedKeys.length === 0) return P.MissingSelection;
        const hasEmptyValue = selectedKeys.some(k => !String(values[k] || '').trim());
        if (hasEmptyValue) return P.MissingSelection;

        const contactType = payload.contactType;
        const contactValue = String(payload.contactValue || '').trim();
        const contactOk = (contactType === 'phone' && MOBILE_PATTERN.test(contactValue)) ||
            (contactType === 'email' && EMAIL_PATTERN.test(contactValue));
        if (!contactOk) return P.InvalidContact;

        if (items.householdAddress || items.name) {
            const idCardFiles = Array.isArray(payload.idCardFiles) ? payload.idCardFiles : [];
            if (idCardFiles.length === 0) return P.MissingIdCard;
        }

        return null;
    }
}

module.exports = PersonalDataChangeFlow;
