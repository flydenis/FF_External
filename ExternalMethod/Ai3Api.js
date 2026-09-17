const memberApiMgr = require('../Api/MemberApiMgr');
const contactAddressApiMgr = require('../Api/ContactAddressApiMgr');
const phoneApiMgr = require('../Api/PhoneApiMgr');
const personalDataChangeApiMgr = require('../Api/PersonalDataChangeApiMgr');
const invoiceInfoChangeApiMgr = require('../Api/InvoiceInfoChangeApiMgr');
const deductionCardChangeApiMgr = require('../Api/DeductionCardChangeApiMgr');
const contractApiMgr = require('../Api/ContractApiMgr');
const ecpPendingApplicationApiMgr = require('../Api/EcpPendingApplicationApiMgr');
const memberSystemApplicationApiMgr = require('../Api/MemberSystemApplicationApiMgr');
const coachApplicationApiMgr = require('../Api/CoachApplicationApiMgr');
const coachPendingApplicationApiMgr = require('../Api/CoachPendingApplicationApiMgr');
const overdueApiMgr = require('../Api/OverdueApiMgr');
const paymentHistoryApiMgr = require('../Api/PaymentHistoryApiMgr');
const paymentDueDateApiMgr = require('../Api/PaymentDueDateApiMgr');
const deductionCardApiMgr = require('../Api/DeductionCardApiMgr');

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

    submitPersonalDataChange(payload) {
        return personalDataChangeApiMgr.submit(payload);
    }

    uploadPersonalDataChangeAttachment(payload) {
        return personalDataChangeApiMgr.uploadEntityAttachment(payload);
    }

    submitInvoiceInfoChange(payload) {
        return invoiceInfoChangeApiMgr.submit(payload);
    }

    submitDeductionCardChange(payload) {
        return deductionCardChangeApiMgr.submit(payload);
    }

    uploadDeductionCardChangeAttachment(payload) {
        return deductionCardChangeApiMgr.uploadEntityAttachment(payload);
    }

    queryContract(payload) {
        return contractApiMgr.query(payload);
    }

    queryEcpPendingApplications(payload) {
        return ecpPendingApplicationApiMgr.query(payload);
    }

    queryMemberSystemApplications(payload) {
        return memberSystemApplicationApiMgr.query(payload);
    }

    queryCoachApplications(payload) {
        return coachApplicationApiMgr.query(payload);
    }

    queryCoachPendingApplications(payload) {
        return coachPendingApplicationApiMgr.query(payload);
    }

    queryOverdue(payload) {
        return overdueApiMgr.query(payload);
    }

    queryPaymentHistory(payload) {
        return paymentHistoryApiMgr.query(payload);
    }

    queryPaymentDueDate(payload) {
        return paymentDueDateApiMgr.query(payload);
    }

    queryDeductionCard(payload) {
        return deductionCardApiMgr.query(payload);
    }
}

module.exports = new Ai3Api();
