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
//   budget    … 予算(〜万円 〜 〜万円)
//   date      … 日付
// other: true にすると「その他(  )」の入力欄が付きます。

(function () {
  // PC・スマホで共通の「お客様情報」
  const contactSection = {
    title: "お客様情報",
    fields: [
      { id: "name", label: "お名前", type: "text", required: true, placeholder: "例:山田 太郎" },
      { id: "company", label: "会社名・部署名・役職", type: "text", placeholder: "個人のお客様は空欄で構いません" },
      { id: "email", label: "メールアドレス", type: "email", required: true, placeholder: "例:taro@example.com" },
      { id: "tel", label: "電話番号", type: "tel", placeholder: "例:090-1234-5678" },
      {
        id: "contact_method",
        label: "ご希望の連絡方法",
        type: "radio",
        options: ["メール", "電話", "どちらでもよい"],
      },
    ],
  };

  const pc = {
    key: "pc",
    name: "パソコン",
    title: "パソコン買い替えヒアリングシート",
    sections: [
      contactSection,
      {
        title: "現在の利用状況と買い替え理由",
        fields: [
          { id: "current_model", label: "現在使用中のパソコンのメーカー・型番", type: "text", placeholder: "例:NEC LAVIE N15 / わからない" },
          { id: "current_spec", label: "メモリ、ストレージ", type: "text", placeholder: "例:メモリ8GB / SSD 256GB / わからない" },
          { id: "years_used", label: "使用年数", type: "radio", options: ["1年未満", "1〜3年", "3〜5年", "5年以上", "わからない"] },
          {
            id: "reason",
            label: "買い替えの理由",
            note: "複数選択可",
            type: "checkbox",
            options: [
              "故障した・調子が悪い",
              "動作が遅い・フリーズする",
              "バッテリーがもたない",
              "OSのサポート終了",
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
              "メール・Web閲覧",
              "一般的な事務作業(Word、Excel、PowerPointなど)",
              "大量データの処理(マクロを組んだ重いExcelなど)",
              "クリエイティブ作業(Illustrator、Photoshopなど)",
              "動画編集・3Dモデリング・CAD",
              "プログラミング",
              "Web会議(Zoom、Teamsなど)",
            ],
            other: true,
          },
          { id: "software", label: "よく使用するソフトウェア・アプリ", type: "textarea", rows: 2 },
          { id: "office", label: "Microsoft Office の要否", type: "radio", options: ["必要", "不要(手持ちのものを使う)", "わからない"] },
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
              "WEBカメラ・マイク内蔵",
              "テンキー(数字入力キーボード)",
              "有線LANポート",
              "HDMI端子(外部モニター接続用)",
              "光学ドライブ(CD/DVD/Blu-ray)",
            ],
            other: true,
          },
          { id: "data_transfer", label: "古いパソコンからのデータ移行", type: "radio", options: ["お願いしたい", "自分で行う", "不要"] },
        ],
      },
      {
        title: "予算と納期",
        fields: [
          { id: "quantity", label: "購入台数", type: "text", placeholder: "例:1台" },
          { id: "budget", label: "想定ご予算(税込)", type: "budget" },
          { id: "deadline", label: "希望納期", type: "date", allowNoRush: true },
        ],
      },
      {
        title: "その他・特記事項",
        fields: [
          {
            id: "notes",
            label: "ご要望",
            description:
              "特定のメーカーの希望や、デザインの色、マウスやモニターなどの周辺機器も一緒に買いたい等のご要望があれば、ご自由にお書きください。",
            type: "textarea",
            rows: 5,
          },
        ],
      },
    ],
  };

  const phone = {
    key: "phone",
    name: "スマートフォン",
    title: "スマートフォン買い替えヒアリングシート",
    sections: [
      contactSection,
      {
        title: "現在の利用状況と買い替え理由",
        fields: [
          { id: "current_model", label: "現在使用中のスマホの機種名", type: "text", placeholder: "例:iPhone 12 / Galaxy S21 / わからない" },
          {
            id: "current_carrier",
            label: "現在の契約会社",
            type: "radio",
            options: ["ドコモ", "au", "ソフトバンク", "楽天モバイル", "格安SIM(ahamo・povo・LINEMO・UQ・ワイモバイルなど)", "わからない"],
            other: true,
          },
          { id: "years_used", label: "使用年数", type: "radio", options: ["1年未満", "1〜2年", "2〜4年", "4年以上", "わからない"] },
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
              "電話・メール・LINE",
              "SNS(Instagram、X、TikTokなど)",
              "写真・動画の撮影",
              "動画視聴(YouTube、Netflixなど)",
              "ゲーム",
              "キャッシュレス決済・ポイントカード",
              "仕事(メール、Teams、Slackなど)",
              "地図・ナビ",
            ],
            other: true,
          },
          { id: "apps", label: "よく使用するアプリ", type: "textarea", rows: 2 },
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
              "おサイフケータイ(FeliCa)",
              "防水・防じん",
              "高性能カメラ",
              "指紋認証",
              "顔認証",
              "イヤホンジャック",
              "microSDカード",
              "デュアルSIM・eSIM",
            ],
            other: true,
          },
          { id: "color", label: "希望の色", type: "text", placeholder: "例:黒・白系 / こだわりなし" },
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
          { id: "data_transfer", label: "古いスマホからのデータ移行", type: "radio", options: ["お願いしたい", "自分で行う", "不要"] },
          { id: "quantity", label: "購入台数", type: "text", placeholder: "例:1台" },
          { id: "budget", label: "想定ご予算(端末代・税込)", type: "budget" },
          { id: "deadline", label: "希望納期", type: "date", allowNoRush: true },
        ],
      },
      {
        title: "その他・特記事項",
        fields: [
          {
            id: "notes",
            label: "ご要望",
            description:
              "ケース・保護フィルム・充電器などのアクセサリーも一緒に買いたい、家族の分もまとめて相談したい等のご要望があれば、ご自由にお書きください。",
            type: "textarea",
            rows: 5,
          },
        ],
      },
    ],
  };

  window.HEARING_FORMS = { pc, phone };
})();
