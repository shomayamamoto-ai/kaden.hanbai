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
var SEND_CUSTOMER_COPY = false;

// メールに表示する店舗名
var SHOP_NAME = "";
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

  var headers = ["受信日時"].concat(data.answers.map(function (a) { return a.label; }));
  var row = [new Date()].concat(data.answers.map(function (a) { return a.value; }));

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
  var subject = "【ヒアリングシート受信】" + data.formName + " / " + (data.name || "お名前未記入") + " 様";
  var body =
    data.formName + "のヒアリングシートが届きました。\n" +
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
  var from = SHOP_NAME ? SHOP_NAME + "より" : "";
  MailApp.sendEmail({
    to: data.email,
    subject: "【受付完了】" + data.formName + "のヒアリングシート",
    body:
      (data.name || "お客様") + " 様\n\n" +
      "ヒアリングシートのご回答ありがとうございました。\n" +
      "内容を確認のうえ、担当者よりご連絡いたします。\n" +
      "\n以下の内容で受け付けました。\n" +
      formatBody_(data) + "\n\n" + from,
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
