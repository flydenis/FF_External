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
        Intro: '您的會籍合約（僅顯示最近兩筆，含到期／終止／轉讓）：',
        NotFound: '無符合合約狀態資訊，若有相關問題請洽會員服務中心。',
        AdminTerminationStatusText: '合約欠款，請洽會員服務中心',
        AdminTerminationStatus: '行政終止',

        // 卡片外觀樣式，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            Card: 'width:300px;box-sizing:border-box;background:#ffffff;border-radius:12px;padding:16px 18px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            TitleRow: 'padding-bottom:10px;border-bottom:3px solid #f5c518;',
            Title: 'font-weight:700;font-size:16px;color:#1a1a1a;',
            Row: 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;',
            Label: 'color:#8a8a8a;',
            Value: 'color:#1a1a1a;font-weight:600;text-align:right;'
        },

        // 依查詢結果組 HTML 卡片。record 欄位對應 Api/ContractApiMgr 正規化後的資料。
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
        }
    },

    // 合約異動申辦進度查詢流程文案（節點以 C010 起編，FF-06-01）。
    // PM 已確認本輪只做會籍版（9 類，教練版類別屬於 FF-07-01 留待之後）；
    // ECP 待處理查詢目前沒有真正的單一端點（PM 已確認先用 Qbi mock 假設已整合好的 5 筆結果）。
    ApplicationProgress: {
        Intro: '為您查詢申辦進度（同一問題、兩層答案），每層可左右滑動：',
        Tier1Title: '第一層：線上表單處理（ECP，上限 10 張）',
        Tier2Title: '第二層：各類別一年內最近一筆（會員系統，最多 9 類）',
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

        // 卡片外觀樣式：橫向捲動列＋固定寬度卡片，之後 PM 若要換配色只改這裡，不動流程程式。
        CardStyle: {
            SectionTitle: 'font-weight:700;font-size:14px;color:#1a1a1a;border-left:4px solid #f5c518;padding-left:8px;margin-top:14px;',
            Row: 'display:flex;overflow-x:auto;gap:8px;padding:8px 2px;-webkit-overflow-scrolling:touch;',
            Card: 'flex:0 0 auto;width:170px;box-sizing:border-box;background:#ffffff;border:1px solid #eee;border-radius:12px;padding:12px 14px;box-shadow:0 1px 4px rgba(0,0,0,0.08);',
            Title: 'font-weight:700;font-size:13px;color:#1a1a1a;padding-bottom:8px;border-bottom:2px solid #f5c518;margin-bottom:8px;',
            FieldLabel: 'color:#8a8a8a;font-size:12px;margin-top:8px;',
            FieldLabelFirst: 'color:#8a8a8a;font-size:12px;',
            FieldValue: 'color:#1a1a1a;font-weight:600;font-size:13px;margin-top:2px;'
        },

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

        // 組一整段（標題＋橫向捲動卡片列）。records 為空陣列時回傳空字串，由呼叫端決定是否要整段省略。
        buildSection(title, records, statusTextFn) {
            const s = ExternalText.ApplicationProgress.CardStyle;
            if (!records || !records.length) return '';
            const cards = records.map(r => ExternalText.ApplicationProgress.buildCard(r, statusTextFn(r))).join('');
            return `<div style="${s.SectionTitle}">${title}</div><div style="${s.Row}">${cards}</div>`;
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
    }
};

module.exports = ExternalText;
