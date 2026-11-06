(function () {
  "use strict";

  const config = window.HEARING_CONFIG || {};
  const forms = window.HEARING_FORMS;
  const $ = (id) => document.getElementById(id);

  const els = {
    inputView: $("inputView"),
    confirmView: $("confirmView"),
    doneView: $("doneView"),
    form: $("hearingForm"),
    body: $("formBody"),
    title: $("formTitle"),
    shopName: $("shopName"),
    tabs: document.querySelectorAll(".switcher button"),
    restoreNotice: $("restoreNotice"),
    clearDraftBtn: $("clearDraftBtn"),
    progress: $("progress"),
    progressLabel: $("progressLabel"),
    progressCount: $("progressCount"),
    progressBar: $("progressBar"),
    errorSummary: $("errorSummary"),
    agree: $("agree"),
    confirmBody: $("confirmBody"),
    sendError: $("sendError"),
    submitBtn: $("submitBtn"),
    backBtn: $("backBtn"),
    receiptNo: $("receiptNo"),
    flowMail: $("flowMail"),
    flowContact: $("flowContact"),
    shopContact: $("shopContact"),
    doneSummary: $("doneSummary"),
    printBtn: $("printBtn"),
    againBtn: $("againBtn"),
  };

  // 完了後に「別の製品も相談する」を押したとき、引き継ぐ項目
  const CONTACT_IDS = ["name", "email", "tel", "contact_method", "contact_time"];
  const DRAFT_DAYS = 30; // 一時保存を残す日数

  let current = null;
  let lastAnswers = null;
  let returnScrollY = 0;

  // =====================================================
  // 画面の組み立て
  // =====================================================

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else node.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach((c) => c && node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  }

  function fieldName(field) {
    return "f_" + field.id;
  }

  function allFields() {
    return current.sections.flatMap((s) => s.fields);
  }

  // 「一緒に購入したいもの」で選ばれた商品の追加質問(画面に出ているものだけ)
  function followUpFieldsOf(field) {
    if (!field.followUps) return [];
    const checked = Array.from(els.form.querySelectorAll(`input[name="${fieldName(field)}"]:checked`)).map((c) => c.value);
    return field.options.flatMap((opt, oi) =>
      checked.includes(opt) ? followUpsFor(field, opt, oi) : []
    );
  }

  function followUpsFor(field, opt, oi) {
    return (field.followUps[opt] || []).map((q, qi) =>
      Object.assign({}, q, { id: `${field.id}_${oi}_${qi}`, label: `${opt}:${q.label}`, shortLabel: q.label })
    );
  }

  // チェックの付いた商品の追加質問だけを表示する
  function updateFollowUps() {
    els.form.querySelectorAll("tr.followup").forEach((tr) => {
      const box = els.form.querySelector(
        `input[name="${tr.dataset.parent}"][value="${CSS.escape(tr.dataset.option)}"]`
      );
      tr.hidden = !(box && box.checked);
    });
  }

  function renderInput(field) {
    const name = fieldName(field);

    switch (field.type) {
      case "textarea":
        return el("textarea", { id: name, name, rows: field.rows || 3, placeholder: field.placeholder });

      case "radio":
      case "checkbox": {
        // 短い選択肢だけの項目は、横に並べて縦長にならないようにする
        const longest = Math.max(...field.options.map((o) => o.length));
        const cls = "choices" + (longest <= 8 ? " grid-short" : longest <= 14 ? " grid-mid" : "");
        const wrap = el("div", { class: cls, role: field.type === "radio" ? "radiogroup" : "group" });
        field.options.forEach((opt) => {
          wrap.appendChild(
            el("label", { class: "choice" }, [el("input", { type: field.type, name, value: opt }), el("span", { text: opt })])
          );
        });
        if (field.other) {
          const otherText = el("input", { type: "text", name: name + "_other", "aria-label": field.label + "(その他)" });
          const otherBox = el("input", { type: field.type, name, value: "__other__" });
          otherText.addEventListener("input", () => {
            if (otherText.value.trim()) otherBox.checked = true;
          });
          wrap.appendChild(el("label", { class: "choice other-row" }, [otherBox, el("span", { text: "その他" }), otherText]));
        }
        return wrap;
      }

      default:
        return el("input", {
          type: field.type || "text",
          id: name,
          name,
          placeholder: field.placeholder,
          autocomplete: { name: "name", email: "email", tel: "tel" }[field.id],
          inputmode: field.type === "tel" ? "tel" : field.type === "email" ? "email" : undefined,
        });
    }
  }

  function renderForm(def) {
    els.body.innerHTML = "";
    def.sections.forEach((section, i) => {
      const h2 = el("h2", { text: `${i + 1}. ${section.title}` });
      if (section.note) h2.appendChild(el("span", { class: "sub", text: `(${section.note})` }));

      const tbody = el("tbody");
      section.fields.forEach((field) => {
        const th = el("th", { scope: "row" });
        const labelTarget = ["text", "email", "tel", "textarea", undefined].includes(field.type) ? fieldName(field) : null;
        th.appendChild(el(labelTarget ? "label" : "span", { for: labelTarget, text: field.label }));
        if (field.required) th.appendChild(el("span", { class: "req", text: "必須" }));
        if (field.requiredWhen) th.appendChild(el("span", { class: "note", text: field.requiredWhen.badge }));
        if (field.note) th.appendChild(el("span", { class: "note", text: `(${field.note})` }));

        const td = el("td");
        if (field.description) td.appendChild(el("p", { class: "description", text: field.description }));
        td.appendChild(renderInput(field));

        tbody.appendChild(el("tr", { "data-field": field.id }, [th, td]));

        // 商品ごとの追加質問の行(チェックしたときだけ表示)
        if (field.followUps) {
          field.options.forEach((opt, oi) => {
            const subs = followUpsFor(field, opt, oi);
            if (!subs.length) return;
            const subTd = el("td");
            subs.forEach((sub) => {
              const block = el("div", { class: "sub-q", "data-field": sub.id }, [
                el("p", { class: "sub-label" }, [sub.shortLabel, sub.note ? el("span", { class: "note-inline", text: `(${sub.note})` }) : null]),
                renderInput(sub),
              ]);
              subTd.appendChild(block);
            });
            tbody.appendChild(
              el("tr", { class: "followup", hidden: true, "data-parent": fieldName(field), "data-option": opt }, [
                el("th", { scope: "row" }, [el("span", { class: "followup-tag", text: "追加質問" }), el("span", { text: opt })]),
                subTd,
              ])
            );
          });
        }
      });

      els.body.appendChild(el("section", { class: "section" }, [h2, el("table", { class: "q-table" }, [tbody])]));
    });
  }

  function showView(name) {
    els.inputView.hidden = name !== "input";
    els.confirmView.hidden = name !== "confirm";
    els.doneView.hidden = name !== "done";
    // 冒頭の説明文は入力画面のときだけ表示する
    document.querySelectorAll(".lead, .badges").forEach((n) => (n.hidden = name !== "input"));
  }

  function selectForm(key) {
    const def = forms[key] || forms.pc;
    current = def;

    // 「スマートフォン/買い替え…」の切れ目でだけ改行されるようにする
    els.title.textContent = "";
    def.title.split("買い替え").forEach((part, i) => {
      if (i > 0) {
        els.title.appendChild(document.createElement("wbr"));
        part = "買い替え" + part;
      }
      els.title.appendChild(document.createTextNode(part));
    });
    document.title = def.title;
    els.tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.form === def.key)));

    renderForm(def);
    els.agree.checked = false;
    clearErrors();
    els.restoreNotice.hidden = !restoreDraft();
    updateFollowUps();
    updateProgress();

    const url = new URL(location.href);
    url.searchParams.set("type", def.key);
    history.replaceState(null, "", url);
  }

  // =====================================================
  // 回答の取り出し
  // =====================================================

  function valueOf(field) {
    const name = fieldName(field);
    const f = els.form;

    if (field.type === "radio" || field.type === "checkbox") {
      const checked = Array.from(f.querySelectorAll(`input[name="${name}"]:checked`));
      const other = f.querySelector(`input[name="${name}_other"]`);
      return checked
        .map((c) => (c.value === "__other__" ? `その他(${(other && other.value.trim()) || "記入なし"})` : c.value))
        .join("、");
    }
    return (f.elements[name].value || "").trim();
  }

  function collect() {
    const answers = [];
    current.sections.forEach((section, i) => {
      section.fields.forEach((field) => {
        answers.push({ section: `${i + 1}. ${section.title}`, id: field.id, label: field.label, value: valueOf(field) });
        followUpFieldsOf(field).forEach((sub) => {
          answers.push({ section: `${i + 1}. ${section.title}`, id: sub.id, label: sub.label, value: valueOf(sub) });
        });
      });
    });
    return answers;
  }

  const pick = (answers, id) => (answers.find((a) => a.id === id) || {}).value || "";

  // =====================================================
  // 入力チェック
  // =====================================================

  function isRequiredNow(field, answers) {
    const cond = field.requiredWhen;
    return field.required || (cond && pick(answers, cond.field) === cond.value);
  }

  // 問題がなければ null、あればエラーメッセージを返す
  function checkField(field, answers) {
    const value = pick(answers, field.id);
    const choice = field.type === "radio" || field.type === "checkbox";
    if (isRequiredNow(field, answers) && !value) {
      if (!field.required) return field.requiredWhen.message;
      return choice ? `${field.label}を選んでください。` : `${field.label}を入力してください。`;
    }
    if (choice && field.other && value.includes("その他(記入なし)")) {
      return "「その他」を選んだ場合は、内容をご記入ください。";
    }
    if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "メールアドレスの形式が正しくありません。";
    }
    return null;
  }

  function clearErrors() {
    els.form.querySelectorAll(".field-error").forEach((n) => n.remove());
    els.form.querySelectorAll(".has-error").forEach((n) => n.classList.remove("has-error"));
    els.errorSummary.hidden = true;
  }

  function setFieldError(fieldId, message) {
    const row = els.form.querySelector(`tr[data-field="${fieldId}"]`);
    if (!row) return;
    const td = row.querySelector("td");
    const old = td.querySelector(".field-error");
    if (old) old.remove();
    td.classList.toggle("has-error", Boolean(message));
    if (message) td.appendChild(el("p", { class: "field-error", text: message }));
  }

  function validate(answers) {
    clearErrors();
    const errors = [];
    allFields().forEach((field) => {
      const msg = checkField(field, answers);
      if (msg) {
        errors.push(field.id);
        setFieldError(field.id, msg);
      }
    });

    const messages = [];
    if (errors.length) messages.push(`未入力または誤りのある項目が${errors.length}件あります。赤い欄をご確認ください。`);
    if (!els.agree.checked) messages.push("利用目的への同意にチェックを入れてください。");

    if (messages.length) {
      els.errorSummary.textContent = messages.join(" ");
      els.errorSummary.hidden = false;
      const first = errors.length ? els.form.querySelector(`tr[data-field="${errors[0]}"]`) : els.agree;
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  // 入力し直したら、その項目の赤いエラーをすぐ消す
  function recheckErrors(answers) {
    els.form.querySelectorAll("td.has-error").forEach((td) => {
      const id = td.parentElement.dataset.field;
      const field = allFields().find((f) => f.id === id);
      if (field && !checkField(field, answers)) setFieldError(id, null);
    });
    if (!els.form.querySelector("td.has-error") && els.agree.checked) els.errorSummary.hidden = true;
  }

  // =====================================================
  // 進み具合のバー
  // =====================================================

  function updateProgress(answers) {
    answers = answers || collect();
    const required = allFields().filter((f) => isRequiredNow(f, answers));
    const done = required.filter((f) => !checkField(f, answers)).length;
    const total = required.length;
    const complete = done === total;

    els.progressCount.textContent = `${done} / ${total}`;
    els.progressLabel.textContent = complete ? "必須項目はすべて回答済みです 🎉" : "必須項目の回答状況";
    els.progressBar.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
    els.progress.classList.toggle("complete", complete);
  }

  // =====================================================
  // 一時保存(このブラウザの中だけに保存されます)
  // =====================================================

  const draftKey = () => "hearing-draft-" + current.key;

  function saveDraft() {
    const data = {};
    Array.from(els.form.elements).forEach((input) => {
      if (!input.name || !input.name.startsWith("f_")) return;
      if (input.type === "radio" || input.type === "checkbox") {
        if (input.checked) (data[input.name] = data[input.name] || []).push(input.value);
      } else if (input.value) {
        data[input.name] = input.value;
      }
    });
    try {
      if (Object.keys(data).length) {
        localStorage.setItem(draftKey(), JSON.stringify({ savedAt: Date.now(), data }));
      } else {
        localStorage.removeItem(draftKey());
      }
    } catch (e) {
      /* プライベートモードなどで保存できない場合は何もしない */
    }
  }

  function readDraft(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      if (!raw || Date.now() - raw.savedAt > DRAFT_DAYS * 864e5) return null;
      return raw.data;
    } catch (e) {
      return null;
    }
  }

  function applyValues(data) {
    Object.entries(data).forEach(([name, value]) => {
      const inputs = els.form.querySelectorAll(`[name="${name}"]`);
      inputs.forEach((input) => {
        if (input.type === "radio" || input.type === "checkbox") {
          input.checked = [].concat(value).includes(input.value);
        } else {
          input.value = value;
        }
      });
    });
  }

  function restoreDraft() {
    const data = readDraft(draftKey());
    if (!data) return false;
    applyValues(data);
    return true;
  }

  function clearDraft(key) {
    try {
      localStorage.removeItem(key || draftKey());
    } catch (e) {
      /* 何もしない */
    }
  }

  // =====================================================
  // 確認画面
  // =====================================================

  function buildAnswerList(answers) {
    const wrap = el("div", { class: "answer-list" });
    let dl = null;
    let lastSection = "";
    answers.forEach((a) => {
      if (a.section !== lastSection) {
        lastSection = a.section;
        wrap.appendChild(el("h3", { text: a.section }));
        dl = el("dl");
        wrap.appendChild(dl);
      }
      dl.appendChild(el("dt", { text: a.label }));
      dl.appendChild(el("dd", { class: a.value ? "" : "empty", text: a.value || "未回答" }));
    });
    return wrap;
  }

  function goConfirm(e) {
    e.preventDefault();

    // スパム対策:隠し欄に入力があれば、送信したふりをして終了
    if (els.form.elements._hp.value) {
      showView("done");
      return;
    }

    const answers = collect();
    if (!validate(answers)) return;

    lastAnswers = answers;
    returnScrollY = window.scrollY;
    els.confirmBody.innerHTML = "";
    els.confirmBody.appendChild(buildAnswerList(answers));
    els.sendError.hidden = true;
    showView("confirm");
    window.scrollTo({ top: 0 });
    els.confirmView.focus();
  }

  function backToInput() {
    showView("input");
    window.scrollTo({ top: returnScrollY });
  }

  // =====================================================
  // 送信
  // =====================================================

  function makeReceiptNo() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return `${current.key === "pc" ? "PC" : "SP"}-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`;
  }

  async function submit() {
    if (!config.GAS_URL) {
      els.sendError.textContent = "送信先が設定されていません(管理者の方へ:config.js の GAS_URL を設定してください)。";
      els.sendError.hidden = false;
      return;
    }

    const answers = lastAnswers;
    const receiptNo = makeReceiptNo();
    const payload = {
      receiptNo,
      formType: current.key,
      formName: current.name,
      submittedAt: new Date().toISOString(),
      name: pick(answers, "name"),
      email: pick(answers, "email"),
      answers: answers.map(({ section, label, value }) => ({ section, label, value })),
    };

    els.submitBtn.disabled = true;
    els.backBtn.disabled = true;
    els.submitBtn.textContent = "送信しています…";

    try {
      // text/plain で送ると、Google Apps Script 側で事前確認(CORS)が不要になる
      await fetch(config.GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      clearDraft();
      showDone(receiptNo, answers);
    } catch (err) {
      els.sendError.textContent =
        "通信エラーのため送信できませんでした。入力内容は保存されていますので、電波の良い場所でもう一度お試しください。";
      els.sendError.hidden = false;
    } finally {
      els.submitBtn.disabled = false;
      els.backBtn.disabled = false;
      els.submitBtn.textContent = "この内容で送信する";
    }
  }

  // =====================================================
  // 送信完了画面
  // =====================================================

  function showDone(receiptNo, answers) {
    const email = pick(answers, "email");
    const method = pick(answers, "contact_method");
    const time = pick(answers, "contact_time");
    const reply = config.REPLY_TIME || "数日以内";

    els.receiptNo.textContent = receiptNo;

    const mailStep = els.flowMail.parentElement;
    mailStep.hidden = !config.CUSTOMER_MAIL;
    els.flowMail.textContent =
      `${email} 宛てに、受付番号と回答内容をお送りします。` +
      "数分たっても届かない場合は、迷惑メールフォルダもご確認ください。";

    const how = method && method !== "どちらでもよい" ? `${method}で` : "メールまたはお電話で";
    els.flowContact.textContent =
      `${reply}に、${how}ご連絡します。` + (time && time !== "いつでもよい" ? `(ご希望の時間帯:${time})` : "");

    // お急ぎの場合の連絡先
    els.shopContact.innerHTML = "";
    if (config.SHOP_TEL) {
      els.shopContact.appendChild(el("p", { class: "contact-title", text: "お急ぎの場合は、お電話でもどうぞ" }));
      els.shopContact.appendChild(
        el("p", {}, [
          config.SHOP_NAME ? config.SHOP_NAME + " " : "",
          el("a", { href: "tel:" + config.SHOP_TEL.replace(/[^\d+]/g, ""), text: config.SHOP_TEL }),
        ])
      );
      if (config.SHOP_HOURS) els.shopContact.appendChild(el("p", { class: "muted", text: "受付時間:" + config.SHOP_HOURS }));
      els.shopContact.appendChild(el("p", { class: "muted", text: "受付番号をお伝えいただくと、スムーズにご案内できます。" }));
    }
    els.shopContact.hidden = !config.SHOP_TEL;

    els.doneSummary.innerHTML = "";
    els.doneSummary.appendChild(el("p", { class: "muted", text: `受付番号:${receiptNo}` }));
    els.doneSummary.appendChild(buildAnswerList(answers));

    showView("done");
    window.scrollTo({ top: 0 });
    els.doneView.focus();
  }

  // 別の製品も相談する:お名前・連絡先は入力済みの状態で始める
  function startAnother() {
    const contact = {};
    CONTACT_IDS.forEach((id) => {
      Array.from(els.form.querySelectorAll(`[name="f_${id}"]`)).forEach((input) => {
        if (input.type === "radio" || input.type === "checkbox") {
          if (input.checked) (contact["f_" + id] = contact["f_" + id] || []).push(input.value);
        } else if (input.value) {
          contact["f_" + id] = input.value;
        }
      });
    });

    const nextKey = current.key === "pc" ? "phone" : "pc";
    els.form.reset();
    selectForm(nextKey);
    if (!readDraft(draftKey())) {
      applyValues(contact);
      saveDraft();
      updateProgress();
    }
    showView("input");
    window.scrollTo({ top: 0 });
  }

  // =====================================================
  // 初期化
  // =====================================================

  if (config.SHOP_NAME) {
    els.shopName.textContent = config.SHOP_NAME;
    els.shopName.hidden = false;
  }

  function onEdit() {
    updateFollowUps();
    const answers = collect();
    updateProgress(answers);
    recheckErrors(answers);
    saveDraft();
  }

  els.form.addEventListener("input", onEdit);
  els.form.addEventListener("change", onEdit);
  els.form.addEventListener("submit", goConfirm);
  els.tabs.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.form !== current.key) selectForm(b.dataset.form);
    })
  );
  els.clearDraftBtn.addEventListener("click", () => {
    clearDraft();
    els.form.reset();
    selectForm(current.key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  els.submitBtn.addEventListener("click", submit);
  els.backBtn.addEventListener("click", backToInput);
  els.printBtn.addEventListener("click", () => {
    els.doneSummary.parentElement.open = true;
    window.print();
  });
  els.againBtn.addEventListener("click", startAnother);

  showView("input");
  selectForm(new URLSearchParams(location.search).get("type") || "pc");
})();
