# Kế hoạch nâng cấp Boss và Grieta trong PokeSurvivor

## Mục tiêu

Biến trận đánh boss thành chuỗi có nhịp độ rõ ràng: người chơi xây dựng sức mạnh, đối đầu một sự kiện cốt truyện ở phút 10, rồi bước vào trận cuối với Arceus ở phút 15. Các boss có chuyển phase, tổ đội phối hợp và đợt né đòn có cảnh báo; sát thương của người chơi vẫn có ý nghĩa nhưng không che kín màn hình.

## Hiện trạng liên quan

- Boss thường đã có AI, enrage ở 50% HP, đòn đánh có vùng cảnh báo và cơ chế bắn đạn trong `js/entities/enemy.js`.
- Grieta trong `js/systems/rift.js` hiện mở ngẫu nhiên sau phút 1:15, giới hạn thời gian vào 45 giây, đưa người chơi vào arena 120 giây và chọn một Pokémon huyền thoại.
- Arceus hiện được khởi động bởi `js/systems/judgment.js` ở phút 30; chế độ Hurry tăng tốc thời gian trận và có mốc gốc 15 phút. Giữ nguyên cơ chế Judgment, cinematic và luật chiến đấu hiện tại của Arceus.
- Coop đồng bộ các sự kiện qua host trong `js/systems/rift.js`, `js/entities/enemy.js` và `js/net/coop.js`.
- Vòng cập nhật trận nằm trong `js/game.js`; hệ đạn người chơi nằm ở `js/systems/combat.js` và `js/entities/projectile.js` (cần xác nhận tên/vị trí hệ projectile trước khi triển khai).

## Phạm vi thiết kế

### 1. Lịch trình trận

1. **00:00–10:00:** farm quái và xây dựng nhân vật theo nhịp hiện có.
2. **10:00:** mở một Grieta cốt truyện được đảm bảo, không phụ thuộc xác suất Grieta thường. Đưa cả nhóm vào encounter đặc biệt.
3. **10:00–15:00 (thời gian encounter):** chiến đấu với bộ đôi/bộ ba theo kịch bản, có các đợt Evade Phase. Đồng hồ trận bên ngoài tạm dừng từ lúc vào encounter cho tới khi thoát về bản đồ.
4. **Sau encounter:** tiếp tục đồng hồ trận bên ngoài từ đúng thời điểm đã dừng. Arceus vẫn khởi động theo mốc của chế độ qua Judgment hiện tại; thời gian đánh boss cốt truyện không làm tiến gần mốc này.

Grieta ngẫu nhiên thông thường cần được điều chỉnh để không tranh lịch hoặc đưa người chơi vào arena khi sự kiện cốt truyện đang chạy. Đồng hồ trận bên ngoài (gồm thời gian dùng để kích hoạt Arceus) phải đóng băng trong encounter và tiếp tục sau khi trở về. Thời lượng 10:00–15:00 là thời gian encounter riêng, không phải thời gian trận bên ngoài. Giữ mốc Judgment gốc theo chế độ, không đổi luật Arceus.

### 2. Boss hai phase

- Phase 1 giữ nhịp AI và bộ chiêu hiện có; bổ sung dữ liệu phase thay vì viết AI riêng cho từng Pokémon.
- Boss có **hai thanh HP riêng biệt**, mỗi thanh đại diện cho một phase. Khi thanh phase 1 cạn, boss chuyển trạng thái một lần, bật bất tử 1–2 giây trong lúc biến hình, rồi khởi tạo thanh HP phase 2 đầy đủ. Sát thương dư từ đòn kết liễu phase 1 không tràn sang thanh phase 2.
- Phase 2 tăng tốc di chuyển và mật độ/biến thể đòn đánh trong giới hạn cấu hình; telegraph vẫn đủ thời gian để phản ứng. HUD thể hiện thanh hiện tại và tiến độ phase rõ ràng.
- Dùng lớp skin/animation sẵn có khi có; nếu không có dạng Mega/Primal tương ứng thì dùng hiệu ứng biến hình chung, không phụ thuộc sprite mới.
- Áp dụng trước cho boss của encounter phút 10; boss thường chỉ nhận thay đổi khi cấu hình tương thích.

### 3. Encounter theo bộ Pokémon

- Tạo định nghĩa encounter dạng dữ liệu: mã encounter, danh sách dex, vai trò, thứ tự xuất hiện, chiêu đặc trưng, điều kiện thắng và phần thưởng.
- Bản đầu tiên: **Bộ ba Thời tiết**. Kyogre tạo áp lực/điều chỉnh nhịp đạn, Groudon tạo vùng nguy hiểm có cảnh báo, Rayquaza là chặng cuối với đòn diện rộng. Thiết kế để arena vẫn có đường né rõ ràng.
- Để các bộ **Thánh kiếm** và **Latios & Latias** làm encounter mở rộng sau khi framework đầu tiên ổn định.
- Nếu một thành viên bị hạ sớm, áp dụng enrage cho thành viên còn lại theo cấu hình; kiểm tra khả năng chơi coop và tránh buff khiến encounter mất cân bằng.
- Thưởng XP lớn và/hoặc chiêu thức độc quyền chỉ cấp một lần sau chiến thắng. Tái sử dụng hệ thống phần thưởng hiện có nếu đáp ứng; không tự thêm loại dữ liệu lưu mới nếu chưa cần.

### 4. Evade Phase

- Tạo trạng thái encounter gồm `warning`, `active`, `recovery` và thời lượng có thể cấu hình.
- Trước đòn lớn, phát tín hiệu hình ảnh/âm thanh và vùng nguy hiểm rõ ràng trong khoảng 0.75–1 giây; khi đòn kết thúc, kiểm tra người chơi còn sống để trao thưởng né.
- Trong đợt né, khóa hoặc giảm mạnh sát thương gây ra bởi người chơi trong 3–6 giây; tiếp tục cho phép di chuyển và né. Tránh khóa toàn bộ đầu vào.
- Sau khi né thành công, chọn một phần thưởng dễ hiểu: boss bị choáng 1–2 giây **hoặc** người chơi được +100% sát thương trong 3 giây. Đặt thành cấu hình encounter để cân bằng sau.
- Bắt đầu với pattern Groudon (vùng nổ tuần tự) vì phù hợp hệ hazard hiện tại; thêm sóng bốn hướng của Kyogre và tia chéo của Rayquaza sau.

### 5. Giới hạn hỏa lực người chơi trong encounter

- Không xóa chiêu, thay build, hay thay đổi trạng thái lưu của người chơi. Khi encounter hoạt động, áp dụng một bộ lọc tấn công tạm thời.
- Tính tổng DPS mục tiêu từ các nguồn sát thương đang hoạt động, chuyển thành luồng đạn đơn mục tiêu có khóa mục tiêu; giới hạn tốc độ bắn và tổng số đạn tồn tại.
- Tạm ngưng AOE/đạn phụ trong encounter và khôi phục đầy đủ khi thoát. Giữ hiệu quả nâng cấp bằng cách quy đổi sức mạnh vào sát thương luồng đạn, có mức trần để tránh phá cân bằng.
- Thêm chuyển mục tiêu có thao tác đơn giản (phím/điều khiển chạm phù hợp với input hiện tại); ưu tiên boss đang thi triển chiêu hoặc theo thứ tự encounter.
- Cho phép đạn người chơi triệt tiêu đạn nhỏ của boss; không triệt tiêu hazard lớn đã cảnh báo.
- Đo/điều chỉnh cap dựa trên độ rõ hình ảnh và khả năng né, không đặt một con số cứng trước khi kiểm tra nhiều build.

## Thiết kế kỹ thuật dự kiến

- **`js/entities/enemy.js`:** mở rộng dữ liệu AI boss để hỗ trợ mốc phase, bất tử chuyển phase và bộ chiêu phase 2; giữ các chiêu cũ làm mặc định.
- **`js/systems/rift.js`:** bổ sung loại arena cốt truyện, bộ encounter nhiều boss và trạng thái hoàn tất/thất bại; giữ luồng Grieta đơn hiện tại cho nội dung ngẫu nhiên.
- **Hệ thống mới hoặc mở rộng gần Rift:** quản lý timeline encounter và Evade Phase bằng state machine/dữ liệu, không nhồi logic lịch sử vào vòng game chính.
- **`js/systems/combat.js` / hệ projectile:** áp dụng bộ lọc đạn theo ngữ cảnh encounter, tính DPS quy đổi, cap đạn và lock-on; xác nhận cấu trúc chính xác khi bắt đầu code.
- **`js/game.js`:** điều phối bắt đầu/kết thúc encounter và tạm dừng/tiếp tục đồng hồ trận bên ngoài; thời gian encounter không cộng vào lịch farm hoặc mốc Judgment.
- **`js/net/coop.js`:** host quyết định encounter, phase, mục tiêu và kết quả; gửi sự kiện gọn qua giao thức hiện tại để mọi máy hiển thị cùng trạng thái. Tránh mỗi client tự random pattern hoặc tự cấp thưởng.
- **UI/HUD và audio:** dùng thông báo, thanh máu boss, cảnh báo vùng nguy hiểm và âm thanh hiện có trước; bổ sung hiển thị chuyên biệt tối thiểu cho phase/đợt né.

## Các giai đoạn triển khai

1. **Chốt lịch và ranh giới tính năng:** xác định Standard/Hurry và cách xử lý người chơi đang ở Rift thường lúc encounter cốt truyện đến hạn. Đồng hồ trận bên ngoài phải được đóng băng trong encounter; mốc Arceus tiếp tục đếm sau khi encounter kết thúc.
2. **Nền tảng phase boss:** cấu hình phase 1/2, bất tử chuyển phase, hiệu ứng biến hình; áp dụng cho một boss thử nghiệm.
3. **State machine encounter:** chạy bộ ba theo thứ tự, có thắng/thua, thời gian giới hạn và phần thưởng một lần.
4. **Evade Phase đầu tiên:** warning, hazard theo chuỗi, thời gian né, kiểm tra sống sót và phần thưởng né.
5. **Duel stance:** lọc sát thương/đạn, quy đổi DPS, cap, lock-on và triệt tiêu đạn nhỏ; phục hồi cấu hình sau encounter.
6. **Lịch trình phút 10 → 15:** bảo đảm Grieta sự kiện, chặn xung đột với Grieta ngẫu nhiên, rồi nối sang Judgment gốc theo cấu hình chế độ đã thống nhất.
7. **Nội dung và cân bằng:** thêm pattern Kyogre/Rayquaza, sau đó cân nhắc Thánh kiếm và Latios/Latias; tinh chỉnh chỉ số và phần thưởng.

## Trạng thái triển khai đợt đầu

- Đã mở Grieta cốt truyện khi đồng hồ trận chạm 10:00; người chơi bước vào để bắt đầu sự kiện. Đồng hồ trận và mốc Judgment tạm dừng trong arena, rồi tiếp tục khi trở về.
- Đã thêm cinematic Canvas cho Bộ ba Thời tiết. Kyogre và Groudon xuất hiện cùng nhau; khi cả hai bị hạ, Rayquaza xuất hiện làm boss cuối encounter.
- Mỗi boss cốt truyện có hai thanh HP độc lập. Khi thanh đầu cạn, boss biến hình với 1,5 giây bất tử rồi bắt đầu thanh thứ hai đầy; phase sau nhanh hơn và dùng bộ đòn cuồng nộ.
- Đã thêm đợt né 4 giây với cảnh báo/hazard theo boss, tạm ngưng sát thương người chơi trong thời gian né, thưởng cho né thành công bằng stun 1,5 giây.
- Trong encounter, khóa mục tiêu vào boss đang chọn, giới hạn một viên ở các luồng projectile/nova thường và tốc độ kỹ năng tối đa khoảng 5,5 lần/giây. Nhấn `F` để đổi mục tiêu giữa các boss còn sống; đạn người chơi có thể triệt tiêu đạn nhỏ của boss.
- Kết thúc chiến thắng thưởng XP; trạng thái arena, phase, mục tiêu và đợt né được đồng bộ qua host trong coop.
- Thánh kiếm, Latios/Latias và các bộ encounter khác vẫn là nội dung mở rộng; Judgment/Arceus giữ nguyên mốc và cơ chế theo từng chế độ.

## Tiêu chí hoàn thành

- Encounter cốt truyện bắt đầu nhất quán ở mốc cấu hình và không bị Grieta ngẫu nhiên chen vào.
- Boss có hai thanh HP tách biệt; khi thanh đầu cạn chỉ chuyển phase một lần, thanh thứ hai bắt đầu đầy, và sát thương dư không thể bỏ qua phase 2. Bất tử chuyển phase không gây kẹt trạng thái.
- Tín hiệu nguy hiểm xuất hiện trước sát thương; né được có phản hồi/thưởng, bị trúng vẫn công bằng và có thể hiểu nguyên nhân.
- Nhiều boss, thứ tự mục tiêu, kết quả và phần thưởng đồng nhất trong coop; không nhân đôi phần thưởng khi nhận lại sự kiện mạng.
- Duel stance không làm mất nâng cấp hay trạng thái build sau khi rời encounter; lượng đạn và hiệu ứng vẫn dễ đọc.
- Encounter thắng/thua/timeout đều đưa người chơi về luồng trận hợp lệ; Judgment gốc vẫn giữ cinematic và cơ chế riêng.
- Không thêm dependency; không sửa nội dung ngoài phạm vi Boss/Rift/Combat/Judgment liên quan.

## Lưu ý cân bằng

- Standard giữ mốc Judgment 30:00; Hurry giữ mốc 15:00. Cả hai dùng đồng hồ trận bên ngoài, tạm dừng trong encounter cốt truyện và tiếp tục sau khi trở về.
- Rift thường vẫn có giới hạn 120 giây; encounter cốt truyện có timeout 300 giây riêng.
- Coop dùng host làm nguồn quyết định cho phase, mục tiêu, hazard và kết quả. Nếu thêm cơ chế revive hoặc người chơi vào trễ, cần duy trì đồng bộ arena và trạng thái đồng hồ.
- Duel stance quy đổi build bằng khóa sát thương vào mục tiêu, giới hạn một viên ở một số kiểu bắn và giới hạn nhịp tung chiêu; cần cân bằng thêm các chiêu đặc biệt theo dữ liệu chơi thực tế.

## Ngoài phạm vi đợt đầu

- Viết lại Judgment/Arceus hoặc thay đổi cinematic, luật đánh và phần thưởng hiện tại của trận cuối.
- Thêm asset Mega/Primal mới hoặc dependency bên thứ ba.
- Triển khai đồng thời mọi bộ boss: ưu tiên hoàn thiện framework và Bộ ba Thời tiết trước.

---

# Kế hoạch mở rộng: Boss đổi dạng và các bộ Rift

## Mục tiêu

Mở rộng hệ boss hiện tại theo hai hướng: Pokémon đổi dạng trong trận dựa trên HP, thời gian hoặc hành động; Rift cốt truyện có nhiều đội boss với cơ chế phối hợp riêng. Đây là kế hoạch cho nội dung trong tài liệu Thiên cung cấp, chưa phải thay đổi đã triển khai.

Toàn bộ nội dung này thuộc **chế độ chơi riêng**, không tự kích hoạt trong run sinh tồn và không thay đổi lối chơi hiện tại. Từ Home, người chơi bấm nút **Chọn màn chơi**, chọn thử thách boss/form rồi vào arena tương ứng. Giữ nguyên lịch phút 10, Rift hiện tại, đồng hồ run và mốc/luật Judgment/Arceus.

Tái sử dụng arena, hazard, projectile, cinematic, đồng bộ host và phase boss hiện có. Mỗi đợt chỉ đưa thêm một nhóm nội dung để có thể cân bằng và sửa co-op trước khi mở rộng tiếp.

## Luồng chế độ riêng và chọn màn

1. Thêm nút **Chọn màn chơi** trên Home; nút này mở màn hình chọn thử thách, không tự vào trận.
2. Chia danh sách màn thành các nhóm: **Boss đổi form**, **Duo**, **Trio**, và **Đội đông/đánh theo đợt**. Mỗi thẻ hiển thị tên, boss tham gia, cơ chế chính và điều kiện thắng.
3. Người chơi chọn một màn cụ thể rồi bấm Bắt đầu; game dựng arena và roster đúng cấu hình màn đó, không cần chờ mốc phút 10 hoặc đi tìm Rift trong run.
4. Thoát, thắng hoặc thua đều quay về màn chọn màn/Home. Không thay đổi đồng hồ, dữ liệu run sinh tồn, lịch Rift hiện hành hoặc tiến trình Arceus.
5. Mặc định đây là chế độ luyện tập độc lập, không cấp thưởng vào tiến trình sinh tồn. Nếu sau này cần phần thưởng riêng, lưu vào một nhánh tiến trình chế độ này.
6. Trong co-op, host chọn màn và gửi cấu hình encounter cho cả nhóm; không để mỗi client tự chọn roster.

## Hiện trạng và ràng buộc dữ liệu

- Dự án hiện có 973/1025 Pokémon với dữ liệu Pokédex, ability, metadata và sprite hoàn chỉnh.
- Mười Pokémon cần đổi form trong danh sách đều có dữ liệu/sprite cơ bản: Deoxys (#386), Rotom (#479), Darmanitan (#555), Meloetta (#648), Aegislash (#681), Zygarde (#718), Hoopa (#720), Wishiwashi (#746), Necrozma (#800) và Terapagos (#1024).
- Dạng phụ không tự có sprite chỉ vì Pokémon gốc đã có. Trước mỗi lượt triển khai cần kiểm tra subgroup/animation của form đó; nếu thiếu, dùng hiệu ứng biến hình chung hoặc đặt asset mới thành điều kiện riêng.
- Bộ Họa Tai chưa thể đưa vào game đầy đủ: Wo-Chien (#1001) và Chien-Pao (#1002) chưa có bộ sprite bắt buộc. Ting-Lu (#1003) và Chi-Yu (#1004) đã có. Cần bổ sung sprite cho hai Pokémon còn thiếu trước khi bật encounter này.
- Một số chi tiết trong ý tưởng chưa xác định đầy đủ điều kiện kích hoạt, ví dụ thời điểm Hoopa Unbound xuất hiện và cách nhặt hạt năng lượng của Terapagos. Chốt các quy tắc đó trong cấu hình trước khi code.

## Thiết kế chung

### Form và trạng thái boss

- Chuyển logic hardcode hiện tại thành cấu hình boss gồm form khởi đầu, điều kiện chuyển dạng, form tiếp theo, thay đổi chỉ số, bộ chiêu và hiệu ứng.
- Hỗ trợ ba loại trigger: ngưỡng HP (một lần hoặc nhiều mốc), bộ đếm thời gian luân phiên, và hành động/chiêu kích hoạt.
- Mỗi lần chuyển dạng là một trạng thái host quyết định, có ID/phase rõ ràng để không kích hoạt lặp hoặc lệch giữa các client.
- Cho phép chuyển động, hitbox, sát thương, giáp, nhắm mục tiêu và bộ chiêu thay đổi theo form; trả mọi thuộc tính về giá trị cấu hình khi đổi tiếp.
- Hiệu ứng báo trước, biến hình, vùng ảnh hưởng và đòn đánh là các lớp riêng. Không dùng thời gian cinematic ngắn thay cho thời lượng thật của chiêu.
- Boss không được bất tử ngoài khoảng biến hình được cấu hình. Trigger hồi máu phải chạy một lần và không tạo vòng lặp chuyển form.

### Đòn đặc biệt

- Mỗi chiêu có pha báo trước, chuỗi hành động, thời lượng, nhịp lặp và cửa sổ né riêng.
- Giữ một thông báo lớn ở đầu chiêu; mỗi đòn có thể hiện vùng ảnh hưởng ngắn trên mặt đất nhưng không phát lại banner ở từng nhịp.
- Vị trí đánh có thể cố định theo pattern, chọn ngẫu nhiên trong arena, nhắm theo vị trí người chơi tại thời điểm ra đòn, hoặc phối hợp các kiểu đó.
- Pattern phải để lại đường né, không chồng toàn bộ vùng sát thương lên một điểm và không làm co-op nhận hazard khác nhau.

## Nội dung đổi form

| Pokémon | Trigger và chuyển dạng | Cơ chế cần triển khai |
| --- | --- | --- |
| Zygarde (#718) | 10% → 50% khi HP dưới 50%; 50% → 100% khi HP dưới 10% | Dạng nhanh dùng đạn nhỏ; dạng 50% tạo vùng độc; dạng 100% hồi 50% HP tối đa một lần và quét laser toàn arena. Chốt rõ HP hồi không vượt quá max HP. |
| Darmanitan (#555) | Dạng thường → Zen khi HP dưới 50% | Đổi từ truy đuổi sang đứng yên; giảm 80% sát thương nhận; bắn tên lửa bám đuổi. Cần giới hạn số tên lửa đang tồn tại. |
| Wishiwashi (#746) | Solo → School khi HP dưới 80% | Biến hình/triệu hồi đàn, tăng quy mô hình ảnh và hitbox có giới hạn; bắn đạn nước lớn, chậm, sát thương cao. |
| Necrozma (#800) | → Ultra khi HP dưới 30% | Chuyển cảnh tối ngắn; thay đạn nảy bằng tia sáng thẳng, xuyên nhiều mục tiêu và để lại vệt dài có telegraph. |
| Aegislash (#681) | Lặp 10 giây Shield / 5 giây Blade | Shield tăng 90% giảm sát thương và phản đạn theo giới hạn; Blade mất giáp, lao chém cận chiến. Trạng thái reflect phải tránh vòng lặp phản xạ projectile. |
| Deoxys (#386) | Luân phiên mỗi 15 giây | Speed tạo vệt khóa đường; Defense dựng khiên có điểm yếu/cửa sổ; Attack dùng bullet-hell; Normal là trạng thái cân bằng. |
| Rotom (#479) | Đổi ngẫu nhiên giữa các appliance | Lò nướng: quạt lửa; Máy giặt: xoáy nước hút; Tủ lạnh: băng làm chậm; Máy cắt cỏ: lưỡi cưa ziczac. Mỗi appliance phải có màu/pattern nhận diện riêng. |
| Meloetta (#648) | Relic Song hoặc thời gian hồi chiêu | Aria bắn nốt nhạc nảy; Pirouette áp sát và ép né. Chốt cách AI đổi dạng và thời gian báo trước trước khi triển khai. |
| Hoopa (#720) | Confined → Unbound; điều kiện kích hoạt cần chốt | Vòng không gian có phản hồi projectile và giới hạn số vòng; Unbound gọi đòn rơi từ trên xuống với vùng báo trước rõ. |
| Terapagos (#1024) | Luân phiên khiên nguyên tố Lửa/Nước/Cỏ | Khiên giảm/khóa sát thương cho tới khi người chơi lấy đúng năng lượng khắc hệ. Cần UX chỉ rõ hệ hiện tại, mục tiêu năng lượng và cách xử lý co-op/nhặt trùng. |

## Bộ Rift theo đội hình

Các đội dưới đây là các màn trong chế độ riêng. Mỗi lần chơi chỉ chạy một encounter đã chọn; chúng không được gắn vào đồng hồ hay lịch Rift của run sinh tồn hiện tại. Danh sách có thể mở khóa/thay phiên trong màn chọn, không phải nhiều đội cùng xuất hiện trong một trận.

### Trio

- **Thời tiết (Kyogre, Groudon, Rayquaza):** nâng cấp encounter đang có với vùng nước làm chậm, dung nham gây sát thương theo thời gian; khi Kyogre/Groudon bị hạ, Rayquaza xuất hiện với cinematic và chiêu laser chéo kéo dài theo cấu hình.
- **Sáng Tạo (Dialga, Palkia, Giratina):** hiệu ứng làm chậm có thời hạn; đổi quỹ đạo projectile theo giới hạn; Giratina lướt/tàng hình với cửa sổ xuất hiện để người chơi phản công.
- **Đạo (Reshiram, Zekrom, Kyurem):** bão lửa và sét định vị; khi hai boss đầu bị hạ, Kyurem vào phase hợp thể được chọn từ trạng thái encounter rồi mở chuỗi bão tuyết.
- **Thần Hồ (Uxie, Mesprit, Azelf):** teleport ngắn với cooldown và điểm xuất hiện an toàn; đòn gây đảo điều khiển chỉ tối đa 3 giây và có chống nối hiệu ứng liên tục.
- **Mãnh Thú (Raikou, Entei, Suicune):** chạy cắt arena và để lại vệt điện/lửa/băng có thời hạn.
- **Chim huyền thoại (Articuno, Zapdos, Moltres):** cùng framework vệt nguyên tố và di chuyển cắt ngang; dùng bộ chiêu riêng theo từng hệ.

### Quartet và đội theo đợt

- **Thánh Kiếm (Cobalion, Terrakion, Virizion, Keldeo):** đứng ở các góc theo cấu hình; Sacred Sword Dance tạm khóa tấn công người chơi, tạo các lượt lướt chéo theo khe hở có thể nhận biết.
- **Tapu (Koko, Lele, Bulu, Fini):** mỗi boss đặt terrain tương ứng. Debuff có thời lượng/miễn nhiễm ngắn; không khóa hoàn toàn điều khiển trong thời gian dài.
- **Họa Tai (Wo-Chien, Chien-Pao, Ting-Lu, Chi-Yu):** aura giảm sát thương/tốc độ chỉ áp dụng khi đủ đội hình; khi hạ một boss, cập nhật aura ngay. Chặn cấu hình encounter cho tới khi đủ sprite.
- **Gia tộc Regi:** Regirock, Regice, Registeel, Regieleki và Regidrago xuất hiện theo đợt; Regigigas thức tỉnh sau khi cả năm bị hạ, có Slow Start 10 giây rồi chuyển sang lao quét.

### Duo

- **Eon (Latios, Latias):** hỗ trợ khiên/hồi máu có cooldown; hạ Latias trước sẽ làm Latios cuồng nộ +100% tốc độ/sát thương theo thời gian giới hạn.
- **Mặt Trăng (Cresselia, Darkrai):** hiệu ứng tối viền màn hình tối đa 2 giây, không che vùng nguy hiểm; đạn hình trăng của Cresselia quét theo vùng có thể né.
- **Tháp Cổ (Lugia, Ho-Oh):** tro lửa tồn tại hữu hạn; luồng gió đẩy có hướng báo trước để tránh đẩy thẳng vào vệt lửa.
- **Anh Hùng (Zacian, Zamazenta):** khiên Zamazenta có góc/hitbox và trạng thái rõ; đòn chém tàng hình của Zacian phải báo trước vị trí lao tới.

## Các giai đoạn triển khai

1. **Tách chế độ khỏi run hiện tại:** thêm nút Home và màn chọn màn; dựng arena độc lập, đường quay về và co-op host chọn màn. Xác nhận không đổi lịch Rift/Arceus hoặc đồng hồ run sinh tồn.
2. **Kiểm kê và chốt quy tắc:** xác nhận sprite/form có sẵn cho từng Pokémon; chốt điều kiện chưa rõ của Hoopa, Meloetta, Terapagos; chốt luật thưởng riêng. Giữ Arceus và mốc thời gian hiện hành.
3. **Framework đổi form:** thêm cấu hình trigger HP/time/action, chuyển animation, điều chỉnh chỉ số/giáp/chiêu, hiệu ứng 2 giây tùy boss và thông điệp HUD; đồng bộ một lần qua host.
4. **Nhóm HP threshold:** triển khai Zygarde, Darmanitan, Necrozma; sau khi ổn định thêm Wishiwashi. Xác nhận trigger không lặp, hồi máu không vượt giới hạn và sát thương không đi xuyên lúc biến hình.
5. **Nhóm timer/stance:** triển khai Aegislash và Deoxys trước để hoàn thiện timer/stance; tiếp theo Rotom và Meloetta. Thêm Hoopa sau khi chốt trigger và quy tắc phản projectile.
6. **Terapagos:** xây dựng trước cơ chế khiên và năng lượng khắc hệ như một hệ thống riêng, có chỉ báo HUD và đồng bộ nhặt năng lượng, rồi mới nối vào boss.
7. **Encounter framework nhiều đội:** tổng quát hóa registry/roster/thứ tự/điều kiện kết thúc/phần thưởng; giữ host làm nguồn quyết định, hỗ trợ boss đồng thời và boss theo đợt.
8. **Nội dung đội hình:** hoàn thiện màn trio Thời tiết trước; tiếp đến duo Eon; sau đó trio Sáng Tạo/Đạo và quartet Thánh Kiếm; các đội còn lại được thêm theo mức sẵn sàng của sprite và cơ chế.
9. **Mở rộng roster và cân bằng:** bổ sung sprite còn thiếu của Họa Tai; triển khai encounter phức tạp (Tapu, Regi, terrain, phản projectile) sau khi HUD, hazard và khôi phục arena ổn định.

## Tiêu chí hoàn thành

- Mọi chuyển form chỉ xảy ra đúng trigger, đúng một lần hoặc đúng chu kỳ; animation, HP, giáp, hitbox và chiêu khớp form đang hiển thị.
- Các màn mới chỉ vào được qua nút Home → Chọn màn chơi; bắt đầu/kết thúc/chơi lại không làm thay đổi run sinh tồn, đồng hồ, Rift phút 10 hoặc lịch Judgment/Arceus.
- Chiêu liên tục có vùng ảnh hưởng nhìn thấy được, target/pattern thay đổi theo thiết kế, và thời gian tấn công thực được tách khỏi thời gian dừng báo trước.
- Debuff/reflect/terrain có giới hạn thời gian, cooldown hoặc miễn nhiễm để không khóa người chơi liên tục.
- Encounter duo/trio/quartet kết thúc đúng điều kiện; chết/thoát/timeout không để arena, timer, projectile hoặc aura tồn đọng.
- Co-op nhận cùng form, target, hazard, wave, thứ tự boss và phần thưởng; client không tự random trạng thái chiến đấu.
- Pokémon chưa có sprite form dùng hiệu ứng chung hoặc bị hoãn, không hiện form sai; encounter chỉ bật khi toàn bộ roster bắt buộc có dữ liệu tối thiểu.
- Judgment/Arceus giữ nguyên cơ chế, cinematic và lịch theo mode.

## Ngoài phạm vi nếu chưa được yêu cầu riêng

- Gắn boss/form mới vào run sinh tồn hiện tại hoặc thay lịch Rift/Arceus.
- Thêm 52 Pokémon còn thiếu sprite chuẩn chỉ bằng placeholder và xem như đã hoàn thiện.
- Bật đồng thời toàn bộ encounter trong một Rift hoặc thay đổi lịch Arceus.
- Tạo sprite form mới bằng cách chỉnh sửa hình ảnh hiện có mà không có nguồn/asset phù hợp.
