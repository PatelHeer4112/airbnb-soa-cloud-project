import { withPhotoAssets } from "./photos.js";

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message || "The request could not be completed.");
    this.status = status;
    this.code = error?.code;
    this.details = error?.details || [];
  }
}
export function createApi(
  base = "http://localhost:5000",
  fetcher = globalThis.fetch,
) {
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetcher(`${base.replace(/\/$/, "")}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        signal: options.signal || AbortSignal.timeout(15000),
      });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new ApiError(0, {
        message:
          "We could not reach the booking service. Please try again shortly.",
      });
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success)
      throw new ApiError(response.status, body.error);
    return { ...body, data: withPhotoAssets(body.data) };
  }
  const query = (params) =>
    new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    ).toString();
  return {
    listings: (page = 1, limit = 50, signal) =>
      request(`/api/listings?${query({ page, limit })}`, { signal }),
    createListing: (listing) =>
      request("/api/listings", {
        method: "POST",
        body: JSON.stringify(listing),
      }),
    search: (filters, signal) =>
      request(`/api/search?${query(filters)}`, { signal }),
    listing: (id) => request(`/api/listings/${encodeURIComponent(id)}`),
    ranges: (id) =>
      request(`/api/availability/${encodeURIComponent(id)}/bookings`),
    availability: (listingId, checkIn, checkOut) =>
      request(`/api/availability?${query({ listingId, checkIn, checkOut })}`),
    book: (booking) =>
      request("/api/bookings", {
        method: "POST",
        body: JSON.stringify(booking),
      }),
    booking: (id) => request(`/api/bookings/${encodeURIComponent(id)}`),
    cancel: (id) =>
      request(`/api/bookings/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ bookingStatus: "Cancelled" }),
      }),
  };
}
