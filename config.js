// =====================================================
// 送信先・お店の情報の設定
// =====================================================
// Google Apps Script を「ウェブアプリ」として公開したときに
// 表示される URL(https://script.google.com/macros/s/.../exec)を
// GAS_URL の "" の中に貼り付けてください。
// 手順は docs/SETUP.md を参照してください。
window.HEARING_CONFIG = {
  GAS_URL: "",

  // フォーム上部・完了画面に表示する店舗名(空欄なら非表示)
  SHOP_NAME: "",

  // 完了画面に表示する「ご連絡までの目安」
  // ※ gas/Code.gs の REPLY_TIME と同じ内容にしてください
  REPLY_TIME: "2営業日以内",

  // 完了画面に表示するお店の連絡先(空欄の項目は表示されません)
  SHOP_TEL: "",
  SHOP_HOURS: "", // 例:"10:00〜19:00(水曜定休)"

  // 受付完了メールをお客様に送る設定にしているか
  // ※ gas/Code.gs の SEND_CUSTOMER_COPY と同じにしてください
  CUSTOMER_MAIL: true,
};
