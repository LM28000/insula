/* Les annonces des notaires (immobilier.notaires.fr), deuxième source du relevé (tools/releve.mjs), depuis le 19 novembre 2026.
   Le site lit ses annonces sur son propre service (/pub-services/inotr-www-annonces/v1/…) : on lui fait les mêmes demandes que sa page de
   recherche, depuis cette page, à son rythme (son robots.txt demande 10 s entre deux demandes ; on attend 10 à 14 s).
   - Relevé : les appartements en vente classique (ni vente interactive ni enchères, ni viager) de chaque département de nos villes,
     gardés s'ils sont dans la commune d'une de nos villes, et dans le type, la surface et le budget de la liste Bien'ici correspondante
     du plan (tools/releve_plan.py). Prix : frais de négociation du notaire compris quand l'acquéreur les paie (prixTotal).
   - Une annonce de notaire a pour lien son adresse complète (https://www.immobilier.notaires.fr/fr/annonce-immo/…), à la place du chemin
     Bien'ici : le moteur (venteUrl, srcOf dans src/js/20-ventes.js) en tire le lien, la source et l'identifiant (dernier segment).
   - Fiche : la fiche complète du site, rangée comme celles de Bien'ici (tools/fiches.py merge) ; la situation locative du notaire
     (loué / libre) remplit directement « vendu loué ». */
import fs from "node:fs";
import path from "node:path";

export const NOTAIRES = "https://www.immobilier.notaires.fr";
const LISTE = NOTAIRES + "/fr/annonces-immobilieres-liste";
const API = "/pub-services/inotr-www-annonces/v1/annonces";
const TYPES = {1: "studio", 2: "t2", 3: "t3"};
const pause = ms => new Promise(r => setTimeout(r, ms));
export const estNotaire = lien => String(lien).startsWith(NOTAIRES + "/");

let DER = 0;   /* dernière demande au site : 10 à 14 s entre deux */
async function demande(page, url) {
  const att = DER + 10000 + Math.random() * 4000 - Date.now(); if (att > 0) await pause(att); DER = Date.now();
  const r = await page.evaluate(async u => { const x = await fetch(u, {headers: {accept: "application/json"}}); return {s: x.status, j: x.ok ? await x.json() : null}; }, url);
  if (r.s === 403 || r.s === 429) throw Object.assign(new Error(`notaires : demande refusée (${r.s})`), {refus: true});
  if (!r.j) throw new Error(`notaires : réponse ${r.s} pour ${url}`);
  return r.j;
}

async function ouvrir(page) {
  if (!page.url().startsWith(NOTAIRES)) { await page.goto(LISTE, {waitUntil: "domcontentloaded", timeout: 45000}); await pause(4000); DER = Date.now(); }
}

/* filtres d'une liste de ventes du plan : surface et prix maximum de son adresse Bien'ici */
function filtres(plan) {
  const F = {};
  for (const L of plan.listes) if (L.quoi === "ventes") {
    const q = new URL(L.pages[0]).searchParams, k = `${L.ville}|${L.type}`;
    const f = {smin: +(q.get("surface-min") || 0), smax: +(q.get("surface-max") || 1e9), pmax: +(q.get("prix-max") || plan.plafond || 1e9)};
    F[k] = F[k] ? {smin: Math.min(F[k].smin, f.smin), smax: Math.max(F[k].smax, f.smax), pmax: Math.max(F[k].pmax, f.pmax)} : f;   /* tranches de prix : la plus large */
  }
  return F;
}
const titre = s => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

/* le relevé : {ville: {type: [lignes de vente]}} ; lignes au format Bien'ici [surface, secteur, prix, lien, photo] */
export async function releveNotaires(page, plan, R, log) {
  const V = JSON.parse(fs.readFileSync(path.join(R, "tools", "villes.json"), "utf-8"));   /* {ville: code INSEE} */
  const parInsee = Object.fromEntries(Object.entries(V).map(([ck, i]) => [String(i), ck])), F = filtres(plan);
  const deps = [...new Set(Object.values(V).map(i => String(i).slice(0, 2)))].sort();
  /* le service filtre lui-même (prix affiché, surface, pièces) : en Loire-Atlantique, 69 appartements au lieu de 523 ; le tri fin vient ensuite */
  const fl = Object.values(F), cap = `&prixMax=${Math.max(...fl.map(f => f.pmax))}&surfaceMax=${Math.ceil(Math.max(...fl.map(f => f.smax)))}&nbPiecesMax=3`;
  const out = {}, bilan = {departements: deps.length, demandes: 0, vues: 0, gardees: 0};
  await ouvrir(page);
  for (const d of deps) {
    for (let n = 1, pages = 1; n <= pages && n <= 20; n++) {
      const j = await demande(page, `${API}?offset=${(n - 1) * 50}&page=${n}&parPage=50&perimetre=0&typeTransactions=VENTE&typeBiens=APP&departements=${d}${cap}`); bilan.demandes++;
      pages = j.nbPages || 1;
      for (const a of j.annonceResumeDto || []) {
        bilan.vues++;
        const ck = parInsee[String(a.inseeCommune)], ty = TYPES[a.nbPieces], s = +a.surface, prix = +(a.redevableEmoluments === "ACQUEREUR" ? a.prixTotal : a.prixAffiche) || +a.prixAffiche;
        if (!ck || !ty || !s || !prix || a.statut !== "LIGNE" || a.viager === "OUI" || a.bienVendu === "OUI" || a.bienRetire === "OUI" || a.ancienNeuf === "NEUF") continue;
        const f = F[`${ck}|${ty}`]; if (!f || s < f.smin || s > f.smax || prix > f.pmax) continue;
        /* secteur : le quartier que le notaire écrit souvent en tête (« PONTLIEUE - Proche tram… ») */
        const tete = []; for (const x of String(a.descriptionFr || "").split(/\s+-\s+/).slice(0, 4)) { const t = x.trim(); if (t.length < 3 || t.length > 40 || /\p{Ll}/u.test(t) || /^(T\d|F\d|APPARTEMENT|STUDIO|EXCLUSIVIT|VENTE|A VENDRE|À VENDRE)/.test(t)) break; tete.push(t); }
        const sec = tete.length && tete.length < 4 ? titre(tete.join(" - ")) : "";   /* « HEUZE - ST GEORGES » : les parties en capitales du début */
        ((out[ck] ||= {})[ty] ||= []).push([Math.round(s * 100) / 100, sec, Math.round(prix), a.urlDetailAnnonceFr, a.urlPhotoPrincipale || ""]);
        bilan.gardees++;
      }
    }
    log(`notaires ${d} : ${bilan.gardees} annonces gardées jusqu'ici`);
  }
  return {out, bilan};
}

/* les fiches : {n, stop, fiches} comme tools/fiches-bienici.js ; ids = [[id, ville, "v"], …] (id : le dernier segment du lien) */
export async function fichesNotaires(page, ids) {
  const out = {n: 0, stop: null, fiches: []}; await ouvrir(page);
  const num = v => (v === null || v === undefined || v === "" || isNaN(+v)) ? undefined : +v, oui = v => v === "OUI" ? true : v === "NON" ? false : undefined;
  const txt = s => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000);
  for (const [id, ck, k] of ids) {
    let j; try { j = await demande(page, `${API}/${encodeURIComponent(id)}`); }
    catch (e) { if (e.refus) { out.stop = e.message; break; } out.fiches.push({id, ck, k, err: e.message.slice(0, 80)}); continue; }
    const v = j.vente || {}, b = (j.bien && (j.bien.appartement || j.bien.maison)) || {}, desc = (v.descriptions || []).find(x => /fr/i.test(x.langue || "fr")) || (v.descriptions || [])[0] || {};
    const ph = (v.multimedias || []).filter(m => /^image\//.test(m.type || "")).sort((a, c) => (a.numDocument || 0) - (c.numDocument || 0)).map(m => (m.vga || m.qvga || {}).url || m.urlHighestResolution).filter(Boolean);
    const loc = b.situationLocative, day = s => s ? String(s).slice(0, 10) : undefined;
    const f = {id, ck, k, src: "notaires", titre: desc.descCourte ? titre(desc.descCourte) : [b.nbPieces && `${b.nbPieces} pièce${b.nbPieces > 1 ? "s" : ""}`, b.surfaceHabitable && `${b.surfaceHabitable} m²`].filter(Boolean).join(" · ") || undefined,
      d: txt(desc.descLongue || desc.descCourte || ""), ph,
      surf: num(b.surfaceHabitable), carrez: num(b.surfaceCarrez), pcs: num(b.nbPieces), ch: num(b.nbChambres), et: num(b.etage), ets: num(b.nbEtages), asc: oui(b.ascenseur),
      dpe: /^[A-G]$/.test(b.consommationClasse || "") ? b.consommationClasse : undefined, kwh: num(b.consommation), ges: /^[A-G]$/.test(b.emissionGesClasse || "") ? b.emissionGesClasse : undefined, dpeDate: day(b.dateRealisationDpe),
      cop: num(b.chargesCopropriete || b.montantChargesAnnuelles), lots: num(b.nbLotsCopropriete || b.nombreLots), proc: b.procedureEnCours === "OUI" ? true : undefined,
      balc: oui(b.balcon) ? 1 : undefined, terr: oui(b.terrasse) ? 1 : undefined, park: num(b.nbStationnements), cave: oui(b.cave) ? 1 : undefined,
      frais: v.redevableEmoluments === "ACQUEREUR" ? "purchaser" : v.redevableEmoluments === "VENDEUR" ? "seller" : undefined, hors: num(v.prix), prix: num(v.prix) && num(v.emoluments) && v.redevableEmoluments === "ACQUEREUR" ? v.prix + v.emoluments : num(v.prix),
      pub: day(v.dateActivation || v.dateCreation), maj: day(v.dateMaj), off: v.statut && v.statut !== "LIGNE" ? true : undefined,
      notaire: j.contact && j.contact.nom ? `${j.contact.nom}${j.contact.ville ? ", " + j.contact.ville : ""}` : undefined,
      ia: loc === "LOUE" ? {loue: true, src: "notaire"} : loc === "LIBRE" ? {loue: false, src: "notaire"} : undefined};
    out.fiches.push(JSON.parse(JSON.stringify(f))); out.n++;
  }
  return out;
}
