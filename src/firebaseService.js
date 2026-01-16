// Firebase Service - Funções de persistência para o PokeApp RPG
import { database } from './firebase'
import { ref, set, get, onValue, off } from 'firebase/database'

// ==================== FUNÇÕES GENÉRICAS ====================

// Salvar dados no Firebase
export const saveToFirebase = async (path, data) => {
  try {
    await set(ref(database, path), data)
    return true
  } catch (error) {
    console.error('Erro ao salvar no Firebase:', error)
    return false
  }
}

// Carregar dados do Firebase (uma vez)
export const loadFromFirebase = async (path, defaultValue = null) => {
  try {
    const snapshot = await get(ref(database, path))
    if (snapshot.exists()) {
      return snapshot.val()
    }
    return defaultValue
  } catch (error) {
    console.error('Erro ao carregar do Firebase:', error)
    return defaultValue
  }
}

// Escutar mudanças em tempo real
export const subscribeToFirebase = (path, callback) => {
  const dbRef = ref(database, path)
  onValue(dbRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  })
  // Retorna função para cancelar a inscrição
  return () => off(dbRef)
}

// ==================== FUNÇÕES ESPECÍFICAS ====================

// --- TREINADORES ---

// Salvar dados do treinador
export const saveTrainerData = async (username, data) => {
  return saveToFirebase(`trainers/${username}`, data)
}

// Carregar dados do treinador
export const loadTrainerData = async (username) => {
  return loadFromFirebase(`trainers/${username}`, null)
}

// Escutar mudanças no treinador
export const subscribeToTrainer = (username, callback) => {
  return subscribeToFirebase(`trainers/${username}`, callback)
}

// --- MESTRE ---

// Salvar configuração do mestre
export const saveMestreConfig = async (data) => {
  return saveToFirebase('mestre/config', data)
}

// Carregar configuração do mestre
export const loadMestreConfig = async () => {
  return loadFromFirebase('mestre/config', null)
}

// --- NPCs ---

// Salvar NPCs do mestre
export const saveNpcTrainers = async (username, npcs) => {
  return saveToFirebase(`npcTrainers/${username}`, npcs)
}

// Carregar NPCs do mestre
export const loadNpcTrainers = async (username) => {
  return loadFromFirebase(`npcTrainers/${username}`, [])
}

// --- ESPÉCIES EXÓTICAS ---

// Salvar espécies exóticas globais
export const saveGlobalExoticSpecies = async (species) => {
  return saveToFirebase('globalExoticSpecies', species)
}

// Carregar espécies exóticas globais
export const loadGlobalExoticSpecies = async () => {
  return loadFromFirebase('globalExoticSpecies', [])
}

// Escutar mudanças nas espécies exóticas
export const subscribeToGlobalExoticSpecies = (callback) => {
  return subscribeToFirebase('globalExoticSpecies', (data) => {
    callback(data || [])
  })
}

// --- BATALHA ---

// Salvar dados de batalha
export const saveBattleData = async (data) => {
  return saveToFirebase('battle', data)
}

// Carregar dados de batalha
export const loadBattleData = async () => {
  return loadFromFirebase('battle', {
    trainers: [],
    pokemon: [],
    currentTrainerTurn: 0,
    currentPokemonTurn: 0,
    pokemonConditions: {},
    trainerStages: {},
    pokemonStages: {}
  })
}

// Escutar mudanças na batalha (tempo real)
export const subscribeToBattle = (callback) => {
  return subscribeToFirebase('battle', (data) => {
    callback(data || {
      trainers: [],
      pokemon: [],
      currentTrainerTurn: 0,
      currentPokemonTurn: 0,
      pokemonConditions: {},
      trainerStages: {},
      pokemonStages: {}
    })
  })
}

// --- CHAT ---

// Salvar mensagens do chat
export const saveChatMessages = async (messages) => {
  return saveToFirebase('chat/messages', messages)
}

// Carregar mensagens do chat
export const loadChatMessages = async () => {
  return loadFromFirebase('chat/messages', [])
}

// Escutar mudanças no chat (tempo real)
export const subscribeToChatMessages = (callback) => {
  return subscribeToFirebase('chat/messages', (data) => {
    callback(data || [])
  })
}

// --- INTERLÚDIO ---

// Salvar dados do interlúdio
export const saveInterludioData = async (data) => {
  return saveToFirebase('interludio', data)
}

// Carregar dados do interlúdio
export const loadInterludioData = async () => {
  return loadFromFirebase('interludio', {
    players: [],
    combateMode: false,
    combateVotes: {},
    concursoMode: false,
    concursoVotes: {}
  })
}

// Escutar mudanças no interlúdio (tempo real)
export const subscribeToInterludio = (callback) => {
  return subscribeToFirebase('interludio', (data) => {
    callback(data || {
      players: [],
      combateMode: false,
      combateVotes: {},
      concursoMode: false,
      concursoVotes: {}
    })
  })
}

// --- MOCHILA GLOBAL (itens disponíveis na loja) ---

// Salvar itens da loja
export const saveShopItems = async (items) => {
  return saveToFirebase('shop/items', items)
}

// Carregar itens da loja
export const loadShopItems = async () => {
  return loadFromFirebase('shop/items', [])
}
