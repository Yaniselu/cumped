package com.velosyntech.cumped.ai;

import com.velosyntech.cumped.common.CurrentUser;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class AiController {
    public record DraftRequest(@Size(min = 1, max = 4) List<UUID> imageIds, String lang, String currency) {}
    public record TranslateRequest(String lang) {}

    private final AiService ai;

    public AiController(AiService ai) { this.ai = ai; }

    @PostMapping("/ai/listing-draft")
    ListingDraft draft(@RequestBody DraftRequest r) { return ai.draft(CurrentUser.id(), r.imageIds(), r.lang(), r.currency()); }

    @PostMapping("/messages/{id}/translate")
    Map<String, String> translate(@PathVariable UUID id, @RequestBody TranslateRequest r) {
        return Map.of("text", ai.translate(CurrentUser.id(), id, r.lang()));
    }
}
