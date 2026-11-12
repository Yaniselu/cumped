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
    private final MediaSigner signer;

    public MediaController(MediaService media, ListingImageRepository images, MediaSigner signer) {
        this.media = media;
        this.images = images;
        this.signer = signer;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    Map<String, Object> upload(@RequestParam("file") MultipartFile file) {
        ListingImage img = media.upload(CurrentUser.id(), file);
        return Map.of("id", img.getId(), "url", img.url(), "thumbUrl", img.thumbUrl());
    }

    @GetMapping("/{id}")
    ResponseEntity<byte[]> get(@PathVariable UUID id, @RequestParam(required = false) String size,
                               @RequestParam(required = false) Long exp, @RequestParam(required = false) String sig) {
        ListingImage img = images.findById(id).orElseThrow(ApiException::notFound);
        if (img.isEvidence()) {
            // Dovezile din dispute: doar cu link semnat, valabil 2 ore, fără cache public.
            if (!signer.valid(id, exp, sig)) throw ApiException.notFound();
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .cacheControl(CacheControl.noStore().cachePrivate())
                    .header("Content-Disposition", "inline")
                    .header("Cross-Origin-Resource-Policy", "same-site")
                    .body(media.read(img, "thumb".equals(size)));
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("Content-Disposition", "inline")
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .body(media.read(img, "thumb".equals(size)));
    }
}
