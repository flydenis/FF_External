const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const AgentFlow = require('./AgentFlow');

const T = wording.LeaveFlow;

// 請假（會籍暫停/延展）流程 — 純 Web 表單式。
//   C010 問身分（本人/代理人 HTML 按鈕）→ C020 分派：
//     本人  → 回 SelfForm 旗標，C030_Self 收表單送件。
//     代理人 → 交給共用 AgentFlow 處理到底（見 AgentFlow.js），C030_Agent 每輪轉發 askInput，直到子流程結束。
class LeaveFlow extends IntentBaseFlow {
    async C010() {
        this.errorCount = 0;
        return this.reply({
            message: T.IdentityAsk + this.buildButtons(T.IdentityButtons),
            messageType: 'Text',
            nextStep: 'C020'
        });
    }

    async C020() {
        const code = this.parseButtonCode(this.askInput, T.IdentityButtons);
        this.logger.InfoLog(`[${this.FlowName}] C020 身分別=${code || '(未對到)'}`);

        if (code === 'SELF') {
            this.errorCount = 0;
            this.role = 'SELF';
            // 觸發前端自繪本人表單：只回旗標，message 空、isContinuum '1' 續談。
            return this.reply({ message: '', parameters: { [T.SelfFormFlag]: T.SelfFormFlag }, nextStep: 'C030_Self' });
        }
        if (code === 'AGENT') {
            this.errorCount = 0;
            this.role = 'AGENT';
            this.agentFlow = new AgentFlow({
                args: { ...this.delegateArgs(), applicationType: T.ApplicationType, toAgentValue: T.ToAgentValue },
                res: this.res
            });
            this.currentStep = 'C030_Agent';
            return this.agentFlow.A010();
        }
        return this.retryOrGiveUp(T.IdentityInvalid, 'C020', 'Text', T.IdentityAsk + this.buildButtons(T.IdentityButtons));
    }

    // 本人送件：核實 → 打 ECP 建單號 → 回結果。
    // TODO(你提供)：本人表單的欄位、核實規則、建單號要打的 ECP API 尚未確認；先接好結構（收表單→回完成），給我後補上。
    async C030_Self() {
        if (this.isCancelAction(this.askInput)) {
            this.logger.InfoLog(`[${this.FlowName}] C030_Self 使用者取消`);
            return this.reply({ message: T.Cancelled, isContinuum: '0' });
        }
        const form = this.parseFormInput(this.askInput);
        if (!form || typeof form !== 'object') {
            this.logger.AlertLog(`[${this.FlowName}] C030_Self 表單解析失敗`);
            return this.reply({ message: T.SelfInvalid, isContinuum: '0' });
        }
        this.logger.InfoLog(`[${this.FlowName}] C030_Self 收到表單: ${JSON.stringify(form)}`);
        return this.reply({ message: T.SelfDone, isContinuum: '0' });
    }

    // 代理人轉發節點：把每輪 askInput 轉給共用 AgentFlow 實例，直到其回 isContinuum:'0'。
    async C030_Agent() {
        this.agentFlow.askInput = this.askInput;
        this.agentFlow.askPlatform = this.askPlatform;
        this.agentFlow.logger = this.logger;
        return this.agentFlow[this.agentFlow.currentStep]();
    }

    getState() {
        return { role: this.role, ...(this.agentFlow ? this.agentFlow.getState() : {}) };
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

module.exports = LeaveFlow;
