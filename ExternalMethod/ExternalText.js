// 所有對使用者的問句/提示/結果語集中在此；流程只引用不寫死。
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

    // 帳務查詢及繳款流程文案（節點以 C010 起編，FF-05-01）。
    // 規格【功能說明】：月繳型＋目前生效中（審核中/已審核/請假）才顯示近三個月繳費紀錄；
    // 行政中止固定顯示 AdminHoldNote（不論帳款狀態）；其餘非生效中狀態顯示 OtherStatusNote；
    // 預繳型不論狀態一律顯示 PrepaidNote（無按月繳費紀錄）。
    PaymentHistory: {
        Intro: '為您顯示當前生效的近三個月繳費紀錄：',
        NotFound: '很抱歉，查無您的合約帳務資訊！建議您洽詢客服人員或現場服務人員，由專人協助您進一步確認，謝謝！',
        SelectContractPrompt: '您目前有多筆合約，請選擇要查詢的合約：',
        SelectContractInvalid: '請點選上方合約按鈕。',
        OverdueReminder: '提醒您，尚有未繳款項，請儘速至廠館櫃台繳納及更新您的扣款資訊，避免影響您的會員權益。',
        AdminHoldNote: '合約欠款，請洽會員服務中心。',
        OtherStatusNote: '請洽廠館櫃檯或會員服務中心。',
        PrepaidNote: '預繳型會籍，無相關按月繳費紀錄。',
        FooterDisclaimer: '提醒您僅呈現近3筆，預繳型會員顯示「無按月繳費紀錄」。',

        // 規格【功能目的】：帶入近三個月月費繳費狀態，僅限目前生效中的合約狀態。
        ActiveStatuses: ['審核中', '已審核', '請假'],
        AdminHoldStatus: '行政中止',
        BillingTypeLabel: { monthly: '月繳型', prepaid: '預繳型' },

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            Card: 'background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
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
            if (contract.contractStatus === P.AdminHoldStatus) {
                body = `<div style="${s.Note}">${P.AdminHoldNote}</div>`;
            } else if (contract.billingType === 'prepaid') {
                body = `<div style="${s.Note}">${P.PrepaidNote}</div>`;
            } else if (!P.ActiveStatuses.includes(contract.contractStatus)) {
                body = `<div style="${s.Note}">${P.OtherStatusNote}</div>`;
            } else {
                const overdueNote = contract.overdue ? `<div style="${s.Note}">${P.OverdueReminder}</div>` : '';
                const records = (contract.paymentRecords || []).slice(0, 3);
                const cell = (text, isFirst) => `<span style="${isFirst ? s.RecordCell : s.RecordCellDivider}">${text}</span>`;
                const rows = records.map((r, i) => {
                    const amountText = `NT$${Number(r.amount || 0).toLocaleString()}`;
                    const dateText = r.actualDeductDate ? P.mmdd(r.actualDeductDate) : '-';
                    const refundText = r.refundDate ? `（已退款 ${P.mmdd(r.refundDate)}）` : '';
                    const rowStyle = i === records.length - 1 ? s.RecordRowLast : s.RecordRow;
                    return `<div style="${rowStyle}">` +
                        cell(r.feeMonth || '', true) +
                        cell(amountText, false) +
                        cell(`${r.status || ''}${refundText}`, false) +
                        cell(dateText, false) +
                        `</div>`;
                }).join('');
                body = overdueNote +
                    `<div style="${s.SectionTitle}">近三個月繳費紀錄</div>` +
                    `<div style="${s.RecordTable}">` +
                    `<div style="${s.RecordHeaderRow}">${cell('費用月份', true)}${cell('金額', false)}${cell('扣款狀態', false)}${cell('實際扣款日', false)}</div>` +
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
