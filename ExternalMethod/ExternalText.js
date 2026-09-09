// 所有對使用者的問句/提示/結果語集中在此；流程只引用不寫死。
var ExternalText = {
    Public: {
        ServiceError: '目前服務忙線中，請稍後再試。',
        ReturnSystemErrorMessage: '不好意思，目前系統異常，請稍後再試。'
    },
    ExcallStatus: { Finish: '0', Continue: '1' },
    MessageType: { Text: 'Text', Cards: 'Cards', QuickReply: 'QuickReply' },
    Options: { Yes: '是', No: '否' },
    YesList: ['1', '是', '對', '正確', '沒錯', 'yes', 'y', '確認', '好'],
    NoList: ['2', '否', '不是', '不對', '錯誤', 'no', 'n', '取消', '重新輸入'],

    // 會員體驗資訊查詢流程文案（節點以 C010 起編）
    MemberInfo: {
        Intro: '已為您查詢體驗資訊如下：',
        NotFound: '查無您的體驗會員資訊，請確認後再試一次，或洽真人客服協助。',

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
    }
};

module.exports = ExternalText;
