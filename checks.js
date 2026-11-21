// =====================================================
// 回答の食い違いチェック
// =====================================================
// 確認画面で「ご確認ください」と表示する組み合わせです。
// 送信は止めません(お客様が「このままで合っている」場合もあるため)。
// 表示した内容は、通知メールとスプレッドシートの「提案のヒント」にも載ります。
//
// 書き方:
//   { when: (a) => 条件, text: (a) => "表示する文" }
//   a は「質問の id → 回答」の対応表です(例:a.os は「希望のOS」の回答)。
//   has(a.reason, "初めて") は、回答に「初めて」が含まれるかを調べます。
//   kind: "info" は食い違いではなく、知っておいてほしいお知らせです。

(function () {
  const has = (v, word) => String(v || "").indexOf(word) !== -1;
  const NO_DEVICE = ["", "持っていない", "わからない"];

  // パソコン・スマホ・タブレットで共通
  const deviceChecks = [
    {
      when: (a) => has(a.reason, "初めて購入する") && NO_DEVICE.indexOf(a.current_maker || "") === -1,
      text: (a) => `今お使いの機種(${a.current_maker})があるのに、買い替えの理由で「初めて購入する」が選ばれています。`,
    },
    {
      when: (a) =>
        a.current_maker === "持っていない" &&
        String(a.reason || "").split("、").some((r) => r && !has(r, "初めて") && !has(r, "その他") && !has(r, "子ども用")),
      text: () => "今お使いの機種を「持っていない」としていますが、買い替えの理由に、今の機種についての理由が選ばれています。",
    },
  ];

  window.HEARING_CHECKS = {
    pc: deviceChecks.concat([
      {
        when: (a) => has(a.pc_type, "持ち運び重視") && has(a.screen, "15インチ以上"),
        text: () => "「持ち運び重視」と「15インチ以上」が選ばれています。15インチ以上は重くなりやすいので、どちらを優先するか担当者と相談しましょう。",
      },
      {
        when: (a) => a.os === "Mac" && has(a.office, "付いているもの"),
        kind: "info",
        text: () => "Mac には Word・Excel などの Office ソフトが付いていないため、別に購入が必要です。",
      },
      {
        when: (a) => a.os === "Mac" && ["テンキー", "DVD", "有線LAN"].some((w) => has(a.features, w)),
        kind: "info",
        text: () => "Mac は、テンキー・DVDドライブ・有線LANの差し込み口がない機種が多く、別売りの機器が必要になることがあります。",
      },
    ]),
    phone: deviceChecks.concat([
      {
        when: (a) => a.os === "iPhone" && has(a.features, "microSD"),
        kind: "info",
        text: () => "iPhone は microSD カードを使えません。大きめの容量のモデルや、写真の保存サービスをご案内します。",
      },
      {
        when: (a) => a.os === "iPhone" && has(a.features, "イヤホンジャック"),
        kind: "info",
        text: () => "iPhone にはイヤホンジャックがありません。変換アダプターかワイヤレスイヤホンをご案内します。",
      },
      {
        when: (a) => has(a.budget, "3万円未満") && has(a.storage, "512GB"),
        text: () => "ご予算(3万円未満)に対して、保存容量(512GB以上)が大きめです。どちらを優先するか担当者と相談しましょう。",
      },
    ]),
    tablet: deviceChecks.concat([
      {
        when: (a) => has(a.connectivity, "Wi-Fiだけ") && a.home_wifi === "ない",
        text: () => "「Wi-Fiだけでよい」を選んでいますが、ご自宅にWi-Fiがないようです。Wi-Fiモデルはインターネットにつながる環境が必要です。",
      },
      {
        when: (a) => has(a.os, "Fire") && has(a.features, "スマホと同じアプリ"),
        kind: "info",
        text: () => "Fire タブレットでは Google Play のアプリが使えないため、スマホと同じアプリが使えない場合があります。",
      },
    ]),
    plan: [
      {
        when: (a) => a.data_usage === "3GB未満" && has(a.throttle, "毎月"),
        text: () => "データ使用量は「3GB未満」ですが、「毎月のように速度制限になる」が選ばれています。今の契約のデータ量が少ない可能性があります。",
      },
      {
        when: (a) => a.family_count === "自分だけ" && a.family_members && !has(a.family_members, "自分だけでよい"),
        text: () => "同じ会社を使っている家族は「自分だけ」ですが、一緒に見直したいご家族が選ばれています(ほかの会社を使っているご家族も一緒に、という意味でしたら、このままで大丈夫です)。",
      },
      {
        when: (a) => has(a.call_time, "ほとんど使わない") && (has(a.call_style, "長電話") || has(a.call_style, "仕事")),
        text: () => "通話は「ほとんど使わない」ですが、通話のしかたで「長電話」または「仕事で電話をよく使う」が選ばれています。",
      },
    ],
  };
})();
