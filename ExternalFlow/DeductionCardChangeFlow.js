const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');
const ExternalConfig = require('../ExternalConfig');
const DeductionCardChangeUploadMgr = require('../Api/DeductionCardChangeUploadMgr');

const P = wording.DeductionCardChange;
const MOBILE_PATTERN = /^09\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 打進 ECP 的附件顯示名稱固定用這個（PM 已確認），不用使用者原始上傳檔名；副檔名沿用原始檔案的副檔名。
const AUTH_LETTER_DISPLAY_NAME = '信用卡授權書';

// 扣款卡片變更申請（FF-05-02）：由「扣款卡片資訊」查詢頁的導覽按鈕送出固定文字直接跳轉進本流程
// （免返回上層選單，PM 已確認），C010 回 parameters:{ DeductionCardChangeForm:'DeductionCardChangeForm' }，
// 由前端 FormFlow.js 攔截並開啟 DeductionCardChangeForm.js 的表單；使用者填完送出（或取消）後，
// FormFlow 把表單 values（或 {action:'CANCEL'}）當 ask_input 送回，本流程在 C020 收下並驗證/受理。
class DeductionCardChangeFlow extends IntentBaseFlow {
    async C010() {
        this.logger.InfoLog(`[${this.FlowName}] C010 進入扣款卡片變更申請`);
        const memberKey = this.customerData && this.customerData.memberKey;
        const overdueNotice = await this.checkOverdueNotice({ key: memberKey });
        const parts = [overdueNotice, P.BlueNotice, P.RedNotice].filter(Boolean);
        return this.reply({ message: parts.join('\n\n'), parameters: { [P.FormFlag]: P.FormFlag }, nextStep: 'C020' });
    }

    async C020() {
        if (this.isCancelAction(this.askInput)) {
            this.logger.InfoLog(`[${this.FlowName}] C020 使用者取消`);
            return this.reply({ message: P.Cancelled, isContinuum: '0' });
        }

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
        await this.submitAndUploadAuthLetter(payload);
        return this.reply({ message: P.SubmitDone, isContinuum: '0' });
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
}

module.exports = DeductionCardChangeFlow;
