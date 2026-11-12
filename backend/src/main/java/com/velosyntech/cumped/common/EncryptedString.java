package com.velosyntech.cumped.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Convertor JPA: câmpul e criptat în baza de date și decriptat doar în memorie. */
@Converter
public class EncryptedString implements AttributeConverter<String, String> {
    @Override public String convertToDatabaseColumn(String v) { return FieldCrypto.encrypt(v); }
    @Override public String convertToEntityAttribute(String v) { return FieldCrypto.decrypt(v); }
}
