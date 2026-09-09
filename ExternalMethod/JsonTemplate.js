// 依通路組回應：phone 回含 params/command 的語音 JSON；web 回純文字（或帶 command）。
let JsonTemplate = {
    getResponse: function ({ isContinuum, messageType, message, parameters = {}, command = {}, from }) {
        const content = { message, parameters, command };
        const fn = JsonTemplate['get' + messageType] || JsonTemplate.getText;
        return fn({ isContinuum, content, from });
    },

    getText: function ({ isContinuum, content, from }) {
        let message = '';
        if (from === 'phone' || (from === 'web' && Object.keys(content.parameters).length > 1) || Object.keys(content.command).length > 0) {
            let payload;
            if (Object.keys(content.command).length > 0) {
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
        return { isContinuum: isContinuum, messageType: from === 'phone' || Object.keys(content.command).length > 0 ? 'text' : 'Text', message: message };
    },

    getQuickReply: function ({ isContinuum, content }) {
        const payload = { QuickReply: content.message.QuickReply, type: content.message.type, params: content.parameters };
        return { isContinuum: isContinuum, messageType: 'QuickReply', message: JSON.stringify(payload) };
    }
};

module.exports = JsonTemplate;
