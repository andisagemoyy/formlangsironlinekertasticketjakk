/* DATABASE FORM LANGSIR JAKK - edit data rute di file ini */
window.LANGSIR_DB = {
  jakkTracks: [
    ["jakk-i", "I"], ["jakk-ii", "II"], ["jakk-iii", "III"],
    ["jakk-iv", "IV"], ["jakk-v", "V"], ["jakk-vi", "VI"],
    ["jakk-vii", "VII"], ["jakk-viii", "VIII"], ["jakk-ix", "IX"],
    ["jakk-x", "X"], ["jakk-xi", "XI"]
  ],
  serviceTracks: ["jakk-vii", "jakk-viii", "jakk-ix"],
  daoTracks: Array.from({ length: 11 }, (_, i) => [`dao-${i + 1}`, String(i + 1)]),
  cabinSignals: ["L104", "L124", "L144", "L44A"],

  startSignals: {
    "jakk-i": "JL182", "jakk-ii": "JL182", "jakk-iii": "JL162",
    "jakk-iv": "JL142", "jakk-v": "JL122", "jakk-vi": "JL102",
    "jakk-vii": "JL82", "jakk-viii": "JL62", "jakk-ix": "JL42",
    "jakk-x": "J22", "jakk-xi": "J12"
  },

  jakkDaoSwitches: {
    "jakk-vii": ["W83A", "W83B1", "W63C1", "W63C2", "W43C", "W45"],
    "jakk-viii": ["W63A", "W63B1", "W63B2", "W63C1", "W63C2", "W43C", "W45"],
    "jakk-ix": ["W43A1", "W43A2", "W43A3", "W43B", "W43C", "W45"]
  },

  /* Susunan wesel JAKK–DAO dan arah baliknya telah diverifikasi pengguna. */
  verifiedJakkDao: true,

  /*
   * Tangga wesel sisi barat DAO, dibaca dari mulut masuk W2 menuju jalur.
   * Jalur 8 dan 9 sama-sama melewati W10 karena W10 adalah pemisah keduanya.
   */
  daoWestSwitches: {
    "dao-1": ["W2", "W4", "W6"],
    "dao-2": ["W2", "W4", "W6", "W9"],
    "dao-3": ["W2", "W4", "W6", "W9"],
    "dao-4": ["W2", "W4", "W7"],
    "dao-5": ["W2", "W4", "W7"],
    "dao-6": ["W2", "W3"],
    "dao-7": ["W2", "W3", "W5"],
    "dao-8": ["W2", "W3", "W5", "W8", "W10"],
    "dao-9": ["W2", "W3", "W5", "W8", "W10"],
    "dao-10": ["W2", "W3", "W5", "W8", "W11"],
    "dao-11": ["W2", "W3", "W5", "W8", "W11"]
  },

  /*
   * Topologi tangga wesel sisi timur DAO dari gambar emplasemen pengguna.
   * Setiap pasangan adalah sambungan fisik. script.js mencari lintasan unik
   * di jaringan ini sehingga wesel di antara jalur masuk dan jalur gandeng
   * tidak ada yang terlewat. Contoh 5 ke 8: W14, W15, W15B, W16.
   */
  daoEastEdges: [
    ["dao-4", "W14"], ["dao-5", "W14"], ["W14", "W15"],
    ["dao-6", "W13"], ["dao-7", "W13"], ["W13", "W15"],
    ["W15", "W15B"],
    ["dao-2", "W15A"], ["dao-3", "W15A"], ["W15A", "W15B"],
    ["W15B", "W16"], ["dao-8", "W16"],
    ["W16", "W17"], ["dao-9", "W17"],
    ["W17", "W18"], ["dao-10", "W18"],
    ["W18", "W20"], ["dao-1", "W20"],
    ["W20", "W19"], ["dao-11", "W19"]
  ],

  verifiedDaoTopology: true,

  level: {
    "jakk-xi": 0, "jakk-x": 1, "jakk-ix": 2, "jakk-viii": 3,
    "jakk-vii": 4, "jakk-vi": 5, "jakk-v": 6, "jakk-iv": 7,
    "jakk-iii": 8, "jakk-ii": 9, "jakk-i": 10
  },
  levelSwitches: {
    0: ["W13A", "W13B"], 1: ["W23A", "W23B"],
    2: ["W43A", "W43B", "W43C"], 3: ["W63A", "W63B", "W63C"],
    4: ["W83A", "W83B", "W83C"], 5: ["W103A", "W103B", "W103C"],
    6: ["W123A", "W123B", "W123C"], 7: ["W143A", "W143B", "W143C"],
    8: ["W163A", "W163B", "W163C"], 9: ["W181", "W163A"], 10: ["W181"]
  },
  cabinLevel: { L44A: 2, L104: 5, L124: 6, L144: 7 },

  verifiedRoutes: {
    "jakk-ix|dao-5": {
      signals: ["JL42", "L44B"],
      jakk: ["W43A1", "W43A2", "W43A3", "W43B", "W43C", "W45"],
      dao: ["W2", "W4", "W7"],
      verified: true
    }
  },

  /* GEOMETRI ARSIR - viewBox sama dengan gambar asli 2800 x 1155. */
  geometry: {
    jakkToDaoMouth: {
      "jakk-vii": "M145 608 H445 C482 608 480 548 525 548 H580 L682 608 H790 L895 675 H1610 L1640 619",
      "jakk-viii": "M145 675 H470 C510 675 505 608 545 608 H680 L790 675 H1610 L1640 619",
      "jakk-ix": "M145 744 H490 C530 744 525 675 565 675 H1610 L1640 619"
    },
    daoWestLeg: {
      "dao-1": " L1666 548 L1775 300 H1958",
      "dao-2": " L1666 548 L1710 471 L1890 394 H1958",
      "dao-3": " L1666 548 L1710 471 L1890 394 L1936 467 H1958",
      "dao-4": " L1666 548 H1958",
      "dao-5": " L1666 548 H1724 L1795 615 H1958",
      "dao-6": " L1708 675 H1958",
      "dao-7": " L1708 675 L1750 744 L1890 772 H1958",
      "dao-8": " L1708 675 L1835 866 H1958",
      "dao-9": " L1708 675 L1835 866 H1890 L1950 944 H1958",
      "dao-10": " L1708 675 L1850 1018 H1958",
      "dao-11": " L1708 675 L1870 1087 H1958"
    },
    daoEastLeg: {
      "dao-1": { y: 300, joinX: 2650, bendX: 2353, d: "M2085 300 H2353 L2650 548" },
      "dao-2": { y: 394, joinX: 2410, bendX: 2267, d: "M2085 394 H2267 L2410 548" },
      "dao-3": { y: 467, joinX: 2368, bendX: 2297, d: "M2085 467 H2297 L2368 548" },
      "dao-4": { y: 548, joinX: 2335, d: "M2085 548 H2335" },
      "dao-5": { y: 615, joinX: 2204, bendX: 2133, d: "M2085 615 H2133 L2204 548" },
      "dao-6": { y: 675, joinX: 2308, bendX: 2200, d: "M2085 675 H2200 L2308 548" },
      "dao-7": { y: 772, joinX: 2375, bendX: 2155, d: "M2085 772 H2155 L2375 548" },
      "dao-8": { y: 866, joinX: 2498, bendX: 2305, d: "M2085 866 H2305 L2498 548" },
      "dao-9": { y: 944, joinX: 2580, bendX: 2348, d: "M2085 944 H2348 L2580 548" },
      "dao-10": { y: 1018, joinX: 2665, bendX: 2365, d: "M2085 1018 H2365 L2665 548" },
      "dao-11": { y: 1087, joinX: 2736, bendX: 2382, d: "M2085 1087 H2382 L2736 548" }
    },
    trackStartY: {
      "jakk-i": 143, "jakk-ii": 207, "jakk-iii": 269, "jakk-iv": 341,
      "jakk-v": 411, "jakk-vi": 515, "jakk-vii": 608, "jakk-viii": 675,
      "jakk-ix": 744, "jakk-x": 811, "jakk-xi": 879
    },
    railY: {
      "jakk-i": 143, "jakk-ii": 207, "jakk-iii": 269, "jakk-iv": 341,
      "jakk-v": 411, "jakk-vi": 475, "jakk-vii": 548, "jakk-viii": 608,
      "jakk-ix": 675, "jakk-x": 744, "jakk-xi": 811
    },
    cabinY: { L144: 341, L124: 411, L104: 475, L44A: 675 }
  }
};


window.DINAS_DATA = {
  MALAM: {
    R: ["R25", "R127", "R57F", "R35", "R45", "R15", "R19", "R37", "R31", "R41", "R3", "R63", "R7001"],
    L: ["L50F", "L20", "L132", "L46", "L2", "L16", "L7050", "L138", "L40", "L62"]
  },
  SIANG: { R: ["R29F", "R7049"], L: ["L30F", "L7002"] },
  PAGI: {
    R: ["R17", "R133", "R13", "R137", "R39", "R75", "R1", "R61"],
    L: ["L32", "L14"]
  }
};
