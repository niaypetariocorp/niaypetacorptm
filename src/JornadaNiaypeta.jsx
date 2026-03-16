// ============================================================
// JORNADA NIAYPETA — Roguelite Pokémon Minigame
// Part 1: Constants & Data
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import pokedexData from './pokemonData.js';
import { database } from './firebase.js';
import { ref, get, set, update, push, onValue } from 'firebase/database';

// ==================== TYPE SYSTEM ====================
export const TYPES = [
  'Normal','Fogo','Água','Elétrico','Planta','Gelo',
  'Lutador','Veneno','Terra','Voador','Psíquico','Inseto',
  'Pedra','Fantasma','Dragão','Sombrio','Metal','Fada',
];

export const TYPE_COLORS = {
  Normal:    '#A8A878', Fogo:     '#F08030', Água:     '#6890F0',
  Elétrico:  '#F8D030', Planta:   '#78C850', Gelo:     '#98D8D8',
  Lutador:   '#C03028', Veneno:   '#A040A0', Terra:    '#E0C068',
  Voador:    '#A890F0', Psíquico: '#F85888', Inseto:   '#A8B820',
  Pedra:     '#B8A038', Fantasma: '#705898', Dragão:   '#7038F8',
  Sombrio:   '#705848', Metal:    '#B8B8D0', Fada:     '#EE99AC',
};

// TYPE_CHART[attacker][defender] = multiplier (only non-1 values stored)
const _buildTypeChart = () => {
  const c = {};
  const se = (atk, defs) => defs.forEach(d => { if (!c[atk]) c[atk]={}; c[atk][d] = 2; });
  const nv = (atk, defs) => defs.forEach(d => { if (!c[atk]) c[atk]={}; c[atk][d] = 0.5; });
  const im = (atk, defs) => defs.forEach(d => { if (!c[atk]) c[atk]={}; c[atk][d] = 0; });

  se('Normal',   []);
  nv('Normal',   ['Pedra','Metal']);
  im('Normal',   ['Fantasma']);

  se('Fogo',     ['Planta','Gelo','Inseto','Metal']);
  nv('Fogo',     ['Fogo','Água','Pedra','Dragão']);

  se('Água',     ['Fogo','Terra','Pedra']);
  nv('Água',     ['Água','Planta','Dragão']);

  se('Elétrico', ['Água','Voador']);
  nv('Elétrico', ['Elétrico','Planta','Dragão']);
  im('Elétrico', ['Terra']);

  se('Planta',   ['Água','Terra','Pedra']);
  nv('Planta',   ['Fogo','Planta','Veneno','Voador','Inseto','Dragão','Metal']);

  se('Gelo',     ['Planta','Terra','Voador','Dragão']);
  nv('Gelo',     ['Fogo','Água','Gelo','Metal']);

  se('Lutador',  ['Normal','Gelo','Pedra','Sombrio','Metal']);
  nv('Lutador',  ['Veneno','Inseto','Psíquico','Voador','Fada']);
  im('Lutador',  ['Fantasma']);

  se('Veneno',   ['Planta','Fada']);
  nv('Veneno',   ['Veneno','Terra','Pedra','Fantasma']);
  im('Veneno',   ['Metal']);

  se('Terra',    ['Fogo','Elétrico','Veneno','Pedra','Metal']);
  nv('Terra',    ['Planta','Inseto']);
  im('Terra',    ['Voador']);

  se('Voador',   ['Planta','Lutador','Inseto']);
  nv('Voador',   ['Elétrico','Pedra','Metal']);

  se('Psíquico', ['Lutador','Veneno']);
  nv('Psíquico', ['Psíquico','Metal']);
  im('Psíquico', ['Sombrio']);

  se('Inseto',   ['Planta','Psíquico','Sombrio']);
  nv('Inseto',   ['Fogo','Lutador','Voador','Fantasma','Metal','Fada']);

  se('Pedra',    ['Fogo','Gelo','Voador','Inseto']);
  nv('Pedra',    ['Lutador','Terra','Metal']);

  se('Fantasma', ['Psíquico','Fantasma']);
  nv('Fantasma', ['Sombrio']);
  im('Fantasma', ['Normal']);

  se('Dragão',   ['Dragão']);
  nv('Dragão',   ['Metal']);
  im('Dragão',   ['Fada']);

  se('Sombrio',  ['Psíquico','Fantasma']);
  nv('Sombrio',  ['Lutador','Sombrio','Fada']);

  se('Metal',    ['Gelo','Pedra','Fada']);
  nv('Metal',    ['Fogo','Água','Elétrico','Metal']);

  se('Fada',     ['Lutador','Dragão','Sombrio']);
  nv('Fada',     ['Fogo','Veneno','Metal']);

  return c;
};
export const TYPE_CHART = _buildTypeChart();

/** Returns dice modifier for attacker vs defender types array */
export const getTypeEffectiveness = (attackerType, defenderTypes) => {
  let mult = 1;
  for (const dt of defenderTypes) {
    const m = (TYPE_CHART[attackerType] || {})[dt];
    if (m !== undefined) mult *= m;
  }
  return mult; // 0, 0.25, 0.5, 1, 2, 4
};

/** Converts effectiveness multiplier to d4 dice modifier */
export const multToDiceMod = (mult) => {
  if (mult === 0)    return 'immune';
  if (mult >= 8)     return +6;
  if (mult >= 4)     return +4;
  if (mult >= 2)     return +2;
  if (mult <= 0.125) return -6;
  if (mult <= 0.25)  return -4;
  if (mult <= 0.5)   return -2;
  return 0;
};

// ==================== DEX CONSTANTS ====================
const LEGENDARY_POKEMON_NAMES = new Set([
  'Arceus','Articuno','Azelf','Blacephalon','Buzzwole','Calyrex','Celebi','Celesteela',
  'Cobalion','Cosmoem','Cosmog','Cresselia','Darkrai','Deoxys','Dialga','Diancie',
  'Enamorus','Entei','Eternatus','G-Max Melmetal','G-Max Urshifu','Genesect','Giratina',
  'Glastrier','Groudon','Guzzlord','Heatran','Ho-oh','Hoopa','Jirachi','Kartana',
  'Keldeo','Kubfu','Kyogre','Kyurem','Landorus','Latias','Latios','Lugia','Lunala',
  'Magearna','Manaphy','Marshadow','Melmetal','Meloetta','Meltan','Mesprit','Mew',
  'Mewtwo','Moltres','Naganadel','Necrozma','Nihilego','Palkia','Pheromosa','Phione',
  'Poipole','Primal Groudon','Primal Kyogre','Raikou','Rayquaza','Regice','Regidrago',
  'Regieleki','Regigigas','Regirock','Registeel','Reshiram','Shaymin','Silvally',
  'Solgaleo','Spectrier','Stakataka','Suicune','Tapu Bulu','Tapu Fini','Tapu Koko',
  'Tapu Lele','Terrakion','Thundurus','Tornadus','Type: Null','Urshifu','Uxie',
  'Victini','Virizion','Volcanion','Xerneas','Xurkitree','Yveltal','Zacian',
  'Zamazenta','Zapdos','Zarude','Zekrom','Zeraora','Zygarde',
  'Gouging Fire','Raging Bolt','Walking Wake',
  'Wyrdeer','Kleavor','Ursaluna','Basculegion','Sneasler','Overqwil',
]);

export const isLegendary = (nome) =>
  LEGENDARY_POKEMON_NAMES.has(nome) ||
  nome.includes('Arceus')  ||
  nome.includes('Deoxys')  ||
  nome.includes('Genesect')||
  nome.includes('Shaymin') ||
  nome.includes('Zygarde') ||
  nome.includes('Giratina')||
  nome.includes('Hisui')   ||
  nome.includes('Calyrex') ||
  nome.includes('Urshifu') ||
  nome.includes('Zacian')  ||
  nome.includes('Zamazenta');

export const FOSSIL_DEX_NUMBERS = new Set([
  138,140,142,           // Gen 1: Omanyte, Kabuto, Aerodactyl
  345,347,               // Gen 3: Lileep, Anorith
  408,410,               // Gen 4: Cranidos, Shieldon
  564,566,               // Gen 5: Tirtouga, Archen
  696,698,               // Gen 6: Tyrunt, Amaura
]);

// ==================== STAGE CONFIGURATION ====================
export const STAGE_COUNT = 12; // stages 0–11
export const SPECIAL_STAGES = new Set([3, 5, 8, 10, 11]); // single CTnpc/boss encounter

// Enemy level ranges per stage (min/max inclusive)
export const STAGE_LEVEL_RANGES = [
  { min:1,   max:1   }, // stage 0
  { min:3,   max:5   }, // stage 1
  { min:10,  max:15  }, // stage 2
  { min:25,  max:25  }, // stage 3  (CTnpc)
  { min:30,  max:35  }, // stage 4
  { min:45,  max:45  }, // stage 5  (miniboss)
  { min:50,  max:55  }, // stage 6
  { min:60,  max:65  }, // stage 7
  { min:75,  max:75  }, // stage 8  (boss)
  { min:80,  max:85  }, // stage 9
  { min:95,  max:95  }, // stage 10 (boss)
  { min:100, max:100 }, // stage 11 (final boss)
];
export const getStageLevel = (stage) => {
  const r = STAGE_LEVEL_RANGES[Math.min(stage, STAGE_LEVEL_RANGES.length - 1)];
  return r.min + Math.floor(Math.random() * (r.max - r.min + 1));
};

// Money reward on clearing a stage (encounter reward for wild encounters)
export const STAGE_ENCOUNTER_MONEY = [200, 300, 350, 350, 400, 400, 450, 500, 500, 1000, 1000, 1000];
// Money reward from CTnpc battles (stages 3, 5, 8)
export const CTNPC_MONEY_REWARD = { 3: 500, 5: 1000, 8: 2000 };
// Stage completion bonus (small reward for finishing stage)
export const STAGE_MONEY_REWARDS = [0, 0, 0, 500, 0, 1000, 0, 0, 2000, 0, 0, 0];

// Locations per stage (player picks 2 to visit; special stages get 1 forced encounter)
export const STAGE_LOCATIONS = [
  // stage 0
  ['Rota Selvagem','Floresta Inicial','Caverna Rasa'],
  // stage 1
  ['Rota Arbustiva','Lago Tranquilo','Ruínas Antigas'],
  // stage 2
  ['Monte Rochoso','Pantanal Nebuloso','Pradaria Aberta'],
  // stage 3 — special (CTnpc)
  ['Arena do Treinador'],
  // stage 4
  ['Vulcão Adormecido','Gruta Glacial','Savana Dourada'],
  // stage 5 — special (miniboss)
  ['Santuário Sombrio'],
  // stage 6
  ['Litoral Tempestuoso','Floresta Assombrada','Deserto de Cristal'],
  // stage 7
  ['Torre Etérea','Pântano Tóxico','Montanha Sagrada'],
  // stage 8 — special (boss)
  ['Fortaleza Cyber'],
  // stage 9
  ['Abismo Gelado','Campos Elétricos','Selva Primordial'],
  // stage 10 — special (boss)
  ['Templo do Dragão'],
  // stage 11 — special (final boss)
  ['Núcleo Omega'],
];

export const ENCOUNTER_TYPES = {
  SELVAGEM:  'selvagem',   // wild Pokémon encounter
  TREINADOR: 'treinador',  // CTnpc trainer (team of 2)
  MINIBOSS:  'miniboss',   // single strong Pokémon
  BOSS:      'boss',       // legendary/ace Pokémon
  POKEMART:  'pokemart',   // shop
  POKECENTER:'pokecenter', // heal all Pokémon
};

// ==================== ITEMS DATA ====================

export const ITEMS_DATA = [
  // ── Pokébolas (ballDice = número de d4 para rolagem de captura) ──
  { id:'pokebola',   category:'pokeball', tier:'C', name:'Pokébola',  price:200,
    img:'/pokeballs/pokeball.png',   ballDice:12,
    desc:'Bola padrão de captura. Rola 12d4.' },
  { id:'greatball',  category:'pokeball', tier:'B', name:'Greatball', price:1000,
    img:'/pokeballs/greatball.png',  ballDice:14,
    desc:'Boa taxa de captura. Rola 14d4.' },
  { id:'ultraball',  category:'pokeball', tier:'B', name:'Ultraball', price:2000,
    img:'/pokeballs/ultraball.png',  ballDice:18,
    desc:'Alta taxa de captura. Rola 18d4.' },
  { id:'masterball', category:'pokeball', tier:'S', name:'Masterball',price:10000,
    ballAuto:true, img:'/pokeballs/masterball.png',
    desc:'Captura qualquer Pokémon sem falha. Apenas 1 por run.' },

  // ── Consumíveis ──────────────────────────────────────────────────
  { id:'pocao_menor',  category:'consumivel', tier:'C', name:'Poção Menor',  price:200,
    img:'/pokeballs/potion.png',     healVidas:1,
    desc:'Restaura 1 vida de um Pokémon.' },
  { id:'pocao_maior',  category:'consumivel', tier:'A', name:'Poção Maior',  price:3000,
    img:'/pokeballs/superpotion.png', healVidas:2,
    desc:'Restaura 2 vidas de um Pokémon.' },
  { id:'pocao_suprema',category:'consumivel', tier:'S', name:'Poção Suprema',price:6000,
    img:'/pokeballs/hiperpotion.png', healVidas:3,
    desc:'Restaura 3 vidas de um Pokémon.' },
  { id:'foto', category:'consumivel', tier:'C', name:'Fotografia', price:2600,
    img:'/jn/items/foto.png', effect:'foto_fotografo',
    desc:'Fotografia de pokémon. Venda no Pokémart por 2d12×100.' },
  { id:'pokedoll',     category:'consumivel', tier:'A', name:'Pokédoll',     price:3000,
    img:'/jn/items/pokedoll.png',   effect:'pokedoll',
    desc:'Usável antes de enfrentar um CTnpc. Avança ao próximo estágio e concede as recompensas.' },
  { id:'mochila',      category:'consumivel', tier:'B', name:'Mochila',      price:2500,
    img:'/jn/items/mochila.png',    effect:'mochila',
    desc:'+2 slots de inventário.' },
  { id:'pokecinto',    category:'consumivel', tier:'B', name:'Pokécinto',    price:2999,
    img:'/jn/items/pokecinto.png',  effect:'pokecinto',
    desc:'+1 slot de item held em um Pokémon capturado.' },

  // Pedras evolutivas (+3 atrib no pokémon, ou +5 com Evolucionista)
  { id:'pedra_fogo',      category:'consumivel', tier:'A', name:'Pedra Fogo',      price:5000,
    img:'/pedrasvolutivas/pedradofogo.png', effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_agua',      category:'consumivel', tier:'A', name:'Pedra Água',      price:5000,
    img:'/pedrasvolutivas/waterstone.png', effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_trovao',    category:'consumivel', tier:'A', name:'Pedra Trovão',    price:5000,
    img:'/pedra-trovao.png',             effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_folha',     category:'consumivel', tier:'A', name:'Pedra Folha',     price:5000,
    img:'/pedrasvolutivas/pedradafolha.png', effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_lua',       category:'consumivel', tier:'A', name:'Pedra Lua',       price:5000,
    img:'/pedrasvolutivas/moonstone.png', effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_sol',       category:'consumivel', tier:'A', name:'Pedra Sol',       price:5000,
    img:'/pedrasvolutivas/pedradosol.png', effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },

  // Incensos (ballmods especiais de encontro — limite 2 por encontro)
  { id:'incenso',          category:'consumivel', tier:'C', name:'Incenso',           price:800,
    img:'/jn/items/incenso.png',        effect:'incenso_tipo', bonus:0.30,
    desc:'+30% de chance de encontrar um Pokémon do tipo escolhido no próximo encontro selvagem.' },
  { id:'incenso_verde',    category:'consumivel', tier:'B', name:'Incenso Verde',     price:2800,
    img:'/jn/items/incensoverde.png',   effect:'incenso_tipo_garantido',
    desc:'Garante que o próximo encontro selvagem seja do tipo escolhido (1 ou 2 tipos).' },
  { id:'incenso_lendario', category:'consumivel', tier:'S', name:'Incenso Lendário',  price:6000,
    img:'/jn/items/incensolendario.png',effect:'incenso_lendario', bonus:0.10,
    desc:'+10% de chance de encontrar um lendário no próximo encontro selvagem.' },
  { id:'incenso_glitter',  category:'consumivel', tier:'A', name:'Incenso de Glitter',price:5000,
    img:'/jn/items/incensoglitter.png', effect:'incenso_shiny', bonus:0.10,
    desc:'+10% de chance de encontrar um Pokémon shiny no próximo encontro selvagem.' },
  { id:'incenso_porpurina',category:'consumivel', tier:'S', name:'Incenso de Porpurina',price:6000,
    img:'/jn/items/incensoglitter.png', effect:'incenso_shiny_tipo', bonus:0.10,
    desc:'+10% de chance de shiny e escolha de tipo no próximo encontro selvagem.' },

  // ── Frutas (Berries) ──────────────────────────────────────────────
  { id:'cheri',  category:'fruta', tier:'B', name:'Cheri Berry',  price:2225,
    img:'/frutas/cheri.png',     cureConditions:['paralisia'],
    desc:'Cura paralisia.' },
  { id:'pecha',  category:'fruta', tier:'B', name:'Pecha Berry',  price:2225,
    img:'/frutas/pecha.png',     cureConditions:['envenenamento'],
    desc:'Cura envenenamento.' },
  { id:'rawst',  category:'fruta', tier:'B', name:'Rawst Berry',  price:2225,
    img:'/frutas/rawst.png',     cureConditions:['queimadura'],
    desc:'Cura queimadura.' },
  { id:'aspear', category:'fruta', tier:'B', name:'Aspear Berry', price:2225,
    img:'/frutas/aspear.png',    cureConditions:['congelamento'],
    desc:'Cura congelamento.' },
  { id:'oran',   category:'fruta', tier:'C', name:'Oran Berry',   price:999,
    img:'/frutas/oran.png',      healVidas:1,
    desc:'Recupera 1 vida.' },
  { id:'leppa',  category:'fruta', tier:'S', name:'Leppa Berry',  price:6000,
    img:'/frutas/leppa.png',     healVidas:3,
    desc:'Recupera 3 vidas.' },
  { id:'persim', category:'fruta', tier:'B', name:'Persim Berry', price:2225,
    img:'/frutas/persim.png',    cureConditions:['confusao'],
    desc:'Cura confusão.' },
  { id:'lum',    category:'fruta', tier:'A', name:'Lum Berry',    price:4000,
    img:'/frutas/lum.png',       cureConditions:['all'],
    desc:'Cura qualquer condição cyber.' },
  { id:'sitrus', category:'fruta', tier:'A', name:'Sitrus Berry', price:4000,
    img:'/frutas/sitrus.png',    healVidas:2,
    desc:'Recupera 2 vidas.' },
  { id:'chesto', category:'fruta', tier:'A', name:'Chesto Berry', price:4000,
    img:'/frutas/chesto.png',    healVidas:1, cureConditions:['all'],
    desc:'Recupera 1 vida e cura qualquer condição cyber.' },

  // ── Itens Held ────────────────────────────────────────────────────
  { id:'luvadeboxe',       category:'held', tier:'B', name:'Luva de Boxe',        price:1250,
    img:'/jn/items/luvadeboxe.png',    effect:'luva_de_boxe',
    desc:'Golpes do Pokémon têm 1% de chance de nocautear o oponente. Acumula com Lutador.' },
  { id:'squirtle_carapaca',category:'held', tier:'B', name:'Carapaça de Squirtle',price:1500,
    img:'/jn/items/squirtlecarapaca.png', effect:'squirtle_carapaca',
    desc:'+1d em rolagens de Defesa e Defesa Especial.' },
  { id:'metalcoat',        category:'held', tier:'A', name:'Metal Coat',          price:3000,
    img:'/jn/items/metalcoat.png',     effect:'metal_coat',
    desc:'1×/turno: substitui todos os tipos por Metal ao atacar.' },

  // ── Ballmods ──────────────────────────────────────────────────────
  { id:'safariball',  category:'ballmod', tier:'C', name:'Safari Ball',  price:500,
    img:'/pokeballs/safariball.png',
    effect:'safariball',
    desc:'+1d de eficiência se o cyber treinador não atacou o Pokémon alvo.' },
  { id:'lureball',    category:'ballmod', tier:'C', name:'Lure Ball',    price:500,
    img:'/pokeballs/lureball.png',
    effect:'lureball',
    desc:'+1d de eficiência por classe do treinador entre: Cozinheiro, Botânico, Aventureiro, Observador.' },
  { id:'duskball',    category:'ballmod', tier:'C', name:'Dusk Ball',    price:500,
    img:'/pokeballs/duskball.png',
    effect:'duskball',
    desc:'+1d de eficiência se o Pokémon alvo é do tipo Noturno (Sombrio).' },
  { id:'timerball',   category:'ballmod', tier:'B', name:'Timer Ball',   price:1000,
    img:'/pokeballs/timerball.png',
    effect:'timerball',
    desc:'+1d de eficiência por turno de batalha (máximo +5d).' },
  { id:'healball',    category:'ballmod', tier:'A', name:'Heal Ball',    price:3000,
    img:'/pokeballs/healball.png',
    effect:'healball',
    desc:'+1d de eficiência por vida perdida do alvo. Pokémon capturado com este ballmod ganha +1 vida.' },
  { id:'heavyball',   category:'ballmod', tier:'B', name:'Heavy Ball',   price:1250,
    img:'/pokeballs/heavyball.png',
    effect:'heavyball',
    desc:'+2d de eficiência se o alvo é Metal, Pedra ou Terra (sem acúmulo por múltiplos tipos da lista).' },
  { id:'fastball',    category:'ballmod', tier:'A', name:'Fast Ball',    price:3000,
    img:'/pokeballs/fastball.png',
    effect:'fastball',
    desc:'+1d de eficiência se o alvo é Voador ou Fada. Pokémon capturado ganha +1d de Velocidade.' },
];

// ==================== TYPE ALIASES ====================
const TYPE_ALIAS_MAP = { 'Terrestre': 'Terra', 'Noturno': 'Sombrio' };
export const normalizeType = (t) => TYPE_ALIAS_MAP[t] ?? t;

// ==================== TYPE POWERS ====================
// Passive and triggered powers by Pokémon type
export const TYPE_POWERS = {
  'Água':     { passive:{ stat:['atk','def'],       dice:+1 }, trigger:'hp_gte2', desc:'+1d Atk e Def se vidas ≥ 2.' },
  'Dragão':   { passive:{ stat:['atkEsp','defEsp'], dice:+1 }, trigger:'hp_gte2', desc:'+1d AtkEsp e DefEsp se vidas ≥ 2.' },
  'Elétrico': { onAttack:{ chance:0.10, condition:'paralisia' }, desc:'10% de paralisar ao atacar.' },
  'Fada':     { passive:{ stat:['defEsp'], dice:+2 }, trigger:'hp_eq1', desc:'+2d DefEsp se vidas = 1.' },
  'Fantasma': { onFaint:'last_attack', desc:'Ao ficar com 0 vidas, realiza mais 1 ataque.' },
  'Fogo':     { onAttack:{ chance:0.10, condition:'queimadura' }, desc:'10% de queimar ao atacar.' },
  'Gelo':     { onAttack:{ chance:0.10, condition:'congelamento' }, desc:'10% de congelar ao atacar.' },
  'Inseto':   { onWinAttack:'heal_1', desc:'Ao vencer no ataque, recupera 1 vida.' },
  'Lutador':  { onAttack:{ chance:0.01, effect:'instant_ko' }, desc:'1% de nocautear instantaneamente.' },
  'Metal':    { onDefend:{ reduceFinalAtk:-2, perTenLevels:-1 }, desc:'Ataque físico do oponente -2 no valor final (+1 por 10 níveis do Metal).' },
  'Normal':   { immuneConditions:true, desc:'Imune a todas as cyber condições.' },
  'Pedra':    { passive:{ stat:['def'], dice:+1 }, trigger:'always', bonusVidas:1, desc:'+1 vida e +1d Def.' },
  'Planta':   { passive:{ stat:['def','defEsp'], dice:+1 }, trigger:'always', desc:'+1d Def e +1d DefEsp.' },
  'Psíquico': { passive:{ stat:['atkEsp'], dice:+2 }, trigger:'hp_gte2', desc:'+2d AtkEsp se vidas ≥ 2.' },
  'Terra':    { onTie:'only_opponent_loses', desc:'Em empate, só o oponente perde vida. Se ambos Terra, ninguém perde.' },
  'Sombrio':  { onAttack:{ chance:0.07, condition:'confusao' }, desc:'7% de confundir ao atacar. (Noturno)' },
  'Veneno':   { onAttack:{ chance:0.10, condition:'envenenamento' }, desc:'10% de envenenar ao atacar.' },
  'Voador':   { passive:{ stat:['vel'], dice:+2 }, trigger:'always', desc:'+2d Velocidade.' },
};

// ── Enciclopédia: Keyword Dictionary ─────────────────────────
export const KEYWORDS_DICT = {
  'vantagem':       'Rola os dados em dobro e usa o resultado mais alto.',
  'desvantagem':    'Rola os dados em dobro e usa o resultado mais baixo.',
  'dado':           'Unidade de rolagem (ex: 1d6 = um dado de 6 faces).',
  'dados':          'Unidade de rolagem (ex: 2d6 = dois dados de 6 faces).',
  'atributo':       'Um dos 6 stats do pokémon: Ataque, Ataque Especial, Defesa, Defesa Especial, Velocidade e Vida.',
  'slot':           'Espaço disponível (para pokémon, item ou held).',
  'slots':          'Espaços disponíveis (para pokémon, item ou held).',
  'ação especial':  'Habilidade ativa que o jogador usa manualmente durante o encontro.',
  'ballmod':        'Modificador de pokébola que altera as condições de captura.',
  'lendário':       'Pokémon de raridade extrema (1% de chance base de aparecer).',
  'shiny':          'Pokémon com coloração alternativa rara (0,5% de chance base).',
  'condição':       'Status negativo aplicado ao pokémon: paralisia, queimadura, congelamento, envenenamento ou confusão.',
  'condições':      'Status negativos aplicados ao pokémon: paralisia, queimadura, congelamento, envenenamento ou confusão.',
  'selvagem':       'Pokémon encontrado livremente na natureza, sem treinador.',
  'ctnpc':          'Cyber Treinador NPC — treinador inimigo controlado pelo sistema.',
  'boss':           'Inimigo final do percurso, encontrado no estágio 11.',
  'miniboss':       'Inimigo intermediário poderoso, encontrado no estágio 10.',
  'held':           'Item equipado diretamente no pokémon, com efeito passivo ou ativo.',
  'estágio':        'Uma fase do percurso JN. Cada estágio possui locais para visitar.',
  'estágios':       'Fases do percurso JN. Cada estágio possui locais para visitar.',
  'captura':        'Ação de lançar pokébola para tentar adicionar o pokémon selvagem à equipe.',
  'crítico':        'Acerto crítico: rolagem máxima em todos os dados de ataque — causa dano dobrado.',
  'puffin':         'Doce feito com berries. Pode ser usado no concurso para melhorar aptidões.',
  'berry':          'Fruta com efeitos variados: cura condições, restaura vida, entre outros.',
  'berries':        'Frutas com efeitos variados: curam condições, restauram vida, entre outros.',
};

// ── Enciclopédia: Type Descriptions ──────────────────────────
export const TYPE_DESCRIPTIONS = [
  { name:'Normal',   color:'#A8A878', icon:'⬜', desc:'Não sofre cyber condições (paralisia, congelamento, queimadura, envenenamento e confusão).' },
  { name:'Fogo',     color:'#F08030', icon:'🔥', desc:'10% de chance de queimar o oponente ao atacar. O oponente queimado recebe -2 dados de ataque.' },
  { name:'Água',     color:'#6890F0', icon:'💧', desc:'Recebe +1 dado de ataque e de defesa se está com 2 ou mais de vida.' },
  { name:'Elétrico', color:'#F8D030', icon:'⚡', desc:'10% de chance de paralisar o oponente ao atacar. O oponente paralisado recebe -2 dados de ataque especial.' },
  { name:'Planta',   color:'#78C850', icon:'🌿', desc:'Recebe +1 dado defesa e defesa especial.' },
  { name:'Gelo',     color:'#98D8D8', icon:'❄️',  desc:'10% de chance de congelar o oponente ao atacar. O oponente congelado recebe -2 dados de defesa.' },
  { name:'Luta',     color:'#C03028', icon:'🥊', desc:'Tem 1% de chance de nocautear o pokémon oponente, levando ele a 0 de vida com um golpe.' },
  { name:'Veneno',   color:'#A040A0', icon:'☠️',  desc:'10% de chance de envenenar o oponente ao atacar. O oponente envenenado recebe -2 dados de defesa especial.' },
  { name:'Terra',    color:'#E0C068', icon:'🪨', desc:'Em caso de empate na rolagem de ataque ou defesa, somente o pokémon oponente perde vida. Se os dois pokémons forem de terra, nenhum deles perde vida.' },
  { name:'Voador',   color:'#A890F0', icon:'🦅', desc:'Recebe +2 dado de velocidade.' },
  { name:'Psíquico', color:'#F85888', icon:'🔮', desc:'Recebe +2 dados de ataque especial se está com 2 ou mais de vida.' },
  { name:'Inseto',   color:'#A8B820', icon:'🐛', desc:'Se o atacante vencer na disputa de ataque, o pokémon inseto recupera 1 de vida. Tendo sua vida máxima como limite.' },
  { name:'Pedra',    color:'#B8A038', icon:'🪨', desc:'Recebe +1 de vida (todos os pokémons de pedra tem +1 coração de vida) e +1 dado de defesa.' },
  { name:'Fantasma', color:'#705898', icon:'👻', desc:'Ao ficar com 0 de vida, pode realizar mais 1 ataque, após isso ele é derrotado.' },
  { name:'Dragão',   color:'#7038F8', icon:'🐉', desc:'Recebe +1 dado de ataque especial e de defesa especial se está com 2 ou mais de vida.' },
  { name:'Noturno',  color:'#705848', icon:'🌑', desc:'7% de chance de confundir o oponente ao atacar. O oponente confuso recebe -2 dados de ataque e ataque especial.' },
  { name:'Metal',    color:'#B8B8D0', icon:'⚙️',  desc:'Todas as rolagens de ataque físico do oponente diminuem em 2 o valor final da rolagem. O valor do decréscimo aumenta em 1 a cada 10 níveis.' },
  { name:'Fada',     color:'#EE99AC', icon:'✨', desc:'Recebe +2 dados de defesa especial se está com 1 de vida.' },
];

// ── Enciclopédia: Location Descriptions ──────────────────────
export const LOCATIONS_DATA = [
  { name:'Matinho',             icon:'🌿', desc:'Encontro selvagem. Um pokémon aparece aleatoriamente e o cyber treinador pode batalhar ou tentar capturá-lo.' },
  { name:'Centro Pokémon',      icon:'🏥', desc:'Local de cura. Todos os pokémons da equipe têm a vida restaurada completamente. Condições são removidas.' },
  { name:'Pokémart',            icon:'🏪', desc:'Loja de itens. O cyber treinador pode comprar consumíveis, ballmods e outros recursos com pokedinheiros.' },
  { name:'Arena do Treinador',  icon:'⚔️',  desc:'Estágio 3 — Batalha obrigatória contra um Cyber Treinador NPC com pokémons e classes aleatórias.' },
  { name:'Santuário Sombrio',   icon:'🌑', desc:'Estágio 5 — Batalha contra um Cyber Treinador NPC avançado em um local misterioso.' },
  { name:'Fortaleza Cyber',     icon:'🏰', desc:'Estágio 8 — Batalha contra um Cyber Treinador NPC poderoso dentro de uma fortaleza tecnológica.' },
  { name:'Templo do Dragão',    icon:'🐉', desc:'Estágio 10 — Batalha contra o Miniboss: um pokémon de alto nível com poderes elevados.' },
  { name:'Núcleo Omega',        icon:'💠', desc:'Estágio 11 — Batalha final contra o Boss definitivo. Vencer garante a conclusão da jornada.' },
];

// ==================== CYBER CLASSES DATA ====================
export const CLASSES_DATA = [
  // ── Grupo 1: Concurso ──────────────────────────────────
  {
    groupId:'concurso', groupName:'Concurso', icon:'🎨',
    classes:[
      {id:'cyber_artista',     name:'Cyber Artista',     isBase:true,  powerKey:'artista_base',    powerDesc:'Pokémons capturados ganham +1 atrib. a cada 10 níveis (não no maior atrib.).'},
      {id:'cyber_beldade',     name:'Cyber Beldade',     isBase:false, powerKey:'beldade',          powerDesc:'+1 atrib. a cada 8 níveis em Ataque Especial.'},
      {id:'cyber_cativante',   name:'Cyber Cativante',   isBase:false, powerKey:'cativante',        powerDesc:'+1 atrib. a cada 8 níveis em Velocidade.'},
      {id:'cyber_coreografo',  name:'Cyber Coreógrafo',  isBase:false, powerKey:'coreografo',       powerDesc:'+1 atrib. a cada 8 níveis em Defesa.'},
      {id:'cyber_descolado',   name:'Cyber Descolado',   isBase:false, powerKey:'descolado',        powerDesc:'+1 atrib. a cada 8 níveis em Ataque.'},
      {id:'cyber_estilista',   name:'Cyber Estilista',   isBase:false, powerKey:'estilista',        powerDesc:'Ação especial: Estilizar — adiciona um tipo aleatório ao golpe do pokémon ativo. 1×/2 batalhas.'},
      {id:'cyber_nerd',        name:'Cyber Nerd',        isBase:false, powerKey:'nerd',             powerDesc:'Vantagem em batalha se o oponente tem um tipo igual a algum pokémon inativo.'},
      {id:'cyber_parrudo',     name:'Cyber Parrudo',     isBase:false, powerKey:'parrudo',          powerDesc:'Pokémons ganham +1 vida ao escolher a classe. +1 vida a todos após o estágio 9.'},
    ],
  },
  // ── Grupo 2: Captura ───────────────────────────────────
  {
    groupId:'captura', groupName:'Captura', icon:'🎯',
    classes:[
      {id:'cyber_captor',       name:'Cyber Captor',       isBase:true,  powerKey:'captor_base',    powerDesc:'+1 slot de pokémon.'},
      {id:'cyber_artifice',     name:'Cyber Artífice',     isBase:false, powerKey:'artifice',       powerDesc:'Cria armadura (+1d Def/DefEsp) ou espada (+1d Atk/AtkEsp) para 1 pokémon. Recarrega nos estágios 3, 5, 8.'},
      {id:'cyber_colecionador', name:'Cyber Colecionador', isBase:false, powerKey:'colecionador',   powerDesc:'+1 slot. +1 vida por espécie duplicada. 20% de encontrar pokémon da mesma espécie.'},
      {id:'cyber_domador',      name:'Cyber Domador',      isBase:false, powerKey:'domador',        powerDesc:'Ação especial: Domar — 2×/batalha, +2d em Atk ou AtkEsp (só vs selvagem).'},
      {id:'cyber_engenheiro',   name:'Cyber Engenheiro',   isBase:false, powerKey:'engenheiro_cap', powerDesc:'Elétrico/Metal: +2d em 2 atrib. Outros tipos: +1d em 1 atrib. (ao escolher a classe).'},
      {id:'cyber_ladrao',       name:'Cyber Ladrão',       isBase:false, powerKey:'ladrao',         powerDesc:'Ação especial: Raptar — 3×/batalha vs CTnpc, rolagem de captura. Único que captura pokémon de CTnpc.'},
      {id:'cyber_malabarista',  name:'Cyber Malabarista',  isBase:false, powerKey:'malabarista',    powerDesc:'Pokémons selvagens têm -1d Vel ao capturar. +1d mais a partir dos estágios 4, 6 e 7.'},
      {id:'cyber_pokeholista',  name:'Cyber Pokébolista',  isBase:false, powerKey:'pokeholista',    powerDesc:'Capturas com vantagem. 10% de ganhar ballmod aleatório ao fim de cada encontro.'},
    ],
  },
  // ── Grupo 3: Criação ───────────────────────────────────
  {
    groupId:'criacao', groupName:'Criação', icon:'🥚',
    classes:[
      {id:'cyber_criador',       name:'Cyber Criador',       isBase:true,  powerKey:'criador_base',   powerDesc:'15% de achar um pokéovo por encontro (escolhe 4 tipos; eclode imediatamente).'},
      {id:'cyber_botanico',      name:'Cyber Botânico',      isBase:false, powerKey:'botanico',       powerDesc:'30% de receber uma fruta aleatória por encontro.'},
      {id:'cyber_cozinheiro',    name:'Cyber Cozinheiro',    isBase:false, powerKey:'cozinheiro',     powerDesc:'Ação especial: Alimentar — 3 cargas totais. +3 vida em 1 pokémon OU +1 vida em todos (dura 1 encontro).'},
      {id:'cyber_cuidador',      name:'Cyber Cuidador',      isBase:false, powerKey:'cuidador',       powerDesc:'Ação especial: Mimar — 3 cargas totais. +2d em 1 atrib. escolhido (dura 1 encontro).'},
      {id:'cyber_evolucionista', name:'Cyber Evolucionista', isBase:false, powerKey:'evolucionista',  powerDesc:'Pedras evolutivas: +5 no atrib. (ao invés de +3). 10% de achar pedra evolutiva por encontro.'},
      {id:'cyber_incubador',     name:'Cyber Incubador',     isBase:false, powerKey:'incubador',      powerDesc:'Ao chocar um ovo, adiciona +10 pts em 1 atrib. do pokémon chocado.'},
      {id:'cyber_medico',        name:'Cyber Médico',        isBase:false, powerKey:'medico',         powerDesc:'Ao perder a última vida, recupera metade das vidas. Uma vez por pokémon por run.'},
      {id:'cyber_tutor',         name:'Cyber Tutor',         isBase:false, powerKey:'tutor',          powerDesc:'Ação especial: Tutoria — 1×/batalha, pokémon ativo usa golpe de um pokémon inativo.'},
    ],
  },
  // ── Grupo 4: Combate ───────────────────────────────────
  {
    groupId:'combate', groupName:'Combate', icon:'⚔️',
    classes:[
      {id:'cyber_guerreiro',    name:'Cyber Guerreiro',      isBase:true,  powerKey:'guerreiro_base',  powerDesc:'Seus pokémons capturados têm vantagem em rolagens de ataque.'},
      {id:'cyber_art_marcial',  name:'Cyber Artista Marcial',isBase:false, powerKey:'artista_marcial', powerDesc:'+1d em rolagens de ataque.'},
      {id:'cyber_atleta',       name:'Cyber Atleta',         isBase:false, powerKey:'atleta',          powerDesc:'+1d em rolagens de defesa.'},
      {id:'cyber_augure',       name:'Cyber Áugure',         isBase:false, powerKey:'augure',          powerDesc:'Rolagens de defesa e velocidade feitas com vantagem.'},
      {id:'cyber_bandido',      name:'Cyber Bandido',        isBase:false, powerKey:'bandido',         powerDesc:'25% de chance de ganhar 1 item ao entrar num encontro (S 3%, A 12%, B 15%, C 70%).'},
      {id:'cyber_monge',        name:'Cyber Monge',          isBase:false, powerKey:'monge',           powerDesc:'Ação especial: Golpe Duplo — 1×/batalha, pokémon ativo golpeia duas vezes no turno.'},
      {id:'cyber_ninja',        name:'Cyber Ninja',          isBase:false, powerKey:'ninja',           powerDesc:'+2d em rolagens de velocidade.'},
      {id:'cyber_soldado',      name:'Cyber Soldado',        isBase:false, powerKey:'soldado',         powerDesc:'Ação especial: Rambo — ataque com vantagem; oponente -10 ataque, você +10 defesa. Próximo turno: oponente ataca com vantagem.'},
    ],
  },
  // ── Grupo 5: Místico ───────────────────────────────────
  {
    groupId:'mistico', groupName:'Místico', icon:'🌟',
    classes:[
      {id:'cyber_mistico',     name:'Cyber Místico',    isBase:true,  powerKey:'mistico_base',   powerDesc:'10% de chance de um lendário aparecer e se juntar a você ao entrar em um encontro.'},
      {id:'cyber_bardo',       name:'Cyber Bardo',      isBase:false, powerKey:'bardo',          powerDesc:'Lendário: todas as rolagens com vantagem. Não lendário: Inspiração 1×/batalha (vantagem em 1 rolagem).'},
      {id:'cyber_guardiao_m',  name:'Cyber Guardião',   isBase:false, powerKey:'guardiao_mis',   powerDesc:'Lendário: +1d em todos os atrib. Não lendário: Escudo 1×/batalha (+1d Def ou DefEsp).'},
      {id:'cyber_ilusionista', name:'Cyber Ilusionista',isBase:false, powerKey:'ilusionista',    powerDesc:'Ação especial: Ilusão — 1×/batalha, oponente tem desvantagem na próxima rolagem.'},
      {id:'cyber_medium',      name:'Cyber Médium',     isBase:false, powerKey:'medium',         powerDesc:'+1d em todas as rolagens para cada pokémon capturado abatido.'},
      {id:'cyber_orador',      name:'Cyber Orador',     isBase:false, powerKey:'orador',         powerDesc:'Ação especial: Clamor — antes do boss, sacrifica todos e recebe lendário Nv.90 (+1d/pokémon sacrificado).'},
      {id:'cyber_runico',      name:'Cyber Rúnico',     isBase:false, powerKey:'runico',         powerDesc:'15% de chance de um Unown aparecer e se juntar a você ao entrar em um encontro.'},
      {id:'cyber_xama',        name:'Cyber Xamã',       isBase:false, powerKey:'xama',           powerDesc:'15% de chance de um pokémon tipo Fantasma aparecer e se juntar a você ao entrar em um encontro.'},
    ],
  },
  // ── Grupo 6: Pesquisa ──────────────────────────────────
  {
    groupId:'pesquisa', groupName:'Pesquisa', icon:'🔬',
    classes:[
      {id:'cyber_pesquisador', name:'Cyber Pesquisador',isBase:true,  powerKey:'pesquisador_base',powerDesc:'Acesso à pokédex catalogada. Sabe o(s) tipo(s) do pokémon selvagem antes da batalha.'},
      {id:'cyber_cientista',   name:'Cyber Cientista',  isBase:false, powerKey:'cientista',       powerDesc:'Ação especial: Criar Poção 1×/batalha (menor/maior/suprema). Poções curam +1 vida extra.'},
      {id:'cyber_fotografo',   name:'Cyber Fotógrafo',  isBase:false, powerKey:'fotografo',       powerDesc:'A cada encontro selvagem/CTnpc: recebe foto (2d12×100). Venda no Pokémart. Stack de 3.'},
      {id:'cyber_hipnologo',   name:'Cyber Hipnólogo',  isBase:false, powerKey:'hipnologo',       powerDesc:'Ação especial: Hipnose 1×/batalha — oponente -5 Atk/AtkEsp finais (-10 est.7, -20 contra boss).'},
      {id:'cyber_observador',  name:'Cyber Observador', isBase:false, powerKey:'observador',      powerDesc:'10% de chance de o pokémon encontrado ser shiny.'},
      {id:'cyber_ocultista',   name:'Cyber Ocultista',  isBase:false, powerKey:'ocultista',       powerDesc:'Lendários: +2d em todas as rolagens. Não lendário: Ocultismo 1×/batalha (+2d na próxima rolagem).'},
      {id:'cyber_petrologista',name:'Cyber Petrologista',isBase:false,powerKey:'petrologista',    powerDesc:'15% de chance de aparecer um pokémon fóssil ao entrar em um encontro.'},
      {id:'cyber_professor',   name:'Cyber Professor',  isBase:false, powerKey:'professor',       powerDesc:'Ganha +1 slot e recebe pokémon aleatório do set inicial (Nv. igual ao pokémon mais alto).'},
    ],
  },
  // ── Grupo 7: Psíquico ──────────────────────────────────
  {
    groupId:'psiquico', groupName:'Psíquico', icon:'🔮',
    classes:[
      {id:'cyber_psiquico',    name:'Cyber Psíquico',   isBase:true,  powerKey:'psiquico_base',   powerDesc:'+1d de ataque especial para seus pokémons.'},
      {id:'cyber_ardente',     name:'Cyber Ardente',    isBase:false, powerKey:'ardente',         powerDesc:'Ataques de Fogo: +1d de ataque especial.'},
      {id:'cyber_bruxo',       name:'Cyber Bruxo',      isBase:false, powerKey:'bruxo',           powerDesc:'Ataques de Fantasma ou Sombrio: +1d de ataque especial.'},
      {id:'cyber_celio',       name:'Cyber Célio',      isBase:false, powerKey:'celio',           powerDesc:'Ataques de Voador ou Psíquico: +1d de ataque especial.'},
      {id:'cyber_empatico',    name:'Cyber Empático',   isBase:false, powerKey:'empatico',        powerDesc:'+1d AtkEsp. Ação especial: 1×/batalha, recupera 1 vida se DefEsp > AtkEsp do oponente.'},
      {id:'cyber_nebuloso',    name:'Cyber Nebuloso',   isBase:false, powerKey:'nebuloso',        powerDesc:'Ataques de Água ou Gelo: +1d de ataque especial.'},
      {id:'cyber_terrulento',  name:'Cyber Terrulento', isBase:false, powerKey:'terrulento',      powerDesc:'Ataques de Terra, Pedra ou Metal: +1d de ataque especial.'},
      {id:'cyber_vidente',     name:'Cyber Vidente',    isBase:false, powerKey:'vidente',         powerDesc:'Ao escolher: todas suas rolagens com vantagem OU todas as rolagens contra você com desvantagem.'},
    ],
  },
  // ── Grupo 8: Exploração ────────────────────────────────
  {
    groupId:'exploracao', groupName:'Exploração', icon:'🗺️',
    classes:[
      {id:'cyber_ranger',      name:'Cyber Ranger',     isBase:true,  powerKey:'ranger_base',     powerDesc:'Se não atacar o pokémon selvagem, rolagens de captura ganham +2d.'},
      {id:'cyber_aventureiro', name:'Cyber Aventureiro',isBase:false, powerKey:'aventureiro',     powerDesc:'Ação especial: Forrageamento 1×/batalha — obtém fruta aleatória consumida imediatamente. 10% de achar item consumível ou held.'},
      {id:'cyber_cavaleiro',   name:'Cyber Cavaleiro',  isBase:false, powerKey:'cavaleiro',       powerDesc:'Pode visitar os 3 locais de cada estágio.'},
      {id:'cyber_detetive',    name:'Cyber Detetive',   isBase:false, powerKey:'detetive',        powerDesc:'Visualiza tipos de todos os encontros e pokémons de CTnpc em qualquer estágio (exceto boss).'},
      {id:'cyber_guia',        name:'Cyber Guia',       isBase:false, powerKey:'guia',            powerDesc:'Pokémons capturados +2 slots de item. Cyber treinador +2 slots de item.'},
      {id:'cyber_oficial',     name:'Cyber Oficial',    isBase:false, powerKey:'oficial',         powerDesc:'Ação especial: Comando 1×/batalha — +5 a uma rolagem (+8 est.6, +12 est.10).'},
      {id:'cyber_pactuario',   name:'Cyber Pactuário',  isBase:false, powerKey:'pactuario',       powerDesc:'Lendários: +2 vida. Não lendários: +1 vida.'},
      {id:'cyber_policial',    name:'Cyber Policial',   isBase:false, powerKey:'policial',        powerDesc:'+2d em captura se seu pokémon ativo foi atacado nesta batalha.'},
    ],
  },
  // ── Grupo 9: Treinamento ───────────────────────────────
  {
    groupId:'treinamento', groupName:'Treinamento', icon:'🏆',
    classes:[
      {id:'cyber_treinador',     name:'Cyber Treinador',     isBase:true,  powerKey:'treinador_base',  powerDesc:'+1 atrib. a cada 5 níveis para todos os pokémons capturados.'},
      {id:'cyber_azarao',        name:'Cyber Azarão',        isBase:false, powerKey:'azarao',          powerDesc:'Ação especial: Rerolar qualquer rolagem 1×/encontro.'},
      {id:'cyber_cacador',       name:'Cyber Caçador',       isBase:false, powerKey:'cacador_tre',     powerDesc:'Ao falhar uma captura, o pokémon não pode fugir.'},
      {id:'cyber_elementalista', name:'Cyber Elementalista', isBase:false, powerKey:'elementalista',   powerDesc:'Ao escolher: seleciona 1 tipo. Ação especial: adiciona este tipo ao pokémon para 1 batalha (recarrega após 1 batalha).'},
      {id:'cyber_especialista',  name:'Cyber Especialista',  isBase:false, powerKey:'especialista',    powerDesc:'Ao escolher: seleciona 1 atrib. Todos pokémons ganham +1d a cada 8 níveis nesse atrib.'},
      {id:'cyber_estrategista',  name:'Cyber Estrategista',  isBase:false, powerKey:'estrategista',    powerDesc:'10% de chance de qualquer golpe infligir uma condição cyber aleatória.'},
      {id:'cyber_inquebravel',   name:'Cyber Inquebrável',   isBase:false, powerKey:'inquebravel',     powerDesc:'Cada pokémon inativo com vida cheia aumenta em +1 a vidasMax do pokémon ativo.'},
      {id:'cyber_sincrono',      name:'Cyber Síncrono',      isBase:false, powerKey:'sincrono',        powerDesc:'Ação especial: 1×/encontro, +1d em 1 rolagem para cada pokémon no time (vivos e abatidos).'},
    ],
  },
];

// ==================== GAME USERS ====================
export const JN_USERS = [
  { username: 'Alocin',  color: '#3B82F6' },
  { username: 'Lila',    color: '#EC4899' },
  { username: 'Ludovic', color: '#10B981' },
  { username: 'Noryat',  color: '#F59E0B' },
  { username: 'Pedro',   color: '#8B5CF6' },
  { username: 'Visitante', color: '#6B7280', isGuest: true },
];

export const JN_PASSWORD = 'DnD7MarPkm';

// ==================== GAME MODES ====================
export const GAME_MODES = [
  { id: 'pocket',   name: 'Pocket',  desc: 'Modo padrão — 12 estágios (0–11)', stageCount: 12 },
  { id: 'jornada',  name: 'Jornada', desc: 'Modo longo — 24 estágios',          stageCount: 24 },
  { id: 'endless',  name: 'Endless', desc: 'Infinito — estágios crescentes',   stageCount: Infinity },
];

// ==================== CYBER CONDITIONS ====================
export const CONDITIONS = {
  paralisia:     { name: 'Paralisia',    icon: '⚡', color: '#FBBF24', statPenalty: { stat: 'atkEsp', dice: -2 } },
  queimadura:    { name: 'Queimadura',   icon: '🔥', color: '#EF4444', statPenalty: { stat: 'atk',    dice: -2 } },
  congelamento:  { name: 'Congelamento', icon: '❄️', color: '#93C5FD', statPenalty: { stat: 'def',    dice: -2 } },
  envenenamento: { name: 'Envenenamento',icon: '☠️', color: '#A855F7', statPenalty: { stat: 'defEsp', dice: -2 } },
  confusao:      { name: 'Confusão',     icon: '💫', color: '#F472B6', statPenalty: { stat: 'atk',    dice: -2 }, extraPenalty: { stat: 'atkEsp', dice: -2 } },
};

export const CONDITION_CLEAR_CHANCE = 0.10; // 10% per turn

// ==================== FIXED STARTERS (1ª run) ====================
// Names must match pokemonData.js exactly (pt-BR)
export const FIXED_STARTER_NAMES = [
  'Squirtle','Bulbassauro','Charmander',
  'Totodile','Chikorita','Cyndaquil',
  'Chimchar','Treecko','Mudkip',
];

export const PROFESSOR_STARTER_NAMES = [
  'Pikachu','Squirtle','Wartortle','Blastoise',
  'Bulbassauro','Ivysauro','Venosauro',
  'Charmander','Charmeleon','Charizard',
];

export const CYBERDEX_USERS = ['Ludovic','Alocin','Lila','Noryat','Pedro'];

// ==================== CYBERDEX (Firebase) ====================
const JN_CYBERDEX_PATH = (username) => `jnCyberdex/${username}`;

/** Load cyberdex for a user: returns Set of dexNumbers (strings) */
export const loadJNCyberdex = async (username) => {
  try {
    const snap = await get(ref(database, JN_CYBERDEX_PATH(username)));
    if (!snap.exists()) return new Set();
    const data = snap.val();
    return new Set(Object.keys(data).map(Number));
  } catch {
    return new Set();
  }
};

/** Add a pokémon (by dexNumber) to the user's JN cyberdex */
export const addToJNCyberdex = async (username, dexNumber) => {
  if (!username || !dexNumber) return;
  try {
    await update(ref(database, JN_CYBERDEX_PATH(username)), { [dexNumber]: true });
  } catch {
    // silent fail — offline or AppCheck issue
  }
};

// ==================== RANKING ====================
export const JN_RANKING_PATH = (modeId) => `jnRanking/${modeId}`;
export const RANKING_TOP_N = 5;

// ============================================================
// Part 2: Utilities + Pokémon Generation
// ============================================================

// ── Dice Utilities ──────────────────────────────────────────
/** Roll n d4 dice, return { rolls: number[], total: number } */
export const rollD4 = (n) => {
  const count = Math.max(0, Math.round(n));
  if (count === 0) return { rolls: [], total: 0 };
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * 4) + 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
};

/** Convert stat value to base d4 dice count: floor(stat / 2) */
export const statToDice = (stat) => Math.max(1, Math.floor((stat || 1) / 2));

/** Map App.jsx statusBasais keys → JN stat keys */
const mapStatsToJN = (s) => ({
  atk:    s.ataque          || 1,
  def:    s.defesa          || 1,
  atkEsp: s.ataqueEspecial  || 1,
  defEsp: s.defesaEspecial  || 1,
  vel:    s.velocidade      || 1,
  hp:     s.saude           || 1,
});

// ── Stat Distribution (adapted from App.jsx lines 1041–1085) ──
const _getStatHierarchy = (stats) => {
  const attrs = [
    { key: 'atk',    valor: stats.atk    },
    { key: 'def',    valor: stats.def    },
    { key: 'atkEsp', valor: stats.atkEsp },
    { key: 'defEsp', valor: stats.defEsp },
    { key: 'vel',    valor: stats.vel    },
    { key: 'hp',     valor: stats.hp     },
  ];
  return attrs.sort((a, b) => b.valor - a.valor);
};

const _distributePoints = (baseStats, hierarchy, level) => {
  const points = level - 1;
  const current = { ...baseStats };
  if (points <= 0) return current;
  const order = hierarchy.map((a) => a.key);
  const values = { ...current };
  for (let p = 0; p < points; p++) {
    const valid = [];
    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      const newVal = values[key] + 1;
      let ok = true;
      if (i > 0 && newVal >= values[order[i - 1]]) ok = false;
      if (i < order.length - 1 && newVal <= values[order[i + 1]]) ok = false;
      if (ok) valid.push(key);
    }
    if (valid.length > 0) {
      const pick = valid[Math.floor(Math.random() * valid.length)];
      values[pick] += 1;
      current[pick] += 1;
    } else {
      values[order[0]] += 1;
      current[order[0]] += 1;
      for (let i = 1; i < order.length; i++) {
        if (values[order[i]] >= values[order[i - 1]]) {
          values[order[i]] = values[order[i - 1]] - 1;
          current[order[i]] = values[order[i - 1]] - 1;
        }
      }
    }
  }
  return current;
};

// ── Filter helpers ───────────────────────────────────────────
const ALLOWED_REGIONS = new Set(['Kanto','Johto','Hoenn','Sinnoh','Unova','Kalos','Alola']);

const getPkmRegion = (p) => {
  if (p.nome.includes('Alola'))  return 'Alola';
  if (p.nome.includes('Galar'))  return 'Galar';
  if (p.nome.includes('Hisui'))  return 'Hisui';
  if (p.nome.includes('Paldea')) return 'Paldea';
  if (p.nome.includes('Arceus')) return 'Sinnoh';
  const d = p.dexNumber;
  // Hoenn special forms
  if ([10001,10002,10003].includes(d)) return 'Hoenn'; // Deoxys formas
  // Sinnoh special forms
  if ([10004,10005,10006,10007,10008,10009,10010,10011,10012,10034,10035,10269,10270].includes(d)) return 'Sinnoh'; // Wormadam, Shaymin Céu, Giratina Origin, Rotom formas, Burmy formas, Mothim formas
  // Kalos special forms
  if ([10086,10118,10120].includes(d)) return 'Kalos'; // Hoopa Desconfinado, Zygarde 10%/Completo
  // Native ranges
  if (d <= 151) return 'Kanto';
  if (d <= 251) return 'Johto';
  if (d <= 386) return 'Hoenn';
  if (d <= 493) return 'Sinnoh';
  if (d <= 649) return 'Unova';
  if (d <= 721 || [10118,10120,10086].includes(d)) return 'Kalos';
  if (d <= 809 || [10091,10092,10100,10101,10102,10103,10104,10105,10106,10107,10108,10109,10110,10111,10112,10113,10114,10115].includes(d)) return 'Alola';
  if (d <= 905 || [10161,10162,10163,10164,10165,10166,10167,10168,10169,10170,10171,10172,10173,10174,10175,10176,10177,10178,10179,10180].includes(d)) return 'Galar';
  if (d <= 1025 || [10273,10274,10275,10250,10251,10252,10253,10276,10277].includes(d)) return 'Paldea';
  return 'Desconhecida';
};

const isRegionBanned = (p) => !ALLOWED_REGIONS.has(getPkmRegion(p));

// ── Base Vidas by context ────────────────────────────────────
const BASE_VIDAS = {
  player:    2,
  wild:      3,
  ctnpc:     2,
  miniboss:  10,
  boss:      15,
  finalboss: 15,
};

export const calcBaseVidas = (species, context = 'wild', { isLeg = false, isShn = false } = {}) => {
  let v = BASE_VIDAS[context] ?? 3;
  if (species.tipos?.includes('Pedra')) v += 1;
  if (isLeg && isShn) v += 3;
  else if (isLeg) v += 2;
  else if (isShn) v += 1;
  return v;
};

// ── Pokémon Image URL ────────────────────────────────────────
export const getPokemonImageUrl = (dexNumber, shiny = false) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? 'shiny/' : ''}${dexNumber}.png`;

// ── Core JN Pokémon Generator ────────────────────────────────
/**
 * Generate a JN Pokémon object from a pokedex species entry.
 * @param {object}  species  - entry from pokedexData
 * @param {number}  level    - target level (1–100)
 * @param {object}  opts     - { context, forceShiny, heldItem }
 */
export const generateJNPokemon = (species, level, opts = {}) => {
  const { context = 'wild', forceShiny = false, heldItem = null } = opts;

  const baseJN   = mapStatsToJN(species.statusBasais);
  const hierarchy = _getStatHierarchy(baseJN);
  const finalStats = _distributePoints(baseJN, hierarchy, level);

  const isShiny = forceShiny || Math.random() < (1 / 4096);
  const isSingleType = (species.tipos?.length ?? 0) === 1;
  const isLegendarySpecies = isLegendary(species.nome);

  // Vida: base por contexto + bônus de tipo (Pedra) + bônus lendário/shiny
  let vidasMax = calcBaseVidas(species, context, { isLeg: isLegendarySpecies, isShn: isShiny });
  const vidasAtual = vidasMax;

  const diceBase = {
    atk:    statToDice(finalStats.atk),
    def:    statToDice(finalStats.def),
    atkEsp: statToDice(finalStats.atkEsp),
    defEsp: statToDice(finalStats.defEsp),
    vel:    statToDice(finalStats.vel),
  };

  return {
    uid:          `jn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome:         species.nome,
    dexNumber:    species.dexNumber,
    types:        (species.tipos ?? []).map(normalizeType),
    level,
    stats:        finalStats,
    diceBase,
    vidasMax,
    vidasAtual,
    isShiny,
    isSingleType,
    imageUrl:     getPokemonImageUrl(species.dexNumber, false), // always non-shiny sprite; sparkle shown via sparlkeshin.png
    heldItem,
    conditions:   [],  // array of condition keys
    metalCoatUsed: false, // Metal Coat 1×/turn tracker
    catchRate:    species.catchRate ?? 45,
    isFossil:     FOSSIL_DEX_NUMBERS.has(species.dexNumber),
    pontosAtrib:  0,
    diceBonus:    { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 },
  };
};

// ── Context attribute bonus (miniboss/boss get extra points per 2 levels) ──
const _addContextAtribBonus = (pkm, extraPoints) => {
  if (extraPoints <= 0) return pkm;
  const hierarchy = _getStatHierarchy(pkm.stats);
  const newStats = _distributePoints(pkm.stats, hierarchy, extraPoints + 1);
  return {
    ...pkm,
    stats: newStats,
    diceBase: {
      atk:    statToDice(newStats.atk),
      def:    statToDice(newStats.def),
      atkEsp: statToDice(newStats.atkEsp),
      defEsp: statToDice(newStats.defEsp),
      vel:    statToDice(newStats.vel),
    },
  };
};

// ── Pokémon Pool Helpers ─────────────────────────────────────
const _basePool = () => pokedexData.filter((p) => !isRegionBanned(p));

/** Pick a random species from the filtered Pokédex */
export const pickRandomSpecies = (blacklist = new Set()) => {
  const pool = _basePool().filter((p) => !blacklist.has(p.dexNumber));
  if (pool.length === 0) return _basePool()[0];
  return pool[Math.floor(Math.random() * pool.length)];
};

// ── CTnpc combat class pool (powerKeys with meaningful battle effects) ──────
const CTNPC_COMBAT_CLASS_KEYS = [
  'guerreiro_base', 'artista_marcial',                       // passive +atk
  'psiquico_base', 'empatico',                               // passive +atkEsp (empatico also active)
  'ardente', 'bruxo', 'celio', 'nebuloso', 'terrulento',    // type-specific +atkEsp
  'atleta', 'augure', 'ninja',                               // passive def/vel
  'estrategista',                                            // passive 10% condition on hit
  'soldado', 'monge', 'ocultista', 'bardo', 'oficial',       // active offensive
  'hipnologo', 'ilusionista',                                // active debuff vs player
];

// ── Enemy Generators ─────────────────────────────────────────
/** Generate a single wild Pokémon for the given stage */
export const generateWild = (stage) => {
  const level   = getStageLevel(stage);
  const species = pickRandomSpecies();
  return generateJNPokemon(species, level, { context: 'wild' });
};

/** Generate a CTnpc team + classes: size/classes vary by stage (3→1, 5→2, 8→3) */
export const generateCTNpcTeam = (stage) => {
  const level      = getStageLevel(stage);
  const size       = stage === 3 ? 1 : stage === 5 ? 2 : stage === 8 ? 3 : 2;
  const classCount = stage === 3 ? 1 : stage === 5 ? 2 : stage === 8 ? 3 : 2;

  // Pick random combat classes (no duplicates)
  const classPool     = CLASSES_DATA.flatMap((g) => g.classes).filter((c) => CTNPC_COMBAT_CLASS_KEYS.includes(c.powerKey));
  const usedClassIds  = new Set();
  const classes       = [];
  for (let i = 0; i < classCount && classes.length < classPool.length; i++) {
    const avail = classPool.filter((c) => !usedClassIds.has(c.id));
    if (!avail.length) break;
    const cls = avail[Math.floor(Math.random() * avail.length)];
    usedClassIds.add(cls.id);
    classes.push(cls);
  }

  const used = new Set();
  const team = Array.from({ length: size }, () => {
    const species = pickRandomSpecies(used);
    used.add(species.dexNumber);
    return generateJNPokemon(species, level, { context: 'ctnpc' });
  });
  return { team, classes };
};

/** Pick 3 reward items for miniboss victory: one S-tier, one A-tier, one B-tier (no ballmods). */
const pickMinibossRewardItems = () => {
  const pool = ITEMS_DATA.filter((i) => i.category !== 'ballmod');
  const pickTier = (tier) => {
    const t = pool.filter((i) => i.tier === tier);
    return t.length ? t[Math.floor(Math.random() * t.length)] : null;
  };
  return [pickTier('S'), pickTier('A'), pickTier('B')].filter(Boolean);
};

/** Generate a mini-boss Pokémon (stage 10) — low catch rate, +1 atrib per 2 levels */
export const generateMiniBoss = (stage) => {
  const level   = getStageLevel(stage);
  const pool    = _basePool().filter((p) => (p.catchRate ?? 45) < 75);
  const species = pool[Math.floor(Math.random() * pool.length)] ?? _basePool()[0];
  const pkm     = generateJNPokemon(species, level, { context: 'miniboss' });
  return _addContextAtribBonus(pkm, Math.floor(level / 2));
};

/** Generate a boss Pokémon (stage 8) — legendary or very low catch rate, +2 atrib per 2 levels */
export const generateBoss = (stage) => {
  const level   = getStageLevel(stage);
  const pool    = _basePool().filter((p) =>
    isLegendary(p.nome) || (p.catchRate ?? 45) < 30
  );
  const species = pool[Math.floor(Math.random() * pool.length)] ?? _basePool()[0];
  const pkm     = generateJNPokemon(species, level, { context: 'boss' });
  return _addContextAtribBonus(pkm, Math.floor(level / 2) * 2);
};

/** Generate the final boss (stage 11) — always legendary, +2 atrib per 2 levels */
export const generateFinalBoss = () => {
  const level  = getStageLevel(11);
  const pool   = _basePool().filter((p) => isLegendary(p.nome));
  const species = pool[Math.floor(Math.random() * pool.length)] ?? _basePool()[0];
  const pkm     = generateJNPokemon(species, level, { context: 'finalboss' });
  return _addContextAtribBonus(pkm, Math.floor(level / 2) * 2);
};

// ── Starter Generator (guest fallback: 10 random from base pool) ──
export const generateGuestStarterChoices = () => {
  const pool = _basePool();
  const used = new Set();
  const picks = [];
  while (picks.length < 10 && used.size < pool.length) {
    const s = pool[Math.floor(Math.random() * pool.length)];
    if (!used.has(s.dexNumber)) { used.add(s.dexNumber); picks.push(s); }
  }
  return picks.map((s) => generateJNPokemon(s, 1, { context: 'player' }));
};

// ── Encounter Builder for a Stage ───────────────────────────
/**
 * Build the encounter list for a given stage.
 * Returns array of { type, pokemonOrTeam }.
 * Player picks 2 locations for normal stages; special stages are forced.
 */
export const buildStageEncounters = (stage) => {
  // Stage 0: only 1 location — forced wild encounter (matinho)
  if (stage === 0) {
    return [{ type: ENCOUNTER_TYPES.SELVAGEM, enemy: [generateWild(stage)], name: 'Matinho' }];
  }
  if (SPECIAL_STAGES.has(stage)) {
    if (stage === 3)  { const { team: t, classes: c } = generateCTNpcTeam(stage); return [{ type: ENCOUNTER_TYPES.TREINADOR, enemy: t, ctnpcClasses: c, name: 'Arena do Treinador' }]; }
    if (stage === 5)  { const { team: t, classes: c } = generateCTNpcTeam(stage); return [{ type: ENCOUNTER_TYPES.TREINADOR, enemy: t, ctnpcClasses: c, name: 'Santuário Sombrio' }]; }
    if (stage === 8)  { const { team: t, classes: c } = generateCTNpcTeam(stage); return [{ type: ENCOUNTER_TYPES.TREINADOR, enemy: t, ctnpcClasses: c, name: 'Fortaleza Cyber' }]; }
    if (stage === 10) return [{ type: ENCOUNTER_TYPES.MINIBOSS,  enemy: [generateMiniBoss(stage)], name: 'Templo do Dragão' }];
    if (stage === 11) return [{ type: ENCOUNTER_TYPES.BOSS,      enemy: [generateFinalBoss()], name: 'Núcleo Omega' }];
  }

  const locationPool = [
    { type: ENCOUNTER_TYPES.SELVAGEM,    enemy: null, name: 'Matinho' },
    { type: ENCOUNTER_TYPES.POKECENTER,  enemy: null, name: 'Centro Pokémon' },
    { type: ENCOUNTER_TYPES.POKEMART,    enemy: null, name: 'Pokémart' },
  ];
  return locationPool.map((loc) => {
    if (loc.type === ENCOUNTER_TYPES.SELVAGEM)  return { ...loc, enemy: [generateWild(stage)] };
    if (loc.type === ENCOUNTER_TYPES.TREINADOR) return { ...loc, enemy: generateCTNpcTeam(stage) };
    return loc;
  });
};

// ── Ranking (Firebase) ───────────────────────────────────────
export const pushRanking = (modeId, entry) => {
  // entry: { name, score, stages, won, date, team }
  push(ref(database, JN_RANKING_PATH(modeId)), entry);
};

/** Calculate final score from run stats */
export const calcScore = ({ stage, captures, money, turnsTotal }) =>
  stage * 1000 + captures * 200 + money + Math.max(0, 5000 - turnsTotal * 10);

/** Calculate final score for pocket mode */
export const calcPocketScore = ({ runStats, team, money }) => {
  let score = 0;
  score += (runStats.captures ?? 0) * 1;
  score += (runStats.normalStagesCleared ?? 0) * 10;
  score += (runStats.specialStagesCleared ?? 0) * 15;
  score += (runStats.shinyCaptured ?? 0) * 10;
  score += (runStats.legendaryCaptured ?? 0) * 15;
  score += (runStats.legendaryShinyCapture ?? 0) * 20;
  score += Math.floor((money ?? 0) / 100);
  if (runStats.bossWon)     score += 30;
  if (runStats.minibossWon) score += 20;
  if (runStats.bossWon) {
    const surviving = (team ?? []).filter((p) => (p.vidasAtual ?? 0) > 0).length;
    score += surviving * 5;
  }
  const heldItems = (team ?? []).reduce((sum, p) => {
    const held = p.held ?? {};
    return sum + Object.values(held).filter(Boolean).length;
  }, 0);
  score += heldItems;
  return score;
};

// ============================================================
// Part 4: Battle Math — Pure Functions (module-level)
// ============================================================

// ── Condition helpers ────────────────────────────────────────
const tickConditions = (pkm) => ({
  ...pkm,
  conditions: pkm.conditions.filter(() => Math.random() > CONDITION_CLEAR_CHANCE),
});

/** Apply or replace a cyber condition on a Pokémon. */
const tryApplyCondition = (pkm, condKey, isBoss) => {
  if (!pkm || pkm.conditions.includes(condKey)) return pkm;
  // Normal type is immune to all cyber conditions
  if ((pkm.types ?? []).includes('Normal')) return pkm;
  const maxConds = isBoss ? 2 : 1;
  if (pkm.conditions.length >= maxConds) {
    if (!isBoss) return { ...pkm, conditions: [condKey] }; // replace on non-boss
    return pkm; // already full on boss
  }
  return { ...pkm, conditions: [...pkm.conditions, condKey] };
};

// ── Dice modifiers ────────────────────────────────────────────
const getConditionPenalty = (pkm, stat) => {
  let penalty = 0;
  for (const cond of (pkm.conditions ?? [])) {
    const def = CONDITIONS[cond];
    if (!def) continue;
    if (def.statPenalty?.stat   === stat) penalty += def.statPenalty.dice;
    if (def.extraPenalty?.stat  === stat) penalty += def.extraPenalty.dice;
  }
  return penalty; // negative value
};

const getSingleTypeBonus = (pkm) => (pkm.isSingleType ? 1 : 0);

const getClassAtkBonus = (attackType, powerKeys, attackerTypes = []) => {
  if (!powerKeys?.length) return 0;
  let bonus = 0;
  // Physical attack bonuses
  if (attackType === 'atk') {
    if (powerKeys.includes('artista_marcial')) bonus += 1;
  }
  // Special attack bonuses
  if (attackType === 'atkEsp') {
    if (powerKeys.includes('psiquico_base')) bonus += 1;
    if (powerKeys.includes('empatico'))     bonus += 1;
    // Type-specific Psíquico subclasses
    const has = (t) => attackerTypes.includes(t);
    if (powerKeys.includes('ardente')    && has('Fogo'))                                    bonus += 1;
    if (powerKeys.includes('bruxo')      && (has('Fantasma') || has('Sombrio')))            bonus += 1;
    if (powerKeys.includes('celio')      && (has('Voador')   || has('Psíquico')))           bonus += 1;
    if (powerKeys.includes('nebuloso')   && (has('Água')     || has('Gelo')))               bonus += 1;
    if (powerKeys.includes('terrulento') && (has('Terra') || has('Pedra') || has('Metal'))) bonus += 1;
  }
  return bonus;
};

const getClassDefBonus = (defStat, powerKeys) => {
  if (!powerKeys?.length) return 0;
  let bonus = 0;
  if (defStat === 'def') {
    if (powerKeys.includes('atleta')) bonus += 1;
    if (powerKeys.includes('augure')) bonus += 1;
  }
  if (defStat === 'vel') {
    if (powerKeys.includes('ninja'))  bonus += 2;
    if (powerKeys.includes('augure')) bonus += 1;
  }
  return bonus;
};

/** Returns passive type-power dice bonus for a given stat. */
const getTypePowerBonus = (pkm, stat) => {
  let bonus = 0;
  const vidas = pkm.vidasAtual ?? 0;
  for (const t of (pkm.types ?? [])) {
    const power = TYPE_POWERS[t];
    if (!power?.passive) continue;
    if (!power.passive.stat.includes(stat)) continue;
    const trigger = power.trigger ?? 'always';
    if (trigger === 'always')                        bonus += power.passive.dice;
    else if (trigger === 'hp_gte2' && vidas >= 2)    bonus += power.passive.dice;
    else if (trigger === 'hp_eq1'  && vidas === 1)   bonus += power.passive.dice;
  }
  return bonus;
};

/**
 * Calculate final attack dice count.
 * Returns 'immune' if the target is immune.
 */
const calcAttackDice = (attacker, attackType, defenderTypes, classKeys, useMetalCoat = false, selectedType = null, ignoreTypeResist = false, extraTypes = []) => {
  const base = attacker.diceBase?.[attackType] ?? 1;
  const atkTypes = useMetalCoat ? ['Metal'] : (selectedType ? [selectedType, ...extraTypes] : [...(attacker.types ?? []), ...extraTypes]);

  let diceMod = 0;
  if (!ignoreTypeResist) {
    // Best multiplier across all attacker types, ignoring immune matchups.
    // Only returns 'immune' if ALL attacker types are immune against this defender.
    let bestMult = 0;
    for (const t of atkTypes) {
      const m = getTypeEffectiveness(t, defenderTypes ?? []);
      if (m === 0) continue; // skip immune type pairings, try other types
      if (m > bestMult) bestMult = m;
    }
    if (bestMult === 0) return 'immune'; // every attacker type is immune → truly blocked
    diceMod = multToDiceMod(bestMult);
  }
  // ignoreTypeResist = true → diceMod stays 0 (neutral), no immunity possible

  const singleBonus = getSingleTypeBonus(attacker);
  const classBonus  = getClassAtkBonus(attackType, classKeys, attacker.types ?? []);
  const typeBonus   = getTypePowerBonus(attacker, attackType);
  const condPenalty = getConditionPenalty(attacker, attackType);
  const diceBonus   = attacker.diceBonus?.[attackType] ?? 0;

  return Math.max(1, base + diceMod + singleBonus + classBonus + typeBonus + condPenalty + diceBonus);
};

const calcDefDice = (defender, defStat, classKeys) => {
  const base        = defender.diceBase?.[defStat] ?? 1;
  const singleBonus = getSingleTypeBonus(defender);
  const classBonus  = getClassDefBonus(defStat, classKeys);
  const typeBonus   = getTypePowerBonus(defender, defStat);
  const condPenalty = getConditionPenalty(defender, defStat);
  const diceBonus   = defender.diceBonus?.[defStat] ?? 0;
  // Carapaça de Squirtle: +1d to def and defEsp
  const defHeld = Array.isArray(defender.heldItem) ? defender.heldItem : (defender.heldItem ? [defender.heldItem] : []);
  const carapacaBonus = (defStat === 'def' || defStat === 'defEsp')
    ? defHeld.filter((h) => h?.effect === 'squirtle_carapaca').length
    : 0;
  return Math.max(1, base + singleBonus + classBonus + typeBonus + condPenalty + diceBonus + carapacaBonus);
};

// ── Enemy AI ──────────────────────────────────────────────────
const enemyChooseAttack = (enemyPkm, playerPkm, eClassKeys = null) => {
  const a  = calcAttackDice(enemyPkm, 'atk',    playerPkm.types, eClassKeys);
  const ae = calcAttackDice(enemyPkm, 'atkEsp', playerPkm.types, eClassKeys);
  if (a  === 'immune' && ae === 'immune') return 'atk';
  if (a  === 'immune') return 'atkEsp';
  if (ae === 'immune') return 'atk';
  return ae > a ? 'atkEsp' : 'atk';
};

const enemyChooseDefense = (enemyPkm, playerAtkAction, eClassKeys = null) => {
  const forcedDefStat = playerAtkAction === 'atk' ? 'def' : 'defEsp';
  const defDice = calcDefDice(enemyPkm, forcedDefStat, eClassKeys);
  const velDice = calcDefDice(enemyPkm, 'vel', eClassKeys);
  return velDice > defDice ? 'vel' : forcedDefStat;
};

/** CTnpc AI: decides which special action to use this turn (returns key or null). */
const decideCTNpcAction = (enemyPkm, playerPkm, ctnpcClassKeys, enemySa) => {
  const ck  = ctnpcClassKeys ?? [];
  const esa = enemySa ?? {};
  const healthRatio = (enemyPkm.vidasAtual ?? 1) / Math.max(1, enemyPkm.vidasMax ?? 1);
  const isLowHealth = healthRatio <= 0.5;
  // Recovery first when low health and conditions met
  if (ck.includes('empatico') && !esa.empaticUsed && isLowHealth) {
    if ((enemyPkm.diceBase?.defEsp ?? 1) > (playerPkm.diceBase?.atkEsp ?? 1)) return 'empatico_e';
  }
  // Debuffs (affect player's next attack)
  if (ck.includes('hipnologo')   && !esa.hipnosoUsed)   return 'hipnose_e';
  if (ck.includes('ilusionista') && !esa.ilusionistUsed) return 'ilusao_e';
  // Offensive buffs
  if (ck.includes('soldado')   && !esa.soldadoUsed)   return 'rambo_e';
  if (ck.includes('monge')     && !esa.mongeUsed)     return 'golpe_duplo_e';
  if (ck.includes('ocultista') && !esa.ocultistUsed)  return 'ocultismo_e';
  if (ck.includes('bardo')     && !esa.bardoUsed)     return 'inspiracao_e';
  if (ck.includes('oficial')   && !esa.oficialUsed)   return 'oficial_e';
  return null;
};

/**
 * Apply a CTnpc special action. Returns updated enemySa + attack modifiers.
 * Pure function — does not call setState.
 */
const applyCTNpcSpecialAction = (action, enemySa, enemyPkm, playerPkm, stageLvl, log) => {
  const esa = { ...enemySa };
  let extraAtkDice = 0, atkVantagem = false, finalAtkBonus = 0, mongePending = false;
  let newEnemyPkm = enemyPkm;

  switch (action) {
    case 'hipnose_e':
      esa.hipnosoUsed = true; esa.hipnosePending_e = true;
      log.push(`💤 [CTnpc] Hipnose! Seu próximo ataque sofrerá penalidade.`);
      break;
    case 'ilusao_e':
      esa.ilusionistUsed = true; esa.ilusionistaPending_e = true;
      log.push(`🎭 [CTnpc] Ilusão! Você terá desvantagem no próximo ataque.`);
      break;
    case 'rambo_e':
      esa.soldadoUsed = true; esa.soldadoPlayerCounterNext = true;
      atkVantagem = true;
      log.push(`🪖 [CTnpc] Rambo! Ataca com vantagem.`);
      break;
    case 'golpe_duplo_e':
      esa.mongeUsed = true; mongePending = true;
      log.push(`👊 [CTnpc] Golpe Duplo! Atacará duas vezes.`);
      break;
    case 'ocultismo_e':
      esa.ocultistUsed = true; extraAtkDice = 2;
      log.push(`🔮 [CTnpc] Ocultismo! +2d no ataque.`);
      break;
    case 'inspiracao_e':
      esa.bardoUsed = true; atkVantagem = true;
      log.push(`🎵 [CTnpc] Inspiração! Ataca com vantagem.`);
      break;
    case 'oficial_e':
      esa.oficialUsed = true;
      finalAtkBonus = stageLvl >= 10 ? 12 : stageLvl >= 6 ? 8 : 5;
      log.push(`📋 [CTnpc] Comando! +${finalAtkBonus} no ataque.`);
      break;
    case 'empatico_e': {
      esa.empaticUsed = true;
      const eDefEsp = enemyPkm.diceBase?.defEsp ?? 1;
      const pAtkEsp = playerPkm.diceBase?.atkEsp ?? 1;
      if (eDefEsp > pAtkEsp) {
        newEnemyPkm = { ...enemyPkm, vidasAtual: Math.min(enemyPkm.vidasMax, enemyPkm.vidasAtual + 1) };
        log.push(`💙 [CTnpc] Empatia! DefEsp(${eDefEsp}d) > AtkEsp(${pAtkEsp}d) — recuperou 1 vida!`);
      } else {
        log.push(`💙 [CTnpc] Empatia falhou.`);
      }
      break;
    }
    default: break;
  }
  return { updatedSa: esa, extraAtkDice, atkVantagem, finalAtkBonus, mongePending, enemyPkm: newEnemyPkm };
};

// ── Condition triggers ────────────────────────────────────────
const ALL_CONDITIONS = ['paralisia', 'queimadura', 'congelamento', 'envenenamento', 'confusao'];
const randomCondition = () => ALL_CONDITIONS[Math.floor(Math.random() * ALL_CONDITIONS.length)];

// ── Capture formula ───────────────────────────────────────────
/**
 * Returns { success, rolls, escapeRolls, healballBonus }
 * ballItem: item object from ITEMS_DATA (pokeball)
 * activeballmod: id string of active ballmod (or null)
 * opts: { playerAttacked, turnNum, classKeys, stage }
 */
const attemptCaptureRoll = (enemy, ballItem, activeballmod, playerPkm, classKeys, opts = {}) => {
  // Masterball always works
  if (ballItem?.ballAuto) return { success: true, rolls: [1], escapeRolls: [0], healballBonus: false };

  const ck = classKeys ?? [];
  let capDice = ballItem?.ballDice ?? 5;

  // Ballmod bonuses
  let healballBonus = false;
  if (activeballmod) {
    const bmod = ITEMS_DATA.find((i) => i.id === activeballmod);
    if (bmod) {
      const eff = bmod.effect;
      if (eff === 'safariball' && !opts.playerAttacked) capDice += 1;
      if (eff === 'lureball') {
        const lureClasses = ['cozinheiro','botanico','aventureiro','observador'];
        capDice += lureClasses.filter((k) => ck.includes(k)).length;
      }
      if (eff === 'duskball' && (enemy.types ?? []).includes('Sombrio')) capDice += 1;
      if (eff === 'timerball') capDice += Math.min(5, opts.turnNum ?? 0);
      if (eff === 'healball') {
        const vidasPerdidas = (enemy.vidasMax ?? 3) - (enemy.vidasAtual ?? 3);
        capDice += vidasPerdidas;
        healballBonus = true;
      }
      if (eff === 'heavyball' && (enemy.types ?? []).some((t) => ['Metal','Pedra','Terra'].includes(t))) capDice += 2;
      if (eff === 'fastball' && (enemy.types ?? []).some((t) => ['Voador','Fada'].includes(t))) capDice += 1;
    }
  }

  // Class bonuses
  if (ck.includes('ranger_base') && !opts.playerAttacked) capDice += 2;
  if (ck.includes('malabarista')) {
    const stage = opts.stage ?? 0;
    let malReduction = 1;
    if (stage >= 4) malReduction += 1;
    if (stage >= 6) malReduction += 1;
    if (stage >= 7) malReduction += 1;
    // applied to enemy escape dice below
  }
  if (ck.includes('policial') && opts.playerWasAttacked) capDice += 2;

  // Pokeholista: vantagem (roll twice, take higher)
  const hasVantagem = ck.includes('pokeholista');
  const doRoll = () => rollD4(Math.max(1, capDice));
  const captureRoll = hasVantagem
    ? (() => { const r1 = doRoll(); const r2 = doRoll(); return r1.total >= r2.total ? r1 : r2; })()
    : doRoll();

  // Enemy escape: base vel dice + vida modifier (each current vida = +1d, each lost vida = -1d)
  // Shiny: +1 dice per current vida | Legendary: +3 | Legendary Shiny: +4
  // CTnpc: +1 dice per current vida (instead of shiny/leg mods)
  const baseVelDice   = calcDefDice(enemy, 'vel', null);
  const malabaristaMod = ck.includes('malabarista')
    ? -(1 + (opts.stage >= 4 ? 1 : 0) + (opts.stage >= 6 ? 1 : 0) + (opts.stage >= 7 ? 1 : 0))
    : 0;
  const vidaModifier   = (enemy.vidasAtual ?? 3) - ((enemy.vidasMax ?? 3) - (enemy.vidasAtual ?? 3));
  const isCTNpcEnemy   = opts.isCTNpc ?? false;
  const isLegEnemy     = !isCTNpcEnemy && isLegendary(enemy.nome);
  const isShinyEnemy   = !isCTNpcEnemy && !!enemy.isShiny;
  const specialVidaMod = (isLegEnemy && isShinyEnemy) ? 4 * (enemy.vidasAtual ?? 3)
                       : isLegEnemy                   ? 3 * (enemy.vidasAtual ?? 3)
                       : isShinyEnemy                 ? 1 * (enemy.vidasAtual ?? 3)
                       : 0;
  const ctnpcVidaMod   = isCTNpcEnemy ? (enemy.vidasAtual ?? 1) : 0;
  const escapeDice     = Math.max(0, baseVelDice + vidaModifier + specialVidaMod + ctnpcVidaMod + malabaristaMod);
  const escapeRolls = escapeDice > 0 ? rollD4(escapeDice) : { rolls: [0], total: 0 };

  return {
    success: captureRoll.total > escapeRolls.total,
    rolls:      captureRoll.rolls,
    escapeRolls: escapeRolls.rolls,
    healballBonus,
  };
};

// ============================================================
// Part 5: Helper UI Components (module-level, pure)
// ============================================================
const IMG_FALLBACK = '/pokeballs/placeholderitem.png';
const safeImg = (e) => { e.target.src = IMG_FALLBACK; };

const TypeBadge = ({ type }) => (
  <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold"
    style={{ backgroundColor: TYPE_COLORS[type] ?? '#888' }}>
    {type}
  </span>
);

const VidasDisplay = ({ atual, max }) => (
  <div className="flex gap-0.5 flex-wrap items-center">
    {Array.from({ length: max }, (_, i) => (
      <img key={i} src="/jn/pokecoracao.png" alt="♥" onError={safeImg}
        className={`w-5 h-5 ${i >= atual ? 'opacity-20 grayscale' : ''}`} />
    ))}
  </div>
);

const PkmCard = ({ pkm, onClick, selected, small }) => (
  <div onClick={onClick} className={`cursor-pointer rounded-xl border-2 transition-all
    ${selected ? 'border-yellow-400 bg-yellow-900/30 scale-105' : 'border-gray-600 bg-gray-800/60 hover:border-gray-400'}
    ${small ? 'p-2' : 'p-3'} flex flex-col items-center gap-1`}>
    <div className="relative">
      {pkm.isShiny && (
        <img src="/jn/sparlkeshin.png" alt="shiny" onError={safeImg}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
      )}
      <img src={pkm.imageUrl} alt={pkm.nome} onError={safeImg}
        className={`relative z-10 ${small ? 'w-12 h-12' : 'w-20 h-20'} object-contain`} />
    </div>
    <p className="text-white font-bold text-sm text-center leading-tight">{pkm.nome}</p>
    <div className="flex gap-1 flex-wrap justify-center">
      {(pkm.types ?? []).map((t) => <TypeBadge key={t} type={t} />)}
    </div>
    {!small && <VidasDisplay atual={pkm.vidasAtual} max={pkm.vidasMax} />}
    {!small && (
      <p className="text-gray-400 text-xs">Nv.{pkm.level}
        {pkm.isShiny ? ' ✨' : ''}{isLegendary(pkm.nome) ? ' 🌟' : ''}
      </p>
    )}
  </div>
);

// ── Mart tier probabilities per stage ────────────────────────
// Each entry: { C, B, A, S } — probability weights (sum to 1)
export const MART_TIER_CHANCES = [
  null,                                 // stage 0 — no mart
  { C:0.91, B:0.08, A:0.01, S:0.00 }, // stage 1
  { C:0.89, B:0.09, A:0.02, S:0.00 }, // stage 2
  null,                                 // stage 3 — special
  { C:0.80, B:0.16, A:0.04, S:0.00 }, // stage 4
  null,                                 // stage 5 — special
  { C:0.77, B:0.17, A:0.05, S:0.01 }, // stage 6
  { C:0.49, B:0.35, A:0.14, S:0.02 }, // stage 7
  null,                                 // stage 8 — special
  { C:0.25, B:0.35, A:0.35, S:0.05 }, // stage 9
  null,                                 // stage 10 — special
  null,                                 // stage 11 — special
];

// Wild encounter reward tier probabilities per stage
export const WILD_REWARD_TIER_CHANCES = [
  { C:1.00, B:0.00, A:0.00, S:0.00 }, // stage 0
  { C:0.91, B:0.08, A:0.01, S:0.00 }, // stage 1
  { C:0.89, B:0.09, A:0.02, S:0.00 }, // stage 2
  { C:0.89, B:0.09, A:0.02, S:0.00 }, // stage 3
  { C:0.80, B:0.16, A:0.04, S:0.00 }, // stage 4
  { C:0.80, B:0.16, A:0.04, S:0.00 }, // stage 5
  { C:0.77, B:0.17, A:0.05, S:0.01 }, // stage 6
  { C:0.49, B:0.35, A:0.14, S:0.02 }, // stage 7
  { C:0.49, B:0.35, A:0.14, S:0.02 }, // stage 8
  { C:0.25, B:0.35, A:0.35, S:0.05 }, // stage 9
  { C:0.25, B:0.35, A:0.35, S:0.05 }, // stage 10
  { C:0.25, B:0.35, A:0.35, S:0.05 }, // stage 11
];

/** Pick a tier given a { C, B, A, S } probability object */
export const pickTier = (tierChances) => {
  const r = Math.random();
  if (r < tierChances.S) return 'S';
  if (r < tierChances.S + tierChances.A) return 'A';
  if (r < tierChances.S + tierChances.A + tierChances.B) return 'B';
  return 'C';
};

/** Pick 3 distinct random items (non-ballmod, non-pokeball) for wild encounter reward */
export const generateWildRewardItems = (stage) => {
  const chances = WILD_REWARD_TIER_CHANCES[Math.min(stage, WILD_REWARD_TIER_CHANCES.length - 1)];
  const pool = ITEMS_DATA.filter((i) => i.category !== 'pokeball' && i.category !== 'ballmod');
  const picks = [];
  const used = new Set();
  let attempts = 0;
  while (picks.length < 3 && attempts < 50) {
    attempts++;
    const tier = pickTier(chances);
    const tierPool = pool.filter((i) => i.tier === tier && !used.has(i.id));
    if (tierPool.length === 0) continue;
    const item = tierPool[Math.floor(Math.random() * tierPool.length)];
    used.add(item.id);
    picks.push(item);
  }
  return picks;
};

/** Get mart stock items for a given stage (respects tier probabilities for all items including pokébolas) */
export const getMartStock = (stage) => {
  const chances = MART_TIER_CHANCES[stage] ?? MART_TIER_CHANCES[1];
  if (!chances) return [];
  // All items (including pokébolas) participate in tier-based selection
  const pool = ITEMS_DATA;
  const stock = [];
  const used = new Set();
  let attempts = 0;
  while (stock.length < 12 && attempts < 100) {
    attempts++;
    const tier = pickTier(chances);
    const tierPool = pool.filter((i) => i.tier === tier && !used.has(i.id));
    if (tierPool.length === 0) continue;
    const item = tierPool[Math.floor(Math.random() * tierPool.length)];
    used.add(item.id);
    stock.push(item);
  }
  return stock;
};

// ── Auto-use fruta from held items ───────────────────────────
// trigger: 'vida' (pkm reached 1 vida) | 'condition' (pkm got a condition)
const applyAutoFruta = (pkm, log, trigger) => {
  const held = Array.isArray(pkm.heldItem) ? pkm.heldItem : (pkm.heldItem ? [pkm.heldItem] : []);
  const frutaIdx = held.findIndex((h) => {
    const idef = ITEMS_DATA.find((i) => i.id === h?.id);
    if (!idef || idef.category !== 'fruta') return false;
    if (trigger === 'vida') return !!idef.healVidas;
    if (trigger === 'condition') {
      if (!idef.cureConditions) return false;
      if (idef.cureConditions[0] === 'all') return pkm.conditions.length > 0;
      return idef.cureConditions.some((c) => pkm.conditions.includes(c));
    }
    return false;
  });
  if (frutaIdx === -1) return pkm;
  const fruta = held[frutaIdx];
  const idef = ITEMS_DATA.find((i) => i.id === fruta.id);
  let updated = { ...pkm };
  const newHeld = held.filter((_, i) => i !== frutaIdx);
  updated.heldItem = newHeld.length === 0 ? null : newHeld.length === 1 ? newHeld[0] : newHeld;
  if (idef.healVidas) {
    updated.vidasAtual = Math.min(updated.vidasMax, updated.vidasAtual + idef.healVidas);
  }
  if (idef.cureConditions) {
    const toRemove = idef.cureConditions[0] === 'all' ? [...updated.conditions] : idef.cureConditions;
    updated.conditions = updated.conditions.filter((c) => !toRemove.includes(c));
  }
  const healMsg = idef.healVidas ? ` (+${idef.healVidas} vida → ${updated.vidasAtual}/${updated.vidasMax})` : '';
  log.push(`🍓 ${updated.nome} usou ${idef.name} automaticamente!${healMsg}`);
  return updated;
};

// ── Module-level rollVelInitiative ────────────────────────────
/**
 * Rolls velocity for both Pokémon once and returns true if player goes first.
 * Tie-breaking: higher vel attribute → random 50/50.
 * Pushes result messages to `log`.
 */
const rollVelInitiative = (playerPkm, enemyPkm, pClassKeys, log, eClassKeys = null) => {
  const pVelVantagem = (pClassKeys ?? []).includes('augure');
  const eVelVantagem = (eClassKeys ?? []).includes('augure');
  const pVDice = calcDefDice(playerPkm, 'vel', pClassKeys);
  const eVDice = calcDefDice(enemyPkm,  'vel', eClassKeys);
  const doRollVel = (dice, vantagem) => {
    const r1 = rollD4(dice);
    if (!vantagem) return r1;
    const r2 = rollD4(dice);
    const kept = r1.total >= r2.total ? r1 : r2;
    const disc = r1.total >= r2.total ? r2 : r1;
    return { ...kept, discarded: disc.rolls };
  };
  const pVRoll = doRollVel(pVDice, pVelVantagem);
  const eVRoll = doRollVel(eVDice, eVelVantagem);
  log.push({
    type: 'vel',
    pNome: playerPkm.nome, pRolls: pVRoll.rolls, pDiscarded: pVelVantagem ? (pVRoll.discarded ?? null) : null, pTotal: pVRoll.total,
    eNome: enemyPkm.nome,  eRolls: eVRoll.rolls, eDiscarded: eVelVantagem ? (eVRoll.discarded ?? null) : null, eTotal: eVRoll.total,
  });

  let playerGoesFirst;
  if (pVRoll.total > eVRoll.total) {
    playerGoesFirst = true;
    log.push(`⚡ ${playerPkm.nome} tem a iniciativa!`);
  } else if (eVRoll.total > pVRoll.total) {
    playerGoesFirst = false;
    log.push(`⚡ ${enemyPkm.nome} tem a iniciativa!`);
  } else {
    const pVelAttr = playerPkm.diceBase?.vel ?? 1;
    const eVelAttr = enemyPkm.diceBase?.vel ?? 1;
    if (pVelAttr !== eVelAttr) {
      playerGoesFirst = pVelAttr > eVelAttr;
      log.push(`⚖️ Empate de vel! ${playerGoesFirst ? playerPkm.nome : enemyPkm.nome} tem mais vel e vai primeiro.`);
    } else {
      playerGoesFirst = Math.random() < 0.5;
      log.push(`⚖️ Empate total de vel! Sorteio: ${playerGoesFirst ? playerPkm.nome : enemyPkm.nome} vai primeiro.`);
    }
  }
  return playerGoesFirst;
};

// ── Module-level doAttack ──────────────────────────────────────
/**
 * Executes one single attack exchange.
 * opts: { atkVantagem, atkDesvantagem, finalAtkBonus, finalAtkPenalty, extraAtkDice,
 *         selectedType, pClassKeys, log, isBoss, metalCoatUsedThisTurn, defChoice }
 */
const doAttack = (atk, atkAction, def, isPlayer, opts = {}) => {
  const pClassKeys = opts.pClassKeys ?? [];
  const log = opts.log ?? [];
  const isBoss = opts.isBoss ?? false;
  const metalCoatUsedThisTurn = opts.metalCoatUsedThisTurn ?? false;

  const forcedDefStat = atkAction === 'atk' ? 'def' : 'defEsp';
  const defChoice = opts.defChoice ?? null;
  const defStat   = defChoice === 'vel' ? 'vel' : forcedDefStat;
  const defLbl    = defStat === 'vel' ? 'Vel' : defStat === 'def' ? 'Def' : 'DefEsp';

  const eClassKeys = opts.eClassKeys ?? null;
  const defKeys  = isPlayer ? eClassKeys : pClassKeys;
  const atkKeys2 = isPlayer ? pClassKeys : eClassKeys;

  const augureDefVantagem = (defKeys ?? []).includes('augure');
  const defVantagem    = augureDefVantagem || (opts.defVantagem    ?? false);
  const defDesvantagem = opts.defDesvantagem ?? false;

  // Boss ignore-resistance turn: every 4 turns starting from the 2nd (0-indexed turnNums 1,5,9…)
  const bossIgnoreResist = !isPlayer && isBoss && (() => {
    const tn = opts.turnNum ?? -1;
    return tn >= 1 && (tn - 1) % 4 === 0;
  })();

  // Metal Coat (player only, once per turn)
  let useMC = false;
  if (isPlayer && !metalCoatUsedThisTurn) {
    const held = Array.isArray(atk.heldItem) ? atk.heldItem : (atk.heldItem ? [atk.heldItem] : []);
    if (held.some((h) => h?.effect === 'metal_coat')) useMC = true;
  }

  if (bossIgnoreResist) log.push(`💀 [Boss] Turno de poder! Ignora resistências de tipo e item!`);

  const estilizarExtra = isPlayer && opts.estilizarExtraType ? [opts.estilizarExtraType] : [];
  const baseDice = calcAttackDice(atk, atkAction, def.types, atkKeys2, useMC, isPlayer ? (opts.selectedType ?? null) : null, bossIgnoreResist, estilizarExtra);
  if (baseDice === 'immune') {
    log.push(`🚫 ${def.nome} é imune ao ataque de ${atk.nome}!`);
    return { atk, def, defFainted: false, usedMC: false };
  }
  const atkDice = Math.max(1, baseDice + (opts.extraAtkDice ?? 0));

  const doRollAdv = (dice, vantagem, desvantagem) => {
    const r1 = rollD4(dice);
    if (vantagem)   { const r2 = rollD4(dice); const kept = r1.total >= r2.total ? r1 : r2; const disc = r1.total >= r2.total ? r2 : r1; return { ...kept, discarded: disc.rolls }; }
    if (desvantagem){ const r2 = rollD4(dice); return r1.total <= r2.total ? r1 : r2; }
    return r1;
  };
  const atkRoll = doRollAdv(atkDice, opts.atkVantagem, opts.atkDesvantagem);
  const defDice = calcDefDice(def, defStat, defKeys);
  const defRoll = doRollAdv(defDice, defVantagem, defDesvantagem);
  const lbl = atkAction === 'atk' ? 'Atk' : 'AtkEsp';

  // Metal type power: reduce physical atk final total against Metal defenders
  const atkTypes2 = useMC ? ['Metal'] : (atk.types ?? []);
  let atkTotal = atkRoll.total;
  if (atkAction === 'atk' && !bossIgnoreResist) {
    for (const dt of (def.types ?? [])) {
      if (dt === 'Metal') {
        const reduction = 2 + Math.floor((def.level ?? 1) / 10);
        atkTotal = Math.max(0, atkTotal - reduction);
        log.push(`🛡️ Metal reduz o ataque físico em ${reduction}!`);
        break;
      }
    }
  }

  // Apply special action final bonuses / penalties
  if (opts.finalAtkBonus)   { atkTotal += opts.finalAtkBonus;  log.push(`✨ +${opts.finalAtkBonus} (ação especial)!`); }
  if (opts.finalAtkPenalty) { atkTotal = Math.max(0, atkTotal - opts.finalAtkPenalty); log.push(`💤 -${opts.finalAtkPenalty} (ação especial)!`); }

  log.push({
    type: 'roll',
    atkIcon: isPlayer ? '⚔️' : '👾',
    atkNome: atk.nome, lbl,
    atkRolls: atkRoll.rolls, atkDiscarded: opts.atkVantagem ? (atkRoll.discarded ?? null) : null,
    atkDesvantagem: !!opts.atkDesvantagem, atkTotal,
    defNome: def.nome, defLbl,
    defRolls: defRoll.rolls, defDiscarded: defVantagem ? (defRoll.discarded ?? null) : null,
    defDesvantagem: !!defDesvantagem, defTotal: defRoll.total,
  });

  const isSE = atkTotal > defRoll.total && multToDiceMod(
    getTypeEffectiveness((useMC ? 'Metal' : (isPlayer && opts.selectedType ? opts.selectedType : (atk.types ?? [])[0])) ?? 'Normal', def.types)
  ) > 0;

  if (atkTotal > defRoll.total) {
    // KO chance: Lutador type +1% + each Luva de Boxe held +1%
    const atkHeld = Array.isArray(atk.heldItem) ? atk.heldItem : (atk.heldItem ? [atk.heldItem] : []);
    const luvaCount = atkHeld.filter((h) => h?.effect === 'luva_de_boxe').length;
    const lutadorBonus = atkTypes2.includes('Lutador') ? 1 : 0;
    const koChance = (luvaCount + lutadorBonus) * 0.01;
    if (koChance > 0 && Math.random() < koChance) {
      def = { ...def, vidasAtual: 0 };
      log.push(`💀 Golpe fatal de ${atk.nome}! Nocaute instantâneo!`);
    } else {
      const margin = atkTotal - defRoll.total;
      const vidaLost = margin >= 15 ? 2 : 1;
      def = { ...def, vidasAtual: def.vidasAtual - vidaLost };
      const vidaMsg = vidaLost === 2 ? `💥💥 Golpe devastador! ${def.nome} perde 2 vidas! (margem ${margin}) (${def.vidasAtual}/${def.vidasMax})` : `💥 ${def.nome} perde 1 vida! (${def.vidasAtual}/${def.vidasMax})`;
      log.push(vidaMsg);
      if (def.vidasAtual === 1) def = applyAutoFruta(def, log, 'vida');
    }

    // On-attack type triggers
    const condsBefore = def.conditions.length;
    const condTriggers = [
      { type: 'Fogo',     chance: 0.10, cond: 'queimadura'     },
      { type: 'Elétrico', chance: 0.10, cond: 'paralisia'       },
      { type: 'Gelo',     chance: 0.10, cond: 'congelamento'    },
      { type: 'Veneno',   chance: 0.10, cond: 'envenenamento'   },
      { type: 'Sombrio',  chance: 0.07, cond: 'confusao'        },
    ];
    for (const { type, chance, cond } of condTriggers) {
      if (atkTypes2.includes(type) && Math.random() < chance) {
        const before = def.conditions.length;
        def = tryApplyCondition(def, cond, isPlayer && isBoss);
        if (def.conditions.length > before)
          log.push(`☠️ ${def.nome} ficou com ${CONDITIONS[cond]?.name}! (poder ${type})`);
        break; // only one type trigger per hit
      }
    }

    // Inseto power: recover 1 vida on successful hit
    if (atkTypes2.includes('Inseto')) {
      atk = { ...atk, vidasAtual: Math.min(atk.vidasMax, atk.vidasAtual + 1) };
      log.push(`🐛 ${atk.nome} (Inseto) recuperou 1 vida!`);
    }

    // Estrategista: 10% chance of random condition on any hit
    if (isPlayer && pClassKeys?.includes('estrategista') && Math.random() < 0.10) {
      const cond = randomCondition();
      const before = def.conditions.length;
      def = tryApplyCondition(def, cond, isPlayer && isBoss);
      if (def.conditions.length > before)
        log.push(`☠️ ${def.nome} ficou com ${CONDITIONS[cond]?.name}! (Estrategista)`);
    }
    // CTnpc Estrategista: same passive
    if (!isPlayer && (eClassKeys ?? []).includes('estrategista') && Math.random() < 0.10) {
      const cond = randomCondition();
      const before = def.conditions.length;
      def = tryApplyCondition(def, cond, isPlayer && isBoss);
      if (def.conditions.length > before)
        log.push(`☠️ ${def.nome} ficou com ${CONDITIONS[cond]?.name}! (Estrategista CTnpc)`);
    }

    // Auto-use fruta on new condition
    if (def.conditions.length > condsBefore) def = applyAutoFruta(def, log, 'condition');

    // Shell Bell: recover 1 vida
    if (isPlayer) {
      const held = Array.isArray(atk.heldItem) ? atk.heldItem : (atk.heldItem ? [atk.heldItem] : []);
      if (held.some((h) => h?.effect === 'shell_bell')) {
        atk = { ...atk, vidasAtual: Math.min(atk.vidasMax, atk.vidasAtual + 1) };
        log.push(`🐚 ${atk.nome} recuperou 1 vida (Shell Bell)!`);
      }
    }
  } else if (atkTotal === defRoll.total) {
    if (defStat === 'vel') {
      log.push(`⚖️ Empate! Defesa por velocidade — ninguém perde vida.`);
    } else {
      const atkHasTerra = atkTypes2.includes('Terra');
      const defHasTerra = (def.types ?? []).includes('Terra');
      if (!atkHasTerra) atk = { ...atk, vidasAtual: atk.vidasAtual - 1 };
      if (!defHasTerra) def = { ...def, vidasAtual: def.vidasAtual - 1 };
      if (atk.vidasAtual === 1) atk = applyAutoFruta(atk, log, 'vida');
      if (def.vidasAtual === 1) def = applyAutoFruta(def, log, 'vida');
      const terraNames = [atkHasTerra ? atk.nome : null, defHasTerra ? def.nome : null].filter(Boolean);
      const msg = terraNames.length
        ? ` ${terraNames.join(' e ')} (Terra) não perde${terraNames.length > 1 ? 'm' : ''} vida.`
        : '';
      log.push(`⚖️ Empate!${msg}`);
    }
  }
  // else: defender wins → no damage

  return { atk, def, defFainted: def.vidasAtual <= 0, usedMC: useMC };
};

// ============================================================
// Part 3: Main Component — State + Game Logic
// ============================================================
const INITIAL_INVENTORY = {
  pokebolas: { pokebola: 5 },
  consumiveis: {},
  frutas: {},
  held: {},
  ballmods: {},
};

export default function JornadaNiaypeta({ onExit, userPokedex = [], onChatMessage }) {
  // ── Force custom cursor while this component is mounted ────
  // Uses a separate style element (jornada-cursor-override) always appended last
  // so it wins over App.jsx's custom-cursor-style regardless of click cycling.
  useEffect(() => {
    const OVERRIDE_ID = 'jornada-cursor-override';
    let styleEl = document.getElementById(OVERRIDE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = OVERRIDE_ID;
    }
    styleEl.textContent = `* { cursor: url('/customcursor/dittocursor1.cur'), auto !important; }`;
    // Always append last so it comes after custom-cursor-style in the cascade
    document.head.appendChild(styleEl);
    return () => { styleEl.remove(); };
  }, []);

  // ── Phase & Navigation ─────────────────────────────────────
  const [phase, setPhase]               = useState('login');
  // phases: login | modeSelect | classSelect | starterSelect |
  //         map | battle | mart | center | reward | gameover | victory | ranking

  // ── Auth ───────────────────────────────────────────────────
  const [currentUser, setCurrentUser]   = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError]     = useState('');
  const [guestName, setGuestName]       = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  // ── Game Setup ─────────────────────────────────────────────
  const [gameMode, setGameMode]         = useState(null);
  const [playerClasses, setPlayerClasses] = useState([]); // array of class objects
  const [classGroupIdx, setClassGroupIdx] = useState(0); // group nav in class select

  // ── Class helpers (after playerClasses is declared) ────────
  const hasClassPower = (key) => playerClasses.some((c) => c.powerKey === key);
  const classKeys     = playerClasses.map((c) => c.powerKey);
  const [starterOptions, setStarterOptions] = useState([]);

  // ── Pokémon profile: attribute distribution draft ───────────
  const [atribDraft,  setAtribDraft]  = useState({ atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 });
  const [draftForUid, setDraftForUid] = useState(null);
  const [heldTooltip,  setHeldTooltip]  = useState(null); // held item id with open tooltip
  const [bonusTooltip, setBonusTooltip] = useState(null); // 'uid-statKey' with open tooltip
  const [dragInfo,      setDragInfo]      = useState(null);  // { type:'item'|'pokemon', ... }
  const [classInfoOpen, setClassInfoOpen] = useState(null);  // class slot index showing desc
  const [selectedBall,  setSelectedBall]  = useState(null);  // pokeball id selected for capture

  // ── Cyber class run-level choices ─────────────────────────
  const [videnteChoice,         setVidenteChoice]         = useState(null);  // 'vantagem' | 'desvantagem'
  const [classChoiceData,       setClassChoiceData]       = useState(null);  // { atrib?, type? }
  const [engineerChoicePending, setEngineerChoicePending] = useState(null);  // [{uid, nome, types, slots}, ...]
  const [engineerChoiceMap,     setEngineerChoiceMap]     = useState({});     // { uid: string[] }

  // ── Run State ──────────────────────────────────────────────
  const [team, setTeam]                 = useState([]);      // max 6 JN Pokémon
  const [activeIdx, setActiveIdx]       = useState(0);       // active in battle
  const [stage, setStage]               = useState(0);
  const [money, setMoney]               = useState(100);
  const [inventory, setInventory]       = useState(INITIAL_INVENTORY);
  const [runStats, setRunStats]         = useState({ captures: 0, turnsTotal: 0, stagesCleared: 0, shinyCaptured: 0, legendaryCaptured: 0, legendaryShinyCapture: 0, normalStagesCleared: 0, specialStagesCleared: 0, bossWon: false, minibossWon: false });

  // ── Stage / Encounter ──────────────────────────────────────
  const [stageEncounters, setStageEncounters] = useState([]);   // 3 encounter options
  const [visitedEncounters, setVisitedEncounters] = useState([]); // indices visited
  const [currentEncounter, setCurrentEncounter]   = useState(null);

  // ── Battle ─────────────────────────────────────────────────
  // battle state fully managed in Part 4; stored here as a single object
  const [battle, setBattle]             = useState(null);
  const [battleLog, setBattleLog]       = useState([]);

  // Clear ball selection when battle ends
  useEffect(() => { if (!battle) setSelectedBall(null); }, [battle]);
  const [pendingAtkType, setPendingAtkType] = useState(null); // type selected before choosing atk/atkEsp
  const [estilizarCooldown, setEstilizarCooldown] = useState(0); // battles remaining until Estilizar is available again
  const [elementalistaCooldown, setElementalistaCooldown] = useState(0); // battles remaining until Elementalista SA is available again
  const [battleSnapshot, setBattleSnapshot] = useState(null); // snapshot before last roll for Azarão undo
  const [azaraoRerollBonus, setAzaraoRerollBonus] = useState(0); // +2 dice bonus applied on next roll after Azarão

  // ── Cyber Artífice ─────────────────────────────────────────
  const [artificeEquipped, setArtificeEquipped] = useState({}); // { [uid]: 'armadura' | 'espada' }
  const [artificeCredits,  setArtificeCredits]  = useState(0);  // pending item creations
  const [artificeSelected, setArtificeSelected] = useState({ uid: null, item: null }); // UI scratch

  // ── Cyber Pokébolista ──────────────────────────────────────
  // { found: itemDef, returnPhase: 'reward'|'map', needsMapCleanup: bool }
  const [pendingBallmodReward, setPendingBallmodReward] = useState(null);
  // ── Cyber Bandido ──────────────────────────────────────────
  // { found: itemDef } — pending item to accept/replace before entering battle
  const [pendingBandidoReward, setPendingBandidoReward] = useState(null);

  // ── Cyber Aventureiro ─────────────────────────────────────
  // { berry: itemDef, consumivel: itemDef|null } — pending forrageamento result awaiting held-slot resolution
  const [pendingForrageamento, setPendingForrageamento] = useState(null);

  // ── Pending item effects ───────────────────────────────────
  const [pendingEvoStone, setPendingEvoStone] = useState(null); // { itemId, targetIdx }
  const [pendingIncense,  setPendingIncense]  = useState(null); // { itemId, effect, multiType, selectedTypes:[] }
  const [activeIncense,   setActiveIncense]   = useState(null); // { effect, types:[], bonus } — active for next wild enc

  // ── Mart tab ──────────────────────────────────────────────
  const [martCat, setMartCat]           = useState('pokeball');

  // ── Ranking ────────────────────────────────────────────────
  const [rankingData, setRankingData]   = useState({ pocket: [], jornada: [], endless: [] });
  const [showRanking, setShowRanking]   = useState(false);
  const [showEnciclopedia, setShowEnciclopedia]   = useState(false);
  const [enciclopediaTab, setEnciclopediaTab]     = useState('classes');
  const [activeKeyword, setActiveKeyword]         = useState(null); // { word, rect }

  // ── JN Cyberdex (Firebase) ─────────────────────────────────
  // Set of dexNumbers (numbers) the user has encountered in JN runs
  const [cyberdex, setCyberdex]         = useState(new Set());

  // ── Reward Screen ──────────────────────────────────────────
  const [capturedInEncounter, setCapturedInEncounter] = useState(null);
  // Items offered after a wild encounter (not captured)
  const [wildRewardItems, setWildRewardItems]         = useState([]);
  // Current mart stock (generated on stage start)
  const [martStock, setMartStock]                     = useState([]);

  // ── CyberClass special state ────────────────────────────────
  const [cozinheiroCharges, setCozinheiroCharges]           = useState(0);
  const [cuidadorCharges,   setCuidadorCharges]             = useState(0);
  const [medicoUsedUids,    setMedicoUsedUids]              = useState([]);
  const [pendingCriadorOvo, setPendingCriadorOvo]           = useState(false);
  const [pendingIncubadorChoice, setPendingIncubadorChoice] = useState(null); // { pkmIdx }
  const [cuidadorBuff,      setCuidadorBuff]                = useState(null); // { stat, uid }
  const [pendingTutoria,    setPendingTutoria]              = useState(false);
  const [showAlimentarModal, setShowAlimentarModal]         = useState(false);
  const [showMimarModal,    setShowMimarModal]              = useState(false);
  const [criadorTypes,      setCriadorTypes]                = useState([]);
  const [oradorUsed,        setOradorUsed]                  = useState(false);
  const [showOradorModal,   setShowOradorModal]             = useState(false);
  const [showEscudoModal,   setShowEscudoModal]             = useState(false);
  const [escudoBuff,        setEscudoBuff]                  = useState(null); // { uid, stat }
  const [pendingAutoJoin,       setPendingAutoJoin]              = useState(null); // { pkm, idx }
  const [showAutoJoinSwapModal, setShowAutoJoinSwapModal]        = useState(false);
  const [autoJoinSwapStep,      setAutoJoinSwapStep]             = useState('choice'); // 'choice' | 'select'
  const [pendingAutoJoinResult, setPendingAutoJoinResult]        = useState(null); // { pkm } — triggers handleEncounterComplete after auto-join
  const [showCientistModal,     setShowCientistModal]            = useState(false);

  // ── Refs ───────────────────────────────────────────────────
  const battleLogRef = useRef(null);

  // Subscribe to Firebase ranking for all modes
  useEffect(() => {
    const unsubs = GAME_MODES.map((mode) =>
      onValue(ref(database, JN_RANKING_PATH(mode.id)), (snap) => {
        const data = snap.val() ?? {};
        const list = Object.values(data)
          .sort((a, b) => b.score - a.score)
          .slice(0, RANKING_TOP_N);
        setRankingData((rd) => ({ ...rd, [mode.id]: list }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  // Auto-scroll battle log
  useEffect(() => {
    if (battleLogRef.current) {
      battleLogRef.current.scrollTop = battleLogRef.current.scrollHeight;
    }
  }, [battleLog]);

  // Load cyberdex when a named user logs in
  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;
    loadJNCyberdex(currentUser.username).then((dex) => setCyberdex(dex));
  }, [currentUser]);

  // ═══════════════════════════════════════════════════════════
  // AUTH HANDLERS
  // ═══════════════════════════════════════════════════════════
  const handleLogin = useCallback((user) => {
    if (user.isGuest) {
      setCurrentUser(user);
      setPhase('modeSelect');
      return;
    }
    if (passwordInput !== JN_PASSWORD) {
      setLoginError('Senha incorreta!');
      return;
    }
    setLoginError('');
    setCurrentUser(user);
    setPhase('modeSelect');
  }, [passwordInput]);

  // ═══════════════════════════════════════════════════════════
  // GAME SETUP HANDLERS
  // ═══════════════════════════════════════════════════════════
  const handleSelectMode = useCallback((modeId) => {
    setGameMode(GAME_MODES.find((m) => m.id === modeId));
    setPhase('classSelect');
  }, []);

  const handleSelectClass = useCallback((classObj) => {
    setPlayerClasses([{ ...classObj, levelBaselines: {} }]);
    if (classObj.powerKey === 'cozinheiro') setCozinheiroCharges(3);
    if (classObj.powerKey === 'cuidador')   setCuidadorCharges(3);

    let starters;

    if (currentUser?.isGuest) {
      // Guest: always 3 random from fixed starter list
      const fixedSpecies = FIXED_STARTER_NAMES
        .map((nome) => pokedexData.find((p) => p.nome === nome))
        .filter(Boolean);
      const shuffled = [...fixedSpecies].sort(() => Math.random() - 0.5).slice(0, 3);
      starters = shuffled.map((s) => generateJNPokemon(s, 1, { context: 'player' }));
    } else if (cyberdex.size === 0) {
      // 1st run (named user, no cyberdex yet): 3 options from fixed starter list
      const fixedSpecies = FIXED_STARTER_NAMES
        .map((nome) => pokedexData.find((p) => p.nome === nome))
        .filter(Boolean);
      const shuffled = [...fixedSpecies].sort(() => Math.random() - 0.5).slice(0, 3);
      starters = shuffled.map((s) => generateJNPokemon(s, 1, { context: 'player' }));
    } else {
      // 2nd+ run: Pesquisador vê toda a cyberdex; outros veem 10% (mínimo 2), sorteados
      const isPesquisador = classObj.powerKey === 'pesquisador_base' && CYBERDEX_USERS.includes(currentUser?.username);
      const cyberdexSpecies = [...cyberdex]
        .map((dexNum) => pokedexData.find((p) => p.dexNumber === dexNum))
        .filter((p) => p && !isRegionBanned(p));
      if (isPesquisador) {
        starters = cyberdexSpecies.map((s) => generateJNPokemon(s, 1, { context: 'player' }));
      } else {
        const count = Math.max(2, Math.floor(cyberdexSpecies.length * 0.1));
        const shuffled = [...cyberdexSpecies].sort(() => Math.random() - 0.5).slice(0, count);
        starters = shuffled.map((s) => generateJNPokemon(s, 1, { context: 'player' }));
      }
    }

    setStarterOptions(starters);
    setPhase('starterSelect');
  }, [currentUser, cyberdex]);

  // ═══════════════════════════════════════════════════════════
  // STAGE / ENCOUNTER HANDLERS
  // ═══════════════════════════════════════════════════════════
  const _beginStage = useCallback((stageNum, keepPhase = false) => {
    const encounters = buildStageEncounters(stageNum);
    // Cyber Pesquisador: +1 Matinho em estágios não especiais
    if (playerClasses.some((c) => c.powerKey === 'pesquisador_base') && !SPECIAL_STAGES.has(stageNum) && stageNum !== 0) {
      encounters.push({ type: ENCOUNTER_TYPES.SELVAGEM, enemy: [generateWild(stageNum)], name: 'Matinho' });
    }
    setStageEncounters(encounters);
    setVisitedEncounters([]);
    setCurrentEncounter(null);
    setBattle(null);
    setBattleLog([]);
    setMartStock(getMartStock(stageNum));
    setWildRewardItems([]);
    if (!keepPhase) setPhase('map');
  }, [playerClasses]);

  const handleSelectStarter = useCallback((pkm) => {
    const starterVidas = calcBaseVidas(
      { tipos: pkm.tipos ?? [] }, 'player',
      { isLeg: isLegendary(pkm.nome), isShn: pkm.isShiny ?? false }
    );
    const starter = {
      ...pkm, level: 1, vidasMax: starterVidas, vidasAtual: starterVidas, context: 'player',
      diceBase: {
        atk:    (pkm.diceBase?.atk    ?? 1) + 1,
        def:    (pkm.diceBase?.def    ?? 1) + 1,
        atkEsp: (pkm.diceBase?.atkEsp ?? 1) + 1,
        defEsp: (pkm.diceBase?.defEsp ?? 1) + 1,
        vel:    (pkm.diceBase?.vel    ?? 1) + 1,
      },
    };
    setTeam([starter]);
    setActiveIdx(0);
    setStage(0);
    setMoney(1000);
    // 5% chance to start with 5 Greatballs instead of 5 Pokébolas
    const useGreat = Math.random() < 0.05;
    setInventory({
      ...INITIAL_INVENTORY,
      pokebolas: useGreat ? { greatball: 5 } : { pokebola: 5 },
    });
    setRunStats({ captures: 1, turnsTotal: 0, stagesCleared: 0, shinyCaptured: 0, legendaryCaptured: 0, legendaryShinyCapture: 0, normalStagesCleared: 0, specialStagesCleared: 0, bossWon: false, minibossWon: false });
    setMedicoUsedUids([]);
    setCozinheiroCharges(0);
    setCuidadorCharges(0);
    setCuidadorBuff(null);
    setOradorUsed(false);
    setPendingAutoJoin(null);
    setShowAutoJoinSwapModal(false);
    // Save starter to cyberdex (named users only)
    if (!currentUser?.isGuest && pkm.dexNumber) {
      setCyberdex((prev) => new Set([...prev, pkm.dexNumber]));
      addToJNCyberdex(currentUser.username, pkm.dexNumber);
    }
    _beginStage(0);
  }, [currentUser, _beginStage]);

  const handleSelectEncounter = useCallback((idx) => {
    let enc = stageEncounters[idx];
    if (!enc) return;

    if (enc.type === ENCOUNTER_TYPES.POKECENTER) {
      // Heal all first, then mark visited
      setTeam((prev) => prev.map((p) => ({
        ...p,
        vidasAtual: p.vidasMax,
        conditions: [],
        metalCoatUsed: false,
      })));
      setCurrentEncounter(enc);
      setVisitedEncounters((prev) => [...prev, idx]);
      setPhase('center');
      return;
    }
    if (enc.type === ENCOUNTER_TYPES.POKEMART) {
      setCurrentEncounter(enc);
      setVisitedEncounters((prev) => [...prev, idx]);
      setPhase('mart');
      return;
    }

    // Wild encounter: apply legendary/shiny modifiers from class powers and incenso items
    if (enc.type === ENCOUNTER_TYPES.SELVAGEM) {
      const level = getStageLevel(stage);
      const pClassKeys = playerClasses.map((c) => c.powerKey);
      const hasMistico    = pClassKeys.includes('mistico_base');
      const hasObservador = pClassKeys.includes('observador');
      const incLend  = inventory.consumiveis?.incenso_lendario ?? 0;
      // incenso_glitter auto-consumes; incenso_porpurina is activated via type selector
      const incGlitter = inventory.consumiveis?.incenso_glitter ?? 0;
      const activeShinyBonus = activeIncense?.effect === 'incenso_shiny_tipo' ? (activeIncense.bonus ?? 0.10) : 0;

      const legShinyChance = 0.005 + (hasMistico ? 0.05 : 0);
      const legChance      = 0.01 + (incLend > 0 ? 0.10 : 0) + (hasMistico ? 0.10 : 0);
      const shinyChance = 0.01 + (hasObservador ? 0.10 : 0) + (incGlitter > 0 ? 0.10 : 0) + activeShinyBonus;

      // Priority roll: legendary shiny → legendary → shiny → regular
      const roll = Math.random();
      let isLeg = false, isShiny = false;
      if (roll < legShinyChance) {
        isLeg = true; isShiny = true;
      } else if (roll < legShinyChance + legChance) {
        isLeg = true;
      } else if (roll < legShinyChance + legChance + shinyChance) {
        isShiny = true;
      }

      if (isLeg || isShiny) {
        let species;
        if (isLeg) {
          const legPool = _basePool().filter((p) => isLegendary(p.nome));
          species = legPool.length > 0 ? legPool[Math.floor(Math.random() * legPool.length)] : pickRandomSpecies();
        } else {
          species = pickRandomSpecies();
        }
        const newPkm = generateJNPokemon(species, level, { context: 'wild', forceShiny: isShiny });
        enc = { ...enc, enemy: [newPkm] };
        if (onChatMessage) {
          const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          let text;
          if (isLeg && isShiny) text = `🌟✨ Um ${species.nome} Lendário Shiny apareceu!`;
          else if (isLeg)       text = `🌟 Um ${species.nome} Lendário apareceu!`;
          else                   text = `✨ Um ${species.nome} Shiny apareceu!`;
          onChatMessage({ username: 'Sistema', text, timestamp: ts, isDiceRoll: false });
        }
      } else if (activeIncense && ['incenso_tipo', 'incenso_tipo_garantido', 'incenso_shiny_tipo'].includes(activeIncense.effect)) {
        // Apply type filter (guaranteed for verde/porpurina; +30% roll for incenso comum)
        const forceType = activeIncense.effect !== 'incenso_tipo' || Math.random() < (activeIncense.bonus ?? 0.30);
        if (forceType) {
          const typePool = _basePool().filter((p) => {
            const pTypes = (p.tipos ?? []).map(normalizeType);
            return activeIncense.types.some((t) => pTypes.includes(t));
          });
          if (typePool.length > 0) {
            const species = typePool[Math.floor(Math.random() * typePool.length)];
            const newPkm = generateJNPokemon(species, level, { context: 'wild' });
            enc = { ...enc, enemy: [newPkm] };
          }
        }
      } else if (pClassKeys.includes('petrologista') && Math.random() < 0.15) {
        // Cyber Petrologista: 15% chance de pokémon fóssil aparecer no encontro
        const fossilPool = _basePool().filter((p) => FOSSIL_DEX_NUMBERS.has(p.dexNumber));
        if (fossilPool.length > 0) {
          const fSpecies = fossilPool[Math.floor(Math.random() * fossilPool.length)];
          const fPkm = generateJNPokemon(fSpecies, level, { context: 'wild' });
          enc = { ...enc, enemy: [fPkm] };
        }
      } else if (pClassKeys.includes('runico') && Math.random() < 0.15) {
        // Cyber Rúnico: 15% chance de Unown aparecer no encontro
        const unownPool = _basePool().filter((p) => p.nome?.toLowerCase().startsWith('unown'));
        if (unownPool.length > 0) {
          const rSpecies = unownPool[Math.floor(Math.random() * unownPool.length)];
          const rPkm = generateJNPokemon(rSpecies, level, { context: 'wild' });
          enc = { ...enc, enemy: [rPkm] };
        }
      } else if (pClassKeys.includes('xama') && Math.random() < 0.15) {
        // Cyber Xamã: 15% chance de pokémon tipo Fantasma aparecer no encontro
        const ghostPool = _basePool().filter((p) => (p.tipos ?? []).map(normalizeType).includes(normalizeType('Fantasma')));
        if (ghostPool.length > 0) {
          const xSpecies = ghostPool[Math.floor(Math.random() * ghostPool.length)];
          const xPkm = generateJNPokemon(xSpecies, level, { context: 'wild' });
          enc = { ...enc, enemy: [xPkm] };
        }
      }

      // Consume auto-incenses on entry
      if (incLend > 0) {
        setInventory((inv) => ({ ...inv, consumiveis: { ...inv.consumiveis, incenso_lendario: incLend - 1 } }));
      }
      if (incGlitter > 0) {
        setInventory((inv) => ({
          ...inv,
          consumiveis: { ...inv.consumiveis, incenso_glitter: (inv.consumiveis.incenso_glitter ?? 1) - 1 },
        }));
      }
      // Clear active incense (was consumed when type was selected)
      if (activeIncense) setActiveIncense(null);

      // colecionador: 20% chance de encontrar a mesma espécie de um pokémon do time
      if (pClassKeys.includes('colecionador') && team.length > 0 && Math.random() < 0.20) {
        const rndMember = team[Math.floor(Math.random() * team.length)];
        const sameSpecies = pokedexData.find((p) => p.dexNumber === rndMember.dexNumber);
        if (sameSpecies) {
          const lvl = getStageLevel(stage);
          const sameSpeciesPkm = generateJNPokemon(sameSpecies, lvl, { context: 'wild' });
          enc = { ...enc, enemy: [sameSpeciesPkm] };
        }
      }

      // Cyber Criador: 15% chance de achar um pokéovo (substitui o encontro selvagem)
      if (pClassKeys.includes('criador_base') && Math.random() < 0.15) {
        setCurrentEncounter(enc);
        setVisitedEncounters((prev) => [...prev, idx]);
        setPendingCriadorOvo(true);
        setCriadorTypes([]);
        setPhase('criador_ovo_choice');
        return;
      }

      // Cyber Botânico: 30% chance de uma fruta aleatória aparecer num slot vazio
      if (pClassKeys.includes('botanico') && Math.random() < 0.30) {
        const BOTANICO_FRUITS = ['cheri','pecha','rawst','aspear','leppa','oran','persim','lum','sitrus'];
        const foundFruit = BOTANICO_FRUITS[Math.floor(Math.random() * BOTANICO_FRUITS.length)];
        const STACK_MAX = 3;
        const usedSlots = ['consumiveis', 'frutas', 'held'].reduce((acc, cat) => {
          return acc + Object.entries(inventory[cat] || {}).filter(([, q]) => q > 0)
            .reduce((a, [, q]) => a + Math.ceil(q / STACK_MAX), 0);
        }, 0);
        const mochilaBonus = (inventory.consumiveis?.mochila ?? 0) * 2;
        const guiaBonus = pClassKeys.includes('guia') ? 2 : 0;
        const maxSlots = 5 + mochilaBonus + guiaBonus;
        if (usedSlots < maxSlots) {
          setInventory((inv) => ({ ...inv, frutas: { ...inv.frutas, [foundFruit]: (inv.frutas[foundFruit] ?? 0) + 1 } }));
        }
      }

      // Cyber Evolucionista: 10% chance de pedra evolutiva aparecer num slot vazio
      if (pClassKeys.includes('evolucionista') && Math.random() < 0.10) {
        const EVO_STONES = ['pedra_fogo','pedra_agua','pedra_trovao','pedra_folha','pedra_lua','pedra_sol'];
        const foundStone = EVO_STONES[Math.floor(Math.random() * EVO_STONES.length)];
        const STACK_MAX = 3;
        const usedSlots = ['consumiveis', 'frutas', 'held'].reduce((acc, cat) => {
          return acc + Object.entries(inventory[cat] || {}).filter(([, q]) => q > 0)
            .reduce((a, [, q]) => a + Math.ceil(q / STACK_MAX), 0);
        }, 0);
        const mochilaBonus = (inventory.consumiveis?.mochila ?? 0) * 2;
        const guiaBonus = pClassKeys.includes('guia') ? 2 : 0;
        const maxSlots = 5 + mochilaBonus + guiaBonus;
        if (usedSlots < maxSlots) {
          setInventory((inv) => ({ ...inv, consumiveis: { ...inv.consumiveis, [foundStone]: (inv.consumiveis[foundStone] ?? 0) + 1 } }));
        }
      }

      // Auto-join: Místico (lendário/lendário shiny), Rúnico (Unown), Xamã (Fantasma)
      const autoEnemy = enc.enemy?.[0];
      if (autoEnemy) {
        const autoIsLeg   = isLegendary(autoEnemy.nome);
        const autoIsUnown = autoEnemy.nome?.toLowerCase().startsWith('unown');
        const autoIsGhost = (autoEnemy.tipos ?? []).map(normalizeType).includes(normalizeType('Fantasma'));
        const shouldAutoJoin =
          (hasMistico && autoIsLeg) ||
          (pClassKeys.includes('runico') && autoIsUnown) ||
          (pClassKeys.includes('xama') && autoIsGhost);
        if (shouldAutoJoin) {
          const mochilaBonus = (inventory.consumiveis?.mochila ?? 0) * 2;
          const guiaBonus = pClassKeys.includes('guia') ? 2 : 0;
          const maxSlots = 5 + mochilaBonus + guiaBonus;
          if (team.length < maxSlots) {
            const joinPkm = { ...autoEnemy, vidasAtual: autoEnemy.vidasMax, conditions: [] };
            setTeam((prev) => [...prev, joinPkm]);
            if (!currentUser?.isGuest && autoEnemy.dexNumber) {
              setCyberdex((prev) => new Set([...prev, autoEnemy.dexNumber]));
              addToJNCyberdex(currentUser.username, autoEnemy.dexNumber);
            }
            if (onChatMessage) {
              const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              let txt;
              if (hasMistico && autoIsLeg && autoEnemy.shiny) txt = `🌟✨ Cyber Místico! ${autoEnemy.nome} Lendário Shiny se juntou à equipe!`;
              else if (hasMistico && autoIsLeg)               txt = `🌟 Cyber Místico! ${autoEnemy.nome} Lendário se juntou à equipe!`;
              else if (pClassKeys.includes('runico'))         txt = `🔤 Cyber Rúnico! ${autoEnemy.nome} se juntou à equipe!`;
              else                                             txt = `👻 Cyber Xamã! ${autoEnemy.nome} se juntou à equipe!`;
              onChatMessage({ username: 'Sistema', text: txt, timestamp: ts, isDiceRoll: false });
            }
            setVisitedEncounters((prev) => [...prev, idx]);
            setPendingAutoJoinResult({ pkm: joinPkm });
            return;
          } else {
            setPendingAutoJoin({ pkm: autoEnemy, idx });
            setShowAutoJoinSwapModal(true);
            setAutoJoinSwapStep('choice');
            setVisitedEncounters((prev) => [...prev, idx]);
            return;
          }
        }
      }
    }

    // bandido: 25% chance de ganhar um item ao entrar num encontro
    const allPClassKeys = playerClasses.map((c) => c.powerKey);
    if (allPClassKeys.includes('bandido') && Math.random() < 0.25) {
      const tier = pickTier({ S: 0.03, A: 0.12, B: 0.15, C: 0.70 });
      const itemPool = ITEMS_DATA.filter((i) => i.category !== 'pokeball' && i.category !== 'ballmod' && i.tier === tier);
      if (itemPool.length > 0) {
        const found = itemPool[Math.floor(Math.random() * itemPool.length)];
        const STACK_MAX = 3;
        const usedSlots = ['consumiveis', 'frutas', 'held'].reduce((acc, cat) => {
          return acc + Object.entries(inventory[cat] || {}).filter(([, q]) => q > 0)
            .reduce((a, [, q]) => a + Math.ceil(q / STACK_MAX), 0);
        }, 0);
        const mochilaBonus = (inventory.consumiveis?.mochila ?? 0) * 2;
        const guiaBonus = allPClassKeys.includes('guia') ? 2 : 0;
        const maxSlots = 5 + mochilaBonus + guiaBonus;
        if (usedSlots < maxSlots) {
          let cat = 'consumiveis';
          if (found.category === 'held')  cat = 'held';
          if (found.category === 'fruta') cat = 'frutas';
          setInventory((inv) => ({ ...inv, [cat]: { ...inv[cat], [found.id]: (inv[cat]?.[found.id] ?? 0) + 1 } }));
        } else {
          setPendingBandidoReward({ found });
          setCurrentEncounter(enc);
          setVisitedEncounters((prev) => [...prev, idx]);
          setPhase('bandido_item_choice');
          return;
        }
      }
    }

    // Cyber Fotógrafo: recebe foto ao entrar em encontro selvagem ou CTnpc
    if (allPClassKeys.includes('fotografo') && (enc.type === ENCOUNTER_TYPES.SELVAGEM || enc.type === ENCOUNTER_TYPES.TREINADOR)) {
      const fotoQty = inventory.consumiveis?.foto ?? 0;
      const FOTO_STACK = 3;
      if (fotoQty < FOTO_STACK) {
        const usedSlots = ['consumiveis', 'frutas', 'held'].reduce((acc, cat) => {
          return acc + Object.entries(inventory[cat] || {}).filter(([, q]) => q > 0)
            .reduce((a, [, q]) => a + Math.ceil(q / FOTO_STACK), 0);
        }, 0);
        const mochilaBonus = (inventory.consumiveis?.mochila ?? 0) * 2;
        const guiaBonus = allPClassKeys.includes('guia') ? 2 : 0;
        const maxSlots = 5 + mochilaBonus + guiaBonus;
        if (fotoQty > 0 || usedSlots < maxSlots) {
          setInventory((inv) => ({ ...inv, consumiveis: { ...inv.consumiveis, foto: fotoQty + 1 } }));
        }
      }
    }

    // Battle encounter
    setCurrentEncounter(enc);
    setVisitedEncounters((prev) => [...prev, idx]);
    setPhase('battle');
    // Battle init is called from Part 4 via initBattle(enc)
  }, [stageEncounters, playerClasses, inventory, stage, activeIncense, team]);

  const handleEncounterComplete = useCallback((capturedPkm = null, encounterMoney = 0) => {
    if (capturedPkm) setCapturedInEncounter(capturedPkm);
    if (encounterMoney > 0) setMoney((m) => m + encounterMoney);
    setEstilizarCooldown((c) => Math.max(0, c - 1));
    setElementalistaCooldown((c) => Math.max(0, c - 1));
    setBattleSnapshot(null);
    setAzaraoRerollBonus(0);
    // Elementalista: remove temporary type from active pokémon after battle
    if (battle?.sa?.elementalistaActive) {
      const elemCls = playerClasses.find((c) => c.powerKey === 'elementalista');
      const elemType = elemCls?.elementalistaType;
      if (elemType) {
        setTeam((prev) => prev.map((p, i) => {
          if (i !== activeIdx) return p;
          const curTypes = p.tipos ?? p.types ?? [];
          const newTypes = curTypes.filter((t) => t !== elemType);
          return { ...p, tipos: newTypes, types: newTypes };
        }));
      }
    }
    // Cyber Cuidador: remover buff de +2d após o encontro
    if (cuidadorBuff) {
      setTeam((prev) => prev.map((p) => {
        if (p.uid !== cuidadorBuff.uid) return p;
        const db = { ...(p.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 }) };
        db[cuidadorBuff.stat] = Math.max(0, (db[cuidadorBuff.stat] ?? 0) - 2);
        return { ...p, diceBonus: db };
      }));
      setCuidadorBuff(null);
    }
    if (escudoBuff) {
      setTeam((prev) => prev.map((p) => {
        if (p.uid !== escudoBuff.uid) return p;
        const db = { ...(p.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 }) };
        db[escudoBuff.stat] = Math.max(0, (db[escudoBuff.stat] ?? 0) - 1);
        return { ...p, diceBonus: db };
      }));
      setEscudoBuff(null);
    }

    // Stage 0 has 1 local; special stages have 1 forced encounter; others need 2 (3 with Cavaleiro)
    const maxEncounters = (stage === 0 || SPECIAL_STAGES.has(stage)) ? 1 : (playerClasses.some((c) => c.powerKey === 'cavaleiro') ? 3 : 2);
    const newVisited = visitedEncounters.length; // already incremented before battle
    const headingToReward = newVisited >= maxEncounters;

    // pokeholista: 10% chance de ganhar um ballmod aleatório
    if (playerClasses.some((c) => c.powerKey === 'pokeholista') && Math.random() < 0.10) {
      const ballmodPool = ITEMS_DATA.filter((i) => i.category === 'ballmod');
      const found = ballmodPool[Math.floor(Math.random() * ballmodPool.length)];
      const MAX_BALLMOD_SLOTS = 3;
      const ownedCount = Object.values(inventory.ballmods ?? {}).filter((q) => q > 0).length;
      const alreadyHasType = (inventory.ballmods?.[found.id] ?? 0) > 0;
      if (ownedCount < MAX_BALLMOD_SLOTS || alreadyHasType) {
        // Auto-add (under cap or stacking existing type)
        setInventory((inv) => ({
          ...inv,
          ballmods: { ...inv.ballmods, [found.id]: (inv.ballmods?.[found.id] ?? 0) + 1 },
        }));
        setBattleLog((prev) => [...prev, `🎯 Pokébolista: ${found.name} adicionada ao inventário!`]);
      } else {
        // At cap: show choice screen before resolving phase
        setPendingBallmodReward({
          found,
          returnPhase: headingToReward ? 'reward' : 'map',
          needsMapCleanup: !headingToReward,
        });
        setPhase('ballmod_choice');
        return;
      }
    }

    if (headingToReward) {
      setPhase('reward');
    } else {
      setCapturedInEncounter(null);
      setCurrentEncounter(null);
      setBattle(null);
      setBattleLog([]);
      setPhase('map');
    }
  }, [visitedEncounters, stage, playerClasses, inventory, cuidadorBuff, setCuidadorBuff, escudoBuff, setEscudoBuff, setTeam, battle, activeIdx]);

  // ── CyberClass Handlers ──────────────────────────────────────

  /** Cyber Criador: player chose 4 types → generate & hatch pokéovo. */
  const handleCriadorConfirm = useCallback((chosenTypes) => {
    if (chosenTypes.length !== 4) return;
    const level = team.length > 0 ? (team[0]?.level ?? 1) : 1;
    // Roll type 1 from chosen 4
    const shuffled = [...chosenTypes].sort(() => Math.random() - 0.5);
    const type1 = shuffled[0];
    const remaining = shuffled.slice(1);
    // 50% chance for type 2
    const hasType2 = Math.random() < 0.5;
    const type2 = hasType2 ? remaining[Math.floor(Math.random() * remaining.length)] : null;

    // Find a species matching type1 (prefer also having type2 if applicable)
    const normalT1 = normalizeType(type1);
    const normalT2 = type2 ? normalizeType(type2) : null;
    let pool = _basePool().filter((p) => (p.tipos ?? []).map(normalizeType).includes(normalT1));
    if (normalT2 && pool.some((p) => (p.tipos ?? []).map(normalizeType).includes(normalT2))) {
      pool = pool.filter((p) => (p.tipos ?? []).map(normalizeType).includes(normalT2));
    }
    if (pool.length === 0) pool = _basePool();
    const species = pool[Math.floor(Math.random() * pool.length)];
    const newPkm = generateJNPokemon(species, level, { context: 'player' });
    const pkmWithCtx = { ...newPkm, vidasAtual: newPkm.vidasMax, conditions: [] };

    const newTeam = [...team, pkmWithCtx];
    setTeam(newTeam);

    // Save to cyberdex
    if (!currentUser?.isGuest && newPkm.dexNumber) {
      setCyberdex((prev) => new Set([...prev, newPkm.dexNumber]));
      addToJNCyberdex(currentUser.username, newPkm.dexNumber);
    }

    // Cyber Incubador: choose +10 attribute
    const newPkmIdx = newTeam.length - 1;
    if (playerClasses.some((c) => c.powerKey === 'incubador')) {
      setPendingIncubadorChoice({ pkmIdx: newPkmIdx });
    }

    setPendingCriadorOvo(false);
    setPhase('map');
    handleEncounterComplete();
  }, [team, playerClasses, currentUser, handleEncounterComplete]);

  /** Cyber Incubador: +10 to selected stat of newly hatched pokémon. */
  const handleIncubadorChoice = useCallback((stat) => {
    if (!pendingIncubadorChoice) return;
    const { pkmIdx } = pendingIncubadorChoice;
    setTeam((prev) => {
      const next = [...prev];
      const p = { ...next[pkmIdx] };
      if (stat === 'vidasMax') {
        p.vidasMax = (p.vidasMax ?? 3) + 10;
        p.vidasAtual = Math.min(p.vidasMax, (p.vidasAtual ?? p.vidasMax) + 10);
      } else {
        const db = { ...(p.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 }) };
        db[stat] = (db[stat] ?? 0) + 10;
        p.diceBonus = db;
      }
      next[pkmIdx] = p;
      return next;
    });
    setPendingIncubadorChoice(null);
  }, [pendingIncubadorChoice]);

  /** Cyber Cozinheiro: apply Alimentar (vida boost). */
  const handleCozinheiroAlimentar = useCallback((mode, targetIdx = null) => {
    if (cozinheiroCharges <= 0) return;
    if (mode === 'single' && targetIdx !== null) {
      setTeam((prev) => prev.map((p, i) => {
        if (i !== targetIdx) return p;
        return { ...p, vidasAtual: Math.min(p.vidasMax, p.vidasAtual + 3) };
      }));
    } else if (mode === 'all') {
      setTeam((prev) => prev.map((p) => ({ ...p, vidasAtual: Math.min(p.vidasMax, p.vidasAtual + 1) })));
    }
    setCozinheiroCharges((c) => Math.max(0, c - 1));
    setShowAlimentarModal(false);
  }, [cozinheiroCharges]);

  /** Cyber Cuidador: apply Mimar (+2d in stat). */
  const handleCuidadorMimar = useCallback((stat) => {
    if (cuidadorCharges <= 0) return;
    const pkm = team[activeIdx];
    if (!pkm) return;
    setTeam((prev) => prev.map((p, i) => {
      if (i !== activeIdx) return p;
      const db = { ...(p.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 }) };
      db[stat] = (db[stat] ?? 0) + 2;
      return { ...p, diceBonus: db };
    }));
    setCuidadorBuff({ stat, uid: pkm.uid });
    setCuidadorCharges((c) => Math.max(0, c - 1));
    setShowMimarModal(false);
  }, [cuidadorCharges, team, activeIdx]);

  /** Cyber Tutor: confirm which inactive pokémon's move to borrow. */
  const handleTutoriaConfirm = useCallback((pkmIdx, atkAction) => {
    const pkm = team[pkmIdx];
    if (!pkm) return;
    const dice = pkm.diceBase?.[atkAction] ?? 1;
    setBattle((b) => b ? {
      ...b,
      sa: { ...b.sa, tutoriaOverride: { pkmNome: pkm.nome, atkAction, dice }, tutorUsed: true },
    } : b);
    setBattleLog((prev) => [...prev, `📚 Tutoria preparada! Próximo ataque usa o golpe de ${pkm.nome} (${atkAction === 'atk' ? 'Atk' : 'AtkEsp'}: ${dice}d).`]);
    setPendingTutoria(false);
  }, [team]);

  /** Cyber Guardião: apply Escudo (+1d def or defEsp for this battle). */
  const handleEscudoConfirm = useCallback((stat) => {
    if (!battle) return;
    const playerPkm = battle.playerPkm;
    if (!playerPkm) return;
    const db = { ...(playerPkm.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 }) };
    db[stat] = (db[stat] ?? 0) + 1;
    const updated = { ...playerPkm, diceBonus: db };
    setBattle((b) => ({ ...b, playerPkm: updated, sa: { ...b.sa, guardianUsed: true } }));
    setTeam((prev) => prev.map((p) => p.uid === playerPkm.uid ? { ...p, diceBonus: db } : p));
    setEscudoBuff({ uid: playerPkm.uid, stat });
    setShowEscudoModal(false);
    setBattleLog((prev) => [...prev, `🛡️ Escudo! ${playerPkm.nome} recebe +1d em ${stat === 'def' ? 'Defesa' : 'Defesa Esp.'} nesta batalha.`]);
  }, [battle, setBattle, setTeam, setBattleLog]);

  /** Cyber Orador: sacrifice all captured pokémon and receive a chosen legendary at level 90. */
  const handleOradorClamor = useCallback((species) => {
    if (!species) return;
    const sacrificeCount = team.length;
    const legPkm = generateJNPokemon(species, 90, { context: 'player' });
    const bonusPerStat = sacrificeCount;
    const mergedDb = {
      atk:    (legPkm.diceBonus?.atk    ?? 0) + bonusPerStat,
      def:    (legPkm.diceBonus?.def    ?? 0) + bonusPerStat,
      atkEsp: (legPkm.diceBonus?.atkEsp ?? 0) + bonusPerStat,
      defEsp: (legPkm.diceBonus?.defEsp ?? 0) + bonusPerStat,
      vel:    (legPkm.diceBonus?.vel    ?? 0) + bonusPerStat,
    };
    const finalPkm = { ...legPkm, vidasAtual: legPkm.vidasMax, conditions: [], diceBonus: mergedDb };
    setTeam([finalPkm]);
    setActiveIdx(0);
    if (!currentUser?.isGuest && legPkm.dexNumber) {
      setCyberdex((prev) => new Set([...prev, legPkm.dexNumber]));
      addToJNCyberdex(currentUser.username, legPkm.dexNumber);
    }
    setOradorUsed(true);
    setShowOradorModal(false);
  }, [team, currentUser, setCyberdex]);

  /** Auto-join swap: remove chosen pokémon and add the pending one. */
  const handleAutoJoinSwapConfirm = useCallback((removeUid) => {
    if (!pendingAutoJoin) return;
    const { pkm } = pendingAutoJoin;
    const joinPkm = { ...pkm, vidasAtual: pkm.vidasMax, conditions: [] };
    setTeam((prev) => [...prev.filter((p) => p.uid !== removeUid), joinPkm]);
    if (!currentUser?.isGuest && pkm.dexNumber) {
      setCyberdex((prev) => new Set([...prev, pkm.dexNumber]));
      addToJNCyberdex(currentUser.username, pkm.dexNumber);
    }
    if (onChatMessage) {
      const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      onChatMessage({ username: 'Sistema', text: `🔄 ${pkm.nome}${pkm.shiny ? ' ✨' : ''} se juntou à equipe!`, timestamp: ts, isDiceRoll: false });
    }
    setPendingAutoJoin(null);
    setShowAutoJoinSwapModal(false);
    setPendingAutoJoinResult({ pkm: joinPkm });
  }, [pendingAutoJoin, currentUser, setCyberdex, onChatMessage]);

  const handleAutoJoinSwapCancel = useCallback(() => {
    setPendingAutoJoin(null);
    setShowAutoJoinSwapModal(false);
    setPendingAutoJoinResult({ pkm: null });
  }, []);

  // After auto-join, call handleEncounterComplete once visitedEncounters state is committed
  useEffect(() => {
    if (!pendingAutoJoinResult) return;
    const { pkm } = pendingAutoJoinResult;
    setPendingAutoJoinResult(null);
    handleEncounterComplete(pkm ?? null);
  }, [pendingAutoJoinResult, handleEncounterComplete]);

  // Fechar tooltips ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setBonusTooltip(null);
        setHeldTooltip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /** Cyber Cientista: cria e adiciona uma poção ao inventário. */
  const handleCientistCriar = useCallback((pocaoId) => {
    if (!battle) return;
    const STACK_MAX = 3;
    const usedSlots = ['consumiveis', 'frutas', 'held'].reduce((acc, cat) => {
      return acc + Object.entries(inventory[cat] || {}).filter(([, q]) => q > 0)
        .reduce((a, [, q]) => a + Math.ceil(q / STACK_MAX), 0);
    }, 0);
    const mochilaBonus = (inventory.consumiveis?.mochila ?? 0) * 2;
    const guiaBonus = playerClasses.some((c) => c.powerKey === 'guia') ? 2 : 0;
    const maxSlots = 5 + mochilaBonus + guiaBonus;
    const qty = inventory.consumiveis?.[pocaoId] ?? 0;
    if (qty > 0 || usedSlots < maxSlots) {
      setInventory((inv) => ({ ...inv, consumiveis: { ...inv.consumiveis, [pocaoId]: qty + 1 } }));
    }
    setBattle((b) => ({ ...b, sa: { ...b.sa, cientistUsed: true } }));
    setBattleLog((prev) => {
      const name = pocaoId === 'pocao_menor' ? 'Poção Menor' : pocaoId === 'pocao_maior' ? 'Poção Maior' : 'Poção Suprema';
      return [...prev, `🧪 Cientista criou ${name} e adicionou ao inventário!`];
    });
    setShowCientistModal(false);
  }, [battle, inventory, playerClasses]);

  /** Apply level-up: adds levels and grants pontosAtrib for manual distribution. */
  const _levelUpPokemon = (pkm, levelsToAdd) => {
    if (levelsToAdd <= 0) return pkm;
    return {
      ...pkm,
      level: pkm.level + levelsToAdd,
      pontosAtrib: (pkm.pontosAtrib ?? 0) + levelsToAdd,
    };
  };

  const handleStageComplete = useCallback(() => {
    const stageMoney = STAGE_MONEY_REWARDS[Math.min(stage, STAGE_MONEY_REWARDS.length - 1)];
    if (stageMoney > 0) setMoney((m) => m + stageMoney);
    setRunStats((rs) => ({
      ...rs,
      stagesCleared: rs.stagesCleared + 1,
      normalStagesCleared:  !SPECIAL_STAGES.has(stage) ? rs.normalStagesCleared + 1 : rs.normalStagesCleared,
      specialStagesCleared:  SPECIAL_STAGES.has(stage)  ? rs.specialStagesCleared + 1 : rs.specialStagesCleared,
    }));
    setCapturedInEncounter(null);

    // Level-up rewards per stage
    setTeam((prev) => {
      // 1. Compute new levels first
      let leveled;
      if (stage === 0) {
        leveled = prev.map((p) => _levelUpPokemon(p, 4));
      } else if (stage === 1) {
        leveled = prev.map((p) => _levelUpPokemon(p, 5));
      } else {
        leveled = prev.map((p) => _levelUpPokemon(p, 10));
      }

      // 2. Apply level-based class bonuses (non-retroactive via levelBaselines)
      return leveled.map((pkm) => {
        let p = pkm;
        for (const cls of playerClasses) {
          const baseline = cls.levelBaselines?.[p.uid] ?? 0;
          const oldLevel = prev.find((x) => x.uid === p.uid)?.level ?? p.level;
          const newLevel = p.level;

          const thresholdsCrossed = (lvl, n) => Math.floor(Math.max(0, lvl - baseline) / n);
          const newThresholds = (n) => thresholdsCrossed(newLevel, n) - thresholdsCrossed(oldLevel, n);

          // treinador_base / artista_base → +1 pontosAtrib per N levels
          if (cls.powerKey === 'treinador_base') {
            const gained = newThresholds(5);
            if (gained > 0) p = { ...p, pontosAtrib: (p.pontosAtrib ?? 0) + gained };
          }
          if (cls.powerKey === 'artista_base') {
            const gained = newThresholds(10);
            if (gained > 0) p = { ...p, pontosAtrib: (p.pontosAtrib ?? 0) + gained };
          }

          // beldade/cativante/coreografo/descolado → +1 to specific stat + recalc diceBase
          const statBonusClass = { beldade: 'atkEsp', cativante: 'vel', coreografo: 'def', descolado: 'atk' };
          if (statBonusClass[cls.powerKey]) {
            const key   = statBonusClass[cls.powerKey];
            const gained = newThresholds(8);
            if (gained > 0) {
              const newStat    = (p.stats?.[key] ?? 0) + gained;
              const newDiceKey = Math.max(1, Math.floor(newStat / 2));
              p = {
                ...p,
                stats:    { ...p.stats,    [key]: newStat },
                diceBase: { ...p.diceBase, [key]: newDiceKey },
              };
            }
          }

          // especialista → +1 diceBonus on selected atrib per 8 levels
          if (cls.powerKey === 'especialista' && cls.especialistaAtrib) {
            const key    = cls.especialistaAtrib;
            const gained = newThresholds(8);
            if (gained > 0) {
              const cur = p.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 };
              p = { ...p, diceBonus: { ...cur, [key]: (cur[key] ?? 0) + gained } };
            }
          }


        }

        // parrudo stage-9 bonus: +1 vida to ALL pokémon after completing stage 9
        if (stage === 9 && playerClasses.some((c) => c.powerKey === 'parrudo')) {
          p = { ...p, vidasMax: p.vidasMax + 1 };
        }

        return p;
      });
    });

    const maxStages = gameMode?.stageCount ?? 12;
    const nextStage = stage + 1;

    if (nextStage >= maxStages) {
      setPhase('victory');
    } else {
      setStage(nextStage);
      // artifice recharge at stages 3, 5, 8
      const triggerArtificeStage = playerClasses.some((c) => c.powerKey === 'artifice')
        && [3, 5, 8].includes(nextStage);
      _beginStage(nextStage, triggerArtificeStage);
      if (triggerArtificeStage) {
        setArtificeCredits((c) => c + 1);
        setPhase('artifice_stage_choice');
      }
    }
  }, [stage, gameMode, _beginStage, playerClasses]);

  // ═══════════════════════════════════════════════════════════
  // TEAM MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  // Compute max team size based on classes
  const maxTeamSize = 2
    + (hasClassPower('captor_base')  ? 1 : 0)
    + (hasClassPower('colecionador') ? 1 : 0)
    + (hasClassPower('professor')    ? 1 : 0);

  /** Add captured Pokémon to team (default 2 slots, expanded by classes). */
  const handleAddToTeam = useCallback((pkm) => {
    setTeam((prev) => {
      const curMax = 2
        + (playerClasses.some((c) => c.powerKey === 'captor_base')  ? 1 : 0)
        + (playerClasses.some((c) => c.powerKey === 'colecionador') ? 1 : 0)
        + (playerClasses.some((c) => c.powerKey === 'professor')    ? 1 : 0);
      if (prev.length >= curMax) return prev;
      const isLeg = isLegendary(pkm.nome);
      const isShn = pkm.isShiny ?? false;
      const baseVidas = calcBaseVidas({ tipos: pkm.tipos ?? [] }, 'player', { isLeg, isShn });
      const pactuarioBonus = playerClasses.some((c) => c.powerKey === 'pactuario')
        ? (isLeg ? 2 : 1) : 0;
      const added = {
        ...pkm,
        context: 'player',
        vidasMax:   baseVidas + pactuarioBonus,
        vidasAtual: baseVidas + pactuarioBonus,
        conditions: [],
      };
      const newTeam = [...prev, added];
      // colecionador: +1 vida a todos da espécie quando forma um par
      if (playerClasses.some((c) => c.powerKey === 'colecionador')) {
        const existingSameSpecies = prev.filter((p) => p.dexNumber === pkm.dexNumber);
        if (existingSameSpecies.length > 0) {
          return newTeam.map((p) =>
            p.dexNumber === pkm.dexNumber
              ? { ...p, vidasMax: p.vidasMax + 1, vidasAtual: p.vidasAtual + 1 }
              : p
          );
        }
      }
      return newTeam;
    });
    // Register this pokémon's current level as baseline for all existing level-bonus classes
    const LEVEL_BONUS_KEYS = ['treinador_base', 'artista_base', 'beldade', 'cativante', 'coreografo', 'descolado', 'especialista'];
    setPlayerClasses((prev) => prev.map((cls) => {
      if (!LEVEL_BONUS_KEYS.includes(cls.powerKey)) return cls;
      return { ...cls, levelBaselines: { ...(cls.levelBaselines ?? {}), [pkm.uid]: pkm.level } };
    }));
    setRunStats((rs) => {
      const capIsShiny = pkm.isShiny ?? false;
      const capIsLeg = isLegendary(pkm.nome ?? '');
      return {
        ...rs,
        captures: rs.captures + 1,
        shinyCaptured:         capIsShiny             ? rs.shinyCaptured + 1         : rs.shinyCaptured,
        legendaryCaptured:     capIsLeg               ? rs.legendaryCaptured + 1     : rs.legendaryCaptured,
        legendaryShinyCapture: (capIsLeg && capIsShiny) ? rs.legendaryShinyCapture + 1 : rs.legendaryShinyCapture,
      };
    });
  }, [playerClasses]);

  const handleSwapActive = useCallback((idx) => {
    if (idx < 0 || idx >= team.length) return;
    if (team[idx].vidasAtual <= 0) return; // fainted
    setActiveIdx(idx);
  }, [team]);

  // ═══════════════════════════════════════════════════════════
  // ITEM USAGE
  // ═══════════════════════════════════════════════════════════
  const handleUseItem = useCallback((itemId, targetIdx) => {
    const itemDef = ITEMS_DATA.find((i) => i.id === itemId);
    if (!itemDef) return;
    if (battle?.itemUsedThisTurn) return;

    // ── Pedras evolutivas: abre seletor de atributo ──────────
    if (itemDef.effect === 'evo_stone') {
      setPendingEvoStone({ itemId, targetIdx });
      return;
    }

    // ── Pokédoll: pula CTnpc e concede recompensas ───────────
    if (itemDef.effect === 'pokedoll') {
      if (phase === 'map' && stageEncounters[0]?.type === ENCOUNTER_TYPES.TREINADOR) {
        const reward = CTNPC_MONEY_REWARD[stage] ?? 0;
        setMoney((m) => m + reward);
        setVisitedEncounters([0]);
        setPhase('reward');
        setInventory((inv) => ({
          ...inv,
          consumiveis: { ...inv.consumiveis, pokedoll: Math.max(0, (inv.consumiveis.pokedoll ?? 1) - 1) },
        }));
      }
      return;
    }

    // ── Pokécinto: +1 slot held no Pokémon alvo ──────────────
    if (itemDef.effect === 'pokecinto') {
      setTeam((prev) => {
        const next = [...prev];
        const p = { ...next[targetIdx] };
        p.extraHeldSlots = (p.extraHeldSlots ?? 0) + 1;
        next[targetIdx] = p;
        return next;
      });
      setInventory((inv) => ({
        ...inv,
        consumiveis: { ...inv.consumiveis, pokecinto: Math.max(0, (inv.consumiveis.pokecinto ?? 1) - 1) },
      }));
      return;
    }

    // ── Incensos de tipo: abre seletor de tipo ────────────────
    if (['incenso_tipo', 'incenso_tipo_garantido', 'incenso_shiny_tipo'].includes(itemDef.effect)) {
      setPendingIncense({
        itemId,
        effect: itemDef.effect,
        multiType: itemDef.effect !== 'incenso_tipo',
        selectedTypes: [],
      });
      return;
    }

    setTeam((prev) => {
      const updated = [...prev];
      const pkm = { ...updated[targetIdx] };

      // Healing
      if (itemDef.healVidas) {
        const isPocao = ['pocao_menor','pocao_maior','pocao_suprema'].includes(itemDef.id);
        const bonus = (hasClassPower('medico_campo') ? 1 : 0) + (isPocao && hasClassPower('cientista') ? 1 : 0);
        pkm.vidasAtual = Math.min(pkm.vidasMax, pkm.vidasAtual + itemDef.healVidas + bonus);
      }
      // Condition cure
      if (itemDef.cureConditions) {
        if (itemDef.cureConditions.includes('all')) {
          pkm.conditions = [];
        } else {
          pkm.conditions = pkm.conditions.filter((c) => !itemDef.cureConditions.includes(c));
        }
        // Alquimista quimico: +1 vida on cure items
        if (hasClassPower('quimico')) {
          pkm.vidasAtual = Math.min(pkm.vidasMax, pkm.vidasAtual + 1);
        }
      }
      updated[targetIdx] = pkm;
      return updated;
    });

    // Consume item (unless Alquimista base: 50% chance to not consume)
    const alqBase = hasClassPower('alquimista_base');
    if (!alqBase || Math.random() >= 0.5) {
      setInventory((inv) => {
        const cat = itemDef.category === 'fruta' ? 'frutas' : 'consumiveis';
        const count = (inv[cat][itemId] ?? 0) - 1;
        const updated = { ...inv, [cat]: { ...inv[cat], [itemId]: Math.max(0, count) } };
        return updated;
      });
    }
    // Mark item used this turn (only during battle)
    if (battle) setBattle((b) => b ? { ...b, itemUsedThisTurn: true } : b);
  }, [playerClasses, battle, phase, stage, stageEncounters]);

  const handleApplyEvoStone = useCallback((stat) => {
    if (!pendingEvoStone) return;
    const { itemId, targetIdx } = pendingEvoStone;
    const itemDef = ITEMS_DATA.find((i) => i.id === itemId);
    if (!itemDef) return;
    const amount = hasClassPower('evolucionista') ? 5 : (itemDef.evoAtrib ?? 3);
    setTeam((prev) => {
      const next = [...prev];
      const p = { ...next[targetIdx] };
      if (stat === 'vidasMax') {
        p.vidasMax = (p.vidasMax ?? 3) + amount;
        p.vidasAtual = Math.min(p.vidasMax, (p.vidasAtual ?? p.vidasMax) + amount);
      } else {
        const db = { ...(p.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 }) };
        db[stat] = (db[stat] ?? 0) + amount;
        p.diceBonus = db;
      }
      next[targetIdx] = p;
      return next;
    });
    setInventory((inv) => ({
      ...inv,
      consumiveis: { ...inv.consumiveis, [itemId]: Math.max(0, (inv.consumiveis[itemId] ?? 1) - 1) },
    }));
    if (battle) setBattle((b) => b ? { ...b, itemUsedThisTurn: true } : b);
    setPendingEvoStone(null);
  }, [pendingEvoStone, battle]);

  const handleActivateIncense = useCallback((types) => {
    if (!pendingIncense) return;
    const { itemId, effect } = pendingIncense;
    const itemDef = ITEMS_DATA.find((i) => i.id === itemId);
    if (!itemDef) return;
    setActiveIncense({ effect, types, bonus: itemDef.bonus ?? 0.30 });
    setInventory((inv) => ({
      ...inv,
      consumiveis: { ...inv.consumiveis, [itemId]: Math.max(0, (inv.consumiveis[itemId] ?? 1) - 1) },
    }));
    setPendingIncense(null);
  }, [pendingIncense]);

  const handleBuyItem = useCallback((itemId, qty = 1) => {
    const itemDef = ITEMS_DATA.find((i) => i.id === itemId);
    if (!itemDef) return;

    let price = itemDef.price * qty;
    if (hasClassPower('contrabandista')) price = Math.floor(price * 0.75);

    if (money < price) return;
    if (itemId === 'masterball' && (inventory.pokebolas.masterball ?? 0) >= 1) return;
    if (itemDef.category === 'pokeball' && (inventory.pokebolas[itemId] ?? 0) + qty > 10) return;
    setMoney((m) => m - price);

    setInventory((inv) => {
      let cat;
      if (itemDef.category === 'pokeball')   cat = 'pokebolas';
      else if (itemDef.category === 'consumivel') cat = 'consumiveis';
      else if (itemDef.category === 'fruta')  cat = 'frutas';
      else if (itemDef.category === 'held')   cat = 'held';
      else if (itemDef.category === 'ballmod') cat = 'ballmods';
      else cat = 'consumiveis';

      const current = inv[cat][itemId] ?? 0;
      return { ...inv, [cat]: { ...inv[cat], [itemId]: current + qty } };
    });
  }, [money, inventory, playerClasses]);

  const handleUnequipHeld = useCallback((pkmIdx, heldIdx) => {
    const pkm = team[pkmIdx];
    const heldArr = Array.isArray(pkm?.heldItem) ? pkm.heldItem : (pkm?.heldItem ? [pkm.heldItem] : []);
    const item = heldArr[heldIdx];
    if (!item) return;
    setTeam((prev) => {
      const next = [...prev];
      const p = { ...next[pkmIdx] };
      const arr = Array.isArray(p.heldItem) ? [...p.heldItem] : (p.heldItem ? [p.heldItem] : []);
      arr.splice(heldIdx, 1);
      p.heldItem = arr.length === 0 ? null : arr.length === 1 ? arr[0] : arr;
      next[pkmIdx] = p;
      return next;
    });
    setInventory((inv) => ({ ...inv, held: { ...inv.held, [item.id]: (inv.held[item.id] ?? 0) + 1 } }));
  }, [team]);

  const handleEquipItem = useCallback((itemId, pokemonIdx) => {
    const itemDef = ITEMS_DATA.find((i) => i.id === itemId);
    if (!itemDef || !['held', 'fruta'].includes(itemDef.category)) return;

    setTeam((prev) => {
      const updated = [...prev];
      const pkm = { ...updated[pokemonIdx] };
      // Virtuose: can hold 2 items; Guia: +2 held slots for all pokémon; Pokécinto adds +1 per use
      const guiaHeldBonus = playerClasses.some((c) => c.powerKey === 'guia') ? 2 : 0;
      const maxHeld = (hasClassPower('virtuose') ? 2 : 1) + guiaHeldBonus + (pkm.extraHeldSlots ?? 0);
      const currentHeld = Array.isArray(pkm.heldItem) ? pkm.heldItem : (pkm.heldItem ? [pkm.heldItem] : []);
      if (currentHeld.length >= maxHeld) return prev;
      pkm.heldItem = maxHeld === 1 ? itemDef : [...currentHeld, itemDef];
      updated[pokemonIdx] = pkm;
      return updated;
    });

    const invBucket = itemDef.category === 'fruta' ? 'frutas' : 'held';
    setInventory((inv) => {
      const count = (inv[invBucket]?.[itemId] ?? 0) - 1;
      return { ...inv, [invBucket]: { ...inv[invBucket], [itemId]: Math.max(0, count) } };
    });
  }, [playerClasses]);

  const handlePanelDrop = useCallback((target, pkmIdx) => {
    if (!dragInfo) return;
    if (dragInfo.type === 'pokemon') {
      if (dragInfo.idx !== pkmIdx) {
        setTeam((prev) => {
          const next = [...prev];
          if (pkmIdx < next.length) [next[dragInfo.idx], next[pkmIdx]] = [next[pkmIdx], next[dragInfo.idx]];
          return next;
        });
        setActiveIdx((prev) => {
          if (prev === dragInfo.idx) return pkmIdx;
          if (prev === pkmIdx) return dragInfo.idx;
          return prev;
        });
      }
    } else if (dragInfo.type === 'item') {
      if (target === 'pokemon_image' && ['consumivel', 'fruta'].includes(dragInfo.def?.category)) {
        handleUseItem(dragInfo.itemId, pkmIdx);
      } else if (target === 'held_slot' && ['held', 'fruta'].includes(dragInfo.def?.category)) {
        handleEquipItem(dragInfo.itemId, pkmIdx);
      }
    }
    setDragInfo(null);
  }, [dragInfo, handleUseItem, handleEquipItem]);

  // ═══════════════════════════════════════════════════════════
  // END RUN
  // ═══════════════════════════════════════════════════════════
  const handleEndRun = useCallback((won) => {
    const name = currentUser?.isGuest
      ? (guestName.trim() || 'Visitante')
      : (currentUser?.username ?? 'Jogador');

    const modeId = gameMode?.id ?? 'jornada';
    const score = modeId === 'pocket'
      ? calcPocketScore({ runStats, team, money })
      : calcScore({ stage, captures: runStats.captures, money, turnsTotal: runStats.turnsTotal });

    const teamSnap = team.map((p) => ({
      nome: p.nome, dexNumber: p.dexNumber, level: p.level,
      types: p.types, isShiny: p.isShiny ?? false,
    }));
    const entry = { name, score, stages: stage, won, team: teamSnap, date: new Date().toLocaleDateString('pt-BR') };
    pushRanking(modeId, entry);

    setPhase(won ? 'victory' : 'gameover');
  }, [currentUser, guestName, stage, runStats, money, gameMode]);

  const handleReturnToLogin = useCallback(() => {
    // Reset all run state
    setPhase('login');
    setCurrentUser(null);
    setPasswordInput('');
    setLoginError('');
    setGameMode(null);
    setPlayerClasses([]);
    setTeam([]);
    setActiveIdx(0);
    setStage(0);
    setMoney(100);
    setInventory(INITIAL_INVENTORY);
    setRunStats({ captures: 0, turnsTotal: 0, stagesCleared: 0, shinyCaptured: 0, legendaryCaptured: 0, legendaryShinyCapture: 0, normalStagesCleared: 0, specialStagesCleared: 0, bossWon: false, minibossWon: false });
    setStageEncounters([]);
    setVisitedEncounters([]);
    setCurrentEncounter(null);
    setBattle(null);
    setBattleLog([]);
    setCapturedInEncounter(null);
    setShowRanking(false);
    setVidenteChoice(null);
    setClassChoiceData(null);
    setEngineerChoicePending(null);
    setEngineerChoiceMap({});
  }, []);

  // ═══════════════════════════════════════════════════════════
  // BATTLE HANDLERS (Part 4)
  // ═══════════════════════════════════════════════════════════

  /** Called when entering a battle encounter. Sets up battle state. */
  const initBattle = useCallback((encounter) => {
    const playerPkm = team[activeIdx];
    if (!playerPkm) return;
    const isBoss        = encounter.type === ENCOUNTER_TYPES.BOSS;
    const isCTNpc       = encounter.type === ENCOUNTER_TYPES.TREINADOR;
    const enemy0        = encounter.enemy?.[0];
    if (!enemy0) return;

    const ctnpcClasses   = encounter.ctnpcClasses ?? [];
    const ctnpcClassKeys = ctnpcClasses.map((c) => c.powerKey);
    const pClassKeys     = playerClasses.map((c) => c.powerKey);
    const velLog = [];
    const playerGoesFirst = rollVelInitiative({ ...playerPkm }, { ...enemy0 }, pClassKeys, velLog, ctnpcClassKeys);

    setBattle({
      phase: 'awaitingAction',
      playerGoesFirst,
      videnteChoice,
      playerPkm: { ...playerPkm },
      enemyPkm:  { ...enemy0 },
      enemyTeam: encounter.enemy ?? [enemy0],
      enemyActiveIdx: 0,
      turnNum: 0,
      isBoss, isCTNpc,
      ctnpcClasses,
      ctnpcClassKeys,
      encounterType:  encounter.type,
      canCapture:     encounter.type === ENCOUNTER_TYPES.SELVAGEM,
      metalCoatUsedThisTurn: false,
      itemUsedThisTurn: false,
      playerAttackedThisBattle: false,
      playerWasAttackedThisBattle: false,
      selectedBallmod: null,
      pendingDefense: !playerGoesFirst
        ? { enemyAction: enemyChooseAttack({ ...enemy0 }, { ...playerPkm }, ctnpcClassKeys), playerFirst: false }
        : null,
      // Special action state
      sa: {
        // ── pending flags (consumed after next action) ──
        mongePending:            false,
        hipnosePending:          false, // enemy -5/-10/-20 final value
        oficialPending:          false, // +5/+8/+12 next player roll
        ilusionistaPending:      false, // enemy desvantagem next roll
        bardoPending:            false, // player vantagem next roll
        ocultismoPending:        false, // +2d next player roll
        sincronoPending:         0,     // +Nd next player roll (N = team size)
        domadorActive:           false, // +2d next player atk (vs wild)
        soldadoActive:           false, // rambo active this turn
        soldadoEnemyCounterNext: false, // enemy vantagem next turn
        // ── estilista ──
        estilizarExtraType: null,  // random type added to this turn's attack
        estilizarUsed:      false, // action used this battle
        // ── used flags (1×/batalha) ──
        mongeUsed:          false,
        hipnosoCharges:     isBoss ? 2 : 1,
        cientistUsed:       false,
        oficialUsed:        false,
        ilusionistUsed:     false,
        soldadoUsed:        false,
        bardoUsed:          false,
        ocultistUsed:       false,
        empaticUsed:        false,
        aventureiroUsed:    false,
        guardianUsed:       false,
        // ── charges ──
        domadorCharges: playerClasses.some((c) => c.powerKey === 'domador') ? 2 : 0,
        raptarCharges:  playerClasses.some((c) => c.powerKey === 'ladrao')  ? 3 : 0,
        // ── 1×/encontro ──
        azaraoUsed:   false,
        sincronoUsed: false,
        elementalistaActive: false,
        // ── tutor ──
        tutorUsed:      false,
        tutoriaOverride: null, // { pkmNome, atkAction, dice } — set before Atacar, cleared after
      },
      // CTnpc special action state (mirrors player sa for enemy side)
      enemySa: {
        hipnosoUsed:   false, oficialUsed:    false, ilusionistUsed:  false,
        soldadoUsed:   false, mongeUsed:      false, bardoUsed:       false,
        ocultistUsed:  false, empaticUsed:    false,
        // pending flags that affect player's next attack:
        hipnosePending_e:       false, // player's next attack has penalty
        ilusionistaPending_e:   false, // player's next attack has desvantagem
        soldadoPlayerCounterNext: false, // player's next attack has vantagem (CTnpc rambo counter)
      },
    });
    setBattleLog([`⚔️ Encontro com ${enemy0.nome} (Nv.${enemy0.level})!`, ...velLog]);
    // Save all encountered pokémon to cyberdex (named users only)
    if (!currentUser?.isGuest) {
      const allEnemies = encounter.enemy ?? [enemy0];
      allEnemies.forEach((ep) => {
        if (ep?.dexNumber) {
          setCyberdex((prev) => new Set([...prev, ep.dexNumber]));
          addToJNCyberdex(currentUser.username, ep.dexNumber);
        }
      });
    }
  }, [team, activeIdx, playerClasses, videnteChoice]);

  /** Save game state snapshot before a roll, for Azarão undo. */
  const saveAzaraoSnapshot = useCallback(() => {
    if (!battle || phase !== 'battle') return;
    setBattleSnapshot({
      team: JSON.parse(JSON.stringify(team)),
      battle: JSON.parse(JSON.stringify(battle)),
      battleLog: [...battleLog],
    });
  }, [team, battle, battleLog, phase]);

  /** Shared end-of-turn logic called from handlePlayerAction and handlePlayerDefense. */
  const _finalizeTurn = useCallback(({ playerPkm, enemyPkm, playerFainted, enemyFainted, log, newTurnNum, metalCoatUsedThisTurn, sa, actionType, enemyAction, team: teamSnap, activeIdx: aIdx, newEnemySa }) => {
    const { isBoss, isCTNpc, enemyTeam, enemyActiveIdx, ctnpcClassKeys } = battle;
    const isMiniboss = battle.encounterType === ENCOUNTER_TYPES.MINIBOSS;
    const pClassKeys = playerClasses.map((c) => c.powerKey);
    const eck = ctnpcClassKeys ?? [];

    // Fantasma: last attack on faint
    if (enemyFainted && (enemyPkm.types ?? []).includes('Fantasma')) {
      log.push(`👻 ${enemyPkm.nome} realiza seu último ataque antes de ser derrotado!`);
      const rf = doAttack(enemyPkm, enemyAction, playerPkm, false, { pClassKeys, log, isBoss, metalCoatUsedThisTurn: false });
      enemyPkm = rf.atk; playerPkm = rf.def;
      if (rf.defFainted) playerFainted = true;
    }
    if (playerFainted && (playerPkm.types ?? []).includes('Fantasma')) {
      log.push(`👻 ${playerPkm.nome} realiza seu último ataque antes de ser derrotado!`);
      const rf = doAttack(playerPkm, actionType ?? 'atk', enemyPkm, true, { pClassKeys, log, isBoss, metalCoatUsedThisTurn });
      playerPkm = rf.atk; enemyPkm = rf.def;
      if (rf.defFainted) enemyFainted = true;
    }

    // Leftovers: heal 1 vida every 2 turns
    if (newTurnNum % 2 === 0) {
      const held = Array.isArray(playerPkm.heldItem) ? playerPkm.heldItem : (playerPkm.heldItem ? [playerPkm.heldItem] : []);
      if (held.some((h) => h?.effect === 'leftovers')) {
        playerPkm = { ...playerPkm, vidasAtual: Math.min(playerPkm.vidasMax, playerPkm.vidasAtual + 1) };
        log.push(`🍃 ${playerPkm.nome} recuperou 1 vida (Leftovers)!`);
      }
    }

    // Auto-use berries
    const autoUseBerry = (pkm) => {
      const berry = pkm.heldItem && !Array.isArray(pkm.heldItem) ? pkm.heldItem : null;
      if (!berry?.autoUse) return pkm;
      if (berry.autoUse === 'hp_half' && pkm.vidasAtual <= Math.floor(pkm.vidasMax / 2) && pkm.vidasAtual > 0) {
        log.push(`🍓 ${pkm.nome} usou ${berry.name} automaticamente!`);
        return { ...pkm, vidasAtual: Math.min(pkm.vidasMax, pkm.vidasAtual + (berry.healVidas ?? 1)), heldItem: null };
      }
      if (berry.autoUse === 'condition' && pkm.conditions.length > 0) {
        log.push(`🍋 ${pkm.nome} usou ${berry.name} — condições curadas!`);
        return { ...pkm, conditions: [], heldItem: null };
      }
      return pkm;
    };
    playerPkm = autoUseBerry(playerPkm);

    // Cyber Médico: ao perder a última vida, recupera metade das vidas (1× por pokémon por run)
    if (playerFainted && pClassKeys.includes('medico') && !medicoUsedUids.includes(playerPkm.uid)) {
      const heal = Math.max(1, Math.floor(playerPkm.vidasMax / 2));
      playerPkm = { ...playerPkm, vidasAtual: heal };
      playerFainted = false;
      log.push(`🏥 Cyber Médico! ${playerPkm.nome} sobreviveu com ${heal} vida(s)!`);
      setMedicoUsedUids((prev) => [...prev, playerPkm.uid]);
    }

    const newTeam = [...teamSnap];
    newTeam[aIdx] = playerPkm;

    // Fantasma last-stand: if the player's Ghost was the last alive Pokémon and it died,
    // the player loses even if the Ghost's final attack defeated the enemy.
    const ghostLastStand = playerFainted
      && (playerPkm.types ?? []).includes('Fantasma')
      && newTeam.filter((p) => p.vidasAtual > 0).length === 0;
    if (ghostLastStand && enemyFainted) {
      log.push(`💀 ${playerPkm.nome} era o último pokémon — derrota mesmo com a vitória!`);
    }

    // Heal all Pokémon on miniboss victory + generate item reward
    let minibossItems = null;
    if (enemyFainted && isMiniboss) {
      for (let i = 0; i < newTeam.length; i++) {
        newTeam[i] = { ...newTeam[i], vidasAtual: newTeam[i].vidasMax, conditions: [], metalCoatUsed: false };
      }
      log.push(`💊 Vitória contra o Miniboss! Todos os Pokémon foram curados!`);
      minibossItems = pickMinibossRewardItems();
    }
    setTeam(newTeam);
    setRunStats((rs) => ({
      ...rs,
      turnsTotal: rs.turnsTotal + 1,
      ...(enemyFainted && isBoss     && !ghostLastStand ? { bossWon: true }     : {}),
      ...(enemyFainted && isMiniboss && !ghostLastStand ? { minibossWon: true } : {}),
    }));
    setBattleLog((prev) => [...prev, ...log]);

    // CTnpc next Pokémon
    if (enemyFainted && isCTNpc && enemyActiveIdx + 1 < (enemyTeam?.length ?? 1)) {
      const nextIdx   = enemyActiveIdx + 1;
      const nextEnemy = enemyTeam[nextIdx];
      const velLog2   = [];
      const pgf = rollVelInitiative({ ...playerPkm }, { ...nextEnemy }, pClassKeys, velLog2, eck);
      setBattleLog((prev) => [...prev, `🔄 ${nextEnemy.nome} entrou na batalha!`, ...velLog2]);
      setBattle((b) => ({
        ...b, enemyPkm: { ...nextEnemy }, enemyActiveIdx: nextIdx,
        playerPkm, turnNum: newTurnNum, metalCoatUsedThisTurn: false, itemUsedThisTurn: false, phase: 'awaitingAction',
        playerGoesFirst: pgf,
        pendingDefense: !pgf
          ? { enemyAction: enemyChooseAttack({ ...nextEnemy }, { ...playerPkm }, eck), playerFirst: false }
          : null,
        sa: {
          ...b.sa,
          mongePending: false, hipnosePending: false, oficialPending: false,
          ilusionistaPending: false, bardoPending: false, ocultismoPending: false,
          domadorActive: false, sincronoPending: 0, soldadoActive: false,
          soldadoEnemyCounterNext: sa.soldadoActive,
          estilizarExtraType: null,
        },
        enemySa: { ...(newEnemySa ?? b.enemySa), hipnosePending_e: false, ilusionistaPending_e: false, soldadoPlayerCounterNext: false },
      }));
      return;
    }

    // CTnpc money reward (last pokémon defeated)
    if (enemyFainted && isCTNpc) {
      const ctnpcMoney = CTNPC_MONEY_REWARD[stage] ?? 0;
      if (ctnpcMoney > 0) {
        setMoney((m) => m + ctnpcMoney);
        setBattleLog((prev) => [...prev, `💰 +${ctnpcMoney}₩ (CTnpc derrotado!)`]);
      }
    }

    // Class reward (CTnpc stages 3/5/8)
    let classRewardCls = null;
    if (enemyFainted && isCTNpc && [3, 5, 8].includes(stage)) {
      const ownedGroupIds = playerClasses.map((c) => {
        const g = CLASSES_DATA.find((gr) => gr.classes.some((cl) => cl.id === c.id));
        return g?.groupId;
      }).filter(Boolean);
      if (stage === 3) {
        const candidates = CLASSES_DATA.filter((g) => !ownedGroupIds.includes(g.groupId)).map((g) => g.classes.find((c) => c.isBase)).filter(Boolean);
        if (candidates.length > 0) classRewardCls = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        const candidates = CLASSES_DATA.filter((g) => ownedGroupIds.includes(g.groupId)).flatMap((g) => g.classes.filter((c) => !c.isBase && !playerClasses.some((pc) => pc.id === c.id)));
        if (candidates.length > 0) classRewardCls = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    // Wild money/items
    if (enemyFainted && !isCTNpc && !isBoss && !isMiniboss) {
      const encMoney = STAGE_ENCOUNTER_MONEY[Math.min(stage, STAGE_ENCOUNTER_MONEY.length - 1)];
      if (encMoney > 0) setMoney((m) => m + encMoney);
      setWildRewardItems(generateWildRewardItems(stage));
    }

    const newPhase = ghostLastStand ? 'result_lose'
      : classRewardCls ? 'classReward'
      : (enemyFainted && isMiniboss) ? 'minibossReward'
      : enemyFainted ? 'result_win'
      : (playerFainted && newTeam.filter((p) => p.vidasAtual > 0).length === 0) ? 'result_lose'
      : playerFainted ? 'switchPokemon'
      : 'awaitingAction';

    const nextPendingDefense = (newPhase === 'awaitingAction' && !battle.playerGoesFirst)
      ? { enemyAction: enemyChooseAttack(enemyPkm, playerPkm, eck), playerFirst: false }
      : null;

    setBattle((b) => ({
      ...b, playerPkm, enemyPkm, turnNum: newTurnNum, metalCoatUsedThisTurn,
      itemUsedThisTurn: false,
      phase: newPhase, classRewardCls: classRewardCls ?? b.classRewardCls ?? null,
      minibossItems: minibossItems ?? b.minibossItems ?? null,
      pendingDefense: nextPendingDefense,
      enemySa: newEnemySa ?? b.enemySa,
      sa: {
        ...b.sa,
        mongePending: false, hipnosePending: false, oficialPending: false,
        ilusionistaPending: false, bardoPending: false, ocultismoPending: false,
        domadorActive: false, sincronoPending: 0, soldadoActive: false,
        soldadoEnemyCounterNext: sa.soldadoActive,
        estilizarExtraType: null,
        tutoriaOverride: null,
      },
    }));
  }, [battle, stage, playerClasses, medicoUsedUids, setTeam, setRunStats, setBattleLog, setBattle, setMoney, setWildRewardItems, setMedicoUsedUids]);

  /** Process one full battle turn given the player's chosen action. */
  const handlePlayerAction = useCallback((actionType) => {
    if (!battle || battle.phase !== 'awaitingAction') return;
    saveAzaraoSnapshot();

    const log = [];
    let { playerPkm, enemyPkm, enemyTeam, enemyActiveIdx, turnNum, isBoss, isCTNpc } = battle;

    playerPkm = tickConditions(playerPkm);
    enemyPkm  = tickConditions(enemyPkm);

    const pClassKeys     = playerClasses.map((c) => c.powerKey);
    const ctnpcClassKeys = battle.ctnpcClassKeys ?? [];
    const sa             = battle.sa ?? {};

    // Inquebrável: +1 vidasMax per inactive team pokémon with full HP
    const inquebravelBonus = pClassKeys.includes('inquebravel')
      ? team.filter((p, i) => i !== activeIdx && p.vidasAtual >= p.vidasMax).length
      : 0;
    if (inquebravelBonus > 0) {
      playerPkm = { ...playerPkm, vidasMax: playerPkm.vidasMax + inquebravelBonus };
    }

    // Cyber Tutor: override attack with borrowed move from inactive pokémon
    let atkType = actionType;
    if (sa.tutoriaOverride) {
      atkType = sa.tutoriaOverride.atkAction;
      playerPkm = { ...playerPkm, diceBase: { ...playerPkm.diceBase, [atkType]: sa.tutoriaOverride.dice } };
      const log0 = [];
      log0.push(`📚 Tutoria! ${playerPkm.nome} usa o golpe de ${sa.tutoriaOverride.pkmNome}!`);
      setBattleLog((prev) => [...prev, ...log0]);
    }

    // Consume CTnpc's pending player-affecting flags before player attacks
    const enemySa_b = battle.enemySa ?? {};
    const pAtkDesvantagem_e   = !!enemySa_b.ilusionistaPending_e;
    const pAtkVantagem_ctnpc  = !!enemySa_b.soldadoPlayerCounterNext;
    const pFinalAtkPenalty_e  = enemySa_b.hipnosePending_e ? (stage >= 10 ? 20 : stage >= 7 ? 10 : 5) : 0;
    const consumedEnemySa     = { ...enemySa_b, hipnosePending_e: false, ilusionistaPending_e: false, soldadoPlayerCounterNext: false };

    const enemyAction = enemyChooseAttack(enemyPkm, playerPkm, ctnpcClassKeys);

    const mediumBonus    = pClassKeys.includes('medium') ? team.filter((p) => p.vidasAtual <= 0).length : 0;
    const bardoLegVantagem = pClassKeys.includes('bardo') && isLegendary(team[activeIdx]?.nome ?? '');
    const guardMisBonus    = pClassKeys.includes('guardiao_mis') && isLegendary(team[activeIdx]?.nome ?? '') ? 1 : 0;
    const videnVantagem  = pClassKeys.includes('vidente') && battle.videnteChoice === 'vantagem';
    const videnteDesvAdv = pClassKeys.includes('vidente') && battle.videnteChoice === 'desvantagem';
    const hipnosePenalty = sa.hipnosePending ? (stage >= 10 ? 20 : stage >= 7 ? 10 : 5) : 0;
    const oficialBonus   = sa.oficialPending  ? (stage >= 10 ? 12 : stage >= 6 ? 8 : 5) : 0;
    const nerdVantagem   = pClassKeys.includes('nerd') && (() => {
      const eTypes = battle.enemyPkm?.types ?? [];
      return team.some((p, i) => i !== activeIdx && p && (p.types ?? []).some((t) => eTypes.includes(t)));
    })();

    const pAtkVantagem     = nerdVantagem || videnVantagem || sa.soldadoActive || sa.bardoPending || bardoLegVantagem || pAtkVantagem_ctnpc || pClassKeys.includes('guerreiro_base');
    const pAtkDesvantagem  = pAtkDesvantagem_e;
    const ocultismoLegBonus = pClassKeys.includes('ocultista') && isLegendary(team[activeIdx]?.nome ?? '') ? 2 : 0;
    const pExtraAtkDice    = mediumBonus + guardMisBonus + ocultismoLegBonus + (sa.ocultismoPending ? 2 : 0) + (sa.sincronoPending ?? 0) + (sa.domadorActive && !isCTNpc && !isBoss ? 2 : 0) + azaraoRerollBonus;
    if (azaraoRerollBonus > 0) setAzaraoRerollBonus(0);
    const pFinalAtkBonus   = oficialBonus;
    const pFinalAtkPenalty = pFinalAtkPenalty_e;
    const eAtkVantagem     = sa.soldadoEnemyCounterNext;
    const eAtkDesvantagem  = videnteDesvAdv || sa.ilusionistaPending;
    const eFinalAtkPenalty = hipnosePenalty + (sa.soldadoActive ? 10 : 0);

    const bossIgnoreResist = isBoss && turnNum >= 1 && (turnNum - 1) % 4 === 0;
    const pAtkOpts = { atkVantagem: pAtkVantagem, atkDesvantagem: pAtkDesvantagem, extraAtkDice: pExtraAtkDice, finalAtkBonus: pFinalAtkBonus, finalAtkPenalty: pFinalAtkPenalty, selectedType: pendingAtkType, estilizarExtraType: sa.estilizarExtraType ?? null, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, defDesvantagem: videnteDesvAdv };
    const eAtkOpts = { atkVantagem: eAtkVantagem, atkDesvantagem: eAtkDesvantagem, finalAtkPenalty: eFinalAtkPenalty, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, bossIgnoreResist, turnNum, defVantagem: nerdVantagem || videnVantagem || bardoLegVantagem };
    setPendingAtkType(null);

    // Guard: this handler only runs when player has initiative
    if (!battle.playerGoesFirst) return;

    {
      // ── Player attacks first ────────────────────────────────
      const eDefChoice = enemyChooseDefense(enemyPkm, atkType, ctnpcClassKeys);
      const r1 = doAttack(playerPkm, atkType, enemyPkm, true, { ...pAtkOpts, defChoice: eDefChoice, metalCoatUsedThisTurn: false });
      playerPkm = r1.atk; enemyPkm = r1.def;
      let mcUsed = r1.usedMC;

      // Golpe Duplo (Monge): second attack
      if (enemyPkm.vidasAtual > 0 && sa.mongePending) {
        log.push(`👊 Golpe Duplo — segundo ataque!`);
        const eDefChoice2 = enemyChooseDefense(enemyPkm, atkType, ctnpcClassKeys);
        const r1b = doAttack(playerPkm, atkType, enemyPkm, true, { extraAtkDice: mediumBonus, defChoice: eDefChoice2, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, metalCoatUsedThisTurn: mcUsed });
        playerPkm = r1b.atk; enemyPkm = r1b.def;
        if (r1b.usedMC) mcUsed = true;
      }

      if (enemyPkm.vidasAtual <= 0) {
        // Enemy fainted — finalize immediately (no defense needed)
        _finalizeTurn({ playerPkm, enemyPkm, playerFainted: false, enemyFainted: true, log, newTurnNum: turnNum + 1, metalCoatUsedThisTurn: mcUsed, sa, actionType: atkType, enemyAction, team, activeIdx, newEnemySa: consumedEnemySa });
      } else {
        // Enemy alive — pause for player to choose defense
        setBattleLog((prev) => [...prev, ...log]);
        setBattle((b) => ({
          ...b, playerPkm, enemyPkm, metalCoatUsedThisTurn: mcUsed,
          phase: 'awaitingDefense',
          enemySa: consumedEnemySa,
          sa: { ...b.sa, ...(sa.tutoriaOverride ? { tutoriaOverride: null, tutorUsed: true } : {}) },
          pendingDefense: { enemyAction, playerFirst: true, eAtkOpts },
        }));
      }
    }
  }, [battle, team, activeIdx, playerClasses, stage, pendingAtkType, setPendingAtkType, _finalizeTurn, saveAzaraoSnapshot, azaraoRerollBonus]);

  /** Player chooses defense (dodge with vel or defend with def/defEsp). */
  const handlePlayerDefense = useCallback((defChoice) => {
    if (!battle || battle.phase !== 'awaitingDefense') return;
    saveAzaraoSnapshot();
    const { pendingDefense, isBoss, isCTNpc, turnNum } = battle;
    if (!pendingDefense) return;

    const { enemyAction, playerFirst, eAtkOpts } = pendingDefense;
    const pClassKeys     = playerClasses.map((c) => c.powerKey);
    const ctnpcClassKeys = battle.ctnpcClassKeys ?? [];
    const sa = battle.sa ?? {};
    const bossIgnoreResist = isBoss && turnNum >= 1 && (turnNum - 1) % 4 === 0;
    const nerdVantagem   = pClassKeys.includes('nerd') && (() => {
      const eTypes = battle.enemyPkm?.types ?? [];
      return team.some((p, i) => i !== activeIdx && p && (p.types ?? []).some((t) => eTypes.includes(t)));
    })();

    const log = [];
    let { playerPkm, enemyPkm, metalCoatUsedThisTurn } = battle;

    // Inquebrável: +1 vidasMax per inactive team pokémon with full HP
    const inquebravelBonusDef = pClassKeys.includes('inquebravel')
      ? team.filter((p, i) => i !== activeIdx && p.vidasAtual >= p.vidasMax).length
      : 0;
    if (inquebravelBonusDef > 0) {
      playerPkm = { ...playerPkm, vidasMax: playerPkm.vidasMax + inquebravelBonusDef };
    }
    let playerFainted = false;

    // CTnpc special action before enemy attacks
    let newEnemySa = { ...(battle.enemySa ?? {}) };
    if (isCTNpc) {
      const ctnpcAction = decideCTNpcAction(enemyPkm, playerPkm, ctnpcClassKeys, newEnemySa);
      if (ctnpcAction) {
        const r = applyCTNpcSpecialAction(ctnpcAction, newEnemySa, enemyPkm, playerPkm, stage, log);
        newEnemySa = r.updatedSa; enemyPkm = r.enemyPkm;
        // Apply CTnpc buffs on top of pre-computed eAtkOpts
        const merged = {
          ...(eAtkOpts ?? {}), defChoice, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, metalCoatUsedThisTurn: false,
          atkVantagem: (eAtkOpts?.atkVantagem ?? false) || r.atkVantagem,
          extraAtkDice: (eAtkOpts?.extraAtkDice ?? 0) + r.extraAtkDice,
          finalAtkBonus: (eAtkOpts?.finalAtkBonus ?? 0) + r.finalAtkBonus,
          defVantagem: (eAtkOpts?.defVantagem ?? false) || nerdVantagem,
        };
        const re = doAttack(enemyPkm, enemyAction, playerPkm, false, merged);
        enemyPkm = re.atk; playerPkm = re.def;
        if (re.defFainted) playerFainted = true;
        // CTnpc Golpe Duplo second attack
        if (!playerFainted && r.mongePending) {
          log.push(`👊 [CTnpc] Golpe Duplo — segundo ataque!`);
          const re2 = doAttack(enemyPkm, enemyAction, playerPkm, false, { defChoice, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, metalCoatUsedThisTurn: false });
          enemyPkm = re2.atk; playerPkm = re2.def;
          if (re2.defFainted) playerFainted = true;
        }
      } else {
        const fullEAtkOpts = { ...(eAtkOpts ?? {}), defChoice, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, metalCoatUsedThisTurn: false, defVantagem: (eAtkOpts?.defVantagem ?? false) || nerdVantagem };
        const re = doAttack(enemyPkm, enemyAction, playerPkm, false, fullEAtkOpts);
        enemyPkm = re.atk; playerPkm = re.def;
        if (re.defFainted) playerFainted = true;
      }
    } else {
      // ── Enemy attacks player (player chose defChoice) ────────
      const fullEAtkOpts = { ...(eAtkOpts ?? {}), defChoice, pClassKeys, log, isBoss, metalCoatUsedThisTurn: false, bossIgnoreResist, turnNum, defVantagem: (eAtkOpts?.defVantagem ?? false) || nerdVantagem };
      const re = doAttack(enemyPkm, enemyAction, playerPkm, false, fullEAtkOpts);
      enemyPkm = re.atk; playerPkm = re.def;
      if (re.defFainted) playerFainted = true;
    }

    setBattleLog((prev) => [...prev, ...log]);

    if (!playerFirst) {
      // ── Enemy went first → player now chooses their attack ──
      if (playerFainted) {
        _finalizeTurn({
          playerPkm, enemyPkm, playerFainted: true, enemyFainted: false,
          log: [], newTurnNum: (battle.turnNum ?? 0) + 1,
          metalCoatUsedThisTurn: false, sa, actionType: null, enemyAction, team, activeIdx,
          newEnemySa,
        });
      } else {
        const newTeam1 = [...team]; newTeam1[activeIdx] = playerPkm; setTeam(newTeam1);
        setBattle((b) => ({
          ...b, playerPkm, enemyPkm, metalCoatUsedThisTurn: false,
          enemySa: newEnemySa,
          phase: 'awaitingPlayerAttack',
          pendingDefense: { enemyAction },
        }));
      }
    } else {
      // ── Player went first → enemy counter-attacked → finalize ──
      _finalizeTurn({
        playerPkm, enemyPkm, playerFainted, enemyFainted: false,
        log: [], newTurnNum: (battle.turnNum ?? 0) + 1,
        metalCoatUsedThisTurn, sa, actionType: null, enemyAction, team, activeIdx,
        newEnemySa,
      });
    }
  }, [battle, team, activeIdx, playerClasses, stage, _finalizeTurn, saveAzaraoSnapshot]);

  /** Player passes their attack turn — gives initiative to the enemy. */
  const handlePassTurn = useCallback(() => {
    if (!battle) return;

    if (battle.phase === 'awaitingAction' && battle.playerGoesFirst) {
      // Player goes first but passes → enemy attacks, player still defends, turn ends
      const { enemyPkm, isBoss, turnNum, sa } = battle;
      const pClassKeys     = playerClasses.map((c) => c.powerKey);
      const ctnpcClassKeys = battle.ctnpcClassKeys ?? [];
      const videnVantagem  = pClassKeys.includes('vidente') && battle.videnteChoice === 'vantagem';
      const videnteDesvAdv = pClassKeys.includes('vidente') && battle.videnteChoice === 'desvantagem';
      const hipnosePenalty = (sa ?? {}).hipnosePending ? (stage >= 10 ? 20 : stage >= 7 ? 10 : 5) : 0;
      const bossIgnoreResist = isBoss && turnNum >= 1 && (turnNum - 1) % 4 === 0;
      const nerdVantagem   = pClassKeys.includes('nerd') && (() => {
        const eTypes = battle.enemyPkm?.types ?? [];
        return team.some((p, i) => i !== activeIdx && p && (p.types ?? []).some((t) => eTypes.includes(t)));
      })();
      const bardoLegVantagem = pClassKeys.includes('bardo') && isLegendary(team[activeIdx]?.nome ?? '');
      const enemyAction = enemyChooseAttack(enemyPkm, battle.playerPkm, ctnpcClassKeys);
      const eAtkOpts = {
        atkVantagem:     (sa ?? {}).soldadoEnemyCounterNext,
        atkDesvantagem:  videnteDesvAdv || (sa ?? {}).ilusionistaPending,
        finalAtkPenalty: hipnosePenalty + ((sa ?? {}).soldadoActive ? 10 : 0),
        pClassKeys, eClassKeys: ctnpcClassKeys,
        log: [], isBoss, bossIgnoreResist, turnNum,
        defVantagem: nerdVantagem || videnVantagem || bardoLegVantagem,
      };
      setPendingAtkType(null);
      setBattleLog((prev) => [...prev, `⏭️ ${team[activeIdx]?.nome ?? 'Pokémon'} passou a vez!`]);
      setBattle((b) => ({
        ...b,
        phase: 'awaitingDefense',
        pendingDefense: { enemyAction, playerFirst: true, eAtkOpts },
      }));

    } else if (battle.phase === 'awaitingPlayerAttack') {
      // Player passes second attack → finalize turn without attacking
      const { playerPkm, enemyPkm, isBoss, turnNum, sa } = battle;
      const log = [`⏭️ ${team[activeIdx]?.nome ?? 'Pokémon'} passou a vez!`];
      setPendingAtkType(null);
      _finalizeTurn({
        playerPkm, enemyPkm,
        playerFainted: false, enemyFainted: false,
        log, newTurnNum: turnNum + 1,
        metalCoatUsedThisTurn: battle.metalCoatUsedThisTurn ?? false,
        sa: sa ?? {},
        actionType: null, enemyAction: battle.pendingDefense?.enemyAction ?? 'atk',
        team, activeIdx,
        newEnemySa: battle.enemySa ?? {},
      });
    }
  }, [battle, team, activeIdx, playerClasses, stage, setPendingAtkType, setBattleLog, setBattle, _finalizeTurn]);

  /** Player's attack when enemy went first — no vel roll, player chooses type+stat now. */
  const handlePlayerSecondAttack = useCallback((actionType) => {
    if (!battle || battle.phase !== 'awaitingPlayerAttack') return;

    const pClassKeys     = playerClasses.map((c) => c.powerKey);
    const ctnpcClassKeys = battle.ctnpcClassKeys ?? [];
    const sa = battle.sa ?? {};
    const { isBoss, isCTNpc, turnNum } = battle;
    const bossIgnoreResist = isBoss && turnNum >= 1 && (turnNum - 1) % 4 === 0;

    // Consume CTnpc pending player-affecting flags
    const enemySa_b = battle.enemySa ?? {};
    const pAtkDesvantagem_e   = !!enemySa_b.ilusionistaPending_e;
    const pAtkVantagem_ctnpc  = !!enemySa_b.soldadoPlayerCounterNext;
    const pFinalAtkPenalty_e  = enemySa_b.hipnosePending_e ? (stage >= 10 ? 20 : stage >= 7 ? 10 : 5) : 0;
    const consumedEnemySa     = { ...enemySa_b, hipnosePending_e: false, ilusionistaPending_e: false, soldadoPlayerCounterNext: false };

    const mediumBonus    = pClassKeys.includes('medium') ? team.filter((p) => p.vidasAtual <= 0).length : 0;
    const bardoLegVantagem = pClassKeys.includes('bardo') && isLegendary(team[activeIdx]?.nome ?? '');
    const guardMisBonus    = pClassKeys.includes('guardiao_mis') && isLegendary(team[activeIdx]?.nome ?? '') ? 1 : 0;
    const videnVantagem  = pClassKeys.includes('vidente') && battle.videnteChoice === 'vantagem';
    const videnteDesvAdv = pClassKeys.includes('vidente') && battle.videnteChoice === 'desvantagem';
    const oficialBonus   = sa.oficialPending ? (stage >= 10 ? 12 : stage >= 6 ? 8 : 5) : 0;
    const nerdVantagem   = pClassKeys.includes('nerd') && (() => {
      const eTypes = battle.enemyPkm?.types ?? [];
      return team.some((p, i) => i !== activeIdx && p && (p.types ?? []).some((t) => eTypes.includes(t)));
    })();

    const pAtkVantagem   = nerdVantagem || videnVantagem || sa.soldadoActive || sa.bardoPending || bardoLegVantagem || pAtkVantagem_ctnpc || pClassKeys.includes('guerreiro_base');
    const pAtkDesvantagem = pAtkDesvantagem_e;
    const pExtraAtkDice  = mediumBonus + guardMisBonus + (sa.ocultismoPending ? 2 : 0) + (sa.sincronoPending ?? 0) + (sa.domadorActive && !isCTNpc && !isBoss ? 2 : 0);

    const log = [];
    let { playerPkm, enemyPkm, metalCoatUsedThisTurn } = battle;
    setPendingAtkType(null);

    const pAtkOpts = {
      atkVantagem: pAtkVantagem, atkDesvantagem: pAtkDesvantagem, extraAtkDice: pExtraAtkDice,
      finalAtkBonus: oficialBonus, finalAtkPenalty: pFinalAtkPenalty_e,
      selectedType: pendingAtkType, estilizarExtraType: sa.estilizarExtraType ?? null,
      pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss,
      defDesvantagem: videnteDesvAdv,
    };

    const eDefChoice = enemyChooseDefense(enemyPkm, actionType, ctnpcClassKeys);
    const rp = doAttack(playerPkm, actionType, enemyPkm, true, { ...pAtkOpts, defChoice: eDefChoice, metalCoatUsedThisTurn: metalCoatUsedThisTurn ?? false });
    playerPkm = rp.atk; enemyPkm = rp.def;
    if (rp.usedMC) metalCoatUsedThisTurn = true;
    let enemyFainted = rp.defFainted;

    // Golpe Duplo (Monge)
    if (!enemyFainted && sa.mongePending) {
      log.push(`👊 Golpe Duplo — segundo ataque!`);
      const eDefChoice2 = enemyChooseDefense(enemyPkm, actionType, ctnpcClassKeys);
      const rp2 = doAttack(playerPkm, actionType, enemyPkm, true, { extraAtkDice: mediumBonus, defChoice: eDefChoice2, pClassKeys, log, isBoss, metalCoatUsedThisTurn });
      playerPkm = rp2.atk; enemyPkm = rp2.def;
      if (rp2.defFainted) enemyFainted = true;
    }

    const enemyAction = battle.pendingDefense?.enemyAction ?? 'atk';
    _finalizeTurn({
      playerPkm, enemyPkm, playerFainted: false, enemyFainted,
      log, newTurnNum: (battle.turnNum ?? 0) + 1,
      metalCoatUsedThisTurn, sa, actionType, enemyAction, team, activeIdx,
      newEnemySa: consumedEnemySa,
    });
  }, [battle, team, activeIdx, playerClasses, stage, pendingAtkType, setPendingAtkType, _finalizeTurn]);

  /** Called when enemy has initiative — player defends at turn start, then attacks. */
  const handleEnemyFirstDefense = useCallback((defChoice) => {
    if (!battle || battle.phase !== 'awaitingAction' || battle.playerGoesFirst) return;
    const { pendingDefense, isBoss, turnNum } = battle;
    if (!pendingDefense) return;

    const { enemyAction } = pendingDefense;
    const pClassKeys = playerClasses.map((c) => c.powerKey);
    const ctnpcClassKeys = battle.ctnpcClassKeys ?? [];
    const sa = battle.sa ?? {};
    const log = [];
    let { playerPkm, enemyPkm } = battle;
    playerPkm = tickConditions(playerPkm);
    enemyPkm  = tickConditions(enemyPkm);

    let newEnemySa = { ...(battle.enemySa ?? {}) };
    const isCTNpc = battle.isCTNpc;
    const bossIgnoreResist = isBoss && turnNum >= 1 && (turnNum - 1) % 4 === 0;

    const videnteDesvAdv  = pClassKeys.includes('vidente') && battle.videnteChoice === 'desvantagem';
    const videnVantagem   = pClassKeys.includes('vidente') && battle.videnteChoice === 'vantagem';
    const bardoLegVantagem = pClassKeys.includes('bardo') && isLegendary(team[activeIdx]?.nome ?? '');
    const hipnosePenalty  = sa.hipnosePending ? (stage >= 10 ? 20 : stage >= 7 ? 10 : 5) : 0;
    const eAtkVantagem    = sa.soldadoEnemyCounterNext;
    const eAtkDesvantagem = videnteDesvAdv || sa.ilusionistaPending;
    const eFinalAtkPenalty = hipnosePenalty + (sa.soldadoActive ? 10 : 0);
    let eAtkOpts = { atkVantagem: eAtkVantagem, atkDesvantagem: eAtkDesvantagem, finalAtkPenalty: eFinalAtkPenalty, pClassKeys, log, isBoss, eClassKeys: ctnpcClassKeys, bossIgnoreResist, turnNum, defVantagem: videnVantagem || bardoLegVantagem };

    let mongePending = false;

    if (isCTNpc) {
      const ctnpcAction = decideCTNpcAction(enemyPkm, playerPkm, ctnpcClassKeys, newEnemySa);
      if (ctnpcAction) {
        const r = applyCTNpcSpecialAction(ctnpcAction, newEnemySa, enemyPkm, playerPkm, stage, log);
        newEnemySa = r.updatedSa; enemyPkm = r.enemyPkm; mongePending = r.mongePending;
        eAtkOpts = {
          ...eAtkOpts,
          atkVantagem: eAtkOpts.atkVantagem || r.atkVantagem,
          extraAtkDice: (eAtkOpts.extraAtkDice ?? 0) + r.extraAtkDice,
          finalAtkBonus: (eAtkOpts.finalAtkBonus ?? 0) + r.finalAtkBonus,
        };
      }
    }

    const re = doAttack(enemyPkm, enemyAction, playerPkm, false, { ...eAtkOpts, defChoice, metalCoatUsedThisTurn: false });
    enemyPkm = re.atk; playerPkm = re.def;
    let playerFainted = re.defFainted;

    // CTnpc Golpe Duplo — second attack
    if (mongePending && !playerFainted) {
      const re2 = doAttack(enemyPkm, enemyAction, playerPkm, false, { ...eAtkOpts, defChoice, metalCoatUsedThisTurn: false, atkVantagem: false, extraAtkDice: 0, finalAtkBonus: 0 });
      enemyPkm = re2.atk; playerPkm = re2.def;
      playerFainted = re2.defFainted;
    }

    setBattleLog((prev) => [...prev, ...log]);

    if (playerFainted) {
      _finalizeTurn({
        playerPkm, enemyPkm, playerFainted: true, enemyFainted: false,
        log: [], newTurnNum: (turnNum ?? 0) + 1,
        metalCoatUsedThisTurn: false, sa, actionType: null, enemyAction, team, activeIdx,
        newEnemySa,
      });
    } else {
      const newTeam2 = [...team]; newTeam2[activeIdx] = playerPkm; setTeam(newTeam2);
      setBattle((b) => ({
        ...b, playerPkm, enemyPkm, metalCoatUsedThisTurn: false,
        phase: 'awaitingPlayerAttack',
        pendingDefense: { enemyAction },
        enemySa: newEnemySa,
      }));
    }
  }, [battle, team, activeIdx, playerClasses, stage, _finalizeTurn]);

  /** Handle a special class action button press during battle. */
  const handleSpecialAction = useCallback((saKey) => {
    if (!battle || battle.phase !== 'awaitingAction') return;
    const sa = battle.sa ?? {};
    const isCTNpc = battle.isCTNpc;
    const isBoss  = battle.isBoss;

    const update = (patch, logMsg) => {
      setBattle((b) => ({ ...b, sa: { ...b.sa, ...patch } }));
      setBattleLog((prev) => [...prev, logMsg]);
    };

    switch (saKey) {
      case 'criar_pocao':
        if (sa.cientistUsed) return;
        setShowCientistModal(true);
        break;
      case 'hipnose':
        if ((sa.hipnosoCharges ?? 0) <= 0) return;
        update({ hipnosePending: true, hipnosoCharges: (sa.hipnosoCharges ?? 1) - 1 }, `💤 Hipnose ativada! Oponente sofre penalidade no próximo ataque.`);
        break;
      case 'oficial':
        if (sa.oficialUsed) return;
        update({ oficialPending: true, oficialUsed: true }, `📋 Comando! Bônus no próximo ataque de atributo.`);
        break;
      case 'ilusao':
        if (sa.ilusionistUsed) return;
        update({ ilusionistaPending: true, ilusionistUsed: true }, `🎭 Ilusão! Oponente terá desvantagem no próximo ataque.`);
        break;
      case 'rambo':
        if (sa.soldadoUsed) return;
        update({ soldadoActive: true, soldadoUsed: true }, `🪖 Rambo! Você ataca com vantagem. Oponente -10 atq, você +10 def este turno.`);
        break;
      case 'golpe_duplo':
        if (sa.mongeUsed) return;
        update({ mongePending: true, mongeUsed: true }, `👊 Golpe Duplo preparado! Você atacará duas vezes este turno.`);
        break;
      case 'inspiracao': {
        if (sa.bardoUsed) return;
        const isLegBardo = isLegendary(team[activeIdx]?.nome ?? '');
        if (isLegBardo) return; // bardo lendário tem vantagem sempre (passive via bardoLegVantagem)
        update({ bardoPending: true, bardoUsed: true }, `🎵 Inspiração! Próximo ataque com vantagem.`);
        break;
      }
      case 'escudo':
        if (sa.guardianUsed) return;
        setShowEscudoModal(true);
        break;
      case 'ocultismo': {
        if (sa.ocultistUsed) return;
        const isLegOcult = isLegendary(team[activeIdx]?.nome ?? '');
        if (isLegOcult) return; // ocultista lendário tem +2d sempre (passive via ocultismoLegBonus)
        update({ ocultismoPending: true, ocultistUsed: true }, `🔮 Ocultismo! +2d no próximo ataque.`);
        break;
      }
      case 'sincrono': {
        if (sa.sincronoUsed) return;
        const bonus = team.length;
        update({ sincronoPending: bonus, sincronoUsed: true }, `🔗 Síncrono! +${bonus}d no próximo ataque.`);
        break;
      }
      case 'elementalista': {
        if (elementalistaCooldown > 0 || sa.elementalistaActive) return;
        const elemCls = playerClasses.find((c) => c.powerKey === 'elementalista');
        const elemType = elemCls?.elementalistaType;
        if (!elemType) return;
        const activePkmElem = team[activeIdx];
        if (!activePkmElem) return;
        const curTypes = activePkmElem.tipos ?? activePkmElem.types ?? [];
        if (curTypes.length >= 3) {
          setBattleLog((prev) => [...prev, `🌀 Elementalista: ${activePkmElem.nome} já tem 3 tipos!`]);
          return;
        }
        if (curTypes.includes(elemType)) {
          setBattleLog((prev) => [...prev, `🌀 Elementalista: ${activePkmElem.nome} já possui o tipo ${elemType}!`]);
          return;
        }
        const newTypes = [...curTypes, elemType];
        const updatedPkmElem = { ...activePkmElem, tipos: newTypes, types: newTypes };
        setTeam((prev) => prev.map((p, i) => i === activeIdx ? updatedPkmElem : p));
        setBattle((b) => ({
          ...b,
          playerPkm: { ...b.playerPkm, tipos: newTypes, types: newTypes },
          sa: { ...b.sa, elementalistaActive: true },
        }));
        setBattleLog((prev) => [...prev, `🌀 Elementalista! ${elemType} adicionado ao ${activePkmElem.nome} por esta batalha.`]);
        setElementalistaCooldown(1);
        break;
      }
      case 'azarao': {
        if (!battleSnapshot || sa.azaraoUsed) return;
        // Restore state from snapshot
        setTeam(battleSnapshot.team);
        setBattle({ ...battleSnapshot.battle, sa: { ...battleSnapshot.battle.sa, azaraoUsed: true } });
        setBattleLog([...battleSnapshot.battleLog, `🎲 Azarão! Rolagem desfeita. +2d na próxima rolagem.`]);
        setAzaraoRerollBonus(2);
        setBattleSnapshot(null);
        return;
      }
      case 'domar': {
        if ((sa.domadorCharges ?? 0) <= 0) return;
        if (isCTNpc || isBoss) {
          setBattleLog((prev) => [...prev, `🐾 Domar só funciona contra selvagens!`]);
          return;
        }
        update(
          { domadorActive: true, domadorCharges: (sa.domadorCharges ?? 0) - 1 },
          `🐾 Domar! +2d no próximo ataque (${(sa.domadorCharges ?? 1) - 1} restante(s)).`,
        );
        break;
      }
      case 'empatico': {
        if (sa.empaticUsed) return;
        const playerPkm = battle.playerPkm;
        const enemyPkm  = battle.enemyPkm;
        const pDefEspDice = playerPkm.diceBase?.defEsp ?? 1;
        const eAtkEspDice = enemyPkm.diceBase?.atkEsp ?? 1;
        if (pDefEspDice > eAtkEspDice) {
          const newVidas = Math.min(playerPkm.vidasMax, playerPkm.vidasAtual + 1);
          setBattle((b) => ({
            ...b,
            playerPkm: { ...b.playerPkm, vidasAtual: newVidas },
            sa: { ...b.sa, empaticUsed: true },
          }));
          setBattleLog((prev) => [...prev, `💙 Empatia! DefEsp(${pDefEspDice}d) > AtkEsp inimigo(${eAtkEspDice}d) — recuperou 1 vida!`]);
        } else {
          setBattle((b) => ({ ...b, sa: { ...b.sa, empaticUsed: true } }));
          setBattleLog((prev) => [...prev, `💙 Empatia falhou — DefEsp não supera AtkEsp do oponente.`]);
        }
        break;
      }
      case 'raptar': {
        if ((sa.raptarCharges ?? 0) <= 0) return;
        if (!isCTNpc) {
          setBattleLog((prev) => [...prev, `🪝 Raptar só funciona contra Pokémon CTnpc!`]);
          return;
        }
        const raptarEnemyPkm  = battle.enemyPkm;
        const raptarPlayerPkm = battle.playerPkm;
        const ckRaptar        = playerClasses.map((c) => c.powerKey);
        const ctnpcClassKeysR = battle.ctnpcClassKeys ?? [];
        const newSaRaptar     = { ...sa, raptarCharges: (sa.raptarCharges ?? 0) - 1 };
        const raptarResult = attemptCaptureRoll(
          raptarEnemyPkm, { captureBonus: 0, name: 'Raptar' }, null, raptarPlayerPkm, ckRaptar,
          { playerAttacked: battle.playerAttackedThisBattle ?? false, playerWasAttacked: battle.playerWasAttackedThisBattle ?? false, turnNum: battle.turnNum ?? 0, stage, isCTNpc: true },
        );
        const raptarLog = [`🪝 Raptar! Captura [${raptarResult.rolls.join(',')}] vs Fuga [${raptarResult.escapeRolls.join(',')}] (${newSaRaptar.raptarCharges} tentativa(s) restante(s))`];
        if (raptarResult.success) {
          raptarLog.push(`✅ ${raptarEnemyPkm.nome} foi capturado pelo Raptar!`);
          setBattleLog((prev) => [...prev, ...raptarLog]);
          setBattle((b) => ({ ...b, sa: newSaRaptar, phase: 'captured', capturedPkm: raptarEnemyPkm }));
        } else {
          raptarLog.push(`❌ Raptar falhou! ${raptarEnemyPkm.nome} continua lutando e vai atacar!`);
          setBattleLog((prev) => [...prev, ...raptarLog]);
          const raptarEnemyAction = enemyChooseAttack(raptarEnemyPkm, raptarPlayerPkm, ctnpcClassKeysR);
          setBattle((b) => ({
            ...b, sa: newSaRaptar,
            phase: 'awaitingAction',
            playerGoesFirst: false,
            pendingDefense: { enemyAction: raptarEnemyAction, eAtkOpts: { pClassKeys: ckRaptar, log: [], isBoss: false, eClassKeys: ctnpcClassKeysR } },
          }));
        }
        break;
      }
      case 'estilizar': {
        if (sa.estilizarUsed || estilizarCooldown > 0) return;
        const randomType = TYPES[Math.floor(Math.random() * TYPES.length)];
        update({ estilizarExtraType: randomType, estilizarUsed: true },
          `🎨 Estilizar! Golpe ganha o tipo ${randomType} aleatoriamente!`);
        setEstilizarCooldown(2);
        break;
      }
      case 'forrageamento': {
        if (sa.aventureiroUsed) return;
        // Pick random berry
        const berryPool = ITEMS_DATA.filter((i) => i.category === 'fruta');
        const berry = berryPool[Math.floor(Math.random() * berryPool.length)];
        // 10% chance to also find a random consumible
        const consuPool = ITEMS_DATA.filter((i) => i.category === 'consumivel');
        const bonusConsumivel = Math.random() < 0.10 && consuPool.length > 0
          ? consuPool[Math.floor(Math.random() * consuPool.length)]
          : null;
        setBattle((b) => ({ ...b, sa: { ...b.sa, aventureiroUsed: true } }));
        setBattleLog((prev) => [...prev, `🌿 Forrageamento! Encontrou ${berry.name}${bonusConsumivel ? ` e ${bonusConsumivel.name}` : ''}!`]);
        // Try to equip berry as held item on active pokémon
        const activePkm = battle.playerPkm;
        if (activePkm) {
          const guiaHeldBonus = playerClasses.some((c) => c.powerKey === 'guia') ? 2 : 0;
          const maxHeldF = (playerClasses.some((c) => c.powerKey === 'virtuose') ? 2 : 1) + guiaHeldBonus + (activePkm.extraHeldSlots ?? 0);
          const currentHeld = Array.isArray(activePkm.heldItem) ? activePkm.heldItem : (activePkm.heldItem ? [activePkm.heldItem] : []);
          if (currentHeld.length < maxHeldF) {
            // Equip directly
            const newHeld = maxHeldF === 1 ? berry : [...currentHeld, berry];
            setBattle((b) => ({ ...b, playerPkm: { ...b.playerPkm, heldItem: newHeld } }));
            setTeam((prev) => prev.map((p, idx) => idx === activeIdx ? { ...p, heldItem: newHeld } : p));
            setBattleLog((prev) => [...prev, `🫐 ${berry.name} equipada em ${activePkm.nome}!`]);
          } else {
            // No slot: store pending so UI can resolve
            setPendingForrageamento({ berry, consumivel: bonusConsumivel });
            break;
          }
        }
        // Add consumivel to inventory if any
        if (bonusConsumivel) {
          const mochilaBonus = (inventory.consumiveis?.mochila ?? 0) * 2;
          const guiaBonus = playerClasses.some((c) => c.powerKey === 'guia') ? 2 : 0;
          const maxInvSlots = 5 + mochilaBonus + guiaBonus;
          const curItems = Object.values(inventory.consumiveis ?? {}).reduce((s, q) => s + (q > 0 ? 1 : 0), 0)
                         + Object.values(inventory.frutas ?? {}).reduce((s, q) => s + (q > 0 ? 1 : 0), 0)
                         + Object.values(inventory.held ?? {}).reduce((s, q) => s + (q > 0 ? 1 : 0), 0);
          if (curItems < maxInvSlots) {
            setInventory((inv) => ({
              ...inv,
              consumiveis: { ...inv.consumiveis, [bonusConsumivel.id]: (inv.consumiveis[bonusConsumivel.id] ?? 0) + 1 },
            }));
            setBattleLog((prev) => [...prev, `🎁 ${bonusConsumivel.name} adicionado ao inventário!`]);
          } else {
            setBattleLog((prev) => [...prev, `⚠️ Inventário cheio — ${bonusConsumivel.name} descartado!`]);
          }
        }
        break;
      }
      case 'tutoria': {
        if (sa.tutorUsed) return;
        const inactives = team.filter((_, i) => i !== activeIdx && team[i]?.vidasAtual > 0);
        if (inactives.length === 0) {
          setBattleLog((prev) => [...prev, `📚 Tutoria: nenhum pokémon inativo disponível!`]);
          return;
        }
        setPendingTutoria(true);
        break;
      }
      default:
        break;
    }
  }, [battle, team, activeIdx, playerClasses, stage, estilizarCooldown, elementalistaCooldown, battleSnapshot, setPendingTutoria]);

  /** Attempt to capture the enemy Pokémon with a selected ball. */
  const handleCapture = useCallback((ballId) => {
    if (!battle || !battle.canCapture) return;
    const ballDef = ITEMS_DATA.find((i) => i.id === ballId);
    if (!ballDef) return;
    const count = inventory.pokebolas[ballId] ?? 0;
    if (count <= 0) return;
    saveAzaraoSnapshot();

    // Consume ball
    setInventory((inv) => ({
      ...inv,
      pokebolas: { ...inv.pokebolas, [ballId]: Math.max(0, (inv.pokebolas[ballId] ?? 1) - 1) },
    }));

    const { enemyPkm } = battle;
    const activeBallmod = battle.selectedBallmod ?? null;
    const ck = playerClasses.map((c) => c.powerKey);
    const result = attemptCaptureRoll(
      enemyPkm, ballDef, activeBallmod, team[activeIdx], ck,
      {
        playerAttacked: battle.playerAttackedThisBattle ?? false,
        playerWasAttacked: battle.playerWasAttackedThisBattle ?? false,
        turnNum: battle.turnNum ?? 0,
        stage,
      }
    );

    // Consume ballmod if used
    if (activeBallmod) {
      setInventory((inv) => ({
        ...inv,
        ballmods: { ...inv.ballmods, [activeBallmod.id]: Math.max(0, (inv.ballmods[activeBallmod.id] ?? 1) - 1) },
      }));
      setBattle((b) => b ? { ...b, selectedBallmod: null } : b);
    }

    const ballmodLabel = activeBallmod ? ` + ${activeBallmod.name}` : '';
    const log = [`🎯 Jogou ${ballDef.name}${ballmodLabel}! Captura [${result.rolls.join(',')}] vs Fuga [${result.escapeRolls.join(',')}]`];

    if (result.success) {
      log.push(`✅ ${enemyPkm.nome} foi capturado!`);
      setBattleLog((prev) => [...prev, ...log]);
      setBattle((b) => ({ ...b, phase: 'captured', capturedPkm: enemyPkm, capturedBallmodId: activeBallmod?.id ?? null }));
    } else {
      const hasCacador = ck.includes('cacador_tre');
      if (hasCacador) {
        log.push(`❌ Captura falhou! ${enemyPkm.nome} não pode fugir (Cyber Caçador).`);
        setBattleLog((prev) => [...prev, ...log]);
        const enemyAction = enemyChooseAttack(enemyPkm, battle.playerPkm);
        handlePlayerAction(enemyAction);
      } else {
        log.push(`❌ Captura falhou! ${enemyPkm.nome} fugiu!`);
        setBattleLog((prev) => [...prev, ...log]);
        setBattle((b) => ({ ...b, phase: 'result_flee' }));
      }
    }
  }, [battle, inventory, team, activeIdx, playerClasses, handlePlayerAction, saveAzaraoSnapshot]);

  /** Accept a class reward (stages 3/5/8) and add it to playerClasses. */
  const handleAcceptClassReward = useCallback(() => {
    const cls = battle?.classRewardCls;
    if (!cls) return;

    // Classes that require a choice before accepting — block if choice not made
    const needsAtribChoice = cls.powerKey === 'especialista';
    const needsTypeChoice  = cls.powerKey === 'elementalista';
    const needsVidente     = cls.powerKey === 'vidente';
    if ((needsAtribChoice || needsTypeChoice || needsVidente) && !classChoiceData) return;

    // Build levelBaselines snapshot from current team
    const levelBaselines = {};
    team.forEach((p) => { levelBaselines[p.uid] = p.level; });

    // Enrich class entry with baselines + choice data
    const enrichedCls = {
      ...cls,
      levelBaselines,
      ...(needsAtribChoice ? { especialistaAtrib: classChoiceData.atrib }   : {}),
      ...(needsTypeChoice  ? { elementalistaType: classChoiceData.type }    : {}),
    };

    // ── "Ao escolher" effects ──────────────────────────────
    // vidente: set run-level choice
    if (needsVidente) {
      setVidenteChoice(classChoiceData.vidente);
    }

    // pactuario: +2 vidasMax to legendaries, +1 to others
    if (cls.powerKey === 'pactuario') {
      setTeam((prev) => prev.map((p) => {
        const bonus = isLegendary(p.nome) ? 2 : 1;
        return { ...p, vidasMax: p.vidasMax + bonus, vidasAtual: Math.min(p.vidasAtual + bonus, p.vidasMax + bonus) };
      }));
    }

    // parrudo: +1 vidasMax + vidasAtual to all team pokémon
    if (cls.powerKey === 'parrudo') {
      setTeam((prev) => prev.map((p) => ({
        ...p,
        vidasMax:   p.vidasMax   + 1,
        vidasAtual: Math.min(p.vidasAtual + 1, p.vidasMax + 1),
      })));
    }

    // professor: +1 slot (handled via maxTeamSize) + random Kanto starter at highest team level
    if (cls.powerKey === 'professor') {
      const maxLevel = Math.max(...team.map((p) => p.level), 1);
      const starterNames = PROFESSOR_STARTER_NAMES;
      const species = starterNames
        .map((n) => pokedexData.find((p) => p.nome === n))
        .filter(Boolean);
      const picked = species[Math.floor(Math.random() * species.length)];
      if (picked) {
        const newPkm = generateJNPokemon(picked, maxLevel, { context: 'player' });
        setTeam((prev) => {
          const curMax = 2
            + (playerClasses.some((c) => c.powerKey === 'captor_base')  ? 1 : 0)
            + (playerClasses.some((c) => c.powerKey === 'colecionador') ? 1 : 0)
            + 1; // +1 from professor being added
          if (prev.length >= curMax) return prev;
          return [...prev, { ...newPkm, context: 'player', vidasAtual: newPkm.vidasMax, conditions: [] }];
        });
        // Also update levelBaselines for the new pkm in enrichedCls
        enrichedCls.levelBaselines[newPkm.uid] = newPkm.level;
      }
    }

    // engenheiro_cap: trigger per-pokémon attribute selection
    if (cls.powerKey === 'engenheiro_cap') {
      const pending = team.map((p) => ({
        uid:   p.uid,
        nome:  p.nome,
        types: p.types ?? [],
        slots: (p.types ?? []).some((t) => t === 'Elétrico' || t === 'Metal') ? 2 : 1,
        dicesPerSlot: (p.types ?? []).some((t) => t === 'Elétrico' || t === 'Metal') ? 2 : 1,
      }));
      const initMap = {};
      pending.forEach((p) => { initMap[p.uid] = []; });
      setEngineerChoicePending(pending);
      setEngineerChoiceMap(initMap);
    }

    // artifice: trigger item creation choice
    if (cls.powerKey === 'artifice') {
      setArtificeCredits((c) => c + 1);
    }

    setPlayerClasses((prev) => [...prev, enrichedCls]);
    if (cls.powerKey === 'cozinheiro') setCozinheiroCharges(3);
    if (cls.powerKey === 'cuidador')   setCuidadorCharges(3);
    setClassChoiceData(null);
    setBattle((b) => ({
      ...b,
      phase: cls.powerKey === 'engenheiro_cap' ? 'engineer_choice'
           : cls.powerKey === 'artifice'       ? 'artifice_choice'
           : 'result_win',
      classRewardCls: null,
    }));
  }, [battle, team, playerClasses, classChoiceData, videnteChoice]);

  /** Apply artífice armor/sword bonus to a chosen pokémon. */
  const handleApplyArtificeChoice = useCallback((uid, itemType) => {
    setTeam((prev) => prev.map((p) => {
      if (p.uid !== uid) return p;
      const cur = p.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 };
      const newBonus = itemType === 'armadura'
        ? { ...cur, def: (cur.def ?? 0) + 1, defEsp: (cur.defEsp ?? 0) + 1 }
        : { ...cur, atk: (cur.atk ?? 0) + 1, atkEsp: (cur.atkEsp ?? 0) + 1 };
      return { ...p, diceBonus: newBonus };
    }));
    setArtificeEquipped((prev) => ({ ...prev, [uid]: itemType }));
    setArtificeCredits((c) => Math.max(0, c - 1));
    setArtificeSelected({ uid: null, item: null });
  }, []);

  /** Apply engenheiro_cap attribute dice choices to team pokémon. */
  const handleApplyEngineerChoices = useCallback((choiceMap) => {
    // choiceMap: { [uid]: ['atk', 'def', ...] } — list of chosen atribs per pokémon
    setTeam((prev) => prev.map((p) => {
      const chosen = choiceMap[p.uid] ?? [];
      if (chosen.length === 0) return p;
      const isElecMetal = (p.types ?? []).some((t) => t === 'Elétrico' || t === 'Metal');
      const dicesPerSlot = isElecMetal ? 2 : 1;
      const newDiceBonus = { ...(p.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 }) };
      chosen.forEach((key) => { newDiceBonus[key] = (newDiceBonus[key] ?? 0) + dicesPerSlot; });
      return { ...p, diceBonus: newDiceBonus };
    }));
    setEngineerChoicePending(null);
    setBattle((b) => ({ ...b, phase: 'result_win' }));
  }, []);

  /** Save the attribute distribution draft: apply to stats/diceBase, deduct pontosAtrib. */
  const handleSaveAtribDraft = useCallback(() => {
    const pkm = battle?.playerPkm ?? team[activeIdx];
    if (!pkm || draftForUid !== pkm.uid) return;
    const totalUsed = Object.values(atribDraft).reduce((s, v) => s + v, 0);
    if (totalUsed === 0) return;
    const STAT_KEYS = ['atk', 'def', 'atkEsp', 'defEsp', 'vel'];
    const newStats    = { ...pkm.stats };
    const newDiceBase = { ...pkm.diceBase };
    for (const key of STAT_KEYS) {
      newStats[key]    = (pkm.stats?.[key]    ?? 0) + (atribDraft[key] ?? 0);
      newDiceBase[key] = Math.max(1, Math.floor(newStats[key] / 2));
    }
    const newPkm = {
      ...pkm,
      stats:       newStats,
      diceBase:    newDiceBase,
      pontosAtrib: Math.max(0, (pkm.pontosAtrib ?? 0) - totalUsed),
    };
    setTeam((prev) => prev.map((p) => p.uid === pkm.uid ? newPkm : p));
    if (battle?.playerPkm?.uid === pkm.uid) setBattle((b) => ({ ...b, playerPkm: newPkm }));
    setAtribDraft({ atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 });
    setDraftForUid(null);
  }, [battle, team, activeIdx, atribDraft, draftForUid]);

  /** Discard the attribute distribution draft. */
  const handleRedoAtribDraft = useCallback(() => {
    setAtribDraft({ atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 });
    setDraftForUid(null);
  }, []);

  /** Player picks one of 3 items from the miniboss reward screen. */
  const handleMinibossItemChoice = useCallback((item) => {
    if (!item) return;
    const INV_MAP = { pokeball:'pokebolas', consumivel:'consumiveis', fruta:'frutas', held:'held', ballmod:'ballmods' };
    const key = INV_MAP[item.category];
    if (key) {
      setInventory((inv) => ({
        ...inv,
        [key]: { ...inv[key], [item.id]: (inv[key]?.[item.id] ?? 0) + 1 },
      }));
    }
    setBattleLog((prev) => [...prev, `🎁 Recompensa do Miniboss: ${item.name} obtido!`]);
    setBattle((b) => ({ ...b, phase: 'result_win', minibossItems: null }));
  }, [setInventory, setBattleLog, setBattle]);

  /** Switch to another alive Pokémon mid-battle. */
  const handleBattleSwitch = useCallback((idx) => {
    if (!battle || battle.phase !== 'switchPokemon') return;
    const pkm = team[idx];
    if (!pkm || pkm.vidasAtual <= 0) return;
    setActiveIdx(idx);
    const pClassKeys = playerClasses.map((c) => c.powerKey);
    const velLog = [];
    const playerGoesFirst = rollVelInitiative({ ...pkm }, { ...battle.enemyPkm }, pClassKeys, velLog);
    setBattle((b) => ({
      ...b,
      playerPkm: { ...pkm },
      playerGoesFirst,
      pendingDefense: !playerGoesFirst
        ? { enemyAction: enemyChooseAttack({ ...battle.enemyPkm }, { ...pkm }), playerFirst: false }
        : null,
      phase: 'awaitingAction',
      metalCoatUsedThisTurn: false,
    }));
    setBattleLog((prev) => [...prev, `🔄 ${pkm.nome} entrou em batalha!`, ...velLog]);
  }, [battle, team, playerClasses]);

  // ═══════════════════════════════════════════════════════════
  // CONTEXT PASSED DOWN TO RENDER FUNCTIONS (Parts 5–7)
  // ═══════════════════════════════════════════════════════════
  const ctx = {
    // state
    phase, currentUser, passwordInput, loginError, guestName,
    showGuestInput, gameMode, playerClasses, classGroupIdx,
    starterOptions, team, activeIdx, stage, money, inventory,
    runStats, stageEncounters, visitedEncounters, currentEncounter,
    battle, battleLog, battleLogRef, rankingData, showRanking,
    capturedInEncounter,
    // setters
    setPasswordInput, setGuestName, setShowGuestInput,
    setClassGroupIdx, setActiveIdx, setShowRanking, setBattle,
    setBattleLog, setTeam, setRunStats,
    // handlers
    handleLogin, handleSelectMode, handleSelectClass,
    handleSelectStarter, handleSelectEncounter,
    handleEncounterComplete, handleStageComplete,
    handleAddToTeam, handleSwapActive,
    handleUseItem, handleBuyItem, handleEquipItem,
    handleEndRun, handleReturnToLogin,
    // battle
    initBattle, handlePlayerAction, handleCapture, handleBattleSwitch,
    handleAcceptClassReward,
    handleApplyEngineerChoices,
    engineerChoicePending,
    handleApplyArtificeChoice,
    artificeEquipped, artificeCredits, artificeSelected, setArtificeSelected,
    pendingBallmodReward, setPendingBallmodReward,
    pendingBandidoReward, setPendingBandidoReward,
    pendingForrageamento, setPendingForrageamento,
    hasClassPower, classKeys,
    videnteChoice,
    onExit,
  };

  // ── Auto-init battle when phase switches to 'battle' ────────
  useEffect(() => {
    if (phase === 'battle' && currentEncounter && !battle) {
      initBattle(currentEncounter);
    }
  }, [phase, currentEncounter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // Part 5: Render Functions — Pre-game screens
  // ============================================================

  // ── Ranking overlay ──────────────────────────────────────────
  const renderRanking = () => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-yellow-400 text-2xl font-bold">🏆 Ranking</h2>
          <button onClick={() => setShowRanking(false)} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>
        {GAME_MODES.map((mode) => {
          const list = rankingData[mode.id] ?? [];
          return (
            <div key={mode.id} className="mb-4">
              <h3 className="text-white font-bold mb-2">{mode.name}</h3>
              {list.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhuma partida ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {list.map((e, i) => (
                    <div key={i} className={`rounded-xl p-3 ${i === 0 ? 'bg-yellow-900/30 border border-yellow-600' : 'bg-gray-800/60 border border-gray-700'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${i === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>#{i + 1}</span>
                          <span className={`font-bold ${i === 0 ? 'text-yellow-300' : 'text-white'}`}>{e.name}</span>
                          {e.won && <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold">VITÓRIA</span>}
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${i === 0 ? 'text-yellow-400' : 'text-white'}`}>{e.score?.toLocaleString()}</p>
                          <p className="text-gray-500 text-xs">Est.{e.stages} · {e.date}</p>
                        </div>
                      </div>
                      {e.team && e.team.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {e.team.map((p, pi) => (
                            <div key={pi} className="relative flex flex-col items-center">
                              <div className="relative">
                                {p.isShiny && (
                                  <img src="/jn/sparlkeshin.png" alt="shiny" onError={safeImg}
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                                )}
                                <img src={p.imageUrl ?? getPokemonImageUrl(p.dexNumber, false)}
                                  alt={p.nome} onError={safeImg}
                                  className="relative z-10 w-10 h-10 object-contain" />
                              </div>
                              <p className="text-gray-400 text-xs leading-none">Nv.{p.level}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Keyword highlight renderer ────────────────────────────────
  const renderDescWithKeywords = (text) => {
    if (!text) return null;
    const keywords = Object.keys(KEYWORDS_DICT).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => {
      const lp = part.toLowerCase();
      if (KEYWORDS_DICT[lp]) {
        return (
          <span key={i} className="text-yellow-300 underline decoration-dotted cursor-pointer hover:text-yellow-200"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.target.getBoundingClientRect();
              setActiveKeyword(activeKeyword?.word === lp ? null : { word: lp, rect });
            }}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // ── Enciclopédia JN ──────────────────────────────────────────
  const renderEnciclopedia = () => {
    const tabs = [
      { id:'classes', label:'📚 Classes' },
      { id:'tipos',   label:'🔥 Tipos' },
      { id:'itens',   label:'🎒 Itens' },
      { id:'locais',  label:'📍 Locais' },
    ];

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        onClick={() => { setShowEnciclopedia(false); setActiveKeyword(null); }}>
        <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-700"
          onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 shrink-0">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">📖 Enciclopédia JN</h2>
            <button onClick={() => { setShowEnciclopedia(false); setActiveKeyword(null); }}
              className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 shrink-0">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setEnciclopediaTab(t.id)}
                className={`flex-1 py-2 text-sm font-bold transition-colors
                  ${enciclopediaTab === t.id ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 relative" onClick={() => setActiveKeyword(null)}>

            {/* Keyword tooltip */}
            {activeKeyword && (
              <div className="sticky top-0 z-10 bg-yellow-900/95 border border-yellow-600 rounded-lg px-3 py-2 mb-3 text-sm text-yellow-100"
                onClick={(e) => e.stopPropagation()}>
                <span className="font-bold text-yellow-300">{activeKeyword.word}</span>
                {' — '}{KEYWORDS_DICT[activeKeyword.word]}
                <button className="ml-2 text-yellow-400 hover:text-white text-xs" onClick={() => setActiveKeyword(null)}>✕</button>
              </div>
            )}

            {/* Classes tab */}
            {enciclopediaTab === 'classes' && (
              <div className="flex flex-col gap-4">
                {CLASSES_DATA.map((group) => (
                  <div key={group.groupId}>
                    <p className="text-yellow-400 font-bold text-sm uppercase tracking-wide mb-2">
                      {group.icon} Grupo {group.groupName}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {group.classes.map((cls) => (
                        <div key={cls.id} className="bg-gray-800 rounded-lg px-3 py-2">
                          <p className="text-white font-bold text-sm mb-0.5">
                            {cls.name}
                            {cls.isBase && <span className="ml-2 text-xs text-blue-400 font-normal">(base)</span>}
                          </p>
                          <p className="text-gray-300 text-xs leading-relaxed">
                            {renderDescWithKeywords(cls.powerDesc)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tipos tab */}
            {enciclopediaTab === 'tipos' && (
              <div className="grid grid-cols-1 gap-2">
                {TYPE_DESCRIPTIONS.map((t) => (
                  <div key={t.name} className="bg-gray-800 rounded-lg px-3 py-2 flex gap-3 items-start">
                    <span className="text-xl shrink-0">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm mb-0.5" style={{ color: t.color }}>{t.name}</p>
                      <p className="text-gray-300 text-xs leading-relaxed">
                        {renderDescWithKeywords(t.desc)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Itens tab */}
            {enciclopediaTab === 'itens' && (() => {
              const byCategory = {};
              ITEMS_DATA.forEach((item) => {
                const cat = item.category ?? 'outros';
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push(item);
              });
              const catLabels = {
                consumivel:'🧪 Consumíveis', ballmod:'⚾ Ballmods', held:'💎 Held Items',
                fruta:'🍒 Frutas', puffin:'🍬 Puffins', suco:'🥤 Sucos', outros:'📦 Outros',
              };
              return (
                <div className="flex flex-col gap-4">
                  {Object.entries(byCategory).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-yellow-400 font-bold text-sm uppercase tracking-wide mb-2">
                        {catLabels[cat] ?? cat}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {items.map((item) => (
                          <div key={item.id} className="bg-gray-800 rounded-lg px-3 py-2 flex gap-2 items-start">
                            {item.img && (
                              <img src={item.img} alt={item.name} className="w-6 h-6 object-contain shrink-0"
                                onError={(e) => { e.target.style.display='none'; }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-bold text-sm mb-0.5">{item.name}</p>
                              <p className="text-gray-300 text-xs leading-relaxed">
                                {renderDescWithKeywords(item.desc)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Locais tab */}
            {enciclopediaTab === 'locais' && (
              <div className="flex flex-col gap-2">
                {LOCATIONS_DATA.map((loc) => (
                  <div key={loc.name} className="bg-gray-800 rounded-lg px-3 py-2 flex gap-3 items-start">
                    <span className="text-xl shrink-0">{loc.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm mb-0.5">{loc.name}</p>
                      <p className="text-gray-300 text-xs leading-relaxed">
                        {renderDescWithKeywords(loc.desc)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  };

  // ── Login Screen ─────────────────────────────────────────────
  const renderLogin = () => (
    <div className="min-h-screen flex flex-col items-center justify-center relative"
      style={{ backgroundImage:"url('/pokesitebg1.png')", backgroundSize:'cover', backgroundPosition:'center' }}>
      {showRanking && renderRanking()}
      <div className="bg-black/70 rounded-2xl p-8 flex flex-col items-center gap-5 w-full max-w-sm mx-4 backdrop-blur">
        <img src="/jn/logojn.png" alt="JN" className="w-44 h-auto"
          onError={(e) => { e.target.style.display='none'; }} />

        <p className="text-gray-300 text-sm">Escolha seu treinador</p>

        <div className="grid grid-cols-2 gap-3 w-full">
          {JN_USERS.filter((u) => !u.isGuest).map((u) => (
            <button key={u.username} onClick={() => setCurrentUser(u)}
              className={`py-2 px-3 rounded-lg font-bold text-white text-sm transition-all hover:scale-105
                ${currentUser?.username === u.username ? 'ring-2 ring-white scale-105' : 'opacity-80'}`}
              style={{ backgroundColor: u.color }}>
              {u.username}
            </button>
          ))}
        </div>

        {currentUser && !currentUser.isGuest && (
          <>
            <input type="password" placeholder="Senha..." value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin(currentUser)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-blue-400 text-sm" />
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button onClick={() => handleLogin(currentUser)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-sm">
              Entrar ▶
            </button>
          </>
        )}

        <div className="flex items-center gap-3 w-full">
          <hr className="flex-1 border-gray-700" />
          <span className="text-gray-500 text-xs">ou</span>
          <hr className="flex-1 border-gray-700" />
        </div>

        <button onClick={() => handleLogin({ username: 'Visitante', color: '#6B7280', isGuest: true })}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors text-sm">
          👤 Visitante
        </button>

        <div className="flex gap-4 mt-1">
          <button onClick={() => setShowRanking(true)}
            className="text-yellow-400 hover:text-yellow-300 text-xs underline">🏆 Ranking</button>
          {onExit && (
            <button onClick={onExit}
              className="text-gray-500 hover:text-gray-300 text-xs">← Niaypeta Corp</button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Mode Select Popup ────────────────────────────────────────
  const renderModeSelect = () => (
    <div className="min-h-screen flex items-center justify-center relative"
      style={{ backgroundImage:"url('/pokesitebg1.png')", backgroundSize:'cover', backgroundPosition:'center' }}>
      <div className="bg-black/80 rounded-2xl p-8 flex flex-col items-center gap-6 max-w-md w-full mx-4 backdrop-blur">
        <img src="/jn/logojn.png" alt="JN" className="w-36 h-auto"
          onError={(e) => { e.target.style.display='none'; }} />
        <h2 className="text-white text-xl font-bold">Olá, {currentUser?.username}!</h2>
        <p className="text-gray-400 text-sm">Escolha o modo de jogo:</p>
        <div className="flex flex-col gap-3 w-full">
          {GAME_MODES.map((mode) => {
            const wip = mode.id === 'jornada' || mode.id === 'endless';
            return (
              <button key={mode.id} onClick={() => !wip && handleSelectMode(mode.id)}
                disabled={wip}
                className={`w-full py-3 px-4 rounded-xl border text-left transition-all group relative
                  ${wip
                    ? 'bg-gray-800/40 border-gray-700 cursor-not-allowed opacity-50'
                    : 'bg-gray-800 hover:bg-gray-700 border-gray-600 hover:border-yellow-400 cursor-pointer'}`}>
                <span className={`font-bold ${wip ? 'text-gray-500' : 'text-white group-hover:text-yellow-400'}`}>
                  {mode.name}
                </span>
                <span className="text-gray-400 text-sm ml-3">{mode.desc}</span>
                {wip && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">
                    Em breve
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button onClick={handleReturnToLogin} className="text-gray-500 hover:text-gray-300 text-xs">← Voltar</button>
      </div>
    </div>
  );

  // ── Class Select ─────────────────────────────────────────────
  const renderClassSelect = () => {
    // Only base classes are available at game start
    const baseClasses = CLASSES_DATA.map((g) => ({
      group: g,
      cls:   g.classes.find((c) => c.isBase),
    })).filter((x) => x.cls);

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center py-8 px-4">
        <h1 className="text-yellow-400 text-2xl font-bold mb-1">Escolha sua Cyber Classe Base</h1>
        <p className="text-gray-400 text-sm mb-1">Modo: <strong className="text-white">{gameMode?.name}</strong></p>
        <p className="text-gray-500 text-xs mb-6">Classes avançadas são desbloqueadas ao longo da jornada.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl w-full">
          {baseClasses.map(({ group: g, cls }) => (
            <button key={cls.id} onClick={() => handleSelectClass(cls)}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-yellow-400 rounded-xl p-4 text-left transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{g.icon}</span>
                <div>
                  <p className="text-white font-bold text-sm group-hover:text-yellow-400">{cls.name}</p>
                  <p className="text-gray-500 text-xs">{g.groupName}</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs leading-snug">{cls.powerDesc}</p>
            </button>
          ))}
        </div>

        <button onClick={handleReturnToLogin} className="mt-8 text-gray-500 hover:text-gray-300 text-xs">← Voltar</button>
      </div>
    );
  };

  // ── Starter Select ───────────────────────────────────────────
  const renderStarterSelect = () => (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center py-8 px-4">
      <h1 className="text-yellow-400 text-2xl font-bold mb-1">Escolha seu Starter</h1>
      <p className="text-gray-400 text-sm mb-2">
        Classe: <strong className="text-white">{playerClasses[0]?.name}</strong> — {playerClasses[0]?.powerDesc}
      </p>
      <p className="text-gray-500 text-xs mb-8">Escolha 1 dos {starterOptions.length} Pokémon disponíveis (Nv. 1):</p>

      <div className="flex flex-wrap gap-4 justify-center">
        {starterOptions.map((pkm) => (
          <div key={pkm.uid} className="w-40">
            <PkmCard pkm={pkm} onClick={() => handleSelectStarter(pkm)} />
            <div className="mt-2 text-center text-xs text-gray-400 space-y-0.5">
              <p>Atk:{pkm.diceBase.atk}d / AEsp:{pkm.diceBase.atkEsp}d</p>
              <p>Def:{pkm.diceBase.def}d / DEsp:{pkm.diceBase.defEsp}d</p>
              <p>Vel:{pkm.diceBase.vel}d</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setPhase('classSelect')} className="mt-8 text-gray-500 hover:text-gray-300 text-xs">← Voltar</button>
    </div>
  );

  // ============================================================
  // Part 6: Render Functions — Game Layout
  // ============================================================

  // ── Encounter type metadata ──────────────────────────────────
  const ENC_META = {
    [ENCOUNTER_TYPES.SELVAGEM]:   { label:'Selvagem',    img:'/jn/selvagemimg.png',   color:'text-green-400'  },
    [ENCOUNTER_TYPES.TREINADOR]:  { label:'Treinador',   img:'/jn/trainerimg.png',    color:'text-blue-400'   },
    [ENCOUNTER_TYPES.MINIBOSS]:   { label:'Mini-Boss',   img:'/jn/trainerimg.png',    color:'text-orange-400' },
    [ENCOUNTER_TYPES.BOSS]:       { label:'Boss',        img:'/jn/trainerimg.png',    color:'text-red-400'    },
    [ENCOUNTER_TYPES.POKEMART]:   { label:'Pokémart',    img:'/jn/martimg.png',       color:'text-yellow-400' },
    [ENCOUNTER_TYPES.POKECENTER]: { label:'Pokécenter',  img:'/jn/pokecenterimg.png', color:'text-pink-400'   },
  };

  // ── TOP: Stage Map & Location Selection ─────────────────────
  const renderMapTop = () => {
    const isSpecial     = SPECIAL_STAGES.has(stage);
    const hasCavaleiro  = playerClasses.some((c) => c.powerKey === 'cavaleiro');
    const stageMax      = gameMode?.stageCount === Infinity ? '∞' : ((gameMode?.stageCount ?? 12) - 1);
    const normalMaxVisits = hasCavaleiro ? 3 : 2;
    return (
      <div className="relative w-full overflow-hidden rounded-t-xl"
        style={{ backgroundImage:"url('/jn/bgpath.png')", backgroundSize:'cover', backgroundPosition:'center', minHeight:'200px' }}>
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 p-4 flex flex-col gap-3">
          {/* Stage header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-yellow-400 font-bold text-lg">Estágio {stage}</span>
              <span className="text-gray-400 text-sm ml-2">/ {stageMax}</span>
              {isSpecial && <span className="ml-2 text-red-400 text-xs font-bold uppercase">Especial</span>}
            </div>
            <div className="text-right">
              <p className="text-yellow-300 font-bold text-sm">💰 {money}</p>
              <p className="text-gray-400 text-xs">{visitedEncounters.length}/{isSpecial ? 1 : normalMaxVisits} encontros</p>
            </div>
          </div>

          {/* Location cards */}
          <div className="flex gap-3 flex-wrap justify-center">
            {stageEncounters.map((enc, i) => {
              const visited = visitedEncounters.includes(i);
              const meta    = ENC_META[enc.type] ?? { label: enc.type, img: '', color: 'text-white' };
              const maxVisits = isSpecial ? 1 : normalMaxVisits;
              const canVisit  = !visited && visitedEncounters.length < maxVisits;
              // Detetive: show enemy types for non-boss encounters
              const hasDetetive = playerClasses.some((c) => c.powerKey === 'detetive');
              const encTypes = hasDetetive && enc.type !== ENCOUNTER_TYPES.BOSS && enc.enemy?.length > 0
                ? [...new Set(enc.enemy.flatMap((ep) => ep.types ?? []))]
                : [];
              return (
                <button key={i} disabled={!canVisit} onClick={() => handleSelectEncounter(i)}
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all
                    ${visited
                      ? 'border-gray-700 bg-black/40 opacity-40 cursor-not-allowed'
                      : canVisit
                        ? 'border-gray-500 bg-black/50 hover:border-yellow-400 hover:scale-105 cursor-pointer'
                        : 'border-gray-700 bg-black/40 opacity-50 cursor-not-allowed'}`}>
                  <img src={meta.img} alt={meta.label} onError={safeImg} className="w-12 h-12 object-contain" />
                  <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                  {encTypes.length > 0 && (
                    <span className="text-xs text-cyan-300 font-semibold">{encTypes.join('/')}</span>
                  )}
                  {visited && <span className="text-gray-500 text-xs">✓ Visitado</span>}
                </button>
              );
            })}
          </div>

          {/* Active incense indicator */}
          {activeIncense && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/60 border border-green-600 rounded-lg text-xs text-green-300 self-start">
              <span>🌿</span>
              <span>
                {activeIncense.effect === 'incenso_tipo' && `+30% tipo ${activeIncense.types.join('/')}`}
                {activeIncense.effect === 'incenso_tipo_garantido' && `Garante tipo ${activeIncense.types.join('/')}`}
                {activeIncense.effect === 'incenso_shiny_tipo' && `+Shiny + tipo ${activeIncense.types.join('/')}`}
              </span>
              <span className="text-green-500">(próximo encontro selvagem)</span>
            </div>
          )}

          {/* Stage complete button */}
          {phase === 'map' && visitedEncounters.length >= (isSpecial ? 1 : normalMaxVisits) && (
            <div className="flex justify-center mt-1">
              <button onClick={handleStageComplete}
                className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-all hover:scale-105">
                Avançar para o próximo estágio ▶
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── LEFT: Trainer Panel ──────────────────────────────────────
  const renderTrainerPanel = () => {
    // Flatten consumiveis + frutas + held + ballmods into slots, splitting stacks of 3
    const STACK_MAX = 3;
    const allItems = [];
    ['consumiveis', 'frutas', 'held', 'ballmods'].forEach((cat) => {
      Object.entries(inventory[cat] || {}).forEach(([id, count]) => {
        if (count <= 0) return;
        const def = ITEMS_DATA.find((i) => i.id === id);
        if (!def) return;
        let remaining = count;
        while (remaining > 0) {
          allItems.push({ id, count: Math.min(remaining, STACK_MAX), def, cat });
          remaining -= STACK_MAX;
        }
      });
    });

    const BALL_TYPES = [
      { id: 'pokebola',   name: 'Pokébola',  img: '/pokeballs/pokeball.png'   },
      { id: 'greatball',  name: 'Greatball', img: '/pokeballs/greatball.png'  },
      { id: 'ultraball',  name: 'Ultraball', img: '/pokeballs/ultraball.png'  },
      { id: 'masterball', name: 'Masterball',img: '/pokeballs/masterball.png' },
    ];

    return (
      <div className="flex flex-col gap-2 h-full overflow-y-auto" onClick={() => setClassInfoOpen(null)}>

        {/* ── Trainer info ── */}
        <div className="bg-gray-800 rounded-xl p-2">
          <div className="flex items-center gap-2 mb-1">
            <img src="/jn/trainerimg.png" alt="trainer" onError={safeImg} className="w-8 h-8 object-contain shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-xs truncate">{currentUser?.username}</p>
              <p className="text-yellow-300 text-xs">💰 {money}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">Estágio {stage} · {runStats.captures} cap.</p>
          <button onClick={() => setShowEnciclopedia(true)}
            className="mt-1 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            📖 Enciclopédia JN
          </button>
        </div>

        {/* ── 4 Class slots ── */}
        <div className="bg-gray-800 rounded-xl p-2">
          <p className="text-gray-500 text-xs uppercase font-bold mb-1.5 tracking-wide">Classes</p>
          <div className="grid grid-cols-2 gap-1">
            {Array.from({ length: 4 }).map((_, i) => {
              const cls = playerClasses[i];
              const grp = cls ? CLASSES_DATA.find((g) => g.classes.some((c) => c.id === cls.id)) : null;
              return (
                <div key={i} className={`relative rounded-lg border p-1.5 min-h-[38px] flex items-start gap-1
                  ${cls ? 'border-yellow-700 bg-yellow-900/10' : 'border-gray-700 border-dashed'}`}>
                  {cls ? (
                    <>
                      <span className="text-sm leading-none mt-0.5 shrink-0">{grp?.icon}</span>
                      <p className="text-yellow-300 text-xs leading-tight flex-1 min-w-0 truncate">{cls.name}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setClassInfoOpen(classInfoOpen === i ? null : i); }}
                        className="text-gray-500 hover:text-white text-xs leading-none shrink-0 ml-0.5"
                        title="Ver poder">ℹ</button>
                      {classInfoOpen === i && (
                        <div className="absolute top-full left-0 z-50 bg-gray-900 border border-yellow-700 rounded-lg p-2 text-xs text-gray-300 mt-1 w-44 shadow-xl"
                          onClick={(e) => e.stopPropagation()}>
                          <p className="text-yellow-400 font-bold mb-1">{grp?.icon} {cls.name}</p>
                          <p className="leading-tight">{cls.powerDesc}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-700 text-xs">Slot {i + 1}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Pokémon slots ── */}
        <div className="bg-gray-800 rounded-xl p-2">
          <p className="text-gray-500 text-xs uppercase font-bold mb-1.5 tracking-wide">Pokémon ({team.length}/{maxTeamSize})</p>
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: maxTeamSize }).map((_, i) => {
              const pkm = team[i];
              if (!pkm) return (
                <div key={i}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const srcRaw = e.dataTransfer.getData('text/x-pkm-idx');
                    if (srcRaw !== '') {
                      const src = parseInt(srcRaw, 10);
                      if (src !== i) {
                        setTeam((prev) => { const next = [...prev]; if (i < next.length) [next[src], next[i]] = [next[i], next[src]]; return next; });
                        setActiveIdx((prev) => prev === src ? i : prev === i ? src : prev);
                      }
                      setDragInfo(null);
                    } else {
                      handlePanelDrop('pokemon_slot', i);
                    }
                  }}
                  className="border border-dashed border-gray-700 rounded-lg h-14 flex items-center justify-center">
                  <p className="text-gray-700 text-xs">Slot {i + 1}</p>
                </div>
              );
              const heldArr = pkm.heldItem
                ? (Array.isArray(pkm.heldItem) ? pkm.heldItem : [pkm.heldItem])
                : [];
              return (
                <div key={pkm.uid}
                  className={`relative rounded-lg border p-1.5 transition-all
                    ${i === activeIdx ? 'border-yellow-400 bg-yellow-900/20' : 'border-gray-700'}
                    ${pkm.vidasAtual <= 0 ? 'opacity-40' : ''}`}>
                  <div className="flex items-start gap-1.5">
                    {/* Pokémon image — draggable for reorder, drop target for consumable */}
                    <div
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/x-pkm-idx', String(i)); setDragInfo({ type: 'pokemon', idx: i }); }}
                      onDragEnd={() => setDragInfo(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        const srcRaw = e.dataTransfer.getData('text/x-pkm-idx');
                        if (srcRaw !== '') {
                          const src = parseInt(srcRaw, 10);
                          if (src !== i) {
                            setTeam((prev) => { const next = [...prev]; if (i < next.length) [next[src], next[i]] = [next[i], next[src]]; return next; });
                            setActiveIdx((prev) => prev === src ? i : prev === i ? src : prev);
                          }
                          setDragInfo(null);
                        } else {
                          handlePanelDrop('pokemon_image', i);
                        }
                      }}
                      onClick={() => { setActiveIdx(i); if (battle?.phase === 'switchPokemon') handleBattleSwitch(i); }}
                      className="relative w-10 h-10 shrink-0 cursor-grab active:cursor-grabbing"
                      title="Arrastar para reordenar · Soltar consumível aqui para usar">
                      {pkm.isShiny && (
                        <img src="/jn/sparlkeshin.png" alt="✨" onError={safeImg}
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                      )}
                      <img src={pkm.imageUrl} alt={pkm.nome} onError={safeImg}
                        className="w-full h-full object-contain relative z-10" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate leading-tight">{pkm.nome}</p>
                      <VidasDisplay atual={pkm.vidasAtual} max={pkm.vidasMax} />
                      {pkm.conditions.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {pkm.conditions.map((c) => (
                            <span key={c} className="text-xs" title={CONDITIONS[c]?.name}>{CONDITIONS[c]?.icon}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {!battle && (
                      <button
                        onClick={() => setTeam((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-gray-600 hover:text-red-400 text-xs leading-none shrink-0 mt-0.5"
                        title="Remover">✕</button>
                    )}
                  </div>
                  {/* Held item sub-slots (base 1, +1 Virtuose, +2 Guia, +extraHeldSlots) */}
                  {(() => {
                    const guiaHeld = hasClassPower('guia') ? 2 : 0;
                    const maxHeldDisplay = (hasClassPower('virtuose') ? 2 : 1) + guiaHeld + (pkm.extraHeldSlots ?? 0);
                    return (
                  <div className="flex gap-1 mt-1.5">
                    {Array.from({ length: Math.max(maxHeldDisplay, heldArr.length) }).map((_, hi) => {
                      const held = heldArr[hi];
                      return (
                        <div key={hi}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { e.stopPropagation(); handlePanelDrop('held_slot', i); }}
                          onClick={() => held && handleUnequipHeld(i, hi)}
                          className={`w-8 h-8 rounded border flex items-center justify-center cursor-pointer transition-all
                            ${held ? 'border-blue-600 bg-blue-900/20 hover:border-red-500' : 'border-gray-700 border-dashed hover:border-gray-500'}`}
                          title={held ? `${held.name} (clique para desequipar)` : 'Soltar held item aqui'}>
                          {held
                            ? <img src={held.img} alt={held.name} onError={safeImg} className="w-6 h-6 object-contain" />
                            : <span className="text-gray-700 text-xs">+</span>}
                        </div>
                      );
                    })}
                  </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Item inventory slots ── */}
        {(() => {
          const mochilaBonus = (inventory.consumiveis?.mochila ?? 0) * 2;
          const guiaBonus    = hasClassPower('guia') ? 2 : 0;
          const maxSlots     = 5 + mochilaBonus + guiaBonus;
          const totalSlots   = Math.max(maxSlots, allItems.length);
          return (
        <div className="bg-gray-800 rounded-xl p-2">
          <p className="text-gray-500 text-xs uppercase font-bold mb-1.5 tracking-wide">Inventário ({allItems.length}/{maxSlots})</p>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: totalSlots }).map((_, i) => {
              const item = allItems[i];
              return (
                <div key={i}
                  draggable={!!item}
                  onDragStart={() => item && setDragInfo({ type: 'item', itemId: item.id, cat: item.cat, def: item.def })}
                  onDragEnd={() => setDragInfo(null)}
                  className={`relative w-9 h-9 rounded border flex items-center justify-center transition-all
                    ${item ? 'border-gray-600 bg-gray-700 cursor-grab hover:border-gray-400' : 'border-gray-700 border-dashed'}`}
                  title={item?.def?.name}>
                  {item && (
                    <>
                      <img src={item.def?.img ?? `/jn/items/${item.id}.png`} alt={item.def?.name}
                        onError={safeImg} className="w-6 h-6 object-contain" />
                      {item.count > 1 && (
                        <span className="absolute bottom-0 right-0 text-white bg-gray-900 rounded px-0.5 leading-tight"
                          style={{ fontSize: '9px' }}>{item.count}</span>
                      )}
                      <button
                        onClick={() => setInventory((inv) => ({ ...inv, [item.cat]: { ...inv[item.cat], [item.id]: 0 } }))}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-700 hover:bg-red-500 rounded-full text-white flex items-center justify-center leading-none"
                        style={{ fontSize: '8px' }}
                        title="Remover">✕</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          );
        })()}

        {/* ── 4 Ball slots ── */}
        <div className="bg-gray-800 rounded-xl p-2">
          <p className="text-gray-500 text-xs uppercase font-bold mb-1.5 tracking-wide">Pokébolas</p>
          <div className="grid grid-cols-4 gap-1">
            {BALL_TYPES.map((ball) => {
              const count = inventory.pokebolas[ball.id] ?? 0;
              return (
                <div key={ball.id}
                  className={`relative w-9 h-9 rounded border flex items-center justify-center transition-all
                    ${count > 0 ? 'border-gray-600 bg-gray-700' : 'border-gray-700 border-dashed opacity-40'}`}
                  title={`${ball.name}: ${count}`}>
                  <img src={ball.img} alt={ball.name} onError={safeImg} className="w-6 h-6 object-contain" />
                  <span className="absolute bottom-0 right-0 text-white bg-gray-900 rounded px-0.5 leading-tight"
                    style={{ fontSize: '9px' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  // ── RIGHT: Pokémon Profile Panel ─────────────────────────────
  const renderPokemonProfile = () => {
    const pkm = battle?.playerPkm ?? team[activeIdx];
    if (!pkm) return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        Nenhum Pokémon
      </div>
    );

    const heldArr = pkm.heldItem
      ? (Array.isArray(pkm.heldItem) ? pkm.heldItem : [pkm.heldItem])
      : [];

    const pClassKeys = playerClasses.map((c) => c.powerKey);

    // Draft: only active when draftForUid matches current pkm
    const currentDraft = draftForUid === pkm.uid
      ? atribDraft
      : { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 };
    const pontosUsados    = Object.values(currentDraft).reduce((s, v) => s + v, 0);
    const pontosDisponiveis = (pkm.pontosAtrib ?? 0) - pontosUsados;

    const STAT_LABELS = [
      { key:'atk',    label:'Ataque',      color:'text-red-400'    },
      { key:'def',    label:'Defesa',      color:'text-blue-400'   },
      { key:'atkEsp', label:'Atq.Esp',     color:'text-purple-400' },
      { key:'defEsp', label:'Def.Esp',     color:'text-cyan-400'   },
      { key:'vel',    label:'Velocidade',  color:'text-yellow-400' },
    ];

    const getBonusSources = (key) => {
      const sources = [];
      if (pkm.isSingleType) sources.push({ label: 'Tipo único', value: 1 });
      const cb = (key === 'atk' || key === 'atkEsp')
        ? getClassAtkBonus(key, pClassKeys, pkm.types ?? [])
        : getClassDefBonus(key, pClassKeys);
      if (cb > 0) sources.push({ label: 'Classe', value: cb });
      const tb = getTypePowerBonus(pkm, key);
      if (tb > 0) sources.push({ label: 'Poder de tipo', value: tb });
      const cond = getConditionPenalty(pkm, key);
      if (cond < 0) sources.push({ label: 'Condição', value: cond });
      // Especialista dice bonus
      const espClass = playerClasses.find((c) => c.powerKey === 'especialista');
      if (espClass && espClass.especialistaAtrib === key) {
        const baseline    = espClass.levelBaselines?.[pkm.uid] ?? 0;
        const espBonus    = Math.floor(Math.max(0, pkm.level - baseline) / 8);
        if (espBonus > 0) sources.push({ label: 'Especialista', value: espBonus });
      }
      // Engenheiro / other stored diceBonus
      const db = pkm.diceBonus?.[key] ?? 0;
      if (db > 0) sources.push({ label: 'Engenheiro', value: db });
      return sources;
    };

    return (
      <div className="flex flex-col gap-3 h-full overflow-y-auto">
        {/* Pokémon image + name */}
        <div className="bg-gray-800 rounded-xl p-3 flex flex-col items-center gap-2">
          <div className="relative">
            {pkm.isShiny && (
              <img src="/jn/sparlkeshin.png" alt="✨" onError={safeImg}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            )}
            <img src={pkm.imageUrl} alt={pkm.nome} onError={safeImg} className="relative z-10 w-24 h-24 object-contain" />
          </div>
          <p className="text-white font-bold">{pkm.nome}
            {pkm.isShiny && <span className="text-yellow-400 ml-1">✨</span>}
            {isLegendary(pkm.nome) && <span className="text-purple-400 ml-1">🌟</span>}
          </p>
          <div className="flex gap-1 flex-wrap justify-center">
            {(pkm.types ?? []).map((t) => {
              const isWaiting = battle?.phase === 'awaitingAction' && !pendingAtkType;
              return isWaiting ? (
                <button key={t}
                  onClick={() => setPendingAtkType(t)}
                  title="Clique para atacar com este tipo"
                  className="px-1.5 py-0.5 rounded text-white text-xs font-bold hover:brightness-125 active:scale-95 transition-all"
                  style={{ backgroundColor: TYPE_COLORS[t] ?? '#888' }}>
                  {t}
                </button>
              ) : (
                <TypeBadge key={t} type={t} />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const inquebravelDisp = battle && pClassKeys.includes('inquebravel')
                ? team.filter((p, i) => i !== activeIdx && p.vidasAtual >= p.vidasMax).length
                : 0;
              const effMax = pkm.vidasMax + inquebravelDisp;
              return (
                <>
                  <VidasDisplay atual={pkm.vidasAtual} max={effMax} />
                  <span className="text-gray-400 text-xs">{pkm.vidasAtual}/{effMax}{inquebravelDisp > 0 ? <span className="text-green-400 ml-1">(+{inquebravelDisp}🛡️)</span> : null}</span>
                </>
              );
            })()}
          </div>
          <p className="text-gray-500 text-xs">Nv.{pkm.level} · {pkm.isSingleType ? '⭐ Tipo único (+1d)' : ''}</p>
        </div>

        {/* Stats table */}
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="w-full text-xs">
            {/* Header */}
            <div className="flex items-center border-b border-gray-700 pb-1 mb-0.5">
              <div className="flex-1 text-left text-gray-500 font-semibold">
                Atributo
                {(pkm.pontosAtrib ?? 0) > 0 && (
                  <span className="text-yellow-400 ml-1">({pontosDisponiveis})</span>
                )}
              </div>
              <div className="w-10 text-center text-gray-500 font-semibold">Base</div>
              <div className="w-14 text-center text-gray-500 font-semibold">Bônus</div>
              <div className="w-10 text-center text-gray-500 font-semibold">Total</div>
            </div>
            {/* Rows */}
            {STAT_LABELS.map(({ key, label, color }) => {
              const rawStat   = (pkm.stats?.[key] ?? 0) + (currentDraft[key] ?? 0);
              const baseDice  = Math.max(1, Math.floor(rawStat / 2));
              const sources   = getBonusSources(key);
              const bonusDice = sources.reduce((s, src) => s + src.value, 0);
              const totalDice = Math.max(1, baseDice + bonusDice);
              const tooltipKey = `${pkm.uid}-${key}`;
              const canAdd = pontosDisponiveis > 0;
              return (
                <div key={key} className="flex items-center border-b border-gray-700/40 py-1">
                  <div className="flex-1">
                    <button
                      disabled={!canAdd}
                      onClick={() => {
                        if (!canAdd) return;
                        setDraftForUid(pkm.uid);
                        setAtribDraft((d) => ({ ...d, [key]: (d[key] ?? 0) + 1 }));
                      }}
                      title={canAdd ? `+1 em ${label}` : ''}
                      className={`${color} font-semibold text-left leading-tight ${canAdd ? 'hover:brightness-125 cursor-pointer' : 'cursor-default'}`}
                    >
                      {label}
                      <span className="text-gray-400 ml-1 font-normal">· {rawStat}</span>
                      {(currentDraft[key] ?? 0) > 0 && (
                        <span className="text-yellow-400 ml-1">+{currentDraft[key]}</span>
                      )}
                    </button>
                  </div>
                  <div className="w-10 text-center text-white">{baseDice}d</div>
                  <div className="w-14 text-center relative">
                    <span className={bonusDice >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {bonusDice >= 0 ? '+' : ''}{bonusDice}d
                    </span>
                    {sources.length > 0 && (
                      <button
                        onClick={() => setBonusTooltip(bonusTooltip === tooltipKey ? null : tooltipKey)}
                        className="ml-0.5 text-gray-500 hover:text-gray-300 leading-none align-middle"
                        title="Ver fontes dos bônus"
                      >ℹ</button>
                    )}
                    {bonusTooltip === tooltipKey && (
                      <div className="absolute right-0 top-5 z-30 bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs w-36 shadow-xl text-left">
                        {sources.map((s, i) => (
                          <p key={i} className={s.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {s.label}: {s.value >= 0 ? '+' : ''}{s.value}d
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-10 text-center text-white font-bold">{totalDice}d</div>
                </div>
              );
            })}
          </div>

          {/* Save / Redo buttons */}
          {pontosUsados > 0 && (
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={handleRedoAtribDraft}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300">
                Refazer
              </button>
              <button onClick={handleSaveAtribDraft}
                className="text-xs px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-white font-bold">
                Salvar
              </button>
            </div>
          )}
        </div>

        {/* Conditions */}
        {pkm.conditions.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-gray-500 text-xs uppercase font-bold mb-2">Condições</p>
            <div className="flex flex-wrap gap-2">
              {pkm.conditions.map((c) => {
                const cd = CONDITIONS[c];
                return (
                  <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: cd?.color ?? '#555' }}>
                    {cd?.icon} {cd?.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Held items */}
        {heldArr.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-gray-500 text-xs uppercase font-bold mb-2">Itens Held</p>
            {heldArr.map((h) => (
              <div key={h.id} className="relative flex items-center gap-2 mb-1">
                <img src={h.img ?? IMG_FALLBACK} alt={h.name} onError={safeImg} className="w-6 h-6 object-contain shrink-0" />
                <p className="text-white text-xs font-bold flex-1 leading-tight">{h.name}</p>
                <button
                  onClick={() => setHeldTooltip(heldTooltip === h.id ? null : h.id)}
                  className="text-gray-500 hover:text-gray-300 text-xs leading-none shrink-0"
                  title="Descrição do item"
                >ℹ</button>
                {heldTooltip === h.id && (
                  <div className="absolute right-0 z-30 bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs w-40 shadow-xl">
                    <p className="text-gray-300 leading-snug">{h.desc}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Full Game Screen Wrapper ──────────────────────────────────
  const renderGameScreen = (centerContent) => (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top: Stage Map */}
      {renderMapTop()}

      {/* Bottom: 3-column layout */}
      <div className="flex flex-1 gap-0 overflow-hidden" style={{ minHeight: '420px' }}>
        {/* Left panel */}
        <div className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 p-3 overflow-y-auto">
          {renderTrainerPanel()}
        </div>

        {/* Center content */}
        <div className="flex-1 bg-gray-900 overflow-y-auto p-4">
          {centerContent}
        </div>

        {/* Right panel */}
        <div className="w-52 shrink-0 bg-gray-900 border-l border-gray-800 p-3 overflow-y-auto">
          {renderPokemonProfile()}
        </div>
      </div>
    </div>
  );

  // ============================================================
  // Part 7: Render Functions — Battle, Mart, End Screens + return
  // ============================================================

  // ── Battle Center ─────────────────────────────────────────────
  const renderBattleCenter = () => {
    if (!battle) return <div className="flex items-center justify-center h-full text-gray-500">Carregando batalha...</div>;
    const { phase: bp, enemyPkm, playerPkm, canCapture, capturedPkm } = battle;

    // Class reward screen (stages 3 / 5 / 8)
    if (bp === 'classReward' && battle.classRewardCls) {
      const cls    = battle.classRewardCls;
      const g      = CLASSES_DATA.find((gr) => gr.classes.some((c) => c.id === cls.id));
      const isBase = cls.isBase;
      const STAT_LABELS_MAP = { atk:'Ataque', def:'Defesa', atkEsp:'Atq.Esp', defEsp:'Def.Esp', vel:'Velocidade' };
      const STAT_KEYS = ['atk', 'def', 'atkEsp', 'defEsp', 'vel'];
      const needsChoice = ['vidente', 'especialista', 'elementalista'].includes(cls.powerKey);
      const choiceReady = !needsChoice || classChoiceData !== null;
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-yellow-400 text-xl font-bold">
            🎓 {isBase ? 'Nova Classe Base!' : 'Nova Classe Avançada!'}
          </p>
          <div className="bg-gray-800 border-2 border-yellow-400 rounded-2xl p-6 flex flex-col items-center gap-3 max-w-xs">
            <span className="text-4xl">{g?.icon}</span>
            <p className="text-white font-bold text-lg">{cls.name}</p>
            <p className="text-gray-400 text-xs text-center leading-snug">{g?.groupName}</p>
            <hr className="w-full border-gray-600" />
            <p className="text-yellow-300 text-sm text-center leading-snug">{cls.powerDesc}</p>
          </div>

          {/* Vidente: choose vantagem or desvantagem */}
          {cls.powerKey === 'vidente' && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-gray-300 text-sm font-bold">Escolha seu efeito:</p>
              <div className="flex gap-3">
                {['vantagem', 'desvantagem'].map((opt) => (
                  <button key={opt}
                    onClick={() => setClassChoiceData({ vidente: opt })}
                    className={`px-4 py-2 rounded-lg font-bold text-sm border-2 transition-all ${classChoiceData?.vidente === opt ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-yellow-400'}`}>
                    {opt === 'vantagem' ? '✅ Suas rolagens c/ vantagem' : '🎯 Inimigos c/ desvantagem'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Especialista: choose attribute */}
          {cls.powerKey === 'especialista' && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-gray-300 text-sm font-bold">Selecione o atributo:</p>
              <div className="flex gap-2 flex-wrap justify-center">
                {STAT_KEYS.map((k) => (
                  <button key={k}
                    onClick={() => setClassChoiceData({ atrib: k })}
                    className={`px-3 py-1 rounded-lg font-bold text-xs border-2 transition-all ${classChoiceData?.atrib === k ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-yellow-400'}`}>
                    {STAT_LABELS_MAP[k]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Elementalista: choose type */}
          {cls.powerKey === 'elementalista' && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-gray-300 text-sm font-bold">Selecione o tipo:</p>
              <div className="flex gap-1 flex-wrap justify-center max-w-xs">
                {TYPES.map((t) => (
                  <button key={t}
                    onClick={() => setClassChoiceData({ type: t })}
                    className={`px-2 py-0.5 rounded text-xs font-bold border transition-all ${classChoiceData?.type === t ? 'border-yellow-400 text-black bg-yellow-500' : 'border-gray-600 text-gray-300 bg-gray-800 hover:border-yellow-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleAcceptClassReward} disabled={!choiceReady}
            className={`px-8 py-2 font-bold rounded-lg transition-all ${choiceReady ? 'bg-yellow-500 hover:bg-yellow-400 text-black hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
            Receber classe!
          </button>
        </div>
      );
    }

    // Engineer attribute choice screen
    if (bp === 'engineer_choice' && engineerChoicePending) {
      const STAT_KEYS2 = ['atk', 'def', 'atkEsp', 'defEsp', 'vel'];
      const STAT_LBL   = { atk:'Ataque', def:'Defesa', atkEsp:'Atq.Esp', defEsp:'Def.Esp', vel:'Velocidade' };
      const allDone = engineerChoicePending.every((p) => (engineerChoiceMap[p.uid]?.length ?? 0) >= p.slots);
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-yellow-400 text-xl font-bold">🔧 Cyber Engenheiro</p>
          <p className="text-gray-300 text-sm">Selecione os atributos para cada Pokémon:</p>
          <div className="flex flex-col gap-3 w-full max-w-sm">
            {engineerChoicePending.map((p) => {
              const chosen      = engineerChoiceMap[p.uid] ?? [];
              const isElecMetal = p.types.some((t) => t === 'Elétrico' || t === 'Metal');
              return (
                <div key={p.uid} className="bg-gray-800 rounded-xl p-3">
                  <p className="text-white text-sm font-bold mb-1">{p.nome}
                    <span className="text-gray-400 text-xs ml-2">{isElecMetal ? '+2d em 2 atrib.' : '+1d em 1 atrib.'}</span>
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {STAT_KEYS2.map((k) => {
                      const isChosen  = chosen.includes(k);
                      const canSelect = isChosen || chosen.length < p.slots;
                      return (
                        <button key={k}
                          disabled={!canSelect}
                          onClick={() => setEngineerChoiceMap((prev) => {
                            const cur  = prev[p.uid] ?? [];
                            const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
                            return { ...prev, [p.uid]: next };
                          })}
                          className={`px-2 py-0.5 rounded text-xs font-bold border transition-all ${isChosen ? 'border-yellow-400 bg-yellow-500 text-black' : canSelect ? 'border-gray-600 text-gray-300 bg-gray-700 hover:border-yellow-400' : 'border-gray-700 text-gray-600 bg-gray-800 cursor-not-allowed'}`}>
                          {STAT_LBL[k]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => handleApplyEngineerChoices(engineerChoiceMap)} disabled={!allDone}
            className={`px-8 py-2 font-bold rounded-lg transition-all ${allDone ? 'bg-yellow-500 hover:bg-yellow-400 text-black hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
            Confirmar
          </button>
        </div>
      );
    }

    // Artífice item creation choice (triggered when class is received)
    if (bp === 'artifice_choice' && artificeCredits > 0) {
      const eligible = team.filter((p) => !artificeEquipped[p.uid]);
      const ready = artificeSelected.uid && artificeSelected.item;
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-rose-400 text-xl font-bold">⚔️ Cyber Artífice</p>
          <p className="text-gray-300 text-sm text-center">Escolha um Pokémon e um item para equipar:</p>
          <div className="flex flex-col gap-2 w-full max-w-sm">
            {eligible.map((p) => (
              <button key={p.uid}
                onClick={() => setArtificeSelected((prev) => ({ ...prev, uid: prev.uid === p.uid ? null : p.uid }))}
                className={`p-3 rounded-xl border-2 text-left transition-all ${artificeSelected.uid === p.uid ? 'border-rose-400 bg-rose-900/20 text-white' : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-rose-400'}`}>
                <span className="font-bold text-sm">{p.nome}</span>
                <span className="text-xs text-gray-400 ml-2">{(p.types ?? []).join('/')}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => setArtificeSelected((prev) => ({ ...prev, item: 'armadura' }))}
              className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${artificeSelected.item === 'armadura' ? 'border-blue-400 bg-blue-900/30 text-blue-300' : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-blue-400'}`}>
              🛡️ Armadura (+1d Def/DefEsp)
            </button>
            <button
              onClick={() => setArtificeSelected((prev) => ({ ...prev, item: 'espada' }))}
              className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${artificeSelected.item === 'espada' ? 'border-red-400 bg-red-900/30 text-red-300' : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-red-400'}`}>
              ⚔️ Espada (+1d Atk/AtkEsp)
            </button>
          </div>
          <button disabled={!ready}
            onClick={() => {
              handleApplyArtificeChoice(artificeSelected.uid, artificeSelected.item);
              setBattle((b) => ({ ...b, phase: 'result_win' }));
            }}
            className={`px-8 py-2 font-bold rounded-lg transition-all ${ready ? 'bg-rose-500 hover:bg-rose-400 text-white hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
            Confirmar
          </button>
        </div>
      );
    }

    // Miniboss item reward screen (stage 10)
    if (bp === 'minibossReward') {
      const items = battle.minibossItems ?? [];
      const TIER_LABELS = { S: { label:'S', color:'text-yellow-400', border:'border-yellow-400', weight:'20%' }, A: { label:'A', color:'text-orange-400', border:'border-orange-400', weight:'30%' }, B: { label:'B', color:'text-blue-400', border:'border-blue-400', weight:'50%' } };
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-orange-400 text-xl font-bold">🏆 Miniboss Derrotado!</p>
          <p className="text-gray-300 text-sm">Escolha sua recompensa:</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {items.map((item) => {
              const t = TIER_LABELS[item.tier] ?? TIER_LABELS['B'];
              return (
                <button key={item.id} onClick={() => handleMinibossItemChoice(item)}
                  className={`flex flex-col items-center gap-2 bg-gray-800 border-2 ${t.border} rounded-2xl p-4 w-36 hover:brightness-125 transition-all active:scale-95`}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.color} border ${t.border}`}>
                    Tier {t.label} • {t.weight}
                  </span>
                  <img src={item.img ?? '/jn/items/pokebola.png'} alt={item.name} onError={safeImg} className="w-12 h-12 object-contain" />
                  <p className="text-white text-xs font-bold text-center leading-tight">{item.name}</p>
                  <p className="text-gray-400 text-xs text-center leading-snug">{item.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Pokemon fled after failed capture
    if (bp === 'result_flee') {
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-gray-400 text-2xl">💨 {enemyPkm?.nome} fugiu!</p>
          <button onClick={() => handleEncounterComplete(null)}
            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg">
            Continuar
          </button>
        </div>
      );
    }

    // Apply post-capture ballmod bonuses (Healball +1 vida, Fastball +1d vel)
    const applyCaptureBallmodBonus = (pkm) => {
      const bmod = battle.capturedBallmodId;
      if (bmod === 'healball') {
        return { ...pkm, vidasMax: (pkm.vidasMax ?? 3) + 1, vidasAtual: (pkm.vidasAtual ?? pkm.vidasMax ?? 3) + 1 };
      }
      if (bmod === 'fastball') {
        const db = { ...(pkm.diceBonus ?? { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0 }) };
        db.vel = (db.vel ?? 0) + 1;
        return { ...pkm, diceBonus: db };
      }
      return pkm;
    };

    // Legendary attribute distribution screen
    if (bp === 'legendary_attr') {
      const lPkm = battle.legendaryPkmToAdd;
      const bonuses = battle.legendaryBonuses ?? { atk:0, def:0, atkEsp:0, defEsp:0, vel:0 };
      const pointsLeft = battle.legendaryPointsLeft ?? 10;
      const STAT_KEYS = ['atk', 'def', 'atkEsp', 'defEsp', 'vel'];
      const STAT_LABELS = { atk:'ATK', def:'DEF', atkEsp:'ATK ESP', defEsp:'DEF ESP', vel:'VEL' };
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className={`text-xl font-bold ${lPkm?.isShiny && isLegendary(lPkm?.nome) ? 'text-yellow-400' : lPkm?.isShiny ? 'text-yellow-400' : 'text-purple-400'}`}>
            {lPkm?.isShiny && isLegendary(lPkm?.nome) ? '🌟✨' : lPkm?.isShiny ? '✨' : '🌟'} {lPkm?.nome} capturado!
          </p>
          <p className="text-yellow-300 text-sm font-bold">Distribua {pointsLeft} ponto{pointsLeft !== 1 ? 's' : ''} de atributo</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {STAT_KEYS.map((stat) => (
              <div key={stat} className="flex flex-col items-center gap-1 bg-gray-800 rounded-xl p-3 min-w-[64px]">
                <span className="text-gray-400 text-xs font-bold">{STAT_LABELS[stat]}</span>
                <span className="text-white font-bold text-lg">{(lPkm?.diceBase?.[stat] ?? 1) + bonuses[stat]}</span>
                <span className="text-green-400 text-xs">+{bonuses[stat]}</span>
                <button disabled={pointsLeft <= 0}
                  onClick={() => setBattle((b) => ({
                    ...b,
                    legendaryBonuses:   { ...b.legendaryBonuses,   [stat]: b.legendaryBonuses[stat] + 1 },
                    legendaryPointsLeft: b.legendaryPointsLeft - 1,
                  }))}
                  className={`w-8 h-8 rounded font-bold text-sm ${pointsLeft > 0 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                  +1
                </button>
                {bonuses[stat] > 0 && (
                  <button onClick={() => setBattle((b) => ({
                      ...b,
                      legendaryBonuses:   { ...b.legendaryBonuses,   [stat]: b.legendaryBonuses[stat] - 1 },
                      legendaryPointsLeft: b.legendaryPointsLeft + 1,
                    }))}
                    className="w-8 h-8 rounded bg-red-800 hover:bg-red-700 text-white font-bold text-xs">
                    -1
                  </button>
                )}
              </div>
            ))}
          </div>
          {pointsLeft === 0 && (
            <button onClick={() => {
              const enhanced = {
                ...lPkm,
                diceBase: {
                  atk:    (lPkm.diceBase?.atk    ?? 1) + bonuses.atk,
                  def:    (lPkm.diceBase?.def    ?? 1) + bonuses.def,
                  atkEsp: (lPkm.diceBase?.atkEsp ?? 1) + bonuses.atkEsp,
                  defEsp: (lPkm.diceBase?.defEsp ?? 1) + bonuses.defEsp,
                  vel:    (lPkm.diceBase?.vel    ?? 1) + bonuses.vel,
                },
              };
              const finalPkm = applyCaptureBallmodBonus(enhanced);
              handleAddToTeam(finalPkm);
              handleEncounterComplete(finalPkm);
            }}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all hover:scale-105">
              Confirmar e adicionar ao time
            </button>
          )}
          <p className="text-gray-500 text-xs">Todos os {battle.legendaryPointsLeft + Object.values(bonuses).reduce((a, b) => a + b, 0)} pontos devem ser distribuídos.</p>
        </div>
      );
    }

    // Legendary full-team swap screen
    if (bp === 'legendary_swap') {
      const lPkm = battle.capturedPkm;
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-purple-400 text-xl font-bold">🌟 {lPkm?.nome} quer se juntar!</p>
          <p className="text-yellow-300 text-sm">Time cheio — escolha um Pokémon para liberar:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {team.map((pkm, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 bg-gray-800 rounded-xl p-3">
                <img src={pkm.imageUrl ?? getPokemonImageUrl(pkm.dexNumber, pkm.isShiny)} alt={pkm.nome} onError={safeImg} className="w-12 h-12 object-contain" />
                <p className="text-white text-xs font-bold">{pkm.nome}</p>
                <p className="text-gray-400 text-xs">Nv.{pkm.level} · {pkm.vidasAtual}♥</p>
                <button onClick={() => {
                    setTeam((prev) => prev.filter((_, i) => i !== idx));
                    if (activeIdx >= idx && activeIdx > 0) setActiveIdx((a) => a - 1);
                    setBattle((b) => ({
                      ...b, phase: 'legendary_attr',
                      legendaryPkmToAdd: b.capturedPkm,
                      legendaryBonuses: { atk:0, def:0, atkEsp:0, defEsp:0, vel:0 },
                      legendaryPointsLeft: 10,
                    }));
                  }}
                  className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded-lg">
                  Liberar
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => handleEncounterComplete(null)}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg">
            Terminar sem o Lendário
          </button>
        </div>
      );
    }

    if (bp === 'captured' && capturedPkm) {
      const isLeg      = isLegendary(capturedPkm.nome);
      const isShinyPkm = !!capturedPkm.isShiny;
      const attrPoints = (isLeg && isShinyPkm) ? 15 : isLeg ? 10 : isShinyPkm ? 5 : 0;
      const teamFull   = team.length >= maxTeamSize;
      const isSpecial  = isLeg || isShinyPkm;
      const goToAttr   = () => setBattle((b) => ({
        ...b, phase: 'legendary_attr',
        legendaryPkmToAdd: capturedPkm,
        legendaryBonuses: { atk:0, def:0, atkEsp:0, defEsp:0, vel:0 },
        legendaryPointsLeft: attrPoints,
      }));
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className={`text-xl font-bold ${isLeg ? 'text-purple-400' : isShinyPkm ? 'text-yellow-400' : 'text-green-400'}`}>
            {isLeg && isShinyPkm ? '🌟✨' : isLeg ? '🌟' : isShinyPkm ? '✨' : '✅'} {capturedPkm.nome} capturado!
          </p>
          <PkmCard pkm={capturedPkm} />
          {!teamFull
            ? <button onClick={() => attrPoints > 0 ? goToAttr() : (handleAddToTeam(applyCaptureBallmodBonus(capturedPkm)), handleEncounterComplete(applyCaptureBallmodBonus(capturedPkm)))}
                className={`px-6 py-2 font-bold rounded-lg text-white ${isLeg ? 'bg-purple-600 hover:bg-purple-500' : isShinyPkm ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}`}>
                Adicionar ao time
              </button>
            : isSpecial
              ? <button onClick={() => setBattle((b) => ({ ...b, phase: 'legendary_swap' }))}
                  className={`px-6 py-2 font-bold rounded-lg text-white ${isLeg ? 'bg-purple-600 hover:bg-purple-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}>
                  Substituir um Pokémon
                </button>
              : <p className="text-yellow-400 text-sm">Time cheio — Pokémon liberado.</p>
          }
          <button onClick={() => handleEncounterComplete(null)}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg">
            {teamFull && !isSpecial ? 'Continuar' : 'Libertar e continuar'}
          </button>
        </div>
      );
    }

    // Battle won
    if (bp === 'result_win') {
      const isSelvagem = battle.canCapture; // wild encounter
      const notCaptured = isSelvagem && !battle.capturedPkm;
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-yellow-400 text-2xl font-bold">🎉 Vitória!</p>
          <p className="text-gray-300 text-sm">{enemyPkm?.nome} foi derrotado!</p>
          {notCaptured && wildRewardItems.length > 0 && (
            <div className="w-full">
              <p className="text-gray-400 text-sm text-center mb-2">Escolha 1 item como recompensa:</p>
              <div className="flex gap-3 justify-center flex-wrap">
                {wildRewardItems.map((item) => (
                  <button key={item.id} onClick={() => {
                    // Add item to inventory
                    setInventory((inv) => {
                      let cat;
                      if (item.category === 'fruta') cat = 'frutas';
                      else if (item.category === 'held') cat = 'held';
                      else if (item.category === 'ballmod') cat = 'ballmods';
                      else cat = 'consumiveis';
                      return { ...inv, [cat]: { ...inv[cat], [item.id]: (inv[cat][item.id] ?? 0) + 1 } };
                    });
                    setWildRewardItems([]);
                    handleEncounterComplete(null);
                  }}
                    className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-xl border border-gray-500 transition-all min-w-[80px]">
                    <img src={item.img} alt={item.name} onError={safeImg} className="w-10 h-10 object-contain" />
                    <span className="text-white text-xs font-bold text-center leading-tight">{item.name}</span>
                    <span className={`text-xs font-bold ${item.tier === 'S' ? 'text-yellow-400' : item.tier === 'A' ? 'text-purple-400' : item.tier === 'B' ? 'text-blue-400' : 'text-gray-400'}`}>Tier {item.tier}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {(!notCaptured || wildRewardItems.length === 0) && (
            <button onClick={() => handleEncounterComplete(null)}
              className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg">
              Continuar
            </button>
          )}
        </div>
      );
    }

    // Battle lost / switch
    if (bp === 'result_lose') {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-red-400 text-2xl font-bold">💀 Todos os Pokémon desmaiaram!</p>
          <button onClick={() => handleEndRun(false)}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg">
            Encerrar Jornada
          </button>
        </div>
      );
    }

    if (bp === 'switchPokemon') {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-yellow-400 font-bold">{playerPkm?.nome} desmaiou! Escolha o próximo:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {team.map((p, i) => p.vidasAtual > 0 && i !== activeIdx && (
              <div key={p.uid} className="w-32">
                <PkmCard pkm={p} onClick={() => handleBattleSwitch(i)} small />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Main battle UI
    return (
      <div className="flex flex-col gap-3 h-full">
        {/* Enemy Pokémon */}
        <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-4">
          <div className="relative shrink-0">
            {enemyPkm?.isShiny && (
              <img src="/jn/sparlkeshin.png" alt="✨" onError={safeImg}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            )}
            <img src={enemyPkm?.imageUrl} alt={enemyPkm?.nome} onError={safeImg} className="relative z-10 w-20 h-20 object-contain" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-bold">{enemyPkm?.nome}</p>
              <span className="text-gray-400 text-xs">Nv.{enemyPkm?.level}</span>
              {enemyPkm?.isShiny && <span className="text-yellow-400 text-xs">✨</span>}
              {isLegendary(enemyPkm?.nome) && <span className="text-purple-400 text-xs">🌟</span>}
            </div>
            <div className="flex gap-1 flex-wrap my-1">
              {(enemyPkm?.types ?? []).map((t) => <TypeBadge key={t} type={t} />)}
            </div>
            <VidasDisplay atual={enemyPkm?.vidasAtual ?? 0} max={enemyPkm?.vidasMax ?? 3} />
            {enemyPkm?.conditions?.length > 0 && (
              <div className="flex gap-1 mt-1">
                {enemyPkm.conditions.map((c) => (
                  <span key={c} className="text-xs px-1.5 py-0.5 rounded font-bold text-white"
                    style={{ backgroundColor: CONDITIONS[c]?.color ?? '#555' }}>
                    {CONDITIONS[c]?.icon} {CONDITIONS[c]?.name}
                  </span>
                ))}
              </div>
            )}
            {battle?.isCTNpc && (battle?.ctnpcClasses ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {(battle.ctnpcClasses).map((cls) => (
                  <span key={cls.id} title={cls.powerDesc ?? ''}
                    className="text-xs px-1.5 py-0.5 rounded bg-red-900/70 text-red-300 font-bold border border-red-700">
                    🤖 {cls.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Battle Log */}
        <div ref={battleLogRef}
          className="flex-1 bg-black/40 rounded-xl p-3 overflow-y-auto text-xs text-gray-300 space-y-0.5"
          style={{ minHeight: '120px', maxHeight: '180px' }}>
          {battleLog.map((line, i) => {
            if (typeof line === 'string') {
              if (line.startsWith('«ADV» ')) return <p key={i} className="text-green-400">{line.slice(6)}</p>;
              if (line.startsWith('«DIS» ')) return <p key={i} className="text-red-400">{line.slice(6)}</p>;
              return <p key={i}>{line}</p>;
            }
            const rollStr = (rolls, discarded, desvantagem) => {
              if (discarded) return <span className="text-green-400">[{discarded.join(',')}]→[{rolls.join(',')}]</span>;
              if (desvantagem) return <span className="text-red-400">[{rolls.join(',')}]</span>;
              return <span>[{rolls.join(',')}]</span>;
            };
            if (line.type === 'roll') return (
              <div key={i} className="leading-tight">
                <p>{line.atkIcon} {line.atkNome} {line.lbl} {rollStr(line.atkRolls, line.atkDiscarded, line.atkDesvantagem)}={line.atkTotal}</p>
                <p>🛡️ {line.defNome} {line.defLbl} {rollStr(line.defRolls, line.defDiscarded, line.defDesvantagem)}={line.defTotal}</p>
              </div>
            );
            if (line.type === 'vel') return (
              <div key={i} className="leading-tight">
                <p>💨 {line.pNome} Vel {rollStr(line.pRolls, line.pDiscarded, false)}={line.pTotal}</p>
                <p>💨 {line.eNome} Vel {rollStr(line.eRolls, line.eDiscarded, false)}={line.eTotal}</p>
              </div>
            );
            return <p key={i}>{String(line)}</p>;
          })}
        </div>

        {/* Action buttons — 2-step: pick type → pick stat, OR defense choice */}
        {(bp === 'awaitingDefense' || (bp === 'awaitingAction' && !battle?.playerGoesFirst)) ? (
          <div className="flex flex-col items-center gap-3 py-3">
            {(() => {
              const pd = battle?.pendingDefense ?? {};
              const forcedDefStat = pd.enemyAction === 'atk' ? 'def' : 'defEsp';
              const forcedDefLabel = forcedDefStat === 'def' ? 'Defesa' : 'Def.Esp';
              const onDefense = (choice) => bp === 'awaitingDefense'
                ? handlePlayerDefense(choice)
                : handleEnemyFirstDefense(choice);
              return (
                <>
                  <p className="text-yellow-300 font-bold text-sm text-center">
                    {enemyPkm?.nome} vai usar {pd.enemyAction === 'atk' ? '⚔️ Ataque' : '✨ Atq.Esp'}!
                  </p>
                  <p className="text-gray-400 text-xs">Como quer se defender?</p>
                  <div className="flex gap-3">
                    <button onClick={() => onDefense('vel')}
                      className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl text-sm transition-colors">
                      ⚡ Esquivar<br/><span className="text-xs font-normal opacity-80">(Velocidade)</span>
                    </button>
                    <button onClick={() => onDefense(forcedDefStat)}
                      className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-colors">
                      🛡️ Defender<br/><span className="text-xs font-normal opacity-80">({forcedDefLabel})</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
        <div className="flex flex-wrap gap-2 justify-center">
          {bp === 'awaitingPlayerAttack' && (
            <span className="w-full text-center text-xs text-green-400 font-bold mb-0.5">
              ⚡ Sua vez de atacar!
            </span>
          )}
          {!pendingAtkType ? (
            // Step 1: choose attacking type
            <>
              {(playerPkm?.types ?? []).map((t) => (
                <button key={t}
                  onClick={() => setPendingAtkType(t)}
                  disabled={bp !== 'awaitingAction' && bp !== 'awaitingPlayerAttack'}
                  className="px-5 py-2 rounded-lg disabled:opacity-40 text-white font-bold text-sm transition-all hover:brightness-125 active:scale-95"
                  style={{ backgroundColor: TYPE_COLORS[t] ?? '#888' }}>
                  {t}
                </button>
              ))}
              {(bp === 'awaitingAction' || bp === 'awaitingPlayerAttack') && (
                <button onClick={handlePassTurn}
                  className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs rounded-lg transition-colors mt-0.5">
                  ⏭️ Passar a vez
                </button>
              )}
            </>
          ) : (
            // Step 2: choose attack stat
            <>
              <span className="w-full text-center text-xs text-gray-400">
                Tipo: <span className="font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: TYPE_COLORS[pendingAtkType] ?? '#888' }}>{pendingAtkType}</span> — escolha o atributo:
              </span>
              <button
                onClick={() => bp === 'awaitingPlayerAttack' ? handlePlayerSecondAttack('atk') : handlePlayerAction('atk')}
                disabled={bp !== 'awaitingAction' && bp !== 'awaitingPlayerAttack'}
                className="px-5 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold rounded-lg text-sm transition-colors">
                ⚔️ Ataque
              </button>
              <button
                onClick={() => bp === 'awaitingPlayerAttack' ? handlePlayerSecondAttack('atkEsp') : handlePlayerAction('atkEsp')}
                disabled={bp !== 'awaitingAction' && bp !== 'awaitingPlayerAttack'}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-bold rounded-lg text-sm transition-colors">
                ✨ Atq.Esp
              </button>
              <button onClick={() => setPendingAtkType(null)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
                ← Voltar
              </button>
            </>
          )}
          {canCapture && (
            <div className="flex flex-col gap-1.5">
              {/* Pokébolas */}
              <div className="flex gap-1 flex-wrap justify-center">
                {Object.entries(inventory.pokebolas ?? {}).filter(([, q]) => q > 0).map(([id, qty]) => {
                  const def = ITEMS_DATA.find((i) => i.id === id);
                  const isSelected = selectedBall === id;
                  return def ? (
                    <button key={id}
                      onClick={() => setSelectedBall(isSelected ? null : id)}
                      disabled={bp !== 'awaitingAction' && bp !== 'awaitingPlayerAttack'}
                      className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40
                        ${isSelected ? 'bg-green-500 text-black ring-2 ring-green-300' : 'bg-green-800 hover:bg-green-700 text-white'}`}>
                      <img src={def.img} alt={def.name} onError={safeImg} className="w-5 h-5 object-contain" />
                      {def.name} ×{qty}
                    </button>
                  ) : null;
                })}
              </div>
              {/* Ballmods */}
              {Object.entries(inventory.ballmods ?? {}).filter(([, q]) => q > 0).length > 0 && (
                <div className="flex gap-1 flex-wrap justify-center">
                  {Object.entries(inventory.ballmods ?? {}).filter(([, q]) => q > 0).map(([id, qty]) => {
                    const def = ITEMS_DATA.find((i) => i.id === id);
                    const isSelected = battle?.selectedBallmod?.id === id;
                    return def ? (
                      <button key={id}
                        onClick={() => setBattle((b) => b ? { ...b, selectedBallmod: isSelected ? null : def } : b)}
                        disabled={bp !== 'awaitingAction' && bp !== 'awaitingPlayerAttack'}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors disabled:opacity-40
                          ${isSelected ? 'bg-blue-500 text-black ring-2 ring-blue-300' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                        <img src={def.img} alt={def.name} onError={safeImg} className="w-4 h-4 object-contain" />
                        {def.name} ×{qty}
                      </button>
                    ) : null;
                  })}
                </div>
              )}
              {/* Capture button */}
              <button
                onClick={() => { if (selectedBall) { handleCapture(selectedBall); setSelectedBall(null); } }}
                disabled={!selectedBall || (bp !== 'awaitingAction' && bp !== 'awaitingPlayerAttack')}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors self-center">
                🎯 Capturar{selectedBall ? ` com ${ITEMS_DATA.find((i) => i.id === selectedBall)?.name}` : ''}
                {battle?.selectedBallmod ? ` + ${battle.selectedBallmod.name}` : ''}
              </button>
            </div>
          )}
        </div>
        )}

        {/* Special Action buttons */}
        {(() => {
          const sa = battle?.sa ?? {};
          const pk = team[activeIdx];
          const isLeg = isLegendary(pk?.nome ?? '');
          const isCT  = battle?.isCTNpc;
          const isBs  = battle?.isBoss;
          const pClassKeys = playerClasses.map((c) => c.powerKey);
          const btns = [];
          if (pClassKeys.includes('cientista') && !sa.cientistUsed)
            btns.push({ key:'criar_pocao', label:'🧪 Criar Poção', color:'bg-green-700 hover:bg-green-600' });
          if (pClassKeys.includes('hipnologo') && (sa.hipnosoCharges ?? 0) > 0)
            btns.push({ key:'hipnose',    label:'💤 Hipnose',     color:'bg-indigo-700 hover:bg-indigo-600' });
          if (pClassKeys.includes('oficial') && !sa.oficialUsed)
            btns.push({ key:'oficial',    label:'📋 Comando',     color:'bg-blue-700 hover:bg-blue-600' });
          if (pClassKeys.includes('ilusionista') && !sa.ilusionistUsed)
            btns.push({ key:'ilusao',     label:'🎭 Ilusão',      color:'bg-violet-700 hover:bg-violet-600' });
          if (pClassKeys.includes('soldado') && !sa.soldadoUsed)
            btns.push({ key:'rambo',      label:'🪖 Rambo',       color:'bg-orange-700 hover:bg-orange-600' });
          if (pClassKeys.includes('monge') && !sa.mongeUsed)
            btns.push({ key:'golpe_duplo',label:'👊 Golpe Duplo', color:'bg-red-800 hover:bg-red-700' });
          if (pClassKeys.includes('bardo') && !sa.bardoUsed && !isLeg)
            btns.push({ key:'inspiracao', label:'🎵 Inspiração',  color:'bg-pink-700 hover:bg-pink-600' });
          if (pClassKeys.includes('ocultista') && !sa.ocultistUsed && !isLeg)
            btns.push({ key:'ocultismo',  label:'🔮 Ocultismo',   color:'bg-purple-800 hover:bg-purple-700' });
          if (pClassKeys.includes('sincrono') && !sa.sincronoUsed)
            btns.push({ key:'sincrono',   label:`🔗 Síncrono+${team.length}d`, color:'bg-teal-700 hover:bg-teal-600' });
          if (pClassKeys.includes('domador') && (sa.domadorCharges ?? 0) > 0 && !isCT && !isBs)
            btns.push({ key:'domar',      label:`🐾 Domar(${sa.domadorCharges})`, color:'bg-green-800 hover:bg-green-700' });
          if (pClassKeys.includes('empatico') && !sa.empaticUsed)
            btns.push({ key:'empatico',   label:'💙 Empatia',     color:'bg-cyan-700 hover:bg-cyan-600' });
          if (pClassKeys.includes('aventureiro') && !sa.aventureiroUsed)
            btns.push({ key:'forrageamento', label:'🌿 Forrageamento', color:'bg-green-700 hover:bg-green-600' });
          if (pClassKeys.includes('ladrao') && isCT && (sa.raptarCharges ?? 0) > 0)
            btns.push({ key:'raptar',     label:`🪝 Raptar(${sa.raptarCharges})`, color:'bg-amber-700 hover:bg-amber-600' });
          if (pClassKeys.includes('estilista') && !sa.estilizarUsed && estilizarCooldown === 0)
            btns.push({ key:'estilizar',  label:'🎨 Estilizar',  color:'bg-rose-700 hover:bg-rose-600' });
          if (pClassKeys.includes('tutor') && !sa.tutorUsed && !sa.tutoriaOverride && team.some((p, i) => i !== activeIdx && p?.vidasAtual > 0))
            btns.push({ key:'tutoria',    label:'📚 Tutoria',    color:'bg-yellow-700 hover:bg-yellow-600' });
          if (pClassKeys.includes('guardiao_mis') && !sa.guardianUsed && !isLeg)
            btns.push({ key:'escudo',     label:'🛡️ Escudo',     color:'bg-blue-700 hover:bg-blue-600' });
          if (pClassKeys.includes('elementalista') && !sa.elementalistaActive && elementalistaCooldown === 0) {
            const elemCls2 = playerClasses.find((c) => c.powerKey === 'elementalista');
            const elemType2 = elemCls2?.elementalistaType ?? '?';
            btns.push({ key:'elementalista', label:`🌀 Elementalista (${elemType2})`, color:'bg-violet-700 hover:bg-violet-600' });
          }
          if (pClassKeys.includes('azarao') && !sa.azaraoUsed && battleSnapshot)
            btns.push({ key:'azarao', label:'🎲 Azarão', color:'bg-orange-600 hover:bg-orange-500' });
          if (btns.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1 justify-center border-t border-gray-700 pt-2">
              <span className="w-full text-center text-gray-500 text-xs mb-0.5">Ações Especiais</span>
              {btns.map(({ key, label, color }) => (
                <button key={key}
                  onClick={() => handleSpecialAction(key)}
                  disabled={bp !== 'awaitingAction'}
                  className={`px-3 py-1.5 ${color} disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors`}>
                  {label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Estilizar cooldown / active type + Nerd vantagem info */}
        {(() => {
          const sa = battle?.sa ?? {};
          const pk = team[activeIdx];
          const pClassKeys = playerClasses.map((c) => c.powerKey);
          const lines = [];
          if (pClassKeys.includes('estilista') && estilizarCooldown > 0)
            lines.push(`🎨 Estilizar em cooldown (${estilizarCooldown} batalha${estilizarCooldown > 1 ? 's' : ''})`);
          if (pClassKeys.includes('elementalista') && elementalistaCooldown > 0)
            lines.push(`🌀 Elementalista em cooldown (${elementalistaCooldown} batalha${elementalistaCooldown > 1 ? 's' : ''})`);
          if (sa.elementalistaActive) {
            const elemClsInfo = playerClasses.find((c) => c.powerKey === 'elementalista');
            if (elemClsInfo?.elementalistaType) lines.push(`🌀 Elementalista ativo: tipo ${elemClsInfo.elementalistaType} adicionado!`);
          }
          if (sa.estilizarExtraType)
            lines.push(`🎨 Tipo extra ativo: ${sa.estilizarExtraType}`);
          if (sa.tutoriaOverride)
            lines.push(`📚 Tutoria pronta: ${sa.tutoriaOverride.pkmNome} (${sa.tutoriaOverride.atkAction === 'atk' ? 'Atk' : 'AtkEsp'}: ${sa.tutoriaOverride.dice}d) — clique Atacar`);
          if (pClassKeys.includes('nerd') && battle) {
            const eTypes = battle.enemyPkm?.types ?? [];
            const hasMatch = team.some((p, i) => i !== activeIdx && p && (p.types ?? []).some((t) => eTypes.includes(t)));
            if (hasMatch) lines.push(`🤓 Nerd: vantagem ativa!`);
          }
          if (lines.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1 justify-center">
              {lines.map((l) => (
                <span key={l} className="text-xs text-gray-400 italic w-full text-center">{l}</span>
              ))}
            </div>
          );
        })()}

        {/* Quick use consumibles */}
        {Object.entries(inventory.consumiveis).filter(([id, q]) => q > 0 && ITEMS_DATA.find((i) => i.id === id)?.category !== 'fruta').length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {battle?.itemUsedThisTurn && (
              <span className="w-full text-center text-gray-500 text-xs">Item já usado neste turno</span>
            )}
            {Object.entries(inventory.consumiveis)
              .filter(([id, q]) => q > 0 && ITEMS_DATA.find((i) => i.id === id)?.category !== 'fruta')
              .map(([id, qty]) => {
                const def = ITEMS_DATA.find((i) => i.id === id);
                return def ? (
                  <button key={id} onClick={() => handleUseItem(id, activeIdx)}
                    disabled={!!(battle?.itemUsedThisTurn)}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs rounded transition-colors">
                    <img src={def.img} alt={def.name} onError={safeImg} className="w-4 h-4 object-contain" />
                    {def.name} ×{qty}
                  </button>
                ) : null;
              })}
          </div>
        )}
      </div>
    );
  };

  // ── PokéCenter Confirmation ───────────────────────────────────
  const renderCenterConfirm = () => (
    <div className="flex flex-col items-center gap-4 py-8">
      <img src="/jn/nursejoy.gif" alt="Nurse Joy" onError={safeImg} className="w-24 h-24 object-contain" />
      <p className="text-pink-400 text-xl font-bold">Pokémon recuperados!</p>
      <p className="text-gray-400 text-sm">Todas as vidas e condições foram restauradas.</p>
      <button onClick={() => handleEncounterComplete(null)}
        className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg">
        Continuar
      </button>
    </div>
  );

  // ── Pokémart ─────────────────────────────────────────────────
  const renderMartScreen = () => {
    const catLabels = { pokeball:'Pokébolas', consumivel:'Consumíveis', fruta:'Frutas', held:'Itens', ballmod:'BallMods' };
    const discount  = hasClassPower('contrabandista') ? 0.75 : 1;
    const invMap    = { pokeball:'pokebolas', consumivel:'consumiveis', fruta:'frutas', held:'held', ballmod:'ballmods' };

    // Build list of all owned items for the sell tab
    const ownedItems = ITEMS_DATA.flatMap((item) => {
      const cat = invMap[item.category] ?? 'consumiveis';
      const qty = inventory[cat]?.[item.id] ?? 0;
      return qty > 0 ? [{ item, qty, cat }] : [];
    });

    const handleSellItem = (itemId, cat) => {
      const itemDef = ITEMS_DATA.find((i) => i.id === itemId);
      if (!itemDef) return;
      const sellPrice = itemId === 'foto'
        ? (Math.ceil(Math.random() * 12) + Math.ceil(Math.random() * 12)) * 100
        : Math.floor(itemDef.price * 0.5);
      setInventory((inv) => ({ ...inv, [cat]: { ...inv[cat], [itemId]: Math.max(0, (inv[cat][itemId] ?? 1) - 1) } }));
      setMoney((m) => m + sellPrice);
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-yellow-400 font-bold text-lg">🏪 Pokémart</p>
          <p className="text-yellow-300 font-bold">💰 {money}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(catLabels).map(([k, v]) => (
            <button key={k} onClick={() => setMartCat(k)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors
                ${martCat === k ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              {v}
            </button>
          ))}
          <button onClick={() => setMartCat('sell')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors
              ${martCat === 'sell' ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            Vender
          </button>
        </div>

        {martCat === 'sell' ? (
          <div className="flex flex-col gap-2">
            {ownedItems.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">Nenhum item para vender.</p>
            )}
            {ownedItems.map(({ item, qty, cat }) => {
              const sellPrice = Math.floor(item.price * 0.5);
              return (
                <div key={item.id} className="bg-gray-800 rounded-xl p-3 flex gap-2 items-center">
                  <img src={item.img} alt={item.name} onError={safeImg} className="w-8 h-8 object-contain shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold">{item.name}</p>
                    <p className="text-gray-500 text-xs">×{qty} em estoque</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-green-400 text-xs font-bold">💰{sellPrice}</span>
                    <button onClick={() => handleSellItem(item.id, cat)}
                      className="px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition-colors">
                      Vender 1
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {martStock.filter((i) => i.category === martCat).map((item) => {
              const price = Math.floor(item.price * discount);
              const owned = (inventory[invMap[item.category]]?.[item.id] ?? 0);
              return (
                <div key={item.id} className="bg-gray-800 rounded-xl p-3 flex gap-2 items-start">
                  <img src={item.img} alt={item.name} onError={safeImg} className="w-10 h-10 object-contain shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold">{item.name}</p>
                    <p className="text-gray-400 text-xs leading-tight mb-1">{item.desc}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-300 text-xs font-bold">💰{price}</span>
                      <span className="text-gray-500 text-xs">×{owned}</span>
                      <button onClick={() => handleBuyItem(item.id)}
                        disabled={money < price || (item.id === 'masterball' && (inventory.pokebolas.masterball ?? 0) >= 1) || (item.category === 'pokeball' && (inventory.pokebolas[item.id] ?? 0) >= 10)}
                        className="ml-auto px-2 py-0.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded transition-colors">
                        Comprar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={() => handleEncounterComplete(null)}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg mt-2">
          Sair da loja
        </button>
      </div>
    );
  };

  // ── Reward Screen ─────────────────────────────────────────────
  const renderRewardScreen = () => {
    const reward = STAGE_MONEY_REWARDS[Math.min(stage, STAGE_MONEY_REWARDS.length - 1)];
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-yellow-400 text-2xl font-bold">🏁 Estágio {stage} concluído!</p>
        <p className="text-green-400 text-lg font-bold">+💰 {reward}</p>
        {capturedInEncounter && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-gray-300 text-sm">Captura:</p>
            <PkmCard pkm={capturedInEncounter} small />
          </div>
        )}
        <button onClick={handleStageComplete}
          className="px-8 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-all hover:scale-105">
          Próximo estágio ▶
        </button>
      </div>
    );
  };

  // ── End Run Screens ───────────────────────────────────────────
  const renderEndScreen = (won) => {
    const modeId = gameMode?.id ?? 'jornada';
    const score = modeId === 'pocket'
      ? calcPocketScore({ runStats, team, money })
      : calcScore({ stage, captures: runStats.captures, money, turnsTotal: runStats.turnsTotal });
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center py-10 px-4">
        {won
          ? <p className="text-yellow-400 text-4xl font-bold mb-2">🏆 VITÓRIA!</p>
          : <p className="text-red-400   text-4xl font-bold mb-2">💀 DERROTA</p>
        }
        <p className="text-gray-400 text-sm mb-6">{gameMode?.name} · {currentUser?.username}</p>

        <div className="bg-gray-800 rounded-2xl p-6 flex flex-col gap-3 w-full max-w-sm mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Estágios</span>
            <span className="text-white font-bold">{stage}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Capturas</span>
            <span className="text-white font-bold">{runStats.captures}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Turnos</span>
            <span className="text-white font-bold">{runStats.turnsTotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Dinheiro</span>
            <span className="text-yellow-300 font-bold">💰 {money}</span>
          </div>
          <hr className="border-gray-700" />
          <div className="flex justify-between">
            <span className="text-yellow-400 font-bold">Score</span>
            <span className="text-yellow-400 font-bold text-xl">{score.toLocaleString()}</span>
          </div>
        </div>

        {/* Final team display */}
        {team.length > 0 && (
          <div className="w-full max-w-sm mb-6">
            <p className="text-gray-400 text-xs text-center mb-2 uppercase tracking-wider">Time Final</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {team.map((p, i) => (
                <div key={i} className="flex flex-col items-center bg-gray-800 rounded-xl p-2 gap-1">
                  <div className="relative">
                    {p.isShiny && (
                      <img src="/jn/sparlkeshin.png" alt="shiny" onError={safeImg}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                    )}
                    <img src={p.imageUrl ?? getPokemonImageUrl(p.dexNumber, false)}
                      alt={p.nome} onError={safeImg}
                      className="relative z-10 w-14 h-14 object-contain" />
                    {p.vidasAtual <= 0 && (
                      <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
                        <span className="text-red-400 text-lg">💀</span>
                      </div>
                    )}
                  </div>
                  <p className="text-white text-xs font-bold text-center leading-tight max-w-[4rem] truncate">{p.nome}</p>
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {(p.types ?? []).map((t) => <TypeBadge key={t} type={t} />)}
                  </div>
                  <p className="text-gray-400 text-xs">Nv.{p.level}{p.isShiny ? ' ✨' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentUser?.isGuest && (
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)}
            placeholder="Seu nome para o ranking..."
            className="w-full max-w-sm px-4 py-2 mb-4 rounded-lg bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-yellow-400 text-sm" />
        )}

        <div className="flex gap-3">
          <button onClick={() => handleEndRun(won)}
            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg">
            Salvar Score
          </button>
          <button onClick={handleReturnToLogin}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg">
            Menu Principal
          </button>
        </div>
      </div>
    );
  };

  // ── Artífice stage-recharge choice screen ─────────────────────
  const renderArtificeStageChoice = () => {
    const eligible = team.filter((p) => !artificeEquipped[p.uid]);
    const ready = artificeSelected.uid && artificeSelected.item;
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-rose-400 text-xl font-bold">⚔️ Cyber Artífice — Novo Item!</p>
        <p className="text-gray-300 text-sm text-center">Escolha um Pokémon sem item e equipe armadura ou espada:</p>
        {eligible.length === 0 ? (
          <p className="text-yellow-400 text-sm">Todos os Pokémon já têm um item equipado.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {eligible.map((p) => (
                <button key={p.uid}
                  onClick={() => setArtificeSelected((prev) => ({ ...prev, uid: prev.uid === p.uid ? null : p.uid }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${artificeSelected.uid === p.uid ? 'border-rose-400 bg-rose-900/20 text-white' : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-rose-400'}`}>
                  <span className="font-bold text-sm">{p.nome}</span>
                  <span className="text-xs text-gray-400 ml-2">{(p.types ?? []).join('/')}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => setArtificeSelected((prev) => ({ ...prev, item: 'armadura' }))}
                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${artificeSelected.item === 'armadura' ? 'border-blue-400 bg-blue-900/30 text-blue-300' : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-blue-400'}`}>
                🛡️ Armadura (+1d Def/DefEsp)
              </button>
              <button
                onClick={() => setArtificeSelected((prev) => ({ ...prev, item: 'espada' }))}
                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${artificeSelected.item === 'espada' ? 'border-red-400 bg-red-900/30 text-red-300' : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-red-400'}`}>
                ⚔️ Espada (+1d Atk/AtkEsp)
              </button>
            </div>
            <button disabled={!ready}
              onClick={() => {
                handleApplyArtificeChoice(artificeSelected.uid, artificeSelected.item);
                setPhase('map');
              }}
              className={`px-8 py-2 font-bold rounded-lg transition-all ${ready ? 'bg-rose-500 hover:bg-rose-400 text-white hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
              Confirmar
            </button>
          </>
        )}
        <button onClick={() => { setArtificeCredits((c) => Math.max(0, c - 1)); setPhase('map'); }}
          className="text-gray-500 text-xs hover:text-gray-300 underline">
          Pular
        </button>
      </div>
    );
  };

  // ── Bandido item-at-cap choice screen ─────────────────────────
  const renderBandidoItemChoice = () => {
    if (!pendingBandidoReward) return null;
    const { found } = pendingBandidoReward;
    const STACK_MAX = 3;
    // Flatten current items to choose from for replacement
    const currentItems = [];
    ['consumiveis', 'frutas', 'held'].forEach((cat) => {
      Object.entries(inventory[cat] || {}).forEach(([id, count]) => {
        if (count <= 0) return;
        const def = ITEMS_DATA.find((i) => i.id === id);
        if (!def) return;
        let remaining = count;
        while (remaining > 0) {
          currentItems.push({ id, cat, def, count: Math.min(remaining, STACK_MAX) });
          remaining -= STACK_MAX;
        }
      });
    });
    const resolve = (newInventory) => {
      if (newInventory) setInventory(newInventory);
      setPendingBandidoReward(null);
      setPhase('battle');
    };
    let foundCat = 'consumiveis';
    if (found.category === 'held')  foundCat = 'held';
    if (found.category === 'fruta') foundCat = 'frutas';
    const tierColors = { S: 'text-yellow-400', A: 'text-purple-400', B: 'text-blue-400', C: 'text-gray-300' };
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-green-400 text-xl font-bold">🔫 Bandido — Item Encontrado!</p>
        <div className="flex flex-col items-center gap-1 bg-gray-800 rounded-xl p-3">
          <img src={found.img ?? `/jn/items/${found.id}.png`} alt={found.name} onError={safeImg} className="w-12 h-12 object-contain" />
          <p className="text-white font-bold text-sm">{found.name}</p>
          <p className={`text-xs font-bold ${tierColors[found.tier] ?? 'text-gray-300'}`}>Tier {found.tier}</p>
          <p className="text-gray-400 text-xs text-center">{found.desc}</p>
        </div>
        <p className="text-yellow-400 text-sm text-center">Inventário cheio! Substitua um item ou descarte o encontrado:</p>
        <div className="flex flex-col gap-2 w-full max-w-sm">
          {currentItems.map((item, i) => (
            <button key={`${item.id}-${i}`}
              onClick={() => {
                const newInv = { ...inventory,
                  [item.cat]: { ...inventory[item.cat], [item.id]: Math.max(0, (inventory[item.cat]?.[item.id] ?? 1) - 1) },
                  [foundCat]:  { ...inventory[foundCat],  [found.id]:  (inventory[foundCat]?.[found.id]  ?? 0) + 1 },
                };
                resolve(newInv);
              }}
              className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-600 bg-gray-800 hover:border-green-400 text-left transition-all">
              <img src={item.def?.img ?? `/jn/items/${item.id}.png`} alt={item.def?.name} onError={safeImg} className="w-8 h-8 object-contain shrink-0" />
              <div>
                <p className="text-white text-sm font-bold">{item.def?.name ?? item.id}</p>
                <p className="text-gray-400 text-xs">Substituir por {found.name}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={() => resolve(null)}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold rounded-lg">
          Descartar {found.name}
        </button>
      </div>
    );
  };

  // ── Pokébolista ballmod-at-cap choice screen ───────────────────
  const renderBallmodChoice = () => {
    if (!pendingBallmodReward) return null;
    const { found, returnPhase, needsMapCleanup } = pendingBallmodReward;
    const ownedBallmods = ITEMS_DATA.filter(
      (i) => i.category === 'ballmod' && (inventory.ballmods?.[i.id] ?? 0) > 0
    );
    const resolve = (newInventory) => {
      if (newInventory) setInventory(newInventory);
      setPendingBallmodReward(null);
      if (needsMapCleanup) {
        setCapturedInEncounter(null);
        setCurrentEncounter(null);
        setBattle(null);
        setBattleLog([]);
      }
      setPhase(returnPhase);
    };
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-blue-400 text-xl font-bold">🎯 Pokébolista — Ballmod Encontrada!</p>
        <div className="flex flex-col items-center gap-1 bg-gray-800 rounded-xl p-3">
          <img src={found.img} alt={found.name} onError={safeImg} className="w-12 h-12 object-contain" />
          <p className="text-white font-bold text-sm">{found.name}</p>
          <p className="text-gray-400 text-xs text-center">{found.desc}</p>
        </div>
        <p className="text-yellow-400 text-sm text-center">Slots cheios! Substitua uma ballmod ou descarte a encontrada:</p>
        <div className="flex flex-col gap-2 w-full max-w-sm">
          {ownedBallmods.map((bm) => (
            <button key={bm.id}
              onClick={() => {
                const newInv = {
                  ...inventory,
                  ballmods: {
                    ...inventory.ballmods,
                    [bm.id]: Math.max(0, (inventory.ballmods?.[bm.id] ?? 1) - 1),
                    [found.id]: (inventory.ballmods?.[found.id] ?? 0) + 1,
                  },
                };
                resolve(newInv);
              }}
              className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-600 bg-gray-800 hover:border-yellow-400 text-left transition-all">
              <img src={bm.img} alt={bm.name} onError={safeImg} className="w-8 h-8 object-contain shrink-0" />
              <div>
                <p className="text-white text-sm font-bold">{bm.name}</p>
                <p className="text-gray-400 text-xs">Substituir por {found.name}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={() => resolve(null)}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold rounded-lg">
          Descartar {found.name}
        </button>
      </div>
    );
  };

  // ── Center content router ─────────────────────────────────────
  const renderCenterForPhase = () => {
    if (phase === 'battle')         return renderBattleCenter();
    if (phase === 'mart')           return renderMartScreen();
    if (phase === 'center')         return renderCenterConfirm();
    if (phase === 'reward')         return renderRewardScreen();
    if (phase === 'ballmod_choice')       return renderBallmodChoice();
    if (phase === 'bandido_item_choice')  return renderBandidoItemChoice();
    if (phase === 'criador_ovo_choice')   return renderCriadorOvoChoice();
    const pClassKeys = playerClasses.map((c) => c.powerKey);
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <p className="text-sm">Escolha um local no mapa acima para avançar.</p>
        {/* Cyber Cozinheiro / Cuidador / Orador map-phase actions */}
        {((pClassKeys.includes('cozinheiro') && cozinheiroCharges > 0) || (pClassKeys.includes('cuidador') && cuidadorCharges > 0) || (pClassKeys.includes('orador') && !oradorUsed && team.length > 0)) ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {pClassKeys.includes('cozinheiro') && cozinheiroCharges > 0 && (
              <button onClick={() => setShowAlimentarModal(true)}
                className="px-3 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors">
                🍽️ Alimentar ({cozinheiroCharges} cargas)
              </button>
            )}
            {pClassKeys.includes('cuidador') && cuidadorCharges > 0 && (
              <button onClick={() => setShowMimarModal(true)}
                className="px-3 py-1.5 bg-pink-700 hover:bg-pink-600 text-white text-xs font-bold rounded-lg transition-colors">
                🤗 Mimar ({cuidadorCharges} cargas)
              </button>
            )}
            {pClassKeys.includes('orador') && !oradorUsed && team.length > 0 && (
              <button onClick={() => setShowOradorModal(true)}
                className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg transition-colors">
                📣 Clamor
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  // ── Criador Ovo Choice ─────────────────────────────────────────
  const renderCriadorOvoChoice = () => {
    const canConfirm = criadorTypes.length === 4;
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-4">
        <div className="text-4xl">🥚</div>
        <h3 className="text-yellow-400 font-bold text-lg text-center">Pokéovo encontrado!</h3>
        <p className="text-gray-300 text-sm text-center">Escolha <span className="text-white font-bold">4 tipos</span> para determinar o pokémon que vai chocar:</p>
        <div className="grid grid-cols-3 gap-1.5 w-full max-w-xs">
          {TYPES.map((t) => {
            const sel = criadorTypes.includes(t);
            return (
              <button key={t} onClick={() => {
                setCriadorTypes((prev) => {
                  if (sel) return prev.filter((x) => x !== t);
                  if (prev.length >= 4) return prev;
                  return [...prev, t];
                });
              }}
                className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition-colors
                  ${sel ? 'border-yellow-400 bg-yellow-700 text-white' : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400'}`}>
                {t}
              </button>
            );
          })}
        </div>
        <p className="text-gray-500 text-xs">{criadorTypes.length}/4 selecionados</p>
        <button disabled={!canConfirm} onClick={() => handleCriadorConfirm(criadorTypes)}
          className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-bold rounded-lg transition-colors">
          🥚 Chocar!
        </button>
      </div>
    );
  };

  // ── Incubador choice modal ─────────────────────────────────────
  const renderIncubadorModal = () => {
    if (!pendingIncubadorChoice) return null;
    const pkm = team[pendingIncubadorChoice.pkmIdx];
    const STAT_OPTIONS = [
      { key: 'atk', label: 'Ataque' }, { key: 'def', label: 'Defesa' },
      { key: 'atkEsp', label: 'Atk. Esp.' }, { key: 'defEsp', label: 'Def. Esp.' },
      { key: 'vel', label: 'Velocidade' }, { key: 'vidasMax', label: 'Vida (PS)' },
    ];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-green-500 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl">
          <h3 className="text-green-400 font-bold text-center text-lg">🥚 Cyber Incubador</h3>
          <p className="text-gray-300 text-sm text-center">
            <span className="text-white font-bold">{pkm?.nome ?? '?'}</span> chocou! Escolha um atributo para receber <span className="text-green-300 font-bold">+10</span>:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STAT_OPTIONS.map(({ key, label }) => (
              <button key={key} onClick={() => handleIncubadorChoice(key)}
                className="px-3 py-2 bg-green-700 hover:bg-green-500 text-white text-sm rounded-lg font-bold transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Alimentar modal (Cozinheiro) ───────────────────────────────
  const renderAlimentarModal = () => {
    if (!showAlimentarModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-orange-500 rounded-2xl p-5 w-80 flex flex-col gap-4 shadow-2xl">
          <h3 className="text-orange-400 font-bold text-center text-lg">🍽️ Alimentar ({cozinheiroCharges} cargas)</h3>
          <p className="text-gray-300 text-sm text-center">Escolha como alimentar:</p>
          <button onClick={() => handleCozinheiroAlimentar('all')}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm rounded-lg transition-colors">
            +1 vida em todos
          </button>
          <p className="text-gray-500 text-xs text-center">— ou escolha um pokémon (+3 vida) —</p>
          <div className="flex flex-col gap-1">
            {team.map((p, i) => p ? (
              <button key={p.uid} onClick={() => handleCozinheiroAlimentar('single', i)}
                className="flex justify-between items-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">
                <span>{p.nome}</span>
                <span className="text-orange-300">{p.vidasAtual}/{p.vidasMax} vida(s) → {Math.min(p.vidasMax, p.vidasAtual+3)}</span>
              </button>
            ) : null)}
          </div>
          <button onClick={() => setShowAlimentarModal(false)} className="text-gray-500 hover:text-gray-300 text-xs text-center">Cancelar</button>
        </div>
      </div>
    );
  };

  // ── Mimar modal (Cuidador) ─────────────────────────────────────
  const renderMimarModal = () => {
    if (!showMimarModal) return null;
    const activePkm = team[activeIdx];
    const STAT_OPTIONS = [
      { key: 'atk', label: 'Ataque' }, { key: 'def', label: 'Defesa' },
      { key: 'atkEsp', label: 'Atk. Esp.' }, { key: 'defEsp', label: 'Def. Esp.' },
      { key: 'vel', label: 'Velocidade' },
    ];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-pink-500 rounded-2xl p-5 w-80 flex flex-col gap-4 shadow-2xl">
          <h3 className="text-pink-400 font-bold text-center text-lg">🤗 Mimar ({cuidadorCharges} cargas)</h3>
          <p className="text-gray-300 text-sm text-center">
            Escolha o atributo de <span className="text-white font-bold">{activePkm?.nome ?? '?'}</span> para receber <span className="text-pink-300 font-bold">+2d</span> no próximo encontro:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STAT_OPTIONS.map(({ key, label }) => (
              <button key={key} onClick={() => handleCuidadorMimar(key)}
                className="px-3 py-2 bg-pink-700 hover:bg-pink-500 text-white text-sm rounded-lg font-bold transition-colors">
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowMimarModal(false)} className="text-gray-500 hover:text-gray-300 text-xs text-center">Cancelar</button>
        </div>
      </div>
    );
  };

  // ── Escudo modal (Guardião, in-battle) ────────────────────────
  const renderEscudoModal = () => {
    if (!showEscudoModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-blue-500 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl">
          <h3 className="text-blue-400 font-bold text-center text-lg">🛡️ Escudo</h3>
          <p className="text-gray-300 text-sm text-center">Escolha um atributo para receber <span className="text-blue-300 font-bold">+1 dado</span> nesta batalha:</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => handleEscudoConfirm('def')}
              className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-500 text-white font-bold text-sm rounded-lg transition-colors">
              🛡️ Defesa
            </button>
            <button onClick={() => handleEscudoConfirm('defEsp')}
              className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-500 text-white font-bold text-sm rounded-lg transition-colors">
              ✨ Def. Esp.
            </button>
          </div>
          <button onClick={() => setShowEscudoModal(false)} className="text-gray-500 hover:text-gray-300 text-xs text-center">Cancelar</button>
        </div>
      </div>
    );
  };

  // ── Orador modal (map-phase) ───────────────────────────────────
  const renderOradorModal = () => {
    if (!showOradorModal) return null;
    const legPool = _basePool().filter((p) => isLegendary(p.nome));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-yellow-500 rounded-2xl p-6 w-96 flex flex-col gap-4 shadow-2xl" style={{ maxHeight: '80vh' }}>
          <h3 className="text-yellow-400 font-bold text-center text-lg">📣 Clamor do Orador</h3>
          <p className="text-gray-300 text-sm text-center">
            Sacrifique <span className="text-red-300 font-bold">{team.length} pokémon(s)</span> e receba um lendário Nv.90 com{' '}
            <span className="text-yellow-300 font-bold">+{team.length}d</span> em todos os atributos:
          </p>
          <div className="overflow-y-auto flex flex-col gap-1.5" style={{ maxHeight: '50vh' }}>
            {legPool.map((p) => (
              <button key={p.dexNumber ?? p.nome} onClick={() => handleOradorClamor(p)}
                className="px-3 py-2 bg-yellow-800 hover:bg-yellow-600 text-white text-sm font-bold rounded-lg text-left transition-colors">
                🌟 {p.nome}
              </button>
            ))}
          </div>
          <button onClick={() => setShowOradorModal(false)} className="text-gray-500 hover:text-gray-300 text-xs text-center">Cancelar</button>
        </div>
      </div>
    );
  };

  // ── Cientista modal (in-battle, criar poção) ──────────────────────
  const renderCientistModal = () => {
    if (!showCientistModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-green-500 rounded-2xl p-6 w-72 flex flex-col gap-4 shadow-2xl">
          <h3 className="text-green-400 font-bold text-center text-lg">🧪 Criar Poção</h3>
          <p className="text-gray-300 text-sm text-center">Escolha a poção a criar (vai direto ao inventário):</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => handleCientistCriar('pocao_menor')}
              className="px-4 py-2 bg-green-800 hover:bg-green-600 text-white font-bold text-sm rounded-lg transition-colors">
              🧪 Poção Menor (+1 vida)
            </button>
            <button onClick={() => handleCientistCriar('pocao_maior')}
              className="px-4 py-2 bg-green-700 hover:bg-green-500 text-white font-bold text-sm rounded-lg transition-colors">
              🧪 Poção Maior (+2 vidas)
            </button>
            <button onClick={() => handleCientistCriar('pocao_suprema')}
              className="px-4 py-2 bg-green-600 hover:bg-green-400 text-white font-bold text-sm rounded-lg transition-colors">
              🧪 Poção Suprema (+3 vidas)
            </button>
          </div>
          <button onClick={() => setShowCientistModal(false)} className="text-gray-500 hover:text-gray-300 text-xs text-center">Cancelar</button>
        </div>
      </div>
    );
  };

  // ── Auto-join swap modal (Místico/Rúnico/Xamã, time cheio) ────────
  const renderAutoJoinSwapModal = () => {
    if (!showAutoJoinSwapModal || !pendingAutoJoin) return null;
    const { pkm } = pendingAutoJoin;
    const autoIsLeg = isLegendary(pkm.nome);
    const icon = autoIsLeg ? '🌟' : pkm.nome?.toLowerCase().startsWith('unown') ? '🔤' : '👻';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-yellow-500 rounded-2xl p-6 w-96 flex flex-col gap-4 shadow-2xl" style={{ maxHeight: '85vh' }}>
          <h3 className="text-yellow-400 font-bold text-center text-lg">{icon} Time Cheio!</h3>
          <p className="text-gray-300 text-sm text-center">
            <span className="text-yellow-300 font-bold">{pkm.nome}{pkm.isShiny ? ' ✨' : ''}</span> quer se juntar, mas o time está cheio.
          </p>
          {autoJoinSwapStep === 'choice' ? (
            <div className="flex flex-col gap-3 mt-1">
              <button
                onClick={() => setAutoJoinSwapStep('select')}
                className="px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition-colors text-sm">
                Liberar um pokémon para dar lugar
              </button>
              <button
                onClick={handleAutoJoinSwapCancel}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold rounded-xl transition-colors text-sm">
                Deixar o pokémon ir embora
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-400 text-xs text-center">Escolha qual pokémon liberar:</p>
              <div className="overflow-y-auto flex flex-col gap-1.5" style={{ maxHeight: '40vh' }}>
                {team.map((p) => (
                  <button key={p.uid} onClick={() => handleAutoJoinSwapConfirm(p.uid)}
                    className="px-3 py-2 bg-red-800 hover:bg-red-600 text-white text-sm font-bold rounded-lg text-left transition-colors">
                    ❌ {p.nome} (Nv.{p.level ?? '?'})
                  </button>
                ))}
              </div>
              <button onClick={() => setAutoJoinSwapStep('choice')} className="text-gray-500 hover:text-gray-300 text-xs text-center">
                ← Voltar
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Tutoria modal (in-battle) ──────────────────────────────────
  const renderTutoriaModal = () => {
    if (!pendingTutoria) return null;
    const inactives = team.filter((p, i) => i !== activeIdx && p?.vidasAtual > 0);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-yellow-500 rounded-2xl p-5 w-80 flex flex-col gap-3 shadow-2xl max-h-[90vh] overflow-y-auto">
          <h3 className="text-yellow-400 font-bold text-center text-lg">📚 Tutoria</h3>
          <p className="text-gray-300 text-sm text-center">Escolha o pokémon e o golpe a emprestar:</p>
          {inactives.map((p) => {
            const realIdx = team.indexOf(p);
            return (
              <div key={p.uid} className="flex flex-col gap-1 bg-gray-800 rounded-lg p-2">
                <span className="text-white text-xs font-bold">{p.nome} (Nv.{p.level})</span>
                <div className="flex gap-1">
                  <button onClick={() => handleTutoriaConfirm(realIdx, 'atk')}
                    className="flex-1 px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition-colors">
                    ⚔️ Atk ({p.diceBase?.atk ?? 1}d)
                  </button>
                  <button onClick={() => handleTutoriaConfirm(realIdx, 'atkEsp')}
                    className="flex-1 px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded transition-colors">
                    ✨ AtkEsp ({p.diceBase?.atkEsp ?? 1}d)
                  </button>
                </div>
              </div>
            );
          })}
          <button onClick={() => setPendingTutoria(false)} className="text-gray-500 hover:text-gray-300 text-xs text-center">Cancelar</button>
        </div>
      </div>
    );
  };

  // ── Evo Stone modal ───────────────────────────────────────────
  const renderEvoStoneModal = () => {
    if (!pendingEvoStone) return null;
    const targetPkm = team[pendingEvoStone.targetIdx];
    const STAT_OPTIONS = [
      { key: 'atk',     label: 'Ataque' },
      { key: 'def',     label: 'Defesa' },
      { key: 'atkEsp',  label: 'Atk. Esp.' },
      { key: 'defEsp',  label: 'Def. Esp.' },
      { key: 'vel',     label: 'Velocidade' },
      { key: 'vidasMax', label: 'Vida (PS)' },
    ];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-yellow-500 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl">
          <h3 className="text-yellow-400 font-bold text-center text-lg">✨ Pedra Evolutiva</h3>
          <p className="text-gray-300 text-sm text-center">
            Escolha o atributo de <span className="text-white font-bold">{targetPkm?.nome ?? '?'}</span> para receber <span className="text-yellow-300 font-bold">+{hasClassPower('evolucionista') ? 5 : 3}</span>:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STAT_OPTIONS.map(({ key, label }) => (
              <button key={key} onClick={() => handleApplyEvoStone(key)}
                className="px-3 py-2 bg-yellow-700 hover:bg-yellow-500 text-white text-sm rounded-lg font-bold transition-colors">
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setPendingEvoStone(null)}
            className="text-gray-500 hover:text-gray-300 text-xs text-center mt-1">
            Cancelar
          </button>
        </div>
      </div>
    );
  };

  // ── Incense type selector modal ───────────────────────────────
  const renderIncenseModal = () => {
    if (!pendingIncense) return null;
    const { effect, multiType, selectedTypes } = pendingIncense;
    const maxSel = multiType ? 2 : 1;
    const canConfirm = selectedTypes.length >= 1;
    const titleMap = {
      incenso_tipo:            '🌸 Incenso — Escolha o tipo (+30%)',
      incenso_tipo_garantido:  '🌿 Incenso Verde — Escolha o tipo (garantido)',
      incenso_shiny_tipo:      '✨ Incenso de Porpurina — Escolha o tipo',
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-green-600 rounded-2xl p-5 w-96 flex flex-col gap-4 shadow-2xl">
          <h3 className="text-green-300 font-bold text-center text-sm">{titleMap[effect]}</h3>
          {multiType && <p className="text-gray-400 text-xs text-center">Selecione até 2 tipos</p>}
          <div className="grid grid-cols-3 gap-1.5">
            {TYPES.map((t) => {
              const sel = selectedTypes.includes(t);
              return (
                <button key={t} onClick={() => {
                  setPendingIncense((prev) => {
                    if (!prev) return prev;
                    let next;
                    if (sel) {
                      next = prev.selectedTypes.filter((x) => x !== t);
                    } else if (prev.selectedTypes.length < maxSel) {
                      next = [...prev.selectedTypes, t];
                    } else if (maxSel === 1) {
                      next = [t];
                    } else {
                      return prev; // already 2 selected
                    }
                    return { ...prev, selectedTypes: next };
                  });
                }}
                  className={`px-2 py-1.5 text-xs font-bold rounded-lg transition-colors border
                    ${sel ? 'border-green-400 bg-green-700 text-white' : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400'}`}>
                  {t}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 justify-center">
            <button disabled={!canConfirm} onClick={() => handleActivateIncense(pendingIncense.selectedTypes)}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors">
              Confirmar
            </button>
            <button onClick={() => setPendingIncense(null)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Forrageamento held-full modal ─────────────────────────────
  const renderForrageamentoModal = () => {
    if (!pendingForrageamento) return null;
    const { berry, consumivel } = pendingForrageamento;
    const activePkm = team[activeIdx];
    const heldArr = activePkm
      ? (Array.isArray(activePkm.heldItem) ? activePkm.heldItem : (activePkm.heldItem ? [activePkm.heldItem] : []))
      : [];
    const resolve = () => {
      // Also add bonus consumivel to inventory if any
      if (consumivel) {
        setInventory((inv) => ({
          ...inv,
          consumiveis: { ...inv.consumiveis, [consumivel.id]: (inv.consumiveis[consumivel.id] ?? 0) + 1 },
        }));
        setBattleLog((prev) => [...prev, `🎁 ${consumivel.name} adicionado ao inventário!`]);
      }
      setPendingForrageamento(null);
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 border border-green-500 rounded-2xl p-5 w-80 flex flex-col gap-3 shadow-2xl">
          <h3 className="text-green-400 font-bold text-center text-lg">🌿 Forrageamento</h3>
          <div className="flex flex-col items-center gap-1 bg-gray-800 rounded-xl p-3">
            <img src={berry.img ?? `/frutas/${berry.id}.png`} alt={berry.name} onError={safeImg} className="w-12 h-12 object-contain" />
            <p className="text-white font-bold text-sm">{berry.name}</p>
            <p className="text-gray-400 text-xs text-center">{berry.desc}</p>
          </div>
          <p className="text-yellow-400 text-sm text-center">
            {activePkm?.nome ?? '?'} não tem slot held disponível! Substitua um item ou descarte a fruta:
          </p>
          <div className="flex flex-col gap-2">
            {heldArr.map((h, hi) => (
              <button key={hi}
                onClick={() => {
                  if (!activePkm) return;
                  const newHeld = heldArr.map((x, xi) => xi === hi ? berry : x);
                  const normalizedHeld = newHeld.length === 1 ? newHeld[0] : newHeld;
                  setTeam((prev) => prev.map((p, idx) => idx === activeIdx ? { ...p, heldItem: normalizedHeld } : p));
                  setBattle((b) => b ? { ...b, playerPkm: { ...b.playerPkm, heldItem: normalizedHeld } } : b);
                  setInventory((inv) => ({ ...inv, held: { ...inv.held, [h.id]: (inv.held[h.id] ?? 0) + 1 } }));
                  setBattleLog((prev) => [...prev, `🫐 ${berry.name} equipada em ${activePkm.nome} (substituindo ${h.name})!`]);
                  resolve();
                }}
                className="flex items-center gap-3 p-2 rounded-xl border border-gray-600 bg-gray-800 hover:border-green-400 text-left transition-all">
                <img src={h.img ?? `/jn/items/${h.id}.png`} alt={h.name} onError={safeImg} className="w-8 h-8 object-contain shrink-0" />
                <div>
                  <p className="text-white text-sm font-bold">{h.name}</p>
                  <p className="text-gray-400 text-xs">Remover e equipar {berry.name}</p>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => {
            setBattleLog((prev) => [...prev, `🌿 ${berry.name} descartada.`]);
            resolve();
          }}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold rounded-lg">
            Descartar {berry.name}
          </button>
        </div>
      </div>
    );
  };

  // ── Main return ───────────────────────────────────────────────
  return (
    <div className="jornada-root">
      {phase === 'login'        && renderLogin()}
      {phase === 'modeSelect'   && renderModeSelect()}
      {phase === 'classSelect'  && renderClassSelect()}
      {phase === 'starterSelect'&& renderStarterSelect()}
      {['map','battle','mart','center','reward','switchPokemon','ballmod_choice','bandido_item_choice','criador_ovo_choice'].includes(phase)
        && renderGameScreen(renderCenterForPhase())}
      {phase === 'artifice_stage_choice' && renderGameScreen(renderArtificeStageChoice())}
      {phase === 'gameover' && renderEndScreen(false)}
      {phase === 'victory'  && renderEndScreen(true)}
      {renderEvoStoneModal()}
      {renderIncenseModal()}
      {renderIncubadorModal()}
      {renderAlimentarModal()}
      {renderMimarModal()}
      {renderTutoriaModal()}
      {renderCientistModal()}
      {renderAutoJoinSwapModal()}
      {renderEscudoModal()}
      {renderOradorModal()}
      {renderForrageamentoModal()}
      {showEnciclopedia && renderEnciclopedia()}
    </div>
  );
}
