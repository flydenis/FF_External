// 依通路組回應：
//  - phone：回含 params/command 的語音 JSON（TTS/收碼設定）。
//  - web（對話式）：回純文字（帶 command 時包 JSON）。
//  - web（表單式）：帶「非 phone 專用」的 parameters 時，把 { message, parameters } 包進 message 字串傳前端，
//    前端自 message 解析出 parameters（如表單觸發 marker { AgentForm:'AgentForm' } 或送件後的 ToAgentOfLeaveFlow）。
// phone 專用 params（domainID/TTS…）在 web 一律忽略、不觸發表單封裝，故對話式在 web 仍是純文字。
const PHONE_PARAM_KEYS = new Set(['domainID', 'playtype', 'getdigit', 'collecttype', 'ini', 'asrini', 'faq']);

let JsonTemplate = {
    getResponse: function ({ isContinuum, messageType, message, parameters = {}, command = {}, from }) {
        const content = { message, parameters, command };
        const fn = JsonTemplate['get' + messageType] || JsonTemplate.getText;
        return fn({ isContinuum, content, from });
    },

    getText: function ({ isContinuum, content, from }) {
        const hasCommand = Object.keys(content.command).length > 0;

        // 表單式：web 帶非 phone 專用的 parameters 且無 command → 包 { message, parameters } 給前端。
        if (from === 'web' && !hasCommand) {
            const formKeys = Object.keys(content.parameters).filter(k => !PHONE_PARAM_KEYS.has(k));
            if (formKeys.length > 0) {
                const parameters = {};
                for (const k of formKeys) parameters[k] = content.parameters[k];
                return { isContinuum: isContinuum, messageType: 'Text', message: JSON.stringify({ message: content.message, parameters: parameters }) };
            }
            return { isContinuum: isContinuum, messageType: 'Text', message: content.message };
        }

        // phone 語音、或 web 帶 command（轉接/掛斷）：語音/命令封裝。
        let message = '';
        if (from === 'phone' || hasCommand) {
            let payload;
            if (hasCommand) {
                payload = { text: content.message, type: 'Text', params: content.parameters, command: content.command };
            } else {
                payload = { text: content.message, params: content.parameters };
            }
            payload.params = {
                playtype: payload.params.playtype ? payload.params.playtype : 7,
                getdigit: payload.params.getdigit !== undefined ? payload.params.getdigit : true,
                collecttype: payload.params.collecttype ? payload.params.collecttype : 1,
                ini: payload.params.ini !== undefined ? payload.params.ini : 0,
                faq: false,
                domainID: payload.params.domainID ? payload.params.domainID : '',
                asrini: payload.params.asrini !== undefined ? payload.params.asrini : 0
            };
            message = JSON.stringify(payload);
        } else {
            message = content.message;
        }
        return { isContinuum: isContinuum, messageType: from === 'phone' || hasCommand ? 'text' : 'Text', message: message };
    },

    getQuickReply: function ({ isContinuum, content }) {
        const payload = { QuickReply: content.message.QuickReply, type: content.message.type, params: content.parameters };
        return { isContinuum: isContinuum, messageType: 'QuickReply', message: JSON.stringify(payload) };
    }
};

module.exports = JsonTemplate;
