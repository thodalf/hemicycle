/*
 * Grille des capitales (« Metrodoku ») — base de données des 196 États
 * (193 membres de l'ONU + Vatican, Palestine, Kosovo).
 * Drapeaux : l = enclavé, i = insulaire, s = capitale dans l'hémisphère Sud,
 * f = français langue officielle, c = capitale au bord de la mer / de l'océan.
 * Conventions : Amérique centrale et Caraïbes → Amérique du Nord ; Russie, Turquie,
 * Chypre → Europe ; Caucase → Asie ; la Caspienne est un lac (Azerbaïdjan,
 * Kazakhstan, Turkménistan enclavés, Bakou non côtière). Populations : ville-capitale,
 * ordre de grandeur récent.
 */

export type Continent = 'Europe' | 'Afrique' | 'Asie' | 'Amérique du Nord' | 'Amérique du Sud' | 'Océanie';

export interface Capitale {
  country: string;        // nom du pays en français
  capital: string;        // capitale officielle en français
  continent: Continent;
  landlocked: boolean;    // pays sans accès à la mer
  island: boolean;        // pays entièrement insulaire
  south: boolean;         // la capitale est dans l'hémisphère Sud
  french: boolean;        // le français est langue officielle du pays
  coastalCapital: boolean; // la capitale est au bord de la mer ou de l'océan
  pop: number;            // population de la ville-capitale (arrondie)
}

const EU: Continent = 'Europe';
const AF: Continent = 'Afrique';
const AS: Continent = 'Asie';
const AN: Continent = 'Amérique du Nord';
const AM: Continent = 'Amérique du Sud';
const OC: Continent = 'Océanie';

const k = (country: string, capital: string, continent: Continent, pop: number, flags = ''): Capitale => ({
  country,
  capital,
  continent,
  landlocked: flags.indexOf('l') >= 0,
  island: flags.indexOf('i') >= 0,
  south: flags.indexOf('s') >= 0,
  french: flags.indexOf('f') >= 0,
  coastalCapital: flags.indexOf('c') >= 0,
  pop,
});

export const CAPITALES: Capitale[] = [
  // ── Europe (47) ──
  k('Albanie', 'Tirana', EU, 560000),
  k('Allemagne', 'Berlin', EU, 3700000),
  k('Andorre', 'Andorre-la-Vieille', EU, 23000, 'l'),
  k('Autriche', 'Vienne', EU, 2000000, 'l'),
  k('Belgique', 'Bruxelles', EU, 1200000, 'f'),
  k('Biélorussie', 'Minsk', EU, 2000000, 'l'),
  k('Bosnie-Herzégovine', 'Sarajevo', EU, 275000),
  k('Bulgarie', 'Sofia', EU, 1250000),
  k('Chypre', 'Nicosie', EU, 330000, 'i'),
  k('Croatie', 'Zagreb', EU, 770000),
  k('Danemark', 'Copenhague', EU, 650000, 'c'),
  k('Espagne', 'Madrid', EU, 3300000),
  k('Estonie', 'Tallinn', EU, 450000, 'c'),
  k('Finlande', 'Helsinki', EU, 670000, 'c'),
  k('France', 'Paris', EU, 2100000, 'f'),
  k('Grèce', 'Athènes', EU, 650000),           // la commune d'Athènes ne touche pas la mer (Le Pirée)
  k('Hongrie', 'Budapest', EU, 1700000, 'l'),
  k('Irlande', 'Dublin', EU, 590000, 'ic'),
  k('Islande', 'Reykjavik', EU, 140000, 'ic'),
  k('Italie', 'Rome', EU, 2750000),
  k('Kosovo', 'Pristina', EU, 220000, 'l'),
  k('Lettonie', 'Riga', EU, 610000, 'c'),
  k('Liechtenstein', 'Vaduz', EU, 5700, 'l'),
  k('Lituanie', 'Vilnius', EU, 590000),
  k('Luxembourg', 'Luxembourg', EU, 135000, 'lf'),
  k('Macédoine du Nord', 'Skopje', EU, 530000, 'l'),
  k('Malte', 'La Valette', EU, 6000, 'ic'),
  k('Moldavie', 'Chișinău', EU, 640000, 'l'),
  k('Monaco', 'Monaco', EU, 38000, 'fc'),
  k('Monténégro', 'Podgorica', EU, 190000),
  k('Norvège', 'Oslo', EU, 710000, 'c'),
  k('Pays-Bas', 'Amsterdam', EU, 920000),
  k('Pologne', 'Varsovie', EU, 1860000),
  k('Portugal', 'Lisbonne', EU, 550000, 'c'),
  k('Roumanie', 'Bucarest', EU, 1700000),
  k('Royaume-Uni', 'Londres', EU, 8900000, 'i'),
  k('Russie', 'Moscou', EU, 13100000),
  k('Saint-Marin', 'Saint-Marin', EU, 4000, 'l'),
  k('Serbie', 'Belgrade', EU, 1200000, 'l'),
  k('Slovaquie', 'Bratislava', EU, 475000, 'l'),
  k('Slovénie', 'Ljubljana', EU, 295000),
  k('Suède', 'Stockholm', EU, 990000, 'c'),
  k('Suisse', 'Berne', EU, 135000, 'lf'),
  k('Tchéquie', 'Prague', EU, 1350000, 'l'),
  k('Turquie', 'Ankara', EU, 5000000),
  k('Ukraine', 'Kiev', EU, 2950000),
  k('Vatican', 'Vatican', EU, 800, 'l'),

  // ── Asie (46) ──
  k('Afghanistan', 'Kaboul', AS, 4600000, 'l'),
  k('Arabie saoudite', 'Riyad', AS, 7000000),
  k('Arménie', 'Erevan', AS, 1090000, 'l'),
  k('Azerbaïdjan', 'Bakou', AS, 2300000, 'l'),
  k('Bahreïn', 'Manama', AS, 200000, 'ic'),
  k('Bangladesh', 'Dacca', AS, 10300000),
  k('Bhoutan', 'Thimphou', AS, 115000, 'l'),
  k('Birmanie', 'Naypyidaw', AS, 925000),
  k('Brunei', 'Bandar Seri Begawan', AS, 100000, 'ic'), // entièrement sur l'île de Bornéo
  k('Cambodge', 'Phnom Penh', AS, 2300000),
  k('Chine', 'Pékin', AS, 21900000),
  k('Corée du Nord', 'Pyongyang', AS, 3000000),
  k('Corée du Sud', 'Séoul', AS, 9400000),
  k('Émirats arabes unis', 'Abou Dabi', AS, 1500000, 'c'),
  k('Géorgie', 'Tbilissi', AS, 1200000),
  k('Inde', 'Nouvelle-Delhi', AS, 16800000),    // territoire de Delhi
  k('Indonésie', 'Jakarta', AS, 10600000, 'isc'),
  k('Irak', 'Bagdad', AS, 7700000),
  k('Iran', 'Téhéran', AS, 9000000),
  // Israël / Palestine : sièges effectifs des gouvernements.
  k('Israël', 'Jérusalem', AS, 990000),
  k('Japon', 'Tokyo', AS, 14000000, 'ic'),
  k('Jordanie', 'Amman', AS, 4000000),
  k('Kazakhstan', 'Astana', AS, 1400000, 'l'),
  k('Kirghizistan', 'Bichkek', AS, 1100000, 'l'),
  k('Koweït', 'Koweït', AS, 600000, 'c'),
  k('Laos', 'Vientiane', AS, 950000, 'l'),
  k('Liban', 'Beyrouth', AS, 430000, 'c'),
  k('Malaisie', 'Kuala Lumpur', AS, 2000000),
  k('Maldives', 'Malé', AS, 210000, 'ic'),
  k('Mongolie', 'Oulan-Bator', AS, 1700000, 'l'),
  k('Népal', 'Katmandou', AS, 860000, 'l'),
  k('Oman', 'Mascate', AS, 1400000, 'c'),
  k('Ouzbékistan', 'Tachkent', AS, 3000000, 'l'),
  k('Pakistan', 'Islamabad', AS, 1200000),
  k('Palestine', 'Ramallah', AS, 40000),
  k('Philippines', 'Manille', AS, 1850000, 'ic'),
  k('Qatar', 'Doha', AS, 1200000, 'c'),
  k('Singapour', 'Singapour', AS, 5900000, 'ic'),
  k('Sri Lanka', 'Sri Jayawardenepura Kotte', AS, 110000, 'i'),
  k('Syrie', 'Damas', AS, 2500000),
  k('Tadjikistan', 'Douchanbé', AS, 1200000, 'l'),
  k('Thaïlande', 'Bangkok', AS, 5500000),
  k('Timor oriental', 'Dili', AS, 280000, 'isc'),
  k('Turkménistan', 'Achgabat', AS, 1000000, 'l'),
  k('Viêt Nam', 'Hanoï', AS, 8400000),
  k('Yémen', 'Sanaa', AS, 3000000),

  // ── Afrique (54) ──
  k('Afrique du Sud', 'Pretoria', AF, 750000, 's'),
  k('Algérie', 'Alger', AF, 3400000, 'c'),
  k('Angola', 'Luanda', AF, 2800000, 'sc'),
  k('Bénin', 'Porto-Novo', AF, 265000, 'f'),     // sur une lagune, pas sur l'océan
  k('Botswana', 'Gaborone', AF, 250000, 'ls'),
  k('Burkina Faso', 'Ouagadougou', AF, 2500000, 'l'), // français : langue de travail depuis 2023
  k('Burundi', 'Gitega', AF, 135000, 'lsf'),     // capitale politique depuis 2019
  k('Cameroun', 'Yaoundé', AF, 2800000, 'f'),
  k('Cap-Vert', 'Praia', AF, 160000, 'ic'),
  k('Centrafrique', 'Bangui', AF, 890000, 'lf'),
  k('Comores', 'Moroni', AF, 62000, 'isfc'),
  k('Congo', 'Brazzaville', AF, 1900000, 'sf'),
  k('RD Congo', 'Kinshasa', AF, 17000000, 'sf'),
  k('Côte d’Ivoire', 'Yamoussoukro', AF, 360000, 'f'),
  k('Djibouti', 'Djibouti', AF, 600000, 'fc'),
  k('Égypte', 'Le Caire', AF, 10000000),
  k('Érythrée', 'Asmara', AF, 900000),
  k('Eswatini', 'Mbabane', AF, 95000, 'ls'),
  k('Éthiopie', 'Addis-Abeba', AF, 5000000, 'l'),
  k('Gabon', 'Libreville', AF, 800000, 'fc'),
  k('Gambie', 'Banjul', AF, 31000, 'c'),
  k('Ghana', 'Accra', AF, 2300000, 'c'),
  k('Guinée', 'Conakry', AF, 2000000, 'fc'),
  k('Guinée-Bissau', 'Bissau', AF, 490000, 'c'),
  k('Guinée équatoriale', 'Malabo', AF, 300000, 'fc'),
  k('Kenya', 'Nairobi', AF, 4400000, 's'),
  k('Lesotho', 'Maseru', AF, 330000, 'ls'),
  k('Liberia', 'Monrovia', AF, 1500000, 'c'),
  k('Libye', 'Tripoli', AF, 1200000, 'c'),
  k('Madagascar', 'Antananarivo', AF, 1300000, 'isf'),
  k('Malawi', 'Lilongwe', AF, 1100000, 'ls'),
  k('Mali', 'Bamako', AF, 2800000, 'l'),         // français retiré des langues officielles en 2023
  k('Maroc', 'Rabat', AF, 580000, 'c'),
  k('Maurice', 'Port-Louis', AF, 150000, 'isc'),
  k('Mauritanie', 'Nouakchott', AF, 1300000, 'c'),
  k('Mozambique', 'Maputo', AF, 1100000, 'sc'),
  k('Namibie', 'Windhoek', AF, 490000, 's'),
  k('Niger', 'Niamey', AF, 1400000, 'l'),        // charte de 2025 : français langue de travail
  k('Nigeria', 'Abuja', AF, 1200000),
  k('Ouganda', 'Kampala', AF, 1700000, 'l'),
  k('Rwanda', 'Kigali', AF, 1700000, 'lsf'),
  k('Sao Tomé-et-Principe', 'Sao Tomé', AF, 80000, 'ic'),
  k('Sénégal', 'Dakar', AF, 1200000, 'fc'),
  k('Seychelles', 'Victoria', AF, 26000, 'isfc'),
  k('Sierra Leone', 'Freetown', AF, 1200000, 'c'),
  k('Somalie', 'Mogadiscio', AF, 2600000, 'c'),
  k('Soudan', 'Khartoum', AF, 2700000),
  k('Soudan du Sud', 'Djouba', AF, 520000, 'l'),
  k('Tanzanie', 'Dodoma', AF, 770000, 's'),
  k('Tchad', 'N’Djaména', AF, 1500000, 'lf'),
  k('Togo', 'Lomé', AF, 900000, 'fc'),
  k('Tunisie', 'Tunis', AF, 640000, 'c'),
  k('Zambie', 'Lusaka', AF, 2700000, 'ls'),
  k('Zimbabwe', 'Harare', AF, 1500000, 'ls'),

  // ── Amérique du Nord, centrale et Caraïbes (23) ──
  k('Antigua-et-Barbuda', 'Saint John’s', AN, 22000, 'ic'),
  k('Bahamas', 'Nassau', AN, 280000, 'ic'),
  k('Barbade', 'Bridgetown', AN, 110000, 'ic'),
  k('Belize', 'Belmopan', AN, 25000),
  k('Canada', 'Ottawa', AN, 1000000, 'f'),
  k('Costa Rica', 'San José', AN, 350000),
  k('Cuba', 'La Havane', AN, 2100000, 'ic'),
  k('Dominique', 'Roseau', AN, 15000, 'ic'),
  k('États-Unis', 'Washington', AN, 690000),
  k('Grenade', 'Saint-Georges', AN, 7500, 'ic'),
  k('Guatemala', 'Guatemala', AN, 1200000),
  k('Haïti', 'Port-au-Prince', AN, 1000000, 'ifc'),
  k('Honduras', 'Tegucigalpa', AN, 1300000),
  k('Jamaïque', 'Kingston', AN, 670000, 'ic'),
  k('Mexique', 'Mexico', AN, 9200000),
  k('Nicaragua', 'Managua', AN, 1100000),
  k('Panama', 'Panama', AN, 900000, 'c'),
  k('République dominicaine', 'Saint-Domingue', AN, 1000000, 'ic'),
  k('Saint-Christophe-et-Niévès', 'Basseterre', AN, 14000, 'ic'),
  k('Sainte-Lucie', 'Castries', AN, 20000, 'ic'),
  k('Saint-Vincent-et-les-Grenadines', 'Kingstown', AN, 13000, 'ic'),
  k('Salvador', 'San Salvador', AN, 300000),
  k('Trinité-et-Tobago', 'Port-d’Espagne', AN, 37000, 'ic'),

  // ── Amérique du Sud (12) ──
  k('Argentine', 'Buenos Aires', AM, 3100000, 'sc'),
  k('Bolivie', 'Sucre', AM, 300000, 'ls'),
  k('Brésil', 'Brasília', AM, 2800000, 's'),
  k('Chili', 'Santiago', AM, 6300000, 's'),
  k('Colombie', 'Bogota', AM, 7900000),
  k('Équateur', 'Quito', AM, 2000000, 's'),
  k('Guyana', 'Georgetown', AM, 120000, 'c'),
  k('Paraguay', 'Asunción', AM, 520000, 'ls'),
  k('Pérou', 'Lima', AM, 10000000, 'sc'),
  k('Suriname', 'Paramaribo', AM, 240000),       // à ~15 km de l'océan, sur le fleuve
  k('Uruguay', 'Montevideo', AM, 1300000, 'sc'),
  k('Venezuela', 'Caracas', AM, 2000000),

  // ── Océanie (14) ──
  k('Australie', 'Canberra', OC, 470000, 's'),
  k('Fidji', 'Suva', OC, 95000, 'isc'),
  k('Kiribati', 'Tarawa-Sud', OC, 65000, 'ic'),
  k('Îles Marshall', 'Majuro', OC, 28000, 'ic'),
  k('Micronésie', 'Palikir', OC, 7000, 'i'),
  k('Nauru', 'Yaren', OC, 1000, 'isc'),
  k('Nouvelle-Zélande', 'Wellington', OC, 215000, 'isc'),
  k('Palaos', 'Ngerulmud', OC, 300, 'i'),
  k('Papouasie-Nouvelle-Guinée', 'Port Moresby', OC, 400000, 'isc'),
  k('Îles Salomon', 'Honiara', OC, 85000, 'isc'),
  k('Samoa', 'Apia', OC, 37000, 'isc'),
  k('Tonga', 'Nukuʻalofa', OC, 23000, 'isc'),
  k('Tuvalu', 'Funafuti', OC, 7000, 'isc'),
  k('Vanuatu', 'Port-Vila', OC, 50000, 'isfc'),
];
