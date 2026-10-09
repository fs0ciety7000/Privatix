// Ordres de rendu des acteurs (liste opaque de three.js : `renderOrder` croissant, puis matériau et
// profondeur). Ils règlent la lisibilité du héros quand un acteur ou le décor passe devant lui :
//  - décor (0) et ennemis (2) d'abord : leur profondeur est écrite ;
//  - silhouette tramée du héros (test de profondeur inversé) : visible là où quelque chose est devant ;
//  - héros ensuite, qui ne se masque donc pas lui-même ;
//  - gros acteur atténué en dernier : pré-passe de profondeur (son volume entier, mais rien à l'écran)
//    puis corps tramé et contour, qui ne gardent que la face avant et le liseré extérieur.
// Les barres de vie (30, 31, sans test de profondeur) restent au-dessus de tout.

/** Ennemis GLB (corps et contour). */
export const ORDER_ENEMY = 2;
/** Silhouette tramée du héros (dessinée AVANT son corps, test de profondeur inversé). */
export const ORDER_HERO_SILHOUETTE = 20;
/** Corps, équipement et contour du héros. */
export const ORDER_HERO = 21;
/** Pré-passe de profondeur d'un acteur atténué (occlusion du héros). */
export const ORDER_FADED_DEPTH = 22;
/** Corps tramé et contour d'un acteur atténué. */
export const ORDER_FADED = 23;
