document.addEventListener("DOMContentLoaded", () => {
  const retryBtn = document.getElementById("retryBtn");

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      location.href = "index.html";
    });
  }
});