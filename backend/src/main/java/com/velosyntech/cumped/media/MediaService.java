package com.velosyntech.cumped.media;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.config.AppProperties;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Încărcare de imagini sigură:
 *  - verificăm conținutul real (magic bytes), nu extensia sau Content-Type-ul trimis;
 *  - decodăm și re-encodăm imaginea: dispar metadatele EXIF (inclusiv locația GPS a pozei!) și orice conținut ascuns;
 *  - limităm dimensiunea în pixeli (protecție la „decompression bombs”);
 *  - numele fișierului e un UUID generat de noi: fără path traversal.
 */
@Service
public class MediaService {
    private static final int MAX_SIDE = 1600;
    private static final int THUMB_SIDE = 600;
    private static final long MAX_PIXELS = 50_000_000L;
    private static final int MAX_PENDING_PER_USER = 30;

    private final ListingImageRepository images;
    private final Path root;

    public MediaService(ListingImageRepository images, AppProperties props) throws IOException {
        this.images = images;
        this.root = Path.of(props.uploadsDir()).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    @Transactional
    public ListingImage upload(UUID ownerId, MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("EMPTY_FILE");
        if (images.countByOwnerIdAndListingIdIsNull(ownerId) >= MAX_PENDING_PER_USER) throw ApiException.badRequest("TOO_MANY_PENDING_IMAGES");
        byte[] bytes;
        try (InputStream in = file.getInputStream()) {
            bytes = in.readNBytes(8 * 1024 * 1024 + 1);
        } catch (IOException e) {
            throw ApiException.badRequest("INVALID_IMAGE");
        }
        if (bytes.length > 8 * 1024 * 1024) throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE");
        if (!isJpeg(bytes) && !isPng(bytes)) throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_IMAGE");

        BufferedImage src;
        try {
            var reader = ImageIO.getImageReaders(ImageIO.createImageInputStream(new ByteArrayInputStream(bytes)));
            if (!reader.hasNext()) throw ApiException.badRequest("INVALID_IMAGE");
            var r = reader.next();
            try (var iis = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                r.setInput(iis, true, true);
                long px = (long) r.getWidth(0) * r.getHeight(0);
                if (px <= 0 || px > MAX_PIXELS) throw ApiException.badRequest("IMAGE_TOO_LARGE");
                src = r.read(0);
            } finally {
                r.dispose();
            }
        } catch (IOException e) {
            throw ApiException.badRequest("INVALID_IMAGE");
        }
        if (src == null) throw ApiException.badRequest("INVALID_IMAGE");

        BufferedImage out = resize(src, MAX_SIDE);
        String key = UUID.randomUUID() + ".jpg";
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) throw ApiException.badRequest("INVALID_IMAGE");
        try {
            writeJpeg(out, target, 0.85f);
            writeJpeg(resize(out, THUMB_SIDE), root.resolve(thumbKey(key)).normalize(), 0.78f);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED");
        }
        return images.save(new ListingImage(ownerId, key, "image/jpeg"));
    }

    public byte[] read(ListingImage img, boolean thumb) {
        if (img.getStorageKey().startsWith("demo:")) throw ApiException.notFound();
        if (thumb) {
            Path t = root.resolve(thumbKey(img.getStorageKey())).normalize();
            if (t.startsWith(root) && Files.exists(t)) {
                try { return Files.readAllBytes(t); } catch (IOException ignored) { /* revenim la imaginea întreagă */ }
            }
        }
        Path p = root.resolve(img.getStorageKey()).normalize();
        if (!p.startsWith(root)) throw ApiException.notFound();
        try {
            return Files.readAllBytes(p);
        } catch (IOException e) {
            throw ApiException.notFound();
        }
    }

    /** Șterge imaginile încărcate dar neatașate niciunui anunț după 24h. */
    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void cleanupOrphans() {
        for (ListingImage img : images.findByListingIdIsNullAndCreatedAtBefore(Instant.now().minus(Duration.ofHours(24)))) {
            delete(img);
        }
    }

    @Transactional
    public void delete(ListingImage img) {
        if (!img.getStorageKey().startsWith("demo:")) {
            try {
                Files.deleteIfExists(root.resolve(img.getStorageKey()).normalize());
                Files.deleteIfExists(root.resolve(thumbKey(img.getStorageKey())).normalize());
            } catch (IOException ignored) {}
        }
        images.delete(img);
    }

    private static boolean isJpeg(byte[] b) { return b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF; }
    private static boolean isPng(byte[] b) { return b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'; }

    private static String thumbKey(String key) { return key.replace(".jpg", "-thumb.jpg"); }

    private static BufferedImage resize(BufferedImage src, int maxSide) {
        int w = src.getWidth(), h = src.getHeight();
        double scale = Math.min(1.0, (double) maxSide / Math.max(w, h));
        int nw = Math.max(1, (int) Math.round(w * scale)), nh = Math.max(1, (int) Math.round(h * scale));
        BufferedImage out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, nw, nh);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src, 0, 0, nw, nh, null);
        g.dispose();
        return out;
    }

    private static void writeJpeg(BufferedImage img, Path target, float quality) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(quality);
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(target.toFile())) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
    }
}
