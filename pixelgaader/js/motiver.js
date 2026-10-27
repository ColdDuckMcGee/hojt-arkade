/*
 * Pixelgåder – håndlavede neon-pixelmotiver med arkadetema.
 * X = farvet felt, . = tomt felt. Alle motiver har én entydig løsning, som
 * kan findes række for række og kolonne for kolonne uden at gætte
 * (tjekkes af test/spillogik.test.js med spillets egen løser).
 */
(function (global) {
  'use strict';
  global.PixelgaaderMotiver = {
    5: [
      { navn: 'Hjerte', rows: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'] },
      { navn: 'Spøgelse', rows: ['.XXX.', 'XXXXX', 'X.X.X', 'XXXXX', 'X.X.X'] },
      { navn: 'Mønt', rows: ['.XXX.', 'X...X', 'X.X.X', 'XX.XX', '.XXX.'] },
      { navn: 'Raket', rows: ['..X..', '.XXX.', '.X.X.', 'XXXXX', 'X.X.X'] },
      { navn: 'Joystick', rows: ['.XX..', '.XX..', '..X..', '.XXX.', 'XXXXX'] },
      { navn: 'Rumvæsen', rows: ['X...X', '.XXX.', 'X.X.X', 'XXXXX', '.X.X.'] },
      { navn: 'Hus', rows: ['..X..', '.XXX.', 'XXXXX', '.X.X.', '.XXX.'] },
      { navn: 'Stjerne', rows: ['..X..', 'XXXXX', '.XXX.', '.X.X.', 'X...X'] },
      { navn: 'Pil', rows: ['..X..', '.XXX.', 'X.X.X', '..X..', '..X..'] },
      { navn: 'Svamp', rows: ['.XXX.', 'XX.XX', 'XXXXX', '..X..', '.XXX.'] },
      { navn: 'Sværd', rows: ['...XX', '..XXX', 'XXXX.', '.XX..', 'X.X..'] },
      { navn: 'Krone', rows: ['X.X.X', 'XXXXX', 'X.X.X', 'XXXXX', '.XXX.'] },
      { navn: 'Fisk', rows: ['.XX..', 'XXXXX', 'X.XX.', 'XXXXX', '.XX..'] },
      { navn: 'Kop', rows: ['XXXX.', 'XXX.X', 'XXX.X', 'XXXX.', '.XX..'] },
      { navn: 'Diamant', rows: ['.XXX.', 'XX.XX', 'X...X', '.X.X.', '..X..'] }
    ],
    8: [
      { navn: 'Rumvæsen', rows: ['X......X', '.X....X.', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.XXXXXX.', '.XX..XX.', 'X......X'] },
      { navn: 'Spøgelse', rows: ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XX.XX.XX'] },
      { navn: 'Hjerte', rows: ['.XX..XX.', 'XXXXXXXX', 'X.XXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...', '........'] },
      { navn: 'Mønt', rows: ['..XXXX..', '.XXXXXX.', 'XXX.XXXX', 'XX..XXXX', 'XXX.XXXX', 'XXX.XXXX', '.XX..XX.', '..XXXX..'] },
      { navn: 'Joystick', rows: ['...XX...', '..XXXX..', '..XXXX..', '...XX...', '...XX...', '.XXXXXX.', 'XX.XXXXX', 'XXXXXXXX'] },
      { navn: 'Raket', rows: ['...XX...', '..XXXX..', '..X..X..', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'X..XX..X', '.X.XX.X.'] },
      { navn: 'Svamp', rows: ['..XXXX..', '.XX..XX.', 'XXXXXXXX', 'X..XX..X', 'XXXXXXXX', '..X..X..', '..X..X..', '..XXXX..'] },
      { navn: 'Kat', rows: ['X......X', 'XX....XX', 'XXXXXXXX', 'X.XXXX.X', 'XXXXXXXX', 'XXX..XXX', '.XXXXXX.', '..XXXX..'] },
      { navn: 'Hus', rows: ['...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', '.X....X.', '.X.XX.X.', '.X.XX.X.', '.XXXXXX.'] },
      { navn: 'Robot', rows: ['...XX...', 'XXXXXXXX', 'X......X', 'XX.XX.XX', 'X......X', 'X.XXXX.X', 'XXXXXXXX', '.X....X.'] }
    ],
    10: [
      { navn: 'Hjerte', rows: ['.XXX..XXX.', 'XXXXXXXXXX', 'XX.XXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....', '..........'] },
      { navn: 'Spøgelse', rows: ['...XXXX...', '.XXXXXXXX.', 'XXXXXXXXXX', 'X..XXXX..X', 'X..XXXX..X', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.XXXX.XX'] },
      { navn: 'Rumvæsen', rows: ['..X....X..', '...X..X...', '..XXXXXX..', '.XX.XX.XX.', 'XXXXXXXXXX', 'X.XXXXXX.X', 'X.X....X.X', '...XXXX...', '..XX..XX..', '.X......X.'] },
      { navn: 'Rumskib', rows: ['....XX....', '....XX....', '...XXXX...', '...X..X...', '..XXXXXX..', '.XXXXXXXX.', 'XXX.XX.XXX', 'XX..XX..XX', 'X...XX...X', '.X.X..X.X.'] },
      { navn: 'Joystick', rows: ['...XXXX...', '..XXXXXX..', '..XXXXXX..', '...XXXX...', '....XX....', '....XX....', '.XXXXXXXX.', 'X.X.XXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.'] },
      { navn: 'Pokal', rows: ['XXXXXXXXXX', 'X.XXXXXX.X', 'X.XXXXXX.X', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....', '....XX....', '...XXXX...', '..XXXXXX..'] },
      { navn: 'Diskette', rows: ['XXXXXXXXX.', 'XX.....XXX', 'XX.....XXX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX......XX', 'XX.XXXX.XX', 'XX......XX', 'XX.XXXX.XX', 'XXXXXXXXXX'] }
    ],
    15: [
      { navn: 'Arkademaskine', rows: [
        '..XXXXXXXXXXX..',
        '..X.........X..',
        '..X.XXXXXXX.X..',
        '..X.X.....X.X..',
        '..X.X.X.X.X.X..',
        '..X.X.....X.X..',
        '..X.X.XXX.X.X..',
        '..X.XXXXXXX.X..',
        '..X.........X..',
        '.XXXXXXXXXXXXX.',
        '.X..X.....XX.X.',
        '.X.XXX...XXX.X.',
        '.X..X.....XX.X.',
        '.X...........X.',
        '.XXXXXXXXXXXXX.'] },
      { navn: 'Stort hjerte', rows: [
        '..XXX.....XXX..',
        '.XXXXX...XXXXX.',
        'XXX.XXX.XXXXXXX',
        'XX.XXXXXXXXXXXX',
        'XXXXXXXXXXXXXXX',
        'XXXXXXXXXXXXXXX',
        'XXXXXXXXXXXXXXX',
        '.XXXXXXXXXXXXX.',
        '..XXXXXXXXXXX..',
        '...XXXXXXXXX...',
        '....XXXXXXX....',
        '.....XXXXX.....',
        '......XXX......',
        '.......X.......',
        '...............'] },
      { navn: 'Stort rumvæsen', rows: [
        '...X.......X...',
        '....X.....X....',
        '...XXXXXXXXX...',
        '..XXXXXXXXXXX..',
        '.XXX..XXX..XXX.',
        '.XXX..XXX..XXX.',
        'XXXXXXXXXXXXXXX',
        'XXXXXXXXXXXXXXX',
        'X.XXXXXXXXXXX.X',
        'X.X.........X.X',
        'X.X.........X.X',
        '...XXX...XXX...',
        '..XX.......XX..',
        '.XX.........XX.',
        'XX...........XX'] }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
