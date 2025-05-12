// content.js
// Phiên bản: 1.6 (Node Replacement + Apply Font + Skip Footer)
console.log("OpenAI Translator Content Script v1.6 (Skip Footer) Loaded.");

// --- Định nghĩa Font Fallback Tiếng Việt ---
const VIETNAMESE_FALLBACK_FONT = "'Segoe UI', Tahoma, Arial, sans-serif";

// Biến để lưu trữ các nút văn bản gốc và nội dung của chúng
let textNodesFound = [];
let originalTexts = [];
let modifiedParents = new Set();
let isTranslated = false;
let loadingIndicator = null;

// --- Các hàm tiện ích (create/update/remove LoadingIndicator, create/remove RestoreButton) ---
// (Giữ nguyên các hàm này từ phiên bản 1.5)
function createLoadingIndicator() {
    if (document.getElementById('openai-translator-loading')) return;
    loadingIndicator = document.createElement('div');
    loadingIndicator.setAttribute('id', 'openai-translator-loading');
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '20px';
    loadingIndicator.style.right = '20px';
    loadingIndicator.style.backgroundColor = 'rgba(0,0,0,0.7)';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.padding = '10px 20px';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.style.zIndex = '999999';
    loadingIndicator.style.fontSize = '16px';
    loadingIndicator.textContent = 'Đang tìm và dịch văn bản với OpenAI...';
    document.body.appendChild(loadingIndicator);
}

function updateLoadingIndicator(text) {
    if (loadingIndicator) {
        loadingIndicator.textContent = text;
    }
}

function removeLoadingIndicator() {
    const indicator = document.getElementById('openai-translator-loading');
    if (indicator) {
        indicator.remove();
        loadingIndicator = null;
    }
}

function createRestoreButton() {
     if (document.getElementById('openai-translator-restore-button')) return;
     const restoreButton = document.createElement('button');
     restoreButton.setAttribute('id', 'openai-translator-restore-button');
     restoreButton.textContent = 'Khôi phục nội dung gốc';
     restoreButton.style.position = 'fixed';
     restoreButton.style.bottom = '20px';
     restoreButton.style.right = '20px';
     restoreButton.style.padding = '10px 15px';
     restoreButton.style.backgroundColor = '#dc3545';
     restoreButton.style.color = 'white';
     restoreButton.style.border = 'none';
     restoreButton.style.borderRadius = '5px';
     restoreButton.style.cursor = 'pointer';
     restoreButton.style.zIndex = '1000000';
     restoreButton.onclick = restoreOriginalContent;
     document.body.appendChild(restoreButton);
}

function removeRestoreButton() {
    const button = document.getElementById('openai-translator-restore-button');
    if (button) {
        button.remove();
    }
}

// --- Hàm Khôi Phục (Giữ nguyên từ phiên bản 1.5) ---
function restoreOriginalContent() {
    console.log("Khôi phục nội dung gốc và font...");
    removeLoadingIndicator();
    if (textNodesFound.length === originalTexts.length) {
        for (let i = 0; i < textNodesFound.length; i++) {
            const node = textNodesFound[i];
            if (node && node.nodeValue !== originalTexts[i] && document.body.contains(node)) {
                 node.nodeValue = originalTexts[i];
            }
        }
        modifiedParents.forEach(parentElement => {
            if (parentElement && document.body.contains(parentElement)) {
                parentElement.style.fontFamily = '';
                delete parentElement.dataset.fontModifiedByTranslator;
            }
        });
        isTranslated = false;
        modifiedParents.clear();
        removeRestoreButton();
        console.log(`Đã khôi phục ${textNodesFound.length} nút văn bản và font gốc.`);
    } else {
        console.error("Lỗi khôi phục: Số lượng nút và text gốc không khớp.");
        // Không nên alert lỗi này nếu người dùng đã yêu cầu bỏ qua check số lượng
        // alert("Lỗi: Không thể khôi phục nội dung gốc do dữ liệu không khớp.");
    }
}


// --- Hàm chính để tìm và gửi Text Nodes (CẬP NHẬT BỘ LỌC) ---
function findAndSendTextNodes() {
    createLoadingIndicator();

    if (isTranslated) {
        restoreOriginalContent();
    }
    modifiedParents.forEach(parentElement => {
         if (parentElement) delete parentElement.dataset.fontModifiedByTranslator;
    });
    modifiedParents.clear();

    textNodesFound = [];
    originalTexts = [];
    let charsFound = 0;
    const minTextLength = 3;

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                const parentElement = node.parentElement;
                if (!parentElement) return NodeFilter.FILTER_REJECT;

                // --- THÊM KIỂM TRA: Bỏ qua nếu nút nằm trong thẻ <footer> ---
                if (parentElement.closest('footer')) {
                    // console.log("Bỏ qua nút trong footer:", node.nodeValue.trim()); // Bỏ comment để debug nếu cần
                    return NodeFilter.FILTER_REJECT;
                }
                // --- KẾT THÚC KIỂM TRA FOOTER ---

                // Giữ lại các kiểm tra cũ
                const parentTag = parentElement.tagName.toUpperCase();
                if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'NOSCRIPT' || parentElement.isContentEditable) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.nodeValue.trim().length < minTextLength) {
                    return NodeFilter.FILTER_REJECT;
                }
                 if (parentElement.closest('[translate="no"]')) {
                     return NodeFilter.FILTER_REJECT;
                 }
                 const style = window.getComputedStyle(parentElement);
                 if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || parseInt(style.height) === 0) {
                     return NodeFilter.FILTER_REJECT;
                 }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    console.log("Bắt đầu quét Text Nodes (bỏ qua footer)...");
    let currentNode;
    while (currentNode = walker.nextNode()) {
        textNodesFound.push(currentNode);
        originalTexts.push(currentNode.nodeValue);
        charsFound += currentNode.nodeValue.length;
    }

    console.log(`Đã tìm thấy ${textNodesFound.length} nút văn bản (ngoài footer) với tổng ${charsFound} ký tự.`);

    if (textNodesFound.length === 0) {
        console.log("Không tìm thấy nội dung văn bản phù hợp để dịch (ngoài footer).");
        removeLoadingIndicator();
        alert("Không tìm thấy nội dung văn bản phù hợp để dịch trên trang này (đã bỏ qua footer).");
        return;
    }

    updateLoadingIndicator(`Đang gửi ${textNodesFound.length} đoạn văn bản đến OpenAI...`);

    chrome.runtime.sendMessage({
        action: "translateTextArray",
        texts: originalTexts
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Lỗi gửi tin nhắn translateTextArray:", chrome.runtime.lastError.message);
            removeLoadingIndicator();
            alert(`Lỗi giao tiếp với background: ${chrome.runtime.lastError.message}`);
        }
    });
}


// --- Lắng nghe tin nhắn từ background (Giữ nguyên từ phiên bản 1.5) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request.action);

  switch (request.action) {
    case "ping":
        sendResponse({ status: "pong" });
        break;

    case "translatePage":
        findAndSendTextNodes();
        sendResponse({ status: "processing" });
        break;

    case "replaceTextNodes":
        removeLoadingIndicator();
        if (!request.translatedTexts) {
            console.error("Lỗi: Không nhận được mảng bản dịch từ background.");
            alert("Lỗi: Không nhận được dữ liệu dịch. Vui lòng thử lại.");
            sendResponse({ status: "error", message: "Missing translatedTexts array" });
            break; // Thoát khỏi case này
        }
         // Cảnh báo nếu số lượng không khớp (do đã bỏ check ở background)
        if(request.translatedTexts.length !== textNodesFound.length) {
            console.log(`Cảnh báo: Số lượng bản dịch nhận được (${request.translatedTexts.length}) không khớp số lượng nút gốc (${textNodesFound.length}). Kết quả hiển thị có thể bị sai lệch.`);
            // Không alert ở đây vì người dùng đã yêu cầu bỏ check, chỉ log cảnh báo
        }

        console.log(`Nhận được ${request.translatedTexts.length} bản dịch. Bắt đầu thay thế text và áp dụng font...`);
        const parentsToModifyFont = new Set();
        // Chạy tối đa theo số lượng nút gốc hoặc số lượng bản dịch, lấy giá trị nhỏ hơn để tránh lỗi index
        const loopLength = Math.min(textNodesFound.length, request.translatedTexts.length);

        for (let i = 0; i < loopLength; i++) {
            const node = textNodesFound[i];
            const translatedText = request.translatedTexts[i]; // Lấy bản dịch tương ứng

            if (node && document.body.contains(node) && typeof translatedText === 'string') {
                 if (node.nodeValue !== translatedText) {
                    node.nodeValue = translatedText;
                 }
                 const parentElement = node.parentElement;
                 if (parentElement instanceof HTMLElement && !modifiedParents.has(parentElement)) {
                     parentsToModifyFont.add(parentElement);
                 }
            } else {
                 console.log(`Bỏ qua nút ${i}: Node không tồn tại hoặc bản dịch không hợp lệ.`);
            }
        }

        parentsToModifyFont.forEach(parentElement => {
             console.log(`Áp dụng font "${VIETNAMESE_FALLBACK_FONT}" cho parent:`, parentElement.tagName);
             parentElement.dataset.fontModifiedByTranslator = 'true';
             parentElement.style.fontFamily = VIETNAMESE_FALLBACK_FONT;
             modifiedParents.add(parentElement);
        });

        isTranslated = true;
        createRestoreButton();
        console.log(`Thay thế ${loopLength} nút văn bản và áp dụng font cho ${parentsToModifyFont.size} phần tử cha hoàn tất.`);
        sendResponse({ status: "nodes_replaced_with_font" });
        break;

    case "showError":
        removeLoadingIndicator();
        restoreOriginalContent(); // Tự động khôi phục nếu có lỗi từ API
        alert(`Lỗi dịch thuật từ OpenAI:\n${request.message}`);
        sendResponse({ status: "error_shown_and_restored" });
        break;

    case "removeLoading":
    case "updateLoading":
        if (request.action === "updateLoading" && request.message) {
            updateLoadingIndicator(request.message);
        } else {
             removeLoadingIndicator();
        }
        sendResponse({ status: "loading_updated_or_removed"});
        break;

    default:
        console.log("Content script nhận được action không xác định:", request.action);
        sendResponse({ status: "unknown_action" });
        break;
  }

  return true;
});

console.log("OpenAI Translator Content Script v1.6 listener ready.");