const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");

function setError(text) { loginError.textContent = text; }

// Already signed in? Go straight to the dashboard
if (db) {
  db.auth.getSession().then(({ data }) => {
    if (data.session) window.location.replace("admin.html");
  });
} else {
  setError("Login is not connected yet. Add your Supabase keys in js/supabase-config.js.");
}

// Show / hide password
togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.setAttribute("aria-pressed", String(show));
  togglePassword.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

// Sign in
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");

  if (!db) {
    setError("Login is not connected yet. Add your Supabase keys in js/supabase-config.js.");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";

  const { error } = await db.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value,
  });

  if (error) {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
    setError(
      error.status === 400
        ? "Wrong email or password. Please try again."
        : "Could not sign in right now. Check your internet and try again."
    );
    passwordInput.focus();
    return;
  }

  window.location.replace("admin.html");
});