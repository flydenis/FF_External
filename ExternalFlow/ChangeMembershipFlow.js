const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ExternalConfig = require('../ExternalConfig');
const ai3Api = require('../ExternalMethod/Ai3Api');
const UpgradeRule = require('../ExternalMethod/UpgradeRule');
const TransferRule = require('../ExternalMethod/TransferRule');
const StudentTransferRule = require('../ExternalMethod/StudentTransferRule');
const studentPeriodApiMgr = require('../Api/StudentTransferPeriodApiMgr');
const studentUploadMgr = require('../Api/StudentTransferUploadMgr');
const changeMembershipApplicationApiMgr = require('../Api/ChangeMembershipApplicationApiMgr');
const AgentFlow = require('./AgentFlow');

const T = wording.ChangeMembershipFlow;
const MOBILE_PATTERN = /^09\d{8}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const TAX_ID_PATTERN = /^\d{8}$/;
const PAY_TYPES = ['C', 'T'];
const STUDENT_TYPES = ['Y', 'O'];

// 會籍資格升等／會籍廠館轉移／廠館轉移加卡別升等（FF-04-01）— 純 Web 表單式，三種共用同一張表單（依 changeType 切換欄位）。
//   U 升等：選升等選項（區域鎖原廠館所在區）；T 轉館：選新廠館（卡別不動）；A 轉館加升等：選升等選項（區域自選）＋該區新廠館。
//   新廠館清單一律排除原廠館，送件時後端再核實（TransferRule）。
// 學生寒暑假限定轉館（FF-04-02）：不另開按鈕；受理期間內（ECP 參數，StudentTransferRule）轉館（T）／轉館加升等（A）表單多帶 student 區塊，
//   表單內勾「寒暑假學生限定轉館：是（轉出新廠館 Y）／是（轉回原廠館 O）」→ 須知彈窗勾同意＋上傳有效學生證 1～5 檔；
//   不勾＝一般轉館。學生件寫 U_StudentOnly、U_ValidstudentIdDoc，建單後上傳附件。（客戶《查詢.會籍合約.線上表單及api相關範圍》p.18／p.20）
//   C010 欠費提醒＋申辦項目按鈕 → C015 問身分（本人/代理人）→ C020 分派：
//     本人  → 查「會籍合約異動申辦初始頁資料」→ 判斷可申請 → 算可升選項 → 回表單旗標＋預帶資料（C030）
//     代理人 → 交給共用 AgentFlow 處理到底（C030_Agent）
//   C030 收表單 JSON → 取消 / 一次核實所有欄位 → 寫 ECP（CUS.ChangeMembership）→ 回結果
class ChangeMembershipFlow extends IntentBaseFlow {
    async C010() {
        this.errorCount = 0;
        this.student = false;
        this.studentPeriod = null;
        const overdueNotice = await this.checkOverdueNotice({ key: this.memberKey() });
        const ask = T.TypeAsk + this.buildButtons(this.enabledTypeButtons());
        return this.reply({ message: overdueNotice ? `${overdueNotice}\n\n${ask}` : ask, nextStep: 'C015' });
    }

    async C015() {
        const code = this.parseButtonCode(this.askInput, this.enabledTypeButtons());
        this.logger.InfoLog(`[${this.FlowName}] C015 申辦項目=${code || '(未對到)'}`);
        if (code) {
            this.errorCount = 0;
            this.changeType = T.ChangeTypeCode[code];
            return this.reply({ message: T.IdentityAsk + this.buildButtons(T.IdentityButtons), nextStep: 'C020' });
        }
        return this.retryOrGiveUp(T.TypeInvalid, 'C015', 'Text', T.TypeAsk + this.buildButtons(this.enabledTypeButtons()));
    }

    async C020() {
        const code = this.parseButtonCode(this.askInput, T.IdentityButtons);
        this.logger.InfoLog(`[${this.FlowName}] C020 身分別=${code || '(未對到)'}`);

        if (code === '本人申辦') {
            this.errorCount = 0;
            this.role = 'SELF';
            return this.prepareSelfForm();
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

    // 本人：查合約 → 判斷能否申請 → 算可升選項 → 回表單旗標，預帶資料放在 parameters[DataKey] 給前端表單讀。
    async prepareSelfForm() {
        const result = await ai3Api.queryChangeMembershipInit({ chatId: this.chatId, key: this.memberKey(), logger: this.logger });
        const member = result && result.found ? result.record : null;
        const contracts = member && Array.isArray(member.contracts) ? member.contracts : [];

        const allowed = this.settings().AllowedContractStatus || [];
        const contract = contracts.find(c => allowed.includes(String(c.contractStatus)));
        if (!contract) {
            const adminTerminated = contracts.some(c => String(c.contractStatus) === T.AdminTerminatedStatus);
            this.logger.InfoLog(`[${this.FlowName}] C020 無可申請合約（found=${!!member}, 合約數=${contracts.length}, 行政終止=${adminTerminated}）`);
            return this.reply({ message: adminTerminated ? T.AdminTerminated : T.NoContract, isContinuum: '0' });
        }

        // 升等（U）：區域鎖原廠館所在區；轉館加升等（A）：區域由會員自選；純轉館（T）：卡別不動，沒有升等選項。
        let options = [];
        if (this.changeType === 'U') {
            options = UpgradeRule.getUpgradeOptions({
                cardName: contract.cardName,
                membership: contract.membership,
                storeCode: contract.storeCode,
                dualRegionEnabled: !!this.settings().DualRegionEnabled
            });
        } else if (this.changeType === 'A') {
            options = TransferRule.getTransferUpgradeOptions({ cardName: contract.cardName, membership: contract.membership });
        }
        if (this.changeType !== 'T' && !options.length) {
            this.logger.InfoLog(`[${this.FlowName}] C020 無可升選項（type=${this.changeType}, card=${contract.cardName}, membership=${contract.membership}）`);
            return this.reply({ message: this.noOptionMessage(contract), isContinuum: '0' });
        }

        const applyDate = this.today();
        this.member = { memberCode: member.memberCode, memberName: member.name };
        this.contract = { contractNo: contract.contractNo, cardName: String(contract.cardName), membership: String(contract.membership), storeCode: contract.storeCode };
        this.options = options;

        const formData = {
            changeType: this.changeType,
            memberCode: member.memberCode,
            memberName: member.name,
            applyDate,
            contractNo: contract.contractNo,
            currentCard: UpgradeRule.describeCurrent(contract),
            currentVenue: UpgradeRule.availableVenueText(contract),
            contactPhone: member.contactPhone || '',
            contactEmail: member.contactEmail || '',
            options: options.map(o => ({ code: o.code, label: o.label, region: o.region, requiresSecondRegion: o.requiresSecondRegion, secondRegionChoices: o.secondRegionChoices })),
            // 轉館／轉館加升等：可選新廠館（已排除原廠館），前端依選項的 region 過濾後做「縣市 → 館別」下拉。
            venues: this.changeType === 'U' ? [] : TransferRule.venueChoices({ excludeStoreCode: contract.storeCode }),
            minActDate: this.minActDate(applyDate),
            payOptions: T.PayOptions
        };
        // 轉館／轉館加升等：受理期間內才帶學生區塊（會員可不勾，視為一般轉館）。
        if (this.changeType !== 'U') {
            this.studentPeriod = await this.findStudentPeriod();
            if (this.studentPeriod) formData.student = this.studentBlock(applyDate);
        }
        this.logger.InfoLog(`[${this.FlowName}] C020 回表單旗標，type=${this.changeType}，合約=${contract.contractNo}，選項=${options.map(o => o.code).join(',') || '(轉館無)'}`);
        return this.reply({ message: '', parameters: { [T.FormFlag]: T.FormFlag, [T.DataKey]: formData }, nextStep: 'C030' });
    }

    // 學生區塊：須知、Y／O 各自的啟用日範圍、上傳限制。轉館、轉館加升等都提供轉出／轉回（2026-10-06 SA 回覆，取代原 S5）。
    studentBlock(today) {
        const upload = ExternalConfig.StudentTransferUpload || {};
        const block = {
            periodName: this.studentPeriod.name || '',
            notice: T.StudentNotice,
            studentTypes: T.StudentTypes.map(t => {
                const range = this.studentActRange(t.value, today);
                return { ...t, enabled: !!range, minActDate: range ? range.min : '', maxActDate: range && range.max ? range.max : '' };
            }),
            upload: { maxFileCount: upload.MaxFileCount, maxFileSizeMB: upload.MaxFileSizeMB, allowedExt: upload.AllowedExt }
        };
        this.logger.InfoLog(`[${this.FlowName}] C020 帶學生區塊，期間=${block.periodName}，${block.studentTypes.map(t => `${t.value}=${t.minActDate}~${t.maxActDate || '不限'}`).join('，')}`);
        return block;
    }

    // 本人送件：取消 → 結束；一次核實所有欄位 → 寫 ECP → 回結果。
    // 合約編號、會員資料一律用 C020 查到的值，不採用前端送回的值（避免被竄改）。
    async C030() {
        if (this.isCancelAction(this.askInput)) {
            this.logger.InfoLog(`[${this.FlowName}] C030 使用者取消`);
            return this.reply({ message: T.Cancelled, isContinuum: '0' });
        }

        const form = this.parseFormInput(this.askInput);
        const checked = this.validateForm(form);
        if (!checked.ok) {
            this.logger.AlertLog(`[${this.FlowName}] C030 表單核實未過：${checked.reason}`);
            return this.reply({ message: T.SubmitInvalid, isContinuum: '0' });
        }

        this.selected = checked.selected;
        this.student = !!checked.student;
        this.venue = checked.venue;
        const { entityId } = await ai3Api.submitChangeMembership({
            memberCode: this.member.memberCode,
            memberName: this.member.memberName,
            contractNo: this.contract.contractNo,
            applyTime: this.nowString(),
            contactType: form.contactType,
            contactValue: form.contactValue,
            changeType: this.changeType,
            upCardType: checked.selected ? checked.selected.cardName : '',
            actDate: form.actDate,
            payType: PAY_TYPES.includes(form.payType) ? form.payType : '',
            taxId: checked.taxId,
            remark: this.buildRemark(checked),
            transfer: checked.venue ? { storeCode: checked.venue.code, city: checked.venue.city, region: checked.venue.region } : null,
            transfer2: checked.secondVenue ? { storeCode: checked.secondVenue.code, city: checked.secondVenue.city, region: checked.secondVenue.region } : null,
            student: checked.student ? { studentOnly: checked.student.studentType, validStudentIdDoc: checked.student.proof.length > 0 } : null,
            detail: this.settings().WriteDetailFields ? {
                upMembership: checked.selected ? UpgradeRule.membershipAfter(checked.selected) : null,
                oldCardType: this.contract.cardName,
                oldMembership: this.contract.membership,
                oldAvailableVenue: UpgradeRule.availableVenueText(this.contract)
            } : null,
            logger: this.logger
        });
        this.orderNo = entityId;
        // 建單失敗時明確告知會員（與請假流程「失敗仍回完成」不同）——假設，待 PM 確認 Q16。
        if (!entityId) {
            this.logger.AlertLog(`[${this.FlowName}] C030 寫入 ECP 未取得單號`);
            return this.reply({ message: T.SubmitFailed, isContinuum: '0' });
        }
        this.logger.InfoLog(`[${this.FlowName}] C030 建單完成 entityId=${entityId}`);
        if (checked.student) await this.uploadStudentProof(entityId, checked.student.proof);
        return this.reply({ message: T.SubmitDone, isContinuum: '0' });
    }

    // 備註（U_Remark）：升等前後的文字說明，方便客服閱讀。
    buildRemark({ selected, venue, secondVenue, student }) {
        const parts = [];
        if (student) {
            const type = T.StudentTypes.find(t => t.value === student.studentType);
            parts.push(`${T.StudentRemarkPrefix}（${type ? type.label : student.studentType}）`);
        }
        if (selected) parts.push(`升等後：${selected.label}`);
        if (venue) parts.push(`新主要使用廠館：${venue.name}`);
        if (secondVenue) parts.push(`次要使用廠館：${secondVenue.name}`);
        return `${parts.join('；')}（原：${UpgradeRule.describeCurrent(this.contract)}）`;
    }

    // 逐欄核實，回 { ok, reason, selected, venue, taxId }；reason 只記 log，不回給使用者。
    validateForm(form) {
        if (!form || typeof form !== 'object') return { ok: false, reason: '表單不是 JSON 物件' };
        if (!this.contract || !this.options) return { ok: false, reason: '無 C020 查到的合約資料' };

        // 學生件（表單勾了寒暑假學生限定轉館）：先核實學生區塊，之後沿用一般核實。
        let student = null;
        if (form.student && form.student.studentType) {
            student = this.validateStudent(form);
            if (!student.ok) return student;
        }

        const contactOk = (form.contactType === 'phone' && MOBILE_PATTERN.test(String(form.contactValue || '')))
            || (form.contactType === 'email' && EMAIL_PATTERN.test(String(form.contactValue || '')));
        if (!contactOk) return { ok: false, reason: '聯絡方式格式不符' };

        let selected = null;
        if (this.changeType !== 'T') {
            selected = UpgradeRule.validateSelection({ options: this.options, code: form.upgradeOption, secondRegion: form.secondRegion });
            if (!selected) return { ok: false, reason: `升等選項不在可選清單內（${form.upgradeOption}）` };
        }

        // 轉館／轉館加升等：新廠館須在可選清單內（不可是原廠館）；轉館加升等選區域型時，新館須在所選區域。
        let venue = null;
        if (this.changeType !== 'U') {
            const region = selected && selected.scope === 'region' ? selected.region : null;
            if (!TransferRule.isAllowedVenue({ storeCode: form.newVenue, excludeStoreCode: this.contract.storeCode, region })) {
                return { ok: false, reason: `新廠館不可選（${form.newVenue}，原館 ${this.contract.storeCode}，區域 ${region || '不限'}）` };
            }
            venue = TransferRule.venueInfo(form.newVenue);
        }

        // 次要使用區域（雙區身分適用，選填；需求書 p.88「雙區卡填兩組，須避免兩區相同」）：
        // 有填才核實，須在可選清單內（不可是原廠館），且與主要使用廠館不同區（澎湖馬公 region 為 null，視為「其他」一區）。
        let secondVenue = null;
        if (this.changeType !== 'U' && form.secondVenue) {
            if (!TransferRule.isAllowedVenue({ storeCode: form.secondVenue, excludeStoreCode: this.contract.storeCode })) {
                return { ok: false, reason: `次要使用廠館不可選（${form.secondVenue}，原館 ${this.contract.storeCode}）` };
            }
            secondVenue = TransferRule.venueInfo(form.secondVenue);
            if ((secondVenue.region || 'other') === (venue.region || 'other')) {
                return { ok: false, reason: `次要使用廠館與主要使用廠館同區（${form.secondVenue}／${form.newVenue}）` };
            }
        }

        if (!student) {
            const minDate = this.minActDate(this.today());
            if (!UpgradeRule.isValidActivationDate(form.actDate, minDate)) return { ok: false, reason: `啟用日 ${form.actDate} 早於最早可選日 ${minDate}` };
        }

        // 繳費方式：學生純轉館（T）非必填（需求書 p.92 只有轉館加升等必填），有填仍須是有效值。
        const payOptional = student && this.changeType === 'T' && !form.payType;
        if (!payOptional && !PAY_TYPES.includes(form.payType)) return { ok: false, reason: `繳費方式不符（${form.payType}）` };

        const taxId = String(form.taxId || '').trim();
        if (taxId && !TAX_ID_PATTERN.test(taxId)) return { ok: false, reason: '統編不是 8 碼數字' };

        return { ok: true, selected, venue, secondVenue, taxId, student };
    }

    // 學生區塊核實：須知已勾、Y／O、啟用日在範圍內、學生證明 1～N 檔且都在暫存區。
    validateStudent(form) {
        const s = form.student;
        if (s.agreed !== true) return { ok: false, reason: '未勾選同意學生轉館須知' };
        if (!STUDENT_TYPES.includes(s.studentType)) return { ok: false, reason: `轉出／轉回不符（${s.studentType}）` };
        if (this.changeType === 'U') return { ok: false, reason: '會籍資格升等不受理學生轉館' };
        if (!this.studentPeriod) return { ok: false, reason: '不在學生轉館受理期間' };

        const range = this.studentActRange(s.studentType, this.today());
        if (!StudentTransferRule.isValidActivation(form.actDate, range)) return { ok: false, reason: `啟用日 ${form.actDate} 不在可選範圍 ${JSON.stringify(range)}` };

        const maxFiles = (ExternalConfig.StudentTransferUpload || {}).MaxFileCount || 5;
        const proof = Array.isArray(s.proof) ? s.proof.filter(p => p && p.fileId) : [];
        if (!proof.length || proof.length > maxFiles) return { ok: false, reason: `學生證明檔數不符（${proof.length}）` };
        const missing = proof.find(p => !studentUploadMgr.readFile(p.fileId));
        if (missing) return { ok: false, reason: `學生證明不在暫存區（${missing.fileId}）` };

        return { ok: true, studentType: s.studentType, proof: proof.map(p => ({ fileId: String(p.fileId), fileName: String(p.fileName || p.fileId) })) };
    }

    // 建單後逐檔上傳學生證明到 ECP 附件（比照請假流程）：成功才刪暫存檔；個別失敗只記 log，不影響已建好的申請單。
    async uploadStudentProof(entityId, proof) {
        for (const ref of proof) {
            try {
                const fileBuffer = studentUploadMgr.readFile(ref.fileId);
                if (!fileBuffer || !fileBuffer.length) {
                    this.logger.AlertLog(`[${this.FlowName}] 學生證明讀取失敗，略過上傳（fileId=${ref.fileId}）`);
                    continue;
                }
                const uploaded = await changeMembershipApplicationApiMgr.uploadEntityAttachment({
                    entityId,
                    fileName: ref.fileName,
                    fileBuffer,
                    contentType: studentUploadMgr.mimeFromExt(ref.fileName),
                    logger: this.logger
                });
                if (uploaded) studentUploadMgr.removeFile(ref.fileId, this.logger);
                else this.logger.AlertLog(`[${this.FlowName}] 學生證明上傳 ECP 失敗，暫存檔保留（entityId=${entityId}, fileId=${ref.fileId}）`);
            } catch (error) {
                this.logger.AlertLog(`[${this.FlowName}] 學生證明上傳例外（fileId=${ref.fileId}）：${error && error.stack ? error.stack : error}`);
            }
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
            changeType: this.changeType,
            role: this.role,
            ...(this.student ? { student: true, studentPeriod: this.studentPeriod ? this.studentPeriod.name : '' } : {}),
            ...(this.contract ? { contractNo: this.contract.contractNo } : {}),
            ...(this.selected ? { upgradeOption: this.selected.code } : {}),
            ...(this.venue ? { newVenue: this.venue.code } : {}),
            ...(this.orderNo ? { orderNo: this.orderNo } : {}),
            ...(this.agentFlow ? this.agentFlow.getState() : {})
        };
    }

    // TODO(PM 確認 Q13)：會員識別暫由 customerData.memberKey 帶入（比照其他流程），待 APP 登入身分傳遞方式定案後調整。
    // Qbi（mock 測試）模式下沒帶 memberKey 時改用 QbiDefaultMemberKey，正式模式維持查無（不誤帶他人資料）。
    memberKey() {
        const key = this.customerData && this.customerData.memberKey;
        if (key) return key;
        return ExternalConfig.Mode === 'Qbi' ? (this.settings().QbiDefaultMemberKey || undefined) : undefined;
    }

    // 沒有可升選項時的提示。A 不含全國白金：還能升全國白金的會員（如區域金卡）引導改走升等；已是全國白金則引導改走轉館。
    noOptionMessage(contract) {
        if (this.changeType !== 'A') return T.NoUpgradeOption;
        const canUpgrade = UpgradeRule.getUpgradeOptions({ cardName: contract.cardName, membership: contract.membership, storeCode: contract.storeCode }).length > 0;
        return canUpgrade ? T.NoTransferUpgradeOptionTryUpgrade : T.NoTransferUpgradeOption;
    }

    settings() {
        return ExternalConfig.ChangeMembership || {};
    }

    enabledTypeButtons() {
        return T.TypeButtons.filter(b => b.enabled);
    }

    studentSettings() {
        return this.settings().Student || {};
    }

    // 今天日期（YYYY-MM-DD）。Qbi 測試模式可用 Student.QbiTestToday 指定，讓非開放期間也能測；正式模式一律用真實日期。
    today() {
        const testToday = String(this.studentSettings().QbiTestToday || '');
        if (ExternalConfig.Mode === 'Qbi' && /^\d{4}-\d{2}-\d{2}$/.test(testToday)) return testToday;
        return UpgradeRule.toISODate(new Date());
    }

    // 查今天所在的學生轉館開放期間；未啟用、不在期間或查詢例外都回 null（不影響升等／轉館三顆按鈕）。
    async findStudentPeriod() {
        if (!this.studentSettings().Enabled) return null;
        try {
            const today = this.today();
            const { periods, source } = await studentPeriodApiMgr.getPeriods({ today, logger: this.logger });
            const period = StudentTransferRule.findOpenPeriod(today, periods);
            this.logger.InfoLog(`[${this.FlowName}] C020 學生轉館期間（來源 ${source}，今天 ${today}）：${period ? JSON.stringify(period) : '不在開放期間'}`);
            return period;
        } catch (error) {
            this.logger.AlertLog(`[${this.FlowName}] C020 查學生轉館期間失敗：${error && error.stack ? error.stack : error}`);
            return null;
        }
    }

    studentActRange(studentType, today) {
        const s = this.settings();
        return StudentTransferRule.activationRange({
            today, studentType, period: this.studentPeriod,
            workingDays: s.WorkingDaysBeforeActivation || 3, holidays: s.Holidays || []
        });
    }

    minActDate(applyDate) {
        const s = this.settings();
        return UpgradeRule.minActivationDate(applyDate, { workingDays: s.WorkingDaysBeforeActivation || 3, holidays: s.Holidays || [] });
    }

    nowString() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return `${UpgradeRule.toISODate(d)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
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
    // 按鈕送出值改用中文 label，WebChat 使用者泡泡才會顯示「會籍資格升等」而不是「UPGRADE」。
    // 只在本流程覆寫（IntentBaseFlow.buildButtons 其他流程共用，不動）；parseButtonCode 本來就同時認 label 與 submit。
    buildButtons(buttons, style) {
        return super.buildButtons((buttons || []).map(b => ({ ...b, submit: b.label })), style);
    }

    parseButtonCode(input, buttons) {
        const raw = String(input == null ? '' : input).trim();
        const hit = (buttons || []).find(b => raw === b.submit || raw === b.label);
        return hit ? hit.submit : null;
    }
}

module.exports = ChangeMembershipFlow;
