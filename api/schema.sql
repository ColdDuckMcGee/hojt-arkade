-- Hojt Arkade – D1-skema (global highscore + anonym statistik)
CREATE TABLE IF NOT EXISTS scores (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  spil  TEXT    NOT NULL,          -- spillets id (navnet i ArkadeHighscores.create)
  kat   TEXT    NOT NULL DEFAULT '', -- kategori, fx brætstørrelse eller sværhedsgrad
  navn  TEXT    NOT NULL,          -- præcis 3 bogstaver A–Z, Æ, Ø, Å
  score INTEGER NOT NULL,
  dato  TEXT    NOT NULL           -- ISO-tid (UTC)
);
CREATE INDEX IF NOT EXISTS scores_top ON scores (spil, kat, score DESC, id);

-- Rate limit. Nøglen er en hash af IP + dato + hemmeligt salt, så den skifter hver dag
-- og ikke kan føres tilbage til en IP. Rækker ældre end 2 døgn slettes løbende.
CREATE TABLE IF NOT EXISTS rate (
  nogle TEXT PRIMARY KEY,
  dag   TEXT    NOT NULL,
  antal INTEGER NOT NULL,
  sidst INTEGER NOT NULL           -- ms siden 1970
);

-- Tællinger pr. dag og spil. Ingen IP, ingen cookies, ingen id'er.
CREATE TABLE IF NOT EXISTS events (
  dag   TEXT NOT NULL,             -- YYYY-MM-DD (UTC)
  spil  TEXT NOT NULL,
  type  TEXT NOT NULL,             -- 'start' | 'slut'
  antal INTEGER NOT NULL DEFAULT 0,
  varighed_sum INTEGER NOT NULL DEFAULT 0,  -- sekunder, kun for 'slut'
  varighed_n   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dag, spil, type)
);

-- Skærmstørrelser og temaer pr. dag (kun ved 'start').
CREATE TABLE IF NOT EXISTS dims (
  dag    TEXT NOT NULL,
  felt   TEXT NOT NULL,            -- 'skaerm' | 'tema'
  vaerdi TEXT NOT NULL,
  antal  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dag, felt, vaerdi)
);
