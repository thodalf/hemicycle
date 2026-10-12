import { StaffDefinition, StaffRole } from '../models/game.models';

export const STAFF: StaffDefinition[] = [
  {
    role: 'conseiller', name: 'Inès Valadier', title: 'Conseillère technique', minRank: 'militant', weeklySalary: 150,
    perk: '+40 % sur l’étude des dossiers, et ils s’oublient deux fois moins vite.',
  },
  {
    role: 'coach', name: 'Bastien Morel', title: 'Coach média', minRank: 'conseiller_municipal', weeklySalary: 250,
    perk: '+20 de sang-froid au début de chaque débat.',
  },
  {
    role: 'plume', name: 'Clémence Arnaud', title: 'Plume', minRank: 'conseiller_municipal', weeklySalary: 300,
    perk: 'Une petite phrase assassine de plus par débat, et les intentions adverses sont plus souvent devinées.',
  },
  {
    role: 'tresorier', name: 'Jean-Baptiste Roux', title: 'Trésorier', minRank: 'conseiller_municipal', weeklySalary: 200,
    perk: 'Dîners de donateurs +50 %. Bloque toute dépense qui ferait dépasser le plafond légal.',
  },
  {
    role: 'directeur_campagne', name: 'Myriam Haddad', title: 'Directrice de campagne', minRank: 'depute', weeklySalary: 500,
    perk: '+1 point d’action par semaine en campagne ; la dynamique s’érode moins vite.',
  },
  {
    role: 'spin_doctor', name: 'Thibault Kessler', title: 'Spin doctor', minRank: 'depute', weeklySalary: 600,
    perk: 'L’exposition aux scandales baisse deux fois plus vite ; vos démentis sont plus crédibles.',
  },
];

export const STAFF_BY_ROLE = new Map<StaffRole, StaffDefinition>(STAFF.map(s => [s.role, s]));
