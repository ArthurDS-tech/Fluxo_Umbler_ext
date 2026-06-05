// Escuta mensagens do popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getQuestion") {
    sendResponse({ question: findQuestion() });
  }
  if (message.action === "clickSim") {
    sendResponse({ result: clickButton(["sim", "yes", "s"]) });
  }
  if (message.action === "clickNao") {
    sendResponse({ result: clickButton(["não", "nao", "no", "n"]) });
  }
});

function findQuestion() {
  const buttons = findButtons(["sim", "yes", "não", "nao", "no"]);
  if (!buttons.length) return null;

  let el = buttons[0].parentElement;
  for (let i = 0; i < 5; i++) {
    if (!el) break;
    const text = el.innerText?.trim();
    if (text && text.length > 5 && text.length < 300) {
      const cleaned = text
        .replace(/\bsim\b/gi, "").replace(/\bnão\b/gi, "")
        .replace(/\bnao\b/gi, "").replace(/\byes\b/gi, "")
        .replace(/\bno\b/gi, "").trim();
      if (cleaned.length > 5) return cleaned;
    }
    el = el.parentElement;
  }
  return null;
}

function findButtons(keywords) {
  return [
    ...document.querySelectorAll("button"),
    ...document.querySelectorAll("input[type='button']"),
    ...document.querySelectorAll("input[type='submit']"),
    ...document.querySelectorAll("a"),
    ...document.querySelectorAll("[role='button']"),
    ...document.querySelectorAll("label"),
  ].filter((el) => {
    const text = (el.innerText || el.value || el.textContent || "").trim().toLowerCase();
    return keywords.some((kw) => text === kw || text === kw + ".");
  });
}

function clickButton(keywords) {
  const buttons = findButtons(keywords);
  if (!buttons.length) return "not_found";
  buttons[0].click();
  return "clicked";
}
