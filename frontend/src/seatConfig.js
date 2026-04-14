export const SEAT_CONFIG = {
  CSE: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  ECE: {
    TOTAL: 11,
    MERIT: 4,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  IT: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  CE: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  EEE: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  EIE: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  CS: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  ME: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  MATHS: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
  HSS: {
    TOTAL: 10,
    MERIT: 3,
    GENERAL: 2,
    OBC: 2,
    MBC: 1,
    SC_ST: 2,
  },
};

export const SEAT_CONFIG_ALIASES = {
  'CIVIL': 'CE',
  'CIVIL ENGINEERING': 'CE',
  'COMPUTER SCIENCE': 'CSE',
  'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
  'CSE': 'CSE',
  'ECE': 'ECE',
  'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
  'ELECTRICAL ELECTRONICS ENGINEERING': 'EEE',
  'EEE': 'EEE',
  'EIE': 'EIE',
  'INFORMATION TECHNOLOGY': 'IT',
  'IT': 'IT',
  'MECHANICAL': 'ME',
  'MECHANICAL ENGINEERING': 'ME',
  'ME': 'ME',
  'MATHEMATICS': 'MATHS',
  'MATHS': 'MATHS',
  'HUMANITIES AND SOCIAL SCIENCES': 'HSS',
  'HSS': 'HSS',
};

function normalizeDepartmentValue(department) {
  return String(department || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveSeatConfigKey(department) {
  const normalized = normalizeDepartmentValue(department);
  return SEAT_CONFIG_ALIASES[normalized] || normalized || null;
}

export function getSeatConfigForDepartment(department) {
  const key = resolveSeatConfigKey(department);
  if (!key) {
    return null;
  }
  return SEAT_CONFIG[key] || null;
}

export function formatSeatConfigDistribution(config) {
  if (!config) {
    return 'Seat configuration unavailable';
  }

  return `MERIT: ${config.MERIT} | GENERAL: ${config.GENERAL} | OBC: ${config.OBC} | MBC: ${config.MBC} | SC/ST: ${config.SC_ST}`;
}

export function validateSeatConfigs() {
  Object.entries(SEAT_CONFIG).forEach(([department, config]) => {
    const total = Number(config.TOTAL || 0);
    const distributionTotal = Number(config.MERIT || 0)
      + Number(config.GENERAL || 0)
      + Number(config.OBC || 0)
      + Number(config.MBC || 0)
      + Number(config.SC_ST || 0);

    if (total <= 0 || total !== distributionTotal) {
      throw new Error(`Seat config mismatch for ${department}: TOTAL=${total}, distribution total=${distributionTotal}`);
    }
  });
}

validateSeatConfigs();
