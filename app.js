// 服務入口：一支 app.js 掛所有流程，共用 runFlow()。啟動在 bin/www，本檔不 app.listen。
// 新增流程 = ① 下面 require 一支 Flow ② 路由區塊加一條「字面路徑」app.post → runFlow。

const express = require('express');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const createError = require('http-errors');

const LoggerMgr = require('./ExternalMethod/Logger');
const JsonCall = require('./ExternalMethod/JsonCall');
const wording = require('./ExternalMethod/ExternalText');

const MemberInfoQueryFlow = require('./ExternalFlow/MemberInfoQueryFlow');
const LeaveFlow = require('./ExternalFlow/LeaveFlow');

const app = express();
app.use(log4js.connectLogger(log4js.getLogger('http'), { level: 'auto' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.all('*', (req, res, next) => {
  const body = req.body || {};
  const input = Array.isArray(body.data) && body.data.length > 0 ? body.data[0] : body;
  const chatId = body.ask_chatId || body.chatId || input.ask_chatId || input.chatId || '';
  const func = req.path.replace(/\//g, '') || 'app';
  req.args = {
    chatId,
    askInput: body.ask_input || input.ask_input || '',
    askUser: body.ask_user || input.ask_user || '',
    askPlatform: body.ask_platform || input.ask_platform || '',
    customerData: body.customerData || input.customerData || {},
    logger: new LoggerMgr(func, chatId)
  };
  req.logger = req.args.logger;
  req.logger.InfoLog('request body:' + JSON.stringify(body));
  req.logger.InfoLog(`[${func}] ask_input: ${req.args.askInput}｜platform: ${req.args.askPlatform}`);
  next();
});

app.get('/hi', (req, res) => res.send('External 運作中。'));

const recent = new Map();
const conversationStates = new Map();
global.clearConversationStateFlag = global.clearConversationStateFlag || new Set();

// 共用執行器：去重 → 清狀態旗標 → 沿用/重建流程實例 → main() → 錯誤處理。新增流程不用改這裡。
function runFlow({ req, res, FlowClass, flowName }) {
  const { chatId, askInput, askPlatform } = req.args;

  const dedupeKey = `${flowName}|${chatId}|${askInput}`;
  const now = Date.now();
  if (recent.has(dedupeKey) && now - recent.get(dedupeKey) < 500) return res.sendStatus(200);
  recent.set(dedupeKey, now);
  setTimeout(() => recent.delete(dedupeKey), 2000);

  if (global.clearConversationStateFlag.has(chatId)) {
    conversationStates.delete(chatId);
    global.clearConversationStateFlag.delete(chatId);
  }

  const existing = conversationStates.get(chatId);
  let runner;
  if (existing && existing.FlowName === flowName) {
    runner = existing;
    runner.askInput = askInput;
    runner.askPlatform = askPlatform;
    runner.res = res;
    runner.logger = req.logger;
  } else {
    if (existing) conversationStates.delete(chatId);
    if (typeof FlowClass !== 'function') {
      req.logger.AlertLog(`[${flowName}] 模組載入錯誤（忘了 require？）`);
      return res.status(500).send(JsonCall.GetJsonTemplate('0', wording.Public.ReturnSystemErrorMessage));
    }
    runner = new FlowClass({ args: { ...req.args, FlowName: flowName }, res });
    conversationStates.set(chatId, runner);
  }

  Promise.resolve(runner.main()).catch(error => {
    req.logger.AlertLog(`[${flowName}] runner.main failed: ${error && error.message ? error.message : error}`);
    conversationStates.delete(chatId);
    if (!res.headersSent) res.status(500).send(JsonCall.GetJsonTemplate('0', wording.Public.ReturnSystemErrorMessage));
  });
}

// 流程路由：每流程一條「字面路徑」；新增流程只在此多加一條。
app.post('/MemberInfoQueryFlow', (req, res) => runFlow({ req, res, FlowClass: MemberInfoQueryFlow, flowName: 'MemberInfoQueryFlow' }));
app.post('/LeaveFlow', (req, res) => runFlow({ req, res, FlowClass: LeaveFlow, flowName: 'LeaveFlow' }));

app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => { res.status(err.status || 500).json({ error: err.message }); });

module.exports = app;
