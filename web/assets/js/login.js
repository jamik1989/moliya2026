function doLogin() {
  const login = document.getElementById('login').value.trim();
  const password = document.getElementById('password').value.trim();
  const error = document.getElementById('error');

  if (login === 'admin' && password === '1234') {
    localStorage.setItem('auth', 'true');
    window.location.replace('user.html');
  } else {
    error.textContent = '❌ Login yoki parol noto‘g‘ri';
  }
}
