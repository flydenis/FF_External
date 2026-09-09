const ExternalConfig = require('../ExternalConfig');
const ExternalText = require('../ExternalMethod/ExternalText');
const JsonTemplate = require('../ExternalMethod/JsonTemplate');
const ChainseaApiMgr = require('../Api/ChainseaApiMgr');

// 流程基底：以 currentStep 派發節點方法，main() 經 JsonTemplate.getResponse 依通路送出。
class BaseFlow {
    constructor({ args, res }) {
        if (new.target === BaseFlow) throw new Error('BaseFlow is abstract');
        const a = args || {};
        this.FlowName = a.FlowName;
        this.chatId = a.chatId;
        this.askInput = a.askInput == null ? '' : String(a.askInput);
        this.askUser = a.askUser;
        this.askPlatform = a.askPlatform || 'web';
        this.customerData = a.customerData || {};
        this.logger = a.logger || { InfoLog: console.log, AlertLog: console.error, ErrorLog: console.error };
        this.res = res;
        this.currentStep = 'C010';
        this.errorCount = 0;
    }

    async main() {
        try {
            const stepExecuted = this.currentStep;
            const node = this[stepExecuted];
            if (typeof node !== 'function') {
                throw Object.assign(new Error('node not found: ' + stepExecuted), { code: 'exception' });
            }
            const responseObj = await node.apply(this);
            this.logger.InfoLog(`[${this.FlowName}] step=${stepExecuted} response=${JSON.stringify(responseObj)}`);
            if (responseObj && this.res && !this.res.headersSent) {
                this.res.send(JsonTemplate.getResponse({ ...responseObj, from: this.askPlatform }));
            }
            this.recordTurn(stepExecuted, responseObj);
        } catch (error) {
            this.logger.AlertLog('exception: ' + (error && error.stack ? error.stack : error));
            if (this.res && !this.res.headersSent) {
                this.res.send(JsonTemplate.getResponse({
                    isContinuum: '0', messageType: 'Text', message: ExternalText.Public.ReturnSystemErrorMessage, from: this.askPlatform
                }));
            }
        }
    }

    reply({ message, isContinuum = '1', messageType = 'Text', parameters = {}, command = {}, nextStep }) {
        if (nextStep !== undefined) this.currentStep = nextStep;
        return { isContinuum, messageType, message, parameters, command };
    }

    // 每輪把對話寫回 ECP（供跨輪還原與事後統整/報表）。未設 EcpApi.Url 就跳過；寫入失敗不影響回覆。
    // 流程可自訂 getState() 回傳要存進 U_ExternalFlowInfo 的狀態快照。
    recordTurn(stepExecuted, responseObj) {
        if (!ExternalConfig.EcpApi || !ExternalConfig.EcpApi.Url) return;
        ChainseaApiMgr.addExternalRecord({
            chatId: this.chatId,
            currentStep: stepExecuted,
            nextStep: this.currentStep,
            flowData: JSON.stringify(this.getState ? this.getState() : {}),
            isFlowStop: responseObj && responseObj.isContinuum === '0' ? 'T' : 'F',
            flowName: this.FlowName,
            logger: this.logger
        });
    }

    transfer(message) {
        return { isContinuum: '0', messageType: 'Text', message, command: { name: 'transfer', params: { dest: ExternalConfig.TransferCode || '' } } };
    }

    cutOff(message) {
        return { isContinuum: '0', messageType: 'Text', message, command: { name: 'releasecall' } };
    }
}

module.exports = BaseFlow;
