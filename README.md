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

75 de teste pe server, pe PostgreSQL real:

- `SecurityChecklistIT`: cele 20 de puncte de securitate (vezi [SECURITY.md](SECURITY.md))
- `LegalComplianceIT`: GDPR (consimțământ, export, ștergere, minimizare), ePrivacy, DSA (contact, raportare, contestații, transparența comercianților), Omnibus (recenzii verificate), prețul total înainte de plată
- `ReviewsAndDisputesIT`: recenzii doar după cumpărare, protecția vânzătorului (poze, serie, returnare înainte de rambursare)
- `AuthSecurityIT`, `MarketplaceIT`, `RateLimitIT`, `FieldCryptoTest`, `ScamDetectorTest`

Teste în browser (Playwright), cu serverul și aplicația pornite (`ng serve`):

```bash
cd frontend && npm run e2e
```

Verifică fiecare ecran al aplicației pe 18 dispozitive reale, la mărimea întreagă a ecranului, cu notch / Dynamic Island și bara de gesturi emulate: iPhone SE (320 și 375 px), Android mic, Galaxy S8, iPhone 13 mini, iPhone 15, Pixel 8, iPhone 15 Pro Max, Galaxy Z Fold închis și deschis, iPhone în landscape, iPad mini, iPad Pro, laptop, desktop, plus text foarte mare și modul întunecat (`E2E_DEVICES="iPhone SE,Desktop"` rulează doar câteva). Caută: scroll orizontal, text sau iconițe tăiate, butoane suprapuse, butoane sub notch, sub bara de jos sau sub bara de gesturi, câmpuri care fac zoom pe iPhone, poze rupte, erori JavaScript; iar ferestrele de jos (ofertă, plată, filtre, reclamație) trebuie să aibă butonul final la îndemână. Mai verifică: ținte de atingere de 44 px, etichete și `alt`, tipografie (cifre tabelare, titluri echilibrate), combobox-ul de căutare cu tastatura, chat-ul instant cu retrimitere, dovezile la expediere și reclamația cu poze și serie, recenzia „Cumpărare verificată”.

Toate rulează automat în GitHub Actions la fiecare push (plus gitleaks, CodeQL, `npm audit`, Dependabot).

## Producție (Docker)

```bash
cp .env.example .env   # completează valorile
```

```bash
docker compose up --build -d
```

Site-ul și API-ul rulează pe același domeniu (nginx trimite `/api` către backend). Cu HTTPS automat (Let's Encrypt, HTTP → HTTPS):

```bash
DOMAIN=cumped.com docker compose --profile https up -d --build
```

În producție setează obligatoriu `DATA_ENCRYPTION_KEY` (`openssl rand -base64 32`) și o parolă puternică pentru baza de date; altfel serverul refuză să pornească.

## Publicare: site pe Vercel, server pe Render

- **Site (Vercel)** – proiectul `cumped`, legat de GitHub, folderul `frontend`. Fiecare push pe `main` publică automat.
  `frontend/vercel.json` pune antetele de securitate (CSP strict, HSTS, anti-iframe etc.) și trimite `/api/*` la server.
  La fiecare cerere spre server, Vercel adaugă antetul secret `x-cumped-proxy` (din variabila `PROXY_SECRET`, doar în
  producție) și IP-ul real al clientului. Vizitatorii nu pot pune ei antetul: Vercel îl suprascrie.
- **Server + bază de date (Render)** – descrise în `render.yaml` (Blueprint): server Docker cu verificare de sănătate,
  PostgreSQL accesibil doar din rețeaua privată, disc de 1 GB pentru poze. `JWT_SECRET` și `DATA_ENCRYPTION_KEY` sunt
  generate de Render; `PROXY_SECRET` trebuie să fie identic cu cel de pe Vercel. Cu `PROXY_SECRET` setat, serverul
  răspunde doar cererilor venite prin site.
- **Cont de admin**: pe Render, în Environment, setează `ADMIN_EMAIL` și `ADMIN_PASSWORD` (minim 12 caractere), apoi redeploy.
- **Opțional**: `ANTHROPIC_API_KEY` (Velo AI), `SMTP_*` (emailuri), `TURNSTILE_*` (anti-roboți), `FCM_SERVICE_ACCOUNT` (alerte pe telefon).

## Alerte (notificări push)

- **Pe site**: merg singure (Web Push). Cheile VAPID sunt generate de server la prima pornire și păstrate criptate.
  Pe iPhone, alertele web merg după „Adaugă pe ecranul principal”.
- **În aplicația iOS / Android** (Firebase Cloud Messaging):
  1. Creează un proiect Firebase și adaugă aplicațiile Android și iOS cu ID-ul `com.velosyntech.cumped`.
  2. Android: pune `google-services.json` în `frontend/android/app/`. iOS: pune `GoogleService-Info.plist` în
     `frontend/ios/App/App/`, activează „Push Notifications” în Xcode și încarcă cheia APNs în Firebase.
  3. În Firebase → Setări proiect → Conturi de serviciu → „Generează cheie privată”, apoi pe Render:
     `FCM_SERVICE_ACCOUNT` = conținutul fișierului JSON în base64 (`base64 -w0 cont.json`).
- Utilizatorul alege din Setări → Alerte ce primește (mesaje, oferte, comenzi, prețuri, anunțuri). Alertele de
  securitate (intrare de pe un dispozitiv nou, parolă schimbată) sunt mereu pornite și vin și pe email.

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
- Numele de pe act, adresa și telefonul de livrare criptate (AES-256-GCM); adresele șterse la 90 de zile după comandă
- Anti-roboți la înregistrare: câmp-capcană, timp minim de completare, Cloudflare Turnstile opțional
- JSON strict: câmpurile necunoscute (ex. `role`, `verifiedPurchase`) sunt respinse
- Lista completă, punct cu punct: [SECURITY.md](SECURITY.md)

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
