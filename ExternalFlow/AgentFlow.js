const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const AgentApplicationApiMgr = require('../Api/AgentApplicationApiMgr');
const AgentUploadMgr = require('../Api/AgentUploadMgr');

const T = wording.AgentFlow;

// 共用「代理他人申辦」子流程（純 Web 表單式）：供各申請流程（LeaveFlow…）在使用者選「代理他人申辦」後呼叫，
// 讓代理人這段只維護一支、多流程共用；要調整只改這裡，不怕漏改。
// 呼叫端傳入：applicationType（寫入 CUS.AgentApplication 的申辦類型）、toAgentValue（轉專人 parameters 的 value，
//   標明是哪支外部流程呼叫，如 'ToAgentOfLeaveFlow'；之後打 ECP 也會用到此值）。
//   A010 觸發前端自繪代理人表單（parameters:{ AgentForm:'AgentForm' }、message 空、isContinuum '1'）。
//   A020 收表單 JSON → 一次核實 → 打 ECP 建單號（不回單號給前端）→ 回「轉專人」完成 + parameters:{ ToAgent: toAgentValue }。
// 呼叫慣例（接管到底）：呼叫端 new AgentFlow({args:{...原args, applicationType, toAgentValue}, res}).A010() 取首輪回覆，
//   之後每輪把 askInput 同步進本實例、呼叫 this[this.currentStep]()，直到 isContinuum:'0'。
class AgentFlow extends IntentBaseFlow {
    constructor({ args, res }) {
        super({ args, res });
        this.applicationType = args && args.applicationType;
        this.toAgentValue = (args && args.toAgentValue) || '';
        this.currentStep = 'A010';
    }

    async A010() {
        this.errorCount = 0;
        return this.reply({ message: '', parameters: { [T.FormFlag]: T.FormFlag }, nextStep: 'A020' });
    }

    async A020() {
        if (this.isCancelAction(this.askInput)) {
            this.logger.InfoLog(`[${this.FlowName}] A020 使用者取消`);
            return this.reply({ message: T.Cancelled, isContinuum: '0' });
        }

        const form = this.parseFormInput(this.askInput);
        const valid = form && typeof form === 'object'
            && !!form.notice
            && this.nonEmpty(form.agentName)
            && this.nonEmpty(form.agentPhone)
            && this.nonEmpty(form.memberInfo)
            && form.uploaded
            && T.Uploads.every(u => !!form.uploaded[u.code]);
        if (!valid) {
            this.logger.InfoLog(`[${this.FlowName}] A020 核實未過`);
            return this.reply({ message: T.Invalid, isContinuum: '0' });
        }

        this.agentName = form.agentName;
        this.agentPhone = form.agentPhone;
        this.memberInfo = form.memberInfo;
        await this.createOrder(form);

        // 依需求不回傳單號，只帶「轉專人」parameters：固定 key ToAgent + 呼叫端帶入的 value。
        return this.reply({ message: T.Done, isContinuum: '0', parameters: { [T.ToAgentKey]: this.toAgentValue } });
    }

    // 寫入代理人申請案 + 逐一上傳附件（建單號）。寫入失敗不中斷對話（使用者已填完），記 AlertLog。
    async createOrder(form) {
        try {
            const { entityId } = await AgentApplicationApiMgr.saveApplication({
                applicationType: this.applicationType,
                agentName: form.agentName,
                agentPhone: form.agentPhone,
                agentIdDocUploaded: !!(form.uploaded && form.uploaded.UPLOAD_AGENT_ID),
                logger: this.logger
            });
            this.orderNo = entityId;
            if (!entityId) {
                this.logger.AlertLog(`[${this.FlowName}] createOrder 未取得單號，略過附件上傳`);
                return;
            }
            for (const u of T.Uploads) {
                const refs = this.normalizeRefs(form.uploaded && form.uploaded[u.code]);
                if (!refs.length) {
                    this.logger.AlertLog(`[${this.FlowName}] 附件 ${u.code} 無檔案內容，略過上傳`);
                    continue;
                }
                for (const ref of refs) {
                    const file = this.resolveUpload(ref);
                    if (!file) {
                        this.logger.AlertLog(`[${this.FlowName}] 附件 ${u.code} 檔案讀取失敗，略過上傳（fileId=${ref && ref.fileId}）`);
                        continue;
                    }
                    const uploaded = await AgentApplicationApiMgr.uploadEntityAttachment({
                        entityId,
                        fileName: file.fileName,
                        fileBuffer: file.fileBuffer,
                        contentType: file.contentType,
                        logger: this.logger
                    });
                    // 上傳到 ECP 成功才清暫存檔；失敗保留，方便之後補上傳或排查。
                    if (uploaded) AgentUploadMgr.removeFile(ref.fileId, this.logger);
                }
            }
        } catch (error) {
            this.logger.AlertLog(`[${this.FlowName}] createOrder 失敗: ${error && error.stack ? error.stack : error}`);
        }
    }

    // 表單送回的上傳欄位是前端呼叫 /AgentUpload 拿到的檔案參考 { fileId, fileName, size }（前端可多選，最多 10 個），
    // 可能是單一物件也可能是陣列；統一成陣列處理。
    normalizeRefs(entry) {
        if (!entry) return [];
        return Array.isArray(entry) ? entry : [entry];
    }

    // 依檔案參考 { fileId, fileName } 回 uploads/agent/ 讀出實際內容（AgentUploadMgr.readFile 已做路徑防護）。
    // 讀不到（fileId 缺漏、檔案不存在、已被清過）回 null，由呼叫端記 log 略過。
    resolveUpload(ref) {
        if (!ref || typeof ref !== 'object' || !ref.fileId) return null;
        const fileBuffer = AgentUploadMgr.readFile(ref.fileId);
        if (!fileBuffer || !fileBuffer.length) return null;
        return { fileBuffer, fileName: ref.fileName || ref.fileId, contentType: AgentUploadMgr.mimeFromExt(ref.fileName || ref.fileId) };
    }

    // 供呼叫端併入 ECP 對話紀錄的狀態快照。
    getState() {
        return {
            applicationType: this.applicationType,
            agentName: this.agentName,
            agentPhone: this.agentPhone,
            memberInfo: this.memberInfo,
            orderNo: this.orderNo
        };
    }
}

module.exports = AgentFlow;
