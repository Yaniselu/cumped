# Cumped

Platformă de anunțuri (vânzare, cumpărare, schimb) cu oameni verificați, preț analizat de AI și chat protejat anti-țeapă.
Nume provizoriu: **Cumped**. Firma: Velosyntech.

- **Aplicație de telefon + site:** Ionic 9 + Angular 22 + Capacitor 8 (același cod pentru iOS, Android și web)
- **Backend:** Spring Boot 4.1 + Java 21 + PostgreSQL 16
- **Velo AI:** asistent de suport (Claude API când există cheie, altfel reguli locale)

## Ce conține

| Zonă | Ce face |
|---|---|
| Get Started | Ecran animat la prima deschidere, alegerea limbii (pornește în limba telefonului) |
| Conturi | Email + parolă, butoane Google / Apple (active după configurarea client ID-urilor) |
| Verificare | Identitate (nume de pe act, nu se mai poate schimba) și telefon; bifă de cont verificat |
| Nume real | Public apare username-ul; numele de pe act îl văd doar utilizatorii logați și verificați, cu audit |
| Anunțuri | Asistent de publicare în 4 pași, poze comprimate în telefon, specificații, livrare pe țări |
| Preț AI | „Sub medie / Corect / Peste medie”, calculat din anunțuri similare, și în timp ce scrii prețul |
| Căutare | Text, categorii, preț, stare, țară, oraș, „livrează în”, doar verificați, doar schimb, sortare |
| Favorite + alerte | Notificare la scăderea prețului și la anunțuri noi pentru căutările salvate |
| Chat | Mesaje în aplicație; numerele de card și cererile de CVV sunt blocate, linkurile ascunse, avertismente la WhatsApp / plată prin link |
| Oferte | Ofertă de preț sau schimb cu unul dintre anunțurile tale (plus bani, opțional) |
| Recenzii | Doar după o tranzacție confirmată (vândut către tine sau ofertă acceptată) |
| Statistici | Vizualizări pe zile, favorite, conversații și oferte pe fiecare anunț |
| Cote | 2 anunțuri active gratuite; 5 dacă inviți 10 prieteni care își verifică contul; Plus 15, Pro 100; anunț extra 1,99 € |
| Promovare | 7 zile în top (2,99 €) și „ridicare” în listă (0,99 €) |
| Velo AI | Răspunde la întrebări, strânge detaliile, deschide tichete trimise pe email la **contact@velosyntech.com** și, în cazurile clar suspecte, ascunde temporar anunțul sau suspendă contul până la verificarea umană |
| Admin | Tichete, confirmarea sau anularea acțiunilor automate ale lui Velo, suspendări |
| Limbi | Română, engleză, germană, franceză, spaniolă, italiană, maghiară, poloneză, ucraineană, turcă |
| Design | Temă luminoasă (logo B1) și întunecată (logo B4), accent violet `#5B3DF5`, carduri cu efect de sticlă, skeleton loading, multe animații |

## Pornire locală (dezvoltare)

Ai nevoie de Java 21, Node 22 și PostgreSQL 16.

```bash
createdb cumped   # utilizator/parolă implicite în dev: cumped / cumped
```

```bash
cd backend && DEV_MODE=true DEMO_DATA=true COOKIE_SECURE=false ./gradlew bootRun
```

```bash
cd frontend && npm install && npx ng serve
```

Deschide http://localhost:4200. Contul demo: `demo@cumped.com` / `Cumped-Demo-2026`.
Pentru panoul de admin, setează și `ADMIN_EMAIL` și `ADMIN_PASSWORD` la pornirea backend-ului.

`DEV_MODE=true` simulează verificarea cu actul, SMS-ul și plățile (marcat ca „Simulare” în aplicație). În producție trebuie să fie `false`.

## Teste

```bash
createdb cumped_test
```

```bash
cd backend && ./gradlew test
```

17 teste: autentificare, furt de sesiune (refolosirea refresh token-ului), IDOR, acces admin, token falsificat, cote, linkuri interzise, chat anti-țeapă, oferte și recenzii, Velo + email către suport, detector de fraudă, limitare de cereri.

## Producție (Docker)

```bash
cp .env.example .env   # completează valorile
```

```bash
docker compose up --build -d
```

Site-ul și API-ul rulează pe același domeniu (nginx trimite `/api` către backend). Pune HTTPS în față (Caddy, Cloudflare etc.).

## Aplicațiile de telefon

```bash
cd frontend && npx ng build && npx cap sync
```

```bash
npx cap open android   # Android Studio
```

```bash
npx cap open ios       # Xcode (doar pe Mac)
```

## Securitate

- Token de acces JWT de 15 minute, ținut doar în memorie (nu în localStorage)
- Refresh token opac în cookie `HttpOnly` + `Secure` + `SameSite=Strict`, stocat doar ca hash, rotit la fiecare folosire; refolosirea unui token vechi revocă toate sesiunile din familie
- „Ieși de pe toate dispozitivele” și schimbarea parolei invalidează imediat token-urile active
- Parole cu bcrypt, reguli minime de putere, blocare 15 minute după 5 încercări greșite, timp de răspuns egal pentru conturi inexistente
- Limitare de cereri pe IP (login, verificare, Velo, dezvăluirea numelui real, scrieri)
- Headere de securitate: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`
- Erorile returnează doar un cod (`{"error":"COD"}`), fără stack trace sau detalii interne
- Toate interogările SQL sunt parametrizate; datele publice trec prin DTO-uri fără email, telefon sau nume complet
- Imaginile sunt verificate după conținut, re-encodate (dispar metadatele EXIF/GPS) și limitate ca dimensiune
- Datele de card și codurile nu ajung în transcrieri, la AI sau în emailuri
- Velo acționează singur doar cu dovezi independente (mesaje semnalate, încercări blocate sau mai mulți reclamanți); orice acțiune automată e temporară și se confirmă sau se anulează din admin
- GDPR: export de date și ștergerea contului din Setări

## Ce mai trebuie conectat înainte de lansare

| Ce | Status acum | Ce trebuie |
|---|---|---|
| Plăți, abonamente, plata sigură | Simulate în `DEV_MODE` | Cont Stripe + Stripe Connect |
| Verificarea cu actul | Simulată în `DEV_MODE` | Stripe Identity (sau alt furnizor KYC) |
| SMS pentru telefon | Codul apare pe ecran în `DEV_MODE` | Furnizor SMS (Twilio, Firebase etc.) |
| Login Google / Apple | Backend-ul verifică token-urile; butoanele cer configurare | Client ID-uri Google și Apple + SDK-urile în aplicație |
| Email (tichete Velo) | Emailurile stau în coadă în baza de date | Server SMTP (`SMTP_*`) |
| Velo AI cu Claude | Merge pe reguli locale (română + engleză) | `ANTHROPIC_API_KEY` |
| Livrare internațională | Estimare pe zone și greutate | Agregator de curieri (Shippo / EasyPost) |
| Sesiune în aplicațiile native | Pe web merge prin cookie | Stocare securizată a token-ului (Keychain / Keystore) |
| Notificări push | Notificări în aplicație | Firebase Cloud Messaging |
| Apeluri în aplicație | Buton „în curând” | Serviciu VoIP |
