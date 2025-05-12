# Tiện ích Dịch Trang Web bằng OpenAI API (Chrome Extension)

Đây là một tiện ích mở rộng cho Google Chrome giúp dịch nội dung trang web hiện tại sang tiếng Việt, sử dụng sức mạnh của OpenAI API (GPT). Tiện ích cố gắng giữ lại các thuật ngữ IT gốc bằng tiếng Anh và thay thế văn bản trực tiếp trên trang, tương tự như tính năng dịch tích hợp của trình duyệt.

## Tính năng chính (Features)

* Dịch nội dung chính của trang web (văn bản trong thẻ `<body>`, tự động **bỏ qua** nội dung trong thẻ `<footer>`) sang **tiếng Việt**.
* Sử dụng **OpenAI API** (yêu cầu API Key hợp lệ từ người dùng).
* Cho phép người dùng cấu hình **API Key** và **Model OpenAI** (ví dụ: `gpt-4o-mini`, `gpt-4-turbo`) thông qua trang Tùy chọn (Options Page).
* Cố gắng **giữ nguyên các thuật ngữ IT**, từ khóa lập trình, tên công nghệ phổ biến bằng tiếng Anh (thông qua hướng dẫn chi tiết trong prompt gửi đến API).
* Thay thế văn bản dịch **tại chỗ** (in-place node replacement), giữ nguyên cấu trúc HTML và các thẻ bao quanh văn bản gốc.
* Tự động **áp dụng font chữ dự phòng** (`'Segoe UI', Tahoma, Arial, sans-serif`) cho các phần tử chứa văn bản dịch để cải thiện khả năng hiển thị ký tự tiếng Việt (Lưu ý: việc này sẽ ghi đè lên font chữ gốc của trang web).
* Cung cấp nút "**Khôi phục nội dung gốc**" để quay lại trạng thái ban đầu của trang trước khi dịch.
* Được xây dựng trên nền tảng **Manifest V3** của Chrome Extensions.

## Công nghệ sử dụng (Technology Stack)

* **Chrome Extension APIs (Manifest V3):** `scripting`, `storage`, `action`, `runtime`, `notifications`
* **OpenAI API:** Chat Completions endpoint với JSON Mode.
* **JavaScript:** ES6+ (bao gồm `async`/`await`, `Workspace`).
* **HTML5 / CSS3:** Cho trang Tùy chọn (Options Page).

## Cài đặt (Setup for Development)

1.  **Clone Repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-folder>
    ```
2.  **Chuẩn bị Icons:** Tạo các file ảnh `icon16.png`, `icon48.png`, `icon128.png` và đặt chúng vào thư mục `icons/`.
3.  **Tải Extension vào Chrome:**
    * Mở trình duyệt Chrome và truy cập `chrome://extensions/`.
    * Bật **"Chế độ dành cho nhà phát triển"** (Developer mode) ở góc trên bên phải.
    * Nhấp vào nút **"Tải tiện ích đã giải nén"** (Load unpacked).
    * Chọn thư mục chứa mã nguồn của tiện ích này (thư mục bạn vừa clone về).
4.  Tiện ích sẽ xuất hiện trong danh sách và biểu tượng sẽ hiển thị trên thanh công cụ Chrome.

## Cấu hình (Configuration)

**QUAN TRỌNG:** Tiện ích này yêu cầu bạn cung cấp API Key của riêng mình từ OpenAI.

1.  Sau khi cài đặt tiện ích, nhấp chuột phải vào biểu tượng của nó trên thanh công cụ Chrome.
2.  Chọn **"Tùy chọn"** (Options).
3.  Trong trang Tùy chọn mở ra:
    * **Nhập OpenAI API Key của bạn:** Đây là thông tin bắt buộc. Bạn cần có tài khoản OpenAI và tạo một API Key hợp lệ.
    * **(Tùy chọn) Chọn Model OpenAI:** Nhập tên model bạn muốn sử dụng (ví dụ: `gpt-4o-mini`, `gpt-4-turbo`). **Model này phải hỗ trợ JSON Mode.** Nếu để trống, model mặc định trong code (thường là `gpt-4o-mini`) sẽ được sử dụng.
    * **(Tùy chọn) URL API:** Thường không cần thay đổi trừ khi bạn sử dụng proxy hoặc endpoint tùy chỉnh.
4.  Nhấn nút **"Lưu cấu hình"**.

**Lưu ý về chi phí:** Việc sử dụng OpenAI API sẽ **phát sinh chi phí** dựa trên số lượng token (văn bản) được xử lý. Hãy quản lý và theo dõi việc sử dụng API Key của bạn trên trang quản trị của OpenAI.

## Cách hoạt động (How it Works)

1.  Người dùng nhấp vào biểu tượng tiện ích trên một trang web.
2.  `background.js` nhận sự kiện, kiểm tra tính hợp lệ của trang và gửi yêu cầu `translatePage` đến `content.js`. Nếu `content.js` chưa chạy, `background.js` sẽ inject nó vào trang trước.
3.  `content.js` nhận lệnh `translatePage`:
    * Hiển thị chỉ báo "Đang tìm..."
    * Sử dụng `TreeWalker` để quét qua các nút văn bản (Text Nodes) trong `document.body`.
    * Bộ lọc `acceptNode` được sử dụng để **bỏ qua** các nút văn bản:
        * Nằm trong thẻ `<script>`, `<style>`, `<noscript>`.
        * Nằm trong thẻ `<footer>`.
        * Có thuộc tính `contentEditable`.
        * Quá ngắn (chỉ chứa khoảng trắng hoặc ít ký tự).
        * Nằm trong phần tử có thuộc tính `translate="no"`.
        * Nằm trong phần tử bị ẩn (kiểm tra cơ bản `display: none`, `visibility: hidden`...).
    * Lưu trữ các nút văn bản hợp lệ (`textNodesFound`) và nội dung gốc của chúng (`originalTexts`).
    * Gửi mảng `originalTexts` đến `background.js` với action `translateTextArray`.
4.  `background.js` nhận `translateTextArray`:
    * Lấy API Key và cấu hình từ `storage`.
    * **(Phiên bản hiện tại - Không chia chunk)** Chuẩn bị một yêu cầu duy nhất chứa *toàn bộ* mảng `originalTexts`.
    * Xây dựng prompt chi tiết yêu cầu OpenAI dịch sang tiếng Việt, giữ thuật ngữ IT, và **trả về kết quả dưới dạng một JSON object duy nhất** có key là `"translations"` chứa một mảng các bản dịch tương ứng (sử dụng JSON Mode của API).
    * Gọi OpenAI API bằng `Workspace`.
    * Nhận phản hồi, parse JSON bên ngoài, sau đó parse chuỗi JSON bên trong `message.content` để lấy mảng `translations`.
    * Gửi mảng bản dịch (`translatedTexts`) về cho `content.js` với action `replaceTextNodes`.
5.  `content.js` nhận `replaceTextNodes`:
    * Xóa chỉ báo loading.
    * Lặp qua các nút văn bản gốc (`textNodesFound`).
    * Với mỗi nút, thay thế `nodeValue` bằng bản dịch tương ứng từ `translatedTexts`.
    * Đồng thời, áp dụng `font-family: 'Segoe UI', Tahoma, Arial, sans-serif;` vào style inline của phần tử HTML cha chứa nút văn bản đó để cải thiện hiển thị tiếng Việt (ghi đè font gốc). Đánh dấu phần tử cha này để có thể khôi phục.
    * Hiển thị nút "Khôi phục nội dung gốc".
6.  **Khôi phục:** Khi nhấn nút "Khôi phục...", `content.js` lặp qua các nút đã thay đổi, đặt lại `nodeValue` về `originalTexts`, và xóa style `font-family` inline khỏi các phần tử cha đã bị thay đổi.

## Hạn chế Hiện tại / Cảnh báo (Current Limitations / Warnings)

* **⚠️ RỦI RO VƯỢT GIỚI HẠN TOKEN:** Phiên bản hiện tại **không chia nhỏ (no chunking)** văn bản mà gửi toàn bộ lên API trong một lần. Với các trang web dài, điều này **rất dễ gây lỗi "context_length_exceeded"** từ OpenAI, làm cho việc dịch thất bại.
* **⚠️ RỦI RO HIỂN THỊ SAI LỆCH:** Code hiện tại **không kiểm tra** số lượng bản dịch trả về từ API có khớp với số lượng văn bản gốc hay không (theo yêu cầu người dùng trước đó). Nếu API trả về số lượng không khớp, nội dung trên trang **có thể bị hiển thị sai lệch, lộn xộn hoặc dịch thiếu** mà không có cảnh báo rõ ràng. Việc khôi phục cũng có thể gặp vấn đề.
* **Giữ thuật ngữ IT:** Tính năng này phụ thuộc vào khả năng của model AI và có thể không chính xác 100%.
* **Ghi đè Font:** Việc áp dụng font tiếng Việt dự phòng sẽ làm thay đổi giao diện font chữ gốc của trang web.

## Cải tiến Tương lai (Possible Future Improvements)

* **Triển khai lại Chunking:** Chia nhỏ văn bản thành các phần hợp lý để gửi nhiều yêu cầu API nhỏ hơn, tránh lỗi giới hạn token và xử lý được các trang dài.
* **Thêm lại Kiểm tra Số lượng:** Khôi phục bước kiểm tra số lượng bản dịch trả về và xử lý lỗi một cách an toàn khi số lượng không khớp.
* **Tùy chọn Font:** Cho phép người dùng bật/tắt hoặc chọn font chữ tiếng Việt muốn áp dụng.
* **Cải thiện UI/UX:** Có thể thêm giao diện popup để điều khiển, hiển thị trạng thái chi tiết hơn.
* **Tối ưu hóa:** Cải thiện hiệu suất quét DOM và thay thế văn bản trên các trang phức tạp.
* **Tùy chỉnh Thuật ngữ:** Cho phép người dùng thêm danh sách thuật ngữ riêng không cần dịch.