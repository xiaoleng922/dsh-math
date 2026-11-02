# dsh-math

**在 DeepSeek Harness 的对话里，直接渲染数学公式。**

装好之后，助手回复里的 `$...$`、`$$...$$`、`\(...\)`、`\[...\]` 会由 [KaTeX](https://katex.org/) 当场排版成真正的公式，不再是 `e^{-at}` 这种纯文本。

---

## 它长什么样

- 行内：`柯西–黎曼方程是 $u_x=v_y$` → 柯西–黎曼方程是 $u_x=v_y$
- 独立成行：`$$ \int_0^T e^{-at}dt $$` → 居中的大公式
- 代码块里的 `$` 不会被误伤（`pre` / `code` 自动跳过）
- 流式输出也能边写边渲染

---

## 安装

> 先确认 DSH 有插件管理能力（`dsh plugin` 或插件市场）。

### 方式一：从 npm 安装（发布后）

```sh
dsh plugin --profile <profile-name> add dsh-math
```

### 方式二：本地目录安装（还没发布时）

```sh
dsh plugin --profile <profile-name> add "file:<path-to>/dsh-math"
```

### 装完必须重启

DSH 启动时锁定插件集合，**不重启界面不会变**：

1. 停掉 DSH
2. 重新启动
3. 刷新页面
4. **开一个新会话**

---

## 支持的分隔符

| 写法 | 类型 |
|---|---|
| `$ ... $` | 行内公式 |
| `$$ ... $$` | 独立公式 |
| `\( ... \)` | 行内公式 |
| `\[ ... \]` | 独立公式 |

`$` 有轻量保护：`$5`、`$5.00` 这种金额不会被当成公式。

---

## 配置

KaTeX 默认从 jsDelivr CDN 加载：

```
https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/
```

完全离线时，可以改成自托管：把 KaTeX 的 `dist/` 放到你自己的静态服务，然后修改 `lib/client.js` 顶部的 `KATEX_BASE`。

---

## 原理

- **客户端插件**（`lib/client.js`）：在浏览器里用 `MutationObserver` 监听对话 DOM，把文本节点里的公式定界符替换成 KaTeX 渲染的节点。不注册 slot、不覆盖任何现有 renderer，所以不会和 `dsh-genui` 等插件打架。
- **服务端插件**（`lib/index.js`）：目前是空壳，只为让插件能被 profile 挂载。

---

## 已知限制

- 公式渲染依赖 KaTeX（印刷体），**没有「手写体」**——数学字体领域没有成熟的 handwriting 字库。
- 不处理 `\begin{aligned}` 等需要完整 LaTeX 环境的高级写法（KaTeX 支持的部分可以）。
- 只在浏览器端生效；终端 / API 输出不受影响。

---

## 开源

MIT。欢迎 issue / PR。

---

## License

MIT
