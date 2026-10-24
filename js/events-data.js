/**
 * Seed catalogue for the Events feature.
 * Pure data only: no DOM, no storage access.
 * Dates are generated relative to the moment the store is first seeded so the
 * Upcoming / Live now / Past tabs always have something meaningful to show.
 */
(function () {
  'use strict';

  var FORMATS = ['Doubles', 'Singles', 'Mixed Doubles', 'Round Robin', 'Team'];

  function at(dayOffset, hour, minute) {
    var d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour || 8, minute || 0, 0, 0);
    return d.toISOString();
  }

  function division(name, bracket, prRange, fee, capacity, filled) {
    return {
      name: name,
      bracket: bracket,
      prRange: prRange,
      fee: fee,
      capacity: capacity,
      filled: filled
    };
  }

  function seedEvents() {
    return [
      {
        id: 'evt-manila-open',
        name: 'Manila Open Doubles Series',
        club: 'Makati Pickle Club',
        venue: 'Manila Polo Club Courts',
        region: 'Metro Manila',
        city: 'Makati',
        format: 'Doubles',
        startDate: at(9, 7, 30),
        endDate: at(9, 18, 0),
        divisions: [
          division('Open Doubles', 'Open', 'All ratings', 1500, 32, 24),
          division('3.5 Doubles', '3.5', 'PR 1000 - 1399', 1000, 32, 18),
          division('3.0 Doubles', '3.0', 'PR below 1000', 800, 24, 9)
        ]
      },
      {
        id: 'evt-qc-open',
        name: 'Quezon City Open',
        club: 'QC Pickleball Collective',
        venue: 'Amoranto Sports Complex',
        region: 'Metro Manila',
        city: 'Quezon City',
        format: 'Doubles',
        startDate: at(15, 8, 0),
        endDate: at(15, 17, 0),
        divisions: [
          division('Open Doubles', 'Open', 'All ratings', 1000, 32, 6),
          division('3.0 Doubles', '3.0', 'PR below 1000', 700, 24, 3)
        ]
      },
      {
        id: 'evt-cebu-singles',
        name: 'Cebu Open Singles Championship',
        club: 'Cebu Pickleball Association',
        venue: 'Cebu Country Club Courts',
        region: 'Cebu',
        city: 'Cebu City',
        format: 'Singles',
        startDate: at(16, 8, 30),
        endDate: at(17, 17, 30),
        divisions: [
          division('Open Singles', 'Open', 'All ratings', 1200, 24, 16),
          division("Women's Singles", 'Open', 'All ratings', 900, 16, 11),
          division('3.0 Singles', '3.0', 'PR below 1000', 700, 24, 6)
        ]
      },
      {
        id: 'evt-davao-doubles',
        name: 'Davao Doubles Invitational',
        club: 'Davao Paddle Union',
        venue: 'SM Lanang Premier Courts',
        region: 'Davao Region',
        city: 'Davao City',
        format: 'Doubles',
        startDate: at(23, 8, 0),
        endDate: at(23, 19, 0),
        divisions: [
          division('Open Doubles', 'Open', 'All ratings', 1400, 32, 20),
          division('4.0 Doubles', '4.0', 'PR 1400 and above', 1100, 24, 24),
          division('3.5 Doubles', '3.5', 'PR 1000 - 1399', 900, 32, 13)
        ]
      },
      {
        id: 'evt-pampanga-mixed',
        name: 'Pampanga Mixed Doubles Cup',
        club: 'Central Luzon Pickle Society',
        venue: 'LausGroup Event Centre Courts',
        region: 'Central Luzon',
        city: 'San Fernando',
        format: 'Mixed Doubles',
        startDate: at(31, 8, 0),
        endDate: at(31, 18, 30),
        divisions: [
          division('Open Mixed', 'Open', 'All ratings', 1600, 24, 9),
          division('3.5 Mixed', '3.5', 'PR 1000 - 1399', 1200, 32, 21)
        ]
      },
      {
        id: 'evt-iloilo-round',
        name: 'Iloilo Round Robin Series',
        club: 'Iloilo City Pickle Club',
        venue: 'Iloilo Sports Complex',
        region: 'Western Visayas',
        city: 'Iloilo City',
        format: 'Round Robin',
        startDate: at(38, 8, 0),
        endDate: at(38, 17, 0),
        divisions: [
          division('Round Robin Open', 'Open', 'All ratings', 800, 40, 12),
          division('Round Robin 3.0', '3.0', 'PR below 1000', 600, 40, 8)
        ]
      },
      {
        id: 'evt-cavite-invitational',
        name: 'Cavite Invitational Doubles',
        club: 'Cavite Court Crew',
        venue: 'Tagaytay Highlands Courts',
        region: 'CALABARZON',
        city: 'Tagaytay',
        format: 'Doubles',
        startDate: at(47, 8, 0),
        endDate: at(47, 18, 0),
        divisions: [
          division('Open Doubles', 'Open', 'All ratings', 1300, 16, 16),
          division('3.5 Doubles', '3.5', 'PR 1000 - 1399', 1000, 16, 16)
        ]
      },
      {
        id: 'evt-makati-night',
        name: 'Makati Night League',
        club: 'Makati Pickle Club',
        venue: 'Ayala Triangle Courts',
        region: 'Metro Manila',
        city: 'Makati',
        format: 'Round Robin',
        startDate: at(-1, 18, 0),
        endDate: at(1, 22, 0),
        liveRound: 'Round 3',
        liveCourt: 'Court 2',
        divisions: [
          division('Night League Open', 'Open', 'All ratings', 700, 32, 28),
          division('Night League 3.0', '3.0', 'PR below 1000', 600, 24, 18)
        ]
      },
      {
        id: 'evt-cebu-team',
        name: 'Cebu Club Team Challenge',
        club: 'Cebu Pickleball Association',
        venue: 'Mactan Sports Complex',
        region: 'Cebu',
        city: 'Mactan',
        format: 'Team',
        startDate: at(-2, 8, 0),
        endDate: at(1, 18, 0),
        liveRound: 'Semifinal',
        liveCourt: 'Court 1',
        divisions: [
          division('Team Open', 'Open', 'All ratings', 2500, 16, 16)
        ]
      },
      {
        id: 'evt-batangas-open',
        name: 'Batangas Open',
        club: 'Southern Tagalog Paddle Club',
        venue: 'Batangas City Sports Center',
        region: 'CALABARZON',
        city: 'Batangas City',
        format: 'Doubles',
        startDate: at(-9, 8, 0),
        endDate: at(-9, 18, 0),
        result: 'Final: Chavez / Lim def. Reyes / Tan, 11-8',
        divisions: [
          division('Open Doubles', 'Open', 'All ratings', 1200, 32, 32),
          division('3.5 Doubles', '3.5', 'PR 1000 - 1399', 900, 24, 24)
        ]
      },
      {
        id: 'evt-laguna-paddle',
        name: 'Laguna Paddle Fest',
        club: 'Santa Rosa Pickle Club',
        venue: 'Nuvali Courts',
        region: 'CALABARZON',
        city: 'Santa Rosa',
        format: 'Mixed Doubles',
        startDate: at(-24, 8, 0),
        endDate: at(-24, 18, 0),
        result: 'Final: Santos / Cruz def. Garcia / Uy, 11-6',
        divisions: [
          division('Open Mixed', 'Open', 'All ratings', 1400, 24, 24),
          division('3.0 Mixed', '3.0', 'PR below 1000', 900, 24, 19)
        ]
      }
    ];
  }

  window.PBREventsData = {
    FORMATS: FORMATS,
    seedEvents: seedEvents
  };
})();
