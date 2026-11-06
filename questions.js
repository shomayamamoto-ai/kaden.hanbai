// =====================================================
// ヒアリング項目の定義
// =====================================================
// 質問を追加・変更したいときは、このファイルだけを編集します。
// type の種類:
//   text      … 1行の入力欄
//   textarea  … 複数行の入力欄
//   email/tel … メール・電話番号の入力欄
//   radio     … 1つだけ選ぶ
//   checkbox  … 複数選べる
// other: true にすると「その他(  )」の入力欄が付きます。
// 入力の手間を減らすため、できるだけ radio / checkbox で作っています。

(function () {
  const FOLLOWUPS = window.ACCESSORY_FOLLOWUPS;

  // ---------- 共通の選択肢 ----------
  const QUANTITY = ["1台", "2台", "3台以上"];
  const DEADLINE = ["できるだけ早く", "1週間以内", "1か月以内", "2〜3か月以内", "急ぎではない"];
  const YEARS = ["1年未満", "1〜3年", "3〜5年", "5年以上", "わからない"];
  const TRANSFER = ["お願いしたい", "自分で行う", "不要", "わからない・相談したい"];
  const SKILL = ["得意・詳しい", "ふつうに使える", "苦手・不安がある"];

  // PC・スマホで共通の「お客様情報」
  const contactSection = {
    title: "お客様情報",
    fields: [
      { id: "name", label: "お名前", type: "text", required: true, placeholder: "例:山田 太郎" },
      { id: "email", label: "メールアドレス", type: "email", required: true, placeholder: "例:taro@example.com" },
      {
        id: "tel",
        label: "電話番号",
        type: "tel",
        placeholder: "例:090-1234-5678",
        requiredWhen: {
          field: "contact_method",
          value: "電話",
          badge: "(電話でのご連絡を希望する場合は必須)",
          message: "電話でのご連絡を希望される場合は、電話番号をご入力ください。",
        },
      },
      { id: "contact_method", label: "ご希望の連絡方法", type: "radio", options: ["メール", "電話", "どちらでもよい"] },
      {
        id: "contact_time",
        label: "連絡しやすい時間帯",
        note: "複数選択可",
        type: "checkbox",
        options: ["平日の昼", "平日の夕方以降", "土日・祝日", "いつでもよい"],
      },
    ],
  };

  // ======================= パソコン =======================
  const pc = {
    key: "pc",
    name: "パソコン",
    title: "パソコン買い替えヒアリングシート",
    sections: [
      contactSection,
      {
        title: "使う方について",
        fields: [
          {
            id: "user",
            label: "主に使う方",
            type: "radio",
            options: ["ご本人", "ご家族(お子さま・学生)", "ご家族(ご高齢の方)", "家族みんなで共用"],
            other: true,
          },
          { id: "age", label: "使う方のご年代", type: "radio", options: ["10代", "20〜30代", "40〜50代", "60〜70代", "80代以上", "答えたくない"] },
          { id: "skill", label: "パソコンの操作", type: "radio", options: SKILL },
        ],
      },
      {
        title: "現在の利用状況と買い替え理由",
        fields: [
          {
            id: "current_maker",
            label: "現在お使いのパソコンのメーカー",
            type: "radio",
            options: ["NEC", "富士通", "dynabook(東芝)", "Panasonic", "Lenovo", "HP", "Dell", "ASUS", "Apple(Mac)", "Microsoft(Surface)", "わからない", "持っていない"],
            other: true,
          },
          { id: "years_used", label: "使用年数", type: "radio", options: YEARS },
          {
            id: "reason",
            label: "買い替えの理由",
            note: "複数選択可",
            type: "checkbox",
            options: [
              "故障した・調子が悪い",
              "動作が遅い・フリーズする",
              "バッテリーがもたない",
              "Windows 10 などOSのサポート終了",
              "画面が小さい・見づらい",
              "重くて持ち運びにくい",
              "新しい用途(動画編集など)に使いたい",
            ],
            other: true,
          },
        ],
      },
      {
        title: "新しいパソコンの希望タイプ・用途",
        fields: [
          {
            id: "pc_type",
            label: "希望のタイプ",
            type: "radio",
            options: [
              "ノートパソコン(持ち運び重視)",
              "ノートパソコン(画面の大きさ・据え置き重視)",
              "デスクトップパソコン",
              "わからない・相談して決めたい",
            ],
          },
          { id: "os", label: "希望のOS", type: "radio", options: ["Windows", "Mac", "こだわりなし"] },
          {
            id: "usage",
            label: "主な用途",
            note: "複数選択可",
            type: "checkbox",
            options: [
              "インターネット・メール",
              "YouTube・動画配信サービスの視聴",
              "写真の整理・年賀状作り",
              "Word・Excel(書類・家計簿など)",
              "オンライン授業・在宅勤務",
              "ビデオ通話(Zoom・Teamsなど)",
              "ネットショッピング・ネットバンキング",
              "ゲーム",
              "動画・写真の編集",
              "プログラミング",
            ],
            other: true,
          },
          {
            id: "office",
            label: "Word・Excel などのOfficeソフト",
            type: "radio",
            options: ["付いているものが欲しい", "不要(持っている・使わない)", "わからない・相談したい"],
          },
        ],
      },
      {
        title: "スペック・機能の希望",
        note: "わかる場合のみ",
        fields: [
          {
            id: "screen",
            label: "画面サイズ",
            note: "ノートPCの場合",
            type: "radio",
            options: [
              "13インチ以下(小型・軽量)",
              "14インチ(標準的・バランス型)",
              "15インチ以上(画面が大きく見やすい)",
              "わからない",
            ],
          },
          {
            id: "features",
            label: "絶対に必要な機能・端子",
            note: "複数選択可",
            type: "checkbox",
            options: [
              "カメラ・マイク内蔵",
              "テンキー(数字入力キー)",
              "DVD・CDドライブ",
              "SDカードの差し込み口",
              "HDMI端子(テレビ・モニター接続)",
              "有線LANポート",
              "指紋・顔認証でログイン",
              "特になし・わからない",
            ],
            other: true,
          },
          { id: "color", label: "希望の色", type: "radio", options: ["黒系", "白系", "シルバー・グレー", "その他の色", "こだわりなし"] },
          { id: "data_transfer", label: "古いパソコンからのデータ移行", type: "radio", options: TRANSFER },
          {
            id: "support",
            label: "あると助かるサポート",
            note: "複数選択可",
            type: "checkbox",
            options: ["初期設定", "メール・インターネットの設定", "プリンターの接続", "ウイルス対策ソフトの導入", "使い方の説明", "古いパソコンの処分", "長期保証"],
          },
        ],
      },
      {
        title: "予算と納期",
        fields: [
          { id: "quantity", label: "購入台数", type: "radio", options: QUANTITY },
          {
            id: "budget",
            label: "想定ご予算(税込)",
            type: "radio",
            options: ["5万円未満", "5〜10万円", "10〜15万円", "15〜20万円", "20万円以上", "わからない・相談したい"],
          },
          { id: "deadline", label: "希望納期", type: "radio", options: DEADLINE },
        ],
      },
      {
        title: "その他・特記事項",
        fields: [
          {
            id: "accessories",
            label: "一緒に購入したいもの",
            note: "複数選択可",
            type: "checkbox",
            description: "選んだ商品について、すぐ下に追加の質問が表示されます(わかる範囲でお答えください)。",
            // 商品の一覧と追加質問は accessories.js で管理しています
            options: Object.keys(FOLLOWUPS.pc),
            followUps: FOLLOWUPS.pc,
            other: true,
          },
          {
            id: "notes",
            label: "その他のご要望",
            note: "任意",
            description: "特定のメーカーの希望など、選択肢にないご要望があればご自由にお書きください。",
            type: "textarea",
            rows: 3,
          },
        ],
      },
    ],
  };

  // ======================= スマートフォン =======================
  const phone = {
    key: "phone",
    name: "スマートフォン",
    title: "スマートフォン買い替えヒアリングシート",
    sections: [
      contactSection,
      {
        title: "使う方について",
        fields: [
          {
            id: "user",
            label: "主に使う方",
            type: "radio",
            options: ["ご本人", "ご家族(お子さま)", "ご家族(ご高齢の方)"],
            other: true,
          },
          { id: "age", label: "使う方のご年代", type: "radio", options: ["10歳未満", "10代", "20〜30代", "40〜50代", "60〜70代", "80代以上", "答えたくない"] },
          { id: "skill", label: "スマホの操作", type: "radio", options: SKILL },
        ],
      },
      {
        title: "現在の利用状況と買い替え理由",
        fields: [
          {
            id: "current_maker",
            label: "現在お使いの機種",
            type: "radio",
            options: ["iPhone", "Galaxy", "AQUOS", "Xperia", "Google Pixel", "arrows", "OPPO・Xiaomi", "らくらくスマートフォン", "ガラケー(携帯電話)", "わからない", "持っていない"],
            other: true,
          },
          {
            id: "current_carrier",
            label: "現在の契約会社",
            type: "radio",
            options: ["ドコモ", "au", "ソフトバンク", "楽天モバイル", "ahamo・povo・LINEMO", "UQモバイル・ワイモバイル", "その他の格安SIM", "わからない"],
          },
          { id: "years_used", label: "使用年数", type: "radio", options: YEARS },
          {
            id: "reason",
            label: "買い替えの理由",
            note: "複数選択可",
            type: "checkbox",
            options: [
              "故障した・画面が割れた",
              "バッテリーがもたない",
              "動作が遅い・固まる",
              "容量(保存できる量)が足りない",
              "OS・アプリのサポート終了",
              "カメラの性能を上げたい",
              "料金プランを見直したい",
              "ガラケーから乗り換えたい",
            ],
            other: true,
          },
        ],
      },
      {
        title: "新しいスマホの希望・用途",
        fields: [
          { id: "os", label: "希望の機種", type: "radio", options: ["iPhone", "Android", "こだわりなし・相談して決めたい"] },
          {
            id: "usage",
            label: "主な用途",
            note: "複数選択可",
            type: "checkbox",
            options: [
              "電話・メール",
              "LINE",
              "SNS(Instagram・X・TikTokなど)",
              "写真・動画の撮影",
              "動画視聴(YouTube・Netflixなど)",
              "ゲーム",
              "キャッシュレス決済(PayPay・Suicaなど)",
              "ネットショッピング",
              "地図・乗換案内",
              "仕事(メール・Teamsなど)",
            ],
            other: true,
          },
        ],
      },
      {
        title: "スペック・機能の希望",
        note: "わかる場合のみ",
        fields: [
          {
            id: "size",
            label: "本体の大きさ",
            type: "radio",
            options: ["小さめ(片手で操作しやすい)", "標準", "大きめ(画面が見やすい)", "わからない"],
          },
          {
            id: "storage",
            label: "保存容量(ストレージ)",
            type: "radio",
            options: ["128GB(標準的)", "256GB(写真・動画が多い)", "512GB以上(とても多い)", "わからない"],
          },
          {
            id: "features",
            label: "絶対に必要な機能",
            note: "複数選択可",
            type: "checkbox",
            options: [
              "おサイフケータイ(Suica・iDなど)",
              "防水・防じん",
              "高性能カメラ",
              "バッテリー長持ち",
              "指紋認証",
              "顔認証",
              "イヤホンジャック",
              "microSDカード",
              "文字が大きく見やすい",
              "特になし・わからない",
            ],
            other: true,
          },
          { id: "color", label: "希望の色", type: "radio", options: ["黒系", "白系", "シルバー・グレー", "青系", "ピンク・赤系", "その他の色", "こだわりなし"] },
        ],
      },
      {
        title: "契約・予算と納期",
        fields: [
          {
            id: "carrier",
            label: "購入後の契約先",
            type: "radio",
            options: ["今の会社のまま", "乗り換えたい(相談したい)", "端末のみ購入(SIMフリー)", "わからない"],
          },
          { id: "payment", label: "お支払い方法", type: "radio", options: ["一括払い", "分割払い", "相談したい"] },
          { id: "data_transfer", label: "古いスマホからのデータ移行", type: "radio", options: TRANSFER },
          {
            id: "support",
            label: "あると助かるサポート",
            note: "複数選択可",
            type: "checkbox",
            options: ["初期設定", "LINEの引き継ぎ", "電話帳・写真の移行", "アプリの設定", "使い方の説明", "フィルタリング(お子さま向け)", "補償サービス"],
          },
          { id: "quantity", label: "購入台数", type: "radio", options: QUANTITY },
          {
            id: "budget",
            label: "想定ご予算(端末代・税込)",
            type: "radio",
            options: ["3万円未満", "3〜6万円", "6〜10万円", "10〜15万円", "15万円以上", "わからない・相談したい"],
          },
          { id: "deadline", label: "希望納期", type: "radio", options: DEADLINE },
        ],
      },
      {
        title: "その他・特記事項",
        fields: [
          {
            id: "accessories",
            label: "一緒に購入したいもの",
            note: "複数選択可",
            type: "checkbox",
            description: "選んだ商品について、すぐ下に追加の質問が表示されます(わかる範囲でお答えください)。",
            // 商品の一覧と追加質問は accessories.js で管理しています
            options: Object.keys(FOLLOWUPS.phone),
            followUps: FOLLOWUPS.phone,
            other: true,
          },
          {
            id: "notes",
            label: "その他のご要望",
            note: "任意",
            description: "家族の分もまとめて相談したいなど、選択肢にないご要望があればご自由にお書きください。",
            type: "textarea",
            rows: 3,
          },
        ],
      },
    ],
  };

  // =====================================================
  // 必須にする項目
  // =====================================================
  // ご提案・ご連絡に欠かせない項目だけを必須にしています。
  // 必須の選択項目には「わからない」「相談したい」などの選択肢があるので、
  // 詳しくないお客様でも答えられます。
  // ここに id を足す・消すだけで、必須かどうかを切り替えられます。
  const REQUIRED = {
    pc: [
      "name", "email", "contact_method",      // 連絡に必要
      "user", "age",                          // 誰向けの提案か
      "current_maker", "reason",              // 今の状況と、何を解決したいか
      "pc_type", "os", "usage", "office",     // 機種選びの決め手
      "data_transfer",                        // 当日の作業量・費用に関わる
      "quantity", "budget", "deadline",       // 見積もりと在庫手配に必要
    ],
    phone: [
      "name", "email", "contact_method",
      "user", "age",
      "current_maker", "current_carrier", "reason",
      "os", "usage",
      "carrier", "payment", "data_transfer",  // 契約手続きと費用に関わる
      "quantity", "budget", "deadline",
    ],
  };

  [pc, phone].forEach((form) => {
    form.sections.forEach((section) =>
      section.fields.forEach((field) => {
        field.required = REQUIRED[form.key].includes(field.id);
      })
    );
  });

  window.HEARING_FORMS = { pc, phone };
})();
