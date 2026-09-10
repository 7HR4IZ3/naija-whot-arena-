import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Original vector artwork informed by the photographed Nigerian deck at
// https://en.wikipedia.org/wiki/Whot! . No photograph or publisher logo is embedded.
const destination = fileURLToPath(new URL('../public/cards/classic/', import.meta.url));
mkdirSync(destination, { recursive: true });
const numbers = { circle: [1,2,3,4,5,7,8,10,11,12,13,14], triangle: [1,2,3,4,5,7,8,10,11,12,13,14], cross: [1,2,3,5,7,10,11,13,14], square: [1,2,3,5,7,10,11,13,14], star: [1,2,3,4,5,7,8], whot: [20] };
const shapes = {
  circle: '<circle r="48"/>',
  triangle: '<path d="M0-54 52 42H-52Z"/>',
  cross: '<path d="M-17-51H17V-17H51V17H17V51H-17V17H-51V-17H-17Z"/>',
  square: '<path d="M-46-46H46V46H-46Z"/>',
  star: '<path d="M0-57 13.5-18.5 54.2-17.6 21.8 7.1 33.5 46.1 0 23-33.5 46.1-21.8 7.1-54.2-17.6-13.5-18.5Z"/>',
};
const paper = '<defs><linearGradient id="paper" x2=".85" y2="1"><stop stop-color="#fffef8"/><stop offset="1" stop-color="#f6f1e4"/></linearGradient></defs><rect x=".75" y=".75" width="198.5" height="298.5" rx="12" fill="url(#paper)" stroke="#d5cebf" stroke-width="1.5"/><rect x="5" y="5" width="190" height="290" rx="9" fill="none" stroke="#fffdf6" stroke-width="2"/>';
const word = '<text text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-weight="bold" font-style="italic" font-size="45" letter-spacing="-3">Whot</text>';
for (const [suit, values] of Object.entries(numbers)) {
  for (const value of values) {
    const corner = `<g><text x="25" y="39" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="31" font-weight="bold">${value}</text>${suit === 'whot' ? '' : `<g transform="translate(25 56) scale(.16)">${shapes[suit]}</g>`}</g>`;
    const center = suit === 'whot'
      ? `<g transform="translate(100 128)">${word}</g><g transform="translate(100 172) rotate(180)">${word}</g>`
      : `<g transform="translate(100 150)">${shapes[suit]}${suit === 'star' ? `<text y="9" text-anchor="middle" font-family="Georgia,serif" font-size="25" fill="#fffaf0">${value * 2}</text>` : ''}</g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><title>${suit} ${value}</title>${paper}<g fill="#713b40">${corner}<g transform="rotate(180 100 150)">${corner}</g>${center}</g></svg>\n`;
    writeFileSync(`${destination}${suit}-${value}.svg`, svg);
  }
}
const back = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><title>Whot Arena card back</title>${paper}<defs><pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0 8 8M8 0 0 8" stroke="#e8d4b5" stroke-width=".35" opacity=".24"/></pattern></defs><rect x="10" y="10" width="180" height="280" rx="6" fill="#713b40"/><rect x="10" y="10" width="180" height="280" rx="6" fill="url(#weave)"/><rect x="18" y="18" width="164" height="264" rx="4" fill="none" stroke="#e5d1ae" stroke-width=".8"/><g fill="#fff5dd"><g transform="translate(100 133)">${word}</g><g transform="translate(100 167) rotate(180)">${word}</g></g></svg>\n`;
writeFileSync(`${destination}back.svg`, back);
console.log('Generated 50 unique faces (54-card deck) and one reversible card back.');
