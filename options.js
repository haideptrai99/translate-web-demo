const apiUrlInput = document.getElementById('apiUrl');
const apiKeyInput = document.getElementById('apiKey');
const apiModelInput = document.getElementById('apiModel');
const saveButton = document.getElementById('saveButton');
const statusDiv = document.getElementById('status');

const DEFAULT_OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-3.5-turbo";

// Tải cấu hình đã lưu khi mở trang tùy chọn
function loadOptions() {
  chrome.storage.sync.get(['apiUrl', 'apiKey', 'apiModel'], (result) => {
    apiUrlInput.value = result.apiUrl || DEFAULT_OPENAI_API_URL;
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    apiModelInput.value = result.apiModel || DEFAULT_OPENAI_MODEL;
    console.log('Cấu hình OpenAI đã tải:', {
        apiUrl: apiUrlInput.value,
        apiKeyIsSet: !!result.apiKey, // Chỉ log xem key có được set hay không
        apiModel: apiModelInput.value
    });
  });
}

// Lưu cấu hình
function saveOptions() {
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_OPENAI_API_URL;
  const apiKey = apiKeyInput.value.trim(); // API Key có thể chứa ký tự đặc biệt, không nên trim quá nhiều
  const apiModel = apiModelInput.value.trim() || DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
      statusDiv.textContent = 'Lỗi: Vui lòng nhập OpenAI API Key.';
      statusDiv.style.color = 'red';
      return;
  }
   // Đơn giản check xem key có bắt đầu bằng "sk-" không, dù không hoàn toàn chính xác
  if (!apiKey.startsWith("sk-")) {
      statusDiv.textContent = 'Cảnh báo: API Key có vẻ không đúng định dạng (thường bắt đầu bằng "sk-").';
      statusDiv.style.color = 'orange';
      // Vẫn cho lưu
  }


  chrome.storage.sync.set({ apiUrl, apiKey, apiModel }, () => {
    if (statusDiv.style.color !== 'orange') { // Nếu không có cảnh báo định dạng
        statusDiv.textContent = 'Cấu hình đã được lưu!';
        statusDiv.style.color = 'green';
    } else {
        // Nếu có cảnh báo, thêm thông báo đã lưu
        statusDiv.textContent += ' Cấu hình đã được lưu.';
    }

    console.log('Cấu hình OpenAI đã lưu:', { apiUrl, apiKeyIsSet: !!apiKey, apiModel });
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.style.color = 'green'; // Reset màu
    }, 4000);
  });
}

document.addEventListener('DOMContentLoaded', loadOptions);
saveButton.addEventListener('click', saveOptions);