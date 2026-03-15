// ============================================================
// JORNADA NIAYPETA — Roguelite Pokémon Minigame
// Part 1: Constants & Data
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import pokedexData from './pokemonData.js';
import { database } from './firebase.js';
import { ref, get, set, update } from 'firebase/database';

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
export const LEGENDARY_DEX_NUMBERS = new Set([
  // Gen 1
  144,145,146,150,151,
  // Gen 2
  243,244,245,249,250,251,
  // Gen 3
  377,378,379,380,381,382,383,384,385,386,
  // Gen 4
  480,481,482,483,484,485,486,487,488,489,490,491,492,493,
  // Gen 5
  494,638,639,640,641,642,643,644,645,646,647,648,649,
  // Gen 6
  716,717,718,719,720,721,
  // Gen 7
  785,786,787,788,789,790,791,792,800,801,802,
]);

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
    img:'/jn/items/pokebola.png',   ballDice:5,
    desc:'Bola padrão de captura. Rola 5d4.' },
  { id:'greatball',  category:'pokeball', tier:'B', name:'Greatball', price:1000,
    img:'/jn/items/greatball.png',  ballDice:7,
    desc:'Boa taxa de captura. Rola 7d4.' },
  { id:'ultraball',  category:'pokeball', tier:'B', name:'Ultraball', price:2000,
    img:'/jn/items/ultraball.png',  ballDice:10,
    desc:'Alta taxa de captura. Rola 10d4.' },
  { id:'masterball', category:'pokeball', tier:'S', name:'Masterball',price:10000,
    ballAuto:true, img:'/jn/items/masterball.png',
    desc:'Captura qualquer Pokémon sem falha. Apenas 1 por run.' },

  // ── Consumíveis ──────────────────────────────────────────────────
  { id:'pocao_menor',  category:'consumivel', tier:'C', name:'Poção Menor',  price:200,
    img:'/jn/items/pocao.png',      healVidas:1,
    desc:'Restaura 1 vida de um Pokémon.' },
  { id:'pocao_maior',  category:'consumivel', tier:'A', name:'Poção Maior',  price:3000,
    img:'/jn/items/superpocao.png', healVidas:2,
    desc:'Restaura 2 vidas de um Pokémon.' },
  { id:'pocao_suprema',category:'consumivel', tier:'S', name:'Poção Suprema',price:6000,
    img:'/jn/items/hiperpocao.png', healVidas:3,
    desc:'Restaura 3 vidas de um Pokémon.' },
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
    img:'/jn/items/firestone.png',      effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_agua',      category:'consumivel', tier:'A', name:'Pedra Água',      price:5000,
    img:'/jn/items/waterstone.png',     effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_trovao',    category:'consumivel', tier:'A', name:'Pedra Trovão',    price:5000,
    img:'/jn/items/thunderstone.png',   effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_folha',     category:'consumivel', tier:'A', name:'Pedra Folha',     price:5000,
    img:'/jn/items/leafstone.png',      effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_lua',       category:'consumivel', tier:'A', name:'Pedra Lua',       price:5000,
    img:'/jn/items/moonstone.png',      effect:'evo_stone', evoAtrib:3,
    desc:'+3 de atributo em um Pokémon capturado (a escolha).' },
  { id:'pedra_sol',       category:'consumivel', tier:'A', name:'Pedra Sol',       price:5000,
    img:'/jn/items/sunstone.png',       effect:'evo_stone', evoAtrib:3,
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
    img:'/jn/items/cheri.png',   cureConditions:['paralisia'],
    desc:'Cura paralisia.' },
  { id:'pecha',  category:'fruta', tier:'B', name:'Pecha Berry',  price:2225,
    img:'/jn/items/pecha.png',   cureConditions:['envenenamento'],
    desc:'Cura envenenamento.' },
  { id:'rawst',  category:'fruta', tier:'B', name:'Rawst Berry',  price:2225,
    img:'/jn/items/rawst.png',   cureConditions:['queimadura'],
    desc:'Cura queimadura.' },
  { id:'aspear', category:'fruta', tier:'B', name:'Aspear Berry', price:2225,
    img:'/jn/items/aspear.png',  cureConditions:['congelamento'],
    desc:'Cura congelamento.' },
  { id:'oran',   category:'fruta', tier:'C', name:'Oran Berry',   price:999,
    img:'/jn/items/oran.png',    healVidas:1,
    desc:'Recupera 1 vida.' },
  { id:'leppa',  category:'fruta', tier:'S', name:'Leppa Berry',  price:6000,
    img:'/jn/items/leppa.png',   healVidas:3,
    desc:'Recupera 3 vidas.' },
  { id:'persim', category:'fruta', tier:'B', name:'Persim Berry', price:2225,
    img:'/jn/items/persim.png',  cureConditions:['confusao'],
    desc:'Cura confusão.' },
  { id:'lum',    category:'fruta', tier:'A', name:'Lum Berry',    price:4000,
    img:'/jn/items/lum.png',     cureConditions:['all'],
    desc:'Cura qualquer condição cyber.' },
  { id:'sitrus', category:'fruta', tier:'A', name:'Sitrus Berry', price:4000,
    img:'/jn/items/sitrus.png',  healVidas:2,
    desc:'Recupera 2 vidas.' },
  { id:'chesto', category:'fruta', tier:'A', name:'Chesto Berry', price:4000,
    img:'/jn/items/chesto.png',  healVidas:1, cureConditions:['all'],
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
    img:'/jn/items/safariball.png',
    effect:'safariball',
    desc:'+1d de eficiência se o cyber treinador não atacou o Pokémon alvo.' },
  { id:'lureball',    category:'ballmod', tier:'C', name:'Lure Ball',    price:500,
    img:'/jn/items/lureball.png',
    effect:'lureball',
    desc:'+1d de eficiência por classe do treinador entre: Cozinheiro, Botânico, Aventureiro, Observador.' },
  { id:'duskball',    category:'ballmod', tier:'C', name:'Dusk Ball',    price:500,
    img:'/jn/items/duskball.png',
    effect:'duskball',
    desc:'+1d de eficiência se o Pokémon alvo é do tipo Noturno (Sombrio).' },
  { id:'timerball',   category:'ballmod', tier:'B', name:'Timer Ball',   price:1000,
    img:'/jn/items/timerball.png',
    effect:'timerball',
    desc:'+1d de eficiência por turno de batalha (máximo +5d).' },
  { id:'healball',    category:'ballmod', tier:'A', name:'Heal Ball',    price:3000,
    img:'/jn/items/healball.png',
    effect:'healball',
    desc:'+1d de eficiência por vida perdida do alvo. Pokémon capturado com este ballmod ganha +1 vida.' },
  { id:'heavyball',   category:'ballmod', tier:'B', name:'Heavy Ball',   price:1250,
    img:'/jn/items/heavyball.png',
    effect:'heavyball',
    desc:'+2d de eficiência se o alvo é Metal, Pedra ou Terra (sem acúmulo por múltiplos tipos da lista).' },
  { id:'fastball',    category:'ballmod', tier:'A', name:'Fast Ball',    price:3000,
    img:'/jn/items/fastball.png',
    effect:'fastball',
    desc:'+1d de eficiência se o alvo é Voador ou Fada. Pokémon capturado ganha +1d de Velocidade.' },
];

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
      {id:'cyber_inquebravel',   name:'Cyber Inquebrável',   isBase:false, powerKey:'inquebravel',     powerDesc:'A cada 30 níveis, todos os pokémons capturados ganham +1 vida.'},
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
  'Squirtle','Bulbasauro','Charmander',
  'Totodile','Chikorita','Cyndaquil',
  'Chimchar','Treecko','Mudkip',
];

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
export const RANKING_KEY_PREFIX = 'jn_ranking_';
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
const isGalarPaldea = (p) =>
  p.nome.includes(' de Galar') || p.nome.includes(' de Paldea');

// ── Base Vidas by context ────────────────────────────────────
const BASE_VIDAS = {
  player:    2,
  wild:      3,
  ctnpc:     2,
  miniboss:  10,
  boss:      15,
  finalboss: 15,
};

export const calcBaseVidas = (species, context = 'wild') => {
  let v = BASE_VIDAS[context] ?? 3;
  if (species.tipos?.includes('Pedra')) v += 1;
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
  const isLegendarySpecies = LEGENDARY_DEX_NUMBERS.has(species.dexNumber);

  // Vida bonuses for wild context: leg.shiny = no bonus, leg = +2, shiny = +1, regular = 0
  let vidasMax = calcBaseVidas(species, context);
  if (context === 'wild') {
    if (isLegendarySpecies && !isShiny) vidasMax += 2;
    else if (!isLegendarySpecies && isShiny) vidasMax += 1;
    // legendary shiny: no extra bonus (total = base 3)
  }
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
    types:        species.tipos ?? [],
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
const _basePool = () => pokedexData.filter((p) => !isGalarPaldea(p));

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
    LEGENDARY_DEX_NUMBERS.has(p.dexNumber) || (p.catchRate ?? 45) < 30
  );
  const species = pool[Math.floor(Math.random() * pool.length)] ?? _basePool()[0];
  const pkm     = generateJNPokemon(species, level, { context: 'boss' });
  return _addContextAtribBonus(pkm, Math.floor(level / 2) * 2);
};

/** Generate the final boss (stage 11) — always legendary, +2 atrib per 2 levels */
export const generateFinalBoss = () => {
  const level  = getStageLevel(11);
  const pool   = _basePool().filter((p) => LEGENDARY_DEX_NUMBERS.has(p.dexNumber));
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

// ── Ranking (localStorage) ───────────────────────────────────
export const loadRanking = (modeId) => {
  try {
    const raw = localStorage.getItem(RANKING_KEY_PREFIX + modeId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveRanking = (modeId, entry) => {
  // entry: { name, score, stages, date }
  const list = loadRanking(modeId);
  list.push({ ...entry, date: new Date().toLocaleDateString('pt-BR') });
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, RANKING_TOP_N);
  localStorage.setItem(RANKING_KEY_PREFIX + modeId, JSON.stringify(top));
  return top;
};

/** Calculate final score from run stats */
export const calcScore = ({ stage, captures, money, turnsTotal }) =>
  stage * 1000 + captures * 200 + money + Math.max(0, 5000 - turnsTotal * 10);

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
    if (powerKeys.includes('guerreiro_base'))  bonus += 1;
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
const calcAttackDice = (attacker, attackType, defenderTypes, classKeys, useMetalCoat = false, selectedType = null, ignoreTypeResist = false) => {
  const base = attacker.diceBase?.[attackType] ?? 1;
  const atkTypes = useMetalCoat ? ['Metal'] : (selectedType ? [selectedType] : (attacker.types ?? []));

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
  return Math.max(1, base + singleBonus + classBonus + typeBonus + condPenalty + diceBonus);
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
  const isLegEnemy     = !isCTNpcEnemy && LEGENDARY_DEX_NUMBERS.has(enemy.dexNumber);
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
const IMG_FALLBACK = '/jn/placeholderitem.png';
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
        {pkm.isShiny ? ' ✨' : ''}{LEGENDARY_DEX_NUMBERS.has(pkm.dexNumber) ? ' 🌟' : ''}
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

/** Get mart stock items for a given stage (respects tier probabilities) */
export const getMartStock = (stage) => {
  const chances = MART_TIER_CHANCES[stage] ?? MART_TIER_CHANCES[1];
  if (!chances) return [];
  // Pokébolas always available; rest filtered by tier availability
  const balls = ITEMS_DATA.filter((i) => i.category === 'pokeball');
  const others = ITEMS_DATA.filter((i) => i.category !== 'pokeball');
  // Build a stock of 8 unique items based on tier chances
  const stock = [...balls];
  const used = new Set(balls.map((b) => b.id));
  let attempts = 0;
  while (stock.length < 12 && attempts < 100) {
    attempts++;
    const tier = pickTier(chances);
    const tierPool = others.filter((i) => i.tier === tier && !used.has(i.id));
    if (tierPool.length === 0) continue;
    const item = tierPool[Math.floor(Math.random() * tierPool.length)];
    used.add(item.id);
    stock.push(item);
  }
  return stock;
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
    return r1.total >= r2.total ? r1 : r2;
  };
  const pVRoll = doRollVel(pVDice, pVelVantagem);
  const eVRoll = doRollVel(eVDice, eVelVantagem);
  const velAdvPrefix = (pVelVantagem || eVelVantagem) ? '«ADV» ' : '';
  log.push(`${velAdvPrefix}💨 Vel: ${playerPkm.nome} [${pVRoll.rolls.join(',')}]=${pVRoll.total} vs ${enemyPkm.nome} [${eVRoll.rolls.join(',')}]=${eVRoll.total}`);

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

  const baseDice = calcAttackDice(atk, atkAction, def.types, atkKeys2, useMC, isPlayer ? (opts.selectedType ?? null) : null, bossIgnoreResist);
  if (baseDice === 'immune') {
    log.push(`🚫 ${def.nome} é imune ao ataque de ${atk.nome}!`);
    return { atk, def, defFainted: false, usedMC: false };
  }
  const atkDice = Math.max(1, baseDice + (opts.extraAtkDice ?? 0));

  const doRollAdv = (dice, vantagem, desvantagem) => {
    const r1 = rollD4(dice);
    if (vantagem)   { const r2 = rollD4(dice); return r1.total >= r2.total ? r1 : r2; }
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

  const atkDiceStr = atkRoll.rolls.join(',');
  const defDiceStr = defRoll.rolls.join(',');
  const anyAdv = opts.atkVantagem || defVantagem;
  const anyDis = opts.atkDesvantagem || defDesvantagem;
  const rollPrefix = anyDis ? '«DIS» ' : anyAdv ? '«ADV» ' : '';
  log.push(`${rollPrefix}${isPlayer ? '⚔️' : '👾'} ${atk.nome} ${lbl}[${atkDiceStr}]=${atkTotal} vs ${def.nome} ${defLbl}[${defDiceStr}]=${defRoll.total}`);

  const isSE = atkTotal > defRoll.total && multToDiceMod(
    getTypeEffectiveness((useMC ? 'Metal' : (isPlayer && opts.selectedType ? opts.selectedType : (atk.types ?? [])[0])) ?? 'Normal', def.types)
  ) > 0;

  if (atkTotal > defRoll.total) {
    // Lutador power: 1% instant KO
    if (atkTypes2.includes('Lutador') && Math.random() < 0.01) {
      def = { ...def, vidasAtual: 0 };
      log.push(`💀 Golpe fatal de ${atk.nome}! Nocaute instantâneo!`);
    } else {
      def = { ...def, vidasAtual: def.vidasAtual - 1 };
      log.push(`💥 ${def.nome} perde 1 vida! (${def.vidasAtual}/${def.vidasMax})`);
    }

    // On-attack type triggers
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
        def = tryApplyCondition(def, cond, isBoss);
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
      def = tryApplyCondition(def, cond, isBoss);
      if (def.conditions.length > before)
        log.push(`☠️ ${def.nome} ficou com ${CONDITIONS[cond]?.name}! (Estrategista)`);
    }
    // CTnpc Estrategista: same passive
    if (!isPlayer && (eClassKeys ?? []).includes('estrategista') && Math.random() < 0.10) {
      const cond = randomCondition();
      const before = def.conditions.length;
      def = tryApplyCondition(def, cond, isBoss);
      if (def.conditions.length > before)
        log.push(`☠️ ${def.nome} ficou com ${CONDITIONS[cond]?.name}! (Estrategista CTnpc)`);
    }

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

export default function JornadaNiaypeta({ onExit, userPokedex = [] }) {
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
  const [runStats, setRunStats]         = useState({ captures: 0, turnsTotal: 0, stagesCleared: 0 });

  // ── Stage / Encounter ──────────────────────────────────────
  const [stageEncounters, setStageEncounters] = useState([]);   // 3 encounter options
  const [visitedEncounters, setVisitedEncounters] = useState([]); // indices visited
  const [currentEncounter, setCurrentEncounter]   = useState(null);

  // ── Battle ─────────────────────────────────────────────────
  // battle state fully managed in Part 4; stored here as a single object
  const [battle, setBattle]             = useState(null);
  const [battleLog, setBattleLog]       = useState([]);
  const [pendingAtkType, setPendingAtkType] = useState(null); // type selected before choosing atk/atkEsp

  // ── Mart tab ──────────────────────────────────────────────
  const [martCat, setMartCat]           = useState('pokeball');

  // ── Ranking ────────────────────────────────────────────────
  const [rankingData, setRankingData]   = useState({
    pocket:  loadRanking('pocket'),
    jornada: loadRanking('jornada'),
    endless: loadRanking('endless'),
  });
  const [showRanking, setShowRanking]   = useState(false);

  // ── JN Cyberdex (Firebase) ─────────────────────────────────
  // Set of dexNumbers (numbers) the user has encountered in JN runs
  const [cyberdex, setCyberdex]         = useState(new Set());

  // ── Reward Screen ──────────────────────────────────────────
  const [capturedInEncounter, setCapturedInEncounter] = useState(null);
  // Items offered after a wild encounter (not captured)
  const [wildRewardItems, setWildRewardItems]         = useState([]);
  // Current mart stock (generated on stage start)
  const [martStock, setMartStock]                     = useState([]);

  // ── Refs ───────────────────────────────────────────────────
  const battleLogRef = useRef(null);

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
      // 2nd+ run: full cyberdex as choice pool
      const cyberdexSpecies = [...cyberdex]
        .map((dexNum) => pokedexData.find((p) => p.dexNumber === dexNum))
        .filter((p) => p && !isGalarPaldea(p));
      starters = cyberdexSpecies.map((s) => generateJNPokemon(s, 1, { context: 'player' }));
    }

    setStarterOptions(starters);
    setPhase('starterSelect');
  }, [currentUser, cyberdex]);

  // ═══════════════════════════════════════════════════════════
  // STAGE / ENCOUNTER HANDLERS
  // ═══════════════════════════════════════════════════════════
  const _beginStage = useCallback((stageNum) => {
    const encounters = buildStageEncounters(stageNum);
    setStageEncounters(encounters);
    setVisitedEncounters([]);
    setCurrentEncounter(null);
    setBattle(null);
    setBattleLog([]);
    setMartStock(getMartStock(stageNum));
    setWildRewardItems([]);
    setPhase('map');
  }, []);

  const handleSelectStarter = useCallback((pkm) => {
    const starter = {
      ...pkm, level: 1, vidasMax: 2, vidasAtual: 2, context: 'player',
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
    setRunStats({ captures: 1, turnsTotal: 0, stagesCleared: 0 });
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
      const pClassKeys = playerClasses.map((c) => c.powerKey);
      const hasMistico    = pClassKeys.includes('mistico_base');
      const hasObservador = pClassKeys.includes('observador');
      const incLend  = inventory.consumiveis?.incenso_lendario  ?? 0;
      const incShiny = (inventory.consumiveis?.incenso_glitter  ?? 0)
                     + (inventory.consumiveis?.incenso_porpurina ?? 0);

      const legShinyChance = 0.005; // 0.5% base for legendary shiny
      const legChance  = 0.01 + (hasMistico ? 0.10 : 0) + (incLend  > 0 ? 0.10 : 0);
      const shinyChance = 0.01 + (hasObservador ? 0.10 : 0) + (incShiny > 0 ? 0.10 : 0);

      // Priority roll: legendary shiny → legendary → shiny → regular
      const roll = Math.random();
      let isLegendary = false, isShiny = false;
      if (roll < legShinyChance) {
        isLegendary = true; isShiny = true;
      } else if (roll < legShinyChance + legChance) {
        isLegendary = true;
      } else if (roll < legShinyChance + legChance + shinyChance) {
        isShiny = true;
      }

      if (isLegendary || isShiny) {
        const level = getStageLevel(stage);
        let species;
        if (isLegendary) {
          const legPool = _basePool().filter((p) => LEGENDARY_DEX_NUMBERS.has(p.dexNumber));
          species = legPool.length > 0 ? legPool[Math.floor(Math.random() * legPool.length)] : pickRandomSpecies();
        } else {
          species = pickRandomSpecies();
        }
        const newPkm = generateJNPokemon(species, level, { context: 'wild', forceShiny: isShiny });
        enc = { ...enc, enemy: [newPkm] };
      }

      // Consume incenso items on entry (regardless of outcome)
      if (incLend > 0) {
        setInventory((inv) => ({ ...inv, consumiveis: { ...inv.consumiveis, incenso_lendario: incLend - 1 } }));
      }
      if (incShiny > 0) {
        setInventory((inv) => {
          const c = { ...inv.consumiveis };
          if ((c.incenso_glitter ?? 0) > 0) c.incenso_glitter -= 1;
          else if ((c.incenso_porpurina ?? 0) > 0) c.incenso_porpurina -= 1;
          return { ...inv, consumiveis: c };
        });
      }
    }

    // Battle encounter
    setCurrentEncounter(enc);
    setVisitedEncounters((prev) => [...prev, idx]);
    setPhase('battle');
    // Battle init is called from Part 4 via initBattle(enc)
  }, [stageEncounters, playerClasses, inventory, stage]);

  const handleEncounterComplete = useCallback((capturedPkm = null, encounterMoney = 0) => {
    if (capturedPkm) setCapturedInEncounter(capturedPkm);
    if (encounterMoney > 0) setMoney((m) => m + encounterMoney);

    // Stage 0 has 1 local; special stages have 1 forced encounter; others need 2
    const maxEncounters = (stage === 0 || SPECIAL_STAGES.has(stage)) ? 1 : 2;
    const newVisited = visitedEncounters.length; // already incremented before battle
    if (newVisited >= maxEncounters) {
      setPhase('reward');
    } else {
      setCapturedInEncounter(null);
      setCurrentEncounter(null);
      setBattle(null);
      setBattleLog([]);
      setPhase('map');
    }
  }, [visitedEncounters, stage]);

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
    setRunStats((rs) => ({ ...rs, stagesCleared: rs.stagesCleared + 1 }));
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

          // inquebravel → +1 vidasMax per 30 levels
          if (cls.powerKey === 'inquebravel') {
            const gained = newThresholds(30);
            if (gained > 0) p = { ...p, vidasMax: p.vidasMax + gained };
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
      _beginStage(nextStage);
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
      const added = {
        ...pkm,
        context: 'player',
        vidasMax:   pkm.vidasMax,
        vidasAtual: pkm.vidasMax,
        conditions: [],
      };
      return [...prev, added];
    });
    // Register this pokémon's current level as baseline for all existing level-bonus classes
    const LEVEL_BONUS_KEYS = ['treinador_base', 'artista_base', 'beldade', 'cativante', 'coreografo', 'descolado', 'especialista', 'inquebravel'];
    setPlayerClasses((prev) => prev.map((cls) => {
      if (!LEVEL_BONUS_KEYS.includes(cls.powerKey)) return cls;
      return { ...cls, levelBaselines: { ...(cls.levelBaselines ?? {}), [pkm.uid]: pkm.level } };
    }));
    setRunStats((rs) => ({ ...rs, captures: rs.captures + 1 }));
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

    setTeam((prev) => {
      const updated = [...prev];
      const pkm = { ...updated[targetIdx] };

      // Healing
      if (itemDef.healVidas) {
        const bonus = hasClassPower('medico_campo') ? 1 : 0;
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
  }, [playerClasses, battle]);

  const handleBuyItem = useCallback((itemId, qty = 1) => {
    const itemDef = ITEMS_DATA.find((i) => i.id === itemId);
    if (!itemDef) return;

    let price = itemDef.price * qty;
    if (hasClassPower('contrabandista')) price = Math.floor(price * 0.75);

    if (money < price) return;
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
  }, [money, playerClasses]);

  const handleEquipItem = useCallback((itemId, pokemonIdx) => {
    const itemDef = ITEMS_DATA.find((i) => i.id === itemId);
    if (!itemDef || itemDef.category !== 'held') return;

    setTeam((prev) => {
      const updated = [...prev];
      const pkm = { ...updated[pokemonIdx] };
      // Virtuose: can hold 2 items
      const maxHeld = hasClassPower('virtuose') ? 2 : 1;
      const currentHeld = Array.isArray(pkm.heldItem) ? pkm.heldItem : (pkm.heldItem ? [pkm.heldItem] : []);
      if (currentHeld.length >= maxHeld) return prev;
      pkm.heldItem = maxHeld === 1 ? itemDef : [...currentHeld, itemDef];
      updated[pokemonIdx] = pkm;
      return updated;
    });

    setInventory((inv) => {
      const count = (inv.held[itemId] ?? 0) - 1;
      return { ...inv, held: { ...inv.held, [itemId]: Math.max(0, count) } };
    });
  }, [playerClasses]);

  // ═══════════════════════════════════════════════════════════
  // END RUN
  // ═══════════════════════════════════════════════════════════
  const handleEndRun = useCallback((won) => {
    const name = currentUser?.isGuest
      ? (guestName.trim() || 'Visitante')
      : (currentUser?.username ?? 'Jogador');

    const score = calcScore({
      stage,
      captures:   runStats.captures,
      money,
      turnsTotal: runStats.turnsTotal,
    });

    const teamSnap = team.map((p) => ({
      nome: p.nome, dexNumber: p.dexNumber, level: p.level,
      types: p.types, isShiny: p.isShiny ?? false,
    }));
    const entry = { name, score, stages: stage, won, team: teamSnap };
    const modeId = gameMode?.id ?? 'jornada';
    const updated = saveRanking(modeId, entry);

    setRankingData((rd) => ({ ...rd, [modeId]: updated }));
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
    setRunStats({ captures: 0, turnsTotal: 0, stagesCleared: 0 });
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
        // ── used flags (1×/batalha) ──
        mongeUsed:          false,
        hipnosoUsed:        false,
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

    const newTeam = [...teamSnap];
    newTeam[aIdx] = playerPkm;
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
    setRunStats((rs) => ({ ...rs, turnsTotal: rs.turnsTotal + 1 }));
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

    const newPhase = classRewardCls ? 'classReward'
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
      },
    }));
  }, [battle, stage, playerClasses, setTeam, setRunStats, setBattleLog, setBattle, setMoney, setWildRewardItems]);

  /** Process one full battle turn given the player's chosen action. */
  const handlePlayerAction = useCallback((actionType) => {
    if (!battle || battle.phase !== 'awaitingAction') return;

    const log = [];
    let { playerPkm, enemyPkm, enemyTeam, enemyActiveIdx, turnNum, isBoss, isCTNpc } = battle;

    playerPkm = tickConditions(playerPkm);
    enemyPkm  = tickConditions(enemyPkm);

    const pClassKeys     = playerClasses.map((c) => c.powerKey);
    const ctnpcClassKeys = battle.ctnpcClassKeys ?? [];
    const sa             = battle.sa ?? {};

    // Consume CTnpc's pending player-affecting flags before player attacks
    const enemySa_b = battle.enemySa ?? {};
    const pAtkDesvantagem_e   = !!enemySa_b.ilusionistaPending_e;
    const pAtkVantagem_ctnpc  = !!enemySa_b.soldadoPlayerCounterNext;
    const pFinalAtkPenalty_e  = enemySa_b.hipnosePending_e ? (stage >= 10 ? 20 : stage >= 7 ? 10 : 5) : 0;
    const consumedEnemySa     = { ...enemySa_b, hipnosePending_e: false, ilusionistaPending_e: false, soldadoPlayerCounterNext: false };

    const enemyAction = enemyChooseAttack(enemyPkm, playerPkm, ctnpcClassKeys);

    const mediumBonus    = pClassKeys.includes('medium') ? team.filter((p) => p.vidasAtual <= 0).length : 0;
    const videnVantagem  = pClassKeys.includes('vidente') && battle.videnteChoice === 'vantagem';
    const videnteDesvAdv = pClassKeys.includes('vidente') && battle.videnteChoice === 'desvantagem';
    const hipnosePenalty = sa.hipnosePending ? (stage >= 10 ? 20 : stage >= 7 ? 10 : 5) : 0;
    const oficialBonus   = sa.oficialPending  ? (stage >= 10 ? 12 : stage >= 6 ? 8 : 5) : 0;

    const pAtkVantagem     = videnVantagem || sa.soldadoActive || sa.bardoPending || pAtkVantagem_ctnpc;
    const pAtkDesvantagem  = pAtkDesvantagem_e;
    const pExtraAtkDice    = mediumBonus + (sa.ocultismoPending ? 2 : 0) + (sa.sincronoPending ?? 0) + (sa.domadorActive && !isCTNpc && !isBoss ? 2 : 0);
    const pFinalAtkBonus   = oficialBonus;
    const pFinalAtkPenalty = pFinalAtkPenalty_e;
    const eAtkVantagem     = sa.soldadoEnemyCounterNext;
    const eAtkDesvantagem  = videnteDesvAdv || sa.ilusionistaPending;
    const eFinalAtkPenalty = hipnosePenalty + (sa.soldadoActive ? 10 : 0);

    const bossIgnoreResist = isBoss && turnNum >= 1 && (turnNum - 1) % 4 === 0;
    const pAtkOpts = { atkVantagem: pAtkVantagem, atkDesvantagem: pAtkDesvantagem, extraAtkDice: pExtraAtkDice, finalAtkBonus: pFinalAtkBonus, finalAtkPenalty: pFinalAtkPenalty, selectedType: pendingAtkType, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, defDesvantagem: videnteDesvAdv };
    const eAtkOpts = { atkVantagem: eAtkVantagem, atkDesvantagem: eAtkDesvantagem, finalAtkPenalty: eFinalAtkPenalty, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, bossIgnoreResist, turnNum, defVantagem: videnVantagem };
    setPendingAtkType(null);

    // Guard: this handler only runs when player has initiative
    if (!battle.playerGoesFirst) return;

    {
      // ── Player attacks first ────────────────────────────────
      const eDefChoice = enemyChooseDefense(enemyPkm, actionType, ctnpcClassKeys);
      const r1 = doAttack(playerPkm, actionType, enemyPkm, true, { ...pAtkOpts, defChoice: eDefChoice, metalCoatUsedThisTurn: false });
      playerPkm = r1.atk; enemyPkm = r1.def;
      let mcUsed = r1.usedMC;

      // Golpe Duplo (Monge): second attack
      if (enemyPkm.vidasAtual > 0 && sa.mongePending) {
        log.push(`👊 Golpe Duplo — segundo ataque!`);
        const eDefChoice2 = enemyChooseDefense(enemyPkm, actionType, ctnpcClassKeys);
        const r1b = doAttack(playerPkm, actionType, enemyPkm, true, { extraAtkDice: mediumBonus, defChoice: eDefChoice2, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, metalCoatUsedThisTurn: mcUsed });
        playerPkm = r1b.atk; enemyPkm = r1b.def;
        if (r1b.usedMC) mcUsed = true;
      }

      if (enemyPkm.vidasAtual <= 0) {
        // Enemy fainted — finalize immediately (no defense needed)
        _finalizeTurn({ playerPkm, enemyPkm, playerFainted: false, enemyFainted: true, log, newTurnNum: turnNum + 1, metalCoatUsedThisTurn: mcUsed, sa, actionType, enemyAction, team, activeIdx, newEnemySa: consumedEnemySa });
      } else {
        // Enemy alive — pause for player to choose defense
        setBattleLog((prev) => [...prev, ...log]);
        setBattle((b) => ({
          ...b, playerPkm, enemyPkm, metalCoatUsedThisTurn: mcUsed,
          phase: 'awaitingDefense',
          enemySa: consumedEnemySa,
          pendingDefense: { enemyAction, playerFirst: true, eAtkOpts },
        }));
      }
    }
  }, [battle, team, activeIdx, playerClasses, stage, pendingAtkType, setPendingAtkType, _finalizeTurn]);

  /** Player chooses defense (dodge with vel or defend with def/defEsp). */
  const handlePlayerDefense = useCallback((defChoice) => {
    if (!battle || battle.phase !== 'awaitingDefense') return;
    const { pendingDefense, isBoss, isCTNpc, turnNum } = battle;
    if (!pendingDefense) return;

    const { enemyAction, playerFirst, eAtkOpts } = pendingDefense;
    const pClassKeys     = playerClasses.map((c) => c.powerKey);
    const ctnpcClassKeys = battle.ctnpcClassKeys ?? [];
    const sa = battle.sa ?? {};
    const bossIgnoreResist = isBoss && turnNum >= 1 && (turnNum - 1) % 4 === 0;

    const log = [];
    let { playerPkm, enemyPkm, metalCoatUsedThisTurn } = battle;
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
        const fullEAtkOpts = { ...(eAtkOpts ?? {}), defChoice, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss, metalCoatUsedThisTurn: false };
        const re = doAttack(enemyPkm, enemyAction, playerPkm, false, fullEAtkOpts);
        enemyPkm = re.atk; playerPkm = re.def;
        if (re.defFainted) playerFainted = true;
      }
    } else {
      // ── Enemy attacks player (player chose defChoice) ────────
      const fullEAtkOpts = { ...(eAtkOpts ?? {}), defChoice, pClassKeys, log, isBoss, metalCoatUsedThisTurn: false, bossIgnoreResist, turnNum };
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
  }, [battle, team, activeIdx, playerClasses, stage, _finalizeTurn]);

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
      const enemyAction = enemyChooseAttack(enemyPkm, battle.playerPkm, ctnpcClassKeys);
      const eAtkOpts = {
        atkVantagem:     (sa ?? {}).soldadoEnemyCounterNext,
        atkDesvantagem:  videnteDesvAdv || (sa ?? {}).ilusionistaPending,
        finalAtkPenalty: hipnosePenalty + ((sa ?? {}).soldadoActive ? 10 : 0),
        pClassKeys, eClassKeys: ctnpcClassKeys,
        log: [], isBoss, bossIgnoreResist, turnNum,
        defVantagem: videnVantagem,
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
    const videnVantagem  = pClassKeys.includes('vidente') && battle.videnteChoice === 'vantagem';
    const videnteDesvAdv = pClassKeys.includes('vidente') && battle.videnteChoice === 'desvantagem';
    const oficialBonus   = sa.oficialPending ? (stage >= 10 ? 12 : stage >= 6 ? 8 : 5) : 0;

    const pAtkVantagem   = videnVantagem || sa.soldadoActive || sa.bardoPending || pAtkVantagem_ctnpc;
    const pAtkDesvantagem = pAtkDesvantagem_e;
    const pExtraAtkDice  = mediumBonus + (sa.ocultismoPending ? 2 : 0) + (sa.sincronoPending ?? 0) + (sa.domadorActive && !isCTNpc && !isBoss ? 2 : 0);

    const log = [];
    let { playerPkm, enemyPkm, metalCoatUsedThisTurn } = battle;
    setPendingAtkType(null);

    const pAtkOpts = {
      atkVantagem: pAtkVantagem, atkDesvantagem: pAtkDesvantagem, extraAtkDice: pExtraAtkDice,
      finalAtkBonus: oficialBonus, finalAtkPenalty: pFinalAtkPenalty_e,
      selectedType: pendingAtkType, pClassKeys, eClassKeys: ctnpcClassKeys, log, isBoss,
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
    const hipnosePenalty  = sa.hipnosePending ? (stage >= 10 ? 20 : stage >= 7 ? 10 : 5) : 0;
    const eAtkVantagem    = sa.soldadoEnemyCounterNext;
    const eAtkDesvantagem = videnteDesvAdv || sa.ilusionistaPending;
    const eFinalAtkPenalty = hipnosePenalty + (sa.soldadoActive ? 10 : 0);
    let eAtkOpts = { atkVantagem: eAtkVantagem, atkDesvantagem: eAtkDesvantagem, finalAtkPenalty: eFinalAtkPenalty, pClassKeys, log, isBoss, eClassKeys: ctnpcClassKeys, bossIgnoreResist, turnNum, defVantagem: videnVantagem };

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
      case 'hipnose':
        if (sa.hipnosoUsed) return;
        update({ hipnosePending: true, hipnosoUsed: true }, `💤 Hipnose ativada! Oponente sofre penalidade no próximo ataque.`);
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
        const isLegendary = (team[activeIdx]?.isLegendary ?? false);
        if (isLegendary) return; // bardo lendário tem vantagem sempre (já aplicado)
        update({ bardoPending: true, bardoUsed: true }, `🎵 Inspiração! Próximo ataque com vantagem.`);
        break;
      }
      case 'ocultismo': {
        if (sa.ocultistUsed) return;
        const isLeg = (team[activeIdx]?.isLegendary ?? false);
        if (isLeg) return; // ocultista lendário tem +2d sempre
        update({ ocultismoPending: true, ocultistUsed: true }, `🔮 Ocultismo! +2d no próximo ataque.`);
        break;
      }
      case 'sincrono': {
        if (sa.sincronoUsed) return;
        const bonus = team.length;
        update({ sincronoPending: bonus, sincronoUsed: true }, `🔗 Síncrono! +${bonus}d no próximo ataque.`);
        break;
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
      default:
        break;
    }
  }, [battle, team, activeIdx, playerClasses, stage]);

  /** Attempt to capture the enemy Pokémon with a selected ball. */
  const handleCapture = useCallback((ballId) => {
    if (!battle || !battle.canCapture) return;
    const ballDef = ITEMS_DATA.find((i) => i.id === ballId);
    if (!ballDef) return;
    const count = inventory.pokebolas[ballId] ?? 0;
    if (count <= 0) return;

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

    const log = [`🎯 Jogou ${ballDef.name}! Captura [${result.rolls.join(',')}] vs Fuga [${result.escapeRolls.join(',')}]`];

    if (result.success) {
      log.push(`✅ ${enemyPkm.nome} foi capturado!`);
      setBattleLog((prev) => [...prev, ...log]);
      setBattle((b) => ({ ...b, phase: 'captured', capturedPkm: enemyPkm }));
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
  }, [battle, inventory, team, activeIdx, playerClasses, handlePlayerAction]);

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

    // parrudo: +1 vidasMax + vidasAtual to all team pokémon
    if (cls.powerKey === 'parrudo') {
      setTeam((prev) => prev.map((p) => ({
        ...p,
        vidasMax:   p.vidasMax   + 1,
        vidasAtual: Math.min(p.vidasAtual + 1, p.vidasMax + 1),
      })));
    }

    // professor: +1 slot (handled via maxTeamSize) + random starter at highest team level
    if (cls.powerKey === 'professor') {
      const maxLevel = Math.max(...team.map((p) => p.level), 1);
      const starterNames = FIXED_STARTER_NAMES;
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

    setPlayerClasses((prev) => [...prev, enrichedCls]);
    setClassChoiceData(null);
    setBattle((b) => ({ ...b, phase: cls.powerKey === 'engenheiro_cap' ? 'engineer_choice' : 'result_win', classRewardCls: null }));
  }, [battle, team, playerClasses, classChoiceData, videnteChoice]);

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
    const isSpecial = SPECIAL_STAGES.has(stage);
    const stageMax  = gameMode?.stageCount === Infinity ? '∞' : ((gameMode?.stageCount ?? 12) - 1);
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
              <p className="text-gray-400 text-xs">{visitedEncounters.length}/{isSpecial ? 1 : 2} encontros</p>
            </div>
          </div>

          {/* Location cards */}
          <div className="flex gap-3 flex-wrap justify-center">
            {stageEncounters.map((enc, i) => {
              const visited = visitedEncounters.includes(i);
              const meta    = ENC_META[enc.type] ?? { label: enc.type, img: '', color: 'text-white' };
              const maxVisits = isSpecial ? 1 : 2;
              const canVisit  = !visited && visitedEncounters.length < maxVisits;
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
                  {visited && <span className="text-gray-500 text-xs">✓ Visitado</span>}
                </button>
              );
            })}
          </div>

          {/* Stage complete button */}
          {visitedEncounters.length >= (isSpecial ? 1 : 2) && (
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
    return (
      <div className="flex flex-col gap-3 h-full overflow-y-auto">
        {/* Trainer info */}
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <img src="/jn/trainerimg.png" alt="trainer" onError={safeImg} className="w-10 h-10 object-contain" />
            <div>
              <p className="text-white font-bold text-sm">{currentUser?.username}</p>
              <div className="flex flex-wrap gap-1">
                {playerClasses.map((c) => {
                  const g = CLASSES_DATA.find((gr) => gr.classes.some((cl) => cl.id === c.id));
                  return (
                    <span key={c.id} className="text-gray-400 text-xs">{g?.icon} {c.name}</span>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="text-yellow-300 font-bold text-sm">💰 {money}</p>
          <p className="text-gray-400 text-xs">Estágio {stage} · {runStats.captures} capturas</p>
        </div>

        {/* Team list */}
        <div className="bg-gray-800 rounded-xl p-3 flex-1">
          <p className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wide">Time ({team.length}/6)</p>
          <div className="flex flex-col gap-2">
            {team.map((pkm, i) => (
              <button key={pkm.uid} onClick={() => {
                setActiveIdx(i);
                if (battle?.phase === 'switchPokemon') handleBattleSwitch(i);
              }}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left
                  ${i === activeIdx ? 'border-yellow-400 bg-yellow-900/20' : 'border-gray-700 hover:border-gray-500'}
                  ${pkm.vidasAtual <= 0 ? 'opacity-40' : ''}`}>
                <div className="relative w-8 h-8 shrink-0">
                  {pkm.isShiny && (
                    <img src="/jn/sparlkeshin.png" alt="✨" onError={safeImg}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                  )}
                  <img src={pkm.imageUrl} alt={pkm.nome} onError={safeImg} className="relative z-10 w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">{pkm.nome}</p>
                  <VidasDisplay atual={pkm.vidasAtual} max={pkm.vidasMax} />
                </div>
                {pkm.conditions.length > 0 && (
                  <div className="flex gap-0.5">
                    {pkm.conditions.map((c) => (
                      <span key={c} className="text-xs" title={CONDITIONS[c]?.name}>
                        {CONDITIONS[c]?.icon}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
            {team.length === 0 && <p className="text-gray-600 text-xs text-center">Sem Pokémon</p>}
          </div>
        </div>

        {/* Class power reminders */}
        {playerClasses.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-gray-500 text-xs uppercase font-bold mb-2">Poderes</p>
            <div className="flex flex-col gap-2">
              {playerClasses.map((c) => {
                const g = CLASSES_DATA.find((gr) => gr.classes.some((cl) => cl.id === c.id));
                return (
                  <div key={c.id}>
                    <p className="text-yellow-400 text-xs font-bold">{g?.icon} {c.name}</p>
                    <p className="text-gray-400 text-xs leading-tight">{c.powerDesc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
            {LEGENDARY_DEX_NUMBERS.has(pkm.dexNumber) && <span className="text-purple-400 ml-1">🌟</span>}
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
            <VidasDisplay atual={pkm.vidasAtual} max={pkm.vidasMax} />
            <span className="text-gray-400 text-xs">{pkm.vidasAtual}/{pkm.vidasMax}</span>
          </div>
          <p className="text-gray-500 text-xs">Nv.{pkm.level} · {pkm.isSingleType ? '⭐ Tipo único (+1d)' : ''}</p>
        </div>

        {/* Stats table */}
        <div className="bg-gray-800 rounded-xl p-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-500 pb-1 font-semibold">
                  Atributo
                  {(pkm.pontosAtrib ?? 0) > 0 && (
                    <span className="text-yellow-400 ml-1">({pontosDisponiveis})</span>
                  )}
                </th>
                <th className="text-center text-gray-500 pb-1 font-semibold">Base</th>
                <th className="text-center text-gray-500 pb-1 font-semibold">Bônus</th>
                <th className="text-center text-gray-500 pb-1 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {STAT_LABELS.map(({ key, label, color }) => {
                const rawStat  = (pkm.stats?.[key] ?? 0) + (currentDraft[key] ?? 0);
                const baseDice = Math.max(1, Math.floor(rawStat / 2));
                const sources  = getBonusSources(key);
                const bonusDice = sources.reduce((s, src) => s + src.value, 0);
                const totalDice = Math.max(1, baseDice + bonusDice);
                const tooltipKey = `${pkm.uid}-${key}`;
                const canAdd = pontosDisponiveis > 0;
                return (
                  <tr key={key} className="border-b border-gray-700/40">
                    <td className="py-1">
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
                    </td>
                    <td className="text-center text-white py-1">{baseDice}d</td>
                    <td className="text-center py-1 relative">
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
                    </td>
                    <td className="text-center text-white font-bold py-1">{totalDice}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

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
              <div key={h.id} className="flex items-center gap-2 mb-1">
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

    // Legendary attribute distribution screen
    if (bp === 'legendary_attr') {
      const lPkm = battle.legendaryPkmToAdd;
      const bonuses = battle.legendaryBonuses ?? { atk:0, def:0, atkEsp:0, defEsp:0, vel:0 };
      const pointsLeft = battle.legendaryPointsLeft ?? 10;
      const STAT_KEYS = ['atk', 'def', 'atkEsp', 'defEsp', 'vel'];
      const STAT_LABELS = { atk:'ATK', def:'DEF', atkEsp:'ATK ESP', defEsp:'DEF ESP', vel:'VEL' };
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className={`text-xl font-bold ${lPkm?.isShiny && LEGENDARY_DEX_NUMBERS.has(lPkm?.dexNumber) ? 'text-yellow-400' : lPkm?.isShiny ? 'text-yellow-400' : 'text-purple-400'}`}>
            {lPkm?.isShiny && LEGENDARY_DEX_NUMBERS.has(lPkm?.dexNumber) ? '🌟✨' : lPkm?.isShiny ? '✨' : '🌟'} {lPkm?.nome} capturado!
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
              handleAddToTeam(enhanced);
              handleEncounterComplete(enhanced);
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

    // Captured result screen
    if (bp === 'captured' && capturedPkm) {
      const isLeg      = LEGENDARY_DEX_NUMBERS.has(capturedPkm.dexNumber);
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
            ? <button onClick={() => attrPoints > 0 ? goToAttr() : (handleAddToTeam(capturedPkm), handleEncounterComplete(capturedPkm))}
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
              {LEGENDARY_DEX_NUMBERS.has(enemyPkm?.dexNumber) && <span className="text-purple-400 text-xs">🌟</span>}
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
            if (line.startsWith('«ADV» ')) return <p key={i} className="text-green-400">{line.slice(6)}</p>;
            if (line.startsWith('«DIS» ')) return <p key={i} className="text-red-400">{line.slice(6)}</p>;
            return <p key={i}>{line}</p>;
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
                  className="w-full px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs rounded-lg transition-colors mt-0.5">
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
            <div className="flex gap-1 flex-wrap justify-center">
              {Object.entries(inventory.pokebolas ?? {}).filter(([, q]) => q > 0).map(([id, qty]) => {
                const def = ITEMS_DATA.find((i) => i.id === id);
                return def ? (
                  <button key={id} onClick={() => handleCapture(id)} disabled={bp !== 'awaitingAction'}
                    className="flex items-center gap-1 px-3 py-2 bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors">
                    <img src={def.img} alt={def.name} onError={safeImg} className="w-5 h-5 object-contain" />
                    {def.name} ×{qty}
                  </button>
                ) : null;
              })}
            </div>
          )}
        </div>
        )}

        {/* Special Action buttons */}
        {(() => {
          const sa = battle?.sa ?? {};
          const pk = team[activeIdx];
          const isLeg = pk?.isLegendary ?? false;
          const isCT  = battle?.isCTNpc;
          const isBs  = battle?.isBoss;
          const pClassKeys = playerClasses.map((c) => c.powerKey);
          const btns = [];
          if (pClassKeys.includes('hipnologo') && !sa.hipnosoUsed)
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
          if (pClassKeys.includes('ladrao') && isCT && (sa.raptarCharges ?? 0) > 0)
            btns.push({ key:'raptar',     label:`🪝 Raptar(${sa.raptarCharges})`, color:'bg-amber-700 hover:bg-amber-600' });
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

        {/* Quick use consumibles */}
        {Object.entries({ ...inventory.consumiveis, ...inventory.frutas }).filter(([, q]) => q > 0).length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {battle?.itemUsedThisTurn && (
              <span className="w-full text-center text-gray-500 text-xs">Item já usado neste turno</span>
            )}
            {Object.entries({ ...inventory.consumiveis, ...inventory.frutas })
              .filter(([, q]) => q > 0)
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
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ITEMS_DATA.filter((i) => i.category === martCat).map((item) => {
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
                      disabled={money < price}
                      className="ml-auto px-2 py-0.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded transition-colors">
                      Comprar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
    const score = calcScore({ stage, captures: runStats.captures, money, turnsTotal: runStats.turnsTotal });
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

  // ── Center content router ─────────────────────────────────────
  const renderCenterForPhase = () => {
    if (phase === 'battle')  return renderBattleCenter();
    if (phase === 'mart')    return renderMartScreen();
    if (phase === 'center')  return renderCenterConfirm();
    if (phase === 'reward')  return renderRewardScreen();
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
        <p className="text-sm">Escolha um local no mapa acima para avançar.</p>
      </div>
    );
  };

  // ── Main return ───────────────────────────────────────────────
  return (
    <>
      {phase === 'login'        && renderLogin()}
      {phase === 'modeSelect'   && renderModeSelect()}
      {phase === 'classSelect'  && renderClassSelect()}
      {phase === 'starterSelect'&& renderStarterSelect()}
      {['map','battle','mart','center','reward','switchPokemon'].includes(phase)
        && renderGameScreen(renderCenterForPhase())}
      {phase === 'gameover' && renderEndScreen(false)}
      {phase === 'victory'  && renderEndScreen(true)}
    </>
  );
}
