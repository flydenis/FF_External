const BaseFlow = require('./BaseFlow');
const ExternalText = require('../ExternalMethod/ExternalText');

// 業務流程基底：擴充點（錯誤語意對應、共用查詢、Web 按鈕組裝等）。依情境增補。
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
}

module.exports = IntentBaseFlow;
