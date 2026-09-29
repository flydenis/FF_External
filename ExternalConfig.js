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

    // 會籍請假暫停申請的證明文件上傳限制，走獨立 /LeaveUpload 端點。
    LeaveUpload: {
        MaxFileSizeMB: 10,
        MaxFileCount: 5,
        AllowedExt: ['.jpg', '.jpeg', '.png']
    },

    // TODO(PM 確認)：客戶鞋櫃租賃資訊查詢 API 規格（Product/development 網址、request 帶哪個欄位當查詢 key）；
    // 目前尚無正式 API 可串，先以 Qbi 模式讀本機假資料展示效果。
    LockerQuery: {
        Product: { Url: 'https://prod-host/api/member/locker-rental' },
        development: { Url: 'https://dev-host/api/member/locker-rental' },
        Qbi: { Url: './data/LockerQbiResponse.json' }
    },
    // 扣款卡片變更申請的信用卡授權書上傳限制（單檔，僅 jpg/png/jpeg），走獨立 /DeductionCardChangeUpload 端點。
    DeductionCardChangeUpload: {
        MaxFileSizeMB: 10,
        MaxFileCount: 1,
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
    },

    // TODO(客戶提供)：查詢月費扣款日，客戶尚未提供 API 規格，Product/development 先放 placeholder，
    // 目前 Mode 固定用 Qbi 讀本機 mock（見 data/PaymentDueDateQbiResponse.json），待客戶 API 到位後再補上實際網址與帶入欄位。
    // 先只處理單一合約情境（PM 已確認），多合約情境待之後有需求再補。
    PaymentDueDateQuery: {
        Product: { Url: 'https://prod-host/api/member/payment-due-date' },
        development: { Url: 'https://dev-host/api/member/payment-due-date' },
        Qbi: { Url: './data/PaymentDueDateQbiResponse.json' }
    },

    // TODO(客戶提供)：扣款卡片資訊查詢，客戶尚未提供 API 規格，Product/development 先放 placeholder，
    // 目前 Mode 固定用 Qbi 讀本機 mock（見 data/DeductionCardQbiResponse.json），待客戶 API 到位後再補上實際網址與帶入欄位。
    // 先只處理單一合約情境（PM 已確認），多合約情境待之後有需求再補。
    DeductionCardQuery: {
        Product: { Url: 'https://prod-host/api/member/deduction-card' },
        development: { Url: 'https://dev-host/api/member/deduction-card' },
        Qbi: { Url: './data/DeductionCardQbiResponse.json' }
    },

    // TODO(客戶提供)：會籍合約資料查詢，客戶尚未提供 API 規格，Product/development 先放 placeholder，
    // 目前 Mode 固定用 Qbi 讀本機 mock（見 data/ContractQbiResponse.json），待客戶 API 到位後再補上實際網址與帶入欄位。
    ContractQuery: {
        Product: { Url: 'https://prod-host/api/member/contract' },
        development: { Url: 'https://dev-host/api/member/contract' },
        Qbi: { Url: './data/ContractQbiResponse.json' }
    },

    // TODO(架構待確認)：ECP 待處理表單目前沒有單一端點可一次查到所有 CUS.* 類型（PM 已確認先用 Qbi mock 假設
    // 已經整合好的結果，待客戶/架構確認真正的查詢機制後再調整）。
    EcpPendingApplicationQuery: {
        Product: { Url: 'https://prod-host/api/ecp/pending-applications' },
        development: { Url: 'https://dev-host/api/ecp/pending-applications' },
        Qbi: { Url: './data/EcpPendingApplicationQbiResponse.json' }
    },

    // TODO(客戶提供)：健身工廠會員系統各類別最近一筆申請，客戶尚未提供 API 規格，先用 Qbi mock。
    MemberSystemApplicationQuery: {
        Product: { Url: 'https://prod-host/api/ff/member-applications' },
        development: { Url: 'https://dev-host/api/ff/member-applications' },
        Qbi: { Url: './data/MemberSystemApplicationQbiResponse.json' }
    },

    // TODO(客戶提供)：教練合約異動申辦進度（課程轉讓／課程終止／更換教練，會員系統這段），客戶尚未提供 API 規格，先用 Qbi mock。
    CoachApplicationQuery: {
        Product: { Url: 'https://prod-host/api/ff/coach-applications' },
        development: { Url: 'https://dev-host/api/ff/coach-applications' },
        Qbi: { Url: './data/CoachApplicationQbiResponse.json' }
    },

    // TODO(架構待確認)：教練版 ECP 待處理表單，跟 FF-06-01 會籍版一樣目前沒有單一端點可查，PM 已確認先用 Qbi mock。
    CoachPendingApplicationQuery: {
        Product: { Url: 'https://prod-host/api/ecp/coach-pending-applications' },
        development: { Url: 'https://dev-host/api/ecp/coach-pending-applications' },
        Qbi: { Url: './data/CoachPendingApplicationQbiResponse.json' }
    },

    // 當前已生效請假紀錄查詢。TODO(架構待確認)：規格附錄資料字典裡 U_StopDuring（已生效請假起訖日）
    // 屬於 TpCUSmStartMembership（提前開啟請假會籍）單元，實際上線後應可能改用 getListData 查真實資料
    // （已驗證 getListData 這個查詢機制可用），目前先用 Qbi mock。
    ActiveLeaveRecordQuery: {
        Product: { Url: 'https://prod-host/api/member/active-leave-record' },
        development: { Url: 'https://dev-host/api/member/active-leave-record' },
        Qbi: { Url: './data/ActiveLeaveRecordQbiResponse.json' }
    },

    // TODO(客戶提供)：教練合約資料查詢（FF-07-01 子項 1），客戶尚未提供 API 規格，先用 Qbi mock。
    // 規格【功能說明】3.：僅提供合約狀態為已結帳／已審核／到期／請假且尚有剩餘堂數者，Qbi mock 直接只放
    // 符合資格的資料（比照其他查詢類流程的簡單 found/not-found 作法，不在流程內另做狀態分支）。
    CoachContractQuery: {
        Product: { Url: 'https://prod-host/api/member/coach-contract' },
        development: { Url: 'https://dev-host/api/member/coach-contract' },
        Qbi: { Url: './data/CoachContractQbiResponse.json' }
    },

    // TODO(客戶提供)：教練帳務・繳費紀錄查詢（FF-07-01 子項 3），客戶尚未提供 API 規格，先用 Qbi mock。
    CoachPaymentHistoryQuery: {
        Product: { Url: 'https://prod-host/api/member/coach-payment-history' },
        development: { Url: 'https://dev-host/api/member/coach-payment-history' },
        Qbi: { Url: './data/CoachPaymentHistoryQbiResponse.json' }
    },

    // TODO(客戶提供)：會籍合約異動申辦初始頁資料（FF-04-01 升等表單預帶），客戶尚未提供 API 規格，先用 Qbi mock。
    ChangeMembershipInitQuery: {
        Product: { Url: 'https://prod-host/api/member/change-membership-init' },
        development: { Url: 'https://dev-host/api/member/change-membership-init' },
        Qbi: { Url: './data/ChangeMembershipInitQbiResponse.json' }
    },

    // 會籍資格升等（FF-04-01）設定。
    //   AllowedContractStatus：可申請的合約狀態代碼（1 已結帳、7 已審核＝當前生效中）——假設，待 PM 確認 Q15。
    //   WorkingDaysBeforeActivation／Holidays：啟用日＝申請日後數滿 N 個工作日再往後一天。工作日只排除週六日，
    //   國定假日先不排除（2026-09-23 決定），Holidays 保持空陣列；日後要排除時填 'YYYY-MM-DD'。
    //   DualRegionEnabled：雙區卡為未來規劃，上線前隱藏（false）——待 PM 確認 Q6。
    //   WriteDetailFields：送單時一併寫 U_UpMembership／U_OldCardType／U_OldMembership／U_OldAvailableVenue
    //   （2026-09-29 ECP 試建，待 SA 確認 Q11／Q12；ECP 若刪掉這 4 欄，這裡改 false）。
    ChangeMembership: {
        AllowedContractStatus: ['1', '7'],
        WorkingDaysBeforeActivation: 3,
        Holidays: [],
        DualRegionEnabled: false,
        WriteDetailFields: true
    }
};
