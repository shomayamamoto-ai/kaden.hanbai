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
//   photo     … 写真の添付
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
        note: "必須以外はわかる場合のみ",
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

  // ======================= 携帯料金見直し =======================
  // 機種のヒアリングを送ったあとに「携帯料金・Wi-Fiの見直しもいかがですか?」と案内するシート
  const CARRIERS = ["ドコモ", "au", "ソフトバンク", "楽天モバイル", "ahamo・povo・LINEMO", "UQモバイル・ワイモバイル", "その他の格安SIM", "わからない"];
  const plan = {
    key: "plan",
    name: "携帯料金見直し",
    title: "携帯料金見直しヒアリングシート",
    leadIntro: "あなたに合った料金プランやWi-Fiをご提案するため、",
    proposal: "ご利用状況に合ったプランをご提案します",
    hideSwitcher: true,
    sections: [
      contactSection,
      {
        title: "現在の契約状況",
        fields: [
          { id: "current_carrier", label: "現在の携帯会社", type: "radio", options: CARRIERS, other: true },
          { id: "plan_name", label: "契約プラン名", note: "わかれば", type: "text", placeholder: "例:eximo、使い放題MAX など" },
          { id: "contract_years", label: "契約年数(いつから使っているか)", type: "radio", options: ["1年未満", "1〜3年", "3〜5年", "5〜10年", "10年以上", "わからない"] },
          { id: "holder", label: "契約の名義人", type: "radio", options: ["ご本人", "ご家族(親・配偶者など)", "会社(法人名義)", "わからない"], other: true },
          { id: "family_count", label: "家族で同じ会社を使っている人数", type: "radio", options: ["自分だけ", "2人", "3人", "4人", "5人以上", "わからない"] },
          {
            id: "family_members",
            label: "一緒に見直したいご家族",
            note: "複数選択可",
            type: "checkbox",
            options: ["配偶者・パートナー", "お子さま(小学生以下)", "お子さま(中学生〜大学生)", "ご両親・ご高齢の方", "自分だけでよい"],
          },
          {
            id: "carrier_mail",
            label: "携帯会社のメールアドレス(@docomo.ne.jp など)",
            type: "radio",
            options: ["使っていて、今後も必要", "使っているが、なくてもよい", "使っていない", "わからない"],
          },
          {
            id: "device_plan",
            label: "今のスマホ",
            type: "radio",
            options: ["そのまま使い続けたい", "機種変更も一緒に考えたい", "わからない・相談したい"],
          },
        ],
      },
      {
        title: "毎月の支払い",
        fields: [
          {
            id: "monthly_fee",
            label: "毎月の携帯料金(1人あたり)",
            type: "radio",
            options: ["2,000円未満", "2,000〜5,000円", "5,000〜8,000円", "8,000〜1万円", "1万〜1万5,000円", "1万5,000円以上", "わからない"],
          },
          {
            id: "family_total",
            label: "家族全体の合計金額",
            type: "radio",
            options: ["1万円未満", "1万〜2万円", "2万〜3万円", "3万〜4万円", "4万円以上", "わからない"],
          },
          { id: "installment", label: "端末代の分割払いは残っていますか?", type: "radio", options: ["はい", "いいえ", "わからない"] },
          {
            id: "installment_left",
            label: "分割払いの残りの金額",
            type: "radio",
            options: ["1万円未満", "1万〜3万円", "3万〜5万円", "5万〜10万円", "10万円以上", "わからない"],
          },
          {
            id: "installment_times",
            label: "分割払いの残りの回数",
            type: "radio",
            options: ["6回以下", "7〜12回", "13〜24回", "25回以上", "わからない"],
          },
          {
            id: "options",
            label: "加入しているオプション",
            note: "複数選択可・わかる範囲で",
            type: "checkbox",
            options: [
              "かけ放題(5分・10分など)",
              "かけ放題(時間無制限)",
              "端末の補償サービス",
              "動画・音楽のサブスク(Netflix・Spotifyなど)",
              "留守番電話",
              "セキュリティ・迷惑電話対策",
              "クラウド保存(写真のバックアップなど)",
              "特になし",
              "わからない",
            ],
            other: true,
          },
          {
            id: "bundle",
            label: "受けている割引",
            note: "複数選択可・わかる範囲で",
            type: "checkbox",
            options: ["家族割", "自宅のネット(光回線など)とのセット割", "電気・ガスとのセット割", "クレジットカード払いの割引", "特になし", "わからない"],
          },
          {
            id: "payment_card",
            label: "携帯料金の支払い方法",
            type: "radio",
            options: ["dカード", "au PAY カード", "PayPayカード", "楽天カード", "その他のクレジットカード", "口座振替", "わからない"],
          },
          {
            id: "photo",
            label: "請求書・料金明細の写真",
            note: "任意・3枚まで",
            type: "photo",
            description: "請求書や、料金明細の画面の写真があると、より正確にお調べできます。暗証番号などが写らないようご注意ください。",
          },
        ],
      },
      {
        title: "データ通信の使い方",
        fields: [
          {
            id: "data_usage",
            label: "毎月のデータ使用量",
            type: "radio",
            options: ["3GB未満", "3〜10GB", "10〜20GB", "20〜50GB", "50GB以上(使い放題が必要)", "わからない"],
          },
          {
            id: "home_wifi",
            label: "自宅にWi-Fiはありますか?",
            type: "radio",
            options: ["はい(光回線)", "はい(ホームルーター・置くだけWi-Fi)", "はい(ポケットWi-Fi)", "いいえ", "わからない"],
          },
          {
            id: "heavy_use",
            label: "よく使うもの",
            note: "複数選択可",
            type: "checkbox",
            options: ["動画(YouTube・Netflixなど)", "ゲーム", "SNS", "ビデオ通話・テレワーク", "音楽の聴き放題", "特になし・あまり使わない"],
          },
          {
            id: "throttle",
            label: "データが足りずに、速度制限になることはありますか?",
            type: "radio",
            options: ["毎月のようにある", "たまにある", "ない", "わからない"],
          },
        ],
      },
      {
        title: "通話の使い方",
        fields: [
          {
            id: "call_time",
            label: "1か月の通話時間(電話番号での通話)",
            type: "radio",
            options: ["ほとんど使わない", "30分未満", "30分〜1時間", "1〜3時間", "3時間以上", "わからない"],
          },
          {
            id: "call_style",
            label: "通話のしかた",
            type: "radio",
            options: ["5分以内の短い電話が多い", "長電話が多い", "LINEなどアプリの通話が中心", "仕事で電話をよく使う"],
          },
        ],
      },
      {
        title: "電波・使う場所",
        fields: [
          {
            id: "signal",
            label: "電波がつながりにくい場所",
            note: "複数選択可",
            type: "checkbox",
            options: ["自宅", "職場・学校", "通勤・通学中(電車・地下など)", "よく行く旅行先・帰省先", "特にない"],
          },
          {
            id: "area",
            label: "主に使う地域",
            type: "radio",
            options: ["都市部", "郊外・住宅地", "地方・山間部", "海外にもよく行く"],
          },
        ],
      },
      {
        title: "ポイント・お買い物",
        fields: [
          {
            id: "points",
            label: "よく貯めている・使っているポイント",
            note: "複数選択可",
            type: "checkbox",
            options: ["dポイント", "Pontaポイント", "PayPayポイント", "楽天ポイント", "Vポイント", "特になし"],
          },
          {
            id: "pay_service",
            label: "よく使うスマホ決済",
            note: "複数選択可",
            type: "checkbox",
            options: ["d払い", "au PAY", "PayPay", "楽天ペイ", "Suica・PASMO", "特になし"],
          },
        ],
      },
      {
        title: "自宅のインターネット",
        fields: [
          {
            id: "net_company",
            label: "自宅のインターネットの会社",
            type: "radio",
            options: ["ドコモ光", "auひかり", "ソフトバンク光", "楽天ひかり", "NURO光", "フレッツ光(NTT)", "ケーブルテレビ", "home 5G・ホームルーター", "わからない"],
            other: true,
          },
          {
            id: "net_fee",
            label: "自宅のインターネットの月額料金",
            type: "radio",
            options: ["4,000円未満", "4,000〜5,000円", "5,000〜6,000円", "6,000円以上", "わからない"],
          },
          {
            id: "net_trouble",
            label: "自宅のインターネットの不満",
            note: "複数選択可",
            type: "checkbox",
            options: ["速度が遅い", "つながりにくい部屋がある", "料金が高い", "途中で切れる", "特になし"],
          },
          {
            id: "net_need",
            label: "自宅のインターネットの検討",
            type: "radio",
            options: ["新しく引きたい", "安い会社に乗り換えたい", "今のままでよい", "相談したい"],
          },
          {
            id: "housing",
            label: "お住まい",
            type: "radio",
            options: ["一戸建て(持ち家)", "一戸建て(賃貸)", "マンション・アパート(持ち家)", "マンション・アパート(賃貸)"],
          },
        ],
      },
      {
        title: "ご希望",
        fields: [
          {
            id: "store_or_online",
            label: "手続きのご希望",
            type: "radio",
            options: ["お店で相談しながら手続きしたい", "オンラインの手続きでもよい", "どちらでもよい"],
          },
          {
            id: "priority",
            label: "見直しで重視したいこと",
            note: "複数選択可",
            type: "checkbox",
            options: ["月々の料金を下げたい", "データ量を増やしたい", "家族の料金をまとめて安くしたい", "自宅のWi-Fiも見直したい", "ポイント・特典を重視したい", "今の電話番号は変えたくない"],
            other: true,
          },
          {
            id: "notes",
            label: "その他のご要望",
            note: "任意",
            description: "気になっていることや、ご質問があればご自由にお書きください。",
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
      "features",                             // 必要な端子がないと使えないため
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
    plan: [
      "name", "email", "contact_method",
      "current_carrier", "contract_years", "holder", "family_count",  // 乗り換えの手続きに関わる
      "monthly_fee", "installment",                                      // 今の支払いと、乗り換えの費用
      "data_usage", "home_wifi", "throttle",                             // 合うプランを決める決め手
      "call_time",                                                       // かけ放題が必要かの判断
    ],
  };

  // =====================================================
  // 用語の説明(「?」を押すと表示されます)
  // =====================================================
  const HELP = {
    pc: {
      os: "Windows:会社や学校で広く使われている、一般的なパソコンです。Mac:Apple社のパソコンで、iPhoneとの連携が得意です。迷ったら「こだわりなし」をお選びください。",
      office: "Word(文書作成)やExcel(表計算)などのソフトです。最初から付いているパソコンと、別に購入が必要なパソコンがあります。",
      screen: "インチは画面の対角線の長さです。13インチはA4用紙より少し小さく、15インチはA4用紙より少し大きいくらいの大きさです。",
      features: "テンキー:キーボード右側の数字専用のキーです。HDMI:テレビやモニターにつなぐ差し込み口です。有線LAN:インターネットのケーブルを直接さす差し込み口です。",
      data_transfer: "古いパソコンに入っている写真・書類・メールなどを、新しいパソコンに移す作業です。",
      photo: "型番は、本体の裏側やバッテリーの下のシールに書かれていることが多いです。",
    },
    phone: {
      current_carrier: "ahamo・povo・LINEMO は、大手通信会社のオンライン専用の料金プランです。わからない場合は「わからない」で大丈夫です。",
      storage: "写真・動画・アプリを保存できる量です。写真や動画をたくさん撮る方は、大きめがおすすめです。",
      features: "おサイフケータイ:スマホをかざして、Suicaなどで支払える機能です。microSDカード:写真などを保存する小さなカードです(iPhoneでは使えません)。デュアルSIM・eSIM:1台で2つの電話番号を使える機能です。",
      carrier: "SIMフリー:通信会社とは契約せず、どの会社でも使える端末だけを購入する方法です。",
      data_transfer: "電話帳・写真・LINEなどを、新しいスマホに移す作業です。",
      photo: "機種名は、スマホの「設定」→「一般」→「情報」(iPhone)や、「設定」→「デバイス情報」(Android)で確認できます。その画面の写真でも大丈夫です。",
    },
    plan: {
      current_carrier: "ahamo・povo・LINEMO は、大手通信会社のオンライン専用の料金プランです。",
      plan_name: "契約プラン名は、携帯会社のマイページ(アプリ)や、請求書で確認できます。",
      holder: "契約の名義人が別の方の場合、乗り換えの手続きに名義人の方の同意や来店が必要になることがあります。",
      installment: "端末代の分割払いが残っている場合、乗り換えると残りの金額をまとめて請求されることがあります。",
      data_usage: "毎月のデータ使用量は、携帯会社のマイページ(アプリ)や、請求書で確認できます。",
      home_wifi: "光回線:工事をして引く、自宅用のインターネットです。ホームルーター:コンセントにさすだけで使えるWi-Fiです。",
      carrier_mail: "携帯会社を乗り換えると、このメールアドレスは原則使えなくなります。使い続けたい場合は、有料の「持ち運び」サービスなどを確認します。",
      options: "加入しているオプションは、マイページ(アプリ)や請求書の明細で確認できます。使っていないオプションを外すだけで安くなることもあります。",
      bundle: "携帯と自宅のネットや電気を同じ会社グループにすると、割引になることがあります。",
      points: "よく使うポイントと同じグループの携帯会社にすると、ポイントが貯まりやすくなることがあります。",
      call_time: "通話時間は、マイページ(アプリ)や請求書の「通話料」の欄で確認できます。LINEなどアプリの通話は含みません。",
    },
  };

  // =====================================================
  // 答えによって質問を出し分ける条件
  // =====================================================
  // 例:「デスクトップ」を選んだら、ノートPC用の「画面サイズ」は表示しない
  const HAS_DEVICE = { field: "current_maker", notIn: ["持っていない"] };
  const HAS_HOME_NET = { field: "home_wifi", in: ["はい(光回線)", "はい(ホームルーター・置くだけWi-Fi)"] };
  const SHOW_IF = {
    pc: {
      photo: HAS_DEVICE,
      years_used: HAS_DEVICE,
      data_transfer: HAS_DEVICE,
      screen: { field: "pc_type", notIn: ["デスクトップパソコン"] },
    },
    phone: {
      photo: HAS_DEVICE,
      years_used: HAS_DEVICE,
      data_transfer: HAS_DEVICE,
    },
    plan: {
      // 家族がいない場合、家族全体の金額は聞かない
      family_total: { field: "family_count", notIn: ["", "自分だけ"] },
      // 分割払いが残っている場合だけ、残りの金額と回数を聞く
      installment_left: { field: "installment", in: ["はい"] },
      installment_times: { field: "installment", in: ["はい"] },
      // 自宅にネットがある場合だけ、会社・料金・不満を聞く
      net_company: HAS_HOME_NET,
      net_fee: HAS_HOME_NET,
      net_trouble: HAS_HOME_NET,
    },
  };

  // 今の機種の写真(任意)
  const PHOTO = {
    id: "photo",
    label: "今の機種の写真",
    note: "任意・3枚まで",
    type: "photo",
    description:
      "型番が書かれたシールや、機種名がわかる画面の写真があると、確認がスムーズです。パスワードや個人情報が写らないようご注意ください。",
  };

  [pc, phone, plan].forEach((form) => {
    // 連絡先は最後に聞く(製品の質問から始めたほうが、最後まで答えてもらいやすいため)
    form.sections.push(form.sections.shift());

    form.sections.forEach((section) => {
      // 写真の項目を「現在お使いの機種」のすぐ後ろに入れる
      const at = section.fields.findIndex((f) => f.id === "current_maker");
      if (at !== -1) section.fields.splice(at + 1, 0, Object.assign({}, PHOTO));

      section.fields.forEach((field) => {
        field.required = REQUIRED[form.key].includes(field.id);
        if (HELP[form.key][field.id]) field.help = HELP[form.key][field.id];
        if (SHOW_IF[form.key][field.id]) field.showIf = SHOW_IF[form.key][field.id];
        // メーカーを選んだら、機種(シリーズ)などを追加で聞く(models.js)
        if (field.id === "current_maker") field.followUps = window.MODEL_FOLLOWUPS[form.key];
        // 初めて買う方も「買い替えの理由」に答えられるようにする
        if (field.id === "reason") field.options = ["初めて購入する"].concat(field.options);
      });
    });
  });

  // 機種のシートの文言(料金見直しのシートと書き分けるため)
  [pc, phone].forEach((form) => {
    form.leadIntro = "最適な機種をご提案・選定するため、";
    form.proposal = "ご希望に合った機種をご提案します";
  });

  window.HEARING_FORMS = { pc, phone, plan };
})();
