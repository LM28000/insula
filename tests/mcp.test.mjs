// Test du serveur MCP : node tests/mcp.test.mjs (après python3 build.py). Lance le serveur comme le ferait une IA et appelle chaque outil.
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path"; import fs from "node:fs"; import os from "node:os"; import {fileURLToPath} from "node:url";
import {ElicitRequestSchema} from "@modelcontextprotocol/sdk/types.js";
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const c = new Client({name: "test", version: "1"}); await c.connect(new StdioClientTransport({command: process.execPath, args: [path.join(R, "mcp/serveur.mjs")], stderr: "ignore"}));
let n = 0, bad = 0; const ok = (name, cond, info = "") => { n++; if (!cond) bad++; console.log((cond ? "✓ " : "✗ ") + name + (cond || !info ? "" : "  → " + info)); };
const call = async (name, args = {}) => { const r = await c.callTool({name, arguments: args}); const t = r.content[0].text; if (r.isError) return {erreur: t}; return JSON.parse(t); };
const tools = (await c.listTools()).tools.map(t => t.name);
ok("9 outils exposés", ["classement_villes", "quartiers", "annonces", "fiche_annonce", "simuler_bien", "nouveautes", "reglages", "nos_biens", "ajouter_bien", "changer_statut"].every(t => tools.includes(t)), tools.join(","));
const cl = await call("classement_villes"); ok("classement : 22 villes triées", cl.villes.length === 22 && cl.villes[0].rendement_15ans_pct >= cl.villes[21].rendement_15ans_pct, JSON.stringify(cl).slice(0, 200));
const t2 = await call("classement_villes", {type: "t2"}); ok("classement en T2, réglages inchangés ensuite", t2.type === "t2" && (await call("classement_villes")).type === "studio");
const q = await call("quartiers", {ville: "Le Mans", n: 5}); ok("quartiers du Mans", q.quartiers.length === 5 && q.quartiers[0].quartier, JSON.stringify(q).slice(0, 200));
ok("ville inconnue : message clair", /ville inconnue/.test((await call("quartiers", {ville: "Atlantis"})).erreur || ""));
const an = await call("annonces", {n: 5}); ok("annonces : 5, sans résidence gérée", an.annonces.length === 5 && an.annonces.every(a => a.calcul_applicable), JSON.stringify(an).slice(0, 300));
const f = await call("fiche_annonce", {lien: an.annonces[0].lien}); ok("fiche complète : prix à proposer et historique", !!f.prix_a_proposer && Array.isArray(f.historique_prix), JSON.stringify(f).slice(0, 300));
{ const j = ((f.avertissement || "").match(/TEXTE_EXTERNE ([0-9a-f]{12})/) || [])[1], bal = v => v == null || (typeof v === "string" && v.startsWith(`<<<TEXTE_EXTERNE ${j}>>>`) && v.endsWith(`<<<FIN_TEXTE_EXTERNE ${j}>>>`));
  ok("fiche : texte de l'annonceur entre balises au code tiré au hasard, avertissement en tête", Object.keys(f)[0] === "avertissement" && !!j && ["description", "chauffage", "frais_agence", "secteur"].every(k => bal(f[k])), JSON.stringify([j, f.description]).slice(0, 200));
  const f2 = await call("fiche_annonce", {lien: an.annonces[0].lien}); ok("fiche : nouveau code à chaque réponse", !(f2.avertissement || "").includes(j));
  const j3 = ((an.avertissement || "").match(/TEXTE_EXTERNE ([0-9a-f]{12})/) || [])[1]; ok("annonces : secteur entre balises", !!j3 && an.annonces.every(a => a.secteur == null || a.secteur.startsWith(`<<<TEXTE_EXTERNE ${j3}>>>`))); }
const ff5 = []; for (const a of an.annonces) ff5.push(await call("fiche_annonce", {lien: a.lien})); const fs5 = ff5.map(x => x.copropriete_registre), rc5 = ff5.map(x => x.residences_et_chantiers);
ok("fiche complète : résidences étudiantes et logements neufs autour (quand la position est connue)", rc5.some(Boolean) && rc5.every(r => r === null || (Array.isArray(r.residences_etudiantes_1km) && typeof r.logements_neufs_500m.logements === "number" && r.mesure)), JSON.stringify(rc5).slice(0, 300));
ok("fiche complète : bruit et zone tendue", ff5.every(x => x.bruit && "zone_bruit_aeroport" in x.bruit && typeof x.zone_tendue === "boolean"), JSON.stringify(ff5.map(x => [x.bruit, x.zone_tendue])).slice(0, 300));
ok("fiche complète : copropriété du registre, retrouvée (immatriculation, syndic) ou raison donnée", fs5.every(c => c && (c.retrouvee ? /^[A-Z]{2}\d{7}$/.test(c.immatriculation) && c.syndic && c.fiabilite : !!c.raison)), JSON.stringify(fs5).slice(0, 400));
const s = await call("simuler_bien", {ville: "lemans", prix: 60000, surface: 22}); ok("simulation d'un bien", s.budget_tout_compris > 60000 && s.rendement_15ans_pct != null && s.prix_a_proposer, JSON.stringify(s).slice(0, 300));
const nv = await call("nouveautes"); ok("nouveautés", Array.isArray(nv.nouvelles) && Array.isArray(nv.baisses));
const rg = await call("reglages"); ok("réglages lus", typeof rg.taux === "number" && rg.type);
ok("réglage inconnu refusé", /inconnus/.test((await call("reglages", {changer: {pirate: 1}})).erreur || ""));
ok("écriture refusée si le client ne peut pas demander l'accord", /ne sait pas demander votre accord/.test((await call("reglages", {changer: {taux: rg.taux + 1}})).erreur || ""));
const an2 = (await c.listTools()).tools; const A = n => (an2.find(t => t.name === n) || {}).annotations || {};
ok("écritures signalées aux clients", A("changer_statut").destructiveHint === true && A("reglages").destructiveHint === true && A("ajouter_bien").readOnlyHint === false);
const nb = await call("nos_biens"); ok("nos biens (Supabase) lus ou absence de code signalée", Array.isArray(nb.biens) || /code de groupe|Supabase/.test(nb.erreur || ""), JSON.stringify(nb).slice(0, 200));
await c.close();
// accord demandé par le client (elicitation), dans un HOME temporaire : les vrais réglages ne sont pas touchés
{ const home = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-")), hyp = path.join(home, ".config/immobilier-tool/hypotheses.json"); let reponse = "decline", vu = "";
  const e = new Client({name: "test-accord", version: "1"}, {capabilities: {elicitation: {}}});
  e.setRequestHandler(ElicitRequestSchema, async r => { vu = r.params.message; return reponse === "accept" ? {action: "accept", content: {confirmer: true}} : {action: reponse}; });
  await e.connect(new StdioClientTransport({command: process.execPath, args: [path.join(R, "mcp/serveur.mjs")], stderr: "ignore", env: {...process.env, HOME: home, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright")}}));
  const ec = async a => { const r = await e.callTool({name: "reglages", arguments: a}); return r.isError ? {erreur: r.content[0].text} : JSON.parse(r.content[0].text); };
  const ref = await ec({changer: {taux: 9.9}}); ok("accord refusé : rien n'est écrit", /annulée/.test(ref.erreur || "") && !fs.existsSync(hyp) && /taux : 9\.9/.test(vu), JSON.stringify([ref, vu]));
  reponse = "accept"; const acc = await ec({changer: {taux: 9.9}}); ok("accord donné : réglage écrit", acc.taux === 9.9 && JSON.parse(fs.readFileSync(hyp, "utf8")).taux === 9.9, JSON.stringify(acc).slice(0, 200));
  vu = ""; reponse = "decline"; const meme = await ec({changer: {taux: 9.9}}); ok("aucun changement : pas de question", !meme.erreur && vu === "");
  await e.close(); fs.rmSync(home, {recursive: true, force: true}); }
console.log(`\n${n - bad}/${n} tests MCP réussis`); process.exit(bad ? 1 : 0);
