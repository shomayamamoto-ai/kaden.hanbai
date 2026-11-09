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
    modeBtns: document.querySelectorAll(".mode-switch button"),
    timeBadge: $("timeBadge"),
    fontBtn: $("fontBtn"),
    progress: $("progress"),
    progressLabel: $("progressLabel"),
    progressCount: $("progressCount"),
    progressBar: $("progressBar"),
    errorSummary: $("errorSummary"),
    agree: $("agree"),
    confirmBody: $("confirmBody"),
    turnstileBox: $("turnstileBox"),
    sendStatus: $("sendStatus"),
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
    leadIntro: $("leadIntro"),
    flowProposal: $("flowProposal"),
    flowProposalText: $("flowProposalText"),
    upsell: $("upsell"),
    upsellBtn: $("upsellBtn"),
  };

  // 入力できる文字数の上限(いたずらで大量の文字を送られないようにする)
  const MAX_LENGTH = { text: 50, email: 100, tel: 20, textarea: 1000, other: 100 };
  const MAX_PHOTOS = 3;
  const PHOTO_MAX_SIZE = 1280; // 写真は長い辺をこのピクセル数まで縮小して送る

  let current = null; // 表示中のヒアリングシート(パソコン/スマホ)
  let mode = "full"; // "full" = しっかり版、"simple" = かんたん版
  let lastAnswers = null;
  let returnScrollY = 0;
  let photos = []; // { dataUrl }
  let receiptNo = null; // 確認画面に進むたびに発行。再送信のときは同じ番号を使う
  let startedAt = Date.now();
  let dirty = false; // 何か入力されたか(閉じるときの確認に使う)
  let turnstileToken = "";

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

  const fieldName = (field) => "f_" + field.id;
  const allFields = () => current.sections.flatMap((s) => s.fields);
  const isChoice = (field) => field.type === "radio" || field.type === "checkbox";

  // 「一緒に購入したいもの」の商品ごとの追加質問
  function followUpsFor(field, opt, oi) {
    return (field.followUps[opt] || []).map((q, qi) =>
      Object.assign({}, q, { id: `${field.id}_${oi}_${qi}`, label: `${opt}:${q.label}`, shortLabel: q.label })
    );
  }

  function checkedValues(name) {
    return Array.from(els.form.querySelectorAll(`input[name="${name}"]:checked`)).map((c) => c.value);
  }

  function followUpFieldsOf(field) {
    if (!field.followUps) return [];
    const checked = checkedValues(fieldName(field));
    return field.options.flatMap((opt, oi) => (checked.includes(opt) ? followUpsFor(field, opt, oi) : []));
  }

  function renderPhotoInput(field) {
    const name = fieldName(field);
    const list = el("div", { class: "photo-list", id: name + "_list" });
    const input = el("input", { type: "file", id: name, accept: "image/*", multiple: true, class: "visually-hidden" });
    const button = el("label", { for: name, class: "btn-secondary btn-small" }, ["📷 写真を選ぶ"]);
    const hint = el("p", { class: "muted", id: name + "_hint", text: `${MAX_PHOTOS}枚まで送れます。` });

    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      input.value = "";
      for (const file of files) {
        if (photos.length >= MAX_PHOTOS) break;
        if (!file.type.startsWith("image/")) continue;
        try {
          photos.push({ dataUrl: await shrinkImage(file) });
        } catch (e) {
          /* 読み込めない画像は飛ばす */
        }
      }
      renderPhotoList();
      onEdit();
    });
    return el("div", { class: "photo-field" }, [button, input, hint, list]);
  }

  function renderPhotoList() {
    const list = els.form.querySelector(".photo-list");
    if (!list) return;
    list.innerHTML = "";
    photos.forEach((p, i) => {
      const remove = el("button", { type: "button", class: "photo-remove", "aria-label": `${i + 1}枚目の写真を削除` }, ["×"]);
      remove.addEventListener("click", () => {
        photos.splice(i, 1);
        renderPhotoList();
        onEdit();
      });
      list.appendChild(el("div", { class: "photo-item" }, [el("img", { src: p.dataUrl, alt: `${i + 1}枚目の写真` }), remove]));
    });
    const hint = els.form.querySelector(".photo-field .muted");
    if (hint) hint.textContent = photos.length >= MAX_PHOTOS ? "これ以上は追加できません。" : `あと${MAX_PHOTOS - photos.length}枚送れます。`;
  }

  // 写真を縮小して、送れる大きさにする
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, PHOTO_MAX_SIZE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image"));
      };
      img.src = url;
    });
  }

  function renderInput(field) {
    const name = fieldName(field);

    switch (field.type) {
      case "photo":
        return renderPhotoInput(field);

      case "textarea":
        return el("textarea", { id: name, name, rows: field.rows || 3, placeholder: field.placeholder, maxlength: MAX_LENGTH.textarea });

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
          const otherText = el("input", {
            type: "text",
            name: name + "_other",
            maxlength: MAX_LENGTH.other,
            "aria-label": field.label + "(その他)",
          });
          const otherBox = el("input", { type: field.type, name, value: "__other__" });
          otherText.addEventListener("input", () => {
            if (otherText.value.trim()) otherBox.checked = true;
          });
          wrap.appendChild(el("label", { class: "choice other-row" }, [otherBox, el("span", { text: "その他" }), otherText]));
        }
        // 「特になし」と他の選択肢は同時に選べないようにする
        if (field.type === "checkbox") {
          wrap.addEventListener("change", (e) => {
            const t = e.target;
            if (!t.checked || t.name !== name) return;
            const isNone = t.value.startsWith("特になし");
            wrap.querySelectorAll(`input[name="${name}"]`).forEach((box) => {
              if (box !== t && box.value.startsWith("特になし") !== isNone) box.checked = false;
            });
            if (isNone) {
              const other = wrap.querySelector(`input[name="${name}_other"]`);
              if (other) other.value = "";
            }
          });
        }
        return wrap;
      }

      default:
        return el("input", {
          type: field.type || "text",
          id: name,
          name,
          placeholder: field.placeholder,
          maxlength: MAX_LENGTH[field.type || "text"] || MAX_LENGTH.text,
          autocomplete: { name: "name", email: "email", tel: "tel" }[field.id],
          inputmode: field.type === "tel" ? "tel" : field.type === "email" ? "email" : undefined,
        });
    }
  }

  // 「?」ボタンと、その説明文
  function renderHelp(field, th, td) {
    if (!field.help) return;
    const helpId = fieldName(field) + "_help";
    const btn = el("button", {
      type: "button",
      class: "help-btn",
      "aria-expanded": "false",
      "aria-controls": helpId,
      "aria-label": `${field.label}の説明を見る`,
    }, ["?"]);
    const text = el("p", { class: "help-text", id: helpId, hidden: true, text: field.help });
    btn.addEventListener("click", () => {
      text.hidden = !text.hidden;
      btn.setAttribute("aria-expanded", String(!text.hidden));
    });
    th.appendChild(btn);
    td.insertBefore(text, td.firstChild);
  }

  function renderForm(def) {
    els.body.innerHTML = "";
    def.sections.forEach((section) => {
      const h2 = el("h2", { class: "section-title" }, [section.title]);
      if (section.note) h2.appendChild(el("span", { class: "sub", text: `(${section.note})` }));

      const tbody = el("tbody");
      section.fields.forEach((field) => {
        const th = el("th", { scope: "row" });
        const labelTarget = ["text", "email", "tel", "textarea", undefined].includes(field.type) ? fieldName(field) : null;
        th.appendChild(el(labelTarget ? "label" : "span", { for: labelTarget, text: field.label }));
        if (field.required) th.appendChild(el("span", { class: "req", text: "必須" }));

        const td = el("td");
        if (field.description) td.appendChild(el("p", { class: "description", text: field.description }));
        td.appendChild(renderInput(field));
        renderHelp(field, th, td);
        if (field.requiredWhen) th.appendChild(el("span", { class: "note", text: field.requiredWhen.badge }));
        if (field.note) th.appendChild(el("span", { class: "note", text: `(${field.note})` }));

        tbody.appendChild(el("tr", { "data-field": field.id }, [th, td]));

        // 商品ごとの追加質問の行(チェックしたときだけ表示)
        if (field.followUps) {
          field.options.forEach((opt, oi) => {
            const subs = followUpsFor(field, opt, oi);
            if (!subs.length) return;
            const subTd = el("td");
            subs.forEach((sub) => {
              subTd.appendChild(
                el("div", { class: "sub-q", "data-field": sub.id }, [
                  el("p", { class: "sub-label" }, [sub.shortLabel, sub.note ? el("span", { class: "note-inline", text: `(${sub.note})` }) : null]),
                  renderInput(sub),
                ])
              );
            });
            tbody.appendChild(
              el("tr", { class: "followup", hidden: true, "data-parent": fieldName(field), "data-parent-id": field.id, "data-option": opt }, [
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
    document.body.dataset.view = name;
  }

  function selectForm(key) {
    const def = forms[key] || forms.pc;
    current = def;

    // 「スマートフォン/買い替え…」「携帯料金見直し/ヒアリングシート」の切れ目でだけ改行されるようにする
    els.title.textContent = "";
    const breakAt = def.title.includes("買い替え") ? "買い替え" : "ヒアリングシート";
    def.title.split(breakAt).forEach((part, i) => {
      if (i > 0) {
        els.title.appendChild(document.createElement("wbr"));
        part = breakAt + part;
      }
      els.title.appendChild(document.createTextNode(part));
    });
    els.leadIntro.textContent = def.leadIntro || "";
    document.title = def.title;
    els.tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.form === def.key)));

    photos = [];
    renderForm(def);
    els.agree.checked = false;
    clearErrors();
    refresh();
    updateUrl();
  }

  function setMode(next) {
    mode = next === "simple" ? "simple" : "full";
    els.modeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    els.timeBadge.textContent = mode === "simple" ? "⏱ 所要時間 約1分" : "⏱ 所要時間 約3分";
    if (current) {
      refresh();
      updateUrl();
    }
  }

  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set("type", current.key);
    if (mode === "simple") url.searchParams.set("mode", "simple");
    else url.searchParams.delete("mode");
    history.replaceState(null, "", url);
  }

  // =====================================================
  // 回答の取り出しと、質問の出し分け
  // =====================================================

  function valueOf(field) {
    const name = fieldName(field);
    if (field.type === "photo") return photos.length ? `${photos.length}枚` : "";
    if (isChoice(field)) {
      const other = els.form.querySelector(`input[name="${name}_other"]`);
      return checkedValues(name)
        .map((v) => (v === "__other__" ? `その他(${(other && other.value.trim()) || "記入なし"})` : v))
        .join("、");
    }
    return (els.form.elements[name].value || "").trim();
  }

  // 画面に表示するかどうか(かんたん版・答えによる出し分け)
  function isVisible(field, raw) {
    if (mode === "simple" && !(field.required || field.requiredWhen || field.id === "notes")) return false;
    const cond = field.showIf;
    if (cond) {
      const v = raw[cond.field] || "";
      if (cond.notIn && cond.notIn.includes(v)) return false;
      if (cond.in && !cond.in.includes(v)) return false;
    }
    return true;
  }

  function rawValues() {
    const raw = {};
    allFields().forEach((f) => (raw[f.id] = valueOf(f)));
    return raw;
  }

  function visibleFields(raw) {
    raw = raw || rawValues();
    return allFields().filter((f) => isVisible(f, raw));
  }

  // 表示中の質問の回答だけを集める(隠れた質問の回答は送らない)
  function collect() {
    const raw = rawValues();
    const answers = [];
    current.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (!isVisible(field, raw)) return;
        answers.push({ section: section.title, id: field.id, label: field.label, value: raw[field.id] });
        followUpFieldsOf(field).forEach((sub) => {
          answers.push({ section: section.title, id: sub.id, label: sub.label, value: valueOf(sub) });
        });
      });
    });
    return answers;
  }

  const pick = (answers, id) => (answers.find((a) => a.id === id) || {}).value || "";

  function updateVisibility() {
    const raw = rawValues();
    allFields().forEach((field) => {
      const row = els.form.querySelector(`tr[data-field="${field.id}"]`);
      if (row) row.hidden = !isVisible(field, raw);
    });
    els.form.querySelectorAll("tr.followup").forEach((tr) => {
      const parentRow = els.form.querySelector(`tr[data-field="${tr.dataset.parentId}"]`);
      const box = els.form.querySelector(`input[name="${tr.dataset.parent}"][value="${CSS.escape(tr.dataset.option)}"]`);
      tr.hidden = Boolean(parentRow && parentRow.hidden) || !(box && box.checked);
    });
    // 見出しの番号は、表示中のセクションだけで振り直す
    let n = 0;
    els.body.querySelectorAll(".section").forEach((sec) => {
      const shown = Array.from(sec.querySelectorAll("tr[data-field]")).some((tr) => !tr.hidden);
      sec.hidden = !shown;
      if (shown) {
        n += 1;
        const h2 = sec.querySelector(".section-title");
        h2.firstChild.textContent = `${n}. ` + h2.firstChild.textContent.replace(/^\d+\. /, "");
      }
    });
  }

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
    if (isRequiredNow(field, answers) && !value) {
      if (!field.required) return field.requiredWhen.message;
      return isChoice(field) ? `${field.label}を選んでください。` : `${field.label}を入力してください。`;
    }
    if (isChoice(field) && field.other && value.includes("その他(記入なし)")) {
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
    visibleFields().forEach((field) => {
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
      if (field && (td.parentElement.hidden || !checkField(field, answers))) setFieldError(id, null);
    });
    if (!els.form.querySelector("td.has-error") && els.agree.checked) els.errorSummary.hidden = true;
  }

  // =====================================================
  // 進み具合のバー
  // =====================================================

  function updateProgress(answers) {
    const required = visibleFields().filter((f) => isRequiredNow(f, answers));
    const done = required.filter((f) => !checkField(f, answers)).length;
    const total = required.length;
    const complete = done === total;

    els.progressCount.textContent = `${done} / ${total}`;
    els.progressLabel.textContent = complete ? "必須項目はすべて回答済みです 🎉" : "必須項目の回答状況";
    els.progressBar.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
    els.progress.classList.toggle("complete", complete);
  }

  function refresh() {
    updateVisibility();
    const answers = collect();
    updateProgress(answers);
    recheckErrors(answers);
  }

  function onEdit() {
    dirty = true;
    refresh();
  }

  // =====================================================
  // 確認画面
  // =====================================================

  function buildAnswerList(answers, withPhotos) {
    const wrap = el("div", { class: "answer-list" });
    let dl = null;
    let lastSection = "";
    let n = 0;
    answers.forEach((a) => {
      if (a.section !== lastSection) {
        lastSection = a.section;
        n += 1;
        wrap.appendChild(el("h3", { text: `${n}. ${a.section}` }));
        dl = el("dl");
        wrap.appendChild(dl);
      }
      dl.appendChild(el("dt", { text: a.label }));
      const dd = el("dd", { class: a.value ? "" : "empty", text: a.value || "未回答" });
      if (a.id === "photo" && withPhotos && photos.length) {
        dd.appendChild(el("div", { class: "photo-list" }, photos.map((p, i) => el("div", { class: "photo-item" }, [el("img", { src: p.dataUrl, alt: `${i + 1}枚目の写真` })]))));
      }
      dl.appendChild(dd);
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
    receiptNo = makeReceiptNo();
    returnScrollY = window.scrollY;
    els.confirmBody.innerHTML = "";
    els.confirmBody.appendChild(buildAnswerList(answers, true));
    resetSendState();
    showView("confirm");
    setupTurnstile();
    window.scrollTo({ top: 0 });
    els.confirmView.focus();
  }

  function backToInput() {
    showView("input");
    window.scrollTo({ top: returnScrollY });
  }

  // =====================================================
  // いたずら送信の対策(Cloudflare Turnstile:設定したときだけ使う)
  // =====================================================

  function setupTurnstile() {
    if (!config.TURNSTILE_SITE_KEY) return;
    els.turnstileBox.hidden = false;
    turnstileToken = "";
    const render = () => {
      els.turnstileBox.innerHTML = "";
      window.turnstile.render(els.turnstileBox, {
        sitekey: config.TURNSTILE_SITE_KEY,
        language: "ja",
        callback: (token) => (turnstileToken = token),
        "expired-callback": () => (turnstileToken = ""),
      });
    };
    if (window.turnstile) return render();
    if (document.getElementById("turnstileScript")) return;
    const s = el("script", { id: "turnstileScript", src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async: true });
    s.onload = render;
    document.head.appendChild(s);
  }

  // =====================================================
  // 送信と、届いたかどうかの確認
  // =====================================================

  function makeReceiptNo() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const prefix = { pc: "PC", phone: "SP", plan: "MP" }[current.key] || "PC";
    return `${prefix}-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`;
  }

  // 受信プログラムに「この受付番号は届いていますか?」と問い合わせる
  // (Google の仕組み上、送信時の返事は読めないため、別の方法で確認する)
  function askStatus(no) {
    return new Promise((resolve) => {
      const cb = "__hearingCb" + Math.random().toString(36).slice(2);
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        delete window[cb];
        script.remove();
        clearTimeout(timer);
        resolve(result);
      };
      window[cb] = (data) => finish({ kind: "data", data: data || {} });
      const url = new URL(config.GAS_URL);
      url.searchParams.set("action", "status");
      url.searchParams.set("receiptNo", no);
      url.searchParams.set("callback", cb);
      url.searchParams.set("_", Date.now());
      const script = el("script", { src: url.toString() });
      // 読み込めたのに返事がない = 古い受信プログラム(確認の機能がない)
      script.onload = () => setTimeout(() => finish({ kind: "legacy" }), 100);
      script.onerror = () => finish({ kind: "error" });
      const timer = setTimeout(() => finish({ kind: "error" }), 8000);
      document.head.appendChild(script);
    });
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function confirmDelivered(no) {
    for (const delay of [1500, 2500, 4000, 6000]) {
      await wait(delay);
      const res = await askStatus(no);
      if (res.kind === "legacy") return { ok: true };
      if (res.kind === "data") {
        if (res.data.status === "ok") return { ok: true };
        if (res.data.status === "rejected") return { ok: false, reason: res.data.reason };
      }
    }
    return { ok: false, reason: "unconfirmed" };
  }

  const REJECT_MESSAGES = {
    bot: "ロボットではないことの確認ができませんでした。確認のチェックを入れ直して、もう一度送信してください。",
    busy: "ただいま送信が混み合っています。少し時間をおいて、もう一度送信してください。",
    invalid: "送信内容に問題がありました。お手数ですが、入力内容をご確認のうえ、もう一度送信してください。",
    too_fast: "送信が早すぎるため、受け付けられませんでした。もう一度送信してください。",
    unconfirmed: "送信できたかどうかを確認できませんでした。電波の良い場所で、もう一度送信してください(同じ内容が二重に届くことはありません)。",
    network: "通信エラーのため送信できませんでした。電波の良い場所で、もう一度送信してください。",
  };

  function resetSendState() {
    els.sendError.hidden = true;
    els.sendStatus.hidden = true;
    els.submitBtn.textContent = "この内容で送信する";
  }

  function showSendError(reason) {
    let msg = REJECT_MESSAGES[reason] || REJECT_MESSAGES.unconfirmed;
    if (config.SHOP_TEL) msg += ` 何度試してもうまくいかない場合は、お電話(${config.SHOP_TEL})でご連絡ください。受付番号:${receiptNo}`;
    els.sendError.textContent = msg;
    els.sendError.hidden = false;
    els.submitBtn.textContent = "もう一度送信する";
    if (window.turnstile && config.TURNSTILE_SITE_KEY) {
      turnstileToken = "";
      window.turnstile.reset(els.turnstileBox);
    }
  }

  async function submit() {
    if (!config.GAS_URL) {
      els.sendError.textContent = "送信先が設定されていません(管理者の方へ:config.js の GAS_URL を設定してください)。";
      els.sendError.hidden = false;
      return;
    }
    if (config.TURNSTILE_SITE_KEY && !turnstileToken) {
      els.sendError.textContent = "送信ボタンの上にある「確認」のチェックを入れてください。";
      els.sendError.hidden = false;
      return;
    }

    const answers = lastAnswers;
    const payload = {
      receiptNo,
      formType: current.key,
      formName: current.name,
      mode,
      submittedAt: new Date().toISOString(),
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
      name: pick(answers, "name"),
      email: pick(answers, "email"),
      turnstileToken,
      answers: answers.map(({ section, id, label, value }) => ({ section, id, label, value })),
      photos: answers.some((a) => a.id === "photo") ? photos.map((p) => p.dataUrl) : [],
    };

    els.submitBtn.disabled = true;
    els.backBtn.disabled = true;
    els.sendError.hidden = true;
    els.sendStatus.hidden = false;
    els.sendStatus.textContent = "送信しています…";
    els.submitBtn.textContent = "送信しています…";

    let sendFailed = false;
    try {
      // text/plain で送ると、Google Apps Script 側で事前確認(CORS)が不要になる
      await fetch(config.GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      sendFailed = true;
    }

    els.sendStatus.textContent = "届いたかどうかを確認しています…(10秒ほどかかることがあります)";
    const result = await confirmDelivered(receiptNo);

    els.submitBtn.disabled = false;
    els.backBtn.disabled = false;
    els.sendStatus.hidden = true;

    if (result.ok) {
      dirty = false;
      showDone(receiptNo, answers);
    } else {
      showSendError(sendFailed && result.reason === "unconfirmed" ? "network" : result.reason);
    }
  }

  // =====================================================
  // 送信完了画面
  // =====================================================

  function showDone(no, answers) {
    const email = pick(answers, "email");
    const method = pick(answers, "contact_method");
    const time = pick(answers, "contact_time");
    const reply = config.REPLY_TIME || "数日以内";

    els.receiptNo.textContent = no;

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

    // 3つ目の流れ:機種なら「おすすめの機種」、料金見直しなら「合ったプラン」
    els.flowProposal.textContent = current.proposal || "ご希望に合った機種をご提案します";
    els.flowProposalText.textContent =
      current.key === "plan"
        ? "今の料金と使い方を比べて、無理のない見直し方法をご紹介します。"
        : "ご予算・用途に合わせて、おすすめの機種をいくつかご紹介します。";

    // 機種のヒアリングを送った方には、携帯料金・Wi-Fiの見直しもおすすめする
    els.upsell.hidden = current.key === "plan" || !forms.plan;

    els.doneSummary.innerHTML = "";
    els.doneSummary.appendChild(el("p", { class: "muted", text: `受付番号:${no}` }));
    els.doneSummary.appendChild(buildAnswerList(answers, false));

    showView("done");
    window.scrollTo({ top: 0 });
    els.doneView.focus();
  }

  // 続けて別の内容を送る:入力内容はすべて消して、まっさらな状態から始める
  function resetForm(key) {
    els.form.reset();
    lastAnswers = null;
    receiptNo = null;
    dirty = false;
    startedAt = Date.now();
    selectForm(key);
    showView("input");
    window.scrollTo({ top: 0 });
  }

  // =====================================================
  // 文字の大きさ
  // =====================================================

  function toggleFont() {
    const large = document.documentElement.classList.toggle("large-text");
    els.fontBtn.setAttribute("aria-pressed", String(large));
    els.fontBtn.textContent = large ? "文字を元の大きさに戻す" : "文字を大きくする";
  }

  // =====================================================
  // 初期化
  // =====================================================

  if (config.SHOP_NAME) {
    els.shopName.textContent = config.SHOP_NAME;
    els.shopName.hidden = false;
  }

  els.form.addEventListener("input", onEdit);
  els.form.addEventListener("change", onEdit);
  els.form.addEventListener("submit", goConfirm);
  els.tabs.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.form !== current.key) selectForm(b.dataset.form);
    })
  );
  els.modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  els.fontBtn.addEventListener("click", toggleFont);
  els.submitBtn.addEventListener("click", submit);
  els.backBtn.addEventListener("click", backToInput);
  els.printBtn.addEventListener("click", () => {
    els.doneSummary.parentElement.open = true;
    window.print();
  });
  els.againBtn.addEventListener("click", () => resetForm(current.key));
  // 料金見直しは詳しく聞くほど提案の精度が上がるため、「しっかり版」で開く
  // お名前とメールアドレスだけは引き継ぐ(入力の手間を減らすため。ほかの回答は引き継がない)
  els.upsellBtn.addEventListener("click", () => {
    const carry = { name: pick(lastAnswers || [], "name"), email: pick(lastAnswers || [], "email") };
    setMode("full");
    resetForm("plan");
    Object.entries(carry).forEach(([id, value]) => {
      const input = els.form.elements["f_" + id];
      if (input && value) input.value = value;
    });
    refresh();
  });

  // 入力の途中でページを閉じようとしたら、確認を出す
  window.addEventListener("beforeunload", (e) => {
    if (dirty && document.body.dataset.view !== "done") {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // 以前のバージョンで保存された入力内容が残っていれば消す
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("hearing-draft-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    /* 何もしない */
  }

  // ブラウザの「戻る」で表示されたときも、入力内容を残さない
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) resetForm(current.key);
  });

  const params = new URLSearchParams(location.search);
  setMode(params.get("mode"));
  showView("input");
  selectForm(params.get("type") || "pc");
})();
