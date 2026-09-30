const IntentBaseFlow = require('./IntentBaseFlow');
const wording = require('../ExternalMethod/ExternalText');
const ExternalConfig = require('../ExternalConfig');
const ai3Api = require('../ExternalMethod/Ai3Api');
const UpgradeRule = require('../ExternalMethod/UpgradeRule');
const TransferRule = require('../ExternalMethod/TransferRule');
const AgentFlow = require('./AgentFlow');

const T = wording.ChangeMembershipFlow;
const MOBILE_PATTERN = /^09\d{8}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const TAX_ID_PATTERN = /^\d{8}$/;
const PAY_TYPES = ['C', 'T'];

// 會籍資格升等／會籍廠館轉移／廠館轉移加卡別升等（FF-04-01）— 純 Web 表單式，三種共用同一張表單（依 changeType 切換欄位）。
//   U 升等：選升等選項（區域鎖原廠館所在區）；T 轉館：選新廠館（卡別不動）；A 轉館加升等：選升等選項（區域自選）＋該區新廠館。
//   新廠館清單一律排除原廠館，送件時後端再核實（TransferRule）。寒暑假學生轉館屬 FF-04-02，本流程不做。
//   C010 欠費提醒＋申辦項目按鈕 → C015 問身分（本人/代理人）→ C020 分派：
//     本人  → 查「會籍合約異動申辦初始頁資料」→ 判斷可申請 → 算可升選項 → 回表單旗標＋預帶資料（C030）
//     代理人 → 交給共用 AgentFlow 處理到底（C030_Agent）
//   C030 收表單 JSON → 取消 / 一次核實所有欄位 → 寫 ECP（CUS.ChangeMembership）→ 回結果
class ChangeMembershipFlow extends IntentBaseFlow {
    async C010() {
        this.errorCount = 0;
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

        if (code === 'SELF') {
            this.errorCount = 0;
            this.role = 'SELF';
            return this.prepareSelfForm();
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

        const applyDate = UpgradeRule.toISODate(new Date());
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
        this.logger.InfoLog(`[${this.FlowName}] C020 回表單旗標，type=${this.changeType}，合約=${contract.contractNo}，選項=${options.map(o => o.code).join(',') || '(轉館無)'}`);
        return this.reply({ message: '', parameters: { [T.FormFlag]: T.FormFlag, [T.DataKey]: formData }, nextStep: 'C030' });
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
            payType: form.payType,
            taxId: checked.taxId,
            remark: this.buildRemark(checked),
            transfer: checked.venue ? { storeCode: checked.venue.code, city: checked.venue.city, region: checked.venue.region } : null,
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
        return this.reply({ message: T.SubmitDone, isContinuum: '0' });
    }

    // 備註（U_Remark）：升等前後的文字說明，方便客服閱讀。
    buildRemark({ selected, venue }) {
        const parts = [];
        if (selected) parts.push(`升等後：${selected.label}`);
        if (venue) parts.push(`新主要使用廠館：${venue.name}`);
        return `${parts.join('；')}（原：${UpgradeRule.describeCurrent(this.contract)}）`;
    }

    // 逐欄核實，回 { ok, reason, selected, venue, taxId }；reason 只記 log，不回給使用者。
    validateForm(form) {
        if (!form || typeof form !== 'object') return { ok: false, reason: '表單不是 JSON 物件' };
        if (!this.contract || !this.options) return { ok: false, reason: '無 C020 查到的合約資料' };

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

        const minDate = this.minActDate(UpgradeRule.toISODate(new Date()));
        if (!UpgradeRule.isValidActivationDate(form.actDate, minDate)) return { ok: false, reason: `啟用日 ${form.actDate} 早於最早可選日 ${minDate}` };

        if (!PAY_TYPES.includes(form.payType)) return { ok: false, reason: `繳費方式不符（${form.payType}）` };

        const taxId = String(form.taxId || '').trim();
        if (taxId && !TAX_ID_PATTERN.test(taxId)) return { ok: false, reason: '統編不是 8 碼數字' };

        return { ok: true, selected, venue, taxId };
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
            ...(this.contract ? { contractNo: this.contract.contractNo } : {}),
            ...(this.selected ? { upgradeOption: this.selected.code } : {}),
            ...(this.venue ? { newVenue: this.venue.code } : {}),
            ...(this.orderNo ? { orderNo: this.orderNo } : {}),
            ...(this.agentFlow ? this.agentFlow.getState() : {})
        };
    }

    // TODO(PM 確認 Q13)：會員識別暫由 customerData.memberKey 帶入（比照其他流程），待 APP 登入身分傳遞方式定案後調整。
    memberKey() {
        return this.customerData && this.customerData.memberKey;
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
    parseButtonCode(input, buttons) {
        const raw = String(input == null ? '' : input).trim();
        const hit = (buttons || []).find(b => raw === b.submit || raw === b.label);
        return hit ? hit.submit : null;
    }
}

module.exports = ChangeMembershipFlow;
