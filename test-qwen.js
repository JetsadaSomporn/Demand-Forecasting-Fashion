// Test script for Qwen API integration
const API_URL = "https://router.huggingface.co/v1/chat/completions";

async function testQwenAPI() {
  const hfToken = "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";
  
  const payload = {
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this fashion item image and extract: 1) Main color (one word: black, white, blue, red, etc.) 2) Style description (brief). Respond in JSON format: {\"color\": \"colorname\", \"style\": \"description\"}"
          },
          {
            type: "image_url",
            image_url: {
              url: "https://cdn.britannica.com/61/93061-050-99147DCE/Statue-of-Liberty-Island-New-York-Bay.jpg"
            }
          }
        ]
      }
    ],
    model: "Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic",
    max_tokens: 200,
    temperature: 0.1
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ Qwen API Response:");
    console.log(JSON.stringify(data, null, 2));
    
    if (data.choices?.[0]?.message?.content) {
      console.log("\n📄 Extracted Content:");
      console.log(data.choices[0].message.content);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testQwenAPI();