# CẨM NANG TOÀN TẬP MÃ NGUỒN POKÉSURVIVOR (DEVELOPER GUIDE)

> **Tài liệu hướng dẫn kiến trúc, cấu trúc thư mục, quy trình lập trình và các lưu ý kỹ thuật quan trọng trong dự án PokéSurvivor.**

---

## 1. TỔNG QUAN DỰ ÁN & KIẾN TRÚC

- **Thể loại:** Web Game phong cách sinh tồn (Survivor.io / Vampire Survivors) kết hợp vũ trụ Pokémon (966 Pokémon từ Gen 1 đến Gen 9, Shinies, Tiến hóa, Multiplayer Co-op tối đa 4 người).
- **Công nghệ nền tảng:**
  - **Front-end:** Vanilla JavaScript (ES2020+), HTML5 `<canvas>`, Web Audio API. Không dùng thư viện cồng kềnh (không React/Vue, không Phaser).
  - **Backend / Cloud:** Firebase Authentication, Cloud Firestore (lưu save, bạn bè, ranking), Firebase Realtime Database (tùy chọn).
  - **Mạng Multiplayer:** WebRTC DataChannel (P2P Mesh giữa các người chơi qua Google STUN server miễn phí) + Firestore Signaling.
  - **Không gian biến toàn cục (Global Namespace):** Tất cả hệ thống gắn liền vào đối tượng `window.G` (viết tắt của Game), ví dụ: `G.Player`, `G.Combat`, `G.Spawner`, `G.DB`, `G.Net`, `G.Social`...

---

## 2. QUY TRÌNH LẬP TRÌNH & ĐÓNG GÓI (WORKFLOW)

Dự án có **2 môi trường trang web riêng biệt**:

### 2.1. File `dev.html` (Môi trường Lập trình - Development)
- **Cơ chế:** Nạp rời từng file riêng lẻ (`<script defer src="js/...">`).
- **Khi nào dùng:** Dùng hàng ngày khi viết code, chỉnh sửa chỉ số, thêm chiêu thức, sửa bug.
- **Cách truy cập:** `http://localhost:3000/dev` (hoặc `http://IP_LAN:3000/dev`).
- **Ưu điểm:** Sửa file bất kỳ trong thư mục `js/`, ấn `Ctrl + S` rồi sang trình duyệt ấn `F5` là **có hiệu lực ngay lập tức 100%**. F12 Console báo chính xác tên file và dòng bị lỗi.
- **Quy tắc vàng:** Mọi thay đổi về cấu trúc giao diện HTML **bắt buộc phải sửa ở `dev.html`**, không sửa tay ở `index.html`.

### 2.2. File `index.html` (Môi trường Phát hành - Production)
- **Cơ chế:** Chỉ chứa đúng 1 dòng nạp file đóng gói:
  ```html
  <script defer src="js/app.min.js?v=mã_hash"></script>
  ```
- **Khi nào dùng:** Bản chính thức cho người chơi truy cập tại `http://localhost:3000` (hoặc public lên domain).
- **Ưu điểm:** Web tải cực nhanh (1 HTTP request duy nhất), chống gian lận F12 (Anti-cheat).

### 2.3. Các công cụ đóng gói (Build tools):
1. **`build.bat` (hoặc `node tools/quick_build.js`):**
   - **Công dụng:** Đóng gói siêu tốc **0.05 giây**, KHÔNG CẦN MẠNG INTERNET.
   - Tự động gom toàn bộ code mới trong `js/` + cấu hình `firebase-config.js` vào `app.min.js`, tính lại mã hash và cập nhật vào `index.html`.
   - **Khuyên dùng:** Chạy file này mỗi khi bạn code xong một tính năng và muốn cập nhật sang `index.html`.
2. **`node tools/build.js`:**
   - **Công dụng:** Bản build chính thức có nén Terser và làm rối mã (Obfuscator).
   - **Lưu ý:** Cần mạng Internet để npx tải thư viện và mất 15-30 giây. Chỉ dùng khi chuẩn bị phát hành lên web công cộng.

---

## 3. BẢN ĐỒ CẤU TRÚC THƯ MỤC MÃ NGUỒN (`js/`)

```
js/
├── boot.js               # Kiểm tra trình duyệt, màn hình tải ban đầu
├── game.js               # Vòng lặp chính (Game Loop: update, render, delta-time)
├── main.js               # Điểm khởi động game (Bootstrap, luồng chuyển đổi màn hình G.Flow)
│
├── core/                 # CÁC HỆ THỐNG CỐT LÕI
│   ├── util.js           # Toán học, random, chuỗi, khởi tạo window.G
│   ├── firebase-config.js# CẤU HÌNH FIREBASE (Dự án: pokesurviovr) [BỊ GITIGNORE]
│   ├── db.js             # Quản lý lưu save game (LocalStorage + Cloud Firestore)
│   ├── audio.js          # Web Audio API: Quản lý BGM nhạc nền và SFX hiệu ứng âm thanh
│   ├── input.js          # Bắt phím bàn phím PC (WASD, chiêu thức, phím tắt)
│   ├── touch.js          # Bắt chạm cảm ứng trên màn hình điện thoại / tablet
│   ├── gamepad.js        # Hỗ trợ tay cầm chơi game (Xbox, PS, v.v.)
│   ├── camera.js         # Camera di chuyển theo Player, hiệu ứng rung lắc (screenshake)
│   ├── sprites.js        # Tải, cắt và vẽ Sprite Pokémon, hoạt ảnh di chuyển
│   ├── skins.js          # Trang phục nhân vật, dạng Shiny vàng óng
│   ├── updater.js        # Tự động thăm dò version.json mỗi 5p để báo cập nhật game
│   └── locales.js / i18n.js # Quản lý đa ngôn ngữ (Tiếng Anh, Tây Ban Nha, Pháp, v.v.)
│
├── entities/             # THỰC THỂ TRONG TRẬN ĐẤU
│   ├── player.js         # Đối tượng Người chơi: HP, Tốc độ, Nhặt EXP, gainXp, Level Up
│   ├── enemy.js          # Địch / Quái: AI đuổi theo người chơi, Máu, Kháng cự, Boss
│   ├── projectile.js     # Đạn / Tia chiêu thức: Đường đạn, tầm đánh, thời gian tồn tại
│   ├── pickup.js         # Vật phẩm rơi trên đất: Ngọc EXP, Tiền vàng, Rương báu, Pokéball
│   ├── fx.js             # Hiệu ứng nổ, tia chớp, vòng sáng
│   └── vfx.js            # Số sát thương nảy lên (Damage numbers), hiệu ứng chữ
│
├── systems/              # HỆ THỐNG LOGIC CHIẾN ĐẤU & CƠ CHẾ GAME
│   ├── combat.js         # Logic chiến đấu: 4 chiêu (Moves), Cooldown, Đổi chiêu nhanh, Auto-swap
│   ├── spawner.js        # Sinh quái theo thời gian: Quản lý đợt quái (Waves), Giới hạn quái (CAP = 128)
│   ├── levelup.js        # Giao diện & thuật toán rút thẻ chọn chiêu khi lên cấp, Tiến hóa chiêu
│   ├── stats.js          # Tính toán chỉ số: Công, Thủ, Tốc, Chí mạng, Hồi phục, Diện tích
│   ├── mons.js           # Đồng đội Pokémon, Base Stats, Tiến hóa cấp loài (vd: Charmander -> Charizard)
│   ├── judgment.js       # Trận chiến Phán Quyết với Arceus (Phút 30 ở Standard, Phút 15 ở Hurry)
│   ├── rift.js           # Khe nứt không gian (Rift Mini-boss, nhặt mảnh ngọc)
│   ├── events.js         # Sự kiện ngẫu nhiên xuất hiện giữa trận (Đàn quái đột biến, quà tặng)
│   ├── weather.js        # Thời tiết ngẫu nhiên: Mưa, Nắng gắt, Bão cát (ảnh hưởng sát thương hệ)
│   ├── hazards.js        # Cạm bẫy trên bản đồ: Vũng độc, dung nham, bẫy gai
│   ├── orbs.js           # Ngọc hỗ trợ tạm thời (Tăng tốc, Khiên, Đóng băng toàn màn hình)
│   ├── gacha.js          # Hệ thống quay gacha mở khóa Pokémon mới và Shinies
│   └── interact.js       # Tương tác với NPC Kecleon, Mở rương trong trận
│
├── data/                 # DỮ LIỆU TĨNH CỦA GAME (DATABASE)
│   ├── pokedex.js        # Danh sách 966 loài Pokémon, chỉ số cơ bản, hệ nguyên tố
│   ├── moves.js          # Danh mục tất cả chiêu thức: Sát thương, thời gian hồi, loại đạn
│   ├── enemies.js        # Dữ liệu quái vật theo từng vùng bản đồ (Biome)
│   ├── items.js          # Danh sách trang bị bị động (Held Items)
│   ├── shop.js           # Cửa hàng Kecleon (Mua đĩa TM, Mints, Kẹo nâng cấp)
│   ├── upgrades.js       # Bảng ngọc vĩnh viễn (Talent Tree ngoài Menu)
│   ├── starters.js       # Danh sách Pokémon khởi đầu cho người mới
│   ├── types.js          # Bảng tương khắc 18 hệ (Nước khắc Lửa, Lửa khắc Cỏ...)
│   ├── natures.js        # 25 Bản tính Pokémon (Adamant tăng Công giảm Công phép...)
│   └── abilities.js      # Đặc tính Pokémon (Overgrow, Blaze, Torrent, Intimidate...)
│
├── net/                  # MULTIPLAYER CO-OP & MẠNG
│   ├── social.js         # Danh sách bạn bè, Tạo phòng, Tham gia bằng Nickname (`joinByName`)
│   ├── net.js            # Quản lý kết nối WebRTC DataChannel (P2P), gửi/nhận gói tin
│   ├── coop.js           # Logic Co-op: Đồng bộ tọa độ đồng đội, Cân bằng quái/HP theo số người chơi
│   ├── codec.js          # Nén dữ liệu game sang nhị phân cực nhẹ để truyền qua mạng mượt mà
│   └── ranking.js        # Bảng xếp hạng online Firebase, chứng thực kỷ lục
│
├── ui/                   # GIAO DIỆN NGƯỜI DÙNG (DOM UI)
│   ├── menu.js           # Menu chính ngoài sảnh
│   ├── hud.js            # Thanh máu, đồng hồ trận đấu, bảng chiêu thức trong trận
│   ├── login.js          # Màn hình đăng nhập tài khoản / Khách (Guest)
│   ├── social-ui.js      # Giao diện Phòng chờ (Lobby), Bạn bè, Ô nhập Nickname Host
│   ├── run-ui.js         # Màn hình kết thúc trận (Thắng/Thua, Thống kê sát thương)
│   ├── shop-ui.js        # Giao diện Cửa hàng Kecleon
│   ├── gacha-ui.js       # Giao diện Bàn quay Gacha
│   └── settings-ui.js    # Cài đặt âm thanh, đồ họa, đổi phím
│
└── world/                # BẢN ĐỒ & THẾ GIỚI
    ├── tiles.js          # Định nghĩa Tilemap địa hình (Cỏ, Nước, Đá, Tuyết)
    └── world.js          # Sinh bản đồ vô tận, phân chia các vùng đất (Biomes)
```

---

## 4. CHI TIẾT CÁC CHẾ ĐỘ CHƠI

### 4.1. Chế độ Tiêu chuẩn (Estándar - 30:00)
- Trận đấu sinh tồn chuẩn kéo dài 30 phút.
- Quái tăng máu và sát thương tuyến tính theo thời gian thực.
- Đúng phút **30:00**, trùm cuối Arceus giáng thế kích hoạt sự kiện Phán Quyết (Judgment).

### 4.2. Chế độ Nhanh (Hurry - 15:00)
- Nhịp độ trận đấu được nén gấp đôi: **15 phút**.
- Mốc Arceus xuất hiện ở phút **15:00**.
- **Cơ chế nâng cấp Hurry đặc biệt:** Mỗi lần lên cấp, thẻ chiêu thức/chỉ số được **gộp x2 cấp** để người chơi vừa tiết kiệm thời gian chọn thẻ, vừa bắt kịp sức mạnh để chiến đấu với quái vật được đẩy nhanh tiến độ.

---

## 5. CƠ CHẾ MULTIPLAYER CO-OP (TỐI ĐA 4 NGƯỜI)

1. **Mô hình kết nối:**
   - **Host-Authoritative P2P:** Chủ phòng (Host) tính toán logic quái, đạn, va chạm và truyền snapshot trạng thái cho các Guest với tần số ~15 gói/giây.
   - **Tín hiệu (Signaling):** Dùng Cloud Firestore để Host và Guest trao đổi ICE Candidates và SDP Offer/Answer.
   - **Dữ liệu trong trận:** Chạy thẳng qua kết nối trực tiếp WebRTC DataChannel (không tốn băng thông máy chủ).
2. **Cân bằng quái & Kinh nghiệm trong Co-op:**
   - Quản lý tại [js/net/coop.js](file:///d:/VS%20Studio/pokesurvivor/js/net/coop.js):
   - Máu quái (`scaleHp`): Tăng theo số người trong phòng `1 + 0.5 * (n - 1)`.
   - Mật độ xuất hiện (`scaleRate`): Tăng để đảm bảo đủ quái cho cả phòng nhặt EXP.
   - Chia sẻ ngọc EXP: Đồng đội đứng gần nhau được cộng hưởng EXP.

---

## 6. CÁC LƯU Ý KỸ THUẬT QUAN TRỌNG CHO DEVELOPER (MUST READ)

> [!IMPORTANT]
> **Bảo mật Firebase (`firebase-config.js`):**
> File [js/core/firebase-config.js](file:///d:/VS%20Studio/pokesurvivor/js/core/firebase-config.js) nằm trong danh sách `.gitignore`. **TUYỆT ĐỐI KHÔNG** bỏ gitignore hoặc push file này có chứa key lên các kho công khai. Khi clone code về máy mới, chỉ cần tạo file này và dán cấu hình Firebase của dự án.

> [!WARNING]
> **Không sửa trực tiếp `index.html`:**
> `index.html` là file sinh tự động. Nếu bạn sửa tay vào `index.html`, lần sau khi ai đó chạy lệnh build, những gì bạn sửa ở `index.html` sẽ bị ghi đè hoàn toàn. Hãy luôn sửa thẻ HTML ở [dev.html](file:///d:/VS%20Studio/pokesurvivor/dev.html).

> [!TIP]
> **Bộ kiểm thử tự động (Unit Tests):**
> Trong thư mục `tests/` có sẵn các bài test bảo đảm tính toàn vẹn logic:
> - `node tests/hurry.test.cjs`: Kiểm tra thuật toán gộp thẻ, EXP, và đường cong quái của chế độ Hurry (12 tests).
> - `node tests/net.test.cjs`: Kiểm tra codec nén gói tin, WebRTC, và an toàn dữ liệu mạng (29 tests).
> - `node tests/build.test.cjs`: Kiểm tra hash và tính đồng bộ giữa `dev.html` và `index.html`.
> Trước khi tạo pull request hoặc bàn giao bản mới, hãy chạy các lệnh test trên để bảo đảm không xảy ra lỗi hồi quy (regression).

