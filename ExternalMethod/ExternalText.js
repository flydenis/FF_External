// 所有對使用者的問句/提示/結果語集中在此；流程只引用不寫死。
var ExternalText = {
    Public: {
        ServiceError: '目前服務忙線中，請稍後再試。',
        ReturnSystemErrorMessage: '不好意思，目前系統異常，請稍後再試。',
        GiveUp: '您輸入錯誤已達上限，請重新發起本次申請，或聯繫客服協助。'
    },
    ExcallStatus: { Finish: '0', Continue: '1' },
    MessageType: { Text: 'Text', Cards: 'Cards', QuickReply: 'QuickReply' },
    Options: { Yes: '是', No: '否' },
    YesList: ['1', '是', '對', '正確', '沒錯', 'yes', 'y', '確認', '好'],
    NoList: ['2', '否', '不是', '不對', '錯誤', 'no', 'n', '取消', '重新輸入'],

    // Web 一般 HTML 按鈕的預設樣式（顏色/預設主色在此調；由 IntentBaseFlow.buildButtons 使用）。
    ButtonStyle: {
        Primary: 'display:inline-flex;align-items:center;padding:8px 24px;border-radius:9999px;font-weight:500;border:none;background-color:#2563eb;color:#ffffff;margin:0 5px 5px 0;',
        Secondary: 'display:inline-flex;align-items:center;padding:8px 24px;border-radius:9999px;font-weight:500;border:1px solid #d0d5dd;background-color:#ffffff;color:#333333;margin:0 5px 5px 0;',
        ContainerStyle: 'display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;'
    },

    // 請假流程（會籍暫停/延展）— 純 Web 表單式。C010 問身分 → C020 分派（本人自處理 / 代理人交共用 AgentFlow）。
    LeaveFlow: {
        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: 'SELF', style: 'Secondary' },
            { label: '代理他人申辦', submit: 'AGENT', style: 'Primary' }
        ],
        IdentityInvalid: '請點選「本人申辦」或「代理他人申辦」。',

        // 本人表單觸發旗標（C020 只回 parameters:{ SelfForm:'SelfForm' }，前端據此自繪本人表單）。
        SelfFormFlag: 'SelfForm',
        SelfDone: '單號建置完成，若還有疑問請聯繫客服。',
        SelfInvalid: '表單資料不完整，請確認後重新送出。', // TODO(你提供)：本人表單欄位確認後調整核實規則
        Cancelled: '已為您取消本次申請。',

        // 交給共用 AgentFlow 時帶入：申辦類型（寫 U_ApplicationType）＋ 轉專人 parameters 的 value。
        // ToAgentValue 標明是「哪一支外部流程」呼叫 AgentFlow（送件後回 parameters:{ ToAgent: <此值> }），
        // 之後打 ECP 也會用到此值（屆時轉成對應中文再送）。其他流程重用 AgentFlow 時各自填自己的值。
        // TODO(PM 確認)：ApplicationType 須與內部系統下拉選單「會籍暫停(請假/延展)」逐字一致。
        ApplicationType: '會籍暫停(請假/延展)',
        ToAgentValue: 'ToAgentOfLeaveFlow'
    },

    // 共用「代理他人申辦」子流程（AgentFlow）——供各申請流程重用，只維護這一支。
    AgentFlow: {
        // 表單觸發旗標（前端據此自繪代理人表單；後端不送欄位定義）。
        FormFlag: 'AgentForm',
        // 轉專人 parameters 的「固定 key」；value 由呼叫端帶入（見各流程的 ToAgentValue）。
        ToAgentKey: 'ToAgent',
        Done: '單號建置完成，將為您轉接專人，由專人為您服務。',
        Cancelled: '已為您取消本次代理人申請。',
        Invalid: '請確認已勾選須知，且代理人姓名、代理人聯絡電話、受託會員姓名/會員編號皆已填寫，並完成三項文件（切結書、代理人證件、會員證件）上傳。',

        // 後端核實 / 寫附件用（不送前端）：欄位 name 對應前端送回 JSON、上傳 code 對應前端回傳狀態、label 當附件檔名。
        Uploads: [
            { code: 'DOWNLOAD_CONSENT', label: '切結書' },
            { code: 'UPLOAD_AGENT_ID', label: '代理人證件' },
            { code: 'UPLOAD_MEMBER_ID', label: '會員證件' }
        ]
    },

    // 會員體驗資訊查詢流程文案（節點以 C010 起編）
    MemberInfo: {
        Intro: '已為您查詢體驗資訊如下：',
        NotFound: '很抱歉，查無您的體驗會員資訊！建議您洽詢客服人員或現場服務人員，由專人協助您進一步確認，謝謝！',

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            Card: 'background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            StatusBadge: 'color:#f5a623;font-weight:600;font-size:13px;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;',
            Note: 'background:#fff8e1;color:#8a6d00;border-radius:8px;padding:10px 12px;margin-top:10px;font-size:13px;line-height:1.5;'
        },
        NoteText: '體驗期間歡迎洽詢健身顧問，了解專屬入會方案。',

        // 依查詢結果組 HTML 卡片。record 欄位對應 Api/MemberApiMgr 正規化後的資料。
        buildCard(record) {
            const s = ExternalText.MemberInfo.CardStyle;
            const period = `${record.trialStartDate || ''} ～ ${record.trialEndDate || ''}`;
            const advisor = [record.advisorCode, record.advisorName].filter(Boolean).join(' ');
            return `${ExternalText.MemberInfo.Intro}` +
                `<div style="${s.Card}">` +
                `<div style="display:flex;justify-content:space-between;align-items:center;">` +
                `<span style="${s.Title}">體驗會員資訊</span><span style="${s.StatusBadge}">${record.trialStatus || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">姓名</span><span style="${s.Value}">${record.name || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">體驗廠館</span><span style="${s.Value}">${record.storeName || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">體驗起訖日</span><span style="${s.Value}">${period}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">服務顧問</span><span style="${s.Value}">${advisor}</span></div>` +
                `<div style="${s.Note}">${ExternalText.MemberInfo.NoteText}</div>` +
                `</div>`;
        }
    },

    // 登記地址查詢流程文案（節點以 C010 起編）
    ContactAddress: {
        Intro: '您目前登記的地址如下（如需變更請至「個人資料變更」）：',
        NotFound: '很抱歉，查無您的登記地址資訊！建議您洽詢客服人員或現場服務人員，由專人協助您進一步確認，謝謝！',

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            Card: 'background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;'
        },

        // 依查詢結果組 HTML 卡片。record 欄位對應 Api/ContactAddressApiMgr 正規化後的資料。
        buildCard(record) {
            const s = ExternalText.ContactAddress.CardStyle;
            return `${ExternalText.ContactAddress.Intro}` +
                `<div style="${s.Card}">` +
                `<div style="${s.Title}">登記地址</div>` +
                `<div style="${s.Row}"><span style="${s.Label}">戶籍地址</span><span style="${s.Value}">${record.householdAddress || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">通訊地址</span><span style="${s.Value}">${record.contactAddress || ''}</span></div>` +
                `</div>`;
        }
    },

    // 登記電話查詢流程文案（節點以 C010 起編）
    Phone: {
        Intro: '您目前登記的電話如下（如需變更請至「個人資料變更」）：',
        NotFound: '很抱歉，查無您的登記電話資訊！建議您洽詢客服人員或現場服務人員，由專人協助您進一步確認，謝謝！',

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            Card: 'background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;'
        },

        // 依查詢結果組 HTML 卡片。record 欄位對應 Api/PhoneApiMgr 正規化後的資料。
        buildCard(record) {
            const s = ExternalText.Phone.CardStyle;
            return `${ExternalText.Phone.Intro}` +
                `<div style="${s.Card}">` +
                `<div style="${s.Title}">登記電話</div>` +
                `<div style="${s.Row}"><span style="${s.Label}">行動電話</span><span style="${s.Value}">${record.mobilePhone || ''}</span></div>` +
                `</div>`;
        }
    }
};

module.exports = ExternalText;
