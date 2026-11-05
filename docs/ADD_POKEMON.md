# HƯỚNG DẪN THÊM POKÉMON VÀO GAME (ADD POKÉMON GUIDE)

> **Tài liệu hướng dẫn chi tiết cách tải, cấu hình, vẽ sprite và tích hợp Pokémon mới (từ Gen 1 đến Gen 9 hoặc Pokémon tùy chỉnh / fan-made) vào PokéSurvivor.**

---

## 1. TỔNG QUAN KIẾN TRÚC POKÉMON

Trong PokéSurvivor, một Pokémon hoàn chỉnh được tạo thành từ **5 thành phần dữ liệu**:

```
                              POKÉMON HOÀN CHỈNH
                                      │
     ┌───────────────────┬────────────┴────────────┬───────────────────┐
     ▼                   ▼                         ▼                   ▼
1. Hình ảnh         2. Hình học             3. Chỉ số           4. Kỹ năng & Kèm theo
assets/pokemon/     js/data/sprites-meta.js  js/data/pokedex.js  - js/data/abilities.js (Đặc tính)
  - Idle.png          - Kích thước frame       - HP, SPD, ATK    - js/data/starters.js (Chiêu đầu)
  - Walk.png          - Số khung hình          - Hệ (Types)      - js/data/moves.js (Danh sách đòn)
  - Attack.png...     - Tọa độ chân neo        - Độ hiếm (Sao)
```

---

## 2. QUY CHUẨN SPRITE (SPRITESHEET FORMAT)

Game sử dụng phong cách pixel art **Pokémon Mystery Dungeon (PMD)** từ dự án cộng đồng mã nguồn mở **[PMDCollab / SpriteCollab](https://github.com/PMDCollab/SpriteCollab)**.

### 2.1. Cấu trúc thư mục của một Pokémon: `assets/pokemon/{dex}/`
Trong đó `{dex}` là số thứ tự Pokédex (ví dụ `25` là Pikachu, `1008` là Miraidon):

```text
assets/pokemon/{dex}/
├── Idle.png        (BẮT BUỘC - Đứng yên / thở)
├── Walk.png        (BẮT BUỘC - Di chuyển / bước đi)
├── Attack.png      (BẮT BUỘC - Tấn công cận chiến)
├── Shoot.png       (Tùy chọn - Bắn chiêu thức tầm xa)
├── Charge.png      (Tùy chọn - Gồng / tụ năng lượng)
├── Hurt.png        (Tùy chọn - Bị dính đòn)
├── Faint.png       (Tùy chọn - Bị hạ gục / ngất xỉu)
└── s/              (Thư mục con chứa các file trên cho dạng SHINY màu hiếm)
```

### 2.2. Quy tắc vẽ / xếp ảnh trong Spritesheet:
Mỗi file `.png` là một tấm hình ghép (Spritesheet) gồm:
- **8 hàng (Rows)** đại diện cho **8 hướng nhìn**:
  - `Hàng 0`: Nhìn xuống (Down)
  - `Hàng 1`: Chéo dưới phải (DownRight)
  - `Hàng 2`: Nhìn sang phải (Right)
  - `Hàng 3`: Chéo trên phải (UpRight)
  - `Hàng 4`: Nhìn lên (Up)
  - `Hàng 5`: Chéo trên trái (UpLeft)
  - `Hàng 6`: Nhìn sang trái (Left)
  - `Hàng 7`: Chéo dưới trái (DownLeft)
- **N cột (Columns)**: Các khung hình chuyển động liên tiếp (ví dụ 4 frame, 6 frame, 10 frame...).

---

## 3. CÁCH 1: THÊM TỰ ĐỘNG BẰNG TOOL (KHUYÊN DÙNG CHO GEN 1 - GEN 9)

Project đã có sẵn script Python để tự động kéo ảnh từ GitHub SpriteCollab, đo bóng chân để căn chỉnh toạ độ neo đất và cập nhật metadata.

### Bước 1: Chuẩn bị môi trường Python
Cần cài đặt thư viện xử lý ảnh `Pillow` (chỉ cần làm 1 lần):
```powershell
pip install pillow
```

### Bước 2: Chạy lệnh tải Sprite Pokémon
Cú pháp:
```powershell
python tools/fetch_sprites.py <dex_bắt_đầu> <dex_kết_thúc>
```
*Ví dụ: Muốn thêm Miraidon (Dex #1008):*
```powershell
python tools/fetch_sprites.py 1008 1008
```

> [!NOTE]
> Tool đã được tối ưu để tự động tìm kiếm sâu vào các **dạng phụ (subgroups)** nếu dạng gốc chưa có ảnh (ví dụ Miraidon dạng chiến đấu `0000` chưa có overworld sprite, tool sẽ tự lấy dạng di chuyển `0001 - Low_Power`).
> Đồng thời tool sẽ **tự động gộp (merge)** vào cùng danh sách 966 Pokémon hiện có trong `js/data/sprites-meta.js` mà không bị mất dữ liệu cũ.

---

### Bước 3: Khai báo chỉ số chiến đấu trong `js/data/pokedex.js`
Mở [js/data/pokedex.js](file:///d:/VS%20Studio/pokesurvivor/js/data/pokedex.js), kéo xuống cuối mảng `G.DEX` và thêm thông tin Pokémon:

```javascript
  {"dex":1008,"name":"Miraidon","types":["electric","dragon"],"hp":115,"spd":135,"atk":1.44,"pa":1.17,"sa":1.44,"df":100,"sd":115,"rarity":5,"bst":670,"starter":true,"gen":9,"leg":true},
```

**Giải thích các trường:**
- `dex`: Số Pokédex (số nguyên).
- `name`: Tên hiển thị của Pokémon.
- `types`: Danh sách hệ (tối đa 2 hệ). Xem danh sách hệ ở mục 5.
- `hp`: Máu cơ bản trong game (thường từ 80 - 150).
- `spd`: Tốc độ di chuyển (thường từ 90 - 135).
- `atk`: Hệ số sát thương tổng hợp (`Math.max(pa, sa)`).
- `pa`: Sát thương đòn vật lý (Physical Attack).
- `sa`: Sát thương đòn phép (Special Attack).
- `df`: Chỉ số phòng thủ vật lý (Defense) gốc.
- `sd`: Chỉ số phòng thủ phép (Special Defense) gốc.
- `rarity`: Độ hiếm khi quay Gacha (1: 1 sao -> 5: 5 sao).
- `bst`: Tổng chỉ số gốc (Base Stat Total).
- `starter`: `true` nếu muốn người chơi có thể chọn ngay từ đầu; `false` nếu phải quay Gacha mới có.
- `gen`: Thế hệ (Gen 1 đến Gen 9).
- `leg`: `true` nếu là Pokémon Huyền Thoại (sẽ xuất hiện làm Boss trong Vết Nứt / Rift).

---

### Bước 4: Khai báo Đặc tính (Ability) trong `js/data/abilities.js`
Mở [js/data/abilities.js](file:///d:/VS%20Studio/pokesurvivor/js/data/abilities.js), tìm đối tượng `G.DEX_ABIL` (khoảng dòng 1235) và thêm dòng:

```javascript
  1008:["electric-surge",0,0],
```
*(Cấu trúc mảng 3 phần tử: `[habilidad_1, habilidad_2_hoặc_0, habilidad_oculta_hoặc_0]`)*.

---

### Bước 5: Khai báo Chiêu khởi đầu trong `js/data/starters.js`
Mở [js/data/starters.js](file:///d:/VS%20Studio/pokesurvivor/js/data/starters.js), thêm vào danh sách `G.STARTERS`:

```javascript
  { dex: 1008, start: 'thunder-shock', traits: ['valiente', 'astuto'] }
```
> [!IMPORTANT]
> Giá trị `start` bắt buộc phải là một ID chiêu thức hợp lệ có trong `js/data/moves.js` (ví dụ: `'thunder-shock'` có dấu gạch nối, không được viết liền `'thundershock'`). Nếu gõ sai, game sẽ bị lỗi trắng màn hình Detail khi xem Pokémon.

---

### Bước 6: Đóng gói lại game (Build)
Chạy lệnh sau trong Terminal (hoặc click đúp file `build.bat`):
```powershell
node tools/quick_build.js
```
Vào trình duyệt web và nhấn **`Ctrl + F5`** để nạp lại game và thưởng thức Pokémon mới!

---

## 4. CÁCH 2: THÊM POKÉMON THỦ CÔNG (CUSTOM / FAN-MADE)

Dành cho trường hợp bạn tự vẽ pixel art hoặc tải một Pokémon fan-made không có trên SpriteCollab:

### 1. Chuẩn bị ảnh
Tạo thư mục `assets/pokemon/{id}/` (ví dụ: `assets/pokemon/9999/`). Đặt vào tối thiểu 3 file ảnh dạng PNG 8 hướng:
- `Idle.png`
- `Walk.png`
- `Attack.png`

### 2. Khai báo Metadata hình học trong `js/data/sprites-meta.js`
Mở [js/data/sprites-meta.js](file:///d:/VS%20Studio/pokesurvivor/js/data/sprites-meta.js), thêm vào đối tượng `G.SPRITE_META`:

```javascript
  9999: {
    "s": 1, // Kích thước bóng chân (0: nhỏ, 1: vừa, 2: to)
    "a": {
      "Idle":   { "w": 40, "h": 40, "n": 6, "r": 8, "d": [40, 2, 3, 3, 3, 2], "ax": 20, "ay": 24 },
      "Walk":   { "w": 40, "h": 40, "n": 4, "r": 8, "d": [8, 10, 8, 10], "ax": 20, "ay": 24 },
      "Attack": { "w": 48, "h": 48, "n": 8, "r": 8, "d": [2, 4, 1, 1, 2, 2, 2, 4], "ax": 24, "ay": 28 }
    },
    "sh": 0 // 1 nếu có thư mục s/ (shiny), 0 nếu không
  },
```

**Ý nghĩa các trường trong animation:**
- `w`, `h`: Chiều rộng và chiều cao của 1 frame hình đơn lẻ (pixel).
- `n`: Số frame (cột).
- `r`: Số hướng nhìn (mặc định là `8`).
- `d`: Thời gian hiển thị từng frame (đơn vị tick 1/60s).
- `ax`, `ay`: **Tọa độ điểm neo chân** chạm đất tính từ góc trên-trái của frame. Điểm này giúp Pokémon khi chuyển từ đứng (`Idle`) sang bước đi (`Walk`) hay đánh (`Attack`) không bị giật nảy vị trí.

### 3. Thực hiện tiếp các bước 3, 4, 5, 6 của Cách 1
Khai báo chỉ số trong `pokedex.js`, kỹ năng trong `abilities.js`, chiêu đầu trong `starters.js` và chạy `quick_build.js`.

---

## 5. BẢNG DANH MỤC HỆ & CHIÊU THỨC KHỞI ĐẦU CHUẨN

### 5.1. Danh mục 18 Hệ nguyên tố (`types`):
```text
normal, fire, water, grass, electric, ice, fighting, poison, ground,
flying, psychic, bug, rock, ghost, dragon, steel, dark, fairy
```

### 5.2. Danh sách ID Chiêu thức khởi đầu chuẩn (`start`):
| Hệ | ID Chiêu thức chuẩn | Tên chiêu thức |
| :--- | :--- | :--- |
| **Electric** | `'thunder-shock'` | Impactrueno (Sấm sét cơ bản) |
| **Fire** | `'ember'` | Ascuas (Tia lửa) |
| **Water** | `'water-gun'` | Pistola Agua (Súng nước) |
| **Water** | `'bubble'` | Burbuja (Bong bóng) |
| **Grass** | `'vine-whip'` | Látigo Cepa (Roi mây) |
| **Grass** | `'razor-leaf'` | Hoja Afilada (Lá sắc bén) |
| **Psychic** | `'confusion'` | Confusión (Hỗn loạn) |
| **Ice** | `'powder-snow'` | Nieve Polvo (Bột tuyết) |
| **Dragon** | `'dragon-breath'` | Dragoaliento (Hơi thở rồng) |
| **Ghost** | `'shadow-ball'` | Bola Sombra (Quả cầu bóng tối) |
| **Dark** | `'bite'` | Mordisco (Cắn) |
| **Normal** | `'tackle'` | Placaje (Húc / Tấn công) |

---

## 6. CÔNG THỨC QUY ĐỔI CHỈ SỐ TỪ POKÉMON GỐC (POKÉAPI)

Nếu bạn lấy chỉ số gốc từ Bulbapedia hoặc PokéAPI, công thức chuẩn của game là:

$$\text{hp} = \text{round}(70 + \text{Base\_HP} \times 0.45)$$
$$\text{spd} = \text{round}(78 + \text{Base\_Speed} \times 0.42)$$
$$\text{pa} = \text{round}\left(0.70 + \frac{\text{Base\_Attack}}{100} \times 0.55, 2\right)$$
$$\text{sa} = \text{round}\left(0.70 + \frac{\text{Base\_SpAtk}}{100} \times 0.55, 2\right)$$
$$\text{atk} = \max(\text{pa}, \text{sa})$$

---

## 7. CÁC LỖI THƯỜNG GẶP & CÁCH KHẮC PHỤC (TROUBLESHOOTING)

### 🔴 Lỗi 1: `ModuleNotFoundError: No module named 'PIL'`
- **Nguyên nhân:** Python thiếu thư viện hình ảnh `Pillow`.
- **Khắc phục:** Chạy lệnh: `pip install pillow`.

### 🔴 Lỗi 2: `0 Pokemon con sprites en...` khi chạy tool tải
- **Nguyên nhân:** Pokémon đó có nhiều form, form gốc `0000` rỗng mà ảnh nằm ở form phụ `0001` (như trường hợp Miraidon 1008 dạng Low-Power).
- **Khắc phục:** File `tools/fetch_sprites.py` đã được cập nhật tính năng tự dò `subgroups`, script sẽ tự tải đúng form.

### 🔴 Lỗi 3: `Cannot read properties of undefined (reading 'name') at showDetail`
- **Nguyên nhân:** Gõ sai ID chiêu thức khởi đầu trong `js/data/starters.js` (ví dụ viết `thundershock` thay vì `thunder-shock`).
- **Khắc phục:** Kiểm tra lại bảng ID chiêu thức ở **Mục 5.2**, đảm bảo ID trùng khớp 100% với file `js/data/moves.js`.

### 🔴 Lỗi 4: Pokémon bị nhảy/giật vị trí khi đổi đòn đánh
- **Nguyên nhân:** Điểm neo chân `ax, ay` giữa các file hoạt ảnh (`Idle`, `Walk`, `Attack`) bị lệch nhau.
- **Khắc phục:** Mở `js/data/sprites-meta.js`, điều chỉnh lại tọa độ `ax` (khoảng cách từ mép trái đến giữa chân) và `ay` (khoảng cách từ mép trên đến gót chân).

### 🔴 Lỗi 5: Đã build nhưng trình duyệt vẫn không hiện Pokémon mới
- **Nguyên nhân:** Trình duyệt lưu cache file cũ.
- **Khắc phục:** Nhấn tổ hợp phím **`Ctrl + F5`** (hoặc `Ctrl + Shift + R`) để ép trình duyệt tải lại file bundle mới.



---

## 8. HƯỚNG DẪN THÊM CHIÊU THỨC ĐỘC QUYỀN (SIGNATURE MOVES) TỪ POKEAPI

Nếu Pokémon có chiêu thức độc quyền (ví dụ Miraidon với *Electro Drift*, Mewtwo với *Psystrike*, Arceus với *Judgment*...):

### Bước 1: Lấy thông tin đòn đánh từ PokeAPI
Chạy script lấy dữ liệu đòn đánh:
```powershell
python tools/fetch_signature_moves.py <tên-chiêu-pokeapi>
# Ví dụ:
python tools/fetch_signature_moves.py electro-drift collision-course
```
Script sẽ lưu thông tin tên tiếng Anh/Tây Ban Nha, loại đòn (physical/special), sát thương và mô tả vào `tools/signature_moves.json`.

### Bước 2: Khai báo chiêu thức trong `js/data/moves.js`
Thêm chiêu thức vào mảng `RAW` trong [js/data/moves.js](file:///d:/VS%20Studio/pokesurvivor/js/data/moves.js):
```javascript
{ id: 'electro-drift', name: 'Electroderrape', type: 'electric', kind: 'dash', sig: 1008,
  desc: 'Embiste a velocidad futurista perforando a todos los enemigos con electricidad.',
  cd: 0.72, dmg: 24, radius: 135, width: 42, knock: 50 },
```
> [!TIP]
> Thuộc tính `sig: <dex>` (ví dụ `sig: 1008`) đánh dấu đây là chiêu độc quyền. Chiêu thức này sẽ **không** rơi ngẫu nhiên cho các Pokémon cùng hệ khác, mà chỉ mở khóa riêng cho chính Pokémon đó!

Đồng thời:
- Nếu là đòn vật lý, thêm id vào `PHYSICAL`.
- Khai báo điều kiện nâng cấp tiến hóa `+` trong `EVO` (ví dụ `'electro-drift': 'spd'`).
- Khai báo hiệu ứng hạt trong `js/entities/vfx.js`.
- Thêm tên và mô tả tiếng Anh trong `js/data/lang-en.js`.

Sau đó chạy `node tools/quick_build.js` để hoàn tất!
