// background.js
// Phiên bản: 1.3 (Bỏ chia chunk - Gửi toàn bộ text lên API)
// CẢNH BÁO: Có nguy cơ cao gặp lỗi giới hạn token trên các trang dài.

// --- Các hằng số cấu hình ---
const DEFAULT_OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"; // Hoặc model bạn chọn
// const MAX_CHARS_PER_API_CALL = 8000; // Đã loại bỏ logic chia chunk

// --- Lắng nghe sự kiện chính ---

// 1. Khi người dùng nhấp vào biểu tượng tiện ích
chrome.action.onClicked.addListener((tab) => {
  const currentTime = new Date().toLocaleTimeString();
  console.log(`[${currentTime}] Biểu tượng tiện ích được nhấn cho tab: ${tab.id}, URL: ${tab.url}`);

  // Kiểm tra xem URL có hợp lệ để inject script không
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('https://chrome.google.com/webstore')) {
       console.warn(`Không thể chạy tiện ích trên trang: ${tab.url}`);
       chrome.notifications.create({
             type: 'basic', iconUrl: 'icons/icon48.png',
             title: 'Không thể dịch trang', message: `Tiện ích không thể hoạt động trên các trang nội bộ của Chrome hoặc Cửa hàng Chrome.`, priority: 1
       });
       return; // Dừng lại nếu là trang bị hạn chế
  }

  // Gửi lệnh yêu cầu content script bắt đầu quá trình quét trang
  chrome.tabs.sendMessage(tab.id, { action: "translatePage" }, (response) => {
      if (chrome.runtime.lastError) {
          console.warn(`Không thể gửi lệnh translatePage đến tab ${tab.id} (lần đầu): ${chrome.runtime.lastError.message}. Đang thử inject script...`);
          injectContentScriptAndRun(tab.id);
      } else if (response && response.status === "processing") {
           console.log(`Content script của tab ${tab.id} đã nhận lệnh và đang xử lý.`);
      } else {
           console.log(`Phản hồi từ content script của tab ${tab.id} khi gửi translatePage:`, response);
      }
  });
});

// 2. Lắng nghe tin nhắn từ content script (yêu cầu dịch mảng text)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateTextArray") {
        const tabId = sender.tab?.id;
        if (!tabId) {
             console.error("Không thể xác định tab ID từ sender.");
             sendResponse({ status: "error", message: "Invalid sender tab ID"});
             return false;
        }
        const currentTime = new Date().toLocaleTimeString();
        console.log(`[${currentTime}] Nhận yêu cầu dịch ${request.texts?.length} đoạn văn bản từ tab ${tabId} (Sẽ gửi toàn bộ)`);

        if (!request.texts || request.texts.length === 0) {
            console.warn(`Tab ${tabId}: Mảng văn bản rỗng, không có gì để dịch.`);
            chrome.tabs.sendMessage(tabId, { action: "showError", message: "Không có nội dung text hợp lệ để gửi đi dịch." }).catch(e => console.warn(`Failed to send 'showError' for empty texts: ${e.message}`));
            sendResponse({ status: "empty_texts" });
            return false;
        }

        // Lấy cấu hình API
        chrome.storage.sync.get(['apiUrl', 'apiKey', 'apiModel'], (config) => {
            const apiUrl = config.apiUrl || DEFAULT_OPENAI_API_URL;
            const apiKey = config.apiKey;
            const apiModel = config.apiModel || DEFAULT_OPENAI_MODEL;

            if (!apiKey) {
                console.error(`Tab ${tabId}: Chưa cấu hình API Key của OpenAI.`);
                chrome.tabs.sendMessage(tabId, { action: "showError", message: "Chưa cấu hình API Key OpenAI. Vui lòng vào Tùy chọn của tiện ích." }).catch(e => console.warn(`Failed to send 'showError' for missing API key: ${e.message}`));
                chrome.runtime.openOptionsPage();
                // Không cần phản hồi lại sendResponse vì đã return true bên ngoài
                return;
            }

            // Gọi hàm xử lý dịch (KHÔNG CÒN CHIA CHUNK)
            translateEntireTextArrayWithOpenAI(request.texts, apiUrl, apiKey, apiModel, tabId);
        });

        // Quan trọng: return true vì hàm dịch là async
        sendResponse({ status: "processing_request" });
        return true;
    }
});


// --- Các hàm hỗ trợ ---

/**
 * Inject content script vào tab nếu chưa có và gửi lệnh bắt đầu dịch.
 * @param {number} tabId ID của tab cần inject script.
 */
function injectContentScriptAndRun(tabId) {
    console.log(`[${new Date().toLocaleTimeString()}] Đang inject content.js vào tab ${tabId}...`);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }, (injectionResults) => {
      if (chrome.runtime.lastError || !injectionResults || injectionResults.length === 0) {
        console.error(`Lỗi inject script vào tab ${tabId}: ${chrome.runtime.lastError?.message || 'Không có kết quả trả về.'}`);
        chrome.notifications.create({
             type: 'basic', iconUrl: 'icons/icon48.png',
             title: 'Lỗi Tiện Ích', message: `Không thể inject script vào trang này. Trang có thể được bảo vệ hoặc không tương thích.\nLỗi: ${chrome.runtime.lastError?.message || 'Unknown'}`, priority: 2
         });
        return;
      }
      console.log(`Inject script thành công vào tab ${tabId}. Gửi lại lệnh translatePage...`);
      setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: "translatePage" }, (response) => {
               if (chrome.runtime.lastError) {
                   console.error(`Vẫn không thể gửi lệnh translatePage đến tab ${tabId} sau khi inject: ${chrome.runtime.lastError.message}`);
                   chrome.notifications.create({
                     type: 'basic', iconUrl: 'icons/icon48.png',
                     title: 'Lỗi Tiện Ích', message: `Không thể giao tiếp với content script sau khi inject.\nLỗi: ${chrome.runtime.lastError.message}`, priority: 2
                   });
               } else {
                   console.log(`Lệnh translatePage đã gửi thành công sau khi inject đến tab ${tabId}. Trạng thái:`, response?.status);
               }
          });
      }, 100);
    });
}

/**
 * Gửi TOÀN BỘ mảng văn bản đến API OpenAI trong một yêu cầu duy nhất.
 * @param {string[]} texts Mảng các đoạn văn bản cần dịch.
 * @param {string} apiUrl URL của API OpenAI.
 * @param {string} apiKey API Key của OpenAI.
 * @param {string} apiModel Model OpenAI sẽ sử dụng.
 * @param {number} tabId ID của tab gửi yêu cầu.
 */
async function translateEntireTextArrayWithOpenAI(texts, apiUrl, apiKey, apiModel, tabId) {
    const totalTexts = texts.length;
    const currentTime = new Date().toLocaleTimeString();
    console.log(`[${currentTime}] Chuẩn bị gửi ${totalTexts} đoạn text trong MỘT yêu cầu đến OpenAI cho tab ${tabId}... (KHÔNG CHIA CHUNK)`);
    chrome.tabs.sendMessage(tabId, { action: "updateLoading", message: `Đang gửi ${totalTexts} đoạn đến OpenAI...` }).catch(e => console.warn(`Failed to send 'updateLoading': ${e.message}`));

    // Lọc bỏ các đoạn text rỗng trước khi gửi để tiết kiệm token (tùy chọn)
    const nonEmtpyTexts = texts.filter(text => text && text.trim());
    if (nonEmtpyTexts.length !== texts.length) {
        console.log(`   Đã lọc bỏ ${texts.length - nonEmtpyTexts.length} đoạn text rỗng.`);
        // Lưu ý: Nếu lọc bỏ, logic map kết quả trả về cần phức tạp hơn.
        // Để đơn giản, tạm thời KHÔNG lọc bỏ mà gửi cả text rỗng lên API.
        // API nên trả về string rỗng cho các input rỗng theo prompt.
    }

    try {
        // Gọi API một lần duy nhất với toàn bộ mảng texts
        const allTranslatedTexts = await callOpenAIForAllTexts(texts, apiUrl, apiKey, apiModel, tabId);

        console.log(`[${new Date().toLocaleTimeString()}] Dịch hoàn tất cho tab ${tabId}. Tổng cộng ${allTranslatedTexts.length} kết quả.`);

        // Gửi kết quả về cho content script
        // Kiểm tra số lượng trả về phải khớp với số lượng gửi đi ban đầu (texts.length)
        
            chrome.tabs.sendMessage(tabId, {
                action: "replaceTextNodes",
                translatedTexts: allTranslatedTexts
            }).catch(e => console.error(`Lỗi gửi kết quả replaceTextNodes về tab ${tabId}: ${e.message}`));
        

    } catch (error) {
        // Lỗi từ callOpenAIForAllTexts đã được log và gửi về content script
        console.error(`[${new Date().toLocaleTimeString()}] Đã xảy ra lỗi trong quá trình gọi API dịch cho tab ${tabId}:`, error.message);
        // Đảm bảo xóa loading indicator nếu có lỗi
        chrome.tabs.sendMessage(tabId, { action: "removeLoading" }).catch(e => console.warn(`Failed to send 'removeLoading' after error: ${e.message}`));
    }
}


/**
 * Gọi API OpenAI cho TOÀN BỘ mảng văn bản sử dụng JSON Mode.
 * (Đổi tên từ callOpenAIForChunk để rõ ràng hơn)
 * @param {string[]} allTexts Mảng TOÀN BỘ các đoạn văn bản.
 * @param {string} apiUrl URL của API OpenAI.
 * @param {string} apiKey API Key của OpenAI.
 * @param {string} apiModel Model OpenAI sẽ sử dụng.
 * @param {number} tabId ID của tab để gửi thông báo lỗi nếu cần.
 * @returns {Promise<string[]>} Promise trả về mảng các bản dịch tương ứng.
 * @throws {Error} Ném lỗi nếu API trả về lỗi hoặc kết quả không hợp lệ.
 */
async function callOpenAIForAllTexts(allTexts, apiUrl, apiKey, apiModel, tabId) {
    // System prompt vẫn giữ nguyên yêu cầu về JSON object chứa key "translations"
    const systemPrompt = `You are a highly skilled translation assistant. Your primary task is to translate the provided array of text strings into natural-sounding Vietnamese.
IMPORTANT INSTRUCTIONS:
1. Translate the content accurately into Vietnamese.
2. CRITICAL: Do NOT translate common IT technical terms, programming keywords, software/product names, or company names. Keep them in their original English form (Examples: 'API', 'JavaScript', 'React', 'Docker', 'Google', 'VS Code', etc.).
3. Respond ONLY with a single, raw, valid JSON object. This object MUST contain a single key named "translations".
4. The value of the "translations" key MUST be a JSON array of strings. This array must have the exact same number of elements as the input array provided in the user prompt. Each string in the "translations" array must be the Vietnamese translation of the corresponding string in the input array.
5. If an input string is empty or contains only whitespace, the corresponding string in the output "translations" array should also be empty or reasonably represent an empty translation.
6. Do not include any extra text, explanations, apologies, or markdown formatting in your response. Your entire response must be JUST the JSON object itself.
EXAMPLE OUTPUT FORMAT: {"translations": ["Bản dịch chuỗi 1", "Bản dịch chuỗi 2 với API", "Bản dịch chuỗi 3"]}`;

    // Chuyển toàn bộ mảng text thành chuỗi JSON
    const jsonInputString = JSON.stringify(allTexts);
    const userPrompt = `Translate the array of strings in the following JSON into Vietnamese, following all system instructions precisely. Ensure the output is ONLY a valid JSON object containing the "translations" key as specified:\n\n${jsonInputString}`;

    // Ước tính độ dài prompt (rất thô sơ) để cảnh báo nếu quá lớn
    const estimatedPromptLength = systemPrompt.length + userPrompt.length;
    console.log(`   [callOpenAIForAllTexts] Chuẩn bị gửi ${allTexts.length} đoạn đến ${apiModel} (JSON Mode). Tab: ${tabId}. Estimated prompt chars: ~${estimatedPromptLength}`);
    if (estimatedPromptLength > 100000) { // Cảnh báo nếu prompt quá dài (ví dụ > 100k chars)
        console.warn(`   [callOpenAIForAllTexts] CẢNH BÁO: Prompt rất dài (~${estimatedPromptLength} ký tự), có nguy cơ cao vượt quá giới hạn token của model ${apiModel}.`);
        chrome.tabs.sendMessage(tabId, { action: "updateLoading", message: `CẢNH BÁO: Dữ liệu gửi đi rất lớn, có thể gặp lỗi giới hạn token...` }).catch(e => console.warn(`Failed to send 'updateLoading' warning: ${e.message}`));
    }

    // Chuẩn bị body cho request API
    const requestBody = {
        model: apiModel,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        // Bật JSON Mode
        response_format: { type: "json_object" },
    };

    try {
        // Gọi API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
            // Cân nhắc tăng timeout cho các request lớn
            // signal: AbortSignal.timeout(120000) // Ví dụ: 120 giây
        });

        const responseText = await response.text();

        // Xử lý nếu API không trả về status OK
        if (!response.ok) {
            console.error(`   [callOpenAIForAllTexts] Lỗi API OpenAI (JSON Mode). Status: ${response.status} ${response.statusText}. Tab: ${tabId}`);
            console.error('   [callOpenAIForAllTexts] Response Text:', responseText.substring(0, 1000) + '...'); // Log nhiều hơn để xem lỗi context length
            let errorData = { error: { message: `HTTP ${response.status} ${response.statusText}. Response not valid JSON.` }};
            try { errorData = JSON.parse(responseText); } catch (e) { console.warn("   [callOpenAIForAllTexts] Không thể parse response lỗi thành JSON.");}
            // Kiểm tra lỗi context length phổ biến
            let errorMessage = errorData.error?.message || `HTTP ${response.status}`;
            if (errorData.error?.code === 'context_length_exceeded') {
                errorMessage = `Lỗi API OpenAI: ${errorMessage}. Nội dung trang quá dài, vượt quá giới hạn token của model ${apiModel}. Hãy thử lại với trang ngắn hơn hoặc sử dụng phiên bản có chia nhỏ dữ liệu.`;
            } else {
                 errorMessage = `Lỗi API OpenAI: ${errorMessage}`;
            }
            chrome.tabs.sendMessage(tabId, { action: "showError", message: errorMessage }).catch(e => console.warn(`Failed to send 'showError' for API error: ${e.message}`));
            throw new Error(errorMessage);
        }

        // Xử lý khi response OK
        try {
            // Parse JSON bên ngoài
            const outerResponseObject = JSON.parse(responseText);

            // Kiểm tra cấu trúc cơ bản
            if (!outerResponseObject.choices?.[0]?.message?.content || typeof outerResponseObject.choices[0].message.content !== 'string') {
                throw new Error("Cấu trúc phản hồi API OpenAI không hợp lệ.");
            }

            // Lấy chuỗi JSON bên trong
            const innerJsonString = outerResponseObject.choices[0].message.content;

            // Parse chuỗi JSON bên trong
            const innerResponseObject = JSON.parse(innerJsonString);

            // Kiểm tra key 'translations' và kiểu Array
            if (innerResponseObject && Array.isArray(innerResponseObject.translations)) {
                const translatedArray = innerResponseObject.translations;

               
                return translatedArray;

            } else {
                throw new Error("API không trả về cấu trúc JSON object như yêu cầu (thiếu key 'translations' hoặc sai kiểu dữ liệu trong message.content).");
            }

        } catch (parseError) {
            console.error('   [callOpenAIForAllTexts] Lỗi phân tích JSON từ phản hồi OpenAI (JSON Mode):', parseError, ` Tab: ${tabId}`);
            if (typeof innerJsonString !== 'undefined') {
                 console.error('   [callOpenAIForAllTexts] Chuỗi JSON bên trong (content) gây lỗi parse:', innerJsonString?.substring(0, 500) + '...');
            } else {
                 console.error('   [callOpenAIForAllTexts] Chuỗi phản hồi bên ngoài gây lỗi parse:', responseText.substring(0, 500) + '...');
            }
            chrome.tabs.sendMessage(tabId, { action: "showError", message: `Lỗi phân tích phản hồi JSON từ OpenAI (JSON Mode): ${parseError.message}` }).catch(e => console.warn(`Failed to send 'showError' for parse error: ${e.message}`));
            throw new Error(`Lỗi phân tích phản hồi JSON từ OpenAI (JSON Mode): ${parseError.message}`);
        }

    } catch (fetchError) {
        console.error(`   [callOpenAIForAllTexts] Lỗi fetch khi gọi API (JSON Mode): ${fetchError}. Tab: ${tabId}`);
        if (!fetchError.message.includes("Lỗi API OpenAI") && !fetchError.message.includes("Lỗi phân tích")) {
             chrome.tabs.sendMessage(tabId, { action: "showError", message: `Lỗi mạng hoặc kết nối khi gọi API: ${fetchError.message}` }).catch(e => console.warn(`Failed to send 'showError' for fetch error: ${e.message}`));
        }
        throw fetchError;
    }
}

console.log(`[${new Date().toLocaleTimeString()}] Background script (Service Worker) v1.3 (No Chunking) đã khởi động.`);