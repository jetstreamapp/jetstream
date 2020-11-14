/* eslint-disable no-undef */
function parseQuery(queryString) {
  var query = {};
  var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query;
}

window.addEventListener('load', function () {
  var params = parseQuery(window.location.search);
  var clientUrl = params.clientUrl;

  if (params.error) {
    document.getElementById('status').innerText = params.message + ' ' + params.error || '';
  } else {
    if (window.opener) {
      params.clientUrl = undefined;
      // send them to the opening window
      window.opener.postMessage(JSON.stringify(params), clientUrl);
      // window.close(); // TODO: add this back in after testing
    } else {
      // ERROR! TODO:
      console.error('ERROR - window.opener is not defined');
    }
  }
});
