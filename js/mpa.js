// ✅ 네이버 길찾기(네이버맵)로 보내줄 허용 지역 키워드
const SERVICE_AREAS = [
  "일산", "파주", "시흥",
  "안산", "군포", "고양",
  "강화", "영종",
  "서울", "수원", "화성",
  "용인", "안양", "과천",
  "광명", "의왕", "의정부",
  "구리", "성남", "남양주",
  "인천",
];

// ✅ 카카오 지오코딩이 돌려준 address_name(=label)에 허용 키워드가 포함되는지 확인
function isServiceAreaByAddressName(addressName) {
  const s = String(addressName || "");
  return SERVICE_AREAS.some((area) => s.includes(area));
}

(() => {
  const form = document.getElementById("searchForm");
  const input = document.getElementById("q");
  const submitBtn = form?.querySelector('button[type="submit"]');

  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");

  if (!form || !input) return;

  function getType() {
    return (
      new URLSearchParams(window.location.search).get("type") ||
      localStorage.getItem("consult_type") ||
      ""
    );
  }

  const NEXT_PAGE_BY_TYPE = {
    boiler:  "installation_boiler.html",
    gas:     "installation_gas.html",
    dryer:   "installation_dryer.html",
    elec:    "installation_elec.html",
    builtin: "installation_builtin.html",
    sash:    "installation_sash.html",
  };

  const DEFAULT_NEXT_PAGE = "installation_gas2.html";

  function getNextPageByType(type) {
    return NEXT_PAGE_BY_TYPE[type] || DEFAULT_NEXT_PAGE;
  }

  // ✅ 비허용지역(서비스 외)일 때 이동할 HTML
  const OUTSIDE_SERVICE_PAGE = "connection.html";

  const SAVE_NEXT_TO_HISTORY = true;

  const COMPANY = {
    name: "선두에너지",
    address: "인천 서구 청마로34번길 32-9",
  };

  let companyCoords = null; // { x, y, name }

  const normalize = (s) =>
    String(s || "")
      .trim()
      .replace(/\s+/g, " ");

  const safeName = (s) =>
    encodeURIComponent(
      String(s || "")
        .replace(/,/g, " ")
        .trim()
    );

  function setBusy(busy) {
    input.disabled = busy;
    if (submitBtn) {
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? "검색중..." : "검색";
    }
    if (nextBtn) {
      nextBtn.disabled = busy;
      nextBtn.textContent = busy ? "처리중..." : "다음으로";
    }
    if (prevBtn) {
      prevBtn.disabled = busy;
      prevBtn.textContent = busy ? "처리중..." : "이전으로";
    }
  }

  async function geocode(address) {
    const q = String(address || "").trim();
    if (!q) return null;

    const url = `/api/geocode?address=${encodeURIComponent(q)}`;
    const res = await fetch(url, { cache: "no-store" });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("GEOCODE_NON_JSON_RESPONSE");
    }

    if (!res.ok) {
      const msg = data?.message || data?.error || "API error";
      throw new Error(`KAKAOMAP_ERROR: ${msg}`);
    }

    const x = Number(data?.x);
    const y = Number(data?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return {
      x,
      y,
      label: data.address_name || q,
      raw: q,
    };
  }

  function buildDirectionsUrl(from, to) {
    const sName = safeName(from.name);
    const gName = safeName(to.name);
    return `https://map.naver.com/v5/directions/${from.x},${from.y},${sName}/${to.x},${to.y},${gName}/-/car`;
  }

  async function initCompany({ silent = true } = {}) {
    try {
      const c = await geocode(COMPANY.address);
      if (!c) throw new Error("COMPANY_GEOCODE_NOT_FOUND");
      companyCoords = { x: c.x, y: c.y, name: COMPANY.name };
      console.log("[initCompany] OK:", companyCoords);
    } catch (e) {
      console.warn("[initCompany] failed:", e);
      if (!silent) {
        const msg = String(e?.message || e);
        alert(
          "회사 주소 좌표 초기화에 실패했어요.\n" +
            `회사주소: ${COMPANY.address}\n` +
            `오류: ${msg}\n\n` +
            "(/api/geocode 응답과 KAKAO_REST_KEY 설정을 확인하세요.)"
        );
      }
    }
  }

  function pushHistory(label, url) {
    const STORAGE_KEY = "sundoo_selection_history";
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      arr.push({ label, url, ts: Date.now() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-30)));
    } catch {}
  }

  // ✅ 팝업에 로딩 화면 즉시 표시(빈 탭 방지)
  function openLoadingPopup() {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return null;

    try {
      w.document.open();
      w.document.write(`
        <!doctype html><html lang="ko">
        <head><meta charset="utf-8"><title>네이버맵 여는중…</title></head>
        <body style="font-family:system-ui; padding:24px;">
          <h2 style="margin:0 0 12px;">네이버맵을 여는 중이에요…</h2>
          <p style="margin:0; color:#555;">잠시만 기다려주세요.</p>
        </body></html>
      `);
      w.document.close();
    } catch {
      // 문서 접근이 막혀도 창은 유지
    }
    return w;
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "index2.html";
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const q = normalize(input.value);

      const type = getType();
      if (type) localStorage.setItem("consult_type", type);

      const nextPage = getNextPageByType(type);

      const url = q
        ? `${nextPage}?q=${encodeURIComponent(q)}&skipMap=1&type=${encodeURIComponent(type)}`
        : `${nextPage}?skipMap=1&type=${encodeURIComponent(type)}`;

      if (SAVE_NEXT_TO_HISTORY) {
        pushHistory(q ? `지역 입력(지도 건너뜀): ${q}` : "지도 검색 건너뜀", url);
      }

      window.location.href = url;
    });
  }

  async function onSearch() {
    const q = normalize(input.value);
    if (!q) return alert("고객 주소(지역/주소)를 입력해주세요.");

    const type = getType();
    if (type) localStorage.setItem("consult_type", type);

    const nextPage = getNextPageByType(type);

    if (!companyCoords) {
      await initCompany({ silent: false });
      if (!companyCoords) return;
    }

    // ✅ “허용일 가능성”이 있는 입력이면 클릭 순간에 팝업을 미리 열어둠(차단 완화)
    //    (여기서 about:blank 같은 URL을 절대 쓰지 않음)
    const maybeInService = isServiceAreaByAddressName(q);
    const popup = maybeInService ? openLoadingPopup() : null;

    setBusy(true);
    try {
      const customer = await geocode(q);
      const areaText = (customer?.label || "") + " " + (customer?.raw || "");

      // ✅ 비허용: 팝업 닫고 connection.html로
      if (!customer || !isServiceAreaByAddressName(areaText)) {
        if (popup) popup.close();

        const outUrl =
          `${OUTSIDE_SERVICE_PAGE}?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&inService=0`;

        pushHistory(`지역(서비스외): ${q}`, outUrl);
        location.href = outUrl;
        return;
      }

      // ✅ 허용: 네이버 길찾기 URL
      const naverUrl = buildDirectionsUrl(
        { x: companyCoords.x, y: companyCoords.y, name: companyCoords.name },
        { x: customer.x, y: customer.y, name: customer.label }
      );

      // 1) 팝업이 있으면 그 창을 네이버맵으로 보내기
      if (popup) {
        try {
          popup.location.replace(naverUrl);
        } catch {
          // 조용히 막히는 브라우저 대비
        }
      }

      // 2) 팝업이 없거나/이동이 막힌 경우를 대비해 새창도 한 번 더 시도
      //    (막히면 w가 null)
      const w = window.open(naverUrl, "_blank", "noopener,noreferrer");

      // 3) 진짜로 다 막히면(새창도 null) → 현재 탭으로 네이버맵 이동(이건 무조건 됨)
      if (!w && !popup) {
        location.href = naverUrl;
        return;
      }

      pushHistory(`지역(서비스내): ${q}`, naverUrl);

      // ✅ 현재 페이지는 다음 단계로 이동
      const nextUrl =
        `${nextPage}?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&inService=1`;

      pushHistory(`다음단계 이동: ${q}`, nextUrl);
      location.href = nextUrl;
      return;

    } catch (e) {
      if (popup) popup.close();
      alert("처리 중 오류가 발생했어요.\n" + String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onSearch();
  });

  initCompany({ silent: true });
})();
