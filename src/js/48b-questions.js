/* ================= fiches en questions (refonte du 14 novembre 2026) =================
   Les rubriques de 48-fiches.js regroupées en questions de lecteur, dans l'ordre où on se les pose. Chaque question a une ligne
   de deux ou trois faits chiffrés, neutres : des chiffres et leur point de comparaison, jamais de conclusion.
   Le site et l'app dessinent les questions repliées, et sous chacune ses rubriques.
   v : une annonce ou un bien de notre liste ; c : une ville ; q : un quartier. */
const FQ={
 v:[["achete","Qu'est-ce qu'on achète ?",["annonce","copro"]],["cher","Est-ce cher ?",["prix","ann"]],["loue","Combien se louera-t-il ?",["loyer"]],
  ["argent","Combien ça coûte et rapporte ?",["poids","calc"]],["risques","Qu'est-ce qui peut mal tourner ?",["risq","bati"]],
  ["ou","Où est-ce ?",["traj","vie","offre","hab","ecoles","urba"]],["achat","Si on y va ?",["suivi","visite"]]],
 c:[["marche","Que trouve-t-on à acheter ?",["prix","ann"]],["loue","Combien se loue {un} ?",["loyer"]],["argent","Combien ça coûte et rapporte ?",["calc"]],
  ["ville","Comment est la ville ?",["traj","vie","offre","hab","ecoles","urba"]],["risques","Qu'est-ce qui peut mal tourner ?",["risq","bati"]],["quartiers","Quels quartiers ?",[]]],
 q:[["marche","Combien coûte {un} ici ?",["prix"]],["loue","Combien se loue {un} ?",["loyer"]],["argent","Combien ça coûte et rapporte ?",["calc"]],
  ["quartier","Comment est le quartier ?",["traj","vie","offre","hab","ecoles","urba"]],["risques","Qu'est-ce qui peut mal tourner ?",["risq","bati"]]]};
/* les questions d'une fiche, « {un} » remplacé par le type de bien (« un studio », « un T2 ») */
function fqList(kind){const ty=tyLow(), un=ty==="studio"?"un studio":"un "+ty; return (FQ[kind]||[]).map(([k,l,s])=>[k,l.replace("{un}",un),s]);}
/* gagnant si l'on revend : la première année où le prix de vente rembourse le crédit restant, l'impôt sur la plus-value
   et tout ce qu'on a sorti de notre poche (apport et mois négatifs), d'après x.gains (00b-financement-impots.js) ;
   null sans calcul, −1 si jamais en 25 ans */
function gainYear(x){const G=x&&x.gains; if(!G||!G.length) return null; const i=G.findIndex(v=>v>=0); return i<0?-1:i;}
function gainTxt(x){const y=gainYear(x); return y==null?"":y<0?"pas gagnant avant 25 ans":y===0?"gagnant dès l'achat":`gagnant après ${y} an${y>1?"s":""}`;}
/* la ligne de faits de chaque question : {clé: texte} ; une question absente prend les résumés de ses rubriques (côté interface) */
function fqSum(kind,o){const j=L=>L.filter(Boolean).slice(0,3).join(" · "), S={};
 try{
 if(kind==="v"){const b=o, r=calcBien(b), x=r.x, t=r.t, s=b.kind==="v"?b.suf:bienSuf(b), f=s?ficheOf(b.ville,s):null;
  if(f===undefined) S.achete="chargement…";
  else if(f) S.achete=j([f.surf&&`${fr(f.surf,f.surf%1?1:0)} m²`,typeof etTxt==="function"&&etTxt(f),f.an&&`immeuble de ${f.an}`,f.lots&&`${f.lots} lots`]);
  else if(b.surface) S.achete=j([`${fr(+b.surface)} m²`,b.dpe&&`DPE ${esc(b.dpe)}`]);
  const bty=b.type||typeFor(b.surface,b.pieces), qs=(t&&t.price?studioPm2(b.ville,t,bty):studioPm2(b.ville,null,bty))*pm2Adj(bty,+b.surface||22), pm2=+b.prix/(+b.surface||22), dif=(pm2/qs-1)*100;
  S.cher=j([`${eur(pm2)}/m²`,isFinite(dif)&&(Math.abs(dif)<3?`comme ${t?"les ventes du quartier":"la ville"}`:`${fr(Math.abs(dif),0)} % ${dif>0?"au-dessus":"en dessous"} ${t?"des ventes du quartier":"de la ville"}`)]);
  S.loue=j([`${eur(x.rentHC)} hors charges`,r.vac!=null&&`${fr(r.vac,1)} mois vide par an`]);
  S.argent=j([`crédit ${eur(x.mens)}/mois`,gainTxt(x)]);
  const p=t?poiOf(t):null; S.ou=j([t&&esc(t.name),p&&`commerces ${fr(p[0],1)}/10`]);
  S.achat=b.id&&b.statut?j([esc(b.statut),"documents et visite"]):"prix à proposer · documents à demander";}
 else if(kind==="c"){const c=o, x=calcVille(c), A=ADS[c.k], nv=A&&A.ventes?A.ventes.length:0, [pop,vac]=RISK[c.k]||[0,0], rq=typeof cityRisq==="function"?cityRisq(c.k):null;
  S.marche=j([nv?`${nv} à vendre`:"pas d'annonces relevées",`${eur(studioPm2(c.k))}/m² vendu`]);
  S.loue=j([`${eur(x.rentHC)} hors charges`,vac&&`${fr(vac,1)} % de logements vides`]);
  S.argent=j([`crédit ${eur(x.mens)}/mois`,gainTxt(x)]);
  S.ville=j([c.paris!=null&&`Paris ${hm(c.paris)}`,c.students&&`${Number(c.students).toLocaleString("fr-FR")} étudiants`,pop&&`population ${pop>0?"+":""}${fr(pop)} %/an`]);
  S.risques=rq?(rq.t?`${rq.t} quartier${rq.t>1?"s":""} sur ${rq.n} en zone inondable`:"aucun quartier en zone inondable"):"";
  const nq=IR[c.k]?IR[c.k].list.filter(v=>v.type==="H").length:0; S.quartiers=nq?`${nq} quartiers, du plus rentable au moins rentable`:"";}
 else if(kind==="q"){const t=o, c=C.find(v=>v.k===t.ck), x=QX[t.ck+t.i], xc=c?calcVille(c):null, q=typeof dvfOf==="function"?dvfOf(t):null, p=poiOf(t);
  if(x){S.marche=j([q&&q.n?`${eur(q.med)}/m² sur ${q.n} ventes`:`${eur(studioPm2(t.ck,t))}/m²`,xc&&`ville ${eur(studioPm2(t.ck))}/m²`]);
   S.loue=j([`${eur(x.rentHC)} hors charges`,xc&&`ville ${eur(xc.rentHC)}`]);
   S.argent=j([`crédit ${eur(x.mens)}/mois`,gainTxt(x)]);}
  S.quartier=j([p&&`commerces ${fr(p[0],1)}/10`]);}
 }catch(_){}
 return S;}
