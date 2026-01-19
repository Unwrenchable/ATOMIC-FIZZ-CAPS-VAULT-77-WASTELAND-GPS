const loginBtn = document.getElementById("adminLoginBtn");
const statusEl = document.getElementById("adminStatus");

async function adminLogin() {
  const username = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPass").value.trim();

  statusEl.textContent = "Authenticating…";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const json = await res.json();

    if (!json.ok) {
      statusEl.textContent = "Invalid credentials";
      return;
    }

    // Store admin session token
    localStorage.setItem("adminSession", json.token);

    statusEl.textContent = "Login successful";

    // Redirect to dashboard (next step)
    window.location.href = "/admin/dashboard.html";

  } catch (err) {
    console.error(err);
    statusEl.textContent = "Login failed";
  }
}

loginBtn.addEventListener("click", adminLogin);

// Allow Enter key
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") adminLogin();
});
