/**
 * 買い替えヒアリングシートの受信プログラム(Google Apps Script)
 *
 * できること:
 *   ・フォームの回答を、このスプレッドシートに1行ずつ記録する
 *   ・管理者に通知メールを送る(提案のヒント付き)
 *   ・お客様に受付完了メールを送る
 *   ・お客様が送った写真を Google ドライブに保存する
 *   ・未対応のまま時間がたった回答を、まとめてお知らせする
 *   ・回答の集計表と、見積もりのたたき台を作る
 *
 * 設置手順は docs/SETUP.md を参照してください。
 */

// ===== 設定 =====
// 通知先メールアドレスは、公開されないように「スクリプト プロパティ」に保存します。
//   Apps Script 左側の歯車(プロジェクトの設定)→ スクリプト プロパティ
//   → プロパティ:NOTIFY_TO 値:通知を受け取るメールアドレス
// どちらも空欄の場合は、このスクリプトの持ち主の Google アカウントに届きます。
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

// 「未対応」のまま、この時間がたったらお知らせする
var REMIND_AFTER_HOURS = 24;

// いたずら対策
var MAX_PER_HOUR = 30; // 1時間に受け付ける回答の上限
var MIN_FILL_SECONDS = 5; // これより早く送信されたものは機械による送信とみなす

// 写真を保存する Google ドライブのフォルダ名
var PHOTO_FOLDER_NAME = "ヒアリングシート写真";

// 対応状況のプルダウンの選択肢
var STATUS_OPTIONS = ["未対応", "連絡済み", "提案済み", "成約", "失注", "対応不要"];
// ================

var FORM_SHEETS = ["パソコン", "スマートフォン"];
var FIXED_HEADERS = ["受信日時", "受付番号", "対応状況", "対応メモ", "提案のヒント", "写真", "回答の種類"];
var STATUS_TTL = 21600; // 受付状況を覚えておく時間(秒)= 6時間

// =====================================================
// 受信
// =====================================================

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "invalid" });
  }
  if (!data || !/^(PC|SP)-\d{6}-\d{4}$/.test(String(data.receiptNo || ""))) {
    return json_({ ok: false, error: "invalid" });
  }

  var cache = CacheService.getScriptCache();
  var statusKey = "st_" + data.receiptNo;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // 同じ受付番号がすでに届いていれば、二重に記録しない
    if (cache.get(statusKey) === "ok") return json_({ ok: true, duplicate: true });

    var reason = rejectReason_(data);
    if (reason) {
      cache.put(statusKey, "rejected:" + reason, STATUS_TTL);
      return json_({ ok: false, error: reason });
    }

    cleanPayload_(data);
    var photos = savePhotos_(data);
    data.hints = makeHints_(data);
    saveToSheet_(data, photos);

    // 記録できた時点で「受付完了」とする(メールの失敗では、お客様に再送信させない)
    cache.put(statusKey, "ok", STATUS_TTL);
    countUp_();

    try {
      notifyOwner_(data, photos);
    } catch (err) {
      console.error("通知メールの送信に失敗:", err);
    }
    if (SEND_CUSTOMER_COPY && data.email) {
      try {
        sendCustomerCopy_(data);
      } catch (err) {
        console.error("受付完了メールの送信に失敗:", err);
      }
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 受付状況の問い合わせ(フォームが「届いたかどうか」を確認するために使う)
// ブラウザで URL をそのまま開いたときは、動作確認のメッセージを表示する
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "status") {
    var raw = CacheService.getScriptCache().get("st_" + String(p.receiptNo || "")) || "";
    var result = { status: "unknown" };
    if (raw === "ok") result = { status: "ok" };
    else if (raw.indexOf("rejected:") === 0) result = { status: "rejected", reason: raw.slice(9) };

    var cb = String(p.callback || "");
    if (/^[A-Za-z_$][\w$]{0,63}$/.test(cb)) {
      return ContentService.createTextOutput(cb + "(" + JSON.stringify(result) + ");").setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
    }
    return json_(result);
  }
  return ContentService.createTextOutput("ヒアリングシート受信プログラムは動作しています。");
}

// いたずら・機械による送信を見分ける(問題なければ空文字を返す)
function rejectReason_(data) {
  if (!Array.isArray(data.answers) || data.answers.length > 300) return "invalid";
  if (Number(data.elapsedSec) < MIN_FILL_SECONDS) return "too_fast";
  if (Number(CacheService.getScriptCache().get(hourKey_()) || 0) >= MAX_PER_HOUR) return "busy";

  var secret = setting_("TURNSTILE_SECRET", "");
  if (secret && !verifyTurnstile_(secret, data.turnstileToken)) return "bot";
  return "";
}

function verifyTurnstile_(secret, token) {
  if (!token) return false;
  var res = UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "post",
    payload: { secret: secret, response: token },
    muteHttpExceptions: true,
  });
  try {
    return JSON.parse(res.getContentText()).success === true;
  } catch (err) {
    return false;
  }
}

function hourKey_() {
  return "cnt_" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHH");
}

function countUp_() {
  var cache = CacheService.getScriptCache();
  var key = hourKey_();
  cache.put(key, String(Number(cache.get(key) || 0) + 1), 3700);
}

// 長すぎる文字を切り詰め、形をそろえる
function cleanPayload_(data) {
  var cut = function (v, n) {
    return String(v == null ? "" : v).slice(0, n);
  };
  data.name = cut(data.name, 50);
  data.email = cut(data.email, 100);
  data.formName = data.formType === "phone" ? "スマートフォン" : "パソコン";
  data.answers = data.answers.map(function (a) {
    return { section: cut(a.section, 50), id: cut(a.id, 50), label: cut(a.label, 80), value: cut(a.value, 1000) };
  });
}

function setting_(key, fallback) {
  try {
    return PropertiesService.getScriptProperties().getProperty(key) || fallback;
  } catch (err) {
    return fallback;
  }
}

function notifyAddress_() {
  return setting_("NOTIFY_TO", NOTIFY_TO) || Session.getEffectiveUser().getEmail();
}

// =====================================================
// 写真の保存
// =====================================================

function savePhotos_(data) {
  var list = Array.isArray(data.photos) ? data.photos.slice(0, 3) : [];
  if (!list.length) return [];
  var saved = [];
  try {
    var folder = photoFolder_();
    list.forEach(function (dataUrl, i) {
      var m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
      if (!m || m[1].length > 4 * 1024 * 1024) return; // JPEG 以外・大きすぎるものは保存しない
      var blob = Utilities.newBlob(Utilities.base64Decode(m[1]), "image/jpeg", data.receiptNo + "_" + (i + 1) + ".jpg");
      var file = folder.createFile(blob);
      saved.push({ url: file.getUrl(), blob: blob });
    });
  } catch (err) {
    console.error("写真の保存に失敗:", err);
  }
  return saved;
}

function photoFolder_() {
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

// =====================================================
// スプレッドシートへの記録
// =====================================================

function saveToSheet_(data, photos) {
  var sheet = formSheet_(data.formName);

  // 項目名 → 値(選んだ商品によって項目が増減するため、見出し名で列を探して書き込む)
  var values = {
    "受信日時": new Date(),
    "受付番号": data.receiptNo,
    "対応状況": "未対応",
    "対応メモ": "",
    "提案のヒント": data.hints.join("\n"),
    "写真": photos.map(function (p) { return p.url; }).join("\n"),
    "回答の種類": data.mode === "simple" ? "かんたん版" : "しっかり版",
  };
  var order = FIXED_HEADERS.slice();
  data.answers.forEach(function (a) {
    values[a.label] = a.value;
    order.push(a.label);
  });

  var headers = sheet.getLastRow() === 0 ? [] : sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var added = false;
  order.forEach(function (label) {
    if (headers.indexOf(label) === -1) {
      headers.push(label);
      added = true;
    }
  });
  if (added) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#ebeff0");
    sheet.setFrozenRows(1);
  }

  var row = headers.map(function (label) {
    return safe_(values.hasOwnProperty(label) ? values[label] : "");
  });
  sheet.appendRow(row);
  applyStatusDropdown_(sheet, sheet.getLastRow(), sheet.getLastRow());
}

// 先頭が「=」などの文字は、計算式として扱われないようにする
function safe_(v) {
  return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function formSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(FIXED_HEADERS);
    sheet.getRange(1, 1, 1, FIXED_HEADERS.length).setFontWeight("bold").setBackground("#ebeff0");
    sheet.setFrozenRows(1);
    applyStatusColors_(sheet);
  }
  return sheet;
}

function headerIndex_(sheet, label) {
  if (sheet.getLastColumn() === 0) return -1;
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String).indexOf(label);
}

// 「対応状況」をプルダウンで選べるようにする
function applyStatusDropdown_(sheet, fromRow, toRow) {
  var col = headerIndex_(sheet, "対応状況") + 1;
  if (col < 1 || toRow < fromRow) return;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_OPTIONS, true).setAllowInvalid(true).build();
  sheet.getRange(fromRow, col, toRow - fromRow + 1, 1).setDataValidation(rule);
}

// 「未対応」は赤、「成約」は緑で色分けする
function applyStatusColors_(sheet) {
  var col = headerIndex_(sheet, "対応状況") + 1;
  if (col < 1) return;
  var range = sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1);
  var rules = sheet.getConditionalFormatRules().filter(function (r) {
    return !r.getRanges().some(function (rg) { return rg.getColumn() === col; });
  });
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("未対応").setBackground("#fdecea").setFontColor("#c0392b").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("成約").setBackground("#e8f5ee").setFontColor("#2e8b57").setRanges([range]).build());
  sheet.setConditionalFormatRules(rules);
}

// =====================================================
// 提案のヒント(回答の組み合わせから、確認したほうがよい点を自動で書き出す)
// =====================================================

function makeHints_(data) {
  var a = {};
  data.answers.forEach(function (x) { a[x.id] = x.value || ""; });
  var has = function (id, word) { return (a[id] || "").indexOf(word) !== -1; };
  var any = function (id, words) { return words.some(function (w) { return has(id, w); }); };
  var hints = [];

  // ---- パソコン・スマホ共通 ----
  if (any("age", ["60〜70代", "80代以上"]) || has("skill", "苦手")) {
    hints.push("ご高齢の方、または操作に不安がある方です。初期設定・使い方の説明をセットで提案すると安心です。");
  }
  if (has("current_maker", "持っていない") || has("reason", "初めて購入する")) {
    hints.push("初めての購入です。基本的な使い方の説明を含めた提案がおすすめです。");
  }
  if (has("data_transfer", "お願いしたい")) {
    hints.push("データ移行のご依頼があります。作業時間と料金を事前にご案内ください。");
  }
  if (any("deadline", ["できるだけ早く", "1週間以内"])) {
    hints.push("納期が近いです。在庫のある機種から優先的にご提案ください。");
  }
  if (has("quantity", "3台以上")) {
    hints.push("3台以上の購入です。まとめ買いの値引きや、法人向けモデルも検討できます。");
  }
  if (a.accessories && !has("accessories", "特になし")) {
    hints.push("一緒に購入したいもの:" + a.accessories + "。セットでの見積もりが可能です。");
  }

  if (data.formType === "pc") {
    var heavy = ["動画・写真の編集", "ゲーム", "プログラミング"].filter(function (w) { return has("usage", w); });
    if (heavy.length && has("budget", "5万円未満")) {
      hints.push("ご予算5万円未満に対して、負荷の高い用途(" + heavy.join("、") + ")があります。性能が足りるか、予算の再確認をおすすめします。");
    }
    if (has("usage", "動画・写真の編集") || has("usage", "ゲーム")) {
      hints.push("動画編集・ゲームの用途があります。メモリ16GB以上で、処理性能の高いモデルを候補にしてください。");
    }
    if (has("os", "Mac")) {
      var missing = ["テンキー", "DVD・CDドライブ", "有線LANポート"].filter(function (w) { return has("features", w); });
      if (missing.length) {
        hints.push("Macをご希望で、" + missing.join("・") + "が必要とのことです。本体に付いていない機種が多いため、外付け機器もご案内ください。");
      }
      if (has("office", "付いているもの")) {
        hints.push("Macをご希望で、Officeソフトが必要です。Mac には Office が付いていないため、別途購入のご案内が必要です。");
      }
    }
    if (has("pc_type", "持ち運び重視") && has("screen", "15インチ以上")) {
      hints.push("持ち運び重視で、15インチ以上をご希望です。重さとのバランスを確認してください。");
    }
    if (has("reason", "Windows 10")) {
      hints.push("Windows 10 のサポート終了による買い替えです(2025年10月14日に終了済み)。データ移行とあわせてご提案ください。");
    }
  } else {
    if (has("budget", "3万円未満") && has("features", "高性能カメラ")) {
      hints.push("ご予算3万円未満で、高性能カメラをご希望です。ご予算と性能の優先順位を確認してください。");
    }
    var fromIphone = has("current_maker", "iPhone");
    var fromAndroid = any("current_maker", ["Galaxy", "AQUOS", "Xperia", "Google Pixel", "arrows", "OPPO", "らくらく"]);
    if ((fromIphone && has("os", "Android")) || (fromAndroid && has("os", "iPhone"))) {
      hints.push("iPhone と Android をまたぐ乗り換えです。LINE やアプリのデータの引き継ぎ方法が異なるため、事前に確認・ご説明ください。");
    }
    if (has("current_maker", "ガラケー") || has("reason", "ガラケー")) {
      hints.push("ガラケーからの乗り換えです。初期設定と基本操作の説明をセットでご提案ください。");
    }
    if (any("age", ["10歳未満", "10代"])) {
      hints.push("お子さま向けです。フィルタリングの設定と、保護者の同意が必要な手続きを確認してください。");
    }
    if (has("os", "iPhone") && has("features", "microSD")) {
      hints.push("iPhone は microSD カードに対応していません。容量の大きいモデルか、クラウド保存をご案内ください。");
    }
    if (has("os", "iPhone") && has("features", "イヤホンジャック")) {
      hints.push("iPhone にはイヤホンジャックがありません。変換アダプターかワイヤレスイヤホンをご提案ください。");
    }
    if (has("os", "Android") && has("features", "おサイフケータイ")) {
      hints.push("おサイフケータイが必要です。FeliCa に対応した機種に絞ってご提案ください。");
    }
    if (has("storage", "わからない") && has("usage", "写真・動画の撮影")) {
      hints.push("写真・動画の撮影が多いようです。256GB以上の容量がおすすめです。");
    }
    if (has("carrier", "乗り換え")) {
      hints.push("通信会社の乗り換えをご希望です。本人確認書類など、必要な持ち物を事前にご案内ください。");
    }
    if (has("payment", "分割払い")) {
      hints.push("分割払いのご希望があります。審査や、今の端末の残りの支払いを確認してください。");
    }
  }
  return hints;
}

// =====================================================
// メール
// =====================================================

function formatBody_(data) {
  var lines = [];
  var lastSection = "";
  var n = 0;
  data.answers.forEach(function (a) {
    if (a.section !== lastSection) {
      n += 1;
      lines.push("", "■ " + n + ". " + a.section);
      lastSection = a.section;
    }
    lines.push("・" + a.label + ":" + (a.value || "(未記入)"));
  });
  return lines.join("\n");
}

function notifyOwner_(data, photos) {
  var subject =
    "【ヒアリングシート受信】" + data.receiptNo + " " + data.formName + " / " + (data.name || "お名前未記入") + " 様";
  var hints = data.hints.length
    ? "■ 提案のヒント(自動判定・参考情報)\n" + data.hints.map(function (h) { return "・" + h; }).join("\n") + "\n\n"
    : "";
  var body =
    data.formName + "のヒアリングシートが届きました。\n" +
    "受付番号:" + data.receiptNo + "\n" +
    "受信日時:" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm") + "\n" +
    "回答の種類:" + (data.mode === "simple" ? "かんたん版" : "しっかり版") + "\n\n" +
    hints +
    "■ ご回答内容" +
    formatBody_(data) + "\n\n" +
    (photos.length ? "※写真が " + photos.length + " 枚添付されています。\n" : "") +
    "――\nスプレッドシート:" + SpreadsheetApp.getActiveSpreadsheet().getUrl();

  MailApp.sendEmail({
    to: notifyAddress_(),
    subject: subject,
    body: body,
    replyTo: isEmail_(data.email) ? data.email : undefined, // 返信するとお客様に届く
    attachments: photos.map(function (p) { return p.blob; }),
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
  data.answers.forEach(function (a) { answers[a.id] = a.value; });
  var method = answers.contact_method;
  var how = method && method !== "どちらでもよい" ? method + "で" : "メールまたはお電話で";

  var shop = [];
  if (SHOP_NAME) shop.push(SHOP_NAME);
  if (SHOP_TEL) shop.push("TEL:" + SHOP_TEL);
  if (SHOP_HOURS) shop.push("受付時間:" + SHOP_HOURS);

  var body =
    (data.name || "お客様") + " 様\n\n" +
    "このたびは" + data.formName + "の買い替えについて\n" +
    "ヒアリングシートにご回答いただき、ありがとうございます。\n" +
    "以下の内容で受け付けました。\n\n" +
    "――――――――――――――――\n" +
    "受付番号:" + data.receiptNo + "\n" +
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
    subject: "【受付完了】" + data.formName + "のヒアリングシート(受付番号 " + data.receiptNo + ")",
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

// =====================================================
// 未対応のお知らせ(毎朝9時ごろに自動で実行)
// =====================================================

function remindPending() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var limit = Date.now() - REMIND_AFTER_HOURS * 3600 * 1000;
  var lines = [];

  FORM_SHEETS.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var rows = sheet.getDataRange().getValues();
    var h = rows[0].map(String);
    var iDate = h.indexOf("受信日時"), iNo = h.indexOf("受付番号"), iSt = h.indexOf("対応状況"), iName = h.indexOf("お名前");
    rows.slice(1).forEach(function (r) {
      var date = r[iDate] instanceof Date ? r[iDate] : new Date(r[iDate]);
      if (String(r[iSt]) === "未対応" && date.getTime() < limit) {
        var hours = Math.floor((Date.now() - date.getTime()) / 3600000);
        lines.push("・[" + name + "] " + r[iNo] + " " + (iName >= 0 ? r[iName] : "") + " 様(受信から約" + hours + "時間)");
      }
    });
  });

  if (!lines.length) return 0;
  MailApp.sendEmail({
    to: notifyAddress_(),
    subject: "【要対応】未対応のヒアリングシートが " + lines.length + " 件あります",
    body:
      "受信から" + REMIND_AFTER_HOURS + "時間以上「未対応」のままの回答があります。\n" +
      "お客様へのご連絡をお願いします。\n\n" +
      lines.join("\n") +
      "\n\n対応したら、スプレッドシートの「対応状況」を変更してください。\n" +
      ss.getUrl(),
  });
  return lines.length;
}

// =====================================================
// 集計(毎朝7時ごろに自動で更新。メニューからいつでも更新できます)
// =====================================================

var SUMMARY_ITEMS = [
  "対応状況",
  "回答の種類",
  "使う方のご年代",
  "買い替えの理由",
  "希望のタイプ",
  "希望のOS",
  "希望の機種",
  "主な用途",
  "想定ご予算(税込)",
  "想定ご予算(端末代・税込)",
  "一緒に購入したいもの",
  "あると助かるサポート",
];

function updateSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = ss.getSheetByName("集計") || ss.insertSheet("集計");
  out.clear();
  var rows = [["回答の集計", "", "更新:" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm")], ["", "", ""]];
  var titleRows = [];

  FORM_SHEETS.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var data = sheet.getDataRange().getValues();
    var h = data[0].map(String);
    var body = data.slice(1);
    var total = body.length;
    var iSt = h.indexOf("対応状況");
    var won = body.filter(function (r) { return String(r[iSt]) === "成約"; }).length;
    var closed = body.filter(function (r) { return ["成約", "失注"].indexOf(String(r[iSt])) !== -1; }).length;

    titleRows.push(rows.length + 1);
    rows.push(["■ " + name, "", ""]);
    rows.push(["回答数", total, ""]);
    rows.push(["成約数", won, ""]);
    rows.push(["成約率(成約 ÷ 結果が出た件数)", closed ? Math.round((won / closed) * 1000) / 10 + "%" : "-", "結果が出た件数:" + closed]);
    rows.push(["", "", ""]);

    SUMMARY_ITEMS.forEach(function (label) {
      var i = h.indexOf(label);
      if (i === -1) return;
      var counts = {};
      body.forEach(function (r) {
        String(r[i]).split("、").forEach(function (v) {
          v = v.trim();
          if (v) counts[v] = (counts[v] || 0) + 1;
        });
      });
      var keys = Object.keys(counts).sort(function (x, y) { return counts[y] - counts[x]; });
      if (!keys.length) return;
      rows.push(["【" + label + "】", "件数", "割合"]);
      keys.forEach(function (k) {
        rows.push(["  " + k, counts[k], Math.round((counts[k] / total) * 1000) / 10 + "%"]);
      });
      rows.push(["", "", ""]);
    });
  });

  if (rows.length === 2) rows.push(["まだ回答がありません", "", ""]);
  out.getRange(1, 1, rows.length, 3).setValues(rows);
  out.getRange(1, 1).setFontWeight("bold").setFontSize(14);
  titleRows.forEach(function (r) { out.getRange(r, 1).setFontWeight("bold").setFontSize(12); });
  out.setColumnWidth(1, 320);
  return rows.length;
}

// =====================================================
// 見積もりのたたき台(回答の行を選んで、メニューから作成)
// =====================================================

var PRICE_SHEET = "価格表";

function createEstimate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var rowNo = sheet.getActiveRange() ? sheet.getActiveRange().getRow() : 0;
  if (FORM_SHEETS.indexOf(sheet.getName()) === -1 || rowNo < 2) {
    alert_("「パソコン」または「スマートフォン」のシートで、見積もりを作りたいお客様の行を選んでから実行してください。");
    return null;
  }
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var r = sheet.getRange(rowNo, 1, 1, sheet.getLastColumn()).getValues()[0];
  var get = function (label) {
    var i = h.indexOf(label);
    return i === -1 ? "" : String(r[i] || "");
  };
  var list = function (label) {
    return get(label).split("、").map(function (v) { return v.trim(); }).filter(function (v) {
      return v && v.indexOf("特になし") !== 0 && v.indexOf("その他") !== 0;
    });
  };

  var qty = { "1台": 1, "2台": 2, "3台以上": 3 }[get("購入台数")] || 1;
  var lines = [[sheet.getName() + "本体", qty, ""]];
  if (get("Word・Excel などのOfficeソフト").indexOf("付いているもの") === 0) lines.push(["Microsoft Office", qty, ""]);
  list("一緒に購入したいもの").forEach(function (item) {
    var notes = h
      .map(function (label, i) { return label.indexOf(item + ":") === 0 && r[i] ? label.slice(item.length + 1) + ":" + r[i] : ""; })
      .filter(String)
      .join(" / ");
    lines.push([item, 1, notes]);
  });
  if (get("古いパソコンからのデータ移行") === "お願いしたい" || get("古いスマホからのデータ移行") === "お願いしたい") {
    lines.push(["データ移行", qty, ""]);
  }
  list("あると助かるサポート").forEach(function (item) { lines.push([item, 1, "サポート"]); });

  var prices = ensurePriceSheet_(lines.map(function (l) { return l[0]; }));

  var no = get("受付番号") || "番号なし";
  var name = "見積_" + no;
  var n = 2;
  while (ss.getSheetByName(name)) name = "見積_" + no + "_" + n++;
  var est = ss.insertSheet(name);

  var head = [
    ["お見積り(たたき台)", "", "", "", ""],
    ["", "", "", "", ""],
    ["お名前", safe_(get("お名前") + " 様"), "", "", ""],
    ["受付番号", safe_(no), "", "", ""],
    ["作成日", Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd"), "", "", ""],
    ["ご予算", safe_(get("想定ご予算(税込)") || get("想定ご予算(端末代・税込)")), "", "", ""],
    ["", "", "", "", ""],
    ["品目", "数量", "単価(税込)", "金額", "備考"],
  ];
  est.getRange(1, 1, head.length, 5).setValues(head);
  var start = head.length + 1;
  lines.forEach(function (l, i) {
    var row = start + i;
    est.getRange(row, 1, 1, 5).setValues([[
      safe_(l[0]),
      l[1],
      "=IFERROR(VLOOKUP(A" + row + ",'" + PRICE_SHEET + "'!B:C,2,FALSE),\"\")",
      "=IF(C" + row + "=\"\",\"\",B" + row + "*C" + row + ")",
      safe_(l[2]),
    ]]);
  });
  var end = start + lines.length - 1;
  est.getRange(end + 1, 3, 1, 2).setValues([["合計", "=SUM(D" + start + ":D" + end + ")"]]);
  est.getRange(end + 3, 1).setValue("※単価は「価格表」シートから自動で入ります。空欄の品目は、価格表に金額を入れてください。");
  est.getRange(1, 1).setFontWeight("bold").setFontSize(14);
  est.getRange(head.length, 1, 1, 5).setFontWeight("bold").setBackground("#ebeff0");
  est.getRange(end + 1, 3, 1, 2).setFontWeight("bold");
  est.getRange(start, 3, lines.length + 1, 2).setNumberFormat("#,##0");
  est.setColumnWidth(1, 220);
  est.setColumnWidth(5, 420);
  ss.setActiveSheet(est);
  return { sheet: name, lines: lines.length, prices: prices };
}

// 価格表がなければ作り、まだ載っていない品目を追加する
function ensurePriceSheet_(items) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PRICE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PRICE_SHEET);
    sheet.appendRow(["区分", "商品名", "単価(税込)", "備考"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#ebeff0");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(2, 220);
  }
  var names = sheet.getLastRow() > 1 ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().map(function (v) { return String(v[0]); }) : [];
  var added = 0;
  items.forEach(function (item) {
    if (names.indexOf(item) === -1) {
      sheet.appendRow(["", safe_(item), "", "見積もり作成時に自動で追加"]);
      names.push(item);
      added += 1;
    }
  });
  return added;
}

function alert_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (err) {
    console.log(msg);
  }
}

// =====================================================
// メニューと初期設定
// =====================================================

// スプレッドシートを開くと、上部に「ヒアリングシート」メニューが表示されます
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("ヒアリングシート")
    .addItem("選択した行の見積もりたたき台を作る", "createEstimate")
    .addItem("集計を更新する", "updateSummary")
    .addItem("未対応の回答をいますぐ確認する", "remindPendingNow")
    .addSeparator()
    .addItem("初期設定(自動お知らせ・プルダウン)", "setup")
    .addToUi();
}

function remindPendingNow() {
  var n = remindPending();
  alert_(n ? "未対応の回答が " + n + " 件あります。お知らせメールを送りました。" : "時間がたった未対応の回答はありません。");
}

// 最初に1回だけ実行してください
function setup() {
  // 自動実行の予約(重複しないよう、いったん消してから作り直す)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (["remindPending", "updateSummary"].indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("remindPending").timeBased().everyDays(1).atHour(9).inTimezone("Asia/Tokyo").create();
  ScriptApp.newTrigger("updateSummary").timeBased().everyDays(1).atHour(7).inTimezone("Asia/Tokyo").create();

  // すでにある回答にも、プルダウンと色分けを付ける
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  FORM_SHEETS.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    if (sheet.getLastRow() >= 2) applyStatusDropdown_(sheet, 2, sheet.getLastRow());
    applyStatusColors_(sheet);
  });
  ensurePriceSheet_([]);
  updateSummary();
  alert_("初期設定が完了しました。毎朝、未対応のお知らせと集計の更新が自動で行われます。");
}

/**
 * 設置後の動作確認用。
 * エディタ上でこの関数を選んで「実行」すると、テスト回答が1件記録され、メールが届きます。
 */
function testSubmit() {
  var no = "PC-" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyMMdd") + "-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  var res = doPost({
    postData: {
      contents: JSON.stringify({
        receiptNo: no,
        formType: "pc",
        mode: "full",
        elapsedSec: 999,
        name: "テスト 太郎",
        email: "",
        answers: [
          { section: "使う方について", id: "age", label: "使う方のご年代", value: "60〜70代" },
          { section: "現在の利用状況と買い替え理由", id: "reason", label: "買い替えの理由", value: "Windows 10 などOSのサポート終了" },
          { section: "予算と納期", id: "budget", label: "想定ご予算(税込)", value: "5〜10万円" },
          { section: "その他・特記事項", id: "accessories", label: "一緒に購入したいもの", value: "マウス" },
          { section: "その他・特記事項", id: "accessories_0_0", label: "マウス:接続方法", value: "無線(Bluetooth)" },
          { section: "お客様情報", id: "name", label: "お名前", value: "テスト 太郎" },
        ],
      }),
    },
  });
  console.log(res.getContent());
}
