package com.velosyntech.cumped.offer;

import com.velosyntech.cumped.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class OfferController {
    public record Create(@NotBlank String kind, Long amountCents, UUID swapListingId, @Size(max = 400) String message) {}
    public record Respond(Long amountCents, @Size(max = 400) String message) {}

    private final OfferService offers;

    public OfferController(OfferService offers) { this.offers = offers; }

    @PostMapping("/listings/{id}/offers")
    Map<String, Object> create(@PathVariable UUID id, @Valid @RequestBody Create r) {
        return Map.of("id", offers.create(CurrentUser.id(), id, r.kind(), r.amountCents(), r.swapListingId(), r.message()));
    }

    /** action: accept | decline | counter | withdraw */
    @PostMapping("/offers/{id}/{action}")
    void respond(@PathVariable UUID id, @PathVariable String action, @Valid @RequestBody(required = false) Respond r) {
        offers.respond(CurrentUser.id(), id, action, r == null ? null : r.amountCents(), r == null ? null : r.message());
    }

    @GetMapping("/me/negotiations")
    List<OfferService.Negotiation> list() { return offers.list(CurrentUser.id()); }

    @GetMapping("/negotiations/{threadId}")
    OfferService.Negotiation thread(@PathVariable UUID threadId) { return offers.thread(CurrentUser.id(), threadId); }
}
