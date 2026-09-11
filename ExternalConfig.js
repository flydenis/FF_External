module.exports = {
    Mode: 'Qbi',              // 'Product' | 'development' | 'Qbi'
    port: 3017,
    ErrorMaxCount: 3,
    RequestTimeout: 50000,

    // 純 Web 通路，不含 Phone(IVR)，故不設 TransferCode。

    EcpApi: {
        Url: 'https://fitness-factory-km.qbicloud.com/ecp/',// TODO(PM 確認)：ECP 對話紀錄寫回端點；未設就不寫紀錄
        Authorization: 'Authorization: Basic YXBpX3VzZXI6Q1NpaUBbNzcwNjYxODhd'      // 由部署平台環境變數注入，勿硬編碼
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

    // 身分證等證明文件上傳限制（僅 PersonalDataChange 流程使用）
    PersonalDataChangeUpload: {
        MaxFileSizeMB: 10,
        MaxFileCount: 5,
        AllowedExt: ['.jpg', '.jpeg', '.png', '.pdf']
    },

    // 欠費查詢（共用，供任何「申請/送單」類流程進入時檢查；僅提示、不擋收單）。
    // TODO(PM 確認)：客戶欠費查詢 API 規格（Product/development 網址、request 帶哪個欄位當查詢 key）
    OverdueQuery: {
        Product: { Url: 'https://prod-host/api/member/overdue' },
        development: { Url: 'https://dev-host/api/member/overdue' },
        Qbi: { Url: './data/OverdueQbiResponse.json' }
    }
};
