package com.velosyntech.cumped.velo;

import com.velosyntech.cumped.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/velo")
public class VeloController {
    public record Message(UUID sessionId, @NotBlank @Size(max = 1500) String message, UUID listingId, UUID reportedUserId) {}

    private final VeloService velo;

    public VeloController(VeloService velo) { this.velo = velo; }

    @PostMapping("/message")
    VeloService.Reply message(@Valid @RequestBody Message m) {
        return velo.message(CurrentUser.id(), m.sessionId(), m.message(), m.listingId(), m.reportedUserId());
    }

    @GetMapping("/tickets")
    List<VeloService.Ticket> tickets() { return velo.myTickets(CurrentUser.id()); }
}
