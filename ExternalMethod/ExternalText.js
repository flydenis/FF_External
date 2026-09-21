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
    ButtonStyle: {
        Primary: 'display:inline-flex;align-items:center;padding:8px 24px;border-radius:9999px;font-weight:500;border:none;background-color:#2563eb;color:#ffffff;margin:0 5px 5px 0;',
        Secondary: 'display:inline-flex;align-items:center;padding:8px 24px;border-radius:9999px;font-weight:500;border:1px solid #d0d5dd;background-color:#ffffff;color:#333333;margin:0 5px 5px 0;',
        ContainerStyle: 'display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;'
    },

    // 請假流程（會籍暫停/延展）— 純 Web 表單式。
    //   C010 問請假方式（暫停/延展）→ C015 問身分 → C020 分派（本人自處理 / 代理人交共用 AgentFlow）。
    LeaveFlow: {
        StopTypeAsk: '請選擇請假方式：',
        StopTypeButtons: [
            { label: '會籍暫停（需檢附證明）', submit: 'PAUSE', style: 'Secondary' },
            { label: '會籍延展（免檢附證明／每月 $300 元）', submit: 'EXTEND', style: 'Primary' }
        ],
        StopTypeInvalid: '請點選「會籍暫停」或「會籍延展」。',

        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: 'SELF', style: 'Secondary' },
            { label: '代理他人申辦', submit: 'AGENT', style: 'Primary' }
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
        // ToAgentValue 標明是「哪一支外部流程」呼叫 AgentFlow（送件後回 parameters:{ ToAgent: <此值> }），
        // 之後打 ECP 也會用到此值（屆時轉成對應中文再送）。其他流程重用 AgentFlow 時各自填自己的值。
        // TODO(PM 確認)：ApplicationType 須與內部系統下拉選單「會籍暫停(請假/延展)」逐字一致；暫停/延展是否需帶不同值待確認，目前共用同一值。
        ApplicationType: '會籍暫停(請假/延展)',
        ToAgentValue: 'ToAgentOfLeaveFlow'
    },

    // 教練合約解約申請流程 — 純 Web 表單式。C010 問身分 → C020 分派（本人自處理 / 代理人交共用 AgentFlow）。
    CoachContractTerminationFlow: {
        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: 'SELF', style: 'Secondary' },
            { label: '代理他人申辦', submit: 'AGENT', style: 'Primary' }
        ],
        IdentityInvalid: '請點選「本人申辦」或「代理他人申辦」。',

        // 本人表單觸發旗標（C020 只回 parameters:{ CoachContractTerminationForm:'CoachContractTerminationForm' }，
        // 前端 CoachContractTerminationForm.js 據此自繪表單）。
        SelfFormFlag: 'CoachContractTerminationForm',
        SelfDone: '單號建置完成，若還有疑問請聯繫客服。',
        SelfInvalid: '表單資料不完整，請確認後重新送出。',
        Cancelled: '已為您取消本次申請。',

        // 交給共用 AgentFlow 時帶入：申辦類型（寫 U_ApplicationType）＋ 轉專人 parameters 的 value。
        // TODO(PM 確認)：ApplicationType 須與內部系統下拉選單逐字一致，目前先沿用「教練合約解約」佔位。
        ApplicationType: '教練合約解約',
        ToAgentValue: 'ToAgentOfCoachContractTerminationFlow'
    },

    // 會籍解約申請流程 — 純 Web 表單式。C010 問身分 → C020 分派（本人自處理 / 代理人交共用 AgentFlow）。
    MembershipTerminationFlow: {
        IdentityAsk: '您選擇的是申辦類服務，需先確認本次申辦身分：',
        IdentityButtons: [
            { label: '本人申辦', submit: 'SELF', style: 'Secondary' },
            { label: '代理他人申辦', submit: 'AGENT', style: 'Primary' }
        ],
        IdentityInvalid: '請點選「本人申辦」或「代理他人申辦」。',

        // 本人表單觸發旗標（C020 只回 parameters:{ MembershipTerminationForm:'MembershipTerminationForm' }，
        // 前端 MembershipTerminationForm.js 據此自繪表單）。
        SelfFormFlag: 'MembershipTerminationForm',
        SelfDone: '單號建置完成，若還有疑問請聯繫客服。',
        SelfInvalid: '表單資料不完整，請確認後重新送出。',
        Cancelled: '已為您取消本次申請。',

        // 交給共用 AgentFlow 時帶入：申辦類型（寫 U_ApplicationType）＋ 轉專人 parameters 的 value。
        // TODO(PM 確認)：ApplicationType 須與內部系統下拉選單逐字一致，目前先沿用「會籍解約」佔位。
        ApplicationType: '會籍解約',
        ToAgentValue: 'ToAgentOfMembershipTerminationFlow'
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

    // 個人資料變更申請流程文案（節點以 C010 起編）
    // OpenMarker 是 C010 回覆的固定文字，前端 personal-data-change-form.js 監看聊天訊息比對到同一句就彈出表單；
    // 兩邊各自維護同一組常數字串，改這裡要同步改前端的 OPEN_MARKER。
    PersonalDataChange: {
        OpenMarker: '請於彈出視窗中填寫「個人資料變更申請」表單。',
        MissingSelection: '請至少勾選一項要變更的項目（手機／戶籍地址／通訊地址／姓名）。',
        InvalidMobile: '請輸入正確的手機號碼（09 開頭 10 碼數字）。',
        InvalidContact: '請填寫正確的受理通知聯絡方式（手機號碼或 Email，擇一）。',
        MissingIdCard: '變更戶籍地址或姓名需上傳身分證正反面，請重新上傳後再送出。',
        SubmitDone: '您的申請已送出，線上申請約需七個工作日，受理結果將依您選擇之聯絡方式通知您；若有特殊情形將由專人與您聯繫，謝謝。'
    },

    // 發票資訊變更申請流程文案（節點以 C010 起編）
    // OpenMarker 是 C010 回覆的固定文字，前端 invoice-info-change-form.js 監看聊天訊息比對到同一句就彈出表單；
    // 兩邊各自維護同一組常數字串，改這裡要同步改前端的 OPEN_MARKER。
    InvoiceInfoChange: {
        OpenMarker: '請於彈出視窗中填寫「發票資訊變更申請」表單。',
        // 規格【功能說明】4. 紅字提示語：C010 進場時與 OpenMarker 一起回在對話裡（PM 已確認需在對話中顯示，不只是表單內文字）。
        ReminderNotice: '<span style="color:#e5484d;">申請內容請務必確認正確，以維護您的發票資訊，申請後已開立之發票七日內若需變更，請洽廠館櫃台。</span>',
        MissingSelection: '請擇一填寫發票資訊（統一編號或電子發票會員載具）。',
        InvalidUnified: '統一編號請輸入正確的 8 碼數字。',
        InvalidContact: '請填寫正確的受理通知聯絡方式（手機號碼或 Email，擇一）。',
        SubmitDone: '您的申請已送出，線上申請約需七個工作日，受理結果將依您選擇之聯絡方式通知您；若有特殊情形將由專人與您聯繫，謝謝。'
    }
};

module.exports = ExternalText;
