/**
 * 買い替えヒアリングシートの受信プログラム(Google Apps Script)
 *
 * フォームから送信された回答を、
 *   1. このスプレッドシートに1行ずつ記録し、
 *   2. 管理者(このスクリプトの持ち主)にメールで通知します。
 *
 * 設置手順は docs/SETUP.md を参照してください。
 */

// ===== 設定 =====
// 通知先メールアドレス。空欄なら、このスクリプトの持ち主(あなた)に届きます。
// 複数人に送る場合は "a@example.com,b@example.com" のようにカンマ区切りで。
var NOTIFY_TO = "";

// true にすると、お客様にも「受付完了メール」を自動送信します。
// ※ config.js の CUSTOMER_MAIL と同じにしてください
var SEND_CUSTOMER_COPY = true;

// メールに表示する店舗名・連絡先
var SHOP_NAME = "";
var SHOP_TEL = "";
var SHOP_HOURS = ""; // 例:"10:00〜19:00(水曜定休)"

// ご連絡までの目安(config.js の REPLY_TIME と同じにしてください)
var REPLY_TIME = "2営業日以内";
// ================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);
    if (!data || !data.answers || !data.formType) {
      return json_({ ok: false, error: "invalid payload" });
    }
    saveToSheet_(data);
    notifyOwner_(data);
    if (SEND_CUSTOMER_COPY && data.email) {
      sendCustomerCopy_(data);
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 動作確認用:ブラウザで URL を開くと表示されます
function doGet() {
  return ContentService.createTextOutput("ヒアリングシート受信プログラムは動作しています。");
}

function saveToSheet_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = data.formName || data.formType; // 「パソコン」「スマートフォン」でシートを分ける
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  var headers = ["受信日時", "受付番号", "対応状況"].concat(data.answers.map(function (a) { return a.label; }));
  var row = [new Date(), data.receiptNo || "", "未対応"].concat(data.answers.map(function (a) { return a.value; }));

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#ebeff0");
    sheet.setFrozenRows(1);
  } else {
    // 質問項目が増えた場合は見出しを更新
    var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (current.join("|") !== headers.join("|")) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#ebeff0");
    }
  }
  // 先頭が「=」などの場合に数式として扱われないようにする
  sheet.appendRow(row.map(function (v) {
    return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v;
  }));
}

function formatBody_(data) {
  var lines = [];
  var lastSection = "";
  data.answers.forEach(function (a) {
    if (a.section !== lastSection) {
      lines.push("", "■ " + a.section);
      lastSection = a.section;
    }
    lines.push("・" + a.label + ":" + (a.value || "(未記入)"));
  });
  return lines.join("\n");
}

function notifyOwner_(data) {
  var to = NOTIFY_TO || Session.getEffectiveUser().getEmail();
  var subject = "【ヒアリングシート受信】" + (data.receiptNo ? data.receiptNo + " " : "") + data.formName + " / " + (data.name || "お名前未記入") + " 様";
  var body =
    data.formName + "のヒアリングシートが届きました。\n" +
    "受付番号:" + (data.receiptNo || "-") + "\n" +
    "受信日時:" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm") + "\n" +
    formatBody_(data) + "\n\n" +
    "――\nスプレッドシート:" + SpreadsheetApp.getActiveSpreadsheet().getUrl();

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    replyTo: isEmail_(data.email) ? data.email : undefined, // 返信するとお客様に届く
  });
}

function sendCustomerCopy_(data) {
  if (!isEmail_(data.email)) return;

  // 同じアドレスへの自動返信は1時間に3通まで(いたずら送信対策)
  var cache = CacheService.getScriptCache();
  var key = "mail_" + data.email.toLowerCase();
  var count = Number(cache.get(key) || 0);
  if (count >= 3) return;
  cache.put(key, String(count + 1), 3600);

  var answers = {};
  data.answers.forEach(function (a) { answers[a.label] = a.value; });
  var method = answers["ご希望の連絡方法"];
  var how = method && method !== "どちらでもよい" ? method + "で" : "メールまたはお電話で";

  var shop = [];
  if (SHOP_NAME) shop.push(SHOP_NAME);
  if (SHOP_TEL) shop.push("TEL:" + SHOP_TEL);
  if (SHOP_HOURS) shop.push("受付時間:" + SHOP_HOURS);

  var body =
    String(data.name || "お客様").slice(0, 40) + " 様\n\n" +
    "このたびは" + data.formName + "の買い替えについて\n" +
    "ヒアリングシートにご回答いただき、ありがとうございます。\n" +
    "以下の内容で受け付けました。\n\n" +
    "――――――――――――――――\n" +
    "受付番号:" + (data.receiptNo || "-") + "\n" +
    "――――――――――――――――\n\n" +
    "■ このあとの流れ\n" +
    "1. 担当者が内容を確認します\n" +
    "2. " + REPLY_TIME + "に、" + how + "ご連絡します\n" +
    "3. ご予算・用途に合った機種をご提案します\n\n" +
    "回答内容の変更や追加のご要望は、\n" +
    "このメールにそのままご返信ください。\n" +
    (shop.length ? "お急ぎの場合は、お電話でも承ります。\n" : "") +
    "\n■ ご回答内容\n" +
    formatBody_(data) + "\n\n" +
    "※お心当たりのない場合は、お手数ですがこのメールを破棄してください。\n" +
    (shop.length ? "\n――\n" + shop.join("\n") + "\n" : "");

  MailApp.sendEmail({
    to: data.email,
    subject: "【受付完了】" + data.formName + "のヒアリングシート(受付番号 " + (data.receiptNo || "-") + ")",
    body: body,
    name: SHOP_NAME || undefined,
  });
}

function isEmail_(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 設置後の動作確認用。
 * エディタ上でこの関数を選んで「実行」すると、テスト回答が1件記録され、メールが届きます。
 */
function testSubmit() {
  doPost({
    postData: {
      contents: JSON.stringify({
        formType: "pc",
        formName: "パソコン",
        name: "テスト 太郎",
        email: "",
        answers: [
          { section: "1. お客様情報", label: "お名前", value: "テスト 太郎" },
          { section: "1. お客様情報", label: "メールアドレス", value: "" },
          { section: "2. 現在の利用状況と買い替え理由", label: "買い替えの理由", value: "動作が遅い・フリーズする" },
        ],
      }),
    },
  });
}
