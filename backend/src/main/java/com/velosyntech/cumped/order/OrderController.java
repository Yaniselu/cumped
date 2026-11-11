package com.velosyntech.cumped.order;

import com.velosyntech.cumped.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Plata sigură: ofertă de preț, comandă, expediere, confirmare, dispută, anulare. */
@RestController
@RequestMapping("/api")
public class OrderController {
    public record Create(@NotBlank String delivery, OrderService.Address address) {}
    public record Ship(@Size(max = 40) String carrier, @Size(max = 60) String trackingCode) {}
    public record Dispute(@NotBlank String reason, @Size(max = 2000) String details) {}
    public record Resolve(@NotBlank String outcome) {}

    private final OrderService orders;

    public OrderController(OrderService orders) { this.orders = orders; }

    @GetMapping("/listings/{id}/order-quote")
    OrderService.Quote quote(@PathVariable UUID id, @RequestParam(defaultValue = "PICKUP") String delivery, @RequestParam(required = false) String country) {
        return orders.quote(CurrentUser.id(), id, delivery, country);
    }

    @PostMapping("/listings/{id}/orders")
    @ResponseStatus(HttpStatus.CREATED)
    OrderService.View create(@PathVariable UUID id, @Valid @RequestBody Create r) {
        return orders.create(CurrentUser.id(), id, r.delivery(), r.address());
    }

    @GetMapping("/me/orders")
    List<OrderService.View> mine() { return orders.mine(CurrentUser.id()); }

    @GetMapping("/orders/{id}")
    OrderService.View one(@PathVariable UUID id) { return orders.view(CurrentUser.id(), id); }

    @PostMapping("/orders/{id}/ship")
    OrderService.View ship(@PathVariable UUID id, @Valid @RequestBody(required = false) Ship r) {
        return orders.ship(CurrentUser.id(), id, r == null ? null : r.carrier(), r == null ? null : r.trackingCode());
    }

    @PostMapping("/orders/{id}/confirm")
    OrderService.View confirm(@PathVariable UUID id) { return orders.confirm(CurrentUser.id(), id); }

    @PostMapping("/orders/{id}/dispute")
    OrderService.View dispute(@PathVariable UUID id, @Valid @RequestBody Dispute r) {
        return orders.dispute(CurrentUser.id(), id, r.reason(), r.details());
    }

    @PostMapping("/orders/{id}/cancel")
    OrderService.View cancel(@PathVariable UUID id) { return orders.cancel(CurrentUser.id(), id); }

    @GetMapping("/admin/orders/disputed")
    List<OrderService.View> disputed() { return orders.disputed(CurrentUser.id()); }

    @PostMapping("/admin/orders/{id}/resolve")
    Map<String, Object> resolve(@PathVariable UUID id, @Valid @RequestBody Resolve r) {
        orders.resolve(CurrentUser.id(), id, r.outcome());
        return Map.of("ok", true);
    }
}
