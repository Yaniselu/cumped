package com.velosyntech.cumped.media;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/media")
public class MediaController {
    private final MediaService media;
    private final ListingImageRepository images;

    public MediaController(MediaService media, ListingImageRepository images) {
        this.media = media;
        this.images = images;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    Map<String, Object> upload(@RequestParam("file") MultipartFile file) {
        ListingImage img = media.upload(CurrentUser.id(), file);
        return Map.of("id", img.getId(), "url", img.url());
    }

    @GetMapping("/{id}")
    ResponseEntity<byte[]> get(@PathVariable UUID id) {
        ListingImage img = images.findById(id).orElseThrow(ApiException::notFound);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("Content-Disposition", "inline")
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .body(media.read(img));
    }
}
