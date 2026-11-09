package com.velosyntech.cumped.report;

import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.velo.VeloService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Raportarea conținutului (DSA art. 16) și contestarea deciziilor de moderare (DSA art. 20). */
@RestController
@RequestMapping("/api")
public class ReportController {
    public record Report(@NotNull @Pattern(regexp = "LISTING|USER|MESSAGE") String targetType, @NotNull UUID targetId,
                         @NotNull @Pattern(regexp = "FRAUD|PROHIBITED|COUNTERFEIT|OFFENSIVE|SPAM|WRONG_CATEGORY|DUPLICATE|IP_INFRINGEMENT|OTHER") String reason,
                         @Size(max = 1500) String details) {}
    public record Appeal(@NotNull UUID listingId, @Size(min = 10, max = 1500) String message) {}

    private final VeloService velo;

    public ReportController(VeloService velo) { this.velo = velo; }

    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.CREATED)
    VeloService.Ticket report(@Valid @RequestBody Report r) {
        return velo.openReport(CurrentUser.id(), r.targetType(), r.targetId(), r.reason(), r.details());
    }

    @PostMapping("/appeals")
    @ResponseStatus(HttpStatus.CREATED)
    VeloService.Ticket appeal(@Valid @RequestBody Appeal a) {
        return velo.openReport(CurrentUser.id(), "APPEAL", a.listingId(), "APPEAL", a.message());
    }
}
