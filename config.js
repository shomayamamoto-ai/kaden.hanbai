// =====================================================
// 送信先・お店の情報の設定
// =====================================================
// Google Apps Script を「ウェブアプリ」として公開したときに
// 表示される URL(https://script.google.com/macros/s/.../exec)を
// GAS_URL の "" の中に貼り付けてください。
// 手順は docs/SETUP.md を参照してください。
window.HEARING_CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbw40t7II-ZFAFSuYyEwSudzW_U6wa_h1rWWYuPJz_rRvyLrq7FdUj7_YW9Fl7CKZYwXzQ/exec",

  // フォーム上部・完了画面に表示する店舗名(空欄なら非表示)
  SHOP_NAME: "",

  // お店のロゴ画像(空欄なら非表示)
  // 画像ファイルをこのフォルダに置いて "logo.png" のように書くか、画像のURLを書きます。
  LOGO_URL: "",

  // お店の色(ボタンや見出しの色)。空欄なら標準の青になります。
  // "#e2001a" のような、# で始まる6けたのカラーコードで指定します。
  // 薄すぎる色は、文字が読めるように自動で少し濃くします。
  BRAND_COLOR: "",

  // 完了画面に表示する「ご連絡までの目安」
  // ※ gas/Code.gs の REPLY_TIME と同じ内容にしてください
  REPLY_TIME: "2営業日以内",

  // 完了画面に表示するお店の連絡先(空欄の項目は表示されません)
  SHOP_TEL: "",
  SHOP_HOURS: "", // 例:"10:00〜19:00(水曜定休)"

  // 受付完了メールをお客様に送る設定にしているか
  // ※ gas/Code.gs の SEND_CUSTOMER_COPY と同じにしてください
  CUSTOMER_MAIL: true,

  // いたずら送信対策(Cloudflare Turnstile)のサイトキー。
  // 使う場合だけ設定します(手順は docs/SETUP.md)。空欄なら使いません。
  TURNSTILE_SITE_KEY: "",
};
