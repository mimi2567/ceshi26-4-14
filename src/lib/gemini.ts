import { Character, PlayerStats, ApiSettings } from "../types";

async function callGeminiDirect(prompt: string, systemInstruction: string, apiKey: string, responseMimeType?: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 200,
        ...(responseMimeType ? { responseMimeType } : {})
      },
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API Error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    return data.candidates[0].content.parts[0].text;
  }
  return "";
}

export async function generateDialogue(
  character: Character,
  playerStats: PlayerStats,
  playerName: string,
  userInput: string,
  history: string[],
  apiSettings: ApiSettings
) {
  // Determine nickname based on affection
  let nickname = character.nicknames.low;
  if (character.affection > 70) nickname = character.nicknames.high;
  else if (character.affection > 30) nickname = character.nicknames.medium;

  const systemInstruction = `
    你是一个像素风乙女游戏的攻略对象。
    当前角色信息：
    姓名：${character.name}
    头衔：${character.title}
    性格描述：${character.description}
    当前对玩家的好感度：${character.affection} (0-100)
    
    玩家信息：
    姓名：${playerName}
    你对玩家的称呼：${nickname} (根据好感度变化)
    
    玩家当前属性：
    魅力：${playerStats.charm}
    智慧：${playerStats.intelligence}
    声望：${playerStats.prestige}
    
    规则：
    1. 你的回复必须符合角色的性格。
    2. 你必须使用指定的称呼 "${nickname}" 来称呼玩家。
    3. 如果好感度低，回复会比较冷淡或有距离感；好感度高则会更亲密。
    4. 玩家正在与你进行每日互动。
    5. 你的回复应该简短有力，适合像素风文游的对话框（建议50字以内）。
    6. 仅返回角色的对话内容，不要包含任何元数据或括号。
  `;

  let textResponse = "......";

  try {
    // Use custom API if provided
    if (apiSettings.apiKey && apiSettings.baseUrl) {
      const response = await fetch(`${apiSettings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiSettings.apiKey}`
        },
        body: JSON.stringify({
          model: apiSettings.model || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemInstruction },
            ...history.map(h => ({ role: h.startsWith('玩家') ? 'user' : 'assistant', content: h.split('：')[1] })),
            { role: "user", content: userInput }
          ],
          temperature: 0.8,
          max_tokens: 100
        })
      });
      const data = await response.json();
      textResponse = data.choices[0].message.content || "......";
    } else {
      // Fallback to default Gemini via direct fetch
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");
      
      const prompt = `历史对话：\n${history.join('\n')}\n\n玩家说：${userInput}`;
      textResponse = await callGeminiDirect(prompt, systemInstruction, apiKey);
    }

    // MiniMax TTS Integration
    if (apiSettings.enableVoice && apiSettings.minimaxApiKey && apiSettings.minimaxGroupId) {
      try {
        const ttsResponse = await fetch(`https://api.minimax.chat/v1/text_to_speech?GroupId=${apiSettings.minimaxGroupId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiSettings.minimaxApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            voice_id: character.voiceId,
            text: textResponse,
            model: "speech-01",
            speed: 1.0,
            vol: 1.0,
            pitch: 0
          })
        });
        
        if (ttsResponse.ok) {
          const ttsData = await ttsResponse.json();
          if (ttsData.data && ttsData.data.audio) {
            const audio = new Audio(`data:audio/mp3;base64,${ttsData.data.audio}`);
            audio.play().catch(e => console.error("Audio Play Error:", e));
          }
        }
      } catch (voiceError) {
        console.error("Voice Generation Error:", voiceError);
      }
    }

    return textResponse;
  } catch (error) {
    console.error("Dialogue Error:", error);
    return "（他似乎在沉思，没有回答你的话。）";
  }
}

export async function generateDiaryEntry(
  character: Character,
  playerName: string,
  interactionHistory: string[],
  apiSettings: ApiSettings
) {
  const systemInstruction = `
    你是一个像素风乙女游戏的男主角。
    角色：${character.name}
    当前好感度：${character.affection}
    
    任务：
    以第一人称（“我”）的口吻，写一段简短的心动日记（30-50字），记录你刚刚和 ${playerName} 互动后的内心真实想法。
    
    互动背景：
    ${interactionHistory.slice(-2).join('\n')}
    
    规则：
    1. 语气必须符合角色性格。
    2. 表达出对玩家的好感度变化带来的心理波动。
    3. 仅返回日记正文，不要包含任何元数据。
  `;

  try {
    if (apiSettings.apiKey && apiSettings.baseUrl) {
      const response = await fetch(`${apiSettings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiSettings.apiKey}`
        },
        body: JSON.stringify({
          model: apiSettings.model || "gpt-3.5-turbo",
          messages: [{ role: "system", content: systemInstruction }],
          temperature: 0.9,
          max_tokens: 100
        })
      });
      const data = await response.json();
      return data.choices[0].message.content || "";
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");
      
      return await callGeminiDirect("写下你的日记。", systemInstruction, apiKey);
    }
  } catch (error) {
    console.error("Diary Generation Error:", error);
    return "";
  }
}

export async function generateStoryEvent(
  day: number,
  characters: Record<string, Character>,
  playerStats: PlayerStats,
  apiSettings: ApiSettings
) {
  const systemInstruction = `
    你是一个像素风乙女游戏的剧本作家。
    现在是第 ${day} 天。
    
    规则：
    1. 生成一个简短的剧情事件（100字以内）。
    2. 事件应该涉及玩家和其中一位攻略对象。
    3. 给出两个选项供玩家选择，每个选项会影响好感度或玩家属性。
    4. 返回JSON格式：
    {
      "story": "剧情描述...",
      "characterId": "涉及的角色ID",
      "options": [
        { "text": "选项1", "effect": { "affection": 5, "stat": "charm", "statValue": 2 }, "result": "选择后的简短反馈" },
        { "text": "选项2", "effect": { "affection": -2, "stat": "intelligence", "statValue": 5 }, "result": "选择后的简短反馈" }
      ]
    }
  `;

  try {
    if (apiSettings.apiKey && apiSettings.baseUrl) {
      const response = await fetch(`${apiSettings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiSettings.apiKey}`
        },
        body: JSON.stringify({
          model: apiSettings.model || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: "生成今天的随机剧情事件。" }
          ],
          response_format: { type: "json_object" },
          temperature: 0.8
        })
      });
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content || "{}");
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");
      
      const responseText = await callGeminiDirect("生成今天的随机剧情事件。", systemInstruction, apiKey, "application/json");
      return JSON.parse(responseText || "{}");
    }
  } catch (error) {
    console.error("Story Event Error:", error);
    return null;
  }
}
