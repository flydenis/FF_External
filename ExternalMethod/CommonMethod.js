const crypto = require('crypto');
const ExternalConfig = require('../ExternalConfig');

// 對話狀態改由 app.js 的 conversationStates(Map) 以流程實例保存；
// 本類提供錯誤包裝、sessionId、亂數等共用工具。
class CommonMethod {
    constructor() {
        this.ErrorMaxCount = ExternalConfig.ErrorMaxCount;
        this.Mode = ExternalConfig.Mode;
    }

    errorHandle(error, name) {
        const err = error || {};
        err.message = err.message || `${name} fail`;
        err.code = err.code || `${name}Fail`;
        return err;
    }

    // 需要亂數數字（OTP/驗證碼/亂數尾碼…）時一律用這支：走 crypto.randomInt，
    // 禁用 Math.random（CWE-330 弱隨機，Fortify: Insecure Randomness 會擋）。
    randomDigits(length = 6) {
        let s = '';
        for (let i = 0; i < length; i++) s += crypto.randomInt(0, 10);
        return s;
    }

    // 時間戳 + crypto 亂數尾碼，避免同秒併發撞號（亂數用 crypto.randomInt，非 Math.random）。
    makeSessionId() {
        const d = new Date();
        const p = (n, l = 2) => String(n).padStart(l, '0');
        const ts = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
        return ts + this.randomDigits(3);
    }
}

module.exports = new CommonMethod();
