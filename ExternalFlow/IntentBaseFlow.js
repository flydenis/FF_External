const BaseFlow = require('./BaseFlow');
const ExternalText = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');

// 業務流程基底：擴充點（錯誤語意對應、共用查詢、Web 按鈕組裝等）。依情境增補。
class IntentBaseFlow extends BaseFlow {
    Excetion(error) {
        this.logger.AlertLog('flow exception: ' + (error && error.message));
        return { isContinuum: '0', messageType: 'Text', message: ExternalText.Public.ReturnSystemErrorMessage };
    }

    // 共用欠費檢查：供任何「申請/送單」類流程在開場節點呼叫。有欠費才回提醒文字，
    // 無欠費或查詢失敗回空字串——僅提示、不擋收單，流程本身照樣往下走。
    async checkOverdueNotice({ key }) {
        const result = await ai3Api.queryOverdue({ chatId: this.chatId, key, logger: this.logger });
        return result && result.overdue ? ExternalText.Public.OverdueNotice : '';
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
