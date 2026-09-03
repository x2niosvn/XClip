# XClip — iOS Client Integration Specification & Protocol Guide

> **Tagline**: Clipboard. Synced locally.  
> **Author**: Nguyen Nam X2NIOS ([@x2niosvn](https://github.com/x2niosvn))  
> **Target OS**: iOS 16.0+ (Swift 5.9+ / SwiftUI)  
> **Architecture**: Zero-Cloud, 100% LAN Peer-to-Peer (Bonjour mDNS + WebSocket + AES-256-GCM)

---

## 1. Tổng quan Kiến trúc (Architecture Overview)

XClip hoạt động hoàn toàn trong mạng cục bộ (LAN/Wi-Fi). Không máy chủ trung gian, không VPS, không cần tài khoản, dữ liệu không bao giờ ra ngoài Internet.

```text
┌─────────────────────────┐               LAN Wi-Fi               ┌─────────────────────────┐
│       Windows PC        │ ◄───────────────────────────────────► │        iOS App          │
│    (XClip Desktop)      │       Bonjour (_xclip._tcp)           │      (SwiftUI)          │
│  Port 38721 (WebSocket) │   WebSocket + AES-256-GCM Encrypted   │  Port 38726 / Client    │
└─────────────────────────┘                                       └─────────────────────────┘
```

### Các bước kết nối chính:
1. **Phát hiện (Discovery)**: Cả PC và iPhone đều phát quảng bá dịch vụ mDNS `_xclip._tcp` qua mạng Wi-Fi chung.
2. **Ghép nối bảo mật (Pairing Handshake)**: Xác thực một lần duy nhất bằng mã 6 chữ số (`XXX XXX`). Thiết lập khóa đối xứng bí mật dùng chung (`sharedSecret`).
3. **Đồng bộ mã hóa (Encrypted Sync)**: Khi có nội dung copy mới (Text/Link/Code/Image), dữ liệu được mã hóa bằng **AES-256-GCM** (HKDF SHA-256) và gửi tức thì qua kết nối WebSocket nội bộ.

---

## 2. Cấu hình iOS App (`Info.plist`)

Để iOS cho phép tìm kiếm và kết nối các thiết bị trong mạng Wi-Fi nội bộ, bạn **bắt buộc** phải khai báo các quyền sau trong `Info.plist`:

```xml
<key>NSLocalNetworkUsageDescription</key>
<string>XClip cần quyền truy cập mạng cục bộ để phát hiện và đồng bộ clipboard với máy tính PC qua Wi-Fi.</string>

<key>NSBonjourServices</key>
<array>
    <string>_xclip._tcp</string>
</array>
```

---

## 3. Khám phá Mạng nội bộ (Bonjour Discovery)

### 3.1. Thông số Service mDNS
- **Service Type**: `_xclip._tcp`
- **Domain**: `local.`
- **Default Port**: PC lắng nghe cổng `38721` (iOS có thể mở cổng `38726` hoặc đóng vai trò WebSocket Client kết nối đến PC).
- **TXT Records**:
  - `deviceId`: Chuỗi định danh duy nhất (VD: `xclip-ios-a1b2c3d4`)
  - `deviceName`: Tên thiết bị hiển thị (VD: `iPhone 15 Pro`)
  - `version`: `1.0.0`

### 3.2. Mẫu Code Swift: Tìm kiếm PC qua `NWBrowser` (Network.framework)

```swift
import Foundation
import Network

class XClipLANBrowser: ObservableObject {
    @Published var discoveredPCs: [DiscoveredPeer] = []
    private var browser: NWBrowser?

    struct DiscoveredPeer: Identifiable, Hashable {
        let id: String
        let name: String
        let endpoint: NWEndpoint
    }

    func startBrowsing() {
        let parameters = NWParameters()
        parameters.includePeerToPeer = true

        let descriptor = NWBrowser.Descriptor.bonjour(type: "_xclip._tcp", domain: "local.")
        browser = NWBrowser(for: descriptor, using: parameters)

        browser?.browseResultsChangedHandler = { [weak self] results, changes in
            DispatchQueue.main.async {
                self?.discoveredPCs = results.compactMap { result in
                    switch result.endpoint {
                    case .service(let name, _, _, _):
                        return DiscoveredPeer(id: name, name: name, endpoint: result.endpoint)
                    default:
                        return nil
                    }
                }
            }
        }

        browser?.start(queue: .main)
    }

    func stopBrowsing() {
        browser?.cancel()
        browser = nil
    }
}
```

---

## 4. Chuẩn Mã hóa Bảo mật (Cryptographic Specifications)

XClip sử dụng **AES-256-GCM** với khóa 256-bit được phái sinh qua **HKDF (HMAC-SHA256)**. Khớp chính xác với thư viện `CryptoKit` nguyên bản của Apple trên iOS.

### 4.1. Thông số Khóa & HKDF
- **Hash**: SHA-256
- **Salt**: `xclip-lan-sync-v1` (dạng UTF-8 string)
- **Info**: `aes-256-gcm-key` (dạng UTF-8 string)
- **Output Key Length**: 32 bytes (256 bits)

### 4.2. Mẫu Code Swift: Phái sinh khóa & Mã hóa/Giải mã bằng `CryptoKit`

```swift
import Foundation
import CryptoKit

enum XClipCrypto {
    private static let salt = "xclip-lan-sync-v1".data(using: .utf8)!
    private static let info = "aes-256-gcm-key".data(using: .utf8)!

    /// Phái sinh khóa đối xứng 256-bit từ sharedSecret
    static func deriveKey(from sharedSecret: String) -> SymmetricKey {
        let secretData = sharedSecret.data(using: .utf8)!
        let hkdfKey = SymmetricKey(data: secretData)
        return HKDF<SHA256>.deriveKey(
            inputKeyMaterial: hkdfKey,
            salt: salt,
            outputByteCount: 32,
            info: info
        )
    }

    /// Mã hóa payload thành AES-256-GCM
    static func encrypt(data: Data, sharedSecret: String) throws -> (ciphertext: String, iv: String, authTag: String) {
        let key = deriveKey(from: sharedSecret)
        let sealedBox = try AES.GCM.seal(data, using: key)

        let ciphertext = sealedBox.ciphertext.base64EncodedString()
        let iv = sealedBox.nonce.withUnsafeBytes { Data($0).map { String(format: "%02x", $0) }.joined() }
        let authTag = sealedBox.tag.withUnsafeBytes { Data($0).map { String(format: "%02x", $0) }.joined() }

        return (ciphertext, iv, authTag)
    }

    /// Giải mã payload từ PC gửi sang
    static func decrypt(ciphertext: String, iv: String, authTag: String, sharedSecret: String) throws -> Data {
        let key = deriveKey(from: sharedSecret)

        guard let cipherData = Data(base64Encoded: ciphertext),
              let nonceData = Data(hexString: iv),
              let tagData = Data(hexString: authTag) else {
            throw NSError(domain: "XClipCrypto", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid hex/base64 data"])
        }

        let nonce = try AES.GCM.Nonce(data: nonceData)
        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: cipherData, tag: tagData)
        return try AES.GCM.open(sealedBox, using: key)
    }
}

// Extension hỗ trợ Hex String -> Data
extension Data {
    init?(hexString: String) {
        let len = hexString.count / 2
        var data = Data(capacity: len)
        var index = hexString.startIndex
        for _ in 0..<len {
            let nextIndex = hexString.index(index, offsetBy: 2)
            let bytes = hexString[index..<nextIndex]
            if var num = UInt8(bytes, radix: 16) {
                data.append(&num, count: 1)
            } else {
                return nil
            }
            index = nextIndex
        }
        self = data
    }
}
```

---

## 5. Quy trình Bắt tay Ghép nối (Pairing Handshake)

Quy trình ghép nối diễn ra qua WebSocket (`ws://<pc_ip>:<port>`).

```text
      iOS App                                          Windows PC
         │                                                  │
         │ ──────── 1. Kết nối WebSocket (ws://) ────────► │
         │                                                  │
         │ ──────── 2. PAIR_REQUEST (Code & Secret) ──────► │
         │    { "code": "482 918", "secret": "<hex32>" }    │
         │                                                  │
         │                                       [Hiển thị Popup]
         │                                       [Xác nhận mã 6 số]
         │                                                  │
         │ ◄─────── 3. PAIR_ACCEPT (Xác nhận) ───────────── │
         │                                                  │
[Lưu sharedSecret vào Keychain]             [Lưu sharedSecret vào SQLite]
         │                                                  │
         │ ◄═══════ 4. Kênh truyền mã hóa AES-256 ════════► │
```

### 5.1. Định dạng gói tin Bắt tay (`SyncMessageEnvelope`)

#### Gói `PAIR_REQUEST` (Gửi từ thiết bị yêu cầu ghép nối):
```json
{
  "type": "PAIR_REQUEST",
  "message_id": "c1f7a2b9-38b4-4b9d-a417-64010839e9f2",
  "source_device_id": "xclip-ios-77aa11bb",
  "source_device_name": "Nguyen Nam iPhone",
  "timestamp": 1725432000000,
  "plaintext": {
    "code": "482 918",
    "secret": "e5b8d93c10a4f52984bcde301948572019485720194857201948572019485720"
  }
}
```
*Ghi chú: `secret` là một chuỗi 32-byte ngẫu nhiên dạng Hex (`crypto.randomBytes(32).toString('hex')`).*

#### Gói `PAIR_ACCEPT` (Máy đối diện chấp nhận):
```json
{
  "type": "PAIR_ACCEPT",
  "message_id": "b3e94412-88ef-4df1-8012-749102834011",
  "source_device_id": "xclip-22811004",
  "source_device_name": "DESKTOP-BCELJLD",
  "timestamp": 1725432001500
}
```

---

## 6. Định dạng Gói tin Đồng bộ Clipboard (`CLIPBOARD_SYNC`)

Sau khi ghép nối thành công, mọi nội dung sao chép sẽ được mã hóa và gửi bằng gói `CLIPBOARD_SYNC`.

### 6.1. Vỏ bọc bên ngoài (Outer Envelope - Gửi qua WebSocket):
```json
{
  "type": "CLIPBOARD_SYNC",
  "message_id": "a9103e22-4911-4fae-9d22-192837465012",
  "source_device_id": "xclip-ios-77aa11bb",
  "source_device_name": "Nguyen Nam iPhone",
  "timestamp": 1725432050000,
  "ciphertext": "Yk2d...base64...",
  "iv": "3f9a2b10c841e28491a0b4cd",
  "auth_tag": "88e1a92bf0c2394a10e82c74019284fa"
}
```

### 6.2. Dữ liệu bên trong sau khi giải mã (Inner Payload JSON):
```json
{
  "id": "e931-4821-b102-491a",
  "type": "TEXT",
  "content": "Nội dung vừa copy trên iPhone hoặc PC",
  "preview": "Nội dung vừa copy...",
  "hash": "b2c3d4e5f6...",
  "language": null,
  "dimensions": null,
  "source_device_id": "xclip-ios-77aa11bb",
  "source_device_name": "Nguyen Nam iPhone",
  "created_at": 1725432050000
}
```

### 6.3. Bảng phân loại `type` dữ liệu:
| Type | Mô tả | `content` chứa gì? |
| :--- | :--- | :--- |
| `TEXT` | Văn bản thông thường | Chuỗi string UTF-8 |
| `URL` | Đường dẫn web (http/https) | Chuỗi URL |
| `CODE` | Đoạn mã nguồn lập trình | Chuỗi code, có thể có trường `language` (VD: `swift`, `ts`) |
| `IMAGE` | Ảnh chụp màn hình / ảnh copy | Chuỗi Base64 Data URL (VD: `data:image/png;base64,iVBORw0...`) |
| `FILE` | Đường dẫn file | Chuỗi đường dẫn file |

---

## 7. Mẹo phát triển cho iOS (iOS Best Practices)

### 7.1. Đọc và Ghi Clipboard trên iOS
```swift
import UIKit

class ClipboardManager {
    static let shared = ClipboardManager()

    /// Đọc nội dung hiện tại của Clipboard iOS
    func getLocalClipboardText() -> String? {
        return UIPasteboard.general.string
    }

    /// Gán nội dung nhận từ PC vào Clipboard iOS
    func setLocalClipboard(text: String) {
        UIPasteboard.general.string = text
    }

    /// Gán ảnh nhận từ PC vào Clipboard iOS
    func setLocalClipboard(image: UIImage) {
        UIPasteboard.general.image = image
    }
}
```

### 7.2. Quản lý Khóa bí mật (`sharedSecret`)
- Lưu `sharedSecret` của PC vào **iOS Keychain** (`kSecClassGenericPassword`) thay vì UserDefaults để đảm bảo an toàn tuyệt đối.
- Khi nhận gói tin `CLIPBOARD_SYNC`, kiểm tra `source_device_id` với danh sách thiết bị đã ghép nối trong Keychain.

### 7.3. Thông báo đẩy cục bộ (Local Notification)
Khi app đang ở chế độ nền hoặc người dùng vừa nhận clipboard mới từ PC:
```swift
import UserNotifications

func sendLocalSyncNotification(content: String, deviceName: String) {
    let notif = UNMutableNotificationContent()
    notif.title = "XClip — Đã đồng bộ từ \(deviceName)"
    notif.body = content
    notif.sound = .default

    let request = UNNotificationRequest(identifier: UUID().uuidString, content: notif, trigger: nil)
    UNUserNotificationCenter.current().add(request)
}
```

---

## 8. Danh sách Kiểm tra trước khi Release (Checklist)

- [ ] Đã thêm `NSLocalNetworkUsageDescription` và `_xclip._tcp` vào `Info.plist`.
- [ ] Thiết bị iOS và PC kết nối cùng một mạng Wi-Fi (hoặc phát Wi-Fi Personal Hotspot).
- [ ] Cả 2 thiết bị thực hiện bắt tay và hiển thị mã 6 chữ số trùng khớp.
- [ ] Khóa HKDF SHA-256 phái sinh cho ra cùng giá trị 32-byte trên cả 2 nền tảng.
- [ ] Copy chữ từ PC ➔ iPhone nhận được và cập nhật vào `UIPasteboard`.
- [ ] Copy chữ từ iPhone ➔ PC nhận được và lưu vào cơ sở dữ liệu SQLite.

---
*Tài liệu này chuẩn hóa toàn bộ giao thức truyền thông của XClip v1.0.0.*
