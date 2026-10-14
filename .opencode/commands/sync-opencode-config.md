---
description: Sync OpenCode CLI settings and keybind catalogs with the latest released opencode tag
---

任务:以最新发布的 opencode 版本为基线,核对并同步本扩展的 OpenCode CLI 配置目录。禁止把 dev 分支 HEAD 当作基线,dev 可能包含尚未发布的配置项,而旧版本解析 cli.json 遇到未知 keybind 会直接报错。

## 第一步 确定基线版本

本地 opencode 源码仓库位于 $env:USERPROFILE\.config\opencode\opencode-source。若不存在,按全局 AGENTS.md 约定先从 GitHub 浅克隆 anomalyco/opencode 到该路径。

执行以下命令更新引用并取最新发布 tag:

```
git -C "$env:USERPROFILE\.config\opencode\opencode-source" fetch origin --tags --quiet
git -C "$env:USERPROFILE\.config\opencode\opencode-source" for-each-ref --sort=-v:refname --count=1 --format="%(refname:short)" "refs/tags/v2.*"
```

输出的 tag 即本次基线,后续所有上游内容都读该 tag 版本的文件,用 git show <tag>:<path> 获取。

## 第二步 提取两侧清单

上游真源,均在 opencode-source 仓库内:

- 设置键:packages/tui/src/config/index.tsx 的 Info schema。枚举定义在同文件顶部,例如 MiniWorkSpinner 与 AttentionSoundName;默认值参考同文件 resolve 函数。
- keybind:packages/tui/src/config/keybind.ts 的 Definitions。注意 leader 是唯一的无引号键,其余 id 均带引号。

扩展侧目录:

- src/services/aiTools/openCodeCliSettingsCatalog.ts
- src/services/aiTools/openCodeKeybindCatalog.ts

提取 keybind id 时正则必须捕获到引号内的完整内容,例如 [^"]+。不要用 \w 或 [\w.],否则 which-key.* 这类含连字符的 id 会漏匹配,产生伪差异。

## 第三步 双向比对并同步

对 keybind id 做双向集合比对,对设置键做逐键核对,分三类处理:

1. 上游新增:按目录现有条目格式补齐。设置键的 title 与 desc 走 l10n.t,中文文案同步加入 l10n/bundle.l10n.zh-cn.json,键与英文字符串相同。keybind 条目 title 与 desc 用硬编码英文,不走 l10n。
2. 上游移除:从目录删除对应条目。上游会保留少量标记 Deprecated 的条目,是否收录以 Definitions 中实际存在为准。
3. 枚举值变化:逐值核对并按上游顺序排列,例如 mini.work_spinner。

id 比对之外必须逐项核对既有条目的默认键位 def 与上游 Definitions,不一致时以上游为准更新;上游标记 Deprecated 的条目要同步其说明与 title 标注。

## 固定规则

- attention.sounds 与 experimental 以 readonly 展示型条目收录,只在面板展示说明并提供打开 cli.json 的入口,不进 values 与 overrides,保存与重置必须拒绝。tabs.enabled 是被 tabs.mode 取代的上游遗留开关,不收录。
- prompt.paste 条目的 def 保持字符串 ctrl+v。上游默认值已是对象形式,不做对象兼容。
- 同步完成后把两个目录文件头注释的基线更新为 released opencode 加本次 tag 版本号与核对日期。

## 验证

全部改动完成后依次运行,必须全部通过:

```
npx vitest run src/services/OpenCodeCliSettingsService.test.ts src/services/OpenCodeKeymapService.test.ts
node scripts/check-l10n.js
npm run compile
```

check-l10n 报告的 EXTRA 键属于存量问题,只需确认 MISSING 为 0。

最后汇报:基线 tag、差异分类统计、改动文件清单、各项验证结果。
