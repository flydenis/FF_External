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
    }
};
