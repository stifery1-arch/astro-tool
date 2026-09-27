# 支付后端部署说明（微信支付 / 支付宝）

`pay-server.js` 是一个**零框架依赖**的 Node 服务，负责：创建订单 → 返回支付二维码 → 接收支付回调验签 → 前端轮询到账后自动解锁。

## 一、两种收款模式怎么选

| 模式 | 需要什么 | 优点 | 缺点 |
|---|---|---|---|
| **A. 收款码 + 解锁码**（默认，无需服务器） | 你的微信/支付宝收款码图片 | 立刻能用，零成本，个人可做 | 人工发码；纯前端校验可被技术用户绕过 |
| **B. 官方支付接口**（本目录） | 微信支付商户号 / 支付宝开放平台应用 + 公网 HTTPS 服务器 | 全自动到账即解锁，服务端验签，安全 | 需要营业执照等资质、服务器、备案域名 |

**建议**：先用 A 跑起来收钱；单量稳定后再上 B。

## 二、模式 A：收款码 + 解锁码（5 分钟）

1. 打开 `tools/unlock-codegen.html`（双击即可，本地运行）。
2. 把 `hashSalt` 改成自己的值，例如 `wode-xingpan-2026`。
3. 生成 20 个解锁码，**保存好明文列表**（每个客户发一个）。
4. 复制「哈希数组」，粘贴到 `js/app.js` 的 `CONFIG.pay.unlockHashes`。
5. 把 `CONFIG.pay.hashSalt` 改成同一个值，并把 `demoCode` 改为 `''`（删除演示码）。
6. 把你的微信 / 支付宝收款码图片放进 `images/`，填到：

```js
wechatQrcode: 'images/wechat-qr.png',
alipayQrcode: 'images/alipay-qr.png',   // 没有支付宝可以留空
```

7. 客户流程：点付费导出 → 扫码付款 → 把订单号发给你 → 你回一个解锁码 → 客户输入后解锁。

## 三、模式 B：官方支付接口

### 1. 启动服务

```bash
node server/pay-server.js                       # 默认 8787 端口
PORT=8787 MOCK=1 node server/pay-server.js      # 模拟模式（联调用，不调用真实支付）
npm i qrcode                                     # 可选：让后端直接把支付链接转成二维码图片
```

### 2. 微信支付（Native 扫码，APIv3）

需要：商户号、绑定的 appid、APIv3 密钥、商户 API 证书（`apiclient_key.pem`）、微信支付平台证书。

```bash
export WX_APPID=wx1234567890
export WX_MCHID=1900000001
export WX_SERIAL=商户证书序列号
export WX_API_V3_KEY=32位APIv3密钥
export WX_PRIVATE_KEY_PATH=/etc/certs/apiclient_key.pem
export WX_PLATFORM_CERT_PATH=/etc/certs/wechatpay_platform.pem
export PUBLIC_BASE_URL=https://pay.你的域名.com
node server/pay-server.js
```

支付回调地址（需在商户平台配置或由下单接口自动带上）：
`https://pay.你的域名.com/api/notify/wechat`

### 3. 支付宝（当面付 precreate）

需要：开放平台应用 appid、应用私钥、支付宝公钥。

```bash
export ALIPAY_APP_ID=2021000000000000
export ALIPAY_PRIVATE_KEY_PATH=/etc/certs/alipay_private.pem
export ALIPAY_PUBLIC_KEY_PATH=/etc/certs/alipay_public.pem
export PUBLIC_BASE_URL=https://pay.你的域名.com
node server/pay-server.js
```

回调地址：`https://pay.你的域名.com/api/notify/alipay`

### 4. 前端接入

在 `js/app.js` 里填后端地址并打开开关：

```js
apiBase: 'https://pay.你的域名.com',
apiEnabled: true
```

前端会自动：创建订单 → 展示二维码 → 每 3 秒轮询订单状态 → 支付成功自动解锁（无需人工发码）。

### 5. 接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/order` | 建单，body：`{reportNo, amount, subject, channel}`，channel 为 `wechat` / `alipay` |
| GET | `/api/order/:orderNo` | 查询订单，返回 `{status, paid}` |
| POST | `/api/notify/wechat` | 微信支付回调（自动验签 + AES-GCM 解密） |
| POST | `/api/notify/alipay` | 支付宝回调（自动 RSA2 验签） |
| POST | `/api/mock/pay` | 仅模拟模式：手动标记已支付 |
| GET | `/health` | 健康检查，查看商户参数是否配置齐全 |

## 四、安全与合规提醒

- 服务端验签是**唯一可靠**的防盗版手段；纯前端解锁码只提高门槛。
- 微信/支付宝官方接口要求经营资质，个人收款码仅适合小规模自用，请按当地法规与平台规则使用。
- 不要把商户私钥、APIv3 密钥写进前端代码或提交到 Git（本目录已用 `.gitignore` 排除 `orders.json`）。
- 生产环境建议：把 `orders.json` 换成数据库、开启 HTTPS、限制 CORS 白名单、给 `/api/mock/pay` 加环境判断（默认已限制为模拟模式）。

## 五、本地联调（不需要任何商户号）

```bash
MOCK=1 PORT=8787 node server/pay-server.js
node tests/pay-server-test.js        # 已覆盖：建单/查单/支付/回调/落盘 共 23 项断言
```

模拟模式下：下单返回 `mock://pay/订单号`，6 秒后自动变为已支付（可用 `MOCK_PAY_DELAY_MS` 调整），或手动 `POST /api/mock/pay` 立即到账。