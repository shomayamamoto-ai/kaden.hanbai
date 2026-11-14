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

// 回答を保存しておく期間(月)。この期間を過ぎた回答と写真は、毎朝自動で削除します。
// 0 にすると、自動では削除しません。
// ※ config.js の PRIVACY.RETENTION_MONTHS と同じにしてください
var RETENTION_MONTHS = 12;

// いたずら対策
var MAX_PER_HOUR = 30; // 1時間に受け付ける回答の上限
var MIN_FILL_SECONDS = 5; // これより早く送信されたものは機械による送信とみなす

// 写真を保存する Google ドライブのフォルダ名
var PHOTO_FOLDER_NAME = "ヒアリングシート写真";

// 対応状況のプルダウンの選択肢
var STATUS_OPTIONS = ["未対応", "連絡済み", "提案済み", "成約", "失注", "対応不要"];

// 担当者の名前(「担当者」の列でプルダウンから選べるようになります)
// 例:var STAFF = ["山本", "佐藤", "鈴木"];  空のままなら、自由に入力できます。
var STAFF = [];
// ================

var FORM_SHEETS = ["パソコン", "スマートフォン", "タブレット", "携帯料金見直し"];
var ESTIMATE_SHEETS = ["パソコン", "スマートフォン", "タブレット"]; // 見積もりのたたき台を作れるシート
var FORM_NAMES = { pc: "パソコン", phone: "スマートフォン", tablet: "タブレット", plan: "携帯料金見直し" };
var FIXED_HEADERS = ["受信日時", "受付番号", "対応状況", "担当者", "対応日", "成約金額", "対応メモ", "提案のヒント", "写真", "回答の種類"];
var DROPOFF_SHEET = "離脱ログ";
var DROPOFF_HEADERS = ["日時", "シート", "回答の種類", "やめたステップ", "必須の回答数", "必須の総数", "経過秒"];
var MAX_DROPOFF_PER_HOUR = 300;
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
  // 途中でやめた方の記録(どのステップでやめたかだけ。回答や個人情報は含まない)
  if (data && data.event === "dropoff") return logDropoff_(data);

  if (!data || !/^(PC|SP|TB|MP)-\d{6}-\d{4}$/.test(String(data.receiptNo || ""))) {
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

function logDropoff_(data) {
  var cache = CacheService.getScriptCache();
  var key = "drop_" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHH");
  var count = Number(cache.get(key) || 0);
  if (count >= MAX_DROPOFF_PER_HOUR || !FORM_NAMES[data.formType]) return json_({ ok: false });
  cache.put(key, String(count + 1), 3700);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(DROPOFF_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(DROPOFF_SHEET);
      sheet.appendRow(DROPOFF_HEADERS);
      sheet.getRange(1, 1, 1, DROPOFF_HEADERS.length).setFontWeight("bold").setBackground("#ebeff0");
      sheet.setFrozenRows(1);
    }
    var num = function (v) { return Math.max(0, Math.min(99999, Math.round(Number(v) || 0))); };
    sheet.appendRow([
      new Date(),
      FORM_NAMES[data.formType],
      data.mode === "simple" ? "かんたん版" : "しっかり版",
      safe_(String(data.step || "").slice(0, 50)),
      num(data.answered),
      num(data.total),
      num(data.elapsedSec),
    ]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
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
  if (!FORM_NAMES[data.formType]) data.formType = "pc";
  data.formName = FORM_NAMES[data.formType];
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

  // 担当者も、名前を登録してあればプルダウンで選べるようにする
  var staffCol = headerIndex_(sheet, "担当者") + 1;
  if (staffCol >= 1 && STAFF.length) {
    var staffRule = SpreadsheetApp.newDataValidation().requireValueInList(STAFF, true).setAllowInvalid(true).build();
    sheet.getRange(fromRow, staffCol, toRow - fromRow + 1, 1).setDataValidation(staffRule);
  }
}

// 「対応状況」を「未対応」以外に変えたら、「対応日」に今日の日付を自動で入れる
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var range = e.range;
    var sheet = range.getSheet();
    if (FORM_SHEETS.indexOf(sheet.getName()) === -1 || range.getRow() < 2) return;
    if (range.getColumn() !== headerIndex_(sheet, "対応状況") + 1) return;
    var dateCol = headerIndex_(sheet, "対応日") + 1;
    if (dateCol < 1) return;
    var value = String(range.getValue());
    var cell = sheet.getRange(range.getRow(), dateCol);
    if (value && value !== "未対応" && !cell.getValue()) cell.setValue(new Date());
  } catch (err) {
    console.error(err);
  }
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
  } else if (data.formType === "tablet") {
    makeTabletHints_(a, has, any, hints, data.answers);
  } else if (data.formType === "plan") {
    makePlanHints_(a, has, any, hints);
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

// タブレットのヒント
function makeTabletHints_(a, has, any, hints, answers) {
  // 用途ごとの追加質問は、見出し名の一部で回答を探す(例:「お子さまの学年」)
  var byLabel = function (part) {
    var hit = answers.filter(function (x) { return x.label.indexOf(part) !== -1 && x.value; })[0];
    return hit ? hit.value : "";
  };

  var iPhoneUser = has("phone_os", "iPhone");
  var androidUser = has("phone_os", "Android");
  if ((iPhoneUser && any("os", ["Android", "Windows", "Fire"])) || (androidUser && has("os", "iPad"))) {
    hints.push("お使いのスマホ(" + a.phone_os + ")と、希望のタブレット(" + a.os + ")の種類が違います。アプリや写真の共有がしにくくなる点をご説明ください。");
  } else if (iPhoneUser && has("os", "こだわりなし")) {
    hints.push("iPhoneをお使いです。アプリや写真を共有しやすい iPad がおすすめです。");
  } else if (androidUser && has("os", "こだわりなし")) {
    hints.push("Androidスマホをお使いです。同じアプリが使える Androidタブレットがおすすめです。");
  }
  if (has("home_wifi", "ない") && !has("connectivity", "SIMを入れる")) {
    hints.push("自宅にWi-Fiがありません。Wi-Fiモデルだとインターネットが使えないため、自宅のネット回線か、SIMを入れるモデルをご提案ください。");
  }
  if (has("designated", "指定")) {
    hints.push("学校・会社からの指定・推奨の機種があります(" + a.designated + ")。条件(OS・画面サイズ・キーボードなど)を必ず確認してください。");
  }
  if (byLabel("使いたいアプリ").indexOf("Procreate") !== -1 && !has("os", "iPad")) {
    hints.push("イラストアプリの Procreate は iPad 専用です。iPad 以外をご希望の場合は、別のアプリをご案内ください。");
  }
  if (byLabel("イラストの経験").indexOf("本格的") !== -1) {
    hints.push("本格的にイラストを描く方です。画面の大きさ・ペンの書き心地・処理性能を重視した上位モデルをご提案ください。");
  }
  var grade = byLabel("お子さまの学年");
  if (grade) {
    hints.push("お子さまの学年:" + grade + "。制限したいこと:" + (byLabel("制限したいこと") || "未回答") + "。設定のサポートもあわせてご提案ください。");
  }
  if (byLabel("会社の指定やセキュリティのルール") === "ある") {
    hints.push("仕事で使う予定で、会社のルールがあります。会社が認めている機種・設定を確認してください。");
  }
  if (byLabel("遊ぶゲームの種類").indexOf("3D") !== -1 || byLabel("遊ぶゲームの種類").indexOf("オンライン対戦") !== -1) {
    hints.push("3Dやオンライン対戦のゲームを遊ぶ予定です。処理性能の高いモデルをご提案ください。");
  }
  if (byLabel("見開き").indexOf("読みたい") === 0) {
    hints.push("マンガを見開きで読みたいご希望です。11インチ以上の画面がおすすめです。");
  }
  if (has("daily_hours", "3時間以上")) {
    hints.push("1日3時間以上使う予定です。バッテリーが長持ちする機種と、充電器をご提案ください。");
  }
  if (has("weight", "軽さを最優先") && has("size", "大きめ")) {
    hints.push("軽さ最優先で、大きめの画面をご希望です。重さと画面の大きさのバランスを確認してください。");
  }
  if (has("condition", "整備済み") || has("condition", "中古")) {
    hints.push("整備済み品・中古もご検討です。バッテリーの状態と、OSのアップデートがいつまで続くかを確認してご提案ください。");
  }
  if (has("old_device", "下取り")) {
    hints.push("今のタブレットの下取り・買取をご希望です。査定と、データの消去(初期化)をご案内ください。");
  }
  if (has("old_device", "処分")) {
    hints.push("今のタブレットの処分をご希望です。データの消去と、引き取りの方法・料金をご案内ください。");
  }

  if (has("os", "Fire")) {
    hints.push("Fire タブレットをご希望です。Google Play のアプリは使えないため、使いたいアプリが対応しているか確認してください。");
  }
  if (has("features", "スマホと同じアプリ")) {
    hints.push("スマホと同じアプリを使いたいご希望です。お使いのスマホ(iPhone/Android)と同じ種類のタブレットをご提案ください。");
  }
  if (has("features", "ペンで書ける") || has("usage", "イラスト") || has("usage", "勉強・ノート")) {
    hints.push("ペンを使う用途があります。ペンに対応した機種か、ペンが別売りかを確認し、ペン代も含めてご提案ください。");
  }
  if (has("usage", "ノートパソコンの代わり") || has("features", "キーボード")) {
    hints.push("ノートパソコンの代わり・キーボードのご希望があります。キーボード付きカバーの対応や、Windowsタブレットも候補にしてください。");
  }
  if ((has("place", "外出先") || has("place", "車の中")) && has("connectivity", "Wi-Fiだけ")) {
    hints.push("外でも使う予定ですが、Wi-Fiモデルのご希望です。テザリングやモバイルWi-Fiの必要性を確認してください。");
  }
  if (has("connectivity", "SIMを入れる")) {
    hints.push("SIMを入れるモデル(セルラーモデル)のご希望です。通信の契約(データプラン)も必要なので、料金見直しもあわせてご提案できます。");
  }
  if (has("user", "お子さま") || any("age", ["10歳未満", "10代"])) {
    hints.push("お子さま向けです。使用時間やアプリの制限(ペアレンタルコントロール)と、耐衝撃ケースをご提案ください。");
  }
  if (has("usage", "ゲーム") && has("budget", "2万円未満")) {
    hints.push("ゲームの用途に対して、ご予算が2万円未満です。快適に動くか、予算の再確認をおすすめします。");
  }
  if (has("storage", "わからない") && (has("usage", "写真") || has("usage", "イラスト"))) {
    hints.push("写真・イラストの用途があります。128GB以上の容量がおすすめです。");
  }
}

// 携帯料金見直しのヒント
function makePlanHints_(a, has, any, hints) {
  var small = any("data_usage", ["3GB未満", "3〜10GB"]);
  var expensive = any("monthly_fee", ["8,000〜1万円", "1万〜1万5,000円", "1万5,000円以上"]);
  if (small && expensive) {
    hints.push("データ使用量が少ないのに、月々の料金が高めです。小容量プランや、オンライン専用プランへの見直しで安くなる可能性が高いです。");
  }
  if (has("throttle", "毎月") || has("data_usage", "50GB以上")) {
    hints.push("データが足りていません(速度制限・大容量)。使い放題プラン、または自宅Wi-Fiの活用をご提案ください。");
  }
  if (has("data_usage", "わからない") || has("monthly_fee", "わからない")) {
    hints.push("データ量か料金が不明です。マイページか請求書で確認していただくか、来店時に一緒に確認してください。");
  }
  if (any("family_count", ["3人", "4人", "5人以上"])) {
    hints.push("同じ会社のご家族が3人以上います。家族割やまとめての乗り換えで、合計の料金が大きく変わる可能性があります。");
  }
  if (has("installment", "はい")) {
    hints.push("端末代の分割払いが残っています(残り:" + (a.installment_left || "不明") + "/" + (a.installment_times || "不明") + ")。乗り換えると残りを一括で請求されることがあるため、乗り換えの時期をご相談ください。");
  }
  if (has("holder", "ご家族") || has("holder", "会社")) {
    hints.push("契約の名義人がご本人ではありません。手続きに名義人の同意・来店が必要か、事前に確認してください。");
  }
  if (has("carrier_mail", "今後も必要")) {
    hints.push("携帯会社のメールアドレスを今後も使いたいご希望です。乗り換える場合は、有料の持ち運びサービスなどの対象かを確認してください。");
  }
  if (any("call_time", ["1〜3時間", "3時間以上"]) || has("call_style", "仕事")) {
    hints.push("通話が多い方です。かけ放題(時間無制限)の要否を確認し、料金に含めて比較してください。");
  }
  if (has("call_time", "ほとんど使わない") && has("options", "かけ放題")) {
    hints.push("通話をほとんど使わないのに、かけ放題に加入しています。外すだけで安くなる可能性があります。");
  }
  if (has("options", "サブスク") || has("options", "補償")) {
    hints.push("有料オプション(" + a.options + ")に加入中です。使っているかを確認し、不要なものは外すことをご提案ください。");
  }
  if (a.signal && !has("signal", "特にない")) {
    hints.push("電波がつながりにくい場所があります(" + a.signal + ")。乗り換え先の会社のエリアを確認してください。");
  }
  if (has("area", "地方・山間部")) {
    hints.push("地方・山間部でのご利用が多いです。乗り換え先の電波のエリアを優先して確認してください。");
  }
  var groups = [
    ["dポイント", "d払い", "dカード", "ドコモ系(ドコモ・ahamo)"],
    ["Pontaポイント", "au PAY", "au PAY カード", "au系(au・UQモバイル・povo)"],
    ["PayPayポイント", "PayPay", "PayPayカード", "ソフトバンク系(ソフトバンク・ワイモバイル・LINEMO)"],
    ["楽天ポイント", "楽天ペイ", "楽天カード", "楽天モバイル"],
  ];
  groups.forEach(function (g) {
    var score = (has("points", g[0]) ? 1 : 0) + (has("pay_service", g[1]) ? 1 : 0) + (has("payment_card", g[2]) ? 1 : 0);
    if (score >= 2) hints.push("ポイント・決済が「" + g[3] + "」に集まっています。同じグループの携帯会社にすると、ポイント還元を受けやすくなります。");
  });
  if (has("home_wifi", "いいえ")) {
    hints.push("自宅にWi-Fiがありません。光回線やホームルーターと、携帯とのセット割をご提案できます。");
  }
  if (has("net_need", "乗り換え") || (a.net_trouble && !has("net_trouble", "特になし"))) {
    hints.push("自宅のネットに見直しのご希望・不満があります(" + (a.net_trouble || a.net_need) + ")。携帯とのセット割もあわせてご提案ください。");
  }
  if (has("housing", "賃貸") && has("net_need", "新しく引きたい")) {
    hints.push("賃貸にお住まいで、新しくネットを引きたいご希望です。工事の可否(大家さんの許可)を確認するか、工事のいらないホームルーターもご提案ください。");
  }
  if (has("device_plan", "機種変更")) {
    hints.push("機種変更もご検討中です。端末代を含めた総額で比べてご提案ください。");
  }
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
    "このたびは" + (data.formType === "plan" ? "携帯料金の見直し" : data.formName + "の買い替え") + "について\n" +
    "ヒアリングシートにご回答いただき、ありがとうございます。\n" +
    "以下の内容で受け付けました。\n\n" +
    "――――――――――――――――\n" +
    "受付番号:" + data.receiptNo + "\n" +
    "――――――――――――――――\n\n" +
    "■ このあとの流れ\n" +
    "1. 担当者が内容を確認します\n" +
    "2. " + REPLY_TIME + "に、" + how + "ご連絡します\n" +
    (data.formType === "plan" ? "3. ご利用状況に合ったプランをご提案します\n\n" : "3. ご予算・用途に合った機種をご提案します\n\n") +
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
// 古い回答の自動削除(毎朝6時ごろに自動で実行)
// =====================================================
// 保存期間を過ぎた回答の行・写真・見積もりシート・離脱ログを削除します。
// 削除したときは、件数をメールでお知らせします。

function purgeOld() {
  if (!(RETENTION_MONTHS > 0)) return 0;
  var limit = new Date();
  limit.setMonth(limit.getMonth() - RETENTION_MONTHS);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var removed = 0;
  var photos = 0;
  var numbers = [];

  FORM_SHEETS.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var data = sheet.getDataRange().getValues();
    var h = data[0].map(String);
    var iDate = h.indexOf("受信日時"), iNo = h.indexOf("受付番号"), iPhoto = h.indexOf("写真");
    if (iDate === -1) return;
    // 行番号がずれないよう、下の行から順に消す
    for (var r = data.length - 1; r >= 1; r--) {
      var date = data[r][iDate];
      if (!(date instanceof Date) || date.getTime() >= limit.getTime()) continue;
      if (iPhoto !== -1) photos += trashPhotos_(String(data[r][iPhoto] || ""));
      if (iNo !== -1 && data[r][iNo]) numbers.push(String(data[r][iNo]));
      sheet.deleteRow(r + 1);
      removed += 1;
    }
  });

  // 削除した回答の「見積もりのたたき台」シートも消す
  ss.getSheets().forEach(function (sheet) {
    var name = sheet.getName();
    if (name.indexOf("見積_") !== 0) return;
    var no = name.slice(3).replace(/_\d+$/, "");
    if (numbers.indexOf(no) !== -1) ss.deleteSheet(sheet);
  });

  // 離脱ログ(個人情報は入っていませんが、同じ期間で整理します)
  var drop = ss.getSheetByName(DROPOFF_SHEET);
  if (drop && drop.getLastRow() >= 2) {
    var rows = drop.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0] instanceof Date && rows[i][0].getTime() < limit.getTime()) drop.deleteRow(i + 1);
    }
  }

  if (removed) {
    MailApp.sendEmail({
      to: notifyAddress_(),
      subject: "【お知らせ】保存期間を過ぎたヒアリングシートを " + removed + " 件削除しました",
      body:
        "保存期間(" + RETENTION_MONTHS + "か月)を過ぎた回答を、自動で削除しました。\n\n" +
        "・削除した回答:" + removed + " 件\n" +
        "・削除した写真:" + photos + " 枚\n\n" +
        "保存期間は、Apps Script の RETENTION_MONTHS で変更できます(0 にすると自動では削除しません)。\n" +
        ss.getUrl(),
    });
  }
  return removed;
}

// 「写真」の列に入っている Google ドライブのファイルを、ごみ箱に移す
function trashPhotos_(cell) {
  var count = 0;
  cell.split("\n").forEach(function (url) {
    var m = /[-\w]{25,}/.exec(url);
    if (!m) return;
    try {
      DriveApp.getFileById(m[0]).setTrashed(true);
      count += 1;
    } catch (err) {
      console.error("写真を削除できませんでした:", err);
    }
  });
  return count;
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
  "想定ご予算(本体・税込)",
  "希望の種類",
  "画面の大きさ",
  "一緒に購入したいもの",
  "あると助かるサポート",
  "現在の携帯会社",
  "毎月の携帯料金(1人あたり)",
  "毎月のデータ使用量",
  "自宅にWi-Fiはありますか?",
  "見直しで重視したいこと",
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

    // 売上(「成約金額」の列に金額を入れると集計されます)
    var iAmt = h.indexOf("成約金額");
    var amounts = iAmt === -1 ? [] : body.map(function (r) { return Number(String(r[iAmt]).replace(/[^\d.]/g, "")) || 0; }).filter(function (v) { return v > 0; });
    var sales = amounts.reduce(function (x, y) { return x + y; }, 0);
    rows.push(["成約金額の合計", sales, amounts.length ? "金額の入力あり:" + amounts.length + "件" : "「成約金額」の列に入力すると集計されます"]);
    rows.push(["成約1件あたりの平均", amounts.length ? Math.round(sales / amounts.length) : "-", ""]);

    // 連絡までにかかった日数(受信日時 → 対応日)
    var iDate = h.indexOf("受信日時"), iDone = h.indexOf("対応日");
    var days = iDone === -1 ? [] : body.filter(function (r) { return r[iDone] instanceof Date && r[iDate] instanceof Date; })
      .map(function (r) { return (r[iDone].getTime() - r[iDate].getTime()) / 86400000; });
    rows.push(["対応までの平均日数", days.length ? Math.round((days.reduce(function (x, y) { return x + y; }, 0) / days.length) * 10) / 10 + "日" : "-", ""]);
    rows.push(["", "", ""]);

    // 担当者ごとの件数と成約数
    var iStaff = h.indexOf("担当者");
    if (iStaff !== -1) {
      var staff = {};
      body.forEach(function (r) {
        var name = String(r[iStaff] || "").trim();
        if (!name) return;
        staff[name] = staff[name] || { n: 0, won: 0 };
        staff[name].n += 1;
        if (String(r[iSt]) === "成約") staff[name].won += 1;
      });
      var names = Object.keys(staff);
      if (names.length) {
        rows.push(["【担当者】", "件数", "成約数"]);
        names.forEach(function (name) { rows.push(["  " + safe_(name), staff[name].n, staff[name].won]); });
        rows.push(["", "", ""]);
      }
    }

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

  // 途中でやめた方(離脱ログ)
  var drop = ss.getSheetByName(DROPOFF_SHEET);
  if (drop && drop.getLastRow() >= 2) {
    var dd = drop.getDataRange().getValues().slice(1);
    titleRows.push(rows.length + 1);
    rows.push(["■ 途中でやめた方(入力を始めたが、送信しなかった方)", "", ""]);
    FORM_SHEETS.forEach(function (name) {
      var list = dd.filter(function (r) { return String(r[1]) === name; });
      if (!list.length) return;
      var sheet = ss.getSheetByName(name);
      var sent = sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0;
      rows.push(["【" + name + "】", "件数", "割合"]);
      rows.push(["  送信まで完了した割合(目安)", sent + " / " + (sent + list.length), Math.round((sent / (sent + list.length)) * 1000) / 10 + "%"]);
      var by = {};
      list.forEach(function (r) { by[String(r[3])] = (by[String(r[3])] || 0) + 1; });
      Object.keys(by).sort(function (x, y) { return by[y] - by[x]; }).forEach(function (k) {
        rows.push(["  やめたステップ:" + k, by[k], Math.round((by[k] / list.length) * 1000) / 10 + "%"]);
      });
      rows.push(["", "", ""]);
    });
  }

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
  if (ESTIMATE_SHEETS.indexOf(sheet.getName()) === -1 || rowNo < 2) {
    alert_("「パソコン」「スマートフォン」「タブレット」のいずれかのシートで、見積もりを作りたいお客様の行を選んでから実行してください。");
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
  if (["古いパソコンからのデータ移行", "古いスマホからのデータ移行", "古いタブレットからのデータ移行"].some(function (l) { return get(l) === "お願いしたい"; })) {
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
    ["ご予算", safe_(get("想定ご予算(税込)") || get("想定ご予算(端末代・税込)") || get("想定ご予算(本体・税込)")), "", "", ""],
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
    if (["remindPending", "updateSummary", "purgeOld"].indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("remindPending").timeBased().everyDays(1).atHour(9).inTimezone("Asia/Tokyo").create();
  ScriptApp.newTrigger("updateSummary").timeBased().everyDays(1).atHour(7).inTimezone("Asia/Tokyo").create();
  ScriptApp.newTrigger("purgeOld").timeBased().everyDays(1).atHour(6).inTimezone("Asia/Tokyo").create();

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
  alert_(
    "初期設定が完了しました。毎朝、未対応のお知らせと集計の更新が自動で行われます。" +
      (RETENTION_MONTHS > 0 ? "\n受信から" + RETENTION_MONTHS + "か月を過ぎた回答と写真は、自動で削除されます。" : "")
  );
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
