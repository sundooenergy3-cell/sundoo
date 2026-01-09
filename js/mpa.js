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

  // ✅ [다음으로] 버튼
  const nextBtn = document.getElementById("nextBtn");
  // ✅ [이전으로] 버튼
  const prevBtn = document.getElementById("prevBtn");

  // 폼이 없는 페이지면 종료 (안전)
  if (!form || !input) return;

  // ✅ 타입 읽기 (index.html에서 maps.html?type=xxx 로 넘어옴)
  function getType() {
    return (
      new URLSearchParams(window.location.search).get("type") ||
      localStorage.getItem("consult_type") ||
      ""
    );
  }

  // ✅ 타입별 "다음 단계" 페이지 매핑
  const NEXT_PAGE_BY_TYPE = {
    boiler:  "installation_boiler.html",
    gas:     "installation_gas.html",
    dryer:   "installation_dryer.html",
    elec:    "installation_elec.html",
    builtin: "installation_builtin.html",
    sash:    "installation_sash.html",
  };

  // ✅ 기본 fallback (타입이 없거나 매핑이 없을 때)
  const DEFAULT_NEXT_PAGE = "installation_gas2.html";

  function getNextPageByType(type) {
    return NEXT_PAGE_BY_TYPE[type] || DEFAULT_NEXT_PAGE;
  }

  // ✅ 비허용지역(서비스 외)일 때 이동할 HTML (여기만 바꾸면 됨!)
  const OUTSIDE_SERVICE_PAGE = "connection.html";

  // ✅ (선택) 다음으로 눌렀을 때 히스토리에 남기고 싶으면 true
  const SAVE_NEXT_TO_HISTORY = true;

  // ✅ 회사 주소 고정
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

    // ✅ 카카오 API 에러 처리
    if (!res.ok) {
      const msg = data?.message || data?.error || "API error";
      throw new Error(`KAKAOMAP_ERROR: ${msg}`);
    }

    // ✅ x/y를 '숫자'로 안전하게 검증
    const x = Number(data?.x);
    const y = Number(data?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    // ✅ label(=address_name) 말고도, 입력값(q)도 같이 들고 있어 판별에 활용 가능
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

  // ✅ 히스토리에 남기는 헬퍼
  function pushHistory(label, url) {
    const STORAGE_KEY = "sundoo_selection_history";
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      arr.push({ label, url, ts: Date.now() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-30)));
    } catch {
      // localStorage 문제 있어도 동작은 계속
    }
  }

  // ✅ [이전으로] 클릭
  if (prevBtn) {
    prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = "index2.html";
    });
  }

  // ✅ [다음으로] 클릭 시 - 지도검색 안 하고 다음단계로 이동 (type별 분기)
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

  // ✅ 검색(엔터/버튼) 시:
  // - 허용지역: 네이버맵 새창 + 현재 페이지는 nextPage로 이동
  // - 비허용지역: 네이버맵 X + 현재 페이지는 OUTSIDE_SERVICE_PAGE로 이동
  async function onSearch() {
    const q = normalize(input.value);
    if (!q) return alert("고객 주소(지역/주소)를 입력해주세요.");

    const type = getType();
    if (type) localStorage.setItem("consult_type", type);

    const nextPage = getNextPageByType(type);

    // 🔧 변경: about:blank를 미리 열지 않음 (이게 핵심)
    // const popup = window.open("about:blank", "_blank", "noopener,noreferrer");

    // 회사 좌표 없으면 검색 시점에 다시 시도 + 이때만 안내
    if (!companyCoords) {
      await initCompany({ silent: false });
      if (!companyCoords) return;
    }

    setBusy(true);
    try {
      const customer = await geocode(q);

      const areaText = (customer?.label || "") + " " + (customer?.raw || "");

      // ✅ 비허용지역(또는 지오코딩 실패): 네이버맵 안띄움 + OUTSIDE_SERVICE_PAGE로 이동
      if (!customer || !isServiceAreaByAddressName(areaText)) {
        const outUrl =
          `${OUTSIDE_SERVICE_PAGE}?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&inService=0`;

        pushHistory(`지역(서비스외): ${q}`, outUrl);
        location.href = outUrl;
        return;
      }

      // ✅ 허용지역: 네이버 길찾기 열기 + nextPage로 이동
      const naverUrl = buildDirectionsUrl(
        { x: companyCoords.x, y: companyCoords.y, name: companyCoords.name },
        { x: customer.x, y: customer.y, name: customer.label }
      );

      // 🔧 변경: 최종 URL이 만들어진 다음에 "직접" 새창 오픈
      window.open(naverUrl, "_blank");

      pushHistory(`지역(서비스내): ${q}`, naverUrl);

      const nextUrl =
        `${nextPage}?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&inService=1`;

      pushHistory(`다음단계 이동: ${q}`, nextUrl);

      location.href = nextUrl;
      return;

    } catch (e) {
      const msg = String(e?.message || e);
      alert("처리 중 오류가 발생했어요.\n" + msg);
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onSearch();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearch();
    }
  });

  // ✅ 페이지 로드시 회사 좌표 선계산 (로드 시엔 팝업 띄우지 않음)
  initCompany({ silent: true });
})();
