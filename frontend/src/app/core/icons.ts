import { addIcons } from 'ionicons';
// Generat din numele de iconițe folosite în aplicație (doar acestea intră în bundle).
import {
  add, addCircle, albumsOutline, alertCircle, alertCircleOutline, appsOutline, arrowBack, arrowForward, arrowUndo,
  arrowUp, bagCheckOutline, banOutline, barChartOutline, barcodeOutline, batteryHalfOutline, bedOutline, bicycleOutline,
  body, bookOutline, briefcaseOutline, buildOutline, business, businessOutline, calendarOutline, callOutline, camera,
  carOutline, carSportOutline, cashOutline, chatbubbleEllipsesOutline, chatbubbleOutline, chatbubbles,
  chatbubblesOutline, checkbox, checkmark, checkmarkCircle, chevronDown, chevronForward, chevronUp, close, closeCircle,
  closeCircleOutline, closeOutline, code, colorPaletteOutline, constructOutline, copyOutline, createOutline, cubeOutline,
  desktop, documentTextOutline, downloadOutline, ellipsisHorizontal, eyeOffOutline, eyeOutline, female, filter,
  filterOutline, flag, flagOutline, flashOutline, giftOutline, gitCommitOutline, globeOutline, grid, gridOutline,
  handLeftOutline, happyOutline, hardwareChipOutline, headsetOutline, heart, heartOutline, helpBuoyOutline, home,
  homeOutline, imageOutline, imagesOutline, informationCircleOutline, keyOutline, language, languageOutline, laptop,
  laptopOutline, layersOutline, list, listOutline, locationOutline, lockClosedOutline, lockOpenOutline, logOutOutline,
  logoApple, logoGoogle, male, mapOutline, moonOutline, musicalNotesOutline, notifications, notificationsOutline,
  optionsOutline, pause, pauseOutline, pawOutline, peopleOutline, person, personCircleOutline, personOutline,
  phonePortrait, phonePortraitOutline, playOutline, pricetag, pricetagOutline, pulse, radio, resizeOutline,
  rocketOutline, search, send, serverOutline, settings, settingsOutline, shareSocialOutline, shield, shieldCheckmark,
  shieldCheckmarkOutline, shirtOutline, sparkles, sparklesOutline, speedometerOutline, star, starOutline,
  statsChartOutline, sunnyOutline, swapHorizontal, swapVertical, swapVerticalOutline, text, ticket, ticketOutline, time,
  timeOutline, trashOutline, trendingDown, tv, warning,
} from 'ionicons/icons';

export function registerIcons() {
  addIcons({
    add, addCircle, albumsOutline, alertCircle, alertCircleOutline, appsOutline, arrowBack, arrowForward, arrowUndo,
    arrowUp, bagCheckOutline, banOutline, barChartOutline, barcodeOutline, batteryHalfOutline, bedOutline, bicycleOutline,
    body, bookOutline, briefcaseOutline, buildOutline, business, businessOutline, calendarOutline, callOutline, camera,
    carOutline, carSportOutline, cashOutline, chatbubbleEllipsesOutline, chatbubbleOutline, chatbubbles,
    chatbubblesOutline, checkbox, checkmark, checkmarkCircle, chevronDown, chevronForward, chevronUp, close, closeCircle,
    closeCircleOutline, closeOutline, code, colorPaletteOutline, constructOutline, copyOutline, createOutline, cubeOutline,
    desktop, documentTextOutline, downloadOutline, ellipsisHorizontal, eyeOffOutline, eyeOutline, female, filter,
    filterOutline, flag, flagOutline, flashOutline, giftOutline, gitCommitOutline, globeOutline, grid, gridOutline,
    handLeftOutline, happyOutline, hardwareChipOutline, headsetOutline, heart, heartOutline, helpBuoyOutline, home,
    homeOutline, imageOutline, imagesOutline, informationCircleOutline, keyOutline, language, languageOutline, laptop,
    laptopOutline, layersOutline, list, listOutline, locationOutline, lockClosedOutline, lockOpenOutline, logOutOutline,
    logoApple, logoGoogle, male, mapOutline, moonOutline, musicalNotesOutline, notifications, notificationsOutline,
    optionsOutline, pause, pauseOutline, pawOutline, peopleOutline, person, personCircleOutline, personOutline,
    phonePortrait, phonePortraitOutline, playOutline, pricetag, pricetagOutline, pulse, radio, resizeOutline,
    rocketOutline, search, send, serverOutline, settings, settingsOutline, shareSocialOutline, shield, shieldCheckmark,
    shieldCheckmarkOutline, shirtOutline, sparkles, sparklesOutline, speedometerOutline, star, starOutline,
    statsChartOutline, sunnyOutline, swapHorizontal, swapVertical, swapVerticalOutline, text, ticket, ticketOutline, time,
    timeOutline, trashOutline, trendingDown, tv, warning,
  });
}

export const CATEGORY_ICONS: Record<string, string> = {
  PHONES: 'phone-portrait-outline', ELECTRONICS: 'headset-outline', COMPUTERS: 'laptop-outline', VEHICLES: 'car-sport-outline',
  AUTO_PARTS: 'build-outline', REAL_ESTATE: 'business-outline', HOME_GARDEN: 'home-outline', FASHION: 'shirt-outline',
  KIDS: 'happy-outline', SPORTS: 'bicycle-outline', HOBBY: 'color-palette-outline', BOOKS_MUSIC: 'book-outline', PETS: 'paw-outline',
  SERVICES: 'construct-outline', JOBS: 'briefcase-outline', OTHER: 'cube-outline',
};
