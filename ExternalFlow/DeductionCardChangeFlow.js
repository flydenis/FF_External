const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');
const ExternalConfig = require('../ExternalConfig');
const AgentFlow = require('./AgentFlow');
const DeductionCardChangeUploadMgr = require('../Api/DeductionCardChangeUploadMgr');

const P = wording.DeductionCardChange;
const MOBILE_PATTERN = /^09\d{8}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// 打進 ECP 的附件顯示名稱固定用這個（PM 已確認），不用使用者原始上傳檔名；副檔名沿用原始檔案的副檔名。
const AUTH_LETTER_DISPLAY_NAME = '信用卡授權書';

// 扣款卡片變更申請（FF-05-02）：由「扣款卡片資訊」查詢頁的導覽按鈕送出固定文字直接跳轉進本流程
// （免返回上層選單，PM 已確認），C010 問身分（本人／代理人 HTML 按鈕，比照 PersonalDataChangeFlow 等
// 其他申辦類流程的做法）→ C020 分派：
//   本人  → 回 DeductionCardChangeForm 旗標（藍字／紅字提示語同一則 message 先渲染成對話泡泡），
//           C030_Self 收表單送件（原本 C010/C020 的邏輯整段搬過來）。
//   代理人 → 交給共用 AgentFlow 處理到底（見 AgentFlow.js），C030_Agent 每輪轉發 askInput，直到子流程結束。
class DeductionCardChangeFlow extends IntentBaseFlow {
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
            const parts = [overdueNotice, P.BlueNotice, P.RedNotice].filter(Boolean);
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
        await this.submitAndUploadAuthLetter(payload);
        return this.reply({ message: P.SubmitDone, isContinuum: '0' });
    }

    // 代理人轉發節點：把每輪 askInput 轉給共用 AgentFlow 實例，直到其回 isContinuum:'0'。
    async C030_Agent() {
        this.agentFlow.askInput = this.askInput;
        this.agentFlow.askPlatform = this.askPlatform;
        this.agentFlow.logger = this.logger;
        return this.agentFlow[this.agentFlow.currentStep]();
    }

    // 受理送出 + 上傳信用卡授權書附件（比照 PersonalDataChangeFlow.submitAndUploadIdCard 的作法：
    // 附件走 /DeductionCardChangeUpload 暫存於 uploads/，這裡依 fileId 讀回實際 bytes 上傳，成功才清暫存檔）。
    // 取不到 entityId 或附件讀取失敗都只記 AlertLog、不中斷流程——使用者的申請本身已受理，
    // 附件掛不上去屬於可事後補救的個案，不應讓使用者卡在對話裡。
    async submitAndUploadAuthLetter(payload) {
        const result = await ai3Api.submitDeductionCardChange({ chatId: this.chatId, applyData: payload, logger: this.logger });
        const authLetterFiles = Array.isArray(payload.authLetterFiles) ? payload.authLetterFiles : [];
        if (!authLetterFiles.length) return;

        const entityId = result && result.entityId;
        if (!entityId) {
            this.logger.AlertLog(`[${this.FlowName}] submitAndUploadAuthLetter 未取得 entityId，略過授權書附件上傳`);
            return;
        }

        for (const ref of authLetterFiles) {
            if (!ref || !ref.fileId) continue;
            const fileBuffer = DeductionCardChangeUploadMgr.readFile(ref.fileId);
            if (!fileBuffer || !fileBuffer.length) {
                this.logger.AlertLog(`[${this.FlowName}] 附件讀取失敗，略過上傳（fileId=${ref.fileId}）`);
                continue;
            }
            // 副檔名沿用原始上傳檔名判斷 content-type，但送進 ECP 的顯示檔名固定用 AUTH_LETTER_DISPLAY_NAME，
            // 不論使用者手機/相簿裡原始檔名叫什麼（如 IMG_1234.jpg），ECP 端看到的都是「信用卡授權書.jpg」。
            const originalName = ref.fileName || ref.fileId;
            const ext = (String(originalName).match(/\.[^.]+$/) || ['.jpg'])[0];
            const fileName = `${AUTH_LETTER_DISPLAY_NAME}${ext}`;
            const uploaded = await ai3Api.uploadDeductionCardChangeAttachment({
                entityId,
                fileName,
                fileBuffer,
                contentType: DeductionCardChangeUploadMgr.mimeFromExt(originalName),
                logger: this.logger
            });
            // 上傳到 ECP 成功才清暫存檔；失敗保留，方便之後補上傳或排查。
            if (uploaded) DeductionCardChangeUploadMgr.removeFile(ref.fileId, this.logger);
        }
    }

    // 依【功能說明】檢核：受理通知聯絡方式擇一格式正確、須上傳填妥之信用卡授權書。
    validate(payload) {
        if (!payload || typeof payload !== 'object') return P.MissingContact;

        const contactType = payload.contactType;
        const contactValue = String(payload.contactValue || '').trim();
        const contactOk = (contactType === 'phone' && MOBILE_PATTERN.test(contactValue)) ||
            (contactType === 'email' && EMAIL_PATTERN.test(contactValue));
        if (!contactOk) return P.MissingContact;

        const authLetterFiles = Array.isArray(payload.authLetterFiles) ? payload.authLetterFiles : [];
        if (authLetterFiles.length === 0) return P.MissingAuthLetter;

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

module.exports = DeductionCardChangeFlow;
