package com.velosyntech.cumped.common;

import org.springframework.http.HttpStatus;

/** Eroare controlată: doar un cod stabil ajunge la client, niciodată detalii interne. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    /** Pentru 429: peste câte secunde se poate reîncerca (trimis în antetul Retry-After). */
    private final long retryAfterSeconds;

    public ApiException(HttpStatus status, String code) { this(status, code, 0); }

    public ApiException(HttpStatus status, String code, long retryAfterSeconds) {
        super(code, null, false, false);
        this.status = status;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public long retryAfterSeconds() { return retryAfterSeconds; }

    public static ApiException tooManyRequests(String code, long retryAfterSeconds) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, code, Math.max(1, retryAfterSeconds));
    }

    public static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND"); }
    public static ApiException forbidden() { return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN"); }
    public static ApiException badRequest(String code) { return new ApiException(HttpStatus.BAD_REQUEST, code); }
    public static ApiException conflict(String code) { return new ApiException(HttpStatus.CONFLICT, code); }
}
