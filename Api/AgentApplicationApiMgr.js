const { createEcpApplicationMgr } = require('./EcpApplicationMgr');

// 代理人申請案（CUS.AgentApplication）寫入 + 附件上傳。token 管理／multipart 上傳等共用邏輯都在 EcpApplicationMgr，
// 這裡只負責「代理人流程專屬」的部分：savePath／entityUnitId，以及表單欄位怎麼映射成 ECP 欄位（record）。
const mgr = createEcpApplicationMgr({
    savePath: 'CUS.AgentApplication.Save.data',
    // 附件所掛 entity 的單元 ID（args.unitId）。
    // TODO(PM 確認)：此值須為 CUS.AgentApplication 的 unitId；你 Postman 範例用的是 00000000-0000-0000-0001-020000001002，
    //   若上傳掛錯 entity 就改這個值。
    entityUnitId: '1a0656b6-2030-043b-6d18-00505693a3c1'
});

class AgentApplicationApiMgr {
    // 新增一筆代理人申請案。fields 只帶實際蒐集到的欄位（未蒐集的欄位不送，維持資料表預設值）。
    // 回傳 { entityId }：entityId 取自回應 entityIds[0]，供後續附件上傳時帶入。
    async saveApplication({ applicationType, agentName, agentPhone, agentIdDocUploaded, logger }) {
        const record = { U_ApplicationType: applicationType };
        if (agentName !== undefined) record.U_AgentName = agentName;
        if (agentPhone !== undefined) record.U_AgentContactNum = agentPhone;
        if (agentIdDocUploaded !== undefined) record.U_AgentIdDoc = !!agentIdDocUploaded;
        return mgr.saveApplication(record, logger);
    }

    uploadEntityAttachment(args) {
        return mgr.uploadEntityAttachment(args);
    }
}

module.exports = new AgentApplicationApiMgr();
