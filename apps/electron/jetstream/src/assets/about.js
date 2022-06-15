const copyrightEl = document.getElementById('copyright');
const versionEl = document.getElementById('version');
const electronEl = document.getElementById('electron');
const chromeEl = document.getElementById('chrome');
const nodeEl = document.getElementById('node');
const v8El = document.getElementById('v8');

window.electron?.getAppInfo()?.then(({ name, copyright, version, versions }) => {
  copyrightEl && (copyrightEl.innerText = copyright);
  versionEl && (versionEl.innerText = version);
  electronEl && (electronEl.innerText = versions?.electron);
  chromeEl && (chromeEl.innerText = versions?.chrome);
  nodeEl && (nodeEl.innerText = versions?.node);
  v8El && (v8El.innerText = versions?.v8);
});
