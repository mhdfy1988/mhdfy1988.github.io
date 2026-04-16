const cards = [...document.querySelectorAll(".workspace-card")];
const filterButtons = [...document.querySelectorAll("[data-filter]")];

cards.forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--tilt-y", `${x * 5}deg`);
    card.style.setProperty("--tilt-x", `${y * -5}deg`);
  });

  card.addEventListener("pointerleave", () => {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));

    cards.forEach((card) => {
      const visible = filter === "all" || card.dataset.type === filter;
      card.classList.toggle("is-hidden", !visible);
    });
  });
});

const scrollToCurrentHash = () => {
  if (!window.location.hash) {
    return;
  }

  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = document.getElementById(id);
  if (!target) {
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start" });
    });
  });
};

window.addEventListener("load", scrollToCurrentHash);
window.addEventListener("hashchange", scrollToCurrentHash);
window.addEventListener("resize", () => {
  window.clearTimeout(window.__hashScrollTimer);
  window.__hashScrollTimer = window.setTimeout(scrollToCurrentHash, 120);
});
scrollToCurrentHash();
setTimeout(scrollToCurrentHash, 120);
setTimeout(scrollToCurrentHash, 600);
setTimeout(scrollToCurrentHash, 1200);
