import type { Category } from './lib'

export interface CatalogItem { name: string; category: Category; consumable?: boolean; unit?: string }

const list = (category: Category, names: string, consumables: Record<string, string> = {}) =>
  names.split('|').map((raw) => {
    const name = raw.trim()
    return { name, category, ...(consumables[name] ? { consumable: true, unit: consumables[name] } : {}) }
  })

// Sélection de départ volontairement pratique; la saisie libre reste disponible.
export const ITEM_CATALOG: CatalogItem[] = [
  ...list('outils', 'Perceuse-visseuse|Perforateur|Meuleuse d’angle|Scie circulaire|Scie sauteuse|Ponceuse excentrique|Compresseur|Aspirateur de chantier|Établi|Étau|Cric hydraulique|Chandelles|Jeu de tournevis|Jeu de clés Allen|Clé à molette|Clé à cliquet et douilles|Clé dynamométrique|Pince multiprise|Pince coupante|Marteau|Serre-joints|Cutter|Mètre ruban|Niveau à bulle|Pied à coulisse|Rallonge électrique|Lampe d’atelier|Lunettes de protection|Gants de bricolage|Masque antipoussière'),
  ...list('outils', 'Vis assorties|Boulons et écrous|Chevilles assorties|Clous|Colliers de serrage|Serre-câbles|Ruban adhésif|Papier abrasif|Disques abrasifs|Forets assortis|Embouts de vissage|Lames de scie', { 'Vis assorties': 'boîtes', 'Boulons et écrous': 'boîtes', 'Chevilles assorties': 'boîtes', 'Clous': 'boîtes', 'Colliers de serrage': 'pièces', 'Serre-câbles': 'pièces', 'Papier abrasif': 'feuilles', 'Disques abrasifs': 'pièces' }),
  ...list('nettoyage', 'Balai et pelle|Brosse d’atelier|Brosse métallique|Seau|Éponge|Chiffons microfibre|Pulvérisateur|Aspirateur|Entonnoir|Jerrican|Dégraissant atelier|Nettoyant freins|Nettoyant multiusage|Huile pénétrante|Lubrifiant silicone|Graisse mécanique', { 'Chiffons microfibre': 'pièces', 'Dégraissant atelier': 'L', 'Nettoyant freins': 'aérosols', 'Graisse mécanique': 'g' }),
  ...list('peinture', 'Peinture murale|Peinture bois|Peinture métal|Peinture aérosol|Sous-couche|Vernis|Lasure|Enduit de rebouchage|Pâte à bois|Mastic silicone|Colle à bois|Colle époxy|Colle PVC|Bâche de protection|Rouleau peinture|Pinceaux|Bac à peinture', { 'Peinture murale': 'L', 'Peinture bois': 'L', 'Peinture métal': 'L', 'Sous-couche': 'L', 'Vernis': 'L', 'Lasure': 'L', 'Enduit de rebouchage': 'kg', 'Colle à bois': 'ml' }),
  ...list('electro', 'Lampe torche|Lampe frontale|Piles AA|Piles AAA|Batterie rechargeable|Chargeur USB-C|Multiprise|Câble électrique|Connecteurs électriques|Fusibles auto|Ampoules LED|Multimètre|Testeur de tension|Radio d’atelier'),
  ...list('velo', 'Vélo de ville|VTT|Vélo enfant|Vélo électrique|Remorque vélo|Casque vélo|Antivol vélo|Pompe à pied|Chambre à air|Pneu vélo|Rustines|Kit tubeless|Chaîne vélo|Maillon rapide|Plaquettes de frein|Éclairage vélo|Garde-boue|Porte-bagages|Multi-outil vélo|Pied d’atelier vélo|Lubrifiant chaîne', { 'Chambre à air': 'pièces', 'Pneu vélo': 'pièces', 'Rustines': 'pièces', 'Maillon rapide': 'pièces', 'Plaquettes de frein': 'jeux' }),
  ...list('scooter', 'Trottinette électrique|Scooter électrique|Chargeur scooter|Pneu trottinette|Chambre à air trottinette|Plaquettes de frein scooter|Éclairage scooter|Antivol scooter|Casque scooter|Kit réparation pneus'),
  ...list('sup', 'Stand up paddle gonflable|Pagaie SUP|Aileron SUP|Leash SUP|Pompe haute pression SUP|Kit réparation SUP|Gilet de sauvetage|Sac étanche'),
  ...list('kite', 'Aile de kitesurf|Barre de kitesurf|Lignes de kite|Harnais de kitesurf|Planche de kite|Leash de kite|Pompe de kite|Kit réparation spi|Combinaison kitesurf|Couteau de sécurité'),
  ...list('voile', 'Voile d’Optimist|Grand-voile|Foc|Mât|Bôme|Hauban|Drisse|Écoute|Poulie|Manille|Gilet de sauvetage|VHF portable|Écope|Housse de voile|Kit réparation voile|Sangle de remorque'),
  ...list('meubles', 'Étagère métallique|Rayonnage|Établi|Armoire métallique|Coffre de rangement|Boîte à outils|Bac compartimenté|Organiseur mural|Support mural vélo|Table pliante'),
]
