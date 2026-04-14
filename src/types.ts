export type CharacterId = 'xia' | 'qin' | 'shen' | 'li' | 'qi';

export interface Character {
  id: CharacterId;
  name: string;
  title: string;
  description: string;
  affection: number;
  portrait: string;
  color: string;
  voiceId: string;
  nicknames: {
    low: string;    // 0-30
    medium: string; // 31-70
    high: string;   // 71-100
  };
  diary: { date: number; text: string }[];
}

export interface PlayerStats {
  charm: number;
  intelligence: number;
  prestige: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  effect: {
    type: 'affection' | 'stat';
    target?: CharacterId;
    stat?: keyof PlayerStats;
    value: number;
  };
}

export const SHOP_ITEMS: Item[] = [
  {
    id: 'perfume',
    name: '迷人香水',
    description: '提升全员好感度 5 点。',
    price: 50,
    effect: { type: 'affection', value: 5 }
  },
  {
    id: 'book',
    name: '古老典籍',
    description: '智慧提升 10 点。',
    price: 30,
    effect: { type: 'stat', stat: 'intelligence', value: 10 }
  },
  {
    id: 'mirror',
    name: '魔法镜子',
    description: '魅力提升 10 点。',
    price: 30,
    effect: { type: 'stat', stat: 'charm', value: 10 }
  },
  {
    id: 'medal',
    name: '荣誉勋章',
    description: '声望提升 10 点。',
    price: 40,
    effect: { type: 'stat', stat: 'prestige', value: 10 }
  }
];

export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  minimaxApiKey: string;
  minimaxGroupId: string;
  enableVoice: boolean;
}

export interface GameState {
  day: number;
  stamina: number;
  gold: number;
  playerName: string;
  stats: PlayerStats;
  characters: Record<CharacterId, Character>;
  inventory: string[]; // Array of item IDs
  currentScene: 'home' | 'interaction' | 'cultivation' | 'story' | 'shop' | 'save_load' | 'settings' | 'character_info';
  selectedCharacterId: CharacterId | null;
  targetCharacterId: CharacterId | null;
  history: string[];
  apiSettings: ApiSettings;
  apiPresets: Record<string, ApiSettings>;
}

export const INITIAL_CHARACTERS: Record<CharacterId, Character> = {
  xia: {
    id: 'xia',
    name: '夏以昼',
    title: '守护你的兄长',
    description: '温润如玉，总是默默守护在你身边，给予你最坚实的依靠。',
    affection: 0,
    portrait: 'https://i.postimg.cc/pyMXT6vK/xia.jpg',
    color: '#8e44ad',
    voiceId: 'male-qn-qingxin',
    nicknames: { low: '你', medium: '小妹', high: '我的唯一' },
    diary: []
  },
  qin: {
    id: 'qin',
    name: '秦彻',
    title: '危险的野心家',
    description: '深不可测，带着危险而迷人的气息，似乎掌控着一切。',
    affection: 0,
    portrait: 'https://i.postimg.cc/t7GCTMbq/qin.jpg',
    color: '#c0392b',
    voiceId: 'male-qn-baoda',
    nicknames: { low: '喂', medium: '有趣的女人', high: '我的猎物' },
    diary: []
  },
  shen: {
    id: 'shen',
    name: '沈星回',
    title: '神秘的猎人',
    description: '如星光般清冷，却在不经意间流露出温柔，身世成谜。',
    affection: 0,
    portrait: 'https://i.postimg.cc/nrDhntyX/shen.jpg',
    color: '#f1c40f',
    voiceId: 'male-qn-jingying',
    nicknames: { low: '你', medium: '搭档', high: '星星' },
    diary: []
  },
  li: {
    id: 'li',
    name: '黎深',
    title: '严谨的医生',
    description: '外表冷若冰霜，内心却有着不为人知的炽热，医术高超。',
    affection: 0,
    portrait: 'https://i.postimg.cc/NLvfMztQ/li.jpg',
    color: '#2980b9',
    voiceId: 'male-qn-lengjun',
    nicknames: { low: '患者', medium: '笨蛋', high: '心跳' },
    diary: []
  },
  qi: {
    id: 'qi',
    name: '祁煜',
    title: '浪漫的艺术家',
    description: '性格古灵精怪，充满艺术气息，总是能带给你意想不到的惊喜。',
    affection: 0,
    portrait: 'https://i.postimg.cc/Dm3yZMhn/qi.jpg',
    color: '#16a085',
    voiceId: 'male-qn-youmo',
    nicknames: { low: '你', medium: '保镖', high: '我的缪斯' },
    diary: []
  }
};
