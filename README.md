# NorthPath 北极星

> 面向大学生的 AI 简历制作、校准与编辑工作台

[在线体验](https://northpath-seven.vercel.app) · [GitHub 仓库](https://github.com/haoabcde/NorthPath)

NorthPath 北极星帮助大学生和应届生从真实经历中挖掘可写素材，生成适配目标岗位的简历，并通过校准报告、Markdown 编辑器和本地版本管理持续优化到可投递状态。

它关注的不只是“把简历润色得更好看”，而是把简历制作前后的关键问题连起来：不知道写什么、不知道怎么写、不知道是否匹配岗位，以及 AI 建议难以落地修改。

## 核心亮点

- **从零挖掘经历**：围绕课程项目、校园活动、竞赛、社团、个人作品等大学生常见场景，生成可写经历池。
- **岗位化生成简历**：根据目标岗位或 JD 生成岗位写作地图，并输出 Markdown 简历初稿。
- **简历校准报告**：从岗位匹配、经历价值、表达清晰度、能力凭证和版面效率等维度分析投递准备度。
- **可执行修正路线**：把泛泛建议拆成可定位、可应用、可追踪的修改任务。
- **双栏 Markdown 编辑器**：左侧编辑，右侧 A4 实时预览，承接校准建议继续优化。
- **本地版本管理**：简历内容、校准结果和版本记录默认保存在本地浏览器，支持保存、回滚和对比。
- **多格式导出**：支持 Markdown、PDF、DOCX 等常见简历交付格式。

## 产品模块

### Resume Builder

面向没有完整简历，或觉得自己“没东西可写”的用户。

- 目标岗位定位
- 经历挖掘问答
- 可写经历池
- 难写经历转化
- 经历价值排序
- 岗位化 Markdown 简历生成

### Resume Calibration

面向已有简历但不确定能否投递、哪里需要修改的用户。

- 岗位坐标解析
- 简历航向判断
- 内容模块体检
- 关键段落修正
- 投递准备度报告
- 修正优先级路线

### Resume Editor

承接制作和校准结果，让 AI 建议可以直接落到简历修改里。

- Markdown 双栏编辑
- A4 实时预览
- 行级问题定位
- 修正任务侧栏
- 一键应用改写
- 版本保存、回滚与对比
- 重新校准当前版本

## 用户路径

**没有简历**

```text
进入 NorthPath -> 制作简历 -> 经历挖掘问答 -> 可写经历池
-> 岗位化简历初稿 -> 编辑器 -> 一键校准 -> 优化修改 -> 导出
```

**已有简历**

```text
进入 NorthPath -> 校准简历 -> 上传/粘贴简历 -> 投递准备度报告
-> 修正路线 -> 编辑器逐段修改 -> 版本对比 -> 再次校准
```

**换岗位投递**

```text
打开已有版本 -> 修改目标岗位/JD -> 重新生成岗位坐标
-> 判断经历保留/弱化/重写/删除 -> 生成新版本 -> 校准 -> 保存
```

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | Next.js 16 App Router, React 19, TypeScript |
| 样式与动效 | Tailwind CSS, Framer Motion |
| 状态管理 | Zustand |
| 本地存储 | LocalForage, IndexedDB |
| 图表 | Recharts |
| 文档处理 | docx, html2canvas, jsPDF, mammoth, pdfjs-dist |
| AI 接口 | OpenAI 兼容 API，用户自配密钥 |

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，在页面右上角配置 LLM API 信息后即可使用。

常用命令：

```bash
npm run check
npm test
npm run build
```

## 隐私说明

- 简历文件、校准结果、追问记录和版本记录默认仅存储在本地浏览器。
- LLM API 密钥由用户自行配置，请不要提交到公开仓库。
- 产品设计原则是不编造公司、数据、奖项或不存在的成果，只基于真实经历提炼表达。

## 项目结构

```text
app/
├── api/ai/           # LLM 代理 API
├── builder/          # 简历制作模块
├── calibration/      # 简历校准模块
├── editor/[id]/      # 简历编辑器
├── versions/         # 版本管理页面
└── page.tsx          # 首页

src/
├── views/            # 页面视图组件
├── components/       # 公共组件
├── lib/              # 业务逻辑：经历转化、校准、报告生成、导出等
├── services/         # 数据层：IndexedDB 与 LLM 调用
├── store/            # Zustand 状态管理
└── hooks/            # 自定义 Hooks
```

## Roadmap

- 更多岗位方向的写作地图
- 更细的校准评分解释
- 更完整的版本对比与优化轨迹
- 面向校招和实习场景的示例模板

## License

MIT
