const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');
const ExternalConfig = require('../ExternalConfig');
const AgentFlow = require('./AgentFlow');

const P = wording.InvoiceInfoChange;
const MOBILE_PATTERN = /^09\d{8}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const UNIFIED_PATTERN = /^\d{8}$/;
// 三選一單選互斥（PM 已確認）：mobileBarcode 前端先隱藏不開放勾選，但資料結構先支援，供未來新系統開放使用。
const VALID_TYPES = ['unified', 'memberDevice', 'mobileBarcode'];

// 發票資訊變更申請：C010 問身分（本人／代理人 HTML 按鈕，比照 PersonalDataChangeFlow 等其他申辦類流程的
// 做法）→ C020 分派：
//   本人  → 回 InvoiceInfoChangeForm 旗標（欠費提醒／紅字提示語同一則 message 先渲染成對話泡泡），
//           C030_Self 收表單送件（原本 C010/C020 的邏輯整段搬過來）。
//   代理人 → 交給共用 AgentFlow 處理到底（見 AgentFlow.js），C030_Agent 每輪轉發 askInput，直到子流程結束。
class InvoiceInfoChangeFlow extends IntentBaseFlow {
    async C010() {
        this.errorCount = 0;
        return this.reply({
            message: P.IdentityAsk + this.buildButtons(P.IdentityButtons),
            messageType: 'Text',
            nextStep: 'C020'
        });
    }

    async C020() {
        const code = this.parseButtonCode(this.askInput, P.IdentityButtons);
        this.logger.InfoLog(`[${this.FlowName}] C020 身分別=${code || '(未對到)'}`);

        if (code === 'SELF') {
            this.errorCount = 0;
            this.role = 'SELF';
            const memberKey = this.customerData && this.customerData.memberKey;
            const overdueNotice = await this.checkOverdueNotice({ key: memberKey });
            const parts = [overdueNotice, P.ReminderNotice].filter(Boolean);
            return this.reply({ message: parts.join('\n\n'), parameters: { [P.FormFlag]: P.FormFlag }, nextStep: 'C030_Self' });
        }
        if (code === 'AGENT') {
            this.errorCount = 0;
            this.role = 'AGENT';
            this.agentFlow = new AgentFlow({
                args: { ...this.delegateArgs(), applicationType: P.ApplicationType, toAgentValue: P.ToAgentValue },
                res: this.res
            });
            this.currentStep = 'C030_Agent';
            return this.agentFlow.A010();
        }
        return this.retryOrGiveUp(P.IdentityInvalid, 'C020', 'Text', P.IdentityAsk + this.buildButtons(P.IdentityButtons));
    }

    async C030_Self() {
        if (this.isCancelAction(this.askInput)) {
            this.logger.InfoLog(`[${this.FlowName}] C030_Self 使用者取消`);
            return this.reply({ message: P.Cancelled, isContinuum: '0' });
        }

        let payload = null;
        try { payload = JSON.parse(this.askInput); } catch (e) { payload = null; }

        const errorMessage = this.validate(payload);
        if (errorMessage) {
            this.errorCount++;
            this.logger.InfoLog(`[${this.FlowName}] C030_Self 驗證失敗 errorCount=${this.errorCount}: ${errorMessage}`);
            if (this.errorCount >= (ExternalConfig.ErrorMaxCount || 3)) {
                return this.reply({ message: wording.Public.ReturnSystemErrorMessage, isContinuum: '0' });
            }
            return this.reply({ message: errorMessage, isContinuum: '1', nextStep: 'C030_Self' });
        }

        this.logger.InfoLog(`[${this.FlowName}] C030_Self 申請驗證通過，受理送出`);
        await ai3Api.submitInvoiceInfoChange({ chatId: this.chatId, applyData: payload, logger: this.logger });
        return this.reply({ message: P.SubmitDone, isContinuum: '0' });
    }

    // 代理人轉發節點：把每輪 askInput 轉給共用 AgentFlow 實例，直到其回 isContinuum:'0'。
    async C030_Agent() {
        this.agentFlow.askInput = this.askInput;
        this.agentFlow.askPlatform = this.askPlatform;
        this.agentFlow.logger = this.logger;
        return this.agentFlow[this.agentFlow.currentStep]();
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

    // 供呼叫端併入 ECP 對話紀錄的狀態快照。
    getState() {
        return {
            role: this.role,
            ...(this.agentFlow ? this.agentFlow.getState() : {})
        };
    }

    // 委派子流程用：帶入子流程建構所需原始欄位（FlowName 用 AgentFlow 自己的）。
    delegateArgs() {
        return {
            FlowName: 'AgentFlow',
            chatId: this.chatId,
            askInput: this.askInput,
            askUser: this.askUser,
            askPlatform: this.askPlatform,
            customerData: this.customerData,
            logger: this.logger
        };
    }

    // 比對 Web 按鈕的 submit 值或按鈕文字（HTML 按鈕點擊後平台把 submit 值當 ask_input 回送）。
    parseButtonCode(input, buttons) {
        const raw = String(input == null ? '' : input).trim();
        const hit = (buttons || []).find(b => raw === b.submit || raw === b.label);
        return hit ? hit.submit : null;
    }
}

module.exports = InvoiceInfoChangeFlow;
