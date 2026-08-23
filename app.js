/* =========================================================
   app.js - 포항초곡 호반써밋 방문예약 사이트 로직
   ========================================================= */

(function () {
  "use strict";

  // ---------- 공통 유틸 ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // 세대정보 시트의 금액은 "천원" 단위로 입력되어 있으므로(예: 263000 = 2억6300만원)
  // 화면에는 1,000을 곱해 "원" 단위 실제 금액으로 환산해서 보여준다.
  function won(n) {
    if (n === null || n === undefined || n === "") return "-";
    const num = Number(n);
    if (Number.isNaN(num)) return String(n);
    return (num * 1000).toLocaleString("ko-KR") + "원";
  }

  function onlyDigits(str) {
    return (str || "").replace(/[^0-9]/g, "");
  }

  const DOW_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

  function parseDate(dateStr) {
    // 문자열을 직접 파싱 + UTC 기준 요일 계산으로 브라우저 타임존에 영향받지 않도록 처리
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return { y, m, d, dow, dowName: DOW_NAMES[dow] };
  }

  function formatDateLabel(dateStr) {
    const { m, d, dowName } = parseDate(dateStr);
    return `${m}.${d}(${dowName})`;
  }

  function formatDateTimeFull(dateStr, timeStr) {
    const { y, m, d, dowName } = parseDate(dateStr);
    return `${y}년 ${m}월 ${d}일, (${dowName}) ${timeStr}`;
  }

  function isApiConfigured() {
    return typeof GAS_API_URL === "string" &&
      GAS_API_URL.indexOf("http") === 0;
  }

  function showToast(msg, isError) {
    const toast = $("#toast");
    if (!toast) { alert(msg); return; }
    toast.textContent = msg;
    toast.className = "toast show" + (isError ? " error" : "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.className = "toast"; }, 3200);
  }

  // ---------- API 통신 ----------
  async function apiGet(params) {
    if (!isApiConfigured()) {
      throw new Error("CONFIG_MISSING");
    }
    const url = new URL(GAS_API_URL);
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error("NETWORK_ERROR");
    return res.json();
  }

  async function apiPost(body) {
    if (!isApiConfigured()) {
      throw new Error("CONFIG_MISSING");
    }
    // text/plain 으로 보내 CORS preflight(OPTIONS)를 피함 - Apps Script doPost에서 JSON.parse 처리
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("NETWORK_ERROR");
    return res.json();
  }

  function handleApiError(err) {
    if (err && err.message === "CONFIG_MISSING") {
      showToast("관리자 설정이 완료되지 않았습니다. (config.js 의 GAS_API_URL을 확인해주세요)", true);
    } else {
      showToast("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", true);
    }
    console.error(err);
  }

  // ---------- 방문자 IP / 통계 (관리자용 로그) ----------
  let clientIP = "";

  async function fetchClientIP() {
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      if (!res.ok) return;
      const data = await res.json();
      clientIP = data.ip || "";
    } catch (err) {
      // IP 조회 실패는 핵심 기능에 영향 없어야 하므로 조용히 무시
      clientIP = "";
    }
  }

  async function logVisit() {
    try {
      if (!isApiConfigured()) return;
      await apiPost({ action: "logVisit", ip: clientIP, page: location.pathname });
    } catch (err) {
      // 방문 로그는 부가 기능이므로 실패해도 사용자에게 알리지 않음
      console.error(err);
    }
  }

  async function initVisitTracking() {
    await fetchClientIP();
    logVisit();
  }

  // ---------- 탭 전환 ----------
  function initTabs() {
    const tabs = $$(".tab-btn");
    tabs.forEach(btn => {
      btn.addEventListener("click", () => {
        tabs.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        $$(".tab-panel").forEach(p => p.classList.remove("active"));
        const target = $("#" + btn.dataset.tab);
        if (target) target.classList.add("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  // ---------- 안내문 탭 렌더 ----------
  function renderNotice() {
    $("#pageTitle").textContent = SITE_INFO.pageTitle;
    $("#noticeTarget").textContent = SITE_INFO.target;
    $("#noticeResMethod").textContent = SITE_INFO.resMethod;
    $("#noticeReservationPeriod").textContent = SITE_INFO.reservationPeriod;
    $("#noticeContractPeriod").textContent = SITE_INFO.contractPeriod;
    $("#noticeContractTime").textContent = SITE_INFO.contractTime;
    $("#noticeContractPlace").textContent = SITE_INFO.contractPlace;

    const pdfLink = $("#noticePdfLink");
    if (pdfLink && typeof NOTICE_PDF_URL === "string") {
      pdfLink.href = NOTICE_PDF_URL;
    }
  }

  // ---------- 분양금액 확인 ----------
  let lastVerifiedUnit = null; // { dong, ho, name, phone4 } 방문예약 탭에서 재사용

  function initLookup() {
    const form = $("#lookupForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dong = onlyDigits($("#lookupDong").value);
      const ho = onlyDigits($("#lookupHo").value);
      const name = $("#lookupName").value.trim();
      const phone4 = onlyDigits($("#lookupPhone4").value);

      if (!dong || !ho || !name || phone4.length !== 4) {
        showToast("동, 호, 계약자 성명, 휴대폰 뒷자리 4자리를 정확히 입력해주세요.", true);
        return;
      }

      const resultBox = $("#lookupResult");
      const btn = $("#lookupSubmitBtn");
      btn.disabled = true; btn.textContent = "조회중...";
      resultBox.classList.remove("show", "error");

      try {
        const res = await apiGet({ action: "unitLookup", dong, ho, name, phone4, ip: clientIP });
        if (res.ok && res.data) {
          lastVerifiedUnit = { dong, ho, name, phone4 };
          renderLookupResult(res.data, dong, ho);
          resultBox.classList.add("show");
          // 방문예약 탭 상단의 확인정보도 자동 채움
          fillReservationIdentity(dong, ho, name, phone4);
        } else {
          resultBox.classList.add("show", "error");
          resultBox.innerHTML = `<p class="error-msg">일치하는 정보를 찾을 수 없습니다. 동/호/성명/휴대폰 뒷자리를 다시 확인해주세요.</p>`;
        }
      } catch (err) {
        handleApiError(err);
      } finally {
        btn.disabled = false; btn.textContent = "조회하기";
      }
    });
  }

  function renderLookupResult(data, dong, ho) {
    const resultBox = $("#lookupResult");
    resultBox.innerHTML = `
      <h3>${dong}동 ${ho}호 <span class="badge">${data.type || ""}</span></h3>
      <table class="price-table">
        <tbody>
          <tr><th>매매금액</th><td>${won(data.sale)}</td></tr>
          <tr><th>임대보증금</th><td>${won(data.deposit)}</td></tr>
          <tr><th>계약금(계약시)</th><td>${won(data.downAtContract)}</td></tr>
          <tr><th>계약금(계약+3月)</th><td>${won(data.downAt3M)}</td></tr>
          <tr><th>잔금</th><td>${won(data.balance)}</td></tr>
          <tr class="total-row"><th>소계</th><td>${won(data.subtotal)}</td></tr>
        </tbody>
      </table>
      <p class="hint">* 잔금은 2027년 12월 예정입니다. 정확한 금액은 계약체결시 별도 안내되는 세대별 가상계좌로 반드시 동호수를 확인 후 입금해 주세요.</p>
      <button type="button" class="btn primary block" id="goToReserveBtn">이 세대로 방문예약 하기</button>
    `;
    $("#goToReserveBtn").addEventListener("click", () => {
      $('.tab-btn[data-tab="tab-reserve"]').click();
    });
  }

  // ---------- 방문예약 ----------
  let selectedDate = null;
  let selectedTime = null;

  function fillReservationIdentity(dong, ho, name, phone4) {
    $("#resDong").value = dong;
    $("#resHo").value = ho;
    $("#resName").value = name;
    $("#resPhone4").value = phone4;
  }

  function initReserveDates() {
    const wrap = $("#dateList");
    wrap.innerHTML = "";
    VISIT_DATES.forEach(date => {
      const { m, d, dowName } = parseDate(date);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "date-chip";
      btn.innerHTML = `<span class="date-chip-day">${m}.${d}</span><span class="date-chip-dow">${dowName}</span>`;
      btn.dataset.date = date;
      btn.addEventListener("click", () => selectDate(date, btn));
      wrap.appendChild(btn);
    });
  }

  async function selectDate(date, btnEl) {
    selectedDate = date;
    selectedTime = null;
    $$(".date-chip", $("#dateList")).forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");

    const slotWrap = $("#slotList");
    slotWrap.innerHTML = `<p class="hint">불러오는 중...</p>`;
    $("#slotSection").classList.add("show");
    $("#reserveDetailSection").classList.remove("show");

    try {
      const res = await apiGet({ action: "slots", date });
      renderSlots(res.ok ? res.data : []);
    } catch (err) {
      // 설정이 안 되어 있거나 네트워크 오류 시에도 슬롯 UI 자체는 보여주되 정원정보 없이 표시
      renderSlots(TIME_SLOTS.map(t => ({ time: t, count: 0 })));
      if (err.message !== "CONFIG_MISSING") handleApiError(err);
    }
  }

  function renderSlots(slotData) {
    const dataMap = {};
    (slotData || []).forEach(s => { dataMap[s.time] = s.count; });

    const wrap = $("#slotList");
    wrap.innerHTML = "";
    TIME_SLOTS.forEach(time => {
      const count = dataMap[time] || 0;
      const full = count >= CAPACITY_PER_SLOT;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-chip" + (full ? " full" : "");
      btn.disabled = full;
      btn.innerHTML = `${time}<span class="slot-count">${full ? "예약마감" : "예약가능"}</span>`;
      btn.addEventListener("click", () => selectSlot(time, btn));
      wrap.appendChild(btn);
    });
  }

  function selectSlot(time, btnEl) {
    selectedTime = time;
    $$(".slot-chip", $("#slotList")).forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
    $("#reserveDetailSection").classList.add("show");
    $("#selectedDateTimeLabel").textContent = `${formatDateLabel(selectedDate)} ${selectedTime}`;
  }

  function initReserveForm() {
    initReserveDates();
    const form = $("#reserveForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dong = onlyDigits($("#resDong").value);
      const ho = onlyDigits($("#resHo").value);
      const name = $("#resName").value.trim();
      const phone4 = onlyDigits($("#resPhone4").value);
      const phone = onlyDigits($("#resPhoneFull").value);

      if (!dong || !ho || !name || phone4.length !== 4) {
        showToast("동, 호, 계약자 성명, 휴대폰 뒷자리 4자리를 입력해주세요. (분양금액 확인 탭에서 먼저 확인 가능)", true);
        return;
      }
      if (!selectedDate || !selectedTime) {
        showToast("방문 일자와 시간을 선택해주세요.", true);
        return;
      }
      if (phone.length < 10) {
        showToast("연락처를 정확히 입력해주세요.", true);
        return;
      }

      const btn = $("#reserveSubmitBtn");
      btn.disabled = true; btn.textContent = "예약 처리중...";

      try {
        const res = await apiPost({
          action: "reserve",
          dong, ho, phone4, name, phone,
          date: selectedDate, time: selectedTime,
          ip: clientIP
        });
        if (res.ok) {
          showToast(`예약이 완료되었습니다! (예약번호: ${res.data.reservationId})`);
          form.reset();
          $("#reserveDetailSection").classList.remove("show");
          selectedDate = null; selectedTime = null;
          $$(".date-chip", $("#dateList")).forEach(b => b.classList.remove("active"));
          $("#slotSection").classList.remove("show");
        } else {
          showToast(res.message || "이미 마감되었거나 예약할 수 없는 시간입니다. 다른 시간을 선택해주세요.", true);
          // 정원마감 등의 사유일 수 있으므로 슬롯 갱신
          if (selectedDate) selectDate(selectedDate, $(`.date-chip[data-date="${selectedDate}"]`));
        }
      } catch (err) {
        handleApiError(err);
      } finally {
        btn.disabled = false; btn.textContent = "예약 확정하기";
      }
    });
  }

  // ---------- 예약조회/취소 ----------
  function initMyReservation() {
    const form = $("#myResForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dong = onlyDigits($("#myDong").value);
      const ho = onlyDigits($("#myHo").value);
      const name = $("#myName").value.trim();
      const phone4 = onlyDigits($("#myPhone4").value);
      if (!dong || !ho || !name || phone4.length !== 4) {
        showToast("동, 호, 계약자 성명, 휴대폰 뒷자리 4자리를 정확히 입력해주세요.", true);
        return;
      }
      const btn = $("#myResSubmitBtn");
      btn.disabled = true; btn.textContent = "조회중...";
      try {
        const res = await apiGet({ action: "myReservations", dong, ho, name, phone4 });
        renderMyReservations(res.ok ? res.data : [], { dong, ho, name, phone4 });
      } catch (err) {
        handleApiError(err);
      } finally {
        btn.disabled = false; btn.textContent = "예약 조회";
      }
    });
  }

  function renderMyReservations(list, identity) {
    const wrap = $("#myResResult");
    wrap.classList.add("show");
    if (!list || list.length === 0) {
      wrap.innerHTML = `<p class="hint">예약 내역이 없습니다.</p>`;
      return;
    }
    wrap.innerHTML = list.map(r => `
      <div class="res-card ${r.status === "취소" ? "cancelled" : ""}">
        <div class="res-card-row">
          <strong>${formatDateTimeFull(r.date, r.time)}</strong>
          <span class="status ${r.status === "취소" ? "status-cancel" : "status-ok"}">${r.status}</span>
        </div>
        <div class="res-card-row muted">예약번호 ${r.reservationId} · ${r.name}</div>
        ${r.status !== "취소" ? `<button type="button" class="btn danger small" data-id="${r.reservationId}">예약 취소</button>` : ""}
      </div>
    `).join("");

    $$(".btn.danger.small", wrap).forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("예약을 취소하시겠습니까?")) return;
        btn.disabled = true;
        try {
          const res = await apiPost({ action: "cancel", reservationId: btn.dataset.id, ...identity });
          if (res.ok) {
            showToast("예약이 취소되었습니다.");
            $("#myResForm").requestSubmit();
          } else {
            showToast(res.message || "취소에 실패했습니다.", true);
            btn.disabled = false;
          }
        } catch (err) {
          handleApiError(err);
          btn.disabled = false;
        }
      });
    });
  }

  // ---------- 초기화 ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (!isApiConfigured()) {
      const banner = $("#configWarning");
      if (banner) banner.classList.add("show");
    }
    initTabs();
    renderNotice();
    initLookup();
    initReserveForm();
    initMyReservation();
    initVisitTracking();
  });
})();
