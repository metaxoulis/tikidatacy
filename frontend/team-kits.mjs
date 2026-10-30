/* Club colours for the lineup pitch, keyed by Football-API team ID (the IDs in team_badges).
 * These are the clubs' traditional home colours, not the kit worn in a given match: the UI says so.
 * Only clubs whose colours are well known are listed; any other club keeps the neutral token.
 * [primary, secondary, pattern]; pattern: plain | stripes | hoops | halves | band (secondary base, primary centre band).
 */
const FA_TEAM_KITS={
 // England
 1:['#da291c','#000000','stripes'],18:['#ef0107','#ffffff','plain'],495:['#670e36','#95bfe5','plain'],489:['#e30613','#ffffff','stripes'],
 2:['#0057b8','#ffffff','stripes'],17:['#034694','#ffffff','plain'],537:['#6cbfef','#ffffff','plain'],3:['#1b458f','#c4122e','stripes'],
 20:['#003399','#ffffff','plain'],502:['#ffffff','#000000','plain'],490:['#f5a12d','#000000','plain'],491:['#0044a9','#ffffff','plain'],
 1131:['#ffffff','#1d428a','plain'],7:['#c8102e','#ffffff','plain'],12:['#6cabdd','#ffffff','plain'],19:['#da291c','#ffffff','plain'],
 9:['#000000','#ffffff','stripes'],487:['#dd0000','#ffffff','plain'],500:['#eb172b','#ffffff','stripes'],15:['#ffffff','#132257','plain'],
 // Spain
 40:['#0761af','#ffffff','stripes'],24:['#ee2523','#ffffff','stripes'],26:['#cb3524','#ffffff','stripes'],21:['#a50044','#004d98','stripes'],
 32:['#8ac3ee','#ffffff','plain'],37:['#1e4ea1','#ffffff','stripes'],1309:['#ffffff','#05642c','plain'],38:['#007fc8','#ffffff','stripes'],
 30:['#005999','#ffffff','plain'],28:['#004d98','#b4053f','stripes'],39:['#3ba6dc','#ffffff','stripes'],794:['#d91a21','#0a346f','plain'],
 2780:['#ffffff','#00703c','plain'],792:['#ffffff','#e53027','plain'],35:['#00954c','#ffffff','stripes'],27:['#ffffff','#00529f','plain'],
 22:['#0067b1','#ffffff','stripes'],23:['#ffffff','#d81920','plain'],29:['#ffffff','#000000','plain'],33:['#ffe114','#005187','plain'],
 // Italy
 85:['#fb090b','#000000','stripes'],91:['#1e71b8','#000000','stripes'],87:['#a21c26','#1a2f48','stripes'],93:['#9b0d27','#002350','halves'],
 4873:['#0050a0','#ffffff','plain'],88:['#482e92','#ffffff','plain'],284:['#ffd300','#003a8c','plain'],94:['#a91d32','#002060','halves'],
 81:['#0068a8','#000000','stripes'],79:['#000000','#ffffff','stripes'],82:['#87d8f7','#ffffff','plain'],2573:['#e31b23','#ffffff','plain'],
 1135:['#ffffff','#000000','plain'],90:['#8e1f2f','#f0bc42','plain'],80:['#12a0d7','#ffffff','plain'],95:['#00a752','#000000','stripes'],
 83:['#8a1e03','#ffffff','plain'],2102:['#ffed00','#d71920','stripes'],89:['#000000','#ffffff','stripes'],1139:['#000000','#f7931e','plain'],
 // Germany
 48:['#ffffff','#ba3733','plain'],57:['#e32221','#000000','plain'],46:['#dc052d','#ffffff','plain'],41:['#fde100','#000000','plain'],
 49:['#ffffff','#000000','plain'],58:['#ffffff','#ed1c24','plain'],55:['#e2001a','#000000','plain'],47:['#ffffff','#0a3f86','plain'],
 42:['#1961b5','#ffffff','plain'],1142:['#00519e','#ffffff','plain'],954:['#e3000f','#ffffff','plain'],53:['#c3141e','#ffffff','plain'],
 44:['#ffffff','#dd0741','plain'],45:['#004d9d','#ffffff','plain'],1078:['#eb1923','#ffffff','plain'],54:['#ffffff','#e32219','plain'],
 56:['#1d9053','#ffffff','plain'],52:['#65b32e','#ffffff','plain'],
 // France
 65:['#000000','#ffffff','stripes'],314:['#ffffff','#0055a4','plain'],1090:['#e30613','#ffffff','plain'],316:['#8fbfe0','#002a5c','halves'],
 957:['#ffd400','#e2001a','plain'],74:['#e01e13','#24216a','plain'],1092:['#f58113','#000000','plain'],61:['#ffffff','#da001a','plain'],
 68:['#ffffff','#2faee0','plain'],60:['#e51b22','#ffffff','halves'],69:['#c8102e','#000000','stripes'],59:['#004170','#da291c','plain'],
 72:['#e13327','#000000','plain'],76:['#009fe3','#ffffff','plain'],67:['#4f2a83','#ffffff','plain'],
 // Greece
 666:['#8c1d2c','#ffffff','plain'],158:['#ffde00','#000000','plain'],1160:['#ffed00','#000000','plain'],864:['#f7d417','#1a3c8c','plain'],
 978:['#1450a0','#ffffff','plain'],2643:['#0d47a1','#ffffff','stripes'],668:['#008c45','#ffffff','plain'],137:['#e20a17','#ffffff','stripes'],
 977:['#000000','#ffffff','stripes'],865:['#007a33','#ffffff','plain'],862:['#ffd500','#0047ab','plain'],
 // Cyprus
 684:['#ffd700','#00843d','plain'],872:['#ffd500','#003f87','plain'],145:['#ffd800','#0033a0','plain'],875:['#0057b8','#ffffff','plain'],
 686:['#00843d','#ffffff','plain'],873:['#e2231a','#ffffff','plain'],384:['#00a651','#ffffff','plain'],
 // Other UEFA clubs
 802:['#db0021','#ffffff','plain'],586:['#d2122e','#ffffff','band'],134:['#4c2582','#ffffff','plain'],131:['#e20e0e','#ffffff','plain'],
 144:['#000000','#ffffff','stripes'],1942:['#ffd700','#000000','plain'],153:['#e30613','#ffffff','plain'],848:['#e30613','#ffffff','plain'],
 135:['#018749','#ffffff','hoops'],803:['#0068b4','#000000','stripes'],905:['#0b3d91','#ffffff','plain'],160:['#ffffff','#1e3c8c','plain'],
 143:['#003893','#ffffff','stripes'],582:['#e30613','#ffffff','plain'],168:['#e2001a','#ffffff','stripes'],866:['#ffed00','#002d72','stripes'],
 1219:['#009a44','#ffffff','stripes'],141:['#e2001a','#ffffff','halves'],669:['#a90432','#fdb912','halves'],806:['#0d4ea3','#ffffff','plain'],
 908:['#ffffff','#1b3f8b','plain'],166:['#e30613','#ffffff','plain'],831:['#800020','#ffffff','plain'],2170:['#ffd200','#000000','plain'],
 705:['#00539f','#ffffff','plain'],918:['#0055a5','#ffffff','plain'],840:['#ffd700','#000000','plain'],1395:['#d50032','#ffffff','plain'],
 1386:['#ed1c24','#ffffff','stripes'],172:['#ffffff','#d40f32','plain'],142:['#f26522','#000000','stripes'],146:['#ffffff','#e20613','halves'],
 1184:['#75aadb','#ffffff','plain'],385:['#a6192e','#ffffff','plain'],138:['#008057','#ffffff','hoops'],853:['#000000','#ffffff','plain'],
 1404:['#8a1538','#41b6e6','stripes'],807:['#ffdd00','#003399','plain'],842:['#003b7f','#ffffff','plain']
};
const faKitRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const faKitDistance=(a,b)=>{const x=faKitRgb(a),y=faKitRgb(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2])};
export function faTeamKit(faTeamId){
 const k=FA_TEAM_KITS[faTeamId];
 return k?{primary:k[0],secondary:k[1],pattern:k[2],source:'club_colours'}:null;
}
/* Both clubs' colours for one match. When the shirts would look alike, the away club is shown in its second
   colour, or in the neutral token if that is close too. */
export function faMatchKits(homeId,awayId){
 const home=faTeamKit(homeId),away=faTeamKit(awayId);
 if(!home||!away||faKitDistance(home.primary,away.primary)>=120)return {home,away};
 const alternate={primary:away.secondary,secondary:away.primary,pattern:'plain',source:'club_colours_alternate'};
 return {home,away:faKitDistance(alternate.primary,home.primary)>=120?alternate:null};
}
