// 簡易回應模板（app.js 的錯誤 fallback、直接送出用）。多輪節點請用 JsonTemplate.getResponse。
// 維持與 web 契約一致的原始物件格式：頂層帶空的 parameters/command。
var JsonCall = {
    GetJsonTemplate: function (isContinuum, message) {
        return { isContinuum: isContinuum, messageType: 'Text', message: message, parameters: {}, command: {} };
    },
    GetResponseTemplate: function (isContinuum, message, messageType) {
        return { isContinuum: isContinuum, messageType: messageType || 'Text', message: message, parameters: {}, command: {} };
    }
};

module.exports = JsonCall;
