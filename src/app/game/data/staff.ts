import { StaffDefinition, StaffRole } from '../models/game.models';

/** Postes de l'équipe. Salaires mensuels, avant rareté et traits. */
export const STAFF: StaffDefinition[] = [
  {
    role: 'conseiller', name: 'Inès Valadier', title: 'Conseillère technique', minRank: 'militant', monthlySalary: 650,
    perk: '+40 % sur l’étude des dossiers, et ils s’oublient deux fois moins vite.',
  },
  {
    role: 'community_manager', name: 'Yanis Ferhat', title: 'Community manager', minRank: 'militant', monthlySalary: 600,
    perk: '+0,5 popularité par mois ; vos lives et posts tournent moins souvent au bad buzz.',
  },
  {
    role: 'chauffeur', name: 'Gérard Pichon', title: 'Chauffeur', minRank: 'conseiller_municipal', monthlySalary: 700,
    perk: '+5 énergie par mois : vous travaillez sur la banquette arrière. Risque d’accident de la route réduit.',
  },
  {
    role: 'coach', name: 'Bastien Morel', title: 'Coach média', minRank: 'conseiller_municipal', monthlySalary: 1100,
    perk: '+20 de sang-froid au début de chaque débat.',
  },
  {
    role: 'plume', name: 'Clémence Arnaud', title: 'Plume', minRank: 'conseiller_municipal', monthlySalary: 1300,
    perk: 'Une petite phrase assassine de plus par débat, et les intentions adverses sont plus souvent devinées. Vos discours à l’Assemblée portent davantage.',
  },
  {
    role: 'tresorier', name: 'Jean-Baptiste Roux', title: 'Trésorier', minRank: 'conseiller_municipal', monthlySalary: 850,
    perk: 'Dîners de donateurs +50 %. Bloque toute dépense qui ferait dépasser le plafond légal.',
  },
  {
    role: 'attache_presse', name: 'Margaux Lebon', title: 'Attachée de presse', minRank: 'conseiller_municipal', monthlySalary: 1000,
    perk: 'Les actions « Médias » rapportent 25 % de popularité et d’influence en plus.',
  },
  {
    role: 'sondeur', name: 'Paul-Henri Davout', title: 'Sondeur', minRank: 'conseiller_municipal', monthlySalary: 1200,
    perk: 'Prévisions fiables des votes à l’Assemblée ; +2 de dynamique par mois en campagne.',
  },
  {
    role: 'assistant_parlementaire', name: 'Léa Kervella', title: 'Collaboratrice parlementaire', minRank: 'depute', monthlySalary: 1500,
    perk: 'Le sujet à la une progresse de 2 points de maîtrise par mois ; vos interventions dans l’hémicycle convainquent mieux.',
  },
  {
    role: 'directeur_campagne', name: 'Myriam Haddad', title: 'Directrice de campagne', minRank: 'depute', monthlySalary: 2200,
    perk: '+1 point d’action par mois en campagne ; la dynamique s’érode moins vite.',
  },
  {
    role: 'spin_doctor', name: 'Thibault Kessler', title: 'Spin doctor', minRank: 'depute', monthlySalary: 2600,
    perk: 'L’exposition aux scandales baisse deux fois plus vite ; vos démentis sont plus crédibles.',
  },
  {
    role: 'juriste', name: 'Maître Sophie Arditi', title: 'Avocate', minRank: 'depute', monthlySalary: 2000,
    perk: 'Un quart d’exposition en moins sur chaque affaire ; les risques judiciaires tournent plus souvent en votre faveur.',
  },
  {
    role: 'garde_du_corps', name: 'Commandant Ludovic Brehm', title: 'Officier de sécurité', minRank: 'ministre', monthlySalary: 1800,
    perk: 'Risque d’attentat divisé par deux. La menace qui pèse sur vous retombe plus vite.',
  },
  {
    role: 'chef_cabinet', name: 'Hélène Marchal-Ruiz', title: 'Directrice de cabinet', minRank: 'ministre', monthlySalary: 3000,
    perk: '+1 point d’action par mois au gouvernement ou à l’Élysée ; votre majorité tient mieux.',
  },
  {
    role: 'sherpa', name: 'Arnaud de Ségur', title: 'Conseiller diplomatique', minRank: 'ministre', monthlySalary: 2500,
    perk: 'Prestige international +0,4 par mois ; en temps de guerre, le front tient mieux et les alliés répondent plus vite.',
  },
];

export const STAFF_BY_ROLE = new Map<StaffRole, StaffDefinition>(STAFF.map(s => [s.role, s]));

/** Petite icône de poste (organigramme, cartes) */
export const STAFF_ICONS: Record<StaffRole, string> = {
  conseiller: '📚', community_manager: '📱', chauffeur: '🚗', coach: '🎙️', plume: '✒️', tresorier: '💶',
  attache_presse: '📰', sondeur: '📊', assistant_parlementaire: '🏛️', directeur_campagne: '📣', spin_doctor: '🌀',
  juriste: '⚖️', garde_du_corps: '🛡️', chef_cabinet: '🗂️', sherpa: '🌍',
};
