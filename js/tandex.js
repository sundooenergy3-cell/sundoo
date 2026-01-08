document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("mainVideo");

  // 비디오 설정 + 재생(단일/배열 모두 대응)
  if (video) {
    const videos = ["img/gas_cooktop_2025.mp4"];
    let index = 0;

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const playVideo = (i) => {
      video.src = videos[i];
      video.load();
      video.play().catch((err) => {
        console.log("Autoplay blocked or error:", err);
      });
    };

    playVideo(index);

    video.addEventListener("ended", () => {
      index = (index + 1) % videos.length;
      playVideo(index);
    });
  }

  // 로딩 페이드인 + 텍스트 애니메이션 트리거
  requestAnimationFrame(() => {
    document.body.classList.add("is-ready");
  });
});
