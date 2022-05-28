const copyrightEl = document.getElementById('copyright');
const electronEl = document.getElementById('electron');
const chromeEl = document.getElementById('chrome');
const nodeEl = document.getElementById('node');
const v8El = document.getElementById('v8');

window.electron?.getAppInfo()?.then(({ name, copyright, versions }) => {
  copyrightEl && (copyrightEl.innerText = copyright);
  electronEl && (electronEl.innerText = versions?.electron?.[1]);
  chromeEl && (chromeEl.innerText = versions?.chrome?.[1]);
  nodeEl && (nodeEl.innerText = versions?.node?.[1]);
  v8El && (v8El.innerText = versions?.v8?.[1]);
});
