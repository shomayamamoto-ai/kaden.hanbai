// =====================================================
// 「現在お使いの機種」でメーカーを選んだときに出る追加質問
// =====================================================
// 例:「iPhone」を選ぶと「機種」と「容量」を聞きます。
// 新しい機種が出たら、各リストの先頭に追加してください。
// (2026年11月時点のラインナップで作成しています)
//
// 書き方は accessories.js と同じです。
//   one("質問", [選択肢])         … 1つだけ選ぶ質問
//   one("質問", [選択肢], true)   … 最後に「その他( )」の記入欄を付ける

(function () {
  const one = (label, options, other) => ({ label, type: "radio", options, other: Boolean(other) });
  const UNKNOWN = "わからない";

  // スマホの保存容量(下取り査定や、次の機種の容量選びに使う)
  const PHONE_STORAGE = one("容量", ["64GB以下", "128GB", "256GB", "512GB以上", UNKNOWN]);

  // ---------- スマートフォン ----------
  const phone = {
    "iPhone": [
      one(
        "機種",
        [
          "iPhone 18 Pro / 18 Pro Max(2026年)",
          "iPhone 17e(2026年)",
          "iPhone 17 / 17 Pro / 17 Pro Max(2025年)",
          "iPhone Air(2025年)",
          "iPhone 16e(2025年)",
          "iPhone 16シリーズ(2024年)",
          "iPhone 15シリーズ(2023年)",
          "iPhone 14シリーズ(2022年)",
          "iPhone 13シリーズ・13 mini(2021年)",
          "iPhone 12シリーズ・12 mini(2020年)",
          "iPhone SE(第2世代・第3世代)",
          "iPhone 11シリーズ以前",
          UNKNOWN,
        ],
        true
      ),
      PHONE_STORAGE,
    ],
    "Galaxy": [
      one(
        "機種",
        [
          "Galaxy S26シリーズ(2026年)",
          "Galaxy S25シリーズ(2025年)",
          "Galaxy S24シリーズ(2024年)",
          "Galaxy S23シリーズ以前",
          "Galaxy Z Fold / Z Flip(折りたたみ)",
          "Galaxy Aシリーズ",
          UNKNOWN,
        ],
        true
      ),
      PHONE_STORAGE,
    ],
    "AQUOS": [
      one("機種", ["AQUOS R シリーズ", "AQUOS sense シリーズ", "AQUOS wish シリーズ", "AQUOS zero シリーズ", UNKNOWN], true),
      PHONE_STORAGE,
    ],
    "Xperia": [
      one("機種", ["Xperia 1 シリーズ", "Xperia 5 シリーズ", "Xperia 10 シリーズ", "Xperia Ace シリーズ", UNKNOWN], true),
      PHONE_STORAGE,
    ],
    "Google Pixel": [
      one(
        "機種",
        [
          "Pixel 11シリーズ(2026年)",
          "Pixel 10a(2026年)",
          "Pixel 10シリーズ(2025年)",
          "Pixel 9シリーズ・9a(2024〜2025年)",
          "Pixel 8シリーズ・8a(2023〜2024年)",
          "Pixel 7シリーズ以前",
          UNKNOWN,
        ],
        true
      ),
      PHONE_STORAGE,
    ],
    "arrows": [
      one("機種", ["arrows We シリーズ", "arrows N", "arrows Alpha", "その他のarrows", UNKNOWN], true),
      PHONE_STORAGE,
    ],
    "OPPO・Xiaomi": [
      one(
        "機種",
        ["OPPO Reno シリーズ", "OPPO A シリーズ", "OPPO Find シリーズ", "Xiaomi シリーズ", "Redmi シリーズ", "POCO シリーズ", UNKNOWN],
        true
      ),
      PHONE_STORAGE,
    ],
    "らくらくスマートフォン": [
      one("機種", ["らくらくスマートフォン", "らくらくスマートフォン Lite", "BASIO(ベイシオ)", "かんたんスマホ", UNKNOWN], true),
    ],
    "ガラケー(携帯電話)": [
      one("種類", ["折りたたみ型", "ストレート型", UNKNOWN]),
    ],
  };

  // ---------- パソコン ----------
  // メーカーごとの型番は種類が多すぎるため、「本体の形」を共通で聞き、
  // Mac と Surface だけ製品名を聞きます。
  const FORM = one("本体の形", ["ノートパソコン", "デスクトップ(画面と一体型)", "デスクトップ(本体と画面が別)", UNKNOWN]);
  const pc = {
    "NEC": [FORM],
    "富士通": [FORM],
    "dynabook(東芝)": [FORM],
    "Panasonic": [FORM],
    "Lenovo": [FORM],
    "HP": [FORM],
    "Dell": [FORM],
    "ASUS": [FORM],
    "Apple(Mac)": [
      one("種類", ["MacBook Air", "MacBook Pro", "iMac", "Mac mini", "Mac Studio・Mac Pro", UNKNOWN], true),
      Object.assign(
        one("チップ", [
          "M6(2026年〜)",
          "M5(2025〜2026年)",
          "M4(2024〜2025年)",
          "M3(2023〜2024年)",
          "M2(2022〜2023年)",
          "M1(2020〜2021年)",
          "Intel(2020年ごろまでのモデル)",
          UNKNOWN,
        ]),
        { note: "Pro・Max・Ultra も同じ番号を選んでください。画面左上のアップルマーク →「このMacについて」で確認できます" }
      ),
    ],
    "Microsoft(Surface)": [
      one("種類", ["Surface Pro", "Surface Laptop", "Surface Go", "Surface Book・Studio", UNKNOWN], true),
    ],
  };

  // ---------- タブレット ----------
  // 毎年新しい世代が出るため、機種は「シリーズ」で聞き、古さは「使用年数」の質問で確認します。
  const TABLET_STORAGE = one("容量", ["64GB以下", "128GB", "256GB", "512GB以上", UNKNOWN]);
  const tablet = {
    "iPad": [
      one("種類", ["iPad Pro", "iPad Air", "iPad(無印)", "iPad mini", UNKNOWN], true),
      one("通信", ["Wi-Fiモデル(家などのWi-Fiで使う)", "セルラーモデル(SIMを入れて外でも使える)", UNKNOWN]),
      TABLET_STORAGE,
    ],
    "Galaxy Tab": [one("種類", ["Galaxy Tab S シリーズ", "Galaxy Tab A シリーズ", UNKNOWN], true), TABLET_STORAGE],
    "Fire タブレット(Amazon)": [one("種類", ["Fire 7", "Fire HD 8", "Fire HD 10", "Fire Max 11", "Fire キッズモデル", UNKNOWN], true)],
    "Lenovo": [one("種類", ["Lenovo Tab シリーズ", "Lenovo Tab P シリーズ(上位モデル)", "Yoga Tab シリーズ", UNKNOWN], true), TABLET_STORAGE],
    "NEC(LAVIE Tab)": [one("種類", ["LAVIE Tab T シリーズ", "LAVIE Tab E シリーズ", UNKNOWN], true), TABLET_STORAGE],
    "Xiaomi・Redmi": [one("種類", ["Xiaomi Pad シリーズ", "Redmi Pad シリーズ", UNKNOWN], true), TABLET_STORAGE],
    "Microsoft(Surface)": [one("種類", ["Surface Pro", "Surface Go", UNKNOWN], true)],
  };

  window.MODEL_FOLLOWUPS = { pc, phone, tablet };
})();
