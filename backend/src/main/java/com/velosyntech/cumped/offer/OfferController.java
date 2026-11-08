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

    private final OfferService offers;

    public OfferController(OfferService offers) { this.offers = offers; }

    @PostMapping("/listings/{id}/offers")
    Map<String, Object> create(@PathVariable UUID id, @Valid @RequestBody Create r) {
        return Map.of("id", offers.create(CurrentUser.id(), id, r.kind(), r.amountCents(), r.swapListingId(), r.message()));
    }

    @PostMapping("/offers/{id}/{action}")
    void decide(@PathVariable UUID id, @PathVariable String action) { offers.decide(CurrentUser.id(), id, action); }

    @GetMapping("/me/offers/received")
    List<OfferService.Offer> received() { return offers.received(CurrentUser.id()); }

    @GetMapping("/me/offers/sent")
    List<OfferService.Offer> sent() { return offers.sent(CurrentUser.id()); }
}
