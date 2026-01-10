// pipboy-tabs.js — Pip-Boy New Vegas style panel switching

window.Pipboy = window.Pipboy || {};

(function () {
  const tabButtons = document.querySelectorAll("[data-pipboy-tab]");
  const panels = document.querySelectorAll(".pipboy-panel");

  function activatePanel(panelId) {
    panels.forEach((panel) => {
      if (panel.id === panelId) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });

    if (panelId === "panel-map") {
      document.body.classList.add("map-fullscreen");
      if (window.initWastelandMap) {
        window.initWastelandMap();
      }
    } else {
      document.body.classList.remove("map-fullscreen");
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-pipboy-tab");
      if (!target) return;
      activatePanel(target);

      tabButtons.forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
    });
  });

  // Default boot: STAT
  activatePanel("panel-stat");
})();
