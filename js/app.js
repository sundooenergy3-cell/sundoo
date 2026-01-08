document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Page Fade-in
  ========================= */
  requestAnimationFrame(() => {
    document.body.classList.add("is-ready");
  });

  /* =========================
     Selection History (shared)
  ========================= */
  const STORAGE_KEY = "sundoo_selection_history";
  const MAX_ITEMS = 30;

  const listEl = document.querySelector(".history-list");
  const clearBtn = document.querySelector(".history-clear");

  // history 패널이 없는 페이지면 여기서 종료 (다른 페이지에서도 에러 안 나게)
  if (!listEl) return;

  const loadHistory = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const saveHistory = (items) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  };

  const renderHistory = () => {
    const items = loadHistory();
    listEl.innerHTML = "";

    if (items.length === 0) {
      // 비어있을 때 안내 문구를 남기고 싶으면 여기서 처리 가능
      return;
    }

    items
      .slice()
      .reverse()
      .forEach((item) => {
        const li = document.createElement("li");
        li.className = "history-item";
        li.innerHTML = `
          <div>${item.label}</div>
          <time datetime="${new Date(item.ts).toISOString()}">
            ${formatTime(item.ts)}
          </time>
        `;
        listEl.appendChild(li);
      });
  };

  // 지우기 버튼 (없을 수도 있으니 방어)
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      saveHistory([]);
      renderHistory();
    });
  }

  // ✅ 카드 클릭 시: 기록 저장 → 페이지 이동
  document.querySelectorAll(".card[data-label][data-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const label = btn.dataset.label;
      const url = btn.dataset.url;

      const history = loadHistory();
      history.push({ label, url, ts: Date.now() });

      // 최근 MAX_ITEMS개만 유지
      saveHistory(history.slice(-MAX_ITEMS));

      // 이동
      window.location.href = url;
    });
  });

  // ✅ maps.html에서 “type=…” 값으로도 기록 남기고 싶다면 (선택)
  // - index를 거치지 않고 maps.html을 직접 들어왔을 때도 기록이 남게 할 수 있음
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  if (type && !document.querySelector(".card")) {
    // maps.html처럼 card가 없는 페이지에서만 자동 기록 (원하면 조건 수정)
    // saveHistory([...loadHistory(), { label: `접속: ${type}`, url: location.href, ts: Date.now() }].slice(-MAX_ITEMS));
  }

  // 최초 렌더 (페이지 들어올 때마다 왼쪽 패널에 기록 표시)
  renderHistory();
});
