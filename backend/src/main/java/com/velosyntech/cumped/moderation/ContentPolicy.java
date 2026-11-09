package com.velosyntech.cumped.moderation;

import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Politica de conținut: articole interzise la vânzare și limbaj jignitor.
 * Cerută de App Store (ghidul 1.2 – conținut generat de utilizatori) și de Google Play,
 * și de DSA (platforma acționează asupra conținutului ilegal). Lista se poate extinde.
 */
@Component
public class ContentPolicy {
    public enum Verdict { OK, PROHIBITED_ITEM, OFFENSIVE_CONTENT }

    /** Expresii pentru articole interzise (forme fără diacritice; potrivire pe cuvinte întregi). */
    private static final List<String> PROHIBITED = List.of(
            // arme, muniție, explozibili
            "arma de foc", "arme de foc", "pistol glock", "pistol de calibru", "revolver", "pusca de vanatoare", "kalasnikov",
            "ak47", "ak 47", "munitie", "cartuse de vanatoare", "gloante", "explozibil", "explozivi", "grenada", "dinamita",
            "firearm", "ammunition", "handgun",
            // droguri și medicamente cu rețetă
            "droguri", "drog", "cannabis", "marijuana", "canabis", "iarba de fumat", "cocaina", "heroina", "ecstasy", "mdma",
            "metamfetamina", "lsd", "ciuperci halucinogene", "steroizi", "anabolizante", "xanax", "oxicodona", "tramadol",
            "fara reteta", "medicamente cu reteta", "cocaine", "heroin", "weed",
            // contrafaceri și documente false
            "replica", "replici", "copie 1:1", "copie fidela", "aaa quality", "first copy", "counterfeit", "fake brand",
            "acte false", "buletin fals", "pasaport fals", "permis fals", "diploma falsa", "diplome false", "fake id",
            // fraude financiare
            "carduri clonate", "conturi bancare de vanzare", "cont bancar de vanzare", "bani falsi",
            "bancnote false", "skimmer", "spalare de bani",
            // bunuri furate, persoane, specii protejate
            "bunuri furate de vanzare", "fara acte de provenienta", "rinichi de vanzare", "organe umane", "fildes", "colti de elefant",
            "animale salbatice protejate", "specie protejata",
            // tutun de contrabandă și servicii pentru adulți
            "tigari de contrabanda", "tigari fara timbru", "servicii sexuale", "servicii de escorta", "escort services");

    /** Limbaj vulgar / jignitor grav (folosit pentru blocarea mesajelor și a anunțurilor). */
    private static final List<String> OFFENSIVE = List.of(
            "muie", "pula", "pizda", "futu-ti", "futu ti", "fute", "curva", "tarfa", "bulangiu", "poponar", "retardat",
            "fuck", "fucking", "motherfucker", "cunt", "bitch", "retard", "whore");

    private static final Pattern PROHIBITED_RX = compile(PROHIBITED);
    private static final Pattern OFFENSIVE_RX = compile(OFFENSIVE);

    public Verdict check(String text) {
        if (text == null || text.isBlank()) return Verdict.OK;
        String t = fold(text);
        if (PROHIBITED_RX.matcher(t).find()) return Verdict.PROHIBITED_ITEM;
        if (OFFENSIVE_RX.matcher(t).find()) return Verdict.OFFENSIVE_CONTENT;
        return Verdict.OK;
    }

    public boolean offensive(String text) {
        return text != null && OFFENSIVE_RX.matcher(fold(text)).find();
    }

    static String fold(String s) {
        return Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "").replaceAll("\\s+", " ");
    }

    private static Pattern compile(List<String> words) {
        StringBuilder b = new StringBuilder("(?<![\\p{L}\\p{N}])(?:");
        for (int i = 0; i < words.size(); i++) {
            if (i > 0) b.append('|');
            b.append(Pattern.quote(words.get(i)));
        }
        return Pattern.compile(b.append(")(?![\\p{L}\\p{N}])").toString());
    }
}
