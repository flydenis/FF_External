// 簡易回應模板（app.js 的錯誤 fallback、直接送出用）。多輪節點請用 JsonTemplate.getResponse。
var JsonCall = {
    GetJsonTemplate: function (isContinuum, message) {
        return { isContinuum: isContinuum, messageType: 'Text', message: message };
    },
    GetResponseTemplate: function (isContinuum, message, messageType) {
        return { isContinuum: isContinuum, messageType: messageType || 'Text', message: message };
    }
};

module.exports = JsonCall;
