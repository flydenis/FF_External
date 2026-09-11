const BaseFlow = require('./BaseFlow');
const ExternalConfig = require('../ExternalConfig');
const ExternalText = require('../ExternalMethod/ExternalText');

// 業務流程基底：擴充點（錯誤語意對應、共用查詢、Web 按鈕組裝、表單頁共用小工具等）。依情境增補。
class IntentBaseFlow extends BaseFlow {
    Excetion(error) {
        this.logger.AlertLog('flow exception: ' + (error && error.message));
        return { isContinuum: '0', messageType: 'Text', message: ExternalText.Public.ReturnSystemErrorMessage };
    }

    // 組 Web 一般 HTML 按鈕：[link submit="值"]<button style="...">文字</button>[/link]，
    // 使用者點擊後平台把 submit 值當 ask_input 回送。buttons: [{label, submit, style}]。
    // 顏色/預設主色改 style 物件（預設用 ExternalText.ButtonStyle）。僅 Web；Phone 該節點走 DTMF。
    buildButtons(buttons, style) {
        const bs = style || ExternalText.ButtonStyle || {};
        const items = (buttons || []).map(b =>
            `[link submit="${b.submit}"]<button style="${bs[b.style] || bs.Secondary || ''}">${b.label}</button>[/link]`
        ).join('');
        return `<div style="${bs.ContainerStyle || ''}">${items}</div>`;
    }

    // 以下為表單頁共用的小工具，供各流程節點共用，避免各自抄一份。

    isCancelAction(input) {
        const raw = String(input == null ? '' : input).trim();
        if (raw === 'CANCEL' || raw === '取消申請') return true;
        try {
            const obj = JSON.parse(raw);
            return obj && obj.action === 'CANCEL';
        } catch (e) {
            return false;
        }
    }

    // 假設：前端表單送出時，ask_input 為 JSON 字串（欄位對應 name）。
    // 若實際契約不同（例如走 customerData），只需調整這裡。
    parseFormInput(input) {
        try {
            return JSON.parse(String(input == null ? '' : input));
        } catch (e) {
            return this.customerData && this.customerData.formData ? this.customerData.formData : null;
        }
    }

    nonEmpty(v) {
        return typeof v === 'string' && v.trim().length > 0;
    }

    // 錯誤重試：把錯誤原因併在原訊息（按鈕/提示）前一行一起送出，讓使用者在同一則訊息
    // 看到錯誤原因與重新輸入的選項；達 ErrorMaxCount 則放棄本次申請並結束對話。
    retryOrGiveUp(reasonMessage, stayStep, messageType, schemaMessage) {
        this.errorCount = (this.errorCount || 0) + 1;
        if (this.errorCount >= ExternalConfig.ErrorMaxCount) {
            return this.reply({ message: ExternalText.Public.GiveUp, isContinuum: '0' });
        }
        this.currentStep = stayStep;
        return this.reply({ message: reasonMessage + '\n' + schemaMessage, messageType });
    }
}

module.exports = IntentBaseFlow;
