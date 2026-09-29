const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const AgentFlow = require('./AgentFlow');
const PauseEarlyOpenApiMgr = require('../Api/PauseEarlyOpenApiMgr');

const T = wording.PauseEarlyOpenFlow;

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
// 開啟使用日期僅能選申請日 7 天後（同前端 PauseEarlyOpenForm.js 的 minOpenDateISO()）。
function minOpenDateISO() {
    const d = new Date();
    d.setDate(d.getDate() + T.MinOpenDateOffsetDays);
    return toISO(d);
}

// 提前開啟請假會籍申請流程（FF-04-05）— 純 Web 表單式。
//   C010 問身分（本人/代理人 HTML 按鈕）→ C020 分派：
//     本人  → 回 PauseEarlyOpenForm 旗標，C030_Self 收表單送件。
//     代理人 → 交給共用 AgentFlow 處理到底（見 AgentFlow.js），C030_Agent 每輪轉發 askInput，直到子流程結束。
class PauseEarlyOpenFlow extends IntentBaseFlow {
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

    // 本人送件：核實 → 打 ECP 建單號（CUS.StartMembership）→ 回結果。免附件。
    async C030_Self() {
        if (this.isCancelAction(this.askInput)) {
            this.logger.InfoLog(`[${this.FlowName}] C030_Self 使用者取消`);
            return this.reply({ message: T.Cancelled, isContinuum: '0' });
        }
        const form = this.parseFormInput(this.askInput);
        const valid = form && typeof form === 'object'
            && (form.contactType === 'phone' || form.contactType === 'email')
            && this.nonEmpty(form.contactValue)
            && this.nonEmpty(form.contractNo)
            && this.nonEmpty(form.leaveStartDate)
            && this.nonEmpty(form.leaveEndDate)
            && this.nonEmpty(form.openDate) && form.openDate >= minOpenDateISO()
            && this.nonEmpty(form.payType);
        if (!valid) {
            this.logger.AlertLog(`[${this.FlowName}] C030_Self 表單核實未過`);
            return this.reply({ message: T.SelfInvalid, isContinuum: '0' });
        }

        this.logger.InfoLog(`[${this.FlowName}] C030_Self 收到表單: ${JSON.stringify(form)}`);
        this.openForm = form;
        await this.createOrder(form);
        return this.reply({ message: T.SelfDone, isContinuum: '0' });
    }

    // 寫入提前開啟請假會籍申請案（CUS.StartMembership）。寫入失敗不中斷對話（使用者已填完），記 AlertLog。
    async createOrder(form) {
        try {
            const { entityId } = await PauseEarlyOpenApiMgr.saveApplication({
                contractNo: form.contractNo,
                memberNo: form.memberNo,
                memberName: form.memberName,
                applyDate: form.applyDate,
                contactType: form.contactType,
                contactValue: form.contactValue,
                leaveStartDate: form.leaveStartDate,
                leaveEndDate: form.leaveEndDate,
                openDate: form.openDate,
                payType: form.payType,
                logger: this.logger
            });
            this.orderNo = entityId;
            if (!entityId) {
                this.logger.AlertLog(`[${this.FlowName}] createOrder 未取得單號`);
            }
        } catch (error) {
            this.logger.AlertLog(`[${this.FlowName}] createOrder 失敗: ${error && error.stack ? error.stack : error}`);
        }
    }

    // 代理人轉發節點：把每輪 askInput 轉給共用 AgentFlow 實例，直到其回 isContinuum:'0'。
    async C030_Agent() {
        this.agentFlow.askInput = this.askInput;
        this.agentFlow.askPlatform = this.askPlatform;
        this.agentFlow.logger = this.logger;
        return this.agentFlow[this.agentFlow.currentStep]();
    }

    getState() {
        return {
            role: this.role,
            ...(this.role === 'SELF' ? { orderNo: this.orderNo } : {}),
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

module.exports = PauseEarlyOpenFlow;
