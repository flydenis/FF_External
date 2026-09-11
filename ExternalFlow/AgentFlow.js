const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const AgentApplicationApiMgr = require('../Api/AgentApplicationApiMgr');

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
                const file = this.resolveUpload(form.uploaded && form.uploaded[u.code], u.label);
                if (!file) {
                    this.logger.AlertLog(`[${this.FlowName}] 附件 ${u.code} 無檔案內容，略過上傳`);
                    continue;
                }
                await AgentApplicationApiMgr.uploadEntityAttachment({
                    entityId,
                    fileName: file.fileName,
                    fileBuffer: file.fileBuffer,
                    contentType: file.contentType,
                    logger: this.logger
                });
            }
        } catch (error) {
            this.logger.AlertLog(`[${this.FlowName}] createOrder 失敗: ${error && error.stack ? error.stack : error}`);
        }
    }

    // 從前端送回的上傳欄位解出檔案 bytes。相容幾種常見形態：
    //   data URL 字串（data:mime;base64,xxx）、純 base64 字串、或物件 { fileName/name, content/base64/data, contentType/type }。
    // 解不出內容（例如只給布林旗標）回 null，由呼叫端記 log 略過。defaultName 為顯示檔名（如「切結書」）。
    // TODO(前端確認)：實際送回的檔案欄位格式敲定後，若與此不同再調整這裡。
    resolveUpload(entry, defaultName) {
        if (!entry || entry === true) return null;
        let fileName = defaultName;
        let contentType;
        let b64 = null;
        if (typeof entry === 'string') {
            b64 = entry;
        } else if (typeof entry === 'object') {
            fileName = entry.fileName || entry.name || defaultName;
            contentType = entry.contentType || entry.type;
            b64 = entry.content || entry.base64 || entry.data || null;
        }
        if (typeof b64 !== 'string' || !b64) return null;
        const m = /^data:([^;]+);base64,(.*)$/.exec(b64);
        if (m) { contentType = contentType || m[1]; b64 = m[2]; }
        let fileBuffer;
        try { fileBuffer = Buffer.from(b64, 'base64'); } catch (e) { return null; }
        if (!fileBuffer || !fileBuffer.length) return null;
        return { fileBuffer, fileName, contentType };
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
