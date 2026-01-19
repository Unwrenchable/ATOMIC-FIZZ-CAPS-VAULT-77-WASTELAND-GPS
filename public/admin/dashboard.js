// --- SESSION CHECK ---
const token = localStorage.getItem("adminSession");

if (!token) {
  window.location.href = "/admin/index.html";
}

// --- PANEL SWITCHING ---
const navButtons = document.querySelectorAll(".nav-btn");
const panels = document.querySelectorAll(".panel");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-panel");
    if (!target) return;

    panels.forEach(p => p.classList.remove("active"));
    document.getElementById(target).classList.add("active");
  });
});

// --- LOGOUT ---
document.getElementById("adminLogoutBtn").addEventListener("click", async () => {
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token
      }
    });
  } catch (err) {
    console.error("Logout error:", err);
  }

  localStorage.removeItem("adminSession");
  window.location.href = "/admin/index.html";
});

