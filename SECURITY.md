# Securitate Cumped

Fiecare punct din lista de securitate, ce înseamnă la noi și unde se verifică automat.
Testele rulează la fiecare push în GitHub Actions (`.github/workflows/ci.yml`).

| # | Punct | Ce am făcut | Verificat de |
|---|-------|-------------|--------------|
| 1 | Hide API keys | Toate cheile (Anthropic, JWT, SMTP, Turnstile, criptare) vin doar din variabile de mediu pe server. Aplicația mobilă/web nu conține nicio cheie secretă; `/api/config` expune doar cheia *publică* Turnstile. `.env` e în `.gitignore`. | `SecurityChecklistIT.hideApiKeys_*` |
| 2 | Purge Git secrets | Istoricul git a fost scanat (fără chei reale; doar valori de test). Gitleaks rulează în CI pe tot istoricul (`.gitleaks.toml`). | job `secrets` în CI |
| 3 | Use public DB key | Concept Supabase/Firebase: acolo clientul vorbește direct cu baza de date. La Cumped clientul **nu** are acces la baza de date deloc; vorbește doar cu API-ul. Baza de date nu e expusă în afara rețelei Docker. | `docker-compose.yml` (fără `ports` la `db`) |
| 4 | Enable RLS | Echivalentul RLS e aplicat în fiecare interogare: orice citire/scriere a unui rând privat filtrează după utilizatorul autentificat (`WHERE buyer_id = ? OR seller_id = ?` etc.), iar răspunsul pentru rândul altcuiva e `404` (nu aflii nici că există). | `SecurityChecklistIT.lockRecordAccess_*`, `ReviewsAndDisputesIT` |
| 5 | Encrypt sensitive data | Numele de pe act, adresa și telefonul de livrare: AES-256-GCM în baza de date (`FieldCrypto`, cheie `DATA_ENCRYPTION_KEY`). Fără cheie, producția nu pornește. Adresele se șterg la 90 de zile după comandă. | `FieldCryptoTest`, `SecurityChecklistIT.encryptSensitiveData_*`, `ReviewsAndDisputesIT.shippingAddressIsEncrypted*` |
| 6 | Enforce server-side auth | Spring Security: `/api/**` cere autentificare, cu o listă explicită de rute publice GET; `/api/admin/**` cere rol ADMIN; orice altceva e refuzat (`denyAll`). Rolul din token e verificat la server. | `SecurityChecklistIT.enforceServerSideAuth_*`, `AuthSecurityIT` |
| 7 | Lock record access | Vezi punctul 4. Pozele-dovadă din dispute sunt private și se văd doar prin linkuri semnate HMAC, valabile 2 ore. | `ReviewsAndDisputesIT.evidencePhotosArePrivate*` |
| 8 | Block field tampering | JSON strict (`fail-on-unknown-properties: true`): câmpuri ca `role`, `idVerified`, `sellerId`, `totalCents`, `verifiedPurchase` sunt respinse cu 400. Prețul, comisionul și totalul le calculează serverul. | `SecurityChecklistIT.blockFieldTampering_*`, `ReviewsAndDisputesIT.reviewsRejectTampering*` |
| 9 | Secure session cookies | Token de acces scurt (în memorie, nu în cookie). Refresh token în cookie `HttpOnly`, `Secure` (obligatoriu în producție), `SameSite=Strict`, `Path=/api/auth`, cu rotire și detectarea refolosirii. Header anti-CSRF la refresh. | `SecurityChecklistIT.secureSessionCookies_*`, `AuthSecurityIT.refreshNeedsCsrf*` |
| 10 | Hash passwords | bcrypt (prin `DelegatingPasswordEncoder`). Parolele de peste 72 de octeți sunt refuzate clar (limita bcrypt), nu trunchiate. | `SecurityChecklistIT.hashPasswords_*`, `passwordsLongerThanBcryptLimit*` |
| 11 | Rate limit login | Limită pe email (5 încercări) și pe IP (20), stocată în baza de date, cu `Retry-After`; răspuns identic pentru conturi existente și inexistente. Plus limită generală pe IP pentru toate rutele. | `AuthSecurityIT.loginThrottle*`, `RateLimitIT` |
| 12 | Add bot protection | La înregistrare: câmp-capcană invizibil, timp minim de completare și Cloudflare Turnstile (dacă `TURNSTILE_SECRET` e setat), verificat pe server. | `SecurityChecklistIT.addBotProtection_*` |
| 13 | Parameterize queries | Toate interogările folosesc parametri (`JdbcClient` / JPA). Textul din `LIKE` e escapat. Sortarea vine dintr-o listă fixă. | `SecurityChecklistIT.parameterizeQueries_*`, CodeQL |
| 14 | Validate all input | Bean Validation pe toate DTO-urile (lungimi, formate, intervale), plus validări de domeniu (seria, AWB-ul, monedele, țările). | `SecurityChecklistIT.validateAllInput_*` |
| 15 | Escape user content | API-ul întoarce doar JSON (`nosniff`, CSP `default-src 'none'`). Frontend-ul Angular afișează textul prin interpolare (escapare automată), fără `innerHTML` pentru conținut de la utilizatori. | `SecurityChecklistIT.escapeUserContent_*` |
| 16 | Restrict file uploads | Doar JPEG/PNG verificate după conținut (nu după extensie), max 8 MB și 50 MP, re-encodate pe server (metadatele, inclusiv GPS, dispar), limită de poze în așteptare per utilizator. | `SecurityChecklistIT.restrictFileUploads_*`, `uploadedPhotosLoseMetadata*` |
| 17 | Trim API responses | DTO-uri separate pentru public / proprietar: profilul public nu are email, telefon, nume legal sau rol; prețul minim privat se vede doar de vânzător. Erorile nu conțin detalii interne. | `SecurityChecklistIT.trimApiResponses_*`, `AuthSecurityIT` |
| 18 | Add security headers | API: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`. Site (nginx): CSP, HSTS cu preload, COOP etc. | `SecurityChecklistIT.addSecurityHeaders_*`, job `config` în CI |
| 19 | Force HTTPS | Caddy cu certificat automat și redirecționare HTTP → HTTPS (`docker compose --profile https`), redirecționare și în nginx, HSTS. În producție aplicația refuză să pornească cu cookie nesecurizat, CORS `http://` sau `PUBLIC_URL` fără https. | `FieldCryptoTest.forceHttps_*` |
| 20 | Scan dependencies | Dependabot (Gradle, npm, Docker, Actions), graful de dependențe Gradle trimis la GitHub, `npm audit` în CI, CodeQL săptămânal. | `.github/dependabot.yml`, `.github/workflows/` |

## Site public (Vercel) și alerte

- **Doar prin site**: serverul răspunde la `/api` doar cererilor care poartă antetul secret pus de Vercel (`PROXY_SECRET`);
  cine găsește adresa serverului nu poate ocoli antetele și limitele site-ului. Testat în `ProxyGuardIT`.
- **IP-ul real**: limitele de cereri folosesc IP-ul clientului pus de Vercel (nu IP-ul serverelor Vercel), deci un atacator
  nu poate bloca toți utilizatorii și nici nu-și poate schimba IP-ul trimițând el antetul.
- **Antete pe site**: CSP fără scripturi inline, HSTS cu preload, `X-Frame-Options: DENY`, `nosniff`, COOP/CORP,
  `Permissions-Policy` restrictiv. Versiunile de previzualizare cer autentificare Vercel; secretul există doar în producție.
- **Alerte push criptate cap-coadă** (RFC 8291, verificat pe exemplul oficial): serviciile Google/Mozilla/Apple transportă
  alerta fără s-o poată citi. Alertele pentru mesaje nu conțin textul mesajului.
- **Fără SSRF**: abonamentele push sunt acceptate doar către serviciile de push reale (lista fixă de domenii, doar https).
- **Alerte de securitate**: intrare de pe un dispozitiv nou și schimbarea parolei (în aplicație, push și email);
  „Ieși de pe toate dispozitivele” oprește și alertele pe acele dispozitive.

## Protecția vânzătorului și recenziile

- Recenzii doar după o comandă finalizată, câte una de fiecare parte, în 30 de zile, marcate „Cumpărare verificată”.
- Reclamațiile „nu e ce am comandat” cer poze; dacă vânzătorul a înregistrat seria, cumpărătorul trebuie s-o scrie.
- Banii se returnează doar după ce produsul ajunge înapoi la vânzător. Fără retur în 7 zile, vânzătorul e plătit.
- Echipa vede istoricul de reclamații al cumpărătorului și nepotrivirile de serie.

## Raportarea unei vulnerabilități

Scrie la contact@velosyntech.com cu subiectul „Security”. Răspundem în 72 de ore. Te rugăm să nu publici detaliile până nu reparăm problema.
