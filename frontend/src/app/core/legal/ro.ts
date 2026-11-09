/**
 * Documentele legale (RO). Variabilele {company}, {address}, {regNo}, {vat}, {email}, {dpo} vin din /api/config,
 * ca datele firmei să fie schimbate dintr-un singur loc. Text de lucru: trebuie revizuit de un avocat înainte de lansare.
 */
import { LegalDocs } from './types';

const docs: LegalDocs = {
  terms: {
    title: 'Termeni și condiții', updated: '2026-11-09',
    sections: [
      { h: '1. Cine suntem', p: [
        'Cumped este o platformă online prin care persoane fizice și firme publică anunțuri, negociază și cumpără produse și servicii. Platforma este operată de {company}, cu sediul în {address}, înregistrată sub nr. {regNo}, CUI {vat}, email {email} („noi”).',
        'Cumped este un intermediar (serviciu de găzduire în sensul Regulamentului (UE) 2022/2065 privind serviciile digitale, „DSA”). Contractul de vânzare se încheie direct între cumpărător și vânzător; noi nu suntem parte la el, cu excepția serviciilor pe care le vindem noi (abonamente, promovări, plata sigură).',
      ] },
      { h: '2. Contul tău', p: [
        'Trebuie să ai cel puțin 18 ani și să folosești date reale. Ai voie la un singur cont personal. Ești responsabil pentru păstrarea în siguranță a parolei și pentru ce se întâmplă în contul tău.',
        'Numele public este username-ul ales de tine. Verificarea identității este opțională: dacă o faci, numele de pe act devine numele contului și poate fi văzut doar de utilizatorii autentificați și verificați. Imaginile actului sunt procesate de furnizorul de verificare și nu sunt păstrate de noi.',
      ] },
      { h: '3. Anunțurile', p: [
        'Poți vinde doar ce îți aparține legal sau ai dreptul să vinzi. Descrierea, starea, specificațiile, prețul și pozele trebuie să fie corecte și să îți aparțină. Defectele cunoscute trebuie menționate.',
        'Este interzis să publici produsele și conținutul din Regulile comunității, anunțuri duplicate, prețuri înșelătoare sau date de contact menite să mute plata în afara platformei.',
        'Poți seta un preț minim privat: ofertele sub acest prag sunt refuzate automat, fără ca prețul minim să fie dezvăluit.',
      ] },
      { h: '4. Oferte, contraoferte și schimburi', p: [
        'Ofertele, contraofertele și propunerile de schimb sunt valabile 48 de ore, iar o negociere are cel mult 6 runde. Acceptarea unei oferte exprimă acordul ambelor părți asupra prețului; vânzarea se finalizează prin plata sigură în aplicație sau prin predare personală.',
        'Nu te angaja la plăți prin linkuri primite în chat, transferuri în avans către necunoscuți sau aplicații externe. Mesajele care cer astfel de plăți pot fi blocate automat.',
      ] },
      { h: '5. Prețuri, comisioane și plăți', p: [
        'În primul an de la crearea contului, ai gratuit 2 anunțuri active în același timp. Peste această limită poți cumpăra: anunț suplimentar 1,99 € / 30 de zile; abonament Plus 4,99 € / lună (15 anunțuri active); Pro / Business 19,99 € / lună (100 de anunțuri active); promovare 2,99 € / 7 zile; ridicare în listă 0,99 €. Invitând 10 prieteni care își verifică contul primești până la 5 anunțuri gratuite.',
        'Plata sigură costă 2,5% din valoarea produsului (minimum 0,50 €, maximum 20 €) și este plătită de cumpărător. Prețurile includ TVA acolo unde se aplică. Abonamentele se reînnoiesc lunar și pot fi anulate oricând, cu efect la sfârșitul perioadei plătite.',
        'În aplicațiile pentru iOS și Android, serviciile digitale (abonamente, promovări) se cumpără prin sistemul de plată al Apple sau Google, conform regulilor acestora, inclusiv pentru rambursări.',
      ] },
      { h: '6. Vânzători profesioniști (firme)', p: [
        'Dacă vinzi în cadrul unei activități comerciale, trebuie să activezi contul de firmă și să furnizezi datele de identificare cerute de art. 30 DSA. Datele firmei sunt afișate pe anunțuri.',
        'Comercianții respectă legislația de protecție a consumatorilor: informarea precontractuală, dreptul de retragere de 14 zile la vânzarea la distanță, garanția legală de conformitate și regulile privind prețurile și reducerile.',
        'Vânzările între persoane fizice nu beneficiază de protecția din legislația consumatorilor; afișăm clar dacă vânzătorul este persoană fizică sau firmă.',
      ] },
      { h: '7. Moderare, decizii și contestații', p: [
        'Anunțurile, mesajele și raportările sunt analizate automat (inclusiv de Velo AI) și de echipa noastră. Când un risc pare ridicat, putem ascunde temporar un anunț sau suspenda temporar un cont până la verificarea umană.',
        'Putem elimina conținut ilegal sau care încalcă acești termeni și putem restricționa sau închide conturi. Îți comunicăm decizia și motivele ei, conform art. 17 DSA.',
        'Poți contesta gratuit orice decizie, în termen de 6 luni, direct din aplicație (art. 20 DSA). Contestațiile sunt analizate de oameni. Poți apela și la un organism de soluționare extrajudiciară certificat (art. 21 DSA) sau la instanță.',
      ] },
      { h: '8. Cum ordonăm rezultatele', p: [
        'Rezultatele căutării sunt ordonate implicit după relevanța față de textul căutat și după cât de recent a fost publicat anunțul. Anunțurile promovate contra cost apar mai sus și sunt marcate „Promovat”. Poți schimba oricând ordinea după dată sau preț. Detalii în pagina Transparență (DSA).',
      ] },
      { h: '9. Răspundere', p: [
        'Nu verificăm fiecare produs și nu garantăm calitatea, siguranța sau legalitatea produselor vândute de utilizatori. Răspundem pentru serviciile pe care le prestăm noi, în limitele legii. Nimic din acești termeni nu limitează răspunderea pentru dol sau culpă gravă ori drepturile tale imperative de consumator.',
      ] },
      { h: '10. Conținutul tău', p: [
        'Textele și pozele publicate rămân ale tale. Ne acorzi o licență neexclusivă, gratuită, valabilă cât timp conținutul este pe platformă, pentru a-l găzdui, afișa și adapta tehnic (de exemplu miniaturi). Marca și designul Cumped ne aparțin.',
      ] },
      { h: '11. Încetarea', p: [
        'Poți șterge contul oricând din Setări → Confidențialitate. Putem închide contul în caz de încălcări grave sau repetate, cu notificare și motivare, cu excepția cazurilor în care legea ne interzice să te informăm.',
      ] },
      { h: '12. Modificări', p: [
        'Te anunțăm despre modificările importante cu cel puțin 15 zile înainte, în aplicație și pe email. Dacă nu ești de acord, poți închide contul înainte de intrarea lor în vigoare.',
      ] },
      { h: '13. Legea aplicabilă și litigii', p: [
        'Se aplică legea română, fără a te priva de protecția legii din țara ta de reședință, dacă ești consumator. Pentru reclamații ne poți scrie la {email}. În România, poți apela și la procedurile de soluționare alternativă a litigiilor (SAL) ale ANPC.',
      ] },
    ],
  },
  privacy: {
    title: 'Politica de confidențialitate', updated: '2026-11-09',
    sections: [
      { h: '1. Operatorul', p: [
        'Operatorul datelor tale este {company}, {address}, email {email}. Pentru orice întrebare despre datele personale ne poți scrie la {dpo}.',
      ] },
      { h: '2. Ce date prelucrăm', p: [
        'Cont: email, username, parola (stocată doar ca hash bcrypt), limba, țara, orașul, preferințe. Verificare (opțional): numele de pe act și data verificării; numărul de telefon verificat (nu e afișat nimănui).',
        'Activitate: anunțuri și poze (eliminăm automat metadatele, inclusiv locația GPS, la încărcare), mesaje, oferte, recenzii, favorite, căutări salvate, blocări, raportări și conversațiile cu Velo AI.',
        'Date tehnice: adresa IP și jurnale de securitate (pentru prevenirea abuzurilor și limitarea cererilor), tipul dispozitivului. Plăți: procesate de furnizorii de plată; nu stocăm datele cardului.',
      ] },
      { h: '3. De ce și pe ce temei', p: [
        'Pentru a-ți oferi serviciul (art. 6 alin. 1 lit. b GDPR): cont, anunțuri, chat, oferte, plăți. Pentru obligații legale (lit. c): DSA, contabilitate, cereri ale autorităților. Pentru interesul nostru legitim (lit. f): securitate, prevenirea fraudelor și a țepelor, moderare, îmbunătățirea serviciului. Pe baza consimțământului (lit. a): notificări push și comunicări de marketing, pe care le poți retrage oricând.',
      ] },
      { h: '4. Velo AI și decizii automate', p: [
        'Folosim un model de inteligență artificială (furnizor: Anthropic) pentru a răspunde la întrebări, a clasifica raportările și a detecta tentativele de fraudă. Trimitem doar datele necesare cazului. Măsurile automate (ascunderea unui anunț, suspendarea unui cont) sunt temporare și sunt confirmate sau anulate de un om; nu luăm decizii exclusiv automatizate cu efecte juridice asupra ta (art. 22 GDPR).',
      ] },
      { h: '5. Cui transmitem datele', p: [
        'Furnizori care ne ajută să operăm serviciul, pe bază de contract: găzduire și stocare, trimitere de emailuri, plăți și verificarea identității (ex. Stripe), inteligență artificială (Anthropic), autentificare și notificări (Apple, Google). Autorităților, doar când legea o cere. Nu vindem datele tale și nu le folosim pentru reclame personalizate.',
        'Când datele ajung în afara Spațiului Economic European, folosim garanțiile prevăzute de GDPR (decizii de adecvare, inclusiv EU-US Data Privacy Framework, sau clauze contractuale standard).',
      ] },
      { h: '6. Cât timp păstrăm datele', p: [
        'Cât timp ai cont. După ștergerea contului, ștergem sau anonimizăm datele în cel mult 30 de zile, cu excepția: documentelor contabile (10 ani, conform legii), deciziilor de moderare și raportărilor (până la 6 luni după închiderea cazului, pentru contestații) și jurnalelor de securitate (90 de zile).',
      ] },
      { h: '7. Drepturile tale', p: [
        'Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție, precum și dreptul de a-ți retrage consimțământul. Poți descărca datele din Setări → Confidențialitate → Descarcă datele mele și poți șterge contul din același loc. Ai dreptul să depui plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (www.dataprotection.ro) sau la autoritatea din țara ta.',
      ] },
      { h: '8. Securitate', p: [
        'Folosim conexiuni criptate (HTTPS), parole stocate doar ca hash, sesiuni de scurtă durată cu reîmprospătare securizată, limitarea încercărilor de autentificare, verificarea automată a mesajelor pentru tentative de fraudă și acces restrâns la date în echipă.',
      ] },
      { h: '9. Minori, urmărire și cookie-uri', p: [
        'Serviciul este destinat persoanelor de cel puțin 18 ani. Nu urmărim utilizatorii în alte aplicații sau site-uri, nu folosim identificatorul de publicitate al dispozitivului și nu folosim cookie-uri de publicitate sau de analiză de la terți. Detalii în pagina Cookie-uri.',
      ] },
    ],
  },
  rules: {
    title: 'Regulile comunității', updated: '2026-11-09',
    sections: [
      { h: 'Ce nu poți vinde', p: [
        'Arme de foc, muniție, explozibili, arme interzise și piese pentru acestea; droguri, substanțe psihoactive și accesorii pentru consum; medicamente, produse cu prescripție și dispozitive medicale care necesită autorizare; tutun și produse cu nicotină vândute fără respectarea legii.',
        'Produse contrafăcute, furate sau obținute ilegal; documente oficiale, permise, diplome, conturi și date personale; bani, monede false, carduri de plată.',
        'Animale din specii protejate sau produse din acestea; animale vii cu scop comercial (sunt permise doar adopțiile, cu respectarea legii); organe, țesuturi sau fluide umane.',
        'Conținut sexual explicit sau servicii sexuale; produse rechemate sau periculoase; pariuri, scheme piramidale; servicii ilegale; orice produs a cărui vânzare este interzisă în țara ta sau a cumpărătorului.',
      ] },
      { h: 'Cum ne comportăm', p: [
        'Fii corect: descrie produsul așa cum este, cu pozele lui reale. Nu cere plata în avans prin linkuri, transferuri către necunoscuți sau aplicații externe. Nu cere și nu trimite date de card sau coduri primite prin SMS.',
        'Fii respectuos: fără jigniri, hărțuire, amenințări, discriminare sau limbaj de ură. Nu trimite spam și nu manipula recenziile.',
        'Un singur cont per persoană. Nu ocoli o suspendare creând conturi noi.',
      ] },
      { h: 'Ce se întâmplă la încălcări', p: [
        'Putem elimina conținutul, restricționa funcții, suspenda temporar sau închide contul, în funcție de gravitate și de repetare. Primești decizia motivată și o poți contesta din aplicație. Suspendăm, după avertizare, și conturile care trimit frecvent raportări vădit nefondate (art. 23 DSA).',
      ] },
      { h: 'Raportează', p: [
        'Folosește butonul „Raportează” de pe anunț, profil sau mesaj, ori scrie-i lui Velo. Titularii de drepturi de proprietate intelectuală pot raporta încălcările alegând motivul „Încalcă drepturi de autor / marcă”.',
      ] },
    ],
  },
  dsa: {
    title: 'Transparență (DSA)', updated: '2026-11-09',
    sections: [
      { h: 'Punct unic de contact', p: [
        'Pentru autorități (art. 11 DSA) și pentru utilizatori (art. 12 DSA): {email}. Răspundem în română și engleză.',
      ] },
      { h: 'Notificare și acțiune', p: [
        'Oricine poate raporta conținut ilegal sau care încalcă regulile din aplicație, indicând motivul, explicația și confirmând buna-credință (art. 16 DSA). Primești confirmarea primirii și, ulterior, decizia. Raportările semnalizatorilor de încredere sunt tratate cu prioritate (art. 22 DSA).',
      ] },
      { h: 'Decizii motivate și contestații', p: [
        'Când eliminăm sau restricționăm conținut ori conturi, trimitem o expunere de motive (art. 17 DSA): ce s-a decis, temeiul, dacă decizia a fost automată și cum se poate contesta. Contestațiile (art. 20 DSA) sunt analizate de oameni. Poți apela și la soluționarea extrajudiciară (art. 21 DSA).',
      ] },
      { h: 'Moderare automată', p: [
        'Folosim reguli automate și Velo AI pentru a detecta linkuri de plată suspecte, cereri de date de card, conținut jignitor și produse interzise. Măsurile automate cu impact (ascunderea anunțului, suspendarea contului) sunt temporare până la verificarea umană.',
      ] },
      { h: 'Sisteme de recomandare (art. 27)', p: [
        'Parametrii principali: potrivirea cu textul căutat, data publicării, filtrele alese de tine (categorie, preț, stare, țară, livrare) și promovarea plătită. „Anunțuri similare” folosește aceeași categorie și cuvinte din titlu. Poți alege oricând ordonarea după dată sau preț, care nu se bazează pe profilare.',
      ] },
      { h: 'Publicitate (art. 26, 28)', p: [
        'Singura formă de publicitate este promovarea anunțurilor de către vânzători, marcată „Promovat”, cu vânzătorul vizibil pe anunț. Nu afișăm reclame bazate pe profilare și nu folosim date sensibile.',
      ] },
      { h: 'Trasabilitatea comercianților (art. 30–31)', p: [
        'Vânzătorii profesioniști își declară denumirea, adresa, numărul de înregistrare, codul fiscal și datele de contact, care sunt afișate pe anunțuri. Platforma le permite să afișeze informațiile cerute de legislația consumatorilor.',
      ] },
      { h: 'Rapoarte de transparență', p: [
        'Publicăm anual numărul de raportări, decizii, contestații, timpii de răspuns și utilizarea moderării automate, precum și numărul mediu lunar de destinatari activi ai serviciului în UE.',
      ] },
    ],
  },
  cookies: {
    title: 'Cookie-uri și stocare locală', updated: '2026-11-09',
    sections: [
      { h: 'Ce folosim', p: [
        'Un singur cookie strict necesar, „cmp_rt”, care te păstrează autentificat în siguranță (HttpOnly, Secure, SameSite=Strict, valabil cel mult 30 de zile).',
        'Stocare locală pe dispozitiv pentru preferințe: limba, tema, modul economic și dacă ai văzut ecranul de bun venit.',
      ] },
      { h: 'Ce nu folosim', p: [
        'Nu folosim cookie-uri de publicitate, de urmărire sau de analiză de la terți, așa că nu îți cerem consimțământ pentru ele. Dacă vom adăuga vreodată astfel de instrumente, îți vom cere acordul înainte.',
      ] },
    ],
  },
  about: {
    title: 'Despre companie', updated: '2026-11-09',
    sections: [
      { h: 'Operatorul platformei', p: ['{company}', 'Sediu: {address}', 'Nr. înregistrare: {regNo} · CUI: {vat}', 'Email: {email}'] },
      { h: 'Ajutor', p: ['Pentru întrebări, probleme cu o tranzacție sau raportări, scrie-i lui Velo din aplicație. Tichetele ajung la echipa noastră la {email}.'] },
    ],
  },
  'delete-account': {
    title: 'Ștergerea contului Cumped', updated: '2026-11-09',
    sections: [
      { h: 'Din aplicație', p: [
        'Deschide Profil → Setări → Confidențialitate → Șterge contul și confirmă. Ștergerea e imediată pentru profil și anunțuri.',
      ] },
      { h: 'Fără aplicație', p: [
        'Trimite un email de la adresa contului tău la {email}, cu subiectul „Ștergere cont”. Confirmăm identitatea și ștergem contul în cel mult 30 de zile.',
      ] },
      { h: 'Ce ștergem și ce păstrăm', p: [
        'Imediat: profilul este anonimizat (email, nume, telefon, date de firmă), anunțurile sunt retrase și pozele lor șterse, iar favoritele, căutările salvate, notificările și conversațiile cu Velo sunt șterse. Mesajele pe care le-ai trimis rămân vizibile doar celeilalte persoane din conversație, fără numele tău, iar recenziile lăsate altora rămân anonime.',
        'Păstrăm doar ce cere legea: documentele contabile (10 ani), deciziile de moderare și raportările (până la 6 luni după închiderea cazului) și jurnalele de securitate (90 de zile).',
      ] },
    ],
  },
};
export default docs;
