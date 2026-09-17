const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ai3Api = require('../ExternalMethod/Ai3Api');
const ExternalConfig = require('../ExternalConfig');
const PersonalDataChangeUploadMgr = require('../Api/PersonalDataChangeUploadMgr');

const P = wording.PersonalDataChange;
const MOBILE_PATTERN = /^09\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 打進 ECP 的附件顯示名稱固定用這組（PM 已確認，比照扣款卡片變更授權書的作法），不用使用者原始上傳檔名；
// 依 PersonalDataChangeForm.js 送出順序固定為 [正面, 反面]（前端已檢查兩者都上傳過才會送出）。
const ID_CARD_DISPLAY_NAMES = ['身分證正面', '身分證反面'];

// 個人資料變更申請：C010 回 parameters:{ PersonalDataChangeForm:'PersonalDataChangeForm' }，
// 由前端 FormFlow.js 攔截並開啟 PersonalDataChangeForm.js 的表單；使用者填完送出（或取消）後，
// FormFlow 把表單 values（或 {action:'CANCEL'}）當 ask_input 送回，本流程在 C020 收下並驗證/受理。
// TODO(PM 確認)：ask_input 表單 JSON 的確切欄位契約與前端一起定案後，如有調整請同步改 validate()。
class PersonalDataChangeFlow extends IntentBaseFlow {
    async C010() {
        this.logger.InfoLog(`[${this.FlowName}] C010 進入個人資料變更申請`);
        const memberKey = this.customerData && this.customerData.memberKey;
        const overdueNotice = await this.checkOverdueNotice({ key: memberKey });
        return this.reply({ message: overdueNotice || '', parameters: { [P.FormFlag]: P.FormFlag }, nextStep: 'C020' });
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
        await this.submitAndUploadIdCard(payload);
        return this.reply({ message: P.SubmitDone, isContinuum: '0' });
    }

    // 受理送出 + 逐一上傳身分證正反面附件（比照 ExternalFlow/AgentFlow.js 的 createOrder 作法：
    // 附件走 /PersonalDataChangeUpload 暫存於 uploads/，這裡依 fileId 讀回實際 bytes 上傳，成功才清暫存檔）。
    // 取不到 entityId 或個別附件讀取失敗都只記 AlertLog、不中斷流程——使用者的申請本身已受理，
    // 附件掛不上去屬於可事後補救的個案，不應讓使用者卡在對話裡。
    async submitAndUploadIdCard(payload) {
        const result = await ai3Api.submitPersonalDataChange({ chatId: this.chatId, applyData: payload, logger: this.logger });
        const idCardFiles = Array.isArray(payload.idCardFiles) ? payload.idCardFiles : [];
        if (!idCardFiles.length) return;

        const entityId = result && result.entityId;
        if (!entityId) {
            this.logger.AlertLog(`[${this.FlowName}] submitAndUploadIdCard 未取得 entityId，略過身分證附件上傳`);
            return;
        }

        for (let i = 0; i < idCardFiles.length; i++) {
            const ref = idCardFiles[i];
            if (!ref || !ref.fileId) continue;
            const fileBuffer = PersonalDataChangeUploadMgr.readFile(ref.fileId);
            if (!fileBuffer || !fileBuffer.length) {
                this.logger.AlertLog(`[${this.FlowName}] 附件讀取失敗，略過上傳（fileId=${ref.fileId}）`);
                continue;
            }
            // 副檔名沿用原始上傳檔名判斷 content-type，但送進 ECP 的顯示檔名固定用正面/反面標籤，
            // 不論使用者手機/相簿裡原始檔名叫什麼，ECP 端看到的都是「身分證正面.jpg」／「身分證反面.jpg」。
            const originalName = ref.fileName || ref.fileId;
            const ext = (String(originalName).match(/\.[^.]+$/) || ['.jpg'])[0];
            const fileName = `${ID_CARD_DISPLAY_NAMES[i] || originalName}${ext}`;
            const uploaded = await ai3Api.uploadPersonalDataChangeAttachment({
                entityId,
                fileName,
                fileBuffer,
                contentType: PersonalDataChangeUploadMgr.mimeFromExt(originalName),
                logger: this.logger
            });
            // 上傳到 ECP 成功才清暫存檔；失敗保留，方便之後補上傳或排查。
            if (uploaded) PersonalDataChangeUploadMgr.removeFile(ref.fileId, this.logger);
        }
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

        if (items.mobile && !MOBILE_PATTERN.test(String(values.mobile || '').trim())) return P.InvalidMobile;

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
