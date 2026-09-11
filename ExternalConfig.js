module.exports = {
    Mode: 'Qbi',              // 'Product' | 'development' | 'Qbi'
    port: 3017,
    ErrorMaxCount: 3,
    RequestTimeout: 50000,

    // 純 Web 通路，不含 Phone(IVR)，故不設 TransferCode。

    EcpApi: {
        Url: '',               // TODO(PM 確認)：ECP 對話紀錄寫回端點；未設就不寫紀錄
        Authorization: ''      // 由部署平台環境變數注入，勿硬編碼
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

    // 個人資料變更申請：受理後資料回寫 ECP 單元。
    // TODO(PM 確認)：實際 ECP 單元路徑（目前沿用 EcpApi.Url 基底 + 下方 unit 佔位字串，待確認正式單元名稱與欄位對應）
    PersonalDataChangeApi: {
        EcpUnitPath: 'CUS.MemberDataChangeApply.Save.data'
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
