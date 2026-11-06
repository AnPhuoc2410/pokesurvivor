# Kiểm kê Pokédex

Ngày kiểm tra: 2026-11-05

## Kết quả

- Dự án có dữ liệu đầy đủ cho 973/1025 số Pokédex.
- Cả 973 Pokémon hiện có đều có mục trong Pokédex, metadata sprite, bộ ảnh và mapping ability.
- Codex đã bổ sung 6 Pokémon có đủ animation trong subgroup SpriteCollab: Rolycoly (#837), Falinks (#870), Cufant (#878), Bombirdier (#962), Gimmighoul (#999) và Ting-Lu (#1003).
- 52 Pokémon còn lại chưa có đủ `Idle`, `Walk` và `Attack` trong bất kỳ subgroup nào của SpriteCollab tại thời điểm kiểm tra. Chúng chưa được đưa vào dữ liệu game vì thiếu bộ hình bắt buộc.

## Các số Pokédex chưa có sprite hoàn chỉnh

| Dex | Pokémon | Dex | Pokémon | Dex | Pokémon | Dex | Pokémon |
| ---: | --- | ---: | --- | ---: | --- | ---: | --- |
| 514 | Simisear | 516 | Simipour | 520 | Tranquill | 522 | Blitzle |
| 523 | Zebstrika | 538 | Throh | 558 | Crustle | 564 | Tirtouga |
| 565 | Carracosta | 591 | Amoonguss | 592 | Frillish (đực) | 593 | Jellicent (đực) |
| 616 | Shelmet | 618 | Stunfisk | 626 | Bouffalant | 668 | Pyroar (đực) |
| 683 | Aromatisse | 732 | Trumbeak | 733 | Toucannon | 735 | Gumshoos |
| 756 | Shiinotic | 765 | Oranguru | 838 | Carkol | 839 | Coalossal |
| 865 | Sirfetch’d | 866 | Mr. Rime | 879 | Copperajah | 893 | Zarude |
| 929 | Dolliv | 931 | Squawkabilly (Green Plumage) | 942 | Maschiff | 943 | Mabosstiff |
| 944 | Shroodle | 945 | Grafaiai | 947 | Brambleghast | 948 | Toedscool |
| 949 | Toedscruel | 950 | Klawf | 954 | Rabsca | 956 | Espathra |
| 973 | Flamigo | 986 | Brute Bonnet | 990 | Iron Treads | 993 | Iron Jugulis |
| 1001 | Wo-Chien | 1002 | Chien-Pao | 1014 | Okidogi | 1020 | Gouging Fire |
| 1021 | Raging Bolt | 1022 | Iron Boulder | 1023 | Iron Crown | 1025 | Pecharunt |

Để thêm các mục còn thiếu hoàn chỉnh, cần tạo hoặc tìm sprite sheet 8 hướng có đủ ba animation bắt buộc, sau đó chạy công cụ trong `docs/ADD_POKEMON.md` và bổ sung dữ liệu Pokédex/ability tương ứng.
