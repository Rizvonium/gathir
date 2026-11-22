/*
 * Vibrant Bazaar palettes for the Pattern Lab: a mirror of src/ui/tokens.ts.
 * `inks` follows src/ui/patterns/inks.ts patternInks(): primary, saffron, teal, rose,
 * indigo, meadow. If tokens.ts changes, change this file too.
 */
(function (root) {
  root.GathirPalettes = [
    {
      name: 'Pashmina day (light)',
      bg: '#FFF8EE',
      sunken: '#F6ECDD',
      surface: '#FFFFFF',
      text: '#2B1A12',
      muted: '#6B5446',
      inks: ['#C62F17', '#F4A300', '#0B6E77', '#B0124F', '#3B3A98', '#23794A'],
    },
    {
      name: 'Dal at night (dark)',
      bg: '#15101F',
      sunken: '#100C18',
      surface: '#1F1830',
      text: '#F8EEDF',
      muted: '#BFAE9C',
      inks: ['#FF7452', '#FFC24B', '#4CC9D1', '#FF6FA3', '#9C9BFF', '#5FD08F'],
    },
    {
      name: 'Chinar ground (icon)',
      bg: '#C62F17',
      sunken: '#C62F17',
      surface: '#FFF8EE',
      text: '#FFF8EE',
      muted: '#F6ECDD',
      inks: ['#FFF8EE', '#F4A300', '#FFF8EE', '#F4A300', '#F6ECDD', '#FFC24B'],
    },
  ];
})(typeof self !== 'undefined' ? self : this);
