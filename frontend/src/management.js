import { escapeHtml as e } from "./validation.js";
let accessCode = "";

export function managementPage(api, main, isCurrent) {
  let status = "Pending",
    page = 1,
    requestVersion = 0;
  const login = (error = "") => {
    requestVersion++;
    main.innerHTML = `<section class="lookup"><span class="eyebrow">BOOKING MANAGEMENT</span><h1>Review the<br>next chapter.</h1><p>Authorized project managers can review, confirm or decline booking requests. This is a single-manager demo, not a multi-host account system.</p><form id="manager-login"><label>Management access code<input name="code" type="password" autocomplete="off" minlength="32" maxlength="512" required></label><div id="manager-error" role="status">${e(error)}</div><button class="primary full">Open booking manager</button></form><p class="small">Use the private code configured on the backend or printed by your temporary demo backend. It stays in memory only and is cleared on sign-out or page reload.</p></section>`;
    main.querySelector("#manager-login").onsubmit = async (event) => {
      event.preventDefault();
      accessCode = new FormData(event.target).get("code").trim();
      event.target.querySelector("button").disabled = true;
      await load();
    };
  };
  const load = async () => {
    const version = ++requestVersion;
    try {
      const result = await api.managerBookings(accessCode, status, page);
      if (!isCurrent() || version !== requestVersion) return;
      const { data, meta } = result;
      main.innerHTML = `<section class="management-page content-width"><div class="management-heading"><div><span class="eyebrow">BOOKING MANAGEMENT</span><h1>Make their stay happen.</h1><p>${meta.total} ${status ? e(status.toLowerCase()) : "total"} ${meta.total === 1 ? "booking" : "bookings"}. Pending requests reserve their selected nights until confirmed or cancelled.</p></div><button class="secondary" id="manager-signout">Sign out</button></div><div class="management-filters"><label>Booking status<select id="manager-filter" aria-label="Booking status"><option value="Pending">Pending requests</option><option value="Confirmed">Confirmed stays</option><option value="Cancelled">Cancelled / declined</option><option value="">All bookings</option></select></label><button class="secondary" id="manager-reload">Refresh requests</button></div><div id="manager-action-error" tabindex="-1"></div><div class="management-list">${data.length ? data.map((b) => `<article class="management-card"><div><span class="status">${e(b.bookingStatus)}</span><h2>${e(b.listing?.title || "Listing unavailable")}</h2><p>${e(b.guestName)} &middot; ${e(b.guestEmail)}</p><p>${e(b.checkInDate)} &rarr; ${e(b.checkOutDate)} &middot; ${e(b.numberOfGuests)} guests &middot; ${e(b.numberOfNights)} nights</p><p>Total: <strong>${Number(b.totalPrice).toLocaleString()}</strong></p><p class="small">Reference: ${e(b._id)}</p></div><div class="management-actions"><a class="secondary" href="#/booking/${e(b._id)}">View booking</a>${b.bookingStatus === "Pending" ? `<button class="primary" data-decision="Confirmed" data-booking="${e(b._id)}">Accept request</button><button class="secondary" data-decision="Cancelled" data-booking="${e(b._id)}">Decline request</button>` : b.bookingStatus === "Confirmed" ? `<button class="secondary" data-decision="Cancelled" data-booking="${e(b._id)}">Cancel booking</button>` : ""}</div></article>`).join("") : '<div class="empty"><h2>No bookings in this view.</h2><p>Try another status or refresh after a guest submits a request.</p></div>'}</div><div class="pagination"><button class="secondary" id="manager-prev" ${page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${meta.totalPages ? meta.page : 0} of ${meta.totalPages}</span><button class="secondary" id="manager-next" ${page >= meta.totalPages ? "disabled" : ""}>Next</button></div><dialog id="manager-decision"><h2 id="decision-title"></h2><p>This changes the actual booking in the database. Declining or cancelling releases its reserved nights.</p><div class="confirmation-actions"><button class="secondary" id="decision-back">Go back</button><button class="primary" id="decision-confirm">Confirm decision</button></div></dialog></section>`;
      main.querySelector("#manager-filter").value = status;
      main.querySelector("#manager-filter").onchange = (event) => {
        status = event.target.value;
        page = 1;
        load();
      };
      main.querySelector("#manager-reload").onclick = () => load();
      main.querySelector("#manager-signout").onclick = () => {
        accessCode = "";
        login();
      };
      main.querySelector("#manager-prev").onclick = () => {
        page--;
        load();
      };
      main.querySelector("#manager-next").onclick = () => {
        page++;
        load();
      };
      const dialog = main.querySelector("#manager-decision");
      main.querySelector("#decision-back").onclick = () => dialog.close();
      main.querySelectorAll("[data-decision]").forEach(
        (button) =>
          (button.onclick = () => {
            main.querySelector("#decision-title").textContent =
              button.dataset.decision === "Confirmed"
                ? "Accept this request?"
                : "Decline or cancel this booking?";
            const confirm = main.querySelector("#decision-confirm");
            confirm.disabled = false;
            confirm.onclick = async () => {
              confirm.disabled = true;
              try {
                await api.managerStatus(
                  accessCode,
                  button.dataset.booking,
                  button.dataset.decision,
                );
                if (isCurrent()) {
                  dialog.close();
                  await load();
                }
              } catch (error) {
                if (isCurrent()) {
                  dialog.close();
                  const target = main.querySelector("#manager-action-error");
                  target.textContent = error.message;
                  target.className = "notice";
                  target.focus();
                }
                confirm.disabled = false;
              }
            };
            dialog.showModal();
          }),
      );
    } catch (error) {
      if (!isCurrent() || version !== requestVersion) return;
      if (error.status === 401) accessCode = "";
      login(error.message);
    }
  };
  if (accessCode) load();
  else login();
}
