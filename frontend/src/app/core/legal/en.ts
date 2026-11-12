/**
 * Legal documents (EN). {company}, {address}, {regNo}, {vat}, {email}, {dpo} come from /api/config.
 * Working draft: must be reviewed by a lawyer before launch.
 */
import { LegalDocs } from './types';

const docs: LegalDocs = {
  terms: {
    title: 'Terms & conditions', updated: '2026-11-12',
    sections: [
      { h: '1. Who we are', p: [
        'Cumped is an online platform where individuals and businesses publish listings, negotiate and buy goods and services. It is operated by {company}, registered office {address}, registration no. {regNo}, VAT {vat}, email {email} (“we”).',
        'Cumped is an intermediary (a hosting service under Regulation (EU) 2022/2065, the Digital Services Act, “DSA”). The sales contract is concluded directly between buyer and seller; we are not a party to it, except for the services we sell ourselves (plans, promotions, safe payment).',
      ] },
      { h: '2. Your account', p: [
        'You must be at least 18 and use accurate details. One personal account per person. You are responsible for keeping your password safe and for activity in your account.',
        'Your public name is the username you choose. Identity verification is optional: if you complete it, the name on your ID becomes your account name and is visible only to signed-in, verified users. ID images are processed by the verification provider and are not stored by us.',
      ] },
      { h: '3. Listings', p: [
        'You may only sell what you legally own or are entitled to sell. Description, condition, specifications, price and photos must be accurate and your own. Known defects must be disclosed.',
        'You may not list the items and content banned by the Community rules, duplicate listings, misleading prices or contact details meant to move payment off the platform.',
        'You can set a private minimum price: offers below it are declined automatically without revealing the minimum.',
      ] },
      { h: '4. Offers, counter-offers and swaps', p: [
        'Offers, counter-offers and swap proposals are valid for 48 hours and a negotiation has at most 6 rounds. Accepting an offer records both parties’ agreement on the price; the sale is completed through in-app safe payment or in-person handover.',
        'Never pay through links received in chat, advance transfers to strangers or external apps. Messages requesting such payments may be blocked automatically.',
      ] },
      { h: '5. Prices, fees and payments', p: [
        'During the first year after sign-up you get 2 active listings at a time for free. Beyond that you can buy: extra listing €1.99 / 30 days; Plus plan €4.99 / month (15 active listings); Pro / Business €19.99 / month (100 active listings); promotion €2.99 / 7 days; bump €0.99. Inviting 10 friends who verify their account gives you up to 5 free listings.',
        'Safe payment costs 2.5% of the item value (minimum €0.50, maximum €20) and is paid by the buyer. Prices include VAT where applicable. Plans renew monthly and can be cancelled at any time, effective at the end of the paid period.',
        'In the iOS and Android apps, digital services (plans, promotions) are purchased through Apple’s or Google’s payment system under their rules, including refunds.',
      ] },
      { h: '6. Safe payment, claims and seller protection', p: [
        'With safe payment, the money stays with Cumped until the buyer confirms receipt. If the buyer neither confirms nor files a claim, the money is released to the seller automatically after the inspection period shown in the order. If the seller doesn’t ship in time, the buyer is refunded automatically.',
        'A claim must be filed in the app before the order is completed, with a description and, for any reason other than “not received”, at least 2 photos of the item received. If the seller registered the serial / IMEI at shipping, the buyer must enter the serial of the item received.',
        'For courier items over €300, the seller must photograph the item and the parcel at shipping. The seller has 72 hours to answer a claim with their own evidence. A person on our team decides, based on the photos, the serial, courier data and both parties’ history.',
        'When a claim concerns the condition of the item, the rule is a return: the buyer sends the item back within 7 days with tracking, and the refund is made only after the seller confirms receiving it in the same condition (or automatically if the seller doesn’t react within 14 days of the return being shipped). If the item isn’t sent back in time, the claim is closed and the seller is paid. If the seller receives a different item, the case goes back to the team.',
        'False or abusive claims (for example returning a different item) lose the dispute, lead to account suspension and may be reported to the authorities. Evidence photos are private: only the parties to the order and the Cumped team can see them.',
      ] },
      { h: '7. Reviews', p: [
        'Reviews can only be left after an order completed with safe payment, by the buyer and the seller, one per order, within 30 days. Each review is labelled “Verified purchase” or “Verified sale”, and a profile’s rating is calculated only from these (Art. 7(6) of Directive 2005/29/EC, as amended by Directive (EU) 2019/2161).',
        'We don’t publish reviews that were bought, exchanged for favours or written by people without a real transaction, and we don’t hide negative reviews. Reviews with links, contact details or offensive language are rejected automatically.',
      ] },
      { h: '8. Professional sellers (businesses)', p: [
        'If you sell as part of a business, you must enable the business account and provide the identification details required by Article 30 DSA. Business details are shown on your listings.',
        'Traders must comply with consumer law: pre-contractual information, the 14-day right of withdrawal for distance sales, the legal guarantee of conformity and the rules on prices and discounts.',
        'Sales between private individuals are not covered by consumer protection law; we clearly show whether a seller is a private individual or a business.',
      ] },
      { h: '9. Moderation, decisions and appeals', p: [
        'Listings, messages and reports are analysed automatically (including by Velo AI) and by our team. When risk seems high, we may temporarily hide a listing or temporarily suspend an account pending human review.',
        'We may remove illegal content or content that breaches these terms and restrict or close accounts. We tell you the decision and the reasons for it, as required by Article 17 DSA.',
        'You can appeal any decision free of charge within 6 months, directly in the app (Article 20 DSA). Appeals are reviewed by people. You may also use a certified out-of-court dispute settlement body (Article 21 DSA) or go to court.',
      ] },
      { h: '10. How we rank results', p: [
        'By default, search results are ranked by relevance to your search and by how recently the listing was published. Paid promotions appear higher and are labelled “Promoted”. You can always sort by date or price instead. See the Transparency (DSA) page.',
      ] },
      { h: '11. Liability', p: [
        'We do not inspect every item and do not guarantee the quality, safety or legality of items sold by users. We are liable for the services we provide, within the limits of the law. Nothing in these terms limits liability for fraud or gross negligence or your mandatory consumer rights.',
      ] },
      { h: '12. Your content', p: [
        'Your texts and photos remain yours. You grant us a non-exclusive, royalty-free licence, for as long as the content is on the platform, to host, display and technically adapt it (e.g. thumbnails). The Cumped brand and design belong to us.',
      ] },
      { h: '13. Termination', p: [
        'You can delete your account at any time in Settings → Privacy. We may close accounts for serious or repeated breaches, with notice and reasons, unless the law prohibits informing you.',
      ] },
      { h: '14. Changes', p: [
        'We notify you of significant changes at least 15 days in advance, in the app and by email. If you disagree, you can close your account before they take effect.',
      ] },
      { h: '15. Governing law and disputes', p: [
        'Romanian law applies, without depriving you of the protection of the law of your country of residence if you are a consumer. You can send complaints to {email}. In Romania you may also use the ANPC alternative dispute resolution (ADR) procedures.',
      ] },
    ],
  },
  privacy: {
    title: 'Privacy policy', updated: '2026-11-12',
    sections: [
      { h: '1. Controller', p: ['The controller of your data is {company}, {address}, email {email}. For any data protection question, write to {dpo}.'] },
      { h: '2. What we process', p: [
        'Account: email, username, password (stored only as a bcrypt hash), language, country, city, preferences. Verification (optional): the name on your ID and the verification date; your verified phone number (never shown to anyone).',
        'Activity: listings and photos (we automatically strip metadata, including GPS location, on upload), messages, offers, reviews, favourites, saved searches, blocks, reports and conversations with Velo AI.',
        'Technical: IP address and security logs (to prevent abuse and rate-limit requests), device type. Payments: handled by payment providers; we never store card details.',
      ] },
      { h: '3. Why and on what basis', p: [
        'To provide the service (Art. 6(1)(b) GDPR): account, listings, chat, offers, payments. Legal obligations (c): DSA, accounting, requests from authorities. Our legitimate interests (f): security, fraud and scam prevention, moderation, improving the service. Consent (a): push notifications and marketing, which you can withdraw at any time.',
      ] },
      { h: '4. Velo AI and automated decisions', p: [
        'We use an artificial intelligence model (provider: Anthropic) to answer questions, triage reports and detect fraud attempts. We send only the data needed for the case. Automated measures (hiding a listing, suspending an account) are temporary and confirmed or reversed by a person; we do not take solely automated decisions with legal effects on you (Art. 22 GDPR).',
      ] },
      { h: '5. Who we share data with', p: [
        'Service providers under contract: hosting and storage, email delivery, payments and identity verification (e.g. Stripe), artificial intelligence (Anthropic), sign-in and notifications (Apple, Google). Authorities, only where the law requires. We do not sell your data or use it for personalised ads.',
        'Where data leaves the European Economic Area we rely on GDPR safeguards (adequacy decisions, including the EU-US Data Privacy Framework, or standard contractual clauses).',
      ] },
      { h: '6. How long we keep data', p: [
        'For as long as you have an account. After deletion we erase or anonymise data within 30 days, except: accounting records (10 years, as required by law), moderation decisions and reports (up to 6 months after the case is closed, for appeals) and security logs (90 days). Delivery address and phone are deleted 90 days after the order ends. Evidence photos from a dispute are kept for up to 6 months after the case is closed.',
      ] },
      { h: '7. Your rights', p: [
        'You have the right of access, rectification, erasure, restriction, portability and objection, and to withdraw consent. You can download your data in Settings → Privacy → Download my data and delete your account there too. You can lodge a complaint with the Romanian supervisory authority ANSPDCP (www.dataprotection.ro) or the authority in your country.',
      ] },
      { h: '8. Security', p: [
        'Encrypted connections (HTTPS), passwords stored only as hashes, short-lived sessions with secure refresh, sign-in attempt limits, automatic scanning of messages for fraud attempts and restricted internal access to data. ID names, delivery addresses and phone numbers are encrypted in the database (AES-256-GCM), and dispute evidence photos are only reachable through signed links valid for 2 hours.',
      ] },
      { h: '9. Minors, tracking and cookies', p: [
        'The service is intended for people aged 18 or older. We do not track you across other companies’ apps or websites, do not use the device advertising identifier and do not use third-party advertising or analytics cookies. See the Cookies page.',
      ] },
    ],
  },
  rules: {
    title: 'Community rules', updated: '2026-11-09',
    sections: [
      { h: 'What you can’t sell', p: [
        'Firearms, ammunition, explosives, prohibited weapons and their parts; drugs, psychoactive substances and paraphernalia; medicines, prescription products and medical devices requiring authorisation; tobacco and nicotine products sold in breach of the law.',
        'Counterfeit, stolen or illegally obtained goods; official documents, licences, diplomas, accounts and personal data; money, counterfeit currency, payment cards.',
        'Protected species or products made from them; live animals for commercial purposes (only adoptions are allowed, in line with the law); human organs, tissue or fluids.',
        'Sexually explicit content or sexual services; recalled or dangerous products; gambling, pyramid schemes; illegal services; anything whose sale is prohibited in your or the buyer’s country.',
      ] },
      { h: 'How we behave', p: [
        'Be honest: describe the item as it is, with its real photos. Don’t ask for advance payment via links, transfers to strangers or external apps. Never ask for or send card details or SMS codes.',
        'Be respectful: no insults, harassment, threats, discrimination or hate speech. No spam and no review manipulation.',
        'One account per person. Don’t evade a suspension by creating new accounts.',
      ] },
      { h: 'What happens if rules are broken', p: [
        'We may remove content, restrict features, temporarily suspend or close the account, depending on severity and repetition. You receive a reasoned decision and can appeal in the app. After a warning, we also suspend accounts that frequently submit manifestly unfounded reports (Article 23 DSA).',
      ] },
      { h: 'Report', p: [
        'Use the “Report” button on a listing, profile or message, or write to Velo. Intellectual property rights holders can report infringements by choosing “Copyright / trademark infringement”.',
      ] },
    ],
  },
  dsa: {
    title: 'Transparency (DSA)', updated: '2026-11-09',
    sections: [
      { h: 'Single point of contact', p: ['For authorities (Art. 11 DSA) and users (Art. 12 DSA): {email}. We reply in Romanian and English.'] },
      { h: 'Notice and action', p: [
        'Anyone can report illegal content or content that breaks the rules in the app, giving a reason and explanation and confirming good faith (Art. 16 DSA). You get an acknowledgement and later the decision. Notices from trusted flaggers are handled with priority (Art. 22 DSA).',
      ] },
      { h: 'Statements of reasons and appeals', p: [
        'When we remove or restrict content or accounts, we send a statement of reasons (Art. 17 DSA): what was decided, on what grounds, whether automated means were used and how to appeal. Appeals (Art. 20 DSA) are reviewed by people. Out-of-court settlement is also available (Art. 21 DSA).',
      ] },
      { h: 'Automated moderation', p: [
        'We use automated rules and Velo AI to detect suspicious payment links, requests for card details, offensive content and prohibited items. Automated measures with impact (hiding a listing, suspending an account) are temporary pending human review.',
      ] },
      { h: 'Recommender systems (Art. 27)', p: [
        'Main parameters: match with your search text, publication date, the filters you choose (category, price, condition, country, shipping) and paid promotion. “Similar listings” uses the same category and words from the title. You can always sort by date or price, which does not rely on profiling.',
      ] },
      { h: 'Advertising (Art. 26, 28)', p: [
        'The only advertising is sellers promoting their listings, labelled “Promoted”, with the seller visible on the listing. We do not show profiling-based ads and do not use sensitive data.',
      ] },
      { h: 'Trader traceability (Art. 30–31)', p: [
        'Professional sellers declare their name, address, registration number, tax ID and contact details, which are displayed on their listings. The platform lets them display the information required by consumer law.',
      ] },
      { h: 'Transparency reports', p: [
        'Each year we publish the number of notices, decisions, appeals, response times and use of automated moderation, as well as the average monthly active recipients of the service in the EU.',
      ] },
    ],
  },
  cookies: {
    title: 'Cookies & local storage', updated: '2026-11-09',
    sections: [
      { h: 'What we use', p: [
        'A single strictly necessary cookie, “cmp_rt”, that keeps you securely signed in (HttpOnly, Secure, SameSite=Strict, valid for up to 30 days).',
        'Local storage on your device for preferences: language, theme, lite mode and whether you have seen the welcome screen.',
      ] },
      { h: 'What we don’t use', p: [
        'No advertising, tracking or third-party analytics cookies, so we don’t ask for consent for them. If we ever add such tools, we will ask for your consent first.',
      ] },
    ],
  },
  about: {
    title: 'About the company', updated: '2026-11-09',
    sections: [
      { h: 'Platform operator', p: ['{company}', 'Registered office: {address}', 'Registration no.: {regNo} · VAT: {vat}', 'Email: {email}'] },
      { h: 'Help', p: ['For questions, problems with a transaction or reports, write to Velo in the app. Tickets reach our team at {email}.'] },
    ],
  },
  'delete-account': {
    title: 'Deleting your Cumped account', updated: '2026-11-09',
    sections: [
      { h: 'In the app', p: ['Open Profile → Settings → Privacy → Delete account and confirm. Deletion takes effect immediately.'] },
      { h: 'Without the app', p: ['Email {email} from the address linked to your account with the subject “Delete account”. We confirm your identity and delete the account within 30 days.'] },
      { h: 'What we delete and what we keep', p: [
        'Immediately: your profile is anonymised (email, name, phone, business details), your listings are withdrawn and their photos deleted, and your favourites, saved searches, notifications and Velo conversations are deleted. Messages you sent stay visible only to the other person in that conversation, without your name, and reviews you left stay anonymous.',
        'We keep only what the law requires: accounting records (10 years), moderation decisions and reports (up to 6 months after the case is closed) and security logs (90 days). Delivery address and phone are deleted 90 days after the order ends. Evidence photos from a dispute are kept for up to 6 months after the case is closed.',
      ] },
    ],
  },
};
export default docs;
