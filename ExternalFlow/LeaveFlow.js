const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const AgentFlow = require('./AgentFlow');
const LeaveApplicationApiMgr = require('../Api/LeaveApplicationApiMgr');
const LeaveUploadMgr = require('../Api/LeaveUploadMgr');

const T = wording.LeaveFlow;

// 請假（會籍暫停/延展）流程 — 純 Web 表單式。
//   C010 問請假方式（會籍暫停/會籍延展 HTML 按鈕）→ C015 問身分（本人/代理人）→ C020 分派：
//     本人  → 暫停回 SelfForm 旗標（C030_Self）；延展回 ExtensionForm 旗標（C030_ExtensionSelf）。
//     代理人 → 不論暫停/延展皆交給共用 AgentFlow 處理到底（見 AgentFlow.js），C030_Agent 每輪轉發 askInput，直到子流程結束。
class LeaveFlow extends IntentBaseFlow {
    async C010() {
        this.errorCount = 0;
        return this.reply({
            message: T.StopTypeAsk + this.buildButtons(T.StopTypeButtons),
            messageType: 'Text',
            nextStep: 'C015'
        });
    }

    async C015() {
        const code = this.parseButtonCode(this.askInput, T.StopTypeButtons);
        this.logger.InfoLog(`[${this.FlowName}] C015 請假方式=${code || '(未對到)'}`);

        if (code === '會籍暫停' || code === '會籍延展') {
            this.errorCount = 0;
            this.stopType = code;
            return this.reply({
                message: T.IdentityAsk + this.buildButtons(T.IdentityButtons),
                messageType: 'Text',
                nextStep: 'C020'
            });
        }
        return this.retryOrGiveUp(T.StopTypeInvalid, 'C015', 'Text', T.StopTypeAsk + this.buildButtons(T.StopTypeButtons));
    }

    async C020() {
        const code = this.parseButtonCode(this.askInput, T.IdentityButtons);
        this.logger.InfoLog(`[${this.FlowName}] C020 身分別=${code || '(未對到)'}`);

        if (code === '本人申辦') {
            this.errorCount = 0;
            this.role = 'SELF';
            // 觸發前端自繪對應表單：只回旗標，message 空、isContinuum '1' 續談。
            if (this.stopType === '會籍延展') {
                return this.reply({ message: '', parameters: { [T.ExtensionFormFlag]: T.ExtensionFormFlag }, nextStep: 'C030_ExtensionSelf' });
            }
            return this.reply({ message: '', parameters: { [T.SelfFormFlag]: T.SelfFormFlag }, nextStep: 'C030_Self' });
        }
        if (code === '代理他人申辦') {
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

    // 本人送件：核實 → 打 ECP 建單號（CUS.StopMembership）→ 上傳證明文件 → 回結果。
    async C030_Self() {
        if (this.isCancelAction(this.askInput)) {
            this.logger.InfoLog(`[${this.FlowName}] C030_Self 使用者取消`);
            return this.reply({ message: T.Cancelled, isContinuum: '0' });
        }
        const form = this.parseFormInput(this.askInput);
        const valid = form && typeof form === 'object'
            && (form.contactType === 'phone' || form.contactType === 'email')
            && this.nonEmpty(form.contactValue)
            && this.nonEmpty(form.reason)
            && this.nonEmpty(String(form.months || ''))
            && this.nonEmpty(form.startDate)
            && Array.isArray(form.proof) && form.proof.length > 0;
        if (!valid) {
            this.logger.AlertLog(`[${this.FlowName}] C030_Self 表單核實未過`);
            return this.reply({ message: T.SelfInvalid, isContinuum: '0' });
        }

        this.logger.InfoLog(`[${this.FlowName}] C030_Self 收到表單: ${JSON.stringify(form)}`);
        this.leaveForm = form;
        await this.createLeaveOrder(form);
        return this.reply({ message: T.SelfDone, isContinuum: '0' });
    }

    // 本人送件（會籍延展）：核實 → 打 ECP 建單號（CUS.StopMembership，免附件）→ 回結果。
    async C030_ExtensionSelf() {
        if (this.isCancelAction(this.askInput)) {
            this.logger.InfoLog(`[${this.FlowName}] C030_ExtensionSelf 使用者取消`);
            return this.reply({ message: T.Cancelled, isContinuum: '0' });
        }
        const form = this.parseFormInput(this.askInput);
        const valid = form && typeof form === 'object'
            && this.nonEmpty(String(form.months || ''))
            && this.nonEmpty(form.startDate)
            && this.nonEmpty(form.payType);
        if (!valid) {
            this.logger.AlertLog(`[${this.FlowName}] C030_ExtensionSelf 表單核實未過`);
            return this.reply({ message: T.ExtensionInvalid, isContinuum: '0' });
        }

        this.logger.InfoLog(`[${this.FlowName}] C030_ExtensionSelf 收到表單: ${JSON.stringify(form)}`);
        this.extensionForm = form;
        await this.createExtensionOrder(form);
        return this.reply({ message: T.ExtensionDone, isContinuum: '0' });
    }

    // 寫入請假暫停申請案（CUS.StopMembership）+ 逐一上傳證明文件（建單號）。寫入失敗不中斷對話（使用者已填完），記 AlertLog。
    async createLeaveOrder(form) {
        try {
            const { entityId } = await LeaveApplicationApiMgr.saveApplication({
                memberNo: form.memberNo,
                memberName: form.memberName,
                applyDate: form.applyDate,
                contactType: form.contactType,
                contactValue: form.contactValue,
                reason: form.reason,
                months: form.months,
                startDate: form.startDate,
                membershipStop: T.MembershipStopCode.Pause,
                logger: this.logger
            });
            this.orderNo = entityId;
            if (!entityId) {
                this.logger.AlertLog(`[${this.FlowName}] createLeaveOrder 未取得單號，略過附件上傳`);
                return;
            }
            const refs = Array.isArray(form.proof) ? form.proof : [];
            for (const ref of refs) {
                if (!ref || !ref.fileId) continue;
                const fileBuffer = LeaveUploadMgr.readFile(ref.fileId);
                if (!fileBuffer || !fileBuffer.length) {
                    this.logger.AlertLog(`[${this.FlowName}] 證明文件讀取失敗，略過上傳（fileId=${ref.fileId}）`);
                    continue;
                }
                const uploaded = await LeaveApplicationApiMgr.uploadEntityAttachment({
                    entityId,
                    fileName: ref.fileName || ref.fileId,
                    fileBuffer,
                    contentType: LeaveUploadMgr.mimeFromExt(ref.fileName || ref.fileId),
                    logger: this.logger
                });
                // 上傳到 ECP 成功才清暫存檔；失敗保留，方便之後補上傳或排查。
                if (uploaded) LeaveUploadMgr.removeFile(ref.fileId, this.logger);
            }
        } catch (error) {
            this.logger.AlertLog(`[${this.FlowName}] createLeaveOrder 失敗: ${error && error.stack ? error.stack : error}`);
        }
    }

    // 寫入會籍延展申請案（CUS.StopMembership，U_MembershipStop=E）。延展免附件，建單即完成。
    async createExtensionOrder(form) {
        try {
            const { entityId } = await LeaveApplicationApiMgr.saveApplication({
                memberNo: form.memberNo,
                memberName: form.memberName,
                applyDate: form.applyDate,
                months: form.months,
                startDate: form.startDate,
                payType: form.payType,
                fee: form.amount,
                membershipStop: T.MembershipStopCode.Extend,
                logger: this.logger
            });
            this.orderNo = entityId;
            if (!entityId) {
                this.logger.AlertLog(`[${this.FlowName}] createExtensionOrder 未取得單號`);
            }
        } catch (error) {
            this.logger.AlertLog(`[${this.FlowName}] createExtensionOrder 失敗: ${error && error.stack ? error.stack : error}`);
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
            stopType: this.stopType,
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

module.exports = LeaveFlow;
