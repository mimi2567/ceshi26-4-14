import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Brain, Star, Sun, MessageSquare, Sparkles, User, ArrowRight, ShoppingBag, Save, Target, Coins, Trash2, Settings, RefreshCw, Play, X } from 'lucide-react';
import { GameState, INITIAL_CHARACTERS, CharacterId, Character, SHOP_ITEMS, Item, ApiSettings } from './types';
import { DialogueBox, CharacterPortrait } from './components/GameUI';
import { generateDialogue, generateDiaryEntry } from './lib/gemini';

const SAVE_KEY = 'otome_game_save_slots';

export default function App() {
  const [game, setGame] = useState<GameState>({
    day: 1,
    stamina: 100,
    gold: 100,
    playerName: '旅行者',
    stats: { charm: 10, intelligence: 10, prestige: 10 },
    characters: INITIAL_CHARACTERS,
    inventory: [],
    currentScene: 'home',
    selectedCharacterId: null,
    targetCharacterId: null,
    history: [],
    apiSettings: { baseUrl: '', apiKey: '', model: '', minimaxApiKey: '', minimaxGroupId: '', enableVoice: false },
    apiPresets: {}
  });

  const [saves, setSaves] = useState<Record<string, GameState>>({});
  const [modelList, setModelList] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    const savedData = localStorage.getItem(SAVE_KEY);
    if (savedData) {
      setSaves(JSON.parse(savedData));
    }
  }, []);

  const savePreset = () => {
    if (!presetName.trim()) {
      setCurrentDialogue({ name: '系统', text: '请输入预设名称。' });
      return;
    }
    setGame(prev => ({
      ...prev,
      apiPresets: {
        ...prev.apiPresets,
        [presetName]: { ...prev.apiSettings }
      }
    }));
    setPresetName('');
    setCurrentDialogue({ name: '系统', text: `预设方案 "${presetName}" 已保存。` });
  };

  const loadPreset = (name: string) => {
    setGame(prev => ({
      ...prev,
      apiSettings: { ...prev.apiPresets[name] }
    }));
    setCurrentDialogue({ name: '系统', text: `已加载预设方案 "${name}"。` });
  };

  const deletePreset = (name: string) => {
    setGame(prev => {
      const newPresets = { ...prev.apiPresets };
      delete newPresets[name];
      return { ...prev, apiPresets: newPresets };
    });
  };

  const saveGame = (slot: string) => {
    const newSaves = { ...saves, [slot]: game };
    setSaves(newSaves);
    localStorage.setItem(SAVE_KEY, JSON.stringify(newSaves));
    setCurrentDialogue({ name: '系统', text: `存档成功！已保存至位置 ${slot}` });
  };

  const loadGame = (slot: string) => {
    if (saves[slot]) {
      setGame(saves[slot]);
      setCurrentDialogue({ name: '系统', text: `读档成功！欢迎回来。` });
    }
  };

  const deleteSave = (slot: string) => {
    const newSaves = { ...saves };
    delete newSaves[slot];
    setSaves(newSaves);
    localStorage.setItem(SAVE_KEY, JSON.stringify(newSaves));
  };

  const loadModels = async () => {
    if (!game.apiSettings.baseUrl || !game.apiSettings.apiKey) {
      setCurrentDialogue({ name: '系统', text: '请先填写 API 地址和 Key。' });
      return;
    }
    setIsFetchingModels(true);
    try {
      const response = await fetch(`${game.apiSettings.baseUrl.replace(/\/$/, '')}/v1/models`, {
        headers: { 'Authorization': `Bearer ${game.apiSettings.apiKey}` }
      });
      const data = await response.json();
      if (data.data) {
        setModelList(data.data.map((m: any) => m.id));
        setCurrentDialogue({ name: '系统', text: '模型列表拉取成功！' });
      }
    } catch (error) {
      setCurrentDialogue({ name: '系统', text: '拉取模型失败，请检查设置。' });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const testVoice = async (voiceId: string) => {
    if (!game.apiSettings.minimaxApiKey || !game.apiSettings.minimaxGroupId) {
      setCurrentDialogue({ name: '系统', text: '请先填写 MiniMax API Key 和 Group ID。' });
      return;
    }
    try {
      const response = await fetch(`https://api.minimax.chat/v1/text_to_speech?GroupId=${game.apiSettings.minimaxGroupId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${game.apiSettings.minimaxApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          voice_id: voiceId,
          text: "你好，我是你的攻略对象。你能听到我的声音吗？",
          model: "speech-01",
          speed: 1.0,
          vol: 1.0,
          pitch: 0
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${data.data.audio}`);
          audio.play().catch(e => console.error("Audio Play Error:", e));
          setCurrentDialogue({ name: '系统', text: '语音测试中...' });
        } else {
          setCurrentDialogue({ name: '系统', text: '语音合成失败，请检查设置。' });
        }
      } else {
        setCurrentDialogue({ name: '系统', text: '接口请求失败，请检查 API Key 和 Group ID。' });
      }
    } catch (error) {
      setCurrentDialogue({ name: '系统', text: '测试失败，请检查网络或设置。' });
    }
  };

  const [currentDialogue, setCurrentDialogue] = useState<{ name: string; text: string; color?: string } | null>({
    name: '系统',
    text: '欢迎来到《我的恋与世界》。你穿越到了最喜欢的游戏世界，现在是第1天。',
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [showAffection, setShowAffection] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [homeSubMenu, setHomeSubMenu] = useState<'main' | 'actions'>('main');

  const nextDay = useCallback(() => {
    setGame(prev => ({
      ...prev,
      day: prev.day + 1,
      stamina: 100,
      gold: prev.gold + 50,
      currentScene: 'home',
      selectedCharacterId: null
    }));
    setCurrentDialogue({ name: '系统', text: `新的一天开始了。体力已恢复至 100 点，获得了 50 金币。今天是第${game.day + 1}天。` });
  }, [game.day]);

  const handleAction = (type: GameState['currentScene']) => {
    if (game.stamina < 20 && !['shop', 'save_load', 'settings', 'character_info', 'home'].includes(type)) {
      setCurrentDialogue({ name: '系统', text: '体力不足，无法进行该行动。请先休息（进入下一天）。' });
      return;
    }
    setGame(prev => ({ ...prev, currentScene: type }));
  };

  const selectCharacter = (id: CharacterId) => {
    setGame(prev => ({ ...prev, selectedCharacterId: id }));
    const char = game.characters[id];
    setCurrentDialogue({ 
      name: char.name, 
      text: `哦？你找我有事吗？`, 
      color: char.color 
    });
  };

  const setTarget = (id: CharacterId) => {
    setGame(prev => ({ ...prev, targetCharacterId: id }));
    const char = game.characters[id];
    setCurrentDialogue({ 
      name: '系统', 
      text: `你决定将 ${char.name} 定为主要攻略目标。`, 
    });
  };

  const handleChat = async () => {
    if (!userInput.trim() || !game.selectedCharacterId || isProcessing) return;

    setIsProcessing(true);
    const char = game.characters[game.selectedCharacterId];
    
    const response = await generateDialogue(
      char,
      game.stats,
      game.playerName,
      userInput,
      game.history.slice(-5),
      game.apiSettings
    );

    const affectionGain = game.targetCharacterId === char.id ? 2 : 1;

    setGame(prev => ({
      ...prev,
      stamina: prev.stamina - 20,
      history: [...prev.history, `玩家：${userInput}`, `${char.name}：${response}`],
      characters: {
        ...prev.characters,
        [char.id]: { ...char, affection: char.affection + affectionGain }
      }
    }));

    setCurrentDialogue({ name: char.name, text: response, color: char.color });
    setUserInput('');
    setIsProcessing(false);

    // Generate Diary Entry in background
    const diaryText = await generateDiaryEntry(
      char,
      game.playerName,
      [`玩家：${userInput}`, `${char.name}：${response}`],
      game.apiSettings
    );

    if (diaryText) {
      setGame(prev => ({
        ...prev,
        characters: {
          ...prev.characters,
          [char.id]: {
            ...prev.characters[char.id],
            diary: [
              { date: prev.day, text: diaryText },
              ...prev.characters[char.id].diary
            ].slice(0, 20) // Keep last 20 entries
          }
        }
      }));
    }
  };

  const handleBuyItem = (item: Item) => {
    if (game.gold < item.price) {
      setCurrentDialogue({ name: '系统', text: '金币不足！' });
      return;
    }

    let newCharacters = { ...game.characters };
    let newStats = { ...game.stats };

    if (item.effect.type === 'affection') {
      if (item.effect.target) {
        const char = newCharacters[item.effect.target];
        newCharacters[item.effect.target] = { ...char, affection: char.affection + item.effect.value };
      } else {
        Object.keys(newCharacters).forEach(id => {
          const char = newCharacters[id as CharacterId];
          newCharacters[id as CharacterId] = { ...char, affection: char.affection + item.effect.value };
        });
      }
    } else if (item.effect.type === 'stat' && item.effect.stat) {
      newStats[item.effect.stat] += item.effect.value;
    }

    setGame(prev => ({
      ...prev,
      gold: prev.gold - item.price,
      inventory: [...prev.inventory, item.id],
      characters: newCharacters,
      stats: newStats
    }));

    setCurrentDialogue({ name: '系统', text: `购买并使用了 ${item.name}！` });
  };

  const handleCultivate = (stat: keyof typeof game.stats) => {
    setGame(prev => ({
      ...prev,
      stamina: prev.stamina - 20,
      stats: { ...prev.stats, [stat]: prev.stats[stat] + 5 },
      currentScene: 'home'
    }));
    setCurrentDialogue({ name: '系统', text: `通过努力，你的${stat === 'charm' ? '魅力' : stat === 'intelligence' ? '智慧' : '声望'}提升了！` });
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden flex flex-col bg-retro-bg"
      style={{ 
        backgroundImage: game.currentScene === 'home' 
          ? "url('https://i.postimg.cc/0NBHR67d/zhu-ye-mian.jpg')" 
          : game.currentScene === 'settings'
          ? "url('https://i.postimg.cc/nr3J64Y6/选择页面.jpg')"
          : game.currentScene === 'character_info'
          ? "url('https://i.postimg.cc/3NtTPXF7/页面3.jpg')"
          : "none",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Top Bar */}
      <div className="p-4 flex justify-between items-center bg-black/40 border-b-4 border-black z-20">
        <div className="flex gap-8 items-center w-full justify-center">
          <div className="flex items-center gap-2 text-retro-gold">
            <Sun size={18} />
            <span className="font-pixel text-xs">第 {game.day} 天</span>
          </div>
          <div className="flex items-center gap-2 text-yellow-500">
            <Coins size={18} />
            <span className="font-pixel text-xs">{game.gold} G</span>
          </div>
          <div className="flex items-center gap-2 text-pink-400">
            <Sparkles size={18} />
            <span className="font-pixel text-xs">体力 {game.stamina}/100</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {game.currentScene === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full h-full relative flex flex-col items-center justify-center"
            >
              {/* Floating Heart Icon for Affection (Always accessible or via button) */}
              <div 
                className="absolute top-0 right-0 z-20 p-2"
                onClick={() => setShowAffection(!showAffection)}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="pixel-button bg-pink-500 border-pink-900 p-2 flex items-center justify-center shadow-[4px_4px_0px_0px_#831843]"
                >
                  <Heart size={24} className={showAffection ? "text-white" : "text-pink-100"} fill={showAffection ? "currentColor" : "none"} />
                </motion.div>
              </div>

              {/* Affection Overview Panel (Floating) */}
              <AnimatePresence>
                {showAffection && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    className="absolute top-16 right-0 z-30 w-64 pixel-card bg-pink-50/95 border-4 border-pink-600 shadow-[6px_6px_0px_0px_#831843]"
                  >
                    <h3 className="font-pixel text-[10px] text-pink-700 mb-4 flex items-center gap-2">
                      <Heart size={12} fill="currentColor" /> 好感度档案
                    </h3>
                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                      {(Object.values(game.characters) as Character[]).map((char) => (
                        <div key={char.id} className="space-y-1">
                          <div className="flex justify-between text-[8px] font-pixel text-pink-900">
                            <div className="flex items-center gap-2">
                              {char.name}
                              {game.targetCharacterId === char.id && <Target size={10} className="text-pink-500 animate-pulse" />}
                            </div>
                            <span>{char.affection}%</span>
                          </div>
                          <div className="h-2 bg-pink-200 border border-pink-400 overflow-hidden rounded-sm">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(0, Math.min(100, char.affection))}%` }}
                              className="h-full"
                              style={{ backgroundColor: char.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Menu / Actions Menu Container */}
              <div className="z-10 w-full max-w-xs">
                <AnimatePresence mode="wait">
                  {homeSubMenu === 'main' ? (
                    <motion.div 
                      key="main-menu"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col gap-4"
                    >
                      <button 
                        onClick={() => setHomeSubMenu('actions')}
                        className="pixel-button text-white font-pixel text-xs py-4 flex items-center justify-center gap-3"
                        style={{
                          backgroundImage: "url('https://i.postimg.cc/mZCRjRGc/dui-hua-kuang.png')",
                          backgroundSize: '100% 100%',
                          backgroundRepeat: 'no-repeat',
                          backgroundColor: 'transparent',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                      >
                        <Play size={16} fill="currentColor" /> 开始游戏
                      </button>
                      <button 
                        onClick={() => handleAction('character_info')}
                        className="pixel-button text-white font-pixel text-xs py-4 flex items-center justify-center gap-3"
                        style={{
                          backgroundImage: "url('https://i.postimg.cc/mZCRjRGc/dui-hua-kuang.png')",
                          backgroundSize: '100% 100%',
                          backgroundRepeat: 'no-repeat',
                          backgroundColor: 'transparent',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                      >
                        <Heart size={16} fill="currentColor" /> 男主信息
                      </button>
                      <button 
                        onClick={() => handleAction('settings')}
                        className="pixel-button text-white font-pixel text-xs py-4 flex items-center justify-center gap-3"
                        style={{
                          backgroundImage: "url('https://i.postimg.cc/mZCRjRGc/dui-hua-kuang.png')",
                          backgroundSize: '100% 100%',
                          backgroundRepeat: 'no-repeat',
                          backgroundColor: 'transparent',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                      >
                        <Settings size={16} /> 系统设置
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="actions-menu"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="pixel-card bg-pink-50/90 border-4 border-pink-600 flex flex-col gap-3 shadow-[8px_8px_0px_0px_#831843]"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="font-pixel text-[10px] text-pink-700">日常行动</h2>
                        <button 
                          onClick={() => setHomeSubMenu('main')}
                          className="text-pink-500 hover:text-pink-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <button onClick={() => handleAction('interaction')} className="pixel-button bg-pink-400 hover:bg-pink-300 border-pink-800 text-white text-[10px] flex items-center gap-3">
                        <MessageSquare size={14} /> 寻找攻略对象
                      </button>
                      <button onClick={() => handleAction('cultivation')} className="pixel-button bg-pink-400 hover:bg-pink-300 border-pink-800 text-white text-[10px] flex items-center gap-3">
                        <User size={14} /> 自我提升
                      </button>
                      <button onClick={() => handleAction('shop')} className="pixel-button bg-amber-600 hover:bg-amber-500 border-amber-900 text-white text-[10px] flex items-center gap-3">
                        <ShoppingBag size={14} /> 访问商城
                      </button>
                      <button onClick={() => handleAction('save_load')} className="pixel-button bg-teal-600 hover:bg-teal-500 border-teal-900 text-white text-[10px] flex items-center gap-3">
                        <Save size={14} /> 存档/读档
                      </button>
                      <button onClick={() => handleAction('settings')} className="pixel-button bg-gray-500 hover:bg-gray-400 border-gray-800 text-white text-[10px] flex items-center gap-3">
                        <Settings size={14} /> 系统设置
                      </button>
                      <button onClick={nextDay} className="pixel-button bg-indigo-600 hover:bg-indigo-500 border-indigo-900 text-white text-[10px] flex items-center gap-3">
                        <ArrowRight size={14} /> 结束这一天
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {homeSubMenu === 'main' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute bottom-12 font-pixel text-[8px] text-pink-600/60"
                >
                  - 命中注定的邂逅即将开始 -
                </motion.div>
              )}
            </motion.div>
          )}
          {game.currentScene === 'character_info' && (
            <motion.div 
              key="character_info"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full max-w-5xl h-full overflow-hidden"
            >
              <div className="flex justify-between items-center w-full px-4">
                <h2 className="font-pixel text-lg text-pink-600">男主档案</h2>
                <button onClick={() => { setGame(prev => ({ ...prev, currentScene: 'home', selectedCharacterId: null })); setHomeSubMenu('main'); }} className="pixel-button bg-pink-500 text-[10px]">返回主城</button>
              </div>

              {!game.selectedCharacterId ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full overflow-y-auto p-4 custom-scrollbar">
                  {(Object.values(game.characters) as Character[]).map((char) => (
                    <motion.div 
                      key={char.id}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => setGame(prev => ({ ...prev, selectedCharacterId: char.id }))}
                      className="pixel-card bg-pink-50/90 border-4 border-pink-400 flex flex-col items-center gap-3 cursor-pointer shadow-[4px_4px_0px_0px_#ff8fa3]"
                    >
                      <div className="w-full aspect-[2/3] overflow-hidden border-2 border-pink-200 bg-pink-100">
                        <img src={char.portrait} alt={char.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="text-center">
                        <p className="font-pixel text-[10px] text-pink-900">{char.name}</p>
                        <p className="font-pixel text-[8px] text-pink-500 mt-1">好感度: {char.affection}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-6 w-full h-full overflow-hidden p-4">
                  {/* Left: Portrait */}
                  <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <div className="pixel-card bg-pink-50/90 border-4 border-pink-400 aspect-[2/3] overflow-hidden p-0">
                      <img src={game.characters[game.selectedCharacterId].portrait} alt={game.characters[game.selectedCharacterId].name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <button onClick={() => setGame(prev => ({ ...prev, selectedCharacterId: null }))} className="pixel-button bg-pink-400 text-[10px]">选择其他男主</button>
                  </div>

                  {/* Right: Info & Diary */}
                  <div className="w-full md:w-2/3 flex flex-col gap-4 overflow-hidden">
                    <div className="pixel-card bg-pink-50/90 border-4 border-pink-400 flex-1 flex flex-col gap-4 overflow-hidden">
                      <div className="flex justify-between items-center border-b-2 border-pink-200 pb-2">
                        <h3 className="font-pixel text-sm text-pink-700">{game.characters[game.selectedCharacterId].name}</h3>
                        <span className="font-pixel text-[8px] text-pink-400">{game.characters[game.selectedCharacterId].title}</span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                        {/* Detailed Info (Placeholder) */}
                        <section>
                          <h4 className="font-pixel text-[10px] text-pink-600 mb-2 flex items-center gap-2">
                            <User size={12} /> 详细设定
                          </h4>
                          <div className="bg-white/50 p-3 border-2 border-pink-100 min-h-[100px]">
                            <p className="font-silk text-[10px] text-pink-800 italic opacity-60">详细人物设定构思中...</p>
                          </div>
                        </section>

                        {/* Diary Section */}
                        <section>
                          <h4 className="font-pixel text-[10px] text-pink-600 mb-2 flex items-center gap-2">
                            <Save size={12} /> 心动日记
                          </h4>
                          <div className="space-y-3">
                            {game.characters[game.selectedCharacterId].diary.length > 0 ? (
                              game.characters[game.selectedCharacterId].diary.map((entry, idx) => (
                                <div key={idx} className="bg-white/50 p-3 border-2 border-pink-100 relative">
                                  <span className="absolute top-1 right-2 font-pixel text-[6px] text-pink-300">DAY {entry.date}</span>
                                  <p className="font-silk text-[10px] text-pink-900 leading-relaxed">“{entry.text}”</p>
                                </div>
                              ))
                            ) : (
                              <div className="bg-white/50 p-3 border-2 border-pink-100 text-center">
                                <p className="font-silk text-[10px] text-pink-400 italic">目前还没有心动记录...</p>
                              </div>
                            )}
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {game.currentScene === 'interaction' && (
            <motion.div 
              key="interaction"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8 w-full"
            >
              {!game.selectedCharacterId ? (
                <div className="flex flex-col items-center gap-6">
                  <h2 className="font-pixel text-lg text-retro-gold">选择要互动的对象</h2>
                  <div className="flex gap-8 overflow-x-auto p-8 max-w-full">
                    {(Object.values(game.characters) as Character[]).map((char) => (
                      <div key={char.id} className="flex flex-col items-center gap-4">
                        <div onClick={() => selectCharacter(char.id as CharacterId)} className="cursor-pointer hover:scale-105 transition-transform">
                          <CharacterPortrait character={char} isActive={true} />
                        </div>
                        <button 
                          onClick={() => setTarget(char.id as CharacterId)}
                          className={`pixel-button text-[10px] py-1 ${game.targetCharacterId === char.id ? 'bg-retro-accent' : ''}`}
                        >
                          {game.targetCharacterId === char.id ? '当前目标' : '设为目标'}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setGame(prev => ({ ...prev, currentScene: 'home' }))} className="pixel-button bg-gray-700 text-xs">
                    返回主城
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <CharacterPortrait character={game.characters[game.selectedCharacterId]} isActive={true} />
                  <div className="flex gap-2 w-full max-w-md mt-4">
                    <input 
                      type="text" 
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                      placeholder="输入想说的话..."
                      className="flex-1 bg-black border-4 border-white p-2 font-silk text-white outline-none"
                    />
                    <button 
                      onClick={handleChat}
                      disabled={isProcessing}
                      className="pixel-button bg-retro-accent disabled:opacity-50"
                    >
                      {isProcessing ? '...' : '发送'}
                    </button>
                  </div>
                  <button onClick={() => setGame(prev => ({ ...prev, currentScene: 'home', selectedCharacterId: null }))} className="pixel-button bg-gray-700 text-xs mt-4">
                    结束对话
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {game.currentScene === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full max-w-2xl"
            >
              <h2 className="font-pixel text-xl text-gray-300">系统设置</h2>
              
              <div className="pixel-card w-full flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
                <div className="border-b-2 border-white/20 pb-4 mb-2">
                  <h3 className="font-pixel text-xs text-retro-gold mb-4">预设方案管理</h3>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="新方案名称..."
                      className="flex-1 bg-black border-2 border-white p-2 font-silk text-xs text-white outline-none"
                    />
                    <button onClick={savePreset} className="pixel-button bg-retro-accent text-[10px]">保存当前为预设</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(game.apiPresets).map(name => (
                      <div key={name} className="flex items-center gap-1 bg-white/10 p-1 border border-white/30">
                        <button onClick={() => loadPreset(name)} className="font-silk text-[10px] px-2 hover:text-retro-gold">{name}</button>
                        <button onClick={() => deletePreset(name)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={10} /></button>
                      </div>
                    ))}
                    {Object.keys(game.apiPresets).length === 0 && <span className="text-[10px] opacity-40 italic">暂无预设方案</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-pixel text-[10px]">玩家姓名</label>
                  <input 
                    type="text" 
                    value={game.playerName}
                    onChange={(e) => setGame(prev => ({ ...prev, playerName: e.target.value }))}
                    className="bg-black border-2 border-white p-2 font-silk text-white outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-pixel text-[10px]">API 中转地址 (Base URL)</label>
                  <input 
                    type="text" 
                    value={game.apiSettings.baseUrl}
                    onChange={(e) => setGame(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, baseUrl: e.target.value } }))}
                    placeholder="https://api.openai.com"
                    className="bg-black border-2 border-white p-2 font-silk text-white outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-pixel text-[10px]">API Key</label>
                  <input 
                    type="password" 
                    value={game.apiSettings.apiKey}
                    onChange={(e) => setGame(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, apiKey: e.target.value } }))}
                    className="bg-black border-2 border-white p-2 font-silk text-white outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-pixel text-[10px]">选择模型</label>
                  <div className="flex gap-2">
                    <select 
                      value={game.apiSettings.model}
                      onChange={(e) => setGame(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, model: e.target.value } }))}
                      className="flex-1 bg-black border-2 border-white p-2 font-silk text-white outline-none"
                    >
                      <option value="">默认 (Gemini)</option>
                      {modelList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button 
                      onClick={loadModels}
                      disabled={isFetchingModels}
                      className="pixel-button bg-blue-900"
                    >
                      <RefreshCw size={16} className={isFetchingModels ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className="border-t-2 border-white/20 pt-4 mt-2">
                  <h3 className="font-pixel text-xs text-retro-accent mb-4">语音设置 (MiniMax)</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <label className="font-pixel text-[10px]">启用语音</label>
                    <input 
                      type="checkbox" 
                      checked={game.apiSettings.enableVoice}
                      onChange={(e) => setGame(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, enableVoice: e.target.checked } }))}
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="font-pixel text-[10px]">MiniMax API Key</label>
                      <input 
                        type="password" 
                        value={game.apiSettings.minimaxApiKey}
                        onChange={(e) => setGame(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, minimaxApiKey: e.target.value } }))}
                        className="bg-black border-2 border-white p-2 font-silk text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-pixel text-[10px]">MiniMax Group ID</label>
                      <input 
                        type="text" 
                        value={game.apiSettings.minimaxGroupId}
                        onChange={(e) => setGame(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, minimaxGroupId: e.target.value } }))}
                        className="bg-black border-2 border-white p-2 font-silk text-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-white/20 pt-4 mt-2">
                  <h3 className="font-pixel text-xs text-retro-gold mb-4">男主音色 ID 设置</h3>
                  <p className="text-[8px] opacity-60 mb-4 font-silk">提示：音色 ID 可在 MiniMax 控制台的“音色库”中查看或自定义。</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(Object.values(game.characters) as Character[]).map(char => (
                      <div key={char.id} className="flex flex-col gap-2">
                        <label className="font-pixel text-[8px]">{char.name} Voice ID</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={char.voiceId}
                            onChange={(e) => setGame(prev => ({
                              ...prev,
                              characters: {
                                ...prev.characters,
                                [char.id]: { ...char, voiceId: e.target.value }
                              }
                            }))}
                            className="flex-1 bg-black border-2 border-white p-1 font-silk text-[10px] text-white outline-none"
                          />
                          <button 
                            onClick={() => testVoice(char.voiceId)}
                            className="pixel-button bg-retro-accent text-[8px] py-1 px-2"
                          >
                            测试
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setGame(prev => ({ ...prev, currentScene: 'home' }))} className="pixel-button bg-gray-700 text-xs mt-4">
                保存并返回
              </button>
            </motion.div>
          )}

          {game.currentScene === 'shop' && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full max-w-4xl"
            >
              <h2 className="font-pixel text-xl text-amber-500">皇家商城</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {SHOP_ITEMS.map(item => (
                  <div key={item.id} className="pixel-card flex justify-between items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-pixel text-xs text-retro-gold">{item.name}</span>
                      <span className="text-[10px] opacity-70">{item.description}</span>
                    </div>
                    <button 
                      onClick={() => handleBuyItem(item)}
                      className="pixel-button text-[10px] bg-amber-700 whitespace-nowrap"
                    >
                      {item.price} G
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setGame(prev => ({ ...prev, currentScene: 'home' }))} className="pixel-button bg-gray-700 text-xs mt-4">
                离开商城
              </button>
            </motion.div>
          )}

          {game.currentScene === 'save_load' && (
            <motion.div 
              key="save_load"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full max-w-2xl"
            >
              <h2 className="font-pixel text-xl text-teal-500">时空存档点</h2>
              <div className="grid grid-cols-1 gap-4 w-full">
                {['1', '2', '3'].map(slot => (
                  <div key={slot} className="pixel-card flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="font-pixel text-xs">存档位 {slot}</span>
                      <span className="text-[10px] opacity-60">
                        {saves[slot] ? `第 ${saves[slot].day} 天 - 魅力 ${saves[slot].stats.charm}` : '空存档'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveGame(slot)} className="pixel-button text-[10px] bg-teal-700">保存</button>
                      {saves[slot] && (
                        <>
                          <button onClick={() => loadGame(slot)} className="pixel-button text-[10px] bg-blue-700">读取</button>
                          <button onClick={() => deleteSave(slot)} className="pixel-button text-[10px] bg-red-900"><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setGame(prev => ({ ...prev, currentScene: 'home' }))} className="pixel-button bg-gray-700 text-xs mt-4">
                返回主界面
              </button>
            </motion.div>
          )}

          {game.currentScene === 'cultivation' && (
            <motion.div 
              key="cultivation"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8"
            >
              <h2 className="font-pixel text-xl text-retro-gold mb-4">选择提升的方向</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button onClick={() => handleCultivate('charm')} className="pixel-card hover:bg-pink-900/30 transition-colors flex flex-col items-center gap-4 p-8">
                  <Sparkles size={48} className="text-pink-400" />
                  <span className="font-pixel text-sm">提升魅力</span>
                  <span className="text-xs opacity-60">更吸引攻略对象</span>
                </button>
                <button onClick={() => handleCultivate('intelligence')} className="pixel-card hover:bg-blue-900/30 transition-colors flex flex-col items-center gap-4 p-8">
                  <Brain size={48} className="text-blue-400" />
                  <span className="font-pixel text-sm">提升智慧</span>
                  <span className="text-xs opacity-60">解锁更多对话选项</span>
                </button>
                <button onClick={() => handleCultivate('prestige')} className="pixel-card hover:bg-yellow-900/30 transition-colors flex flex-col items-center gap-4 p-8">
                  <Star size={48} className="text-yellow-400" />
                  <span className="font-pixel text-sm">提升声望</span>
                  <span className="text-xs opacity-60">在社交场合更有话语权</span>
                </button>
              </div>
              <button onClick={() => setGame(prev => ({ ...prev, currentScene: 'home' }))} className="pixel-button bg-gray-700 text-xs mt-4">
                取消提升
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dialogue Layer */}
      <AnimatePresence>
        {currentDialogue && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            onClick={() => setCurrentDialogue(null)}
          >
            <DialogueBox 
              name={currentDialogue.name} 
              text={currentDialogue.text} 
              color={currentDialogue.color}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#ff007f22,transparent_70%)]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')]" />
      </div>
    </div>
  );
}
