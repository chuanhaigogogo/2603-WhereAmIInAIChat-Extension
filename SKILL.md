---
name: MindFlow
description: >
  Generate concise mind maps and structured learning notes
  from AI conversations with Obsidian export support.
---

# MindFlow - Conversation Mind Map Generator

## Trigger

When the user says any of the following:
- "生成思维导图" / "思维导图" / "导图"
- "mindmap" / "mind map"
- "/mindmap"

## What You Do

Analyze the ENTIRE conversation from the beginning, then output TWO things:

### 1. Mind Map (思维导图)

A concise tree showing **only knowledge points and their logical connections**.

Rules:
- The root node is the main topic of the conversation (what the user originally wanted to learn/do)
- Each branch represents a knowledge point that came up during the conversation
- Every node must show WHY it connects to its parent — the logical line, not just keyword grouping
- If the user asked about topic B because the AI mentioned B while explaining topic A, then B is a child of A
- Each node is a short label (max 15 chars), NOT a full sentence
- Annotate each node with a brief "= explanation" or "→ consequence" where helpful
- Max depth: 5 levels. Max total nodes: ~25
- Do NOT include: greetings, meta-discussion about the conversation itself, off-topic remarks
- Do NOT list every detail — only the structural knowledge points that form the learning path

Output format:
```
主题
├─ 知识点A = 简短解释
│   └─ 知识点B (因为A提到了B)
│       └─ 知识点C → 结论
├─ 知识点D
│   ├─ 子点1
│   └─ 子点2
```

### 2. Notes (学习笔记)

A detailed outline that EXPLAINS the relationships between knowledge points. This is the "expanded" version of the mind map.

Rules:
- Follow the same structure as the mind map, but expand each node with 1-2 sentences explaining:
  - What this concept is
  - Why it came up in the conversation (what triggered this branch)
  - How it connects to other concepts
- Use the format: `**知识点** — 解释，以及它和上层知识点的关系`
- Include key analogies and metaphors the AI used
- Max ~500 words total — this is a summary, not a transcript

### 3. Obsidian Export

After the mind map and notes, output a markdown block that the user can directly copy into Obsidian:

```markdown
---
title: "对话主题"
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
---

# 主题

## 思维导图
(copy the mind map tree here)

## 学习笔记
(copy the notes here)

## 知识点链接
- [[知识点A]]
- [[知识点B]]
- ...
```

Use `[[wiki-links]]` for all key concepts so they become linkable in Obsidian.

## Example

Given a conversation about "installing a Claude Code skill" that branched into RAG, CLI, JavaScript, and memory management:

### Mind Map:
```
安装Skill
├─ Skill = 简化版RAG
│   └─ RAG: 检索 → 注入上下文 → 生成
│       └─ 为什么不直接更新LLM → 参数≠数据库
├─ Skill分两个产品: claude.ai vs Claude Code
│   ├─ 不互通原因: 同模型, 不同系统
│   └─ 抽象 vs 实现
├─ 安装需要的工具链
│   ├─ CLI (Claude Code是CLI工具)
│   │   └─ 交互方式, 抽象概念
│   ├─ npm (安装Claude Code用npm)
│   │   └─ 包管理器 ≈ App Store
│   │       └─ package.json = 依赖清单
│   ├─ Node.js (npm和Claude Code依赖它)
│   │   ├─ V8引擎从浏览器提取
│   │   └─ JS被困浏览器 → 历史路径依赖
│   └─ Git (下载Skill用git clone)
├─ JS为什么不用C → 抽象层次不同
│   └─ 机器码 → 汇编 → C → JS
├─ JS为什么不管内存 → GC自动回收
│   ├─ 手动malloc/free vs GC
│   └─ 控制力 vs 便利性
```

### Notes:
**Skill** — 本质是一个指令文件夹(SKILL.md)，注入AI上下文改变其行为。它是RAG的简化版：不做向量搜索，直接按任务类型读文件。

**RAG (检索增强生成)** — 因为Skill背后的原理是RAG所以展开。解决LLM训练后知识冻结的问题：检索外部知识→注入上下文→生成回答。用户追问"为什么不直接更新LLM"→因为参数≠数据库，重训成本极高，且有灾难性遗忘风险。

**claude.ai vs Claude Code** — 因为要安装的skill属于Claude Code而非claude.ai。两者用同一个模型但是独立的软件系统，skill不互通。引出核心概念：接口相同≠实现互通(抽象vs实现)。

**CLI/npm/Node.js/Git** — 安装Claude Code需要的工具链。CLI是一种交互方式(抽象概念，非物理实体)。npm是包管理器≈App Store。Node.js是Ryan Dahl从Chrome提取V8引擎的产物——JS原本被困在浏览器是因为引擎只在浏览器内，不是被禁止。

**抽象层次** — 因为问"为什么不用C/C++写浏览器交互"引出。不同语言面向不同使用者：C/C++给造工具的人(精确控制)，JS/Python给用工具的人(便利优先)。层级：机器码→汇编→C→JS。

**内存管理** — 因为理解了抽象层次后追问"JS为什么不管内存"。C/C++手动malloc/free，JS/Python有垃圾回收器(GC)内置在引擎里自动管理。C/C++不加GC因为会造成stop-the-world停顿，核心权衡：控制力vs便利性。

## Important

- Always analyze the FULL conversation, not just the last few messages
- The mind map must show logical connections (WHY each branch exists), not just list topics
- Keep it concise — if in doubt, leave it out
- Respect the user's language — if they spoke Chinese, output in Chinese; if English, output in English; if mixed, follow the dominant language
