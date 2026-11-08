package com.velosyntech.cumped.chat;

import com.velosyntech.cumped.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations")
public class ChatController {
    public record Start(@NotNull UUID listingId, @Size(max = 2000) String message) {}
    public record Send(@NotBlank @Size(max = 2000) String body) {}

    private final ChatService chat;

    public ChatController(ChatService chat) { this.chat = chat; }

    @GetMapping
    List<ChatService.Summary> list() { return chat.list(CurrentUser.id()); }

    @PostMapping
    Map<String, Object> start(@Valid @RequestBody Start r) {
        return Map.of("id", chat.start(CurrentUser.id(), r.listingId(), r.message()));
    }

    @GetMapping("/{id}")
    ChatService.Thread thread(@PathVariable UUID id, @RequestParam(required = false) Instant after) {
        return chat.thread(CurrentUser.id(), id, after);
    }

    @PostMapping("/{id}/messages")
    ChatService.Sent send(@PathVariable UUID id, @Valid @RequestBody Send r) {
        return chat.send(CurrentUser.id(), id, r.body());
    }
}
