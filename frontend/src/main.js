import './style.css';
import './traveltrove.css';
import { createApi } from './api.js';
import { today, nights, dateError, escapeHtml as e, imageUrl } from './validation.js';

const api = createApi(import.meta.env.VITE_API_URL || 'http://localhost:5000');
const main = document.querySelector('main');
const types = ['Apartment', 'House', 'Villa', 'Cabin', 'Cottage', 'Studio', 'Loft', 'Guesthouse'];
const symbols = ['▦', '⌂', '♧', '♤', '♧', '▣', '▱', '♧'];
let routeVersion = 0;
let pendingSection;
let searchController;
const price = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
// The API has no currency field. Show its numeric prices without inventing a currency.
const date = (value) => new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const img = (url, title, cls = '') => `<img class="${cls}" src="${e(imageUrl(url))}" alt="${e(title)}" loading="lazy" referrerpolicy="no-referrer">`;
const notice = (message) => `<div class="notice" role="alert">${e(message)}</div>`;
function showError(error, target) { target.innerHTML = notice(error.message) + (error.details?.some(d => d.field) ? `<ul class="field-errors">${error.details.filter(d => d.field).map(d => `<li>${e(d.message)}</li>`).join('')}</ul>` : ''); }
const input = (label, name, type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
const dateInputs = (start = '', end = '') => input('Check-in', 'checkIn', 'date', `min="${today()}" value="${e(start)}" required`) + input('Check-out', 'checkOut', 'date', `min="${today()}" value="${e(end)}" required`);
function loading() { main.innerHTML = '<div class="page-message" role="status"><span class="spinner"></span> Finding your next escape…</div>'; }

function home() {
  const filters = new URLSearchParams(location.hash.split('?')[1] || '');
  main.innerHTML = `<section class="hero"><div class="hero-copy"><span class="eyebrow">DISCOVER. DREAM. EXPLORE.</span><h1>Find your next <em>stay.</em></h1><p>A new city. A slower morning. A place that feels like you.<br>Make your next getaway a little more memorable.</p><a class="text-link" href="#stays" id="discover">Let the journey begin <span aria-hidden="true">&#8599;</span></a></div><div class="hero-footnote"><span>&#10023; A world of places to call home</span><span>YOUR NEXT CHAPTER STARTS HERE</span></div></section>
  <form id="search" class="search-bar" aria-label="Search accommodations">${input('Where to?', 'location', 'search', `placeholder="City, region, or country" value="${e(filters.get('location') || '')}"`)}${input('Check-in', 'checkIn', 'date', `min="${today()}" value="${e(filters.get('checkIn') || '')}"`)}${input('Check-out', 'checkOut', 'date', `min="${today()}" value="${e(filters.get('checkOut') || '')}"`)}${input('Who’s coming?', 'guests', 'number', `min="1" max="20" placeholder="Add guests" value="${e(filters.get('guests') || '')}"`)}<button class="primary" type="submit">Search stays <span aria-hidden="true">↗</span></button></form>
  <section id="getaways" class="destinations content-width"><div class="section-heading"><div><span class="eyebrow">A LITTLE INSPIRATION FOR YOUR NEXT TRIP</span><h2>Popular getaways</h2></div><p>Big city energy. Unforgettable little moments.</p></div><div class="destination-grid">${[
    ['London', 'United Kingdom', 'Destination6.png', 'A classic, with a new perspective'],
    ['Paris', 'France', 'Destination14.png', 'Slow mornings, timeless streets'],
    ['New York', 'United States', 'Destination15.png', 'A city made for your next chapter'],
  ].map(([city, country, photo, subtitle]) => `<button class="destination-card" type="button" data-destination="${city}"><img src="/images/${photo}" alt="${city}, ${country}" loading="lazy"><span class="destination-overlay"><small>${country}</small><strong>${city}</strong><span>${subtitle}</span></span><span class="destination-arrow" aria-hidden="true">&#8599;</span></button>`).join('')}</div></section>
  <section id="stays" class="collection"><div class="section-heading"><div><span class="eyebrow">A PLACE FOR EVERY KIND OF TRAVELLER</span><h2>Find a place to call your own.</h2></div><p>Your dates. Your people. Your perfect escape.</p></div><div class="category-row" role="group" aria-label="Property type"><button type="button" data-type="" class="category">✧ <span>All stays</span></button>${types.map((t,i) => `<button type="button" data-type="${t}" class="category">${symbols[i]} <span>${t}s</span></button>`).join('')}</div>
  <form id="filters" class="filters" aria-label="Filter accommodations">${input('Min. nightly price', 'minPrice', 'number', `min="0" placeholder="Any" value="${e(filters.get('minPrice') || '')}"`)}${input('Max. nightly price', 'maxPrice', 'number', `min="0" placeholder="Any" value="${e(filters.get('maxPrice') || '')}"`)}<label>Sort by<select name="sort"><option value="newest">Newest stays</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="rating_desc">Top rated</option></select></label><button class="secondary">Apply filters</button><button class="plain" type="button" id="reset">Clear all</button></form><div id="search-error"></div><div id="results" aria-live="polite"></div></section><section class="bottom-note"><div><span class="eyebrow">TRADE THE EVERYDAY FOR SOMETHING NEW</span><h2>Great getaways.<br>Even better memories.</h2><p>From a city hideaway to a quiet escape,<br>find a little space for your next adventure.</p><a class="primary" href="#stays">Find your next stay &#8599;</a></div></section><section class="about-travel content-width"><span class="eyebrow">THE WORLD IS WAITING</span><h2>About TravelTrove</h2><p>Inspired by the joy of discovering somewhere new. Explore holiday homes, find the little comforts you love, and send a booking request in just a few steps. Whether you are chasing city lights or a quieter pace, your next chapter starts with a place to stay.</p><a class="text-link" href="#/booking">Already planning a trip? Find your booking &#8599;</a></section>`;
  document.querySelector('#discover').onclick = (event) => { event.preventDefault(); document.querySelector('#stays').scrollIntoView({ behavior: 'smooth' }); };
  document.querySelector('.bottom-note a').onclick = document.querySelector('#discover').onclick;
  document.querySelector('[name="sort"]').value = filters.get('sort') || 'newest';
  let propertyType = filters.get('propertyType') || '';
  const update = () => {
    const values = { ...Object.fromEntries(new FormData(document.querySelector('#search'))), ...Object.fromEntries(new FormData(document.querySelector('#filters'))), propertyType };
    const message = (values.checkIn || values.checkOut) ? dateError(values.checkIn, values.checkOut) : '';
    const error = message || (values.minPrice && values.maxPrice && Number(values.minPrice) > Number(values.maxPrice) ? 'Minimum price cannot exceed maximum price.' : '');
    document.querySelector('#search-error').innerHTML = error ? notice(error) : '';
    if (error) return;
    const query = new URLSearchParams(Object.entries(values).filter(([,v]) => v !== '')).toString();
    history.replaceState(null, '', `#/?${query}`);
    loadResults(values, 1);
  };
  for (const form of document.querySelectorAll('#search, #filters')) form.onsubmit = (event) => { event.preventDefault(); update(); };
  const categories = [...document.querySelectorAll('[data-type]')];
  const mark = () => categories.forEach(b => { b.classList.toggle('active', b.dataset.type === propertyType); b.setAttribute('aria-pressed', String(b.dataset.type === propertyType)); });
  mark();
  categories.forEach(b => b.onclick = () => { propertyType = b.dataset.type; mark(); update(); });
  document.querySelectorAll('[data-destination]').forEach(button => button.onclick = () => { document.querySelector('#search [name="location"]').value = button.dataset.destination; update(); document.querySelector('#stays').scrollIntoView({ behavior: 'smooth' }); });
  document.querySelector('#reset').onclick = () => { history.replaceState(null, '', '#/'); home(); };
  loadResults(Object.fromEntries(filters), Number(filters.get('page')) || 1);
}

async function loadResults(filters, page) {
  searchController?.abort(); searchController = new AbortController();
  const target = document.querySelector('#results');
  target.innerHTML = `<div class="results-heading"><p role="status">Looking for lovely places…</p></div><div class="grid">${Array.from({ length: 8 }, () => '<div class="skeleton"><div></div><p></p><p></p></div>').join('')}</div>`;
  try {
    const { data, meta } = await api.search({ ...filters, page, limit: 8 }, searchController.signal);
    if (!target.isConnected) return;
    target.innerHTML = `<div class="results-heading"><p><strong>${meta.total}</strong> places to make yourself at home</p><span>Thoughtful spaces. Memorable stays.</span></div>` + (data.length ? `<div class="grid">${data.map(l => `<article class="stay-card"><a href="#/listing/${e(l._id)}"><div class="card-image">${img(l.imageUrls?.[0], l.title)}<span class="type-pill">${e(l.propertyType)}</span></div><div class="card-location"><strong>${e(l.city)}, ${e(l.country)}</strong><span>★ ${e(l.rating)}</span></div><h3>${e(l.title)}</h3><p>${e(l.maxGuests)} guests · ${e(l.bedrooms)} bedrooms</p><div class="card-price"><strong>${price(l.pricePerNight)}</strong> <span>/ night</span><span class="card-arrow">↗</span></div></a></article>`).join('')}</div><div class="pagination"><button class="secondary" id="prev" ${page <= 1 ? 'disabled' : ''}>← Previous</button><span>Page ${meta.page} of ${meta.totalPages}</span><button class="secondary" id="next" ${page >= meta.totalPages ? 'disabled' : ''}>Next →</button></div><p class="price-note">Prices are shown as supplied by the property. Currency is not specified by the booking service.</p>` : '<div class="empty"><span>⌂</span><h3>No stays found. A fresh start?</h3><p>Try another destination, wider dates, or fewer filters.</p><button class="secondary" id="empty-reset">Clear filters</button></div>');
    const go = (p) => { const params = new URLSearchParams(location.hash.split('?')[1]); params.set('page', p); history.replaceState(null, '', `#/?${params}`); loadResults(filters, p); document.querySelector('#stays').scrollIntoView(); };
    document.querySelector('#prev')?.addEventListener('click', () => go(page - 1)); document.querySelector('#next')?.addEventListener('click', () => go(page + 1));
    document.querySelector('#empty-reset')?.addEventListener('click', () => document.querySelector('#reset').click());
  } catch (error) { if (error.name === 'AbortError' || !target.isConnected) return; showError(error, target); const b = document.createElement('button'); b.className = 'secondary'; b.textContent = 'Try again'; b.onclick = () => loadResults(filters, page); target.append(b); }
}

async function listing(id, version) {
  const { data: l } = await api.listing(id);
  if (version !== routeVersion) return;
  const params = new URLSearchParams(sessionStorage.getItem('stay-search') || '');
  main.innerHTML = `<section class="detail"><a class="text-link" href="#/">← Back to all stays</a><div class="detail-heading"><span class="eyebrow">YOUR NEXT CHANGE OF SCENERY</span><h1>${e(l.title)}</h1><p>★ ${e(l.rating)} · ${e(l.location)}, ${e(l.city)}, ${e(l.country)}</p></div><div class="gallery">${(l.imageUrls?.length ? l.imageUrls : ['']).slice(0, 2).map(url => img(url, l.title)).join('')}</div><div class="detail-layout"><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>${e(l.propertyType)} in ${e(l.city)}</h2><p class="facts">${e(l.maxGuests)} guests <span>·</span> ${e(l.bedrooms)} bedrooms <span>·</span> ${e(l.bathrooms)} bathrooms</p><hr><h3>A little about this place</h3><p class="description">${e(l.description)}</p><hr><h3>The little comforts</h3><ul class="amenities">${(l.amenities || []).map(a => `<li>✓ ${e(a)}</li>`).join('')}</ul><hr><h3>Plan your dates</h3><p>Stays can be up to 30 nights. A previous guest’s check-out day is available for a new check-in.</p><div id="booked-ranges" aria-live="polite">Loading reserved dates…</div></div><aside class="booking-panel"><div class="panel-price"><strong>${price(l.pricePerNight)}</strong> / night</div><p>Your somewhere is waiting.</p><form id="reserve"> <div class="two-col">${dateInputs(params.get('checkIn') || '', params.get('checkOut') || '')}</div>${input('Guests', 'numberOfGuests', 'number', `value="${e(params.get('guests') || 1)}" min="1" max="${l.maxGuests}" required`)}<button class="secondary full" type="button" id="check">Check availability</button><div id="availability" aria-live="polite"></div><hr>${input('Full name', 'guestName', 'text', 'autocomplete="name" minlength="2" maxlength="100" required placeholder="Your full name"')}${input('Email address', 'guestEmail', 'email', 'autocomplete="email" maxlength="254" required placeholder="you@example.com"')}<div id="estimate" class="estimate"></div><div id="booking-error" tabindex="-1"></div><button class="primary full" id="reserve-button">Request to book ↗</button><p class="small">No payment is collected. Your request is saved with a Pending status.</p></form></aside></div></section>`;
  api.ranges(id).then(({data}) => { if (version === routeVersion) document.querySelector('#booked-ranges').innerHTML = data.bookedRanges.length ? `<ul class="ranges">${data.bookedRanges.map(r => `<li>${date(r.checkInDate)} → ${date(r.checkOutDate)} <span>${e(r.bookingStatus)}</span></li>`).join('')}</ul>` : '<p class="success">No upcoming reservations yet.</p>'; }).catch(error => { if (version === routeVersion) showError(error, document.querySelector('#booked-ranges')); });
  const form = document.querySelector('#reserve');
  let checking = false;
  const values = () => Object.fromEntries(new FormData(form));
  form.oninput = () => { const v = values(); document.querySelector('#availability').textContent = ''; const n = nights(v.checkIn, v.checkOut); document.querySelector('#estimate').textContent = !dateError(v.checkIn, v.checkOut) ? `${price(l.pricePerNight)} × ${n} nights = ${price(n * l.pricePerNight)} estimated total` : ''; };
  document.querySelector('#check').onclick = async () => {
    if (checking) return;
    const v = values(); const target = document.querySelector('#availability'); const error = dateError(v.checkIn, v.checkOut);
    if (error) { target.innerHTML = notice(error); return; }
    checking = true; const button = document.querySelector('#check'); button.disabled = true; target.textContent = 'Checking your dates…';
    try { const { data } = await api.availability(id, v.checkIn, v.checkOut); const current = values(); if (current.checkIn !== v.checkIn || current.checkOut !== v.checkOut) return; target.innerHTML = data.available ? '<p class="success">✓ These dates are available.</p>' : notice('These dates are already reserved. Please choose another stay.'); }
    catch (err) { showError(err, target); } finally { checking = false; button.disabled = false; }
  };
  form.onsubmit = async (event) => {
    event.preventDefault(); const v = values(); const target = document.querySelector('#booking-error'); const error = dateError(v.checkIn, v.checkOut);
    if (error) { target.innerHTML = notice(error); target.focus(); return; }
    const button = document.querySelector('#reserve-button'); button.disabled = true; button.textContent = 'Sending your request…'; target.innerHTML = '';
    try { const { data } = await api.book({ listingId: id, guestName: v.guestName.trim(), guestEmail: v.guestEmail.trim(), numberOfGuests: Number(v.numberOfGuests), checkInDate: v.checkIn, checkOutDate: v.checkOut }); if (version === routeVersion) location.hash = `/booking/${data._id}`; }
    catch (err) { showError(err, target); target.focus(); } finally { button.disabled = false; button.textContent = 'Request to book ↗'; }
  };
}

function lookup() {
  main.innerHTML = `<section class="lookup"><span class="eyebrow">YOUR NEXT CHAPTER</span><h1>A stay to look<br><em>forward to.</em></h1><p>Enter the booking reference from your request to view its details.</p><form id="lookup">${input('Booking reference', 'reference', 'text', 'required pattern="[a-fA-F0-9]{24}" title="Enter the 24-character booking reference" placeholder="Your 24-character reference"')}<button class="primary full">Find my booking ↗</button></form></section>`;
  document.querySelector('#lookup').onsubmit = (event) => { event.preventDefault(); location.hash = `/booking/${new FormData(event.target).get('reference').trim()}`; };
}
async function booking(id, version) {
  const { data: b } = await api.booking(id);
  if (version !== routeVersion) return;
  main.innerHTML = `<section class="confirmation"><div class="confirmation-icon">${b.bookingStatus === 'Cancelled' ? '−' : '✓'}</div><span class="eyebrow">${b.bookingStatus === 'Cancelled' ? 'BOOKING CANCELLED' : 'YOUR REQUEST IS SAVED'}</span><h1>${b.bookingStatus === 'Cancelled' ? 'Until next time.' : 'A good stay starts here.'}</h1><p>${b.bookingStatus === 'Pending' ? 'Your booking is pending confirmation. No payment has been collected.' : b.bookingStatus === 'Confirmed' ? 'Your booking has been confirmed.' : 'These dates have been released.'}</p><div class="confirmation-card">${img(b.listing?.imageUrls?.[0], b.listing?.title || 'Your stay')}<div><span class="status">${e(b.bookingStatus)}</span><h2>${e(b.listing?.title || 'Your stay')}</h2><p>${e(b.listing?.city)}, ${e(b.listing?.country)}</p><dl><div><dt>Check-in</dt><dd>${date(b.checkInDate)}</dd></div><div><dt>Check-out</dt><dd>${date(b.checkOutDate)}</dd></div><div><dt>Guests</dt><dd>${e(b.numberOfGuests)}</dd></div><div><dt>Total · ${e(b.numberOfNights)} nights</dt><dd>${price(b.totalPrice)}</dd></div></dl><p>Guest: ${e(b.guestName)} · ${e(b.guestEmail)}</p><label>Save your booking reference<input readonly aria-label="Booking reference" value="${e(b._id)}"></label><p class="small">Save this page’s URL or reference to revisit your booking.</p></div></div><div id="cancel-error"></div><div class="confirmation-actions"><a class="primary" href="#/">Explore more stays ↗</a>${b.bookingStatus !== 'Cancelled' ? '<button class="plain" id="cancel">Cancel this booking</button>' : ''}</div><dialog id="cancel-dialog"><h2>Cancel your stay?</h2><p>Your reserved dates will be released.</p><div class="confirmation-actions"><button class="secondary" id="keep">Keep booking</button><button class="primary" id="confirm-cancel">Yes, cancel booking</button></div></dialog></section>`;
  const dialog = document.querySelector('#cancel-dialog');
  document.querySelector('#cancel')?.addEventListener('click', () => dialog.showModal());
  document.querySelector('#keep').onclick = () => dialog.close();
  document.querySelector('#confirm-cancel').onclick = async (event) => { event.target.disabled = true; try { await api.cancel(id); dialog.close(); await booking(id, version); } catch (error) { dialog.close(); showError(error, document.querySelector('#cancel-error')); event.target.disabled = false; } };
}

async function route() {
  const previous = document.querySelector('#search');
  if (previous) sessionStorage.setItem('stay-search', new URLSearchParams(new FormData(previous)).toString());
  const version = ++routeVersion;
  document.body.classList.toggle('home-page', !location.hash.slice(1).split('?')[0] || location.hash.slice(1).split('?')[0] === '/');
  closeMenu(); searchController?.abort(); loading(); window.scrollTo(0, 0);
  const [path] = location.hash.slice(1).split('?');
  try {
    if (!path || path === '/') { home(); if (pendingSection) { document.getElementById(pendingSection)?.scrollIntoView(); pendingSection = null; } }
    else if (path.startsWith('/listing/')) await listing(path.split('/')[2], version);
    else if (path.startsWith('/booking/')) await booking(path.split('/')[2], version);
    else if (path === '/booking') lookup();
    else main.innerHTML = '<div class="page-message"><h1>This page wandered off.</h1><a href="#/">Back to all stays</a></div>';
  } catch (error) { if (version === routeVersion) { main.innerHTML = `<section class="page-message"><h1>We couldn’t find your stay.</h1>${notice(error.message)}<a class="secondary" href="#/">Back to all stays</a></section>`; } }
}
function closeMenu() { document.querySelector('header').classList.remove('menu-open'); document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false'); document.querySelector('.menu-toggle').setAttribute('aria-label', 'Open navigation'); }
document.querySelector('.menu-toggle').onclick = () => { const open = document.querySelector('header').classList.toggle('menu-open'); document.querySelector('.menu-toggle').setAttribute('aria-expanded', String(open)); document.querySelector('.menu-toggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); };
document.querySelector('nav').addEventListener('click', event => { const link = event.target.closest('a'); if (!link) return; closeMenu(); if (link.dataset.section) { event.preventDefault(); const section = document.getElementById(link.dataset.section); if (section) section.scrollIntoView({ behavior: 'smooth' }); else { pendingSection = link.dataset.section; location.hash = '/'; } } });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
window.addEventListener('hashchange', route);
document.addEventListener('error', event => { if (event.target instanceof HTMLImageElement) { event.target.classList.add('image-unavailable'); event.target.alt = 'Property photo unavailable'; event.target.removeAttribute('src'); } }, true);
route();
