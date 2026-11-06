(function () {
  "use strict";

  const config = window.HEARING_CONFIG || {};
  const forms = window.HEARING_FORMS;

  const els = {
    form: document.getElementById("hearingForm"),
    body: document.getElementById("formBody"),
    title: document.getElementById("formTitle"),
    shopName: document.getElementById("shopName"),
    tabs: document.querySelectorAll(".switcher button"),
    submitBtn: document.getElementById("submitBtn"),
    printBtn: document.getElementById("printBtn"),
    againBtn: document.getElementById("againBtn"),
    done: document.getElementById("doneMessage"),
    errorSummary: document.getElementById("errorSummary"),
    agree: document.getElementById("agree"),
  };

  let current = null;

  // ---------- 画面の組み立て ----------

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else node.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach((c) => c && node.appendChild(c));
    return node;
  }

  function fieldName(field) {
    return "f_" + field.id;
  }

  function renderInput(field) {
    const name = fieldName(field);
    const id = name;

    switch (field.type) {
      case "textarea":
        return el("textarea", { id, name, rows: field.rows || 3, placeholder: field.placeholder });

      case "radio":
      case "checkbox": {
        const wrap = el("div", { class: "choices", role: field.type === "radio" ? "radiogroup" : "group" });
        field.options.forEach((opt) => {
          wrap.appendChild(
            el("label", { class: "choice" }, [
              el("input", { type: field.type, name, value: opt }),
              el("span", { text: opt }),
            ])
          );
        });
        if (field.other) {
          const otherText = el("input", { type: "text", name: name + "_other", "aria-label": field.label + "(その他)" });
          const otherBox = el("input", { type: field.type, name, value: "__other__" });
          otherText.addEventListener("input", () => {
            if (otherText.value.trim()) otherBox.checked = true;
          });
          wrap.appendChild(
            el("label", { class: "choice other-row" }, [otherBox, el("span", { text: "その他" }), otherText])
          );
        }
        return wrap;
      }

      case "budget":
        return el("div", { class: "inline" }, [
          el("span", { text: "約" }),
          el("input", { type: "number", name: name + "_min", min: 0, step: 1, inputmode: "numeric", "aria-label": "予算の下限(万円)" }),
          el("span", { text: "万円 〜" }),
          el("input", { type: "number", name: name + "_max", min: 0, step: 1, inputmode: "numeric", "aria-label": "予算の上限(万円)" }),
          el("span", { text: "万円" }),
        ]);

      case "date": {
        const date = el("input", { type: "date", id, name });
        const nodes = [date, el("span", { text: "頃まで" })];
        if (field.allowNoRush) {
          const noRush = el("input", { type: "checkbox", name: name + "_norush", value: "急ぎではない" });
          noRush.addEventListener("change", () => {
            date.disabled = noRush.checked;
          });
          nodes.push(el("label", { class: "choice" }, [noRush, el("span", { text: "急ぎではない" })]));
        }
        return el("div", { class: "inline" }, nodes);
      }

      default:
        return el("input", {
          type: field.type || "text",
          id,
          name,
          placeholder: field.placeholder,
          autocomplete: { name: "name", email: "email", tel: "tel", company: "organization" }[field.id],
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
        if (field.note) th.appendChild(el("span", { class: "note", text: `(${field.note})` }));

        const td = el("td");
        if (field.description) td.appendChild(el("p", { class: "description", text: field.description }));
        td.appendChild(renderInput(field));

        tbody.appendChild(el("tr", { "data-field": field.id }, [th, td]));
      });

      els.body.appendChild(
        el("section", { class: "section" }, [h2, el("table", { class: "q-table" }, [tbody])])
      );
    });
  }

  function selectForm(key) {
    const def = forms[key] || forms.pc;
    current = def;
    els.title.textContent = def.title;
    document.title = def.title;
    els.tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.form === def.key)));
    renderForm(def);
    clearErrors();

    const url = new URL(location.href);
    url.searchParams.set("type", def.key);
    history.replaceState(null, "", url);
  }

  // ---------- 回答の取り出し ----------

  function valueOf(field) {
    const name = fieldName(field);
    const f = els.form;

    switch (field.type) {
      case "radio":
      case "checkbox": {
        const checked = Array.from(f.querySelectorAll(`input[name="${name}"]:checked`));
        const other = f.querySelector(`input[name="${name}_other"]`);
        return checked
          .map((c) => (c.value === "__other__" ? `その他(${(other && other.value.trim()) || "記入なし"})` : c.value))
          .join("、");
      }
      case "budget": {
        const min = f.elements[name + "_min"].value.trim();
        const max = f.elements[name + "_max"].value.trim();
        if (!min && !max) return "";
        return `約${min || "?"}万円 〜 ${max || "?"}万円`;
      }
      case "date": {
        const noRush = f.elements[name + "_norush"];
        if (noRush && noRush.checked) return "急ぎではない";
        const v = f.elements[name].value;
        if (!v) return "";
        const [y, m, d] = v.split("-");
        return `${y}年${Number(m)}月${Number(d)}日頃まで`;
      }
      default:
        return (f.elements[name].value || "").trim();
    }
  }

  function collect() {
    const answers = [];
    current.sections.forEach((section, i) => {
      section.fields.forEach((field) => {
        answers.push({
          section: `${i + 1}. ${section.title}`,
          id: field.id,
          label: field.label,
          value: valueOf(field),
        });
      });
    });
    return answers;
  }

  // ---------- 入力チェック ----------

  function clearErrors() {
    els.form.querySelectorAll(".field-error").forEach((n) => n.remove());
    els.form.querySelectorAll(".has-error").forEach((n) => n.classList.remove("has-error"));
    els.errorSummary.hidden = true;
  }

  function showFieldError(fieldId, message) {
    const row = els.form.querySelector(`tr[data-field="${fieldId}"]`);
    if (!row) return;
    const td = row.querySelector("td");
    td.classList.add("has-error");
    td.appendChild(el("p", { class: "field-error", text: message }));
  }

  function validate(answers) {
    clearErrors();
    const errors = [];
    current.sections.forEach((section) =>
      section.fields.forEach((field) => {
        const a = answers.find((x) => x.id === field.id);
        if (field.required && !a.value) {
          errors.push(field.id);
          showFieldError(field.id, `${field.label}を入力してください。`);
        } else if (field.type === "email" && a.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.value)) {
          errors.push(field.id);
          showFieldError(field.id, "メールアドレスの形式が正しくありません。");
        }
      })
    );

    const messages = [];
    if (errors.length) messages.push("未入力または誤りのある項目があります。赤い欄をご確認ください。");
    if (!els.agree.checked) messages.push("送信前に、利用目的への同意にチェックを入れてください。");

    if (messages.length) {
      els.errorSummary.textContent = messages.join(" ");
      els.errorSummary.hidden = false;
      const first = errors.length ? els.form.querySelector(`tr[data-field="${errors[0]}"]`) : els.agree;
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  // ---------- 送信 ----------

  async function submit(e) {
    e.preventDefault();

    // スパム対策:隠し欄に入力があれば、送信したふりをして終了
    if (els.form.elements._hp.value) {
      showDone();
      return;
    }

    const answers = collect();
    if (!validate(answers)) return;

    if (!config.GAS_URL) {
      els.errorSummary.textContent =
        "送信先が設定されていません(管理者の方へ:config.js の GAS_URL を設定してください)。";
      els.errorSummary.hidden = false;
      return;
    }

    const pick = (id) => (answers.find((a) => a.id === id) || {}).value || "";
    const payload = {
      formType: current.key,
      formName: current.name,
      submittedAt: new Date().toISOString(),
      name: pick("name"),
      email: pick("email"),
      answers: answers.map(({ section, label, value }) => ({ section, label, value })),
    };

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "送信しています…";

    try {
      // text/plain で送ると、Google Apps Script 側で事前確認(CORS)が不要になる
      await fetch(config.GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      showDone();
    } catch (err) {
      els.errorSummary.textContent =
        "通信エラーのため送信できませんでした。電波の良い場所で、もう一度お試しください。";
      els.errorSummary.hidden = false;
    } finally {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "この内容で送信する";
    }
  }

  function showDone() {
    els.form.hidden = true;
    document.querySelector(".switcher").hidden = true;
    els.done.hidden = false;
    els.done.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetAll() {
    els.form.reset();
    els.form.hidden = false;
    document.querySelector(".switcher").hidden = false;
    els.done.hidden = true;
    selectForm(current.key);
  }

  // ---------- 初期化 ----------

  if (config.SHOP_NAME) {
    els.shopName.textContent = config.SHOP_NAME;
    els.shopName.hidden = false;
  }
  els.tabs.forEach((b) => b.addEventListener("click", () => selectForm(b.dataset.form)));
  els.form.addEventListener("submit", submit);
  els.printBtn.addEventListener("click", () => window.print());
  els.againBtn.addEventListener("click", resetAll);

  selectForm(new URLSearchParams(location.search).get("type") || "pc");
})();
