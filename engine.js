// Shared quiz engine. A page sets window.QUIZ = { round, questions } before loading this file.
// MCQ question: { sec, topic, ctx, q, o:[...], a, e }
// Open question: { type:"open", sec, topic, ctx, q, model }  (you write the answer on paper, reveal, then self-mark)
(() => {
  const { round: ROUND, questions: Q } = window.QUIZ;
  const REPO = "ZeppyClown/db-exam-quiz";
  const KEY = "sc2207-" + ROUND.toLowerCase();
  const L = "ABCDEF";
  const SM = ["Missed", "Partly", "Got it"];
  const fresh = () => ({ ans:{}, guess:{}, self:{}, shown:{}, checked:false, start:Date.now() });
  let state = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "{}"));
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  save();
  const strip = s => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

  function render() {
    const root = document.getElementById("quiz");
    root.innerHTML = "";
    let lastSec = "";
    Q.forEach((x, i) => {
      if (x.sec !== lastSec) { const h = document.createElement("h2"); h.textContent = x.sec; root.appendChild(h); lastSec = x.sec; }
      const c = document.createElement("div"); c.className = "card";
      const ctx = x.ctx ? `<div class="ctx">${x.ctx}</div>` : "";
      if (x.type === "open") {
        const shown = state.shown[i] || state.checked, s = state.self[i];
        c.innerHTML = `<div class="q">Q${i+1}. <span style="font-weight:400;color:var(--muted)">✍️ write it on paper first</span></div>${ctx}<div class="q">${x.q}</div>
          <button class="btn sec" data-show="${i}" style="${shown ? "display:none" : ""}">Show model answer</button>
          <div class="model ${shown ? "show" : ""}">${x.model}</div>
          <div class="selfmark ${shown ? "show" : ""}">${SM.map((t, k) => `<button class="sm ${s === k ? "on" : ""}" data-sm="${i}" data-k="${k}">${t}</button>`).join("")}</div>`;
      } else {
        const chosen = state.ans[i];
        let tag = "";
        if (state.checked) tag = chosen === x.a ? `<span class="tag ok">Correct</span>` : `<span class="tag bad">${chosen === undefined ? "Unanswered" : "Wrong"} — answer ${L[x.a]}</span>`;
        c.innerHTML = `${tag}<div class="q">Q${i+1}.</div>${ctx}<div class="q">${x.q}</div>
          <div class="opts">${x.o.map((t, j) => {
            let cls = "opt";
            if (state.checked) { if (j === x.a) cls += " correct"; else if (j === chosen) cls += " wrong"; }
            else if (j === chosen) cls += " sel";
            return `<button class="${cls}" data-q="${i}" data-o="${j}" ${state.checked ? "disabled" : ""}><b>${L[j]}</b>${t}</button>`;
          }).join("")}</div>
          <label class="guess"><input type="checkbox" data-g="${i}" ${state.guess[i] ? "checked" : ""} ${state.checked ? "disabled" : ""}> guessed</label>
          <div class="exp ${state.checked ? "show" : ""}">${x.e}</div>`;
      }
      root.appendChild(c);
    });
    root.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { state.ans[b.dataset.q] = +b.dataset.o; save(); render(); });
    root.querySelectorAll("[data-g]").forEach(cb => cb.onchange = () => { state.guess[cb.dataset.g] = cb.checked; save(); });
    root.querySelectorAll("[data-show]").forEach(b => b.onclick = () => { state.shown[b.dataset.show] = true; save(); render(); });
    root.querySelectorAll("[data-sm]").forEach(b => b.onclick = () => { state.self[b.dataset.sm] = +b.dataset.k; save(); render(); });
    renderResult();
  }

  function tally() {
    const by = {}; let mcq = 0, mcqN = 0, open = 0, openN = 0;
    Q.forEach((x, i) => {
      by[x.topic] = by[x.topic] || [0, 0]; by[x.topic][1]++;
      if (x.type === "open") { openN++; const s = state.self[i]; if (s !== undefined) { open += s / 2; by[x.topic][0] += s / 2; } }
      else { mcqN++; if (state.ans[i] === x.a) { mcq++; if (!state.guess[i]) by[x.topic][0]++; } }
    });
    return { by, mcq, mcqN, open, openN };
  }

  function report() {
    const { by, mcq, mcqN, open, openN } = tally();
    const lines = Q.map((x, i) => {
      if (x.type === "open") {
        const s = state.self[i];
        return `Q${i+1} [${x.topic}] OPEN | self-mark: ${s === undefined ? "not marked" : SM[s]} | ${strip(x.q).slice(0, 70)}`;
      }
      const c = state.ans[i], ok = c === x.a, g = !!state.guess[i];
      return `Q${i+1} [${x.topic}] picked ${c === undefined ? "-" : L[c]}${g ? "?" : ""} | correct ${L[x.a]} | ${ok ? (g ? "LUCKY" : "OK") : "WRONG"}${c !== undefined && !ok ? ` | chose: "${strip(x.o[c]).slice(0, 80)}"` : ""}`;
    });
    const mins = Math.round((Date.now() - state.start) / 60000);
    return `<!-- quiz-result -->
round: ${ROUND}
mcq_score: ${mcq}/${mcqN}
open_selfmark: ${open}/${openN}
time_minutes: ${mins}
topic_confident: ${Object.entries(by).map(([t, [s, n]]) => `${t} ${s}/${n}`).join("; ")}

${lines.join("\n")}`;
  }

  function issueUrl() {
    const p = new URLSearchParams({ title: `Quiz result ${ROUND} — ${new Date().toLocaleString()}`, body: report(), labels: "quiz-result" });
    return `https://github.com/${REPO}/issues/new?${p}`;
  }

  function renderResult() {
    const r = document.getElementById("result");
    if (!state.checked) { r.innerHTML = ""; return; }
    const { by, mcq, mcqN, open, openN } = tally();
    const unmarked = Q.some((x, i) => x.type === "open" && state.self[i] === undefined);
    r.innerHTML = `<div class="card"><div class="score">${mcq}/${mcqN} MCQ${openN ? ` · ${open}/${openN} written` : ""}</div>
      ${unmarked ? `<div class="sub warn">Self-mark each written question (Missed / Partly / Got it) before sending.</div>` : ""}
      <table><tr><th>Topic</th><th>Confident score</th></tr>${Object.entries(by).map(([t, [s, n]]) =>
        `<tr><td>${t}</td><td>${s}/${n} ${s === n ? "✅" : s === 0 ? "❌" : "⚠️"}</td></tr>`).join("")}</table>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
        <a class="btn" style="text-align:center;text-decoration:none" target="_blank" href="${issueUrl()}">📤 Send results to Claude</a>
        <button class="btn sec" id="copy">Copy results (paste into chat instead)</button>
      </div></div>`;
    document.getElementById("copy").onclick = async ev => {
      try { await navigator.clipboard.writeText(report()); ev.target.textContent = "Copied ✔"; }
      catch { prompt("Copy this:", report()); }
    };
  }

  document.getElementById("check").onclick = () => { state.checked = true; save(); render(); window.scrollTo({ top:0, behavior:"smooth" }); };
  document.getElementById("reset").onclick = () => { if (confirm("Clear all answers?")) { state = fresh(); save(); render(); } };
  render();
})();
