module.exports = {
    Mode: 'Qbi',              // 'Product' | 'development' | 'Qbi'
    port: 3017,
    ErrorMaxCount: 3,
    RequestTimeout: 50000,

    // 純 Web 通路，不含 Phone(IVR)，故不設 TransferCode。

    EcpApi: {
        Url: 'https://fitness-factory-km.qbicloud.com/ecp/',// TODO(PM 確認)：ECP 對話紀錄寫回端點；未設就不寫紀錄
        Authorization: 'Authorization: Basic YXBpX3VzZXI6Q1NpaUBbNzcwNjYxODhd',      // 由部署平台環境變數注入，勿硬編碼
        // OpenAPI 2.0（/openapi/qs/user/token/apply）登入帳密：與上面 Authorization 為同一組帳號，供附件上傳(qs/attachment/upload)換 token 用。
        LoginName: 'api_user',
        Password: 'CSii@[77066188]'
    },

    // TODO(PM 確認)：客戶會員體驗資訊查詢 API 規格（Product/development 網址、request 帶哪個欄位當查詢 key）
    MemberInfoQuery: {
        Product: { Url: 'https://prod-host/api/member/trial-info' },
        development: { Url: 'https://dev-host/api/member/trial-info' },
        Qbi: { Url: './data/MemberInfoQbiResponse.json' }
    },

    // TODO(PM 確認)：客戶登記地址查詢 API 規格（Product/development 網址、request 帶哪個欄位當查詢 key），目前先放 placeholder
    ContactAddressQuery: {
        Product: { Url: 'https://prod-host/api/member/contact-address' },
        development: { Url: 'https://dev-host/api/member/contact-address' },
        Qbi: { Url: './data/ContactAddressQbiResponse.json' }
    },

    // TODO(PM 確認)：客戶登記電話查詢 API 規格（Product/development 網址、request 帶哪個欄位當查詢 key），目前先放 placeholder
    PhoneQuery: {
        Product: { Url: 'https://prod-host/api/member/phone' },
        development: { Url: 'https://dev-host/api/member/phone' },
        Qbi: { Url: './data/PhoneQbiResponse.json' }
    },

    // 個人資料變更申請：受理後資料回寫 ECP 單元 CUS.ChangeBasicInfo（PM 已確認單元編碼與欄位，見
    // Api/PersonalDataChangeApiMgr.js 的 mapToEcpFields()）。
    // TODO(PM 確認)：寫入方法後綴沿用 ChainseaApiMgr 既有慣例 .Save.data，實際方法名稱待對照 ECP 文件確認。
    PersonalDataChangeApi: {
        EcpUnitPath: 'CUS.ChangeBasicInfo.Save.data'
    },

    // 發票資訊變更申請：與個人資料變更共用同一個 ECP 單元 CUS.ChangeBasicInfo（PM 已確認），
    // 差別只在欄位對應不同，見 Api/InvoiceInfoChangeApiMgr.js 的 mapToEcpFields()。
    InvoiceInfoChangeApi: {
        EcpUnitPath: 'CUS.ChangeBasicInfo.Save.data'
    },

    // 身分證等證明文件上傳限制（僅 PersonalDataChange 流程使用）
    PersonalDataChangeUpload: {
        MaxFileSizeMB: 10,
        MaxFileCount: 5,
        AllowedExt: ['.jpg', '.jpeg', '.png', '.pdf']
    },

    // 代理人流程附件上傳限制（切結書/代理人證件/會員證件，走獨立 /AgentUpload 端點，不經 ask_input）。
    // 與前端 AgentForm.js 的 UPLOADS 限制（僅 jpg/jpeg/png、單檔 10MB、單項最多 10 個）保持一致。
    AgentUpload: {
        MaxFileSizeMB: 10,
        MaxFileCount: 10,
        AllowedExt: ['.jpg', '.jpeg', '.png']
    },

    // 欠費查詢（共用，供任何「申請/送單」類流程進入時檢查；僅提示、不擋收單）。
    // TODO(PM 確認)：客戶欠費查詢 API 規格（Product/development 網址、request 帶哪個欄位當查詢 key）
    OverdueQuery: {
        Product: { Url: 'https://prod-host/api/member/overdue' },
        development: { Url: 'https://dev-host/api/member/overdue' },
        Qbi: { Url: './data/OverdueQbiResponse.json' }
    },

    // TODO(客戶提供)：FF-05-01 帳務查詢及繳款，客戶尚未提供 API 規格，Product/development 先放 placeholder，
    // 目前 Mode 固定用 Qbi 讀本機 mock（見 data/PaymentHistoryQbiResponse.json），待客戶 API 到位後再補上實際網址與帶入欄位。
    PaymentHistoryQuery: {
        Product: { Url: 'https://prod-host/api/member/payment-history' },
        development: { Url: 'https://dev-host/api/member/payment-history' },
        Qbi: { Url: './data/PaymentHistoryQbiResponse.json' }
    }
};
