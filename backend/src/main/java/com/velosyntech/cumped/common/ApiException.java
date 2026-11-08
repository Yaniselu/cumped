package com.velosyntech.cumped.common;

import org.springframework.http.HttpStatus;

/** Eroare controlată: doar un cod stabil ajunge la client, niciodată detalii interne. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code) {
        super(code, null, false, false);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }

    public static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND"); }
    public static ApiException forbidden() { return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN"); }
    public static ApiException badRequest(String code) { return new ApiException(HttpStatus.BAD_REQUEST, code); }
    public static ApiException conflict(String code) { return new ApiException(HttpStatus.CONFLICT, code); }
}
