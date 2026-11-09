# Publicare în App Store și Google Play

Ce e deja pregătit în cod și ce mai trebuie să faci tu (conturi, date de firmă, avocat).

## 1. Ce e gata în aplicație

| Cerință | Unde |
|---|---|
| Termeni, Confidențialitate, Reguli, Transparență DSA, Cookie-uri, Despre | `/legal/terms`, `/legal/privacy`, `/legal/rules`, `/legal/dsa`, `/legal/cookies`, `/legal/about` |
| Ștergerea contului din aplicație (Apple 5.1.1(v)) | Setări → Confidențialitate → Șterge contul |
| Pagină web pentru ștergere, fără aplicație (Google Play) | `/delete-account` |
| Acceptarea termenilor + confirmare 18+ la înregistrare (și la Apple/Google) | ecranul de înregistrare; serverul refuză fără ele (`TERMS_REQUIRED`) |
| Reacceptare când se schimbă termenii | `TERMS_VERSION` în `AuthService.java` + ecranul `cmp-terms-gate` |
| Conținut generat de utilizatori (Apple 1.2): filtru, raportare, blocare, contact | `ContentPolicy`, butonul Raportează (anunț/profil/mesaj), Blochează, pagina Despre |
| DSA: notificare și acțiune, motivare, contestație, trasabilitatea comercianților | `/api/reports`, `/api/appeals`, notificarea `LISTING_REMOVED`, cont de firmă |
| Omnibus: firmă vs. persoană fizică afișat pe anunț | insigna „Firmă” + notă despre drepturile consumatorilor |
| Sign in with Apple alături de Google (Apple 4.8) | butoanele există; se activează cu client ID-urile |
| Fără urmărire (ATT nu e necesar) | `PrivacyInfo.xcprivacy` → `NSPrivacyTracking = false` |
| Manifest de confidențialitate Apple | `ios/App/App/PrivacyInfo.xcprivacy` (inclus în proiectul Xcode) |
| Texte pentru permisiuni iOS (cameră, poze) | `Info.plist` |
| Fără criptare proprie (export compliance) | `ITSAppUsesNonExemptEncryption = false` |
| Android: fără backup al sesiunii, fără trafic necriptat, target SDK 36 | `AndroidManifest.xml`, `data_extraction_rules.xml` |
| Pictograme și ecrane de pornire din logo (B4) | `ios/.../AppIcon.appiconset`, `android/.../mipmap-*`, `splash.png` |
| Plăți digitale: ascunse în aplicația nativă până configurezi In-App Purchase | `Purchases` (`config.inAppPurchases`) |

## 2. Ce trebuie să faci tu

1. **Firma**: completează variabilele de mediu ale serverului `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_REG_NO`, `COMPANY_VAT`, `COMPANY_EMAIL`, `DPO_EMAIL`. Apar automat în toate paginile legale.
2. **Avocat**: textele legale din `frontend/src/app/core/legal/` sunt o bază de lucru completă, dar trebuie revizuite de un avocat (în special răspunderea, plata sigură și vânzările transfrontaliere). Apoi scoate mesajul „în curs de revizuire” (`legal.draft`) și crește `TERMS_VERSION`.
3. **Conturi de dezvoltator**: Apple Developer Program (99 USD/an, ca organizație ai nevoie de număr D-U-N-S) și Google Play Console (25 USD o dată). Google cere ca, la conturile noi de persoană fizică, aplicația să fie testată închis de cel puțin 12 testeri timp de 14 zile; la cont de organizație nu.
4. **In-App Purchase**: creează produsele (Plus, Pro, anunț suplimentar, promovare, ridicare) în App Store Connect și Play Console, integrează un plugin de achiziții (ex. RevenueCat sau `@capgo/native-purchases`) și apoi pune `inAppPurchases: true` în `ConfigController`. Până atunci, aplicația nativă nu vinde servicii digitale (altfel e respinsă). Plata sigură pentru produse fizice între utilizatori nu intră sub această regulă.
5. **Login social**: client ID Google + Services ID Apple (vezi README), apoi testează pe dispozitiv.
6. **Domeniu și HTTPS** pentru server; URL-urile cerute de magazine: `https://<domeniu>/legal/privacy`, `https://<domeniu>/delete-account`, `https://<domeniu>/legal/terms`.

## 3. Răspunsuri pentru formulare

### App Store Connect — App Privacy
Date colectate, toate **legate de identitate**, **fără urmărire**, scop **App Functionality**:
Contact Info (email, nume, telefon) · User Content (poze, mesaje, alte conținuturi) · Identifiers (User ID) · Purchases (istoric) · Location (oraș — aproximativ, introdus manual).
Nu colectăm: date de sănătate, financiare (cardurile le procesează Stripe/Apple/Google), contacte, istoric de navigare, diagnostice de la terți.

### Google Play — Data safety
Aceleași categorii ca mai sus. Datele sunt **criptate în tranzit**, utilizatorul **poate cere ștergerea** (link: `/delete-account`). Datele **nu sunt partajate** cu terți în sensul Google (furnizorii de servicii nu se consideră partajare).

### Clasificarea de vârstă
- Apple (sistemul nou 4+ / 9+ / 13+ / 16+ / 18+): conținut generat de utilizatori + chat între utilizatori → răspunsurile duc de regulă la **18+**. Aplicația cere oricum 18+ la înregistrare.
- Google (IARC): bifează „utilizatorii pot interacționa” și „partajează conținut”; rezultatul tipic e **Teen/PEGI 12** sau mai mare; publicul țintă în Play Console: **18+**.

### Note pentru recenzorul Apple
```
Cont demo: demo@cumped.com / Cumped-Demo-2026
Raportare: pe orice anunț → ⋯ → Raportează anunțul (la fel pe profil și pe mesaje).
Blocare: profil sau chat → ⋯ → Blochează.
Ștergere cont: Profil → Setări → Confidențialitate → Șterge contul.
Abonamentele/promovările nu se vând în aplicația iOS până la activarea In-App Purchase.
Plata sigură se referă la bunuri fizice vândute între utilizatori (3.1.3(e)/3.1.5).
```
Pentru review, pornește serverul cu `cumped.dev-mode=false` și un cont demo creat manual (în producție, datele demo nu se generează).

### Capturi de ecran
- iPhone 6,9" (1320 × 2868) obligatoriu; iPad 13" (2064 × 2752) dacă publici și pe iPad.
- Google Play: minimum 2 capturi de telefon (1080 × 1920 sau mai mari), plus grafica de 1024 × 500.
- **Nu folosi pozele demo în capturile din magazin** dacă se văd mărci (Apple, BMW, Sony…) — vezi `docs/CREDITS.md`. Folosește produse fără logo sau pozele tale.

## 4. Înainte de fiecare versiune
- `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` în Xcode și `versionCode` / `versionName` în `android/app/build.gradle`.
- `npx ng build --configuration production && npx cap sync`.
- Testează pe un telefon mic (iPhone SE / Android 360 px), unul mare și o tabletă.
