const memberApiMgr = require('../Api/MemberApiMgr');
const contactAddressApiMgr = require('../Api/ContactAddressApiMgr');
const phoneApiMgr = require('../Api/PhoneApiMgr');

// 業務層 API 包裝：流程只呼叫這裡，實際 HTTP/交易由各 *ApiMgr 處理。
// （ECP 對話紀錄走 Api/ChainseaApiMgr，由 BaseFlow 每輪寫入。）
class Ai3Api {
    queryMemberInfo(payload) {
        return memberApiMgr.query(payload);
    }

    queryContactAddress(payload) {
        return contactAddressApiMgr.query(payload);
    }

    queryPhone(payload) {
        return phoneApiMgr.query(payload);
    }
}

module.exports = new Ai3Api();
