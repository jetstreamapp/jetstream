const loginButton = document.getElementById('login-btn');
const signUpButton = document.getElementById('sign-up-btn');

if (loginButton) {
  loginButton.addEventListener('click', () => {
    window.electronAuth.login();
  });
}

if (signUpButton) {
  signUpButton.addEventListener('click', () => {
    window.electronAuth.signUp(true);
  });
}
