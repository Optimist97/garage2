export interface ProjectTemplateTask { label: string; qty?: number; unit?: string }
export interface ProjectTemplate {
  id: string; group: string; title: string; summary: string; budget: number | null; notes: string; tasks: ProjectTemplateTask[]
}

// Banque intégrée, sans dépendance réseau. Les templates deviennent des projets normaux après sélection.
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'workbench', group: 'Aménagement', title: 'Rénover l’établi', summary: 'Un plan simple du diagnostic aux finitions.', budget: 120,
    notes: 'Mesurer avant achat. Vérifier la stabilité et protéger les surfaces pendant les travaux.',
    tasks: [
      { label: 'Vider et sécuriser la zone' }, { label: 'Relever les dimensions et vérifier le niveau' },
      { label: 'Vérifier le piètement et les fixations' }, { label: 'Lister et acheter les matériaux', qty: 1, unit: 'liste' },
      { label: 'Préparer, assembler et fixer le plateau' }, { label: 'Poncer et appliquer la finition' }, { label: 'Contrôler la stabilité avant utilisation' },
    ],
  },
  {
    id: 'shelving', group: 'Aménagement', title: 'Installer une étagère de garage', summary: 'Mesures, fixation et rangement par zones.', budget: 90,
    notes: 'Contrôler la nature du mur et utiliser des fixations adaptées à la charge.',
    tasks: [
      { label: 'Mesurer l’espace disponible' }, { label: 'Repérer les réseaux et choisir les fixations' },
      { label: 'Définir le plan et la charge maximale' }, { label: 'Préparer les planches et supports' },
      { label: 'Assembler et vérifier le niveau' }, { label: 'Fixer au mur puis charger progressivement' },
    ],
  },
  {
    id: 'workshop-organizing', group: 'Aménagement', title: 'Organiser l’atelier', summary: 'Zones, inventaire et emplacement de chaque outil.', budget: null,
    notes: 'Garder les produits chimiques et objets lourds dans des zones adaptées et stables.',
    tasks: [
      { label: 'Trier les objets à garder, réparer ou donner' }, { label: 'Définir les zones de travail et de stockage' },
      { label: 'Créer les emplacements dans Garage 2' }, { label: 'Ranger les outils utilisés souvent à portée' },
      { label: 'Étiqueter bacs et étagères' }, { label: 'Vérifier les accès et dégager les circulations' },
    ],
  },
  {
    id: 'paint-room', group: 'Rénovation', title: 'Préparer et peindre une pièce', summary: 'Préparation du support, application et rangement.', budget: 150,
    notes: 'Ventiler correctement et suivre les consignes du fabricant des produits utilisés.',
    tasks: [
      { label: 'Mesurer les surfaces et calculer les quantités' }, { label: 'Protéger sols, prises et mobilier' },
      { label: 'Nettoyer, reboucher et poncer le support' }, { label: 'Appliquer une sous-couche si nécessaire' },
      { label: 'Appliquer les couches de finition' }, { label: 'Nettoyer les outils et trier les restes' },
    ],
  },
  {
    id: 'bike-service', group: 'Entretien', title: 'Révision saisonnière du vélo', summary: 'Contrôle visuel, nettoyage et essai final.', budget: 35,
    notes: 'Remplacer toute pièce structurelle douteuse avant de reprendre la route.',
    tasks: [
      { label: 'Contrôler pneus, roues et pression' }, { label: 'Vérifier freins et usure des patins/plaquettes' },
      { label: 'Nettoyer et lubrifier la transmission' }, { label: 'Contrôler éclairage et serrages visibles' },
      { label: 'Effectuer un essai à faible vitesse' }, { label: 'Noter les pièces à remplacer' },
    ],
  },
  {
    id: 'scooter-service', group: 'Entretien', title: 'Contrôle de la trottinette électrique', summary: 'Vérifications d’usage avant la saison.', budget: 40,
    notes: 'Ne pas ouvrir la batterie. En cas de dommage, échauffement ou anomalie électrique, confier le diagnostic à un professionnel.',
    tasks: [
      { label: 'Inspecter pneus, roues et garde-boue' }, { label: 'Vérifier freins et commande' },
      { label: 'Inspecter câble, connecteur et boîtier sans démontage' }, { label: 'Contrôler éclairage et avertisseur' },
      { label: 'Vérifier la charge et l’autonomie sans laisser sans surveillance' }, { label: 'Faire un essai dans un endroit dégagé' },
    ],
  },
  {
    id: 'water-sports', group: 'Loisirs nautiques', title: 'Préparer le matériel nautique', summary: 'Inspection, nettoyage et rangement de saison.', budget: null,
    notes: 'Suivre les instructions du fabricant et remplacer le matériel de sécurité endommagé.',
    tasks: [
      { label: 'Inspecter coutures, valves, flotteurs et dérives' }, { label: 'Vérifier lignes, sangles et pièces d’usure' },
      { label: 'Nettoyer à l’eau douce puis sécher complètement' }, { label: 'Lister les réparations et pièces manquantes' },
      { label: 'Ranger au sec, à l’abri du soleil et des fortes chaleurs' },
    ],
  },
  {
    id: 'tool-repair', group: 'Réparation', title: 'Diagnostiquer un outil défectueux', summary: 'Consigner le défaut et décider de réparer ou remplacer.', budget: 50,
    notes: 'Débrancher l’outil et retirer la batterie avant toute inspection. Ne pas ouvrir un équipement haute tension.',
    tasks: [
      { label: 'Décrire le symptôme et la date d’apparition' }, { label: 'Débrancher et inspecter l’état extérieur' },
      { label: 'Vérifier la notice et les pièces disponibles' }, { label: 'Demander un devis si une intervention est nécessaire' },
      { label: 'Décider : réparation, remplacement ou recyclage' }, { label: 'Mettre à jour la fiche et le journal d’entretien' },
    ],
  },
  {
    id: 'seasonal-maintenance', group: 'Entretien', title: 'Entretien saisonnier du garage', summary: 'Sécurité, consommables et matériel de saison.', budget: null,
    notes: 'Garder les consignes et fiches de sécurité des produits dans leur emballage d’origine.',
    tasks: [
      { label: 'Vérifier les détecteurs et l’éclairage' }, { label: 'Contrôler les rangements et charges lourdes' },
      { label: 'Vérifier les dates et niveaux des consommables' }, { label: 'Planifier les entretiens en retard' },
      { label: 'Dégager les accès et évacuer les déchets triés' },
    ],
  },
]
