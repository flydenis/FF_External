// 所有對使用者的問句/提示/結果語集中在此；流程只引用不寫死。
const CommonMethod = require('./CommonMethod');

var ExternalText = {
    Public: {
        ServiceError: '目前服務忙線中，請稍後再試。',
        ReturnSystemErrorMessage: '不好意思，目前系統異常，請稍後再試。',
        // 共用欠費提醒：由 IntentBaseFlow.checkOverdueNotice() 附加在各「申請/送單」類流程的開場訊息前面。
        OverdueNotice: '若有欠款則無法受理，請先查詢帳務繳費紀錄，並至廠館繳清費用，再提出申請。',
        GiveUp: '您輸入錯誤已達上限，請重新發起本次申請，或聯繫客服協助。'
    },
    ExcallStatus: { Finish: '0', Continue: '1' },
    MessageType: { Text: 'Text', Cards: 'Cards', QuickReply: 'QuickReply' },
    Options: { Yes: '是', No: '否' },
    YesList: ['1', '是', '對', '正確', '沒錯', 'yes', 'y', '確認', '好'],
    NoList: ['2', '否', '不是', '不對', '錯誤', 'no', 'n', '取消', '重新輸入'],

    // Web 一般 HTML 按鈕的預設樣式（顏色/預設主色在此調；由 IntentBaseFlow.buildButtons 使用）。
    // PM 要求所有選項按鈕一律白底，不要一個藍一個白（原本 Primary 是藍底白字凸顯主要選項），
    // 故 Primary 直接改成跟 Secondary 一樣的白底樣式；buttons 陣列裡標 style:'Primary'/'Secondary' 的地方都不用改。
    ButtonStyle: {
        Primary: 'display:inline-flex;align-items:center;padding:8px 24px;border-radius:9999px;font-weight:500;border:1px solid #d0d5dd;background-color:#ffffff;color:#333333;margin:0 5px 5px 0;',
        Secondary: 'display:inline-flex;align-items:center;padding:8px 24px;border-radius:9999px;font-weight:500;border:1px solid #d0d5dd;background-color:#ffffff;color:#333333;margin:0 5px 5px 0;',
        ContainerStyle: 'display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;'
    },

    // 請假流程（會籍暫停/延展）— 純 Web 表單式。
    //   C010 問請假方式（暫停/延展）→ C015 問身分 → C020 分派（本人自處理 / 代理人交共用 AgentFlow）。
    LeaveFlow: {
        StopTypeAsk: '請選擇請假方式：',
        StopTypeButtons: [
            { label: '會籍暫停（需檢附證明）', submit: '會籍暫停', style: 'Secondary' },
            { label: '會籍延展（免檢附證明／每月 $300 元）', submit: '會籍延展', style: 'Primary' }
        ],
        StopTypeInvalid: '請點選「會籍暫停」或「會籍延展」。',

        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: '本人申辦', style: 'Secondary' },
            { label: '代理他人申辦', submit: '代理他人申辦', style: 'Primary' }
        ],
        // 身分別的 Cards 呈現（試作，僅 C015 用）：本人／代理人合併在同一張卡片的兩顆按鈕，不要拆成兩張卡。
        // value 沿用 IdentityButtons 的 submit 代碼，C020 解析邏輯不必跟著改。
        IdentityCards: [
            {
                title: '確認申辦身分',
                subTitle: '請選擇本次由本人或代理人辦理申請',
                buttons: [
                    { text: '本人申辦', action: 'option', value: 'SELF' },
                    { text: '代理他人申辦', action: 'option', value: 'AGENT' }
                ]
            }
        ],
        IdentityInvalid: '請點選「本人申辦」或「代理他人申辦」。',

        // 本人表單觸發旗標：暫停 → SelfForm（C030_Self）；延展 → ExtensionForm（C030_ExtensionSelf）。前端據此自繪對應表單。
        SelfFormFlag: 'SelfForm',
        SelfDone: '單號建置完成，若還有疑問請聯繫客服。',
        SelfInvalid: '表單資料不完整，請確認後重新送出。', // TODO(你提供)：本人表單欄位確認後調整核實規則
        ExtensionFormFlag: 'ExtensionForm',
        ExtensionDone: '單號建置完成，若還有疑問請聯繫客服。',
        ExtensionInvalid: '表單資料不完整，請確認後重新送出。',
        Cancelled: '已為您取消本次申請。',

        // 會籍暫停(請假/延展) 寫入 U_MembershipStop 的代碼（PM 已確認：請假 S、展延 E）。
        MembershipStopCode: { Pause: 'S', Extend: 'E' },

        // 交給共用 AgentFlow 時帶入：申辦類型（寫 U_ApplicationType）＋ 轉專人 parameters 的 value。
        // ToAgentValue 標明是「哪一支外部流程」呼叫 AgentFlow（送件後回 parameters:{ ToAgent: <此值> }）。
        // ApplicationType 依規格書 TpCUSmAgentApplication 的 U_ApplicationType 代碼表：5＝會籍暫停(請假/延展)
        // （代碼表：1個資變更、2扣款卡片變更、3提前開啟請假會籍、4會籍升等/轉館/轉館加升等、5會籍暫停(請假/延展)、6會籍解約取消退會、7教練課程解約/取消解約）。
        ApplicationType: '5',
        ToAgentValue: 'ToAgentOfLeaveFlow'
    },

    // 教練合約解約申請流程 — 純 Web 表單式。C010 問身分 → C020 分派（本人自處理 / 代理人交共用 AgentFlow）。
    CoachContractTerminationFlow: {
        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: '本人申辦', style: 'Secondary' },
            { label: '代理他人申辦', submit: '代理他人申辦', style: 'Primary' }
        ],
        IdentityInvalid: '請點選「本人申辦」或「代理他人申辦」。',

        // 本人表單觸發旗標（C020 只回 parameters:{ CoachContractTerminationForm:'CoachContractTerminationForm' }，
        // 前端 CoachContractTerminationForm.js 據此自繪表單）。
        SelfFormFlag: 'CoachContractTerminationForm',
        SelfDone: '單號建置完成，若還有疑問請聯繫客服。',
        SelfInvalid: '表單資料不完整，請確認後重新送出。',
        Cancelled: '已為您取消本次申請。',

        // 交給共用 AgentFlow 時帶入：申辦類型（寫 U_ApplicationType）＋ 轉專人 parameters 的 value。
        // ApplicationType 依規格書 U_ApplicationType 代碼表：7＝教練課程解約/取消解約（見 LeaveFlow.ApplicationType 註解的完整代碼表）。
        ApplicationType: '7',
        ToAgentValue: 'ToAgentOfCoachContractTerminationFlow'
    },

    // 會籍解約申請流程 — 純 Web 表單式。C010 問身分 → C020 分派（本人自處理 / 代理人交共用 AgentFlow）。
    MembershipTerminationFlow: {
        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: '本人申辦', style: 'Secondary' },
            { label: '代理他人申辦', submit: '代理他人申辦', style: 'Primary' }
        ],
        IdentityInvalid: '請點選「本人申辦」或「代理他人申辦」。',

        // 本人表單觸發旗標（C020 只回 parameters:{ MembershipTerminationForm:'MembershipTerminationForm' }，
        // 前端 MembershipTerminationForm.js 據此自繪表單）。
        SelfFormFlag: 'MembershipTerminationForm',
        SelfDone: '單號建置完成，若還有疑問請聯繫客服。',
        SelfInvalid: '表單資料不完整，請確認後重新送出。',
        Cancelled: '已為您取消本次申請。',

        // 交給共用 AgentFlow 時帶入：申辦類型（寫 U_ApplicationType）＋ 轉專人 parameters 的 value。
        // ApplicationType 依規格書 U_ApplicationType 代碼表：6＝會籍解約取消退會（見 LeaveFlow.ApplicationType 註解的完整代碼表）。
        ApplicationType: '6',
        ToAgentValue: 'ToAgentOfMembershipTerminationFlow'
    },

    // 提前開啟請假會籍申請流程（FF-04-05）— 純 Web 表單式。C010 問身分 → C020 分派（本人自處理 / 代理人交共用 AgentFlow）。
    PauseEarlyOpenFlow: {
        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: '本人申辦', style: 'Secondary' },
            { label: '代理他人申辦', submit: '代理他人申辦', style: 'Primary' }
        ],
        IdentityInvalid: '請點選「本人申辦」或「代理他人申辦」。',

        // 本人表單觸發旗標（C020 只回 parameters:{ PauseEarlyOpenForm:'PauseEarlyOpenForm' }，
        // 前端 PauseEarlyOpenForm.js 據此自繪表單）。
        SelfFormFlag: 'PauseEarlyOpenForm',
        SelfDone: '單號建置完成，若還有疑問請聯繫客服。',
        SelfInvalid: '表單資料不完整，請確認後重新送出。',
        Cancelled: '已為您取消本次申請。',

        // 開啟使用日期僅能選申請日 7 天後（規格書：因應申請工作天，線上表單僅能填選七日後日期）。
        MinOpenDateOffsetDays: 7,

        // 交給共用 AgentFlow 時帶入：申辦類型（寫 U_ApplicationType）＋ 轉專人 parameters 的 value。
        // ApplicationType 依規格書 U_ApplicationType 代碼表：3＝提前開啟請假會籍（見 LeaveFlow.ApplicationType 註解的完整代碼表）。
        ApplicationType: '3',
        ToAgentValue: 'ToAgentOfPauseEarlyOpenFlow'
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
            TitleRow: 'display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #f5c518;',
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
                `<div style="${s.TitleRow}">` +
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
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
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
                `<div style="${s.TitleRow}"><span style="${s.Title}">登記地址</span></div>` +
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
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
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
                `<div style="${s.TitleRow}"><span style="${s.Title}">登記電話</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">行動電話</span><span style="${s.Value}">${record.mobilePhone || ''}</span></div>` +
                `</div>`;
        }
    },

    // 鞋櫃租賃資訊查詢流程文案（節點以 C010 起編）。一個會員可能有多筆合約，一個合約＋鞋櫃一張卡片、
    // 橫向排列可左右滑動（最多 10 張），不同於其他查詢流程只回單一卡片。
    LockerInfo: {
        Intro: '您的鞋櫃租賃資訊如下（一個合約＋鞋櫃一張卡片，最多 10 張，可點左右箭頭切換）：',
        NotFound: '很抱歉，查無您的鞋櫃租賃資訊！建議您洽詢客服人員或現場服務人員，由專人協助您進一步確認，謝謝！',

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。Scroller 讓多張卡片橫向排列；
        // SA 要求手機上不要用滑動軸，改用左右箭頭點擊切換（Arrow* 兩顆按鈕），Scroller 保留 overflow-x
        // 只是給 scrollBy() 平滑捲動用，原生捲軸另外用 CSS 隱藏（見 buildCards 內嵌的一次性 <style>）。
        CardStyle: {
            Wrap: 'position:relative;',
            // 寬度上限改用 width:1px + min-width:100% 這組經典技巧，而非 vw：
            // vw 在手機上不可靠，只要頁面任一處已有一點點溢出，vw 的計算基準就會被拉大成比實際可視寬度還寬，
            // 反而讓整排卡片更容易撐爆版面（桌機測試正常、手機版跑版就是這個原因）。
            // width:1px 讓瀏覽器不用這個 flex 容器裡一排卡片的「內容自然寬度」來決定容器寬度，
            // 改用 min-width:100% 逼它服從訊息泡泡原本該有的寬度（單張卡片時泡泡本身就撐得剛好，這裡只是不讓它被撐大)，
            // overflow-x:auto 才會在「泡泡寬度」而不是「內容寬度」這個基準上正確觸發捲動。
            // 左右各留 34px padding 給箭頭按鈕放置的空間，避免箭頭疊到卡片內文字。
            Scroller: 'display:flex;gap:12px;overflow-x:auto;width:1px;min-width:100%;box-sizing:border-box;padding:4px 34px 8px;margin-top:8px;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;',
            Card: 'flex:0 0 auto;width:220px;background:#ffffff;border-radius:12px;padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;padding-bottom:10px;border-bottom:3px solid #f5c518;margin-bottom:4px;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px dashed #ececec;font-size:13px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;',
            ArrowLeft: 'position:absolute;left:2px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.95);border:1px solid #e5e5e5;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;line-height:1;color:#555;cursor:pointer;z-index:2;padding:0;',
            ArrowRight: 'position:absolute;right:2px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.95);border:1px solid #e5e5e5;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;line-height:1;color:#555;cursor:pointer;z-index:2;padding:0;'
        },

        // 一張卡片（含左右間距）的捲動步進值：Card 寬 220 + Scroller 的 gap 12。箭頭一次點擊移動一張卡片。
        CardStep: 232,

        // 合約起訖日顯示用短格式（YYYY-MM-DD -> YY/MM），對應畫面上的「26/01 ～ 26/12」樣式。
        formatShortDate(dateStr) {
            const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateStr || '');
            return m ? `${m[1].slice(2)}/${m[2]}` : (dateStr || '');
        },

        // 依查詢結果組多張橫向卡片，改用左右箭頭點擊切換（手機為主要通路，箭頭比滑動軸好點按）。
        // records 欄位對應 Api/LockerApiMgr 正規化後的資料（陣列，最多 10 筆）。
        buildCards(records) {
            const L = ExternalText.LockerInfo;
            const s = L.CardStyle;
            const list = records || [];
            const cardsHtml = list.map(r => {
                const period = `${L.formatShortDate(r.startDate)} ～ ${L.formatShortDate(r.endDate)}`;
                return `<div style="${s.Card}">` +
                    `<div style="${s.Title}">鞋櫃合約 ${r.contractNo || ''}</div>` +
                    `<div style="${s.Row}"><span style="${s.Label}">合約起訖</span><span style="${s.Value}">${period}</span></div>` +
                    `<div style="${s.Row}"><span style="${s.Label}">方案種類</span><span style="${s.Value}">${r.planType || ''}</span></div>` +
                    `<div style="${s.Row}"><span style="${s.Label}">鞋櫃分館</span><span style="${s.Value}">${r.storeName || ''}</span></div>` +
                    `<div style="${s.Row}"><span style="${s.Label}">鞋櫃類別</span><span style="${s.Value}">${r.lockerType || ''}</span></div>` +
                    `<div style="${s.Row}"><span style="${s.Label}">鞋櫃編號</span><span style="${s.Value}">${r.lockerNo || ''}</span></div>` +
                    `</div>`;
            }).join('');
            // 每則訊息的捲動容器 id 各自獨立（用 crypto 亂數，不是 Math.random），避免聊天紀錄裡多筆鞋櫃卡片訊息的 id 互相打架。
            const scrollId = 'lki-scroll-' + CommonMethod.randomDigits(6);
            // 原生捲軸用 class 統一隱藏（inline style 沒辦法寫 ::-webkit-scrollbar 這種偽元素），
            // 用 <script> 動態建立一次共用 <style>，同一個 chatId 下多筆卡片訊息只會建立一次（用 id 判斷是否已建立過）。
            const hideScrollbarStyle = `<script>(function(){if(!document.getElementById('lki-style')){var st=document.createElement('style');st.id='lki-style';st.textContent='.lki-scroller::-webkit-scrollbar{display:none}';document.head.appendChild(st);}})();</script>`;
            const arrowsHtml = list.length > 1
                ? `<button type="button" style="${s.ArrowLeft}" onclick="document.getElementById('${scrollId}').scrollBy({left:-${L.CardStep},behavior:'smooth'})" aria-label="上一張">‹</button>` +
                  `<button type="button" style="${s.ArrowRight}" onclick="document.getElementById('${scrollId}').scrollBy({left:${L.CardStep},behavior:'smooth'})" aria-label="下一張">›</button>`
                : '';
            return `${L.Intro}${hideScrollbarStyle}<div style="${s.Wrap}"><div id="${scrollId}" class="lki-scroller" style="${s.Scroller}">${cardsHtml}</div>${arrowsHtml}</div>`;
        }
    },

    // 帳務查詢及繳款流程文案（節點以 C010 起編，FF-05-01）。
    // 規格書 20260915 版【摘要段落】：已結帳／到期／終止／請假／已審核／轉讓／行政中止 共 7 種合約狀態
    // 都可查近三個月繳費紀錄（PM 2026-09-17 已確認以此摘要段落為準，非僅限「目前生效中」三種狀態）；
    // 行政中止固定顯示 AdminHoldNote（不論帳款狀態）；預繳型不論狀態一律顯示 PrepaidNote（無按月繳費紀錄）；
    // 不在上述 7 種狀態內者（如審核中）顯示 OtherStatusNote；在範圍內但近三個月無繳費紀錄顯示 EmptyRecordsNote。
    PaymentHistory: {
        Intro: '為您顯示當前生效的近三個月繳費紀錄：',
        NotFound: '很抱歉，查無您的合約帳務資訊！建議您洽詢客服人員或現場服務人員，由專人協助您進一步確認，謝謝！',
        SelectContractPrompt: '您目前有多筆合約，請選擇要查詢的合約：',
        SelectContractInvalid: '請點選上方合約按鈕。',
        OverdueReminder: '提醒您，尚有未繳款項，請儘速至廠館櫃台繳納及更新您的扣款資訊，避免影響您的會員權益。',
        AdminHoldNote: '合約欠款，請洽會員服務中心。',
        OtherStatusNote: '請洽廠館櫃檯或會員服務中心。',
        PrepaidNote: '預繳型會籍，無相關按月繳費紀錄。',
        EmptyRecordsNote: '三個月內無月費相關繳費紀錄。',
        FooterDisclaimer: '提醒您僅呈現近3筆，預繳型會員顯示「無按月繳費紀錄」。',

        // 規格【摘要段落】明列可查繳費紀錄的合約狀態（行政中止另有專屬分支，不重複列在此陣列）。
        ActiveStatuses: ['已結帳', '到期', '終止', '請假', '已審核', '轉讓'],
        AdminHoldStatus: '行政中止',
        BillingTypeLabel: { monthly: '月繳型', prepaid: '預繳型' },

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        // Card 固定寬度：聊天氣泡容器（.ChatMessageContent）是 inline-block，寬度會依內容縮放，
        // 6 欄表格跟純文字提示語混用時氣泡寬度會跳動，故此卡片改用固定寬度讓各種情境呈現一致大小。
        CardStyle: {
            Card: 'width:350px;box-sizing:border-box;background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            TitleRow: 'display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #f5c518;',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            TypeBadge: 'color:#f5a623;font-weight:600;font-size:13px;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;',
            SectionTitle: 'font-weight:700;font-size:14px;color:#1a1a1a;margin-top:14px;',
            RecordTable: 'border:1px solid #c4c9cf;border-radius:8px;overflow:hidden;margin-top:8px;',
            RecordHeaderRow: 'display:flex;background:#dde1e5;color:#4a4a4a;font-weight:700;font-size:12px;padding:8px 0;border-bottom:1px solid #c4c9cf;',
            RecordRow: 'display:flex;font-size:13px;color:#1a1a1a;padding:8px 0;border-bottom:1px solid #c4c9cf;',
            RecordRowLast: 'display:flex;font-size:13px;color:#1a1a1a;padding:8px 0;',
            RecordCell: 'flex:1;text-align:center;padding:0 4px;',
            RecordCellDivider: 'flex:1;text-align:center;padding:0 4px;border-left:1px solid #c4c9cf;',
            Note: 'background:#fff8e1;color:#8a6d00;border-radius:8px;padding:10px 12px;margin-top:10px;font-size:13px;line-height:1.5;'
        },

        yymm(dateStr) {
            const s = String(dateStr || '');
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return m ? `${m[1].slice(2)}/${m[2]}` : s;
        },

        mmdd(dateStr) {
            const s = String(dateStr || '');
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return m ? `${m[2]}-${m[3]}` : (s || '-');
        },

        // 多合約時，第一層讓使用者選擇要查詢哪一筆合約（Web HTML 按鈕，submit=合約編號）。
        buildSelectButtons(contracts) {
            const P = ExternalText.PaymentHistory;
            return (contracts || []).map(c => ({
                label: `${c.contractNo}（${P.yymm(c.startDate)}~${P.yymm(c.endDate)}）`,
                submit: c.contractNo,
                style: 'Secondary'
            }));
        },

        // 依單一合約組 HTML 卡片：表頭（合約編號/類型/起訖日）＋依狀態顯示繳費紀錄表或對應提示語。
        buildContractCard(contract) {
            const P = ExternalText.PaymentHistory;
            const s = P.CardStyle;
            const period = `${P.yymm(contract.startDate)} ~ ${P.yymm(contract.endDate)}`;
            const typeLabel = P.BillingTypeLabel[contract.billingType] || contract.billingType || '';

            let body;
            const records = (contract.paymentRecords || []).slice(0, 3);
            if (contract.contractStatus === P.AdminHoldStatus) {
                body = `<div style="${s.Note}">${P.AdminHoldNote}</div>`;
            } else if (contract.billingType === 'prepaid') {
                body = `<div style="${s.Note}">${P.PrepaidNote}</div>`;
            } else if (!P.ActiveStatuses.includes(contract.contractStatus)) {
                body = `<div style="${s.Note}">${P.OtherStatusNote}</div>`;
            } else if (!records.length) {
                body = `<div style="${s.Note}">${P.EmptyRecordsNote}</div>`;
            } else {
                const overdueNote = contract.overdue ? `<div style="${s.Note}">${P.OverdueReminder}</div>` : '';
                const cell = (text, isFirst) => `<span style="${isFirst ? s.RecordCell : s.RecordCellDivider}">${text}</span>`;
                const rows = records.map((r, i) => {
                    const amountText = `NT$${Number(r.amount || 0).toLocaleString()}`;
                    const dateText = r.actualDeductDate ? P.mmdd(r.actualDeductDate) : '-';
                    const refundText = r.refundDate ? P.mmdd(r.refundDate) : '-';
                    const rowStyle = i === records.length - 1 ? s.RecordRowLast : s.RecordRow;
                    return `<div style="${rowStyle}">` +
                        cell(r.seq != null ? r.seq : i + 1, true) +
                        cell(r.feeMonth || '', false) +
                        cell(amountText, false) +
                        cell(r.status || '', false) +
                        cell(dateText, false) +
                        cell(refundText, false) +
                        `</div>`;
                }).join('');
                body = overdueNote +
                    `<div style="${s.SectionTitle}">近三個月繳費紀錄</div>` +
                    `<div style="${s.RecordTable}">` +
                    `<div style="${s.RecordHeaderRow}">${cell('序號', true)}${cell('費用月份', false)}${cell('費用金額', false)}${cell('扣繳狀態', false)}${cell('實際扣繳日期', false)}${cell('退款日期', false)}</div>` +
                    rows +
                    `</div>`;
            }

            return `<div style="${s.Card}">` +
                `<div style="${s.TitleRow}"><span style="${s.Title}">繳費紀錄（合約 ${contract.contractNo}）</span><span style="${s.TypeBadge}">${typeLabel}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">合約起訖</span><span style="${s.Value}">${period}</span></div>` +
                body +
                `</div>` +
                `<div style="${s.Note}">${P.FooterDisclaimer}</div>`;
        }
    },

    // 查詢月費扣款日流程文案（節點以 C010 起編）。
    // PM 已確認：先只處理單一合約情境；預繳型無按月扣款日，另回 PrepaidNote。
    PaymentDueDate: {
        Intro: '您的月費扣款日說明如下：',
        NotFound: '很抱歉，查無您的月費扣款日資訊！建議您洽詢客服人員或現場服務人員，由專人協助您進一步確認，謝謝！',
        PrepaidNote: '您的會籍為預繳型，無按月扣款日資訊。',

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            Card: 'background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;text-align:right;'
        },

        // 依查詢結果組 HTML 卡片。record 欄位對應 Api/PaymentDueDateApiMgr 正規化後的資料。
        buildCard(record) {
            const s = ExternalText.PaymentDueDate.CardStyle;
            return `${ExternalText.PaymentDueDate.Intro}` +
                `<div style="${s.Card}">` +
                `<div style="${s.TitleRow}"><span style="${s.Title}">月費扣款日</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">扣款日</span><span style="${s.Value}">每月 ${record.dueDay} 日</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">特別說明</span><span style="${s.Value}">${record.note || ''}</span></div>` +
                `</div>`;
        }
    },

    // 扣款卡片資訊查詢流程文案（節點以 C010 起編）。
    // PM 已確認：先只處理單一合約情境；卡片下方「前往扣款卡片變更」按鈕點擊後，
    // 是送出一則固定文字訊息（ChangeButtonSubmit）讓平台依既有意圖設定重新路由，不在本流程內接下一步。
    DeductionCard: {
        Intro: '您現有及未來合約之扣款卡片：',
        NotFound: '很抱歉，查無您的扣款卡片資訊！建議您洽詢客服人員或現場服務人員，由專人協助您進一步確認，謝謝！',
        ChangeButtonLabel: '前往扣款卡片變更',
        ChangeButtonSubmit: '扣款卡片變更',

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            Card: 'background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;text-align:right;'
        },

        // 「前往扣款卡片變更」導覽列樣式（比照 UI 稿：滿版金框白底、右側 chevron），
        // 與一般 IntentBaseFlow.buildButtons 的圓角按鈕不同，故本流程獨立組 HTML，不共用 ButtonStyle。
        ChangeButtonStyle: {
            Container: 'margin-top:10px;',
            Button: 'display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;padding:14px 16px;border-radius:12px;border:1px solid #f5c518;background:#ffffff;color:#1a1a1a;font-weight:600;font-size:14px;text-align:left;cursor:pointer;',
            Chevron: 'color:#f5c518;font-size:16px;font-weight:700;margin-left:8px;'
        },

        // 組「前往扣款卡片變更」導覽列（點擊送出固定文字 ChangeButtonSubmit，見 DeductionCardQueryFlow 說明）。
        buildChangeButton() {
            const s = ExternalText.DeductionCard.ChangeButtonStyle;
            return `<div style="${s.Container}">` +
                `[link submit="${ExternalText.DeductionCard.ChangeButtonSubmit}"]` +
                `<button style="${s.Button}"><span>${ExternalText.DeductionCard.ChangeButtonLabel}</span><span style="${s.Chevron}">›</span></button>` +
                `[/link]</div>`;
        },

        // 依查詢結果組 HTML 卡片。record 欄位對應 Api/DeductionCardApiMgr 正規化後的資料。
        buildCard(record) {
            const s = ExternalText.DeductionCard.CardStyle;
            const feeText = `NT$${Number(record.monthlyFee || 0).toLocaleString()}`;
            return `${ExternalText.DeductionCard.Intro}` +
                `<div style="${s.Card}">` +
                `<div style="${s.TitleRow}"><span style="${s.Title}">扣款卡片（合約 ${record.contractNo || ''}）</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">扣款月費</span><span style="${s.Value}">${feeText}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">每月扣款日</span><span style="${s.Value}">${record.dueDay || ''} 日</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">扣款銀行</span><span style="${s.Value}">${record.bankName || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">卡號末四碼</span><span style="${s.Value}">**** ${record.cardLastFour || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">有效年月</span><span style="${s.Value}">${record.validThru || ''}</span></div>` +
                `</div>`;
        }
    },

    // 扣款卡片變更申請流程文案（節點以 C010 起編，FF-05-02）。
    // FormFlag 對應前端 FormFlow.registerForm('DeductionCardChangeForm', ...) 註冊的 key，
    // C010 回 parameters:{ [FormFlag]: FormFlag } 觸發前端彈出表單。藍字／紅字提示語 PM 已確認需在
    // 對話中顯示（比照 InvoiceInfoChange 的紅字提示語作法，不只是表單內文字）。
    DeductionCardChange: {
        FormFlag: 'DeductionCardChangeForm',
        BlueNotice: '<span style="color:#2563eb;">僅受理卡片扣款人為會員本人者，其他請至廠館櫃台或會員服務中心辦理。</span>',
        RedNotice: '<span style="color:#e5484d;">申請內容請務必確認正確，以維護您的會籍權益。</span>',
        MissingContact: '請填寫正確的受理通知聯絡方式（手機號碼或 Email，擇一）。',
        MissingAuthLetter: '請上傳填妥之信用卡授權書後再送出。',
        SubmitDone: '您的申請已送出，線上申請約需七個工作日，受理結果將依您選擇之聯絡方式通知您；若有特殊情形將由專人與您聯繫，謝謝。',
        Cancelled: '已為您取消本次申請。'
    },

    // 會籍合約資料查詢流程文案（節點以 C010 起編，FF-04-00）。
    // 規格【功能說明】：顯示最近兩筆合約（含到期／終止／轉讓），一次全部顯示（PM 已確認，不用像帳務查詢
    // 先列清單選一筆）；行政終止合約的「合約狀態」欄位固定顯示提示語而非狀態字面值本身（規格【欄位說明】明列）。
    // PM 已確認：此次先只做查詢本身，行政終止是否要回頭擋既有申辦/查詢流程待之後再議，不在本輪範圍。
    Contract: {
        Intro: '您的會籍合約（僅顯示最近兩筆，含到期／終止／轉讓，可點左右箭頭切換）：',
        NotFound: '無符合合約狀態資訊，若有相關問題請洽會員服務中心。',
        AdminTerminationStatusText: '合約欠款，請洽會員服務中心',
        AdminTerminationStatus: '行政終止',

        // 卡片外觀樣式：多筆合約時比照 LockerInfo 的橫向捲動＋左右箭頭點擊切換做法（手機為主要通路，
        // 箭頭比滑動軸好點按）。Scroller/Wrap/Arrow* 這組寫法原樣沿用 LockerInfo.CardStyle 的設計。
        CardStyle: {
            Wrap: 'position:relative;',
            Scroller: 'display:flex;gap:12px;overflow-x:auto;width:1px;min-width:100%;box-sizing:border-box;padding:4px 34px 8px;margin-top:8px;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;',
            Card: 'flex:0 0 auto;width:300px;box-sizing:border-box;background:#ffffff;border-radius:12px;padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;text-align:right;',
            ArrowLeft: 'position:absolute;left:2px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.95);border:1px solid #e5e5e5;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;line-height:1;color:#555;cursor:pointer;z-index:2;padding:0;',
            ArrowRight: 'position:absolute;right:2px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.95);border:1px solid #e5e5e5;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;line-height:1;color:#555;cursor:pointer;z-index:2;padding:0;'
        },

        // 一張卡片（含左右間距）的捲動步進值：Card 寬 300 + Scroller 的 gap 12。箭頭一次點擊移動一張卡片。
        CardStep: 312,

        // 單張卡片內容。record 欄位對應 Api/ContractApiMgr 正規化後的資料。
        buildCard(record) {
            const s = ExternalText.Contract.CardStyle;
            const period = `${record.startDate || ''} ～ ${record.endDate || ''}`;
            const advisor = [record.advisorCode, record.advisorName].filter(Boolean).map((v, i) => i === 1 ? `（${v}）` : v).join('');
            const statusText = record.contractStatus === ExternalText.Contract.AdminTerminationStatus
                ? ExternalText.Contract.AdminTerminationStatusText
                : (record.contractStatus || '');
            return `<div style="${s.Card}">` +
                `<div style="${s.TitleRow}"><span style="${s.Title}">會籍合約　${record.contractNo || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">合約起訖日</span><span style="${s.Value}">${period}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">會員卡別</span><span style="${s.Value}">${record.cardType || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">方案型態</span><span style="${s.Value}">${record.planType || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">可用分館</span><span style="${s.Value}">${record.availableStore || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">服務顧問</span><span style="${s.Value}">${advisor}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">合約狀態</span><span style="${s.Value}">${statusText}</span></div>` +
                `</div>`;
        },

        // 依查詢結果組多張橫向卡片（比照 LockerInfo.buildCards：單張卡片時不顯示箭頭，直接呈現）。
        // records 為 ContractQueryFlow 已 slice(0,2) 過的最近兩筆合約。
        buildCards(records) {
            const C = ExternalText.Contract;
            const s = C.CardStyle;
            const list = records || [];
            const cardsHtml = list.map(r => C.buildCard(r)).join('');
            const scrollId = 'cqi-scroll-' + CommonMethod.randomDigits(6);
            const hideScrollbarStyle = `<script>(function(){if(!document.getElementById('cqi-style')){var st=document.createElement('style');st.id='cqi-style';st.textContent='.cqi-scroller::-webkit-scrollbar{display:none}';document.head.appendChild(st);}})();</script>`;
            const arrowsHtml = list.length > 1
                ? `<button type="button" style="${s.ArrowLeft}" onclick="document.getElementById('${scrollId}').scrollBy({left:-${C.CardStep},behavior:'smooth'})" aria-label="上一張">‹</button>` +
                  `<button type="button" style="${s.ArrowRight}" onclick="document.getElementById('${scrollId}').scrollBy({left:${C.CardStep},behavior:'smooth'})" aria-label="下一張">›</button>`
                : '';
            return `${hideScrollbarStyle}<div style="${s.Wrap}"><div id="${scrollId}" class="cqi-scroller" style="${s.Scroller}">${cardsHtml}</div>${arrowsHtml}</div>`;
        }
    },

    // 合約異動申辦進度查詢流程文案（節點以 C010 起編，FF-06-01）。
    // PM 已確認本輪只做會籍版（9 類，教練版類別屬於 FF-07-01 留待之後）；
    // ECP 待處理查詢目前沒有真正的單一端點（PM 已確認先用 Qbi mock 假設已整合好的 5 筆結果）。
    ApplicationProgress: {
        Intro: '為您查詢申辦進度（同一問題、兩層答案），每層可左右滑動：',
        Tier1Title: '第一層：線上表單處理',
        Tier2Title: '第二層：各類別一年內最近一筆',
        NotFound: '無相關申請紀錄。',

        // 規格【欄位說明】九類申請類別，ECP 待處理／會員系統兩段共用同一組類別名稱。
        CategoryLabels: ['暫停', '延展', '提前開啟請假', '升等', '轉館', '轉館加升等', '個資變更', '發票變更', '扣款卡片變更'],

        // 規格【操作邏輯】會員系統狀態代碼轉換（會籍與教練一致）。
        MemberSystemStatusLabel: {
            '1': '案件審理中',
            '2': '待結帳尚未送件',
            '4': '未結帳已失效',
            '9': '受理成功',
            '3': '取消申請'
        },

        // 卡片外觀樣式：比照 LockerInfo／Contract 的橫向捲動＋左右箭頭點擊切換做法（手機為主要通路，
        // 箭頭比滑動軸好點按），Wrap/Scroller/Arrow* 這組寫法原樣沿用。之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            SectionTitle: 'font-weight:700;font-size:14px;color:#1a1a1a;border-left:4px solid #f5c518;padding-left:8px;margin-top:14px;',
            Wrap: 'position:relative;',
            Scroller: 'display:flex;gap:8px;overflow-x:auto;width:1px;min-width:100%;box-sizing:border-box;padding:4px 30px 8px;margin-top:8px;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;',
            Card: 'flex:0 0 auto;width:170px;box-sizing:border-box;background:#ffffff;border:1px solid #eee;border-radius:12px;padding:12px 14px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            Title: 'font-weight:700;font-size:13px;color:#1a1a1a;padding-bottom:8px;border-bottom:2px solid #f5c518;margin-bottom:8px;',
            FieldLabel: 'color:#8a8a8a;font-size:12px;margin-top:8px;',
            FieldLabelFirst: 'color:#8a8a8a;font-size:12px;',
            FieldValue: 'color:#1a1a1a;font-weight:600;font-size:13px;margin-top:2px;',
            ArrowLeft: 'position:absolute;left:2px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.95);border:1px solid #e5e5e5;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;line-height:1;color:#555;cursor:pointer;z-index:2;padding:0;',
            ArrowRight: 'position:absolute;right:2px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.95);border:1px solid #e5e5e5;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;line-height:1;color:#555;cursor:pointer;z-index:2;padding:0;'
        },

        // 一張卡片（含左右間距）的捲動步進值：Card 寬 170 + Scroller 的 gap 8。箭頭一次點擊移動一張卡片。
        CardStep: 178,

        // 依單筆申請紀錄組一張卡片。statusText 由呼叫端先轉換好帶入（ECP 待處理段是字面值，
        // 會員系統段要先查 MemberSystemStatusLabel），本函式不管兩段的轉換規則差異。
        buildCard(record, statusText) {
            const s = ExternalText.ApplicationProgress.CardStyle;
            return `<div style="${s.Card}">` +
                `<div style="${s.Title}">${record.category || ''}</div>` +
                `<div style="${s.FieldLabelFirst}">受理日期</div><div style="${s.FieldValue}">${record.acceptedDate || '-'}</div>` +
                `<div style="${s.FieldLabel}">狀態</div><div style="${s.FieldValue}">${statusText || '-'}</div>` +
                `</div>`;
        },

        // 組一整段（標題＋橫向捲動卡片列＋左右箭頭）。records 為空陣列時回傳空字串，由呼叫端決定是否要整段省略；
        // 只有 1 張卡片時不顯示箭頭（比照 LockerInfo.buildCards）。每段各自獨立的 scrollId，
        // 供 ApplicationProgressQueryFlow／CoachApplicationProgressQueryFlow 的第一層/第二層各自捲動不互相干擾。
        buildSection(title, records, statusTextFn) {
            const A = ExternalText.ApplicationProgress;
            const s = A.CardStyle;
            if (!records || !records.length) return '';
            const cards = records.map(r => A.buildCard(r, statusTextFn(r))).join('');
            const scrollId = 'apr-scroll-' + CommonMethod.randomDigits(6);
            const hideScrollbarStyle = `<script>(function(){if(!document.getElementById('apr-style')){var st=document.createElement('style');st.id='apr-style';st.textContent='.apr-scroller::-webkit-scrollbar{display:none}';document.head.appendChild(st);}})();</script>`;
            const arrowsHtml = records.length > 1
                ? `<button type="button" style="${s.ArrowLeft}" onclick="document.getElementById('${scrollId}').scrollBy({left:-${A.CardStep},behavior:'smooth'})" aria-label="上一張">‹</button>` +
                  `<button type="button" style="${s.ArrowRight}" onclick="document.getElementById('${scrollId}').scrollBy({left:${A.CardStep},behavior:'smooth'})" aria-label="下一張">›</button>`
                : '';
            return `<div style="${s.SectionTitle}">${title}</div>${hideScrollbarStyle}` +
                `<div style="${s.Wrap}"><div id="${scrollId}" class="apr-scroller" style="${s.Scroller}">${cards}</div>${arrowsHtml}</div>`;
        }
    },

    // 教練合約異動申辦進度查詢文案（節點以 C010 起編，FF-07-01 子項 2）。
    // PM 已確認這次只做 FF-07-01 的「申辦進度查詢」子功能，合約 7 欄查詢／帳務繳費紀錄／上課紀錄 PDF 先不做。
    // PM 已確認：教練版跟會籍版（FF-06-01）結構一致，也是兩段——第一段 ECP 待處理（不分類，上限 10 筆）、
    // 第二段健身工廠會員系統各類別最近一筆（課程轉讓／課程終止／更換教練，最多 10 筆，同類別可重複出現，
    // 不像會籍版每類別只取最新一筆）；狀態代碼轉換沿用 ApplicationProgress.MemberSystemStatusLabel
    // （規格【操作邏輯】會籍與教練共用同一套代碼），CardStyle／buildCard／buildSection 也直接沿用，不重複定義。
    CoachApplicationProgress: {
        Intro: '為您查詢申辦進度（同一問題、兩層答案），每層可左右滑動：',
        Tier1Title: '第一層：線上表單處理',
        Tier2Title: '第二層：各類別最近一筆',
        NotFound: '無相關申請紀錄。',
        CategoryLabels: ['課程轉讓', '課程終止', '更換教練']
    },

    // 當前已生效請假紀錄查詢文案（節點以 C010 起編）。
    // 僅顯示已審核且生效中之 1 筆（畫面截圖已確認，非規格書單獨編號的功能，故不特別標 FF-xx）。
    ActiveLeaveRecord: {
        Intro: '您目前生效中的請假紀錄：',
        NotFound: '當前無已生效之請假紀錄。',

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            Card: 'width:300px;box-sizing:border-box;background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;text-align:right;'
        },

        // 依查詢結果組 HTML 卡片。record 欄位對應 Api/ActiveLeaveRecordApiMgr 正規化後的資料。
        buildCard(record) {
            const s = ExternalText.ActiveLeaveRecord.CardStyle;
            const period = `${record.leaveStartDate || ''} ～ ${record.leaveEndDate || ''}`;
            return `<div style="${s.Card}">` +
                `<div style="${s.TitleRow}"><span style="${s.Title}">已生效請假（合約 ${record.contractNo || ''}）</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">請假起訖</span><span style="${s.Value}">${period}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">合約現行結束日</span><span style="${s.Value}">${record.contractCurrentEndDate || ''}</span></div>` +
                `</div>`;
        }
    },

    // 教練合約資料查詢文案（節點以 C010 起編，FF-07-01 子項 1：7 欄卡片）。
    // 規格【功能說明】1./3.：7 欄（教練課程合約編號／課程合約起訖日／可用分館／課程類別／總堂數／
    // 剩餘堂數／主指導教練），僅提供合約狀態已結帳/已審核/到期/請假且尚有剩餘堂數者，最多 10 筆。
    // 卡片外觀比照 LockerInfo／Contract：橫向捲動＋左右箭頭點擊切換。
    CoachContract: {
        Intro: '您的教練課程合約（僅顯示有剩餘堂數之有效合約，最多 10 筆）：',
        NotFound: '無符合資訊紀錄，若有相關問題請洽專屬教練。',

        CardStyle: {
            Wrap: 'position:relative;',
            Scroller: 'display:flex;gap:12px;overflow-x:auto;width:1px;min-width:100%;box-sizing:border-box;padding:4px 34px 8px;margin-top:8px;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;',
            Card: 'flex:0 0 auto;width:280px;box-sizing:border-box;background:#ffffff;border-radius:12px;padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;text-align:right;',
            ArrowLeft: 'position:absolute;left:2px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.95);border:1px solid #e5e5e5;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;line-height:1;color:#555;cursor:pointer;z-index:2;padding:0;',
            ArrowRight: 'position:absolute;right:2px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.95);border:1px solid #e5e5e5;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;line-height:1;color:#555;cursor:pointer;z-index:2;padding:0;'
        },

        // 一張卡片（含左右間距）的捲動步進值：Card 寬 280 + Scroller 的 gap 12。
        CardStep: 292,

        // 合約起訖日顯示用短格式（YYYY-MM-DD -> YY/MM），對應畫面上的「25/09 ～ 26/09」樣式。
        formatShortDate(dateStr) {
            const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateStr || '');
            return m ? `${m[1].slice(2)}/${m[2]}` : (dateStr || '');
        },

        // 單張卡片內容。record 欄位對應 Api/CoachContractApiMgr 正規化後的資料。
        buildCard(record) {
            const C = ExternalText.CoachContract;
            const s = C.CardStyle;
            const period = `${C.formatShortDate(record.startDate)} ～ ${C.formatShortDate(record.endDate)}`;
            const advisor = [record.advisorCode, record.advisorName].filter(Boolean).join(' ');
            return `<div style="${s.Card}">` +
                `<div style="${s.TitleRow}"><span style="${s.Title}">教練合約　${record.contractNo || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">合約起訖</span><span style="${s.Value}">${period}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">可用分館</span><span style="${s.Value}">${record.availableStore || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">課程類別</span><span style="${s.Value}">${record.courseType || ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">總堂數</span><span style="${s.Value}">${record.totalSessions ?? ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">剩餘堂數</span><span style="${s.Value}">${record.remainingSessions ?? ''}</span></div>` +
                `<div style="${s.Row}"><span style="${s.Label}">主指導教練</span><span style="${s.Value}">${advisor}</span></div>` +
                `</div>`;
        },

        // 依查詢結果組多張橫向卡片（比照 LockerInfo/Contract：單張卡片時不顯示箭頭）。
        buildCards(records) {
            const C = ExternalText.CoachContract;
            const s = C.CardStyle;
            const list = records || [];
            const cardsHtml = list.map(r => C.buildCard(r)).join('');
            const scrollId = 'cci-scroll-' + CommonMethod.randomDigits(6);
            const hideScrollbarStyle = `<script>(function(){if(!document.getElementById('cci-style')){var st=document.createElement('style');st.id='cci-style';st.textContent='.cci-scroller::-webkit-scrollbar{display:none}';document.head.appendChild(st);}})();</script>`;
            const arrowsHtml = list.length > 1
                ? `<button type="button" style="${s.ArrowLeft}" onclick="document.getElementById('${scrollId}').scrollBy({left:-${C.CardStep},behavior:'smooth'})" aria-label="上一張">‹</button>` +
                  `<button type="button" style="${s.ArrowRight}" onclick="document.getElementById('${scrollId}').scrollBy({left:${C.CardStep},behavior:'smooth'})" aria-label="下一張">›</button>`
                : '';
            return `${hideScrollbarStyle}<div style="${s.Wrap}"><div id="${scrollId}" class="cci-scroller" style="${s.Scroller}">${cardsHtml}</div>${arrowsHtml}</div>`;
        }
    },

    // 教練帳務・繳費紀錄查詢文案（節點以 C010 起編，FF-07-01 子項 3）。
    // 規格【功能說明】3.：僅呈現扣款交易紀錄（本期不做教練合約扣款卡片變更）；單一合約直接顯示，
    // 多筆合約先選（比照 PaymentHistoryQueryFlow 的兩層做法）。卡片排版依 PM 指示改回「費用月份/扣款日」
    // 併排一列＋「金額」「狀態」各一列的卡片式呈現（畫面示意圖版本），不用規格原文字面的單行文字格式。
    // 規格沒有講筆數上限（PM 已確認之前用截圖上的「兩筆」是誤植，改成跟 PaymentHistoryQueryFlow
    // 一致的近 3 筆 slice(0,3)）。
    CoachPaymentHistory: {
        Intro: '點入即為繳費紀錄（本期不提供教練合約扣款卡片變更）：',
        NotFound: '無符合資訊紀錄，若有相關問題請洽專屬教練。',
        SelectContractPrompt: '您目前有多筆教練合約，請選擇要查詢的合約：',
        SelectContractInvalid: '請點選上方合約按鈕。',

        CardStyle: {
            Card: 'width:300px;box-sizing:border-box;background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            ComboRow: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            ComboValue: 'color:#1a1a1a;font-weight:600;',
            ComboLabel: 'color:#8a8a8a;font-size:12px;margin-top:2px;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;text-align:right;'
        },

        // 多合約時，第一層讓使用者選擇要查詢哪一筆合約（Web HTML 按鈕，submit=合約編號）。
        buildSelectButtons(contracts) {
            const P = ExternalText.PaymentHistory;
            return (contracts || []).map(c => ({
                label: `${c.contractNo}（${P.yymm(c.startDate)}~${P.yymm(c.endDate)}）`,
                submit: c.contractNo,
                style: 'Secondary'
            }));
        },

        // 依單一合約組卡片：標題（合約編號＋課程類別）＋近 3 筆繳費紀錄，每筆一組「費用月份/扣款日」
        // 併排一列＋「金額」「狀態」各一列。
        buildContractCard(contract) {
            const C = ExternalText.CoachPaymentHistory;
            const s = C.CardStyle;
            const mmdd = ExternalText.PaymentHistory.mmdd;
            const records = (contract.paymentRecords || []).slice(0, 3);
            const blocks = records.map(r => {
                const amountText = `NT$${Number(r.amount || 0).toLocaleString()}`;
                return `<div style="${s.ComboRow}">` +
                    `<div><div style="${s.ComboValue}">${r.feeMonth || ''}</div><div style="${s.ComboLabel}">費用月份</div></div>` +
                    `<div style="text-align:right;"><div style="${s.ComboLabel}">扣款日</div><div style="${s.ComboValue}">${mmdd(r.deductDate)}</div></div>` +
                    `</div>` +
                    `<div style="${s.Row}"><span style="${s.Label}">金額</span><span style="${s.Value}">${amountText}</span></div>` +
                    `<div style="${s.Row}"><span style="${s.Label}">狀態</span><span style="${s.Value}">${r.status || ''}</span></div>`;
            }).join('');
            return `<div style="${s.Card}">` +
                `<div style="${s.TitleRow}"><span style="${s.Title}">繳費紀錄 ${contract.contractNo || ''}（${contract.courseType || ''}）</span></div>` +
                blocks +
                `</div>`;
        }
    },

    // 個人資料變更申請流程文案（節點以 C010 起編）
    // FormFlag 對應前端 FormFlow.registerForm('PersonalDataChangeForm', ...) 註冊的 key，
    // C010 回 parameters:{ [FormFlag]: FormFlag } 觸發前端彈出表單（走 FormFlow.js 正規路由，不再用固定文字比對）。
    PersonalDataChange: {
        FormFlag: 'PersonalDataChangeForm',
        MissingSelection: '請至少勾選一項要變更的項目（手機／戶籍地址／通訊地址／姓名）。',
        InvalidMobile: '請輸入正確的手機號碼（09 開頭 10 碼數字）。',
        InvalidContact: '請填寫正確的受理通知聯絡方式（手機號碼或 Email，擇一）。',
        MissingIdCard: '變更戶籍地址或姓名需上傳身分證正反面，請重新上傳後再送出。',
        SubmitDone: '您的申請已送出，線上申請約需七個工作日，受理結果將依您選擇之聯絡方式通知您；若有特殊情形將由專人與您聯繫，謝謝。',
        Cancelled: '已為您取消本次申請。'
    },

    // 發票資訊變更申請流程文案（節點以 C010 起編）
    // FormFlag 對應前端 FormFlow.registerForm('InvoiceInfoChangeForm', ...) 註冊的 key，
    // C010 回 parameters:{ [FormFlag]: FormFlag } 觸發前端彈出表單（走 FormFlow.js 正規路由，不再用固定文字比對）。
    InvoiceInfoChange: {
        FormFlag: 'InvoiceInfoChangeForm',
        // 規格【功能說明】4. 紅字提示語：C010 進場時回在對話裡（PM 已確認需在對話中顯示，不只是表單內文字）。
        ReminderNotice: '<span style="color:#e5484d;">申請內容請務必確認正確，以維護您的發票資訊，申請後已開立之發票七日內若需變更，請洽廠館櫃台。</span>',
        MissingSelection: '請擇一填寫發票資訊（統一編號或電子發票會員載具）。',
        InvalidUnified: '統一編號請輸入正確的 8 碼數字。',
        InvalidContact: '請填寫正確的受理通知聯絡方式（手機號碼或 Email，擇一）。',
        SubmitDone: '您的申請已送出，線上申請約需七個工作日，受理結果將依您選擇之聯絡方式通知您；若有特殊情形將由專人與您聯繫，謝謝。',
        Cancelled: '已為您取消本次申請。'
    },

    // 會籍資格升等（FF-04-01）— 純 Web 表單式。第一階段只開放「會籍資格升等」；
    // 轉館／轉館加升等先 enabled:false（不顯示），第二階段打開並補表單。
    ChangeMembershipFlow: {
        TypeAsk: '請選擇要申辦的項目：',
        TypeButtons: [
            { label: '會籍資格升等', submit: '會籍資格升等', style: 'Primary', enabled: true },
            { label: '會籍廠館轉移', submit: '會籍廠館轉移', style: 'Secondary', enabled: false },
            { label: '廠館轉移加卡別升等', submit: '廠館轉移加卡別升等', style: 'Secondary', enabled: false }
        ],
        // 申辦項目 → ECP U_ChangeType 代碼（ECP 字典「健身工廠_會籍異動類型」：U 升等、T 轉館、A 升等加轉館）。
        ChangeTypeCode: { '會籍資格升等': 'U', '會籍廠館轉移': 'T', '廠館轉移加卡別升等': 'A' },
        TypeInvalid: '請點選要申辦的項目。',

        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: '本人申辦', style: 'Secondary' },
            { label: '代理他人申辦', submit: '代理他人申辦', style: 'Primary' }
        ],
        IdentityInvalid: '請點選「本人申辦」或「代理他人申辦」。',

        // 本人表單觸發旗標（前端 FormFlow 依此開表單）與預帶資料的 parameters key（前端從 context.parameters 讀取）。
        FormFlag: 'ChangeMembershipForm',
        DataKey: 'ChangeMembershipData',
        PayOptions: [
            { value: 'C', label: '信用卡' },
            { value: 'T', label: '轉帳' }
        ],

        // 合約狀態代碼 6＝行政終止（需求書 p.30）。
        AdminTerminatedStatus: '6',
        AdminTerminated: '合約欠款，請洽會員服務中心。',
        NoContract: '無符合合約狀態資訊，若有相關問題請洽會員服務中心。',
        NoUpgradeOption: '您目前的會籍已是最高等級，沒有可升等的卡別。若有相關問題請洽會員服務中心。',

        Cancelled: '已為您取消本次申請。',
        SubmitInvalid: '表單資料不完整或有誤，請確認後重新申請。',
        SubmitFailed: '申請送出失敗，請稍後再試，或聯繫客服協助。',
        SubmitDone: '線上申請需約三個工作日，受理結果將依您選擇之聯絡方式通知，若有特殊情形將有專人與您聯繫，謝謝。',

        // 交給共用 AgentFlow 時帶入：申辦類型（寫 U_ApplicationType）＋ 轉專人 parameters 的 value。
        // TODO(PM 確認)：ApplicationType 須與 ECP 代理人申辦單元的下拉值逐字一致（需求書 p.77 代碼 4）。
        ApplicationType: '會籍升等/轉館/轉館加升等',
        ToAgentValue: 'ToAgentOfChangeMembershipFlow'
    }
};

module.exports = ExternalText;
