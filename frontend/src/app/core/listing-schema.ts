/**
 * Câmpurile structurate ale unui anunț, pe categorii. Valorile se salvează în `attributes` (cheie → text),
 * iar etichetele vin din i18n: `attr.<cheie>` pentru nume și `attrv.<cheie>.<valoare>` pentru opțiuni.
 * Valorile care nu sunt în listă (anunțuri vechi, text liber) se afișează așa cum au fost scrise.
 */
export type FieldType = 'text' | 'number' | 'select' | 'bool';

export interface FieldDef {
  key: string;
  type: FieldType;
  options?: string[];
  /** Sugestii pentru câmpurile text (datalist). */
  suggest?: string[];
  unit?: string;
  min?: number;
  max?: number;
  required?: boolean;
  /** Ocupă tot rândul în formular. */
  wide?: boolean;
  /** Apare în „pe scurt” (fapte cheie) pe pagina anunțului. */
  key_fact?: boolean;
  icon?: string;
}

export interface FieldGroup { key: string; icon: string; fields: FieldDef[]; }

const YEAR_NOW = new Date().getFullYear();
const BRANDS_PHONE = ['Apple', 'Samsung', 'Xiaomi', 'Google', 'OnePlus', 'Huawei', 'Motorola', 'Nokia', 'Oppo', 'Sony', 'Honor', 'Realme'];
const BRANDS_PC = ['Apple', 'Lenovo', 'HP', 'Dell', 'Asus', 'Acer', 'MSI', 'Microsoft', 'Samsung', 'Razer'];
const BRANDS_CAR = ['Audi', 'BMW', 'Dacia', 'Ford', 'Hyundai', 'Kia', 'Mercedes-Benz', 'Opel', 'Peugeot', 'Renault', 'Skoda', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'];
const STORAGE = ['16', '32', '64', '128', '256', '512', '1024', '2048'];

const brand = (suggest?: string[], required = false): FieldDef => ({ key: 'brand', type: 'text', suggest, required, key_fact: true, icon: 'pricetag-outline' });
const model = (required = false): FieldDef => ({ key: 'model', type: 'text', required, key_fact: true, icon: 'cube-outline' });
const color: FieldDef = { key: 'color', type: 'text', icon: 'color-palette-outline' };

/** Stare, acte și ce primește cumpărătorul — comune pentru bunuri fizice. */
const CONDITION_GROUP: FieldGroup = {
  key: 'condition', icon: 'document-text-outline', fields: [
    { key: 'purchase_year', type: 'number', min: 1950, max: YEAR_NOW },
    { key: 'invoice', type: 'bool' },
    { key: 'original_box', type: 'bool' },
    { key: 'warranty', type: 'text' },
    { key: 'accessories', type: 'text', wide: true },
    { key: 'defects', type: 'text', wide: true },
    { key: 'reason_for_selling', type: 'text', wide: true },
  ],
};

export const SCHEMA: Record<string, FieldGroup[]> = {
  PHONES: [
    { key: 'device', icon: 'phone-portrait-outline', fields: [
      brand(BRANDS_PHONE, true), model(true),
      { key: 'storage', type: 'select', options: STORAGE.slice(0, 7), unit: 'GB', key_fact: true, icon: 'server-outline' },
      { key: 'ram', type: 'select', options: ['2', '3', '4', '6', '8', '12', '16'], unit: 'GB' },
      color,
      { key: 'battery_health', type: 'number', unit: '%', min: 0, max: 100, key_fact: true, icon: 'battery-half-outline' },
      { key: 'network_lock', type: 'select', options: ['unlocked', 'locked'], key_fact: true, icon: 'lock-open-outline' },
      { key: 'dual_sim', type: 'bool' },
      { key: 'esim', type: 'bool' },
      { key: 'screen_condition', type: 'select', options: ['perfect', 'micro_scratches', 'scratched', 'cracked'] },
    ] },
    CONDITION_GROUP,
  ],
  ELECTRONICS: [
    { key: 'device', icon: 'hardware-chip-outline', fields: [
      { key: 'device_type', type: 'select', options: ['tv', 'audio', 'headphones', 'console', 'camera', 'smartwatch', 'tablet', 'appliance', 'drone', 'other'], key_fact: true, icon: 'apps-outline' },
      brand(['Apple', 'Samsung', 'Sony', 'LG', 'Philips', 'Bose', 'JBL', 'Canon', 'Nikon', 'Nintendo', 'Xbox', 'DJI', 'Garmin']), model(),
      color,
      { key: 'storage', type: 'select', options: STORAGE, unit: 'GB' },
      { key: 'screen_size', type: 'text' },
      { key: 'connectivity', type: 'text' },
      { key: 'battery_life', type: 'text' },
      { key: 'battery_health', type: 'number', unit: '%', min: 0, max: 100 },
      { key: 'shutter_count', type: 'number', min: 0 },
      { key: 'energy_class', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
    ] },
    CONDITION_GROUP,
  ],
  COMPUTERS: [
    { key: 'device', icon: 'laptop-outline', fields: [
      { key: 'device_type', type: 'select', options: ['laptop', 'desktop', 'tablet', 'monitor', 'component', 'accessory'], key_fact: true, icon: 'apps-outline' },
      brand(BRANDS_PC, true), model(),
      { key: 'processor', type: 'text', key_fact: true, icon: 'hardware-chip-outline' },
      { key: 'ram', type: 'select', options: ['4', '8', '16', '18', '24', '32', '36', '48', '64', '96', '128'], unit: 'GB', key_fact: true, icon: 'speedometer-outline' },
      { key: 'storage', type: 'select', options: ['128', '256', '512', '1024', '2048', '4096'], unit: 'GB', key_fact: true, icon: 'server-outline' },
      { key: 'storage_type', type: 'select', options: ['ssd', 'hdd', 'hybrid'] },
      { key: 'gpu', type: 'text' },
      { key: 'screen_size', type: 'text' },
      { key: 'battery_cycles', type: 'number', min: 0 },
      { key: 'os', type: 'text', suggest: ['Windows 11', 'macOS', 'Linux', 'ChromeOS', 'iPadOS', 'Android'] },
      { key: 'keyboard_layout', type: 'text' },
    ] },
    CONDITION_GROUP,
  ],
  VEHICLES: [
    { key: 'vehicle', icon: 'car-sport-outline', fields: [
      brand(BRANDS_CAR, true), model(true),
      { key: 'year', type: 'number', min: 1950, max: YEAR_NOW + 1, required: true, key_fact: true, icon: 'calendar-outline' },
      { key: 'mileage_km', type: 'number', unit: 'km', min: 0, max: 2_000_000, required: true, key_fact: true, icon: 'speedometer-outline' },
      { key: 'fuel', type: 'select', options: ['petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric', 'lpg'], required: true, key_fact: true, icon: 'flash-outline' },
      { key: 'gearbox', type: 'select', options: ['manual', 'automatic'], key_fact: true, icon: 'git-commit-outline' },
      { key: 'body_type', type: 'select', options: ['sedan', 'hatchback', 'estate', 'suv', 'coupe', 'convertible', 'van', 'pickup', 'minivan'] },
      { key: 'engine_cc', type: 'number', unit: 'cm³', min: 0, max: 10000 },
      { key: 'power_hp', type: 'number', unit: 'CP', min: 0, max: 2000 },
      { key: 'drive', type: 'select', options: ['fwd', 'rwd', 'awd'] },
      { key: 'range_km', type: 'number', unit: 'km', min: 0, max: 2000 },
      { key: 'emission_class', type: 'select', options: ['euro3', 'euro4', 'euro5', 'euro6', 'euro6d', 'euro7'] },
      color,
      { key: 'doors', type: 'select', options: ['2', '3', '4', '5'] },
      { key: 'seats', type: 'number', min: 1, max: 9 },
      { key: 'vin', type: 'text' },
    ] },
    { key: 'history', icon: 'shield-checkmark-outline', fields: [
      { key: 'first_owner', type: 'bool' },
      { key: 'service_book', type: 'bool' },
      { key: 'accident_free', type: 'bool' },
      { key: 'registered_ro', type: 'bool' },
      { key: 'itp_valid_until', type: 'text' },
      { key: 'warranty', type: 'text' },
      { key: 'defects', type: 'text', wide: true },
    ] },
  ],
  AUTO_PARTS: [
    { key: 'part', icon: 'construct-outline', fields: [
      { key: 'part_type', type: 'text', required: true, key_fact: true, icon: 'construct-outline' },
      brand(), { key: 'part_number', type: 'text', key_fact: true, icon: 'barcode-outline' },
      { key: 'compatible_with', type: 'text', wide: true, key_fact: true, icon: 'car-outline' },
      { key: 'part_side', type: 'select', options: ['left', 'right', 'front', 'rear', 'na'] },
    ] },
    CONDITION_GROUP,
  ],
  REAL_ESTATE: [
    { key: 'property', icon: 'home-outline', fields: [
      { key: 'offer_type', type: 'select', options: ['sale', 'rent'], required: true, key_fact: true, icon: 'key-outline' },
      { key: 'property_type', type: 'select', options: ['apartment', 'house', 'land', 'commercial', 'office', 'garage'], required: true, key_fact: true, icon: 'business-outline' },
      { key: 'rooms', type: 'number', min: 1, max: 30, key_fact: true, icon: 'grid-outline' },
      { key: 'area_sqm', type: 'number', unit: 'm²', min: 1, max: 100000, required: true, key_fact: true, icon: 'resize-outline' },
      { key: 'land_sqm', type: 'number', unit: 'm²', min: 0 },
      { key: 'bathrooms', type: 'number', min: 0, max: 20 },
      { key: 'floor', type: 'text' },
      { key: 'total_floors', type: 'number', min: 0, max: 200 },
      { key: 'year_built', type: 'number', min: 1800, max: YEAR_NOW + 3 },
      { key: 'partition', type: 'select', options: ['detached', 'semi_detached', 'non_detached'] },
    ] },
    { key: 'amenities', icon: 'sparkles-outline', fields: [
      { key: 'heating', type: 'select', options: ['own_boiler', 'district', 'underfloor', 'heat_pump', 'stove', 'none'] },
      { key: 'furnished', type: 'select', options: ['yes', 'partial', 'no'] },
      { key: 'balcony', type: 'bool' }, { key: 'parking', type: 'bool' }, { key: 'elevator', type: 'bool' },
      { key: 'energy_class', type: 'select', options: ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] },
      { key: 'available_from', type: 'text' },
    ] },
  ],
  HOME_GARDEN: [
    { key: 'item', icon: 'bed-outline', fields: [
      { key: 'item_type', type: 'text', key_fact: true, icon: 'apps-outline' },
      brand(['IKEA', 'Bosch', 'Philips', 'Dyson', 'Tefal', 'Gorenje', 'Electrolux', 'Kärcher']), model(),
      { key: 'material', type: 'text', key_fact: true, icon: 'layers-outline' },
      { key: 'dimensions', type: 'text', key_fact: true, icon: 'resize-outline' },
      color,
      { key: 'assembly_required', type: 'bool' },
    ] },
    CONDITION_GROUP,
  ],
  FASHION: [
    { key: 'item', icon: 'shirt-outline', fields: [
      { key: 'item_type', type: 'text', icon: 'apps-outline' },
      brand(['Nike', 'Adidas', 'Puma', 'Zara', 'H&M', 'Levi\'s', 'Guess', 'Tommy Hilfiger', 'Calvin Klein', 'New Balance']),
      model(),
      { key: 'size', type: 'text', required: true, key_fact: true, icon: 'resize-outline' },
      { key: 'gender', type: 'select', options: ['women', 'men', 'unisex', 'kids'], key_fact: true, icon: 'people-outline' },
      { key: 'material', type: 'text' }, color,
    ] },
    CONDITION_GROUP,
  ],
  KIDS: [
    { key: 'item', icon: 'happy-outline', fields: [
      { key: 'item_type', type: 'text', key_fact: true, icon: 'apps-outline' },
      brand(), model(),
      { key: 'age_range', type: 'text', key_fact: true, icon: 'calendar-outline' },
      { key: 'gender', type: 'select', options: ['girls', 'boys', 'unisex'] },
      { key: 'size', type: 'text' }, color,
    ] },
    CONDITION_GROUP,
  ],
  SPORTS: [
    { key: 'item', icon: 'bicycle-outline', fields: [
      { key: 'item_type', type: 'text', icon: 'apps-outline' },
      brand(['Shimano', 'Specialized', 'Trek', 'Cube', 'Decathlon', 'Garmin', 'Wilson', 'Head']), model(),
      { key: 'frame_size', type: 'text', key_fact: true, icon: 'resize-outline' },
      { key: 'size', type: 'text' },
      { key: 'material', type: 'text', key_fact: true, icon: 'layers-outline' },
      { key: 'weight_kg', type: 'number', unit: 'kg', min: 0, max: 1000 },
      color,
    ] },
    CONDITION_GROUP,
  ],
  HOBBY: [
    { key: 'item', icon: 'musical-notes-outline', fields: [
      { key: 'item_type', type: 'text', key_fact: true, icon: 'apps-outline' },
      brand(['Yamaha', 'Fender', 'Gibson', 'Roland', 'LEGO', 'Casio']), model(),
      color,
    ] },
    CONDITION_GROUP,
  ],
  BOOKS_MUSIC: [
    { key: 'item', icon: 'book-outline', fields: [
      { key: 'author', type: 'text', key_fact: true, icon: 'person-outline' },
      { key: 'publisher', type: 'text' },
      { key: 'language', type: 'text', key_fact: true, icon: 'language-outline' },
      { key: 'format', type: 'text', key_fact: true, icon: 'albums-outline' },
      { key: 'publication_year', type: 'number', min: 1500, max: YEAR_NOW },
      { key: 'isbn', type: 'text' },
    ] },
    { key: 'condition', icon: 'document-text-outline', fields: [
      { key: 'defects', type: 'text', wide: true }, { key: 'reason_for_selling', type: 'text', wide: true },
    ] },
  ],
  PETS: [
    { key: 'pet', icon: 'paw-outline', fields: [
      { key: 'listing_kind', type: 'select', options: ['adoption', 'accessories', 'services'], required: true, key_fact: true, icon: 'heart-outline' },
      { key: 'species', type: 'text', key_fact: true, icon: 'paw-outline' },
      { key: 'breed', type: 'text' },
      { key: 'age', type: 'text', key_fact: true, icon: 'calendar-outline' },
      { key: 'sex', type: 'select', options: ['male', 'female'] },
      { key: 'vaccinated', type: 'bool' }, { key: 'microchip', type: 'bool' }, { key: 'sterilized', type: 'bool' },
      { key: 'health_card', type: 'bool' },
    ] },
  ],
  SERVICES: [
    { key: 'service', icon: 'build-outline', fields: [
      { key: 'service_type', type: 'text', required: true, key_fact: true, icon: 'build-outline' },
      { key: 'price_unit', type: 'select', options: ['fixed', 'hour', 'day', 'project', 'm2'], key_fact: true, icon: 'cash-outline' },
      { key: 'area_served', type: 'text', key_fact: true, icon: 'map-outline' },
      { key: 'experience_years', type: 'number', min: 0, max: 70 },
      { key: 'availability', type: 'text', wide: true },
      { key: 'invoice_available', type: 'bool' },
    ] },
  ],
  JOBS: [
    { key: 'job', icon: 'briefcase-outline', fields: [
      { key: 'company', type: 'text', key_fact: true, icon: 'business-outline' },
      { key: 'job_type', type: 'select', options: ['full_time', 'part_time', 'freelance', 'internship', 'seasonal'], required: true, key_fact: true, icon: 'time-outline' },
      { key: 'work_mode', type: 'select', options: ['onsite', 'hybrid', 'remote'], key_fact: true, icon: 'home-outline' },
      { key: 'experience_level', type: 'select', options: ['entry', 'mid', 'senior'] },
      { key: 'salary_period', type: 'select', options: ['hour', 'month', 'year'] },
      { key: 'salary_type', type: 'select', options: ['net', 'gross'] },
      { key: 'benefits', type: 'text', wide: true },
    ] },
  ],
  OTHER: [
    { key: 'item', icon: 'cube-outline', fields: [
      { key: 'item_type', type: 'text', key_fact: true, icon: 'apps-outline' },
      brand(), model(),
      { key: 'volume_ml', type: 'number', unit: 'ml', min: 0 },
      color,
    ] },
    CONDITION_GROUP,
  ],
};

export function groupsFor(category: string): FieldGroup[] { return SCHEMA[category] ?? SCHEMA['OTHER']; }

export function fieldsFor(category: string): FieldDef[] { return groupsFor(category).flatMap((g) => g.fields); }

/** Intervalul implicit al sliderului de preț la vânzare (în EUR), ajustat apoi după monedă. */
export const PRICE_RANGE_EUR: Record<string, number> = {
  PHONES: 2500, ELECTRONICS: 4000, COMPUTERS: 5000, VEHICLES: 150000, AUTO_PARTS: 3000, REAL_ESTATE: 1000000,
  HOME_GARDEN: 5000, FASHION: 1500, KIDS: 1000, SPORTS: 6000, HOBBY: 4000, BOOKS_MUSIC: 500, PETS: 1000,
  SERVICES: 5000, JOBS: 10000, OTHER: 5000,
};

/** Curs aproximativ, doar pentru capetele sliderului (nu pentru calcule de bani). */
export const FX_APPROX: Record<string, number> = {
  EUR: 1, RON: 5, USD: 1.1, GBP: 0.85, PLN: 4.3, HUF: 400, BGN: 1.96, CZK: 25, CHF: 0.95, TRY: 38, UAH: 45, MDL: 19.5,
};

export function niceCeil(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
