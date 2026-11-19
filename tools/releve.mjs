#!/usr/bin/env node
/* Relevé quotidien sans la routine Claude : les pages de résultats de Bien'ici, les annonces des notaires (tools/notaires.mjs),
   puis les fiches des annonces nouvelles, chacune sur son site.
   Mêmes pages (tools/releve_plan.py), mêmes scripts de lecture (tools/extraction-bienici.js, tools/fiches-bienici.js), même rythme
   qu'un visiteur : une page à la fois, 8 à 14 s entre deux pages (au hasard), 1,5 s entre deux fiches. Le 19 novembre 2026, à une page
   toutes les 3 à 4 s, Bien'ici a cessé d'afficher ses annonces au bout de 213 pages. Arrêt au premier refus du site : on ne contourne pas
   un blocage. Chrome s'ouvre dans une fenêtre, avec un profil à lui (~/.config/immobilier-tool/chrome-releve).

   node tools/releve.mjs                   relevé et fiches → data/releve-du-jour.json, data/fiches-du-jour.json
   node tools/releve.mjs --publier         puis maj_annonces.py, fiches.py merge, build.py, supabase_annonces.py push (comme la routine)
   node tools/releve.mjs --essai DOSSIER   essai : écrit dans DOSSIER, ne touche à rien d'autre ; avec --listes N (les N premières listes)
                                           et --fiches N (N fiches au plus) ; --sans-notaires : Bien'ici seulement
   La lecture des descriptions (« vendu loué », loyer, travaux…) reste à Claude : tools/fiches.py a-lire, puis lu. */
import {chromium} from "playwright";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {releveNotaires, fichesNotaires, doublon} from "./notaires.mjs";

const R = path.dirname(path.dirname(fileURLToPath(import.meta.url)));   /* le dossier a des espaces : pas de pathname brut */
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ESSAI = arg("--essai", null), PUBLIER = process.argv.includes("--publier") && !ESSAI;
const NL = +arg("--listes", 0), NF = +arg("--fiches", 150);
const OUT = ESSAI ? path.resolve(ESSAI) : path.join(R, "data");
const PROFIL = path.join(os.homedir(), ".config", "immobilier-tool", "chrome-releve");
const t0 = Date.now(), log = (...a) => console.log(`[${new Date().toLocaleTimeString("fr-FR")}]`, ...a);
const py = (...a) => execFileSync("python3", a, {cwd: R, encoding: "utf-8", env: {...process.env, PYTHONDONTWRITEBYTECODE: "1"}, maxBuffer: 64 << 20});
const pause = ms => new Promise(r => setTimeout(r, ms));
const EXTR = fs.readFileSync(path.join(R, "tools", "extraction-bienici.js"), "utf-8");
const FICH = fs.readFileSync(path.join(R, "tools", "fiches-bienici.js"), "utf-8");
const NOT = !process.argv.includes("--sans-notaires");
const bilan = {listes: 0, ok: 0, echecs: [], pages: 0, annonces: 0, fiches: 0, stop: null, notaires: null};

class Refus extends Error {}
fs.mkdirSync(OUT, {recursive: true}); fs.mkdirSync(PROFIL, {recursive: true});
const plan = JSON.parse(py("tools/releve_plan.py")), listes = NL ? plan.listes.slice(0, NL) : plan.listes;
log(`plan du ${plan.date} : ${listes.length} listes, ${listes.reduce((s, l) => s + l.pages.length, 0)} adresses, ${plan.pages_max} pages au plus par adresse`);

/* Chrome installé, en fenêtre (Mac) ; dans le conteneur (RELEVE_CHROME=0), le Chromium de l'image Playwright, sans fenêtre : en fenêtre
   sur un écran virtuel, il abandonnait les pages de Bien'ici (ERR_ABORTED, 19 novembre 2026), sans fenêtre il les lit comme sur le Mac ;
   et sans son rapporteur de plantages, qui n'y trouve pas où écrire et arrête le navigateur */
const DOCK = process.env.RELEVE_CHROME === "0";
const ctx = await chromium.launchPersistentContext(PROFIL, {channel: DOCK ? undefined : "chrome", headless: DOCK, locale: "fr-FR", timezoneId: "Europe/Paris", viewport: {width: 1280, height: 900},
  args: DOCK ? ["--disable-crash-reporter", "--disable-crashpad-for-testing", "--disable-dev-shm-usage"] : []});
const page = ctx.pages()[0] || await ctx.newPage();

/* une page de résultats : ouverte, 3 s, lue ; erreur de lecture : 10 s et une seconde lecture, puis arrêt (consigne du plan) */
let NPAGE = 0;
async function lire(url) {
  if (NPAGE++) await pause(8000 + Math.random() * 6000);
  const r = await page.goto(url, {waitUntil: "domcontentloaded", timeout: 45000}).catch(e => ({status: () => 0, err: e}));
  if (r.status() === 403 || r.status() === 429) throw new Refus(`page refusée (${r.status()}) : ${url}`);
  for (let essai = 0; essai < 2; essai++) {
    /* les annonces arrivent après la page (script du site) : on les attend, 15 s au plus, puis 1,5 s pour les dernières cartes */
    await page.waitForSelector("article", {timeout: essai ? 20000 : 15000}).catch(() => {}); await pause(1500);
    const o = JSON.parse(await page.evaluate(EXTR));
    if (!o.erreur) return o;
    if (essai) { await page.screenshot({path: path.join(OUT, "arret.png")}).catch(() => {}); throw new Refus(`${o.erreur} (page : ${url} ; titre : « ${await page.title()} » ; capture : ${path.join(OUT, "arret.png")})`); }
  }
}

const villes = {};
try {
  for (const L of listes) {
    bilan.listes++; const rows = new Map(), cle = L.quoi === "ads" ? 4 : 3;
    try {
      for (const u of L.pages) for (let n = 1; n <= plan.pages_max; n++) {
        const o = await lire(n === 1 ? u : `${u}&page=${n}`); bilan.pages++;
        o.rows.forEach(x => { if (!rows.has(x[cle])) rows.set(x[cle], x); });
        if (!o.suivante) break;
      }
    } catch (e) { if (e instanceof Refus) throw e; bilan.echecs.push(`${L.liste} : ${e.message.split("\n")[0]}`); log("✗", L.liste, e.message.split("\n")[0]); continue; }
    if (!rows.size) { bilan.echecs.push(`${L.liste} : aucune annonce`); log("✗", L.liste, "aucune annonce"); continue; }   /* pas de liste vide : celle de la veille reste */
    const v = villes[L.ville] ||= {}, dst = L.type === "studio" ? v : (v[L.type] ||= {});
    dst[L.quoi] = [...rows.values()]; bilan.ok++; bilan.annonces += rows.size;
    log(`${L.liste} : ${rows.size}`);
  }
} catch (e) { bilan.stop = e.message; log("ARRÊT :", e.message); }

if (bilan.stop) { await ctx.close(); console.log(JSON.stringify(bilan)); process.exit(2); }   /* relevé arrêté : rien n'est écrit, rien n'est publié */

/* les notaires, dans un second onglet : leurs ventes s'ajoutent à la liste Bien'ici de la même ville et du même type, si elle a été
   relevée (sans elle, la liste de la veille reste entière) ; un refus des notaires n'arrête pas le relevé de Bien'ici */
const pageN = NOT ? await ctx.newPage() : null, NOTIDS = new Set();
if (NOT) try {
  const {out, bilan: bn} = await releveNotaires(pageN, plan, R, log); let ajout = 0, doubles = 0;
  for (const [ck, T] of Object.entries(out)) for (const [ty, rows] of Object.entries(T)) {
    const v = villes[ck], dst = !v ? null : ty === "studio" ? v : v[ty];
    if (!dst || !dst.ventes) continue;
    const vus = new Set(dst.ventes.map(x => x[3]));
    for (const x of rows) { if (vus.has(x[3])) continue; if (doublon(x, dst.ventes)) { doubles++; continue; }
      dst.ventes.push(x); vus.add(x[3]); NOTIDS.add(String(x[3]).split("/").pop()); ajout++; }
  }
  bilan.notaires = Object.assign(bn, {ajoutees: ajout, doublons: doubles}); bilan.annonces += ajout; log(`notaires : ${ajout} annonces ajoutées aux listes, ${doubles} déjà sur Bien'ici`);
} catch (e) { bilan.notaires = {erreur: e.message}; log("✗ notaires :", e.message); }
const RELEVE = path.join(OUT, "releve-du-jour.json");
fs.writeFileSync(RELEVE, JSON.stringify({date: plan.date, plafond: plan.plafond, villes}));
log(`relevé écrit : ${RELEVE}`);

/* fiches des annonces nouvelles, ventes d'abord, par lots de 10, depuis une page www.bienici.com du relevé */
const lots = [];
const todo = NF > 0 ? JSON.parse(py("tools/fiches.py", "todo", RELEVE, "--max", String(NF))) : {lots: []};
log(`fiches : ${todo.manquantes ?? 0} manquantes, ${todo.lots.length} lots`);
const idsN = [];
for (const lot0 of todo.lots) {
  const lot = lot0.filter(x => !NOTIDS.has(String(x[0]))); idsN.push(...lot0.filter(x => NOTIDS.has(String(x[0]))));
  if (!lot.length || bilan.stop) continue;
  const o = JSON.parse(await page.evaluate(FICH.replace("__IDS__", JSON.stringify(lot))));
  lots.push(o); bilan.fiches += o.n;
  if (o.stop) { bilan.stop = `fiches : ${o.stop}`; log("ARRÊT des fiches :", o.stop); }
}
if (idsN.length) { const o = await fichesNotaires(pageN, idsN); lots.push(o); bilan.fiches += o.n; log(`fiches des notaires : ${o.n}${o.stop ? " (" + o.stop + ")" : ""}`); }
fs.writeFileSync(path.join(OUT, "fiches-du-jour.json"), JSON.stringify({lots}));
await ctx.close();

if (PUBLIER) {
  for (const c of [["tools/maj_annonces.py", "data/releve-du-jour.json"], ["tools/fiches.py", "merge", "data/fiches-du-jour.json"], ["build.py"], ["tools/supabase_annonces.py", "push"]]) {
    log("→", c.join(" ")); const s = py(...c); if (c[0] !== "build.py") log(s.trim().slice(0, 800));
  }
}
bilan.minutes = Math.round((Date.now() - t0) / 6000) / 10;
console.log(JSON.stringify(bilan));
