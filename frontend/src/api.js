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
    const timeout = AbortSignal.timeout(15000);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
    let response;
    try {
      response = await fetcher(`${base.replace(/\/$/, "")}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        signal,
      });
      const body = await response.json().catch((error) => {
        if (signal.aborted) throw error;
        return {};
      });
      if (!response.ok || !body.success) {
        const error = new ApiError(response.status, body.error);
        const seconds = Number(response.headers?.get("Retry-After"));
        error.retryAfterMs =
          Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
        throw error;
      }
      return { ...body, data: withPhotoAssets(body.data) };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (options.signal?.aborted) throw options.signal.reason;
      if (signal.aborted && signal.reason?.name === "TimeoutError")
        throw new ApiError(0, {
          code: "REQUEST_TIMEOUT",
          message:
            "The booking service took too long to respond. Please try again.",
        });
      if (error.name === "AbortError") throw error;
      throw new ApiError(0, {
        message:
          "We could not reach the booking service. Please try again shortly.",
      });
    }
  }
  const query = (params) =>
    new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    ).toString();
  async function book(booking, key) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await request("/api/bookings", {
          method: "POST",
          headers: key ? { "Idempotency-Key": key } : {},
          body: JSON.stringify(booking),
        });
      } catch (error) {
        // Retrying a write is safe only with the SAME durable request key.
        if (
          !key ||
          attempt >= 2 ||
          ![0, 429, 502, 503, 504].includes(error.status) ||
          error.retryAfterMs > 3000
        )
          throw error;
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(
              error.retryAfterMs || 0,
              200 * 2 ** attempt + Math.random() * 100,
            ),
          ),
        );
      }
    }
  }
  return {
    managerBookings: (token, status = "Pending", page = 1) =>
      request(`/api/admin/bookings?${query({ status, page, limit: 10 })}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    managerStatus: (token, id, bookingStatus) =>
      request(`/api/admin/bookings/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingStatus }),
      }),
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
    book,
    booking: (id) => request(`/api/bookings/${encodeURIComponent(id)}`),
    cancel: (id) =>
      request(`/api/bookings/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ bookingStatus: "Cancelled" }),
      }),
  };
}
