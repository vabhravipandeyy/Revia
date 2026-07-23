const DEFAULT_SPACES = [
  {
    spaceId: 'her-frequency',
    name: 'Her Frequency',
    description: 'Emotionally aware. Intuitive. Always listening.',
    vibe: 'late-night emotional conversations, soft caring energy, clingy comforting interactions',
    agents: ['aisha', 'anaya', 'meera', 'kiara'],
    theme: {
      primary: '#FFB6C1',
      secondary: '#E6E6FA',
      gradient: 'linear-gradient(135deg, #FFF5F7 0%, #F3E5F5 100%)',
    },
    isDefault: true,
  },
  {
    spaceId: 'the-brotherhood',
    name: 'The Brotherhood',
    description: 'Straight talk. No filters. Just real conversations.',
    vibe: 'funny, chaotic, teasing, motivational, real-talk energy',
    agents: ['aarav', 'ethan', 'kian'],
    theme: {
      primary: '#4FC3F7',
      secondary: '#78909C',
      gradient: 'linear-gradient(135deg, #E1F5FE 0%, #CFD8DC 100%)',
    },
    isDefault: true,
  },
  {
    spaceId: 'equilibrium',
    name: 'Equilibrium',
    description: 'Balanced minds. Thoughtful conversations.',
    vibe: 'mixed emotional/intense/funny conversations',
    agents: ['kiara', 'aarav', 'priya', 'nisha'],
    theme: {
      primary: '#D2B48C',
      secondary: '#B39DDB',
      gradient: 'linear-gradient(135deg, #FDF5E6 0%, #EDE7F6 100%)',
    },
    isDefault: true,
  },
];

module.exports = {
  DEFAULT_SPACES,
};
