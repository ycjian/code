const fs = require("fs");
const path = require("path");

const pages = [
  {
    input: "mlQuestion.md",
    output: "mlQuestion.html",
    title: "ML Question Interview Prep",
    eyebrow: "ML / LLM / GenAI / RL / Applied ML",
    summary: "A broad interview preparation reader covering ML basics, Transformer implementation, LLMs, generative modelling, applied training systems, and reinforcement learning.",
    logo: "how_assets_small/logos/mlQuestion-logo.svg",
    logoAlt: "ML Question Interview Prep logo",
    parentNavOnly: true,
    navTitle: "Chapters",
    pythonReaderStyle: true,
    inlineNextButton: true,
    sidebarDefault: "expanded",
    sidebarStorageKey: "interview-reader-sidebar:mlQuestion:v2",
    tabGroups: [
      { title: "Transformer End-to-End", from: "1. Implement a Transformer End-to-End" },
      { title: "Attention Types", from: "2. Implement Causal, Cross, and Self Attention" },
      { title: "Flash Attention", from: "3. Implement Flash Attention" },
      { title: "Attention Backward", from: "4. Implement the Attention Backward Pass" },
      { title: "MLP Forward / Backward", from: "5. Implement an MLP Forward and Backward Pass" },
      { title: "Training Loop", from: "6. Implement a Simple Training Loop with SGD in PyTorch or JAX" },
      { title: "General ML Q&A", from: "7. General ML Questions and Answers" },
      { title: "ML Deep Dive", from: "8. Deep Dive Follow-up Questions" },
      { title: "LLM Deep Dive", from: "9. LLM Questions and Deep Dive" },
      { title: "Generative Modelling", from: "10. Generative Modelling Questions and Deep Dive" },
      { title: "Applied ML", from: "11. Applied ML Questions and Deep Dive" },
      { title: "Applied ML Extra", from: "12. Applied ML Extra Deep Dive" },
      { title: "Interview Prep Pack", from: "13. Interview Preparation Pack: Knowledge, Basics, Code, Examples" },
      { title: "Prep Matrix & Code Drills", from: "14. Full Topic Preparation Matrix and Code Drill Bank" },
      { title: "Reinforcement Learning", from: "15. Reinforcement Learning Questions and Deep Dive" },
      { title: "Weak-Spot Review", from: "16. Missing-Weak-Spot补强: Basics, Interview Q&A, Examples" },
      { title: "Resume-Aligned Systems", from: "17. Resume-Aligned AI Infra / Search / Ads Interview Prep" },
      { title: "adt Project Stories", from: "18. adt AI Infra Project Stories: Service / Product / Experience" },
      { title: "Multimodal AI", from: "19. Multimodal AI Interview Prep (merged from multimodal.md)" },
    ],
  },
  {
    input: "py_ds.md",
    output: "py_ds.html",
    title: "Python / ML / AI / DL Interview Prep",
    eyebrow: "Data Science / PyTorch / Multimodal / MLE",
    summary: "A Chinese-first, implementation-heavy interview reader covering Python data science, ML and DL foundations, PyTorch, multimodal learning, production MLE systems, data infrastructure, projects, mathematics, algorithms, and resume-aligned Q&A.",
    logo: "how_assets_small/logos/mlQuestion-logo.svg",
    logoAlt: "Python ML AI DL interview prep logo",
    parentNavOnly: true,
    navTitle: "学习路线",
    pythonReaderStyle: true,
    inlineNextButton: true,
    collapsibleSidebar: true,
    sidebarDefault: "expanded",
    sidebarStorageKey: "interview-reader-sidebar:py-ds:v1",
    defaultTab: "个人经历 ML 基础",
    tabGroups: [
      { title: "Python 基础与容器", from: "0.5 Python 列表基础训练：25 道题从操作走向思维" },
      { title: "函数 / 迭代 / 类型", from: "2. 函数、高阶函数与闭包：把分析过程变成可组合单元" },
      { title: "NumPy / Pandas / 可视化", from: "5. NumPy：形状、轴、广播和内存是核心" },
      { title: "SQL / 性能 / 并发", from: "8. Python 与 SQL：让计算发生在最合适的位置" },
      { title: "统计 / Pipeline / 工程", from: "11. 数据科学必备统计基础" },
      { title: "端到端项目与基础问答", from: "14. 端到端项目：客户流失预测" },
      { title: "Python 原理深潜", from: "17. Python 核心原理面试深潜" },
      { title: "NumPy / Pandas / 统计深潜", from: "18. NumPy 面试深潜：从内存布局到算法实现" },
      { title: "ML 算法 / 编码 / 生产", from: "21. 机器学习算法面试深潜" },
      { title: "ML / DL 统一基础", from: "25. AI、机器学习与深度学习的统一基础" },
      { title: "Transformer / LLM / RAG", from: "27. Attention 与 Transformer 面试深潜" },
      { title: "训练与推理系统", from: "30. AI 训练与推理系统面试基础" },
      { title: "ML 核心 Q&A", from: "32. 机器学习面试核心 Q&A 题库" },
      { title: "ML 八股与解法", from: "33. 常见机器学习八股：速答、公式与解题" },
      { title: "ML 全领域补充", from: "34. 机器学习全领域补充 Q&A" },
      { title: "多模态基础", from: "35. 多模态机器学习面试 Q&A" },
      { title: "多模态进阶", from: "36. 多模态进阶全领域 Q&A" },
      { title: "数学 / 算法 / 从零实现", from: "38. 贯穿全文的数学、算法与从零实现" },
      { title: "PyTorch 深潜", from: "39. PyTorch 面试深潜：Tensor、Autograd、训练与分布式" },
      { title: "PyTorch 编码与进阶", from: "40. PyTorch 高频现场编码题" },
      { title: "Data + ML Infra 项目", from: "43. 可真正实现的 Data + ML Infrastructure 项目" },
      { title: "Data + ML Infra 进阶", from: "44. Data + ML Infra 进阶项目：一致性、调度与治理" },
      { title: "MLE 真实面经", from: "45. MLE 真实面经问题逐项详解" },
      { title: "MLE / ML-SWE 场景题", from: "46. MLE / ML-SWE 场景化面试 Q&A" },
      { title: "多模态 Data + Infra", from: "47. Multimodal Data + Infrastructure 面试 Q&A" },
      { title: "个人经历 AI Infra", from: "48. 基于个人经历的 MLE / AI Infra 面试 Q&A" },
      { title: "ML / AI / DL 基础", from: "49. ML / AI / DL 基础面试 Q&A" },
      { title: "个人经历 ML 基础", from: "50. 基于个人经历的 ML / AI / DL 基础 Q&A" },
      { title: "Agent / Lance / 30 Algorithms", from: "51. 图解深潜：Agentic AI Stack、Lance File Format 与 30 个 AI Algorithms" },
      { title: "Data Science 核心", from: "52. Data Science 核心面试：从业务问题到可信决策" },
      { title: "Statistics 核心", from: "53. Statistics 核心面试：估计、检验、实验与因果" },
      { title: "Data Engineering 核心", from: "54. Data Engineering 核心面试：模型、存储、计算与可靠性" },
      { title: "DS × Stats × DE 综合", from: "55. Data Science × Statistics × Data Engineering 综合面试题" },
      { title: "Recent DS / Stats", from: "56. Recent Data Science / Statistics Interview Deep Dive" },
      { title: "Recent Data Engineering", from: "57. Recent Data Engineering Interview Deep Dive" },
      { title: "Recent Interview Drills", from: "58. Recent Interview Drills：SQL、Python、Statistics 与 System Case" },
      { title: "2026 Product DS", from: "59. 2026 Product Data Science 高频新题：Experiment Integrity 与产品决策" },
      { title: "2026 Data Engineering", from: "60. 2026 Data Engineering 高频新题：Serving、Commit 与数据产品" },
      { title: "当前 Onsite 高频题", from: "61. 当前 Onsite 高频统计与 SQL 追问题" },
      { title: "Bagu 完整八股", from: "62. Bagu：机器学习八股文完整合并" },
    ],
  },
  {
    input: "aiInfra.md",
    output: "aiInfraInterview.html",
    title: "AI Infra Interview Prep",
    eyebrow: "Omnifold / adt-style AI Infra",
    summary: "A role-focused preparation guide for infrastructure, media GenAI, creative workflows, AWS, security, and platform leadership.",
    logo: "how_assets_small/logos/aiInfraInterview-logo.svg",
    logoAlt: "AI Infra Interview logo",
    parentNavOnly: true,
    navTitle: "Chapters",
    pythonReaderStyle: true,
    inlineNextButton: true,
    sidebarDefault: "expanded",
    sidebarStorageKey: "interview-reader-sidebar:aiInfraInterview:v2",
    tabGroups: [
      { title: "Omnifold Role & Infra Basics", from: "岗位理解与总体定位" },
      { title: "Omnifold System Design & Ops", from: "高概率系统设计题" },
      { title: "Challenging Projects & Algorithms", from: "Challenging Projects / Knowledge / Algorithms" },
      { title: "Product / Infra / Model / Data / Customer / Deployment", from: "Product / Infra / Model / Data / Customer / Deployment Framework" },
      { title: "AI Product Systems Positioning", from: "AI Product Systems Engineer Positioning & Practice" },
      { title: "AI System Design Manual", from: "AI Product Model Infra System Design Manual" },
      { title: "Interview Master Playbook", from: "Interview Master Playbook / Project Deep Dive Portfolio" },
      { title: "adt Media AI Systems", from: "adt-style Product / Service 面试定位" },
      { title: "adt Projects & Behavioral", from: "Project Stories for adt-style Interviews" },
      { title: "Creative Platform Deep Dives", from: "Asset Graph、Project Model 与 Collaboration" },
      { title: "AIBrix / LLM Inference Infra", from: "ByteDance / AIBrix-style LLM Inference Infrastructure Prep" },
      { title: "AI Tech Stack Deep Dive", from: "AI Tech Stack Interview Deep Dive" },
      { title: "Tech Stack Implementation", from: "Tech Stack Implementation Project" },
      { title: "Tech Stack Comparisons", from: "Tech Stack Selection & Comparison Deep Dive" },
      { title: "RL Algorithms & Training Infra", from: "算法部分" },
      { title: "ML / LLM / Agent Foundations", from: "ML 基础与建模面试" },
      { title: "Systems / Data / Cloud / Security", from: "System Design 与 Application Architecture" },
      { title: "Advanced AI / Inference / Staff", from: "高级 LLM 架构与训练细节" },
      { title: "Resume / Cheat Sheet", from: "adt-style Resume / Interview Bullets" },
    ],
  },
  {
    input: "ondevice.md",
    output: "ondevice.html",
    title: "On-Device Edge AI Interview Cheatsheet",
    eyebrow: "Amsterdam Creative / Document AI Runtime",
    summary: "A backend and AI infrastructure interview reader for native edge inference, Core ML, media and PDF pipelines, caching, scheduling, hybrid cloud orchestration, and production reliability.",
    logo: "how_assets_small/logos/ondevice-logo.svg",
    logoAlt: "On-device Edge AI logo",
    parentNavOnly: true,
    navTitle: "Chapters",
    pythonReaderStyle: true,
    defaultTab: "Rapid Interview Cheatsheet",
    tabGroups: [
      { title: "Positioning & Roadmap", from: "Interview Positioning：我不是做 UI，我拥有 AI execution boundary" },
      { title: "Rapid Interview Cheatsheet", from: "0A. 10 分钟总图" },
      { title: "System Design Front Door", from: "0. 先记住这条主线" },
      { title: "Native SDK / Service Boundary", from: "5A. 为什么要有 EdgeInferenceService，而不是让每个 feature 直接调 Core ML" },
      { title: "Creative Asset Pipeline", from: "6. 核心 artifact model" },
      { title: "Core ML Runtime", from: "9. `.mlmodel`、`.mlpackage`、compiled model" },
      { title: "Vision / NLP / Create ML", from: "18. Vision request pipeline" },
      { title: "Foundation Models", from: "23. LLM 在 editor 中应该做什么" },
      { title: "Core Image / Metal / MPS", from: "32. 如何选择 Core Image、MPS、Metal、MPSGraph" },
      { title: "Model Conversion & Optimization", from: "39. PyTorch → Core ML conversion" },
      { title: "Runtime Router & Scheduling", from: "49. Runtime router 的输入" },
      { title: "Edge Cache", from: "55. 缓存分层" },
      { title: "Amsterdam APIs & Cloud Jobs", from: "58. Amsterdam developer surfaces" },
      { title: "Observability / Privacy / Security", from: "68. Telemetry event" },
      { title: "SDKs / Media / PDF / OCR", from: "74. 必须熟悉的 Apple SDK matrix" },
      { title: "Edge AI Runtime Project", from: "Project 1.1 — Project pitch" },
      { title: "Implementation & Testing", from: "88. Zero-copy / copy minimization" },
      { title: "Interview Q&A", from: "95. 为什么端侧优先，不是全部上云？" },
      { title: "Experience / Resume Stories", from: "116. “我做过什么” 的 claim ladder" },
      { title: "Study Plan & Final Review", from: "121. Four-week focused plan" },
    ],
  },
  {
    input: "ai_eng.md",
    output: "ai_eng.html",
    title: "AI Engineering Interview Prep",
    eyebrow: "wolf / Amsterdam AI Infrastructure",
    summary: "A Chinese-first, English-keyword interview reader for multimodal AI infrastructure, automated-driving release triage, simulation analysis, production ML systems, and resume-aligned project stories.",
    logo: "how_assets_small/logos/ai-eng-logo.svg",
    logoAlt: "AI Engineering interview prep logo",
    extraInputs: ["wolf_site.txt"],
    parentNavOnly: true,
    navTitle: "Chapters",
    pythonReaderStyle: true,
    defaultTab: "Role & Creative AI Platform",
    transformMarkdown: mergeAiEngWithWolfSite,
    tabGroups: [
      { title: "Role & Creative AI Platform", from: "0. 先理解岗位：团队真正需要你解决什么问题？" },
      { title: "Inference / Storage / Data", from: "3. 面试题：如何设计共享 Model Inference Service？" },
      { title: "MLOps / Agent / Reliability", from: "8. Model Lifecycle" },
      { title: "Backend / Projects / Q&A", from: "17. REST、gRPC、Events 怎么选？" },
      { title: "Transformer / Multimodal", from: "29. Transformer 为什么适合现代 Generative AI？" },
      { title: "Diffusion / Optimization", from: "34. Diffusion Model 的核心逻辑" },
      { title: "RAG / Personalization / Motion", from: "44. Embedding 是什么？" },
      { title: "AI Safety / Privacy", from: "56. Generative AI Safety Pipeline" },
      { title: "wolf Triage Architecture", from: "61. 这个岗位实际要构建什么？" },
      { title: "Resume-Aligned wolf Stories", from: "76. 你的 Experience 与岗位如何对应？" },
      { title: "wolf Service Implementation", from: "90. Project Goal" },
      { title: "Python AI Implementation", from: "96. Robust Time-Series Anomaly Detection" },
      { title: "wolf Production Projects", from: "110. Project A：AI-Assisted Failure Triage Platform" },
      { title: "Testing / Security / Deep Q&A", from: "115. Testing Pyramid" },
      { title: "AD/ADAS Domain Knowledge", from: "134. Automated-Driving Software Stack" },
      { title: "Release / Coding / Debugging", from: "141. Mainline Stability 是什么？" },
      { title: "Documentation / Behavioral", from: "152. Explainability 在 Triage 中意味着什么？" },
      { title: "Final Coverage Review", from: "164. Job Requirement Coverage" },
      { title: "wolf Role / Opening", from: "1. 这个岗位真正想听什么" },
      { title: "wolf System Design Core", from: "3. Requirements" },
      { title: "wolf AI RCA / Multimodal", from: "8. AI/LLM design: 不要做成 naive chatbot" },
      { title: "wolf Safety / Eval / Ops", from: "11. Release gate 不能完全靠 LLM" },
      { title: "wolf Components / Regression", from: "15. Detailed component design" },
      { title: "wolf Interview Flow / Follow-ups", from: "24. 45-minute system design answer structure" },
      { title: "wolf Resume Mapping / Stories", from: "1. 你的 60 秒自我介绍" },
      { title: "wolf Four Systems / Shared Architecture", from: "总体面试主线" },
      { title: "wolf Deep Dives / Coding Tasks", from: "0. 这个岗位的真正考点" },
      { title: "wolf AI Agents / Tech Stack", from: "1. Question: How do you use AI / AI agents for daily code implementation, review, and human-in-the-loop?" },
      { title: "wolf Project Implementation", from: "Project Implementation Content" },
    ],
  },
  {
    input: "deployed_eng.txt",
    extraInputs: ["deployed_eng2.txt", "ai_agent.md", "ai_inference.md", "rag.html"],
    output: "deployed_eng.html",
    title: "Deployment Engineering Interview Router",
    eyebrow: "AI Infra / GenAI FDE / Google Cloud / Production Deployment",
    summary: "A cleaned interview-time reader for deployment engineering, AI infrastructure project stories, GenAI production patterns, customer consulting, Google Cloud FDE cases, and coding drills.",
    logo: "how_assets_small/logos/aiInfraInterview-logo.svg",
    logoAlt: "Deployment engineering interview logo",
    parentNavOnly: false,
    navTitle: "Interview Routes",
    pythonReaderStyle: true,
    defaultTab: "Answer Router",
    transformMarkdown: cleanDeployedEngMarkdown,
    tabGroups: [
      { title: "Answer Router", from: "Interview Answer Router" },
      { title: "Opening & Project Stories", from: "1. 面试总定位：你要让 interviewer 记住什么" },
      { title: "Technical Skills Q&A", from: "3. 技能栈总表：每个 skill 面试怎么讲" },
      { title: "System Design & Coding", from: "8. 系统设计题：高频题与标准答案" },
      { title: "GenAI / FDE Frameworks", from: "0. 这轮面试的本质" },
      { title: "Google Cloud Cases", from: "1. 这轮你应该重新定位自己" },
      { title: "RRK Production Readiness", from: "1. 新版 RRK 答题总框架" },
      { title: "Final Prep & Red Flags", from: "1. 你要准备“评分 rubric”视角" },
      { title: "Coding Agent System Design", from: "3. 核心系统设计：设计一个 Coding Agent" },
      { title: "Agent Runtime / Eval / Projects", from: "6. Planning / Long-running Task" },
      { title: "Coding Agent Drill / Q&A", from: "18C. 高频面试 Q&A 100 题" },
      { title: "ML Inference Platform", from: "3. 核心系统设计：GM ML Inference Platform" },
      { title: "Serving / GPU / Rollout", from: "4. Model Serving Frameworks 深入" },
      { title: "Inference Numbers / Final Review", from: "10C. Project-by-project Numbers Drill" },
      { title: "RAG / Agent Platform", from: "Project Framing & Adobe Resume Mapping" },
      { title: "RAG Architecture / Serving", from: "Product Positioning, Pitch & Architecture" },
      { title: "RAG Q&A / Governance", from: "Interview Q&A: Agents, Serving, Evaluation & Governance" },
    ],
  },
  {
    input: "nv.md",
    output: "nv.html",
    title: "NVIDIA DGXC Data Services Interview Prep",
    eyebrow: "DGX Cloud / AI Data & Storage / GPU Infrastructure",
    summary: "A Chinese-first, implementation-heavy interview reader for exabyte AI data services, multimodal assets, GPU data paths, distributed training and checkpointing, Ray/vLLM, ML/DL models, DAG scheduling, governance, safety, evaluation, and resume-aligned project deep dives.",
    logo: "how_assets_small/logos/aiInfraInterview-logo.svg",
    logoAlt: "NVIDIA DGXC Data Services interview prep logo",
    parentNavOnly: false,
    navTitle: "DGXC Study Routes",
    pythonReaderStyle: true,
    inlineNextButton: true,
    collapsibleSidebar: true,
    defaultTab: "ML / DL / GPU / DAG",
    tabGroups: [
      { title: "Role / JD", from: "0. 先建立正确定位：这个岗位不是“给 GPU 挂一个盘”" },
      { title: "DGXC Data Fabric", from: "2. 经典题目" },
      { title: "Checkpoint / Governance / Ops", from: "8. Distributed checkpoint：最容易拉开 Senior 差距的部分" },
      { title: "50B+ Multimodal Assets", from: "13. 面试题：讲一个最相关、规模最大的项目" },
      { title: "Generative AI Platform", from: "17. 统一 Creative Generation Platform" },
      { title: "Ray / vLLM Serving", from: "21. 统一 inference control plane" },
      { title: "Edge / Data Execution", from: "25. 为什么 co-design 是 data services 问题" },
      { title: "Agent / Safety / Eval", from: "32. Agent platform" },
      { title: "ML / DL / GPU / DAG", from: "X1. Training objective 与 optimization" },
      { title: "Project Deep Dive", from: "48. Flagship A：50B+ Multimodal Discovery" },
    ],
  },
  {
    input: "meta.md",
    output: "meta.html",
    title: "Meta Video ML Foundations Interview Prep",
    eyebrow: "Facebook Video / Reels / RecSys / GPU ML Infrastructure",
    summary: "A Chinese-first, implementation-heavy interview reader for Facebook-style video recommendation: ranking funnels, point-in-time training data, distributed GPU training, low-latency inference, freshness, elastic compute, multimodal understanding, satisfaction alignment, and delivery-aware ranking.",
    logo: "how_assets_small/logos/meta-video-logo.svg",
    logoAlt: "Meta Video ML Foundations interview prep logo",
    parentNavOnly: false,
    navTitle: "Video ML Study Routes",
    pythonReaderStyle: true,
    inlineNextButton: true,
    collapsibleSidebar: true,
    defaultTab: "Facebook Video Projects",
    tabGroups: [
      { title: "HM Chat / Technical Positioning", from: "0. 先理解这 45 分钟到底在评估什么" },
      { title: "Video Ranking System Design", from: "6. 旗舰系统设计题" },
      { title: "Training Data / Freshness / Eval", from: "12. Training example 的正确性" },
      { title: "Distributed GPU Training", from: "15. Recommendation training 为什么与普通 dense model 不同" },
      { title: "GPU Inference / Co-design", from: "20. 先定义 inference trilemma" },
      { title: "Elasticity / Reliability / Observability", from: "24. Elastic compute architecture" },
      { title: "PyTorch / Technical Q&A", from: "28. Two-Tower Retrieval（可运行的简化版）" },
      { title: "Behavioral / Project Proposal", from: "38. 准备四个 STAR 故事" },
      { title: "Coding / Safety / HM Questions", from: "44. 高频 coding 方向" },
      { title: "Final Review", from: "47. 面试前必须能脱口而出的数字" },
      { title: "Training / GPU / Co-design Deep Dive", from: "51. 学习验收标准：不是“知道”，而是“能推导、能实现、能诊断”" },
      { title: "Project 1: Multimodal Discovery", from: "80. Project scope 与 assumptions" },
      { title: "Projects 2–6: ML Foundations", from: "100. Problem statement" },
      { title: "Facebook Video Projects", from: "142. Product problem" },
    ],
  },
  {
    input: "xxxxx.md",
    output: "xxxxx.html",
    title: "xxxxx AI Infrastructure Interview Prep",
    eyebrow: "Autonomous Driving / Data Closed Loop / AI Infrastructure",
    summary: "A Chinese-first interview reader for autonomous-driving AI data infrastructure, covering onboard upload, cloud preprocessing, dataset production, Iceberg/Lance, VLA data flywheel, system design, coding, and final interview prep.",
    logo: "how_assets_small/logos/aiInfraInterview-logo.svg",
    logoAlt: "xxxxx AI infrastructure interview prep logo",
    extraInputs: ["iceberg.md", "xp_panel.md"],
    parentNavOnly: true,
    navTitle: "Interview Routes",
    pythonReaderStyle: true,
    defaultTab: "Tomorrow Second Round",
    transformMarkdown: mergeAvInfraReaders,
    tabGroups: [
      { title: "Role / JD / Tech Stack", from: "0. 一句话定位" },
      { title: "PDF Revisit / Interview Map", from: "1.8 Revisit PDF：面试最可能怎么考" },
      { title: "System Design Deep Dive", from: "1.9 System Design Deep Dive：端到端自动驾驶数据闭环" },
      { title: "Coding / Project / Traps", from: "1.10 Coding Deep Dive：他们可能怎么追问" },
      { title: "90s Answers", from: "1.13 90 秒强回答模板" },
      { title: "Modern AI Infra", from: "1.14 Modern AI Infra Requirements：直接面试版" },
      { title: "AD Vertical Benchmarks", from: "1.15 Autonomous Driving Vertical：Waymo / Cruise / Zoox / Aurora 对标" },
      { title: "Tomorrow Second Round", from: "1.16 明天二面：一小时 Technical Interview 作战图" },
      { title: "VLA / Data Flywheel", from: "2. 面试总地图" },
      { title: "Coding Interview", from: "3. Coding Interview 准备" },
      { title: "Core System Designs", from: "4. System Design：设计大规模 AI Data Pipeline" },
      { title: "Dataset / Versioning / Loader", from: "5. System Design：Dataset Management Platform" },
      { title: "Distributed / Flywheel / Observability", from: "8. Distributed Processing 与 Pipeline Reliability" },
      { title: "Performance / Projects", from: "12. Performance Optimization" },
      { title: "Final Review", from: "16. Behavioral and Communication" },
      { title: "Iceberg Internals", from: "3. Apache Iceberg：从元数据树理解全部能力" },
      { title: "Streaming / Quality / Lance", from: "4. Kafka / Pulsar / RabbitMQ：面试必须说清的边界" },
      { title: "Iceberg Projects / Hands-on", from: "10. 项目二：Iceberg Dataset Registry 与 Lineage Platform" },
      { title: "AIBrix / Capacity / Pass Gate", from: "27. AIBrix Deep Dive：LLM Inference Control Plane 面试主线" },
      { title: "Panel Positioning / Method", from: "0. 你的候选人定位：面试全程反复强化的三句话" },
      { title: "Panel Deep Dives / Leadership", from: "7. Project Deep Dive Focus：只讲一个主项目，但准备三种角度" },
      { title: "Panel Cheatsheet / Waymo-style", from: "17. 最后 10 分钟 Cheatsheet" },
    ],
  },
  {
    input: "tik.md",
    output: "tik.html",
    title: "TikTok AI Native Asset & Agent Interview Prep",
    eyebrow: "AI Native Assets / Agentic Workflow / Multimodal Retrieval",
    summary: "A Chinese-first, implementation-heavy interview reader for 50B+ digital assets: hybrid retrieval and reranking, Ray data and GPU execution, multimodal indexing, agentic DAG runtime, serving, safety, evaluation, and resume-aligned production deep dives.",
    logo: "how_assets_small/logos/aiInfraInterview-logo.svg",
    logoAlt: "AI native asset systems interview prep logo",
    parentNavOnly: true,
    navTitle: "Interview Routes",
    pythonReaderStyle: true,
    defaultTab: "50B+ Production Deep Dive",
    inlineNextButton: true,
    collapsibleSidebar: true,
    tabGroups: [
      { title: "Role / Positioning / Answer Protocol", from: "学习路线（不要从头被动读到尾）" },
      { title: "Asset Platform System Design", from: "4. Flagship System Design：AI Native Multimodal Asset & Workflow Platform" },
      { title: "Agent / DAG / DDD / EDA", from: "5. Agentic Workflow Runtime：图编辑器只是表面，可靠执行才是核心" },
      { title: "Multimodal Data / AIGC", from: "8. Multimodal Storage / Stream / Batch / Calculation" },
      { title: "Ray / GPU / Serving / Edge", from: "10. Ray / Triton / vLLM：分层 serving，不互相替代" },
      { title: "Safety / Evaluation", from: "12. Trust & Safety：风险判断必须进入资产和 workflow 的每一层" },
      { title: "Resume-Aligned Project Stories", from: "14. Résumé Deep Dive 1：Adobe Product-Facing Core AI Infrastructure" },
      { title: "Coding / Design / Behavioral Drills", from: "20. Backend / Coding 高频：代码之外要主动讲 invariant" },
      { title: "50B+ Production Deep Dive", from: "25. 真实实践 Deep Dive：50B+ Multimodal Retrieval 到共享 AI Execution" },
    ],
  },
  {
    input: "wolf_aug.txt",
    output: "wolf_aug.html",
    title: "Wolf Release & Triage Interview Prep",
    eyebrow: "Automated Driving / Multimodal RCA / Simulation Evaluation",
    summary: "A privacy-scrubbed, Chinese-first interview reader for autonomous-driving release and triage tooling, covering multimodal failure analysis, LLM evaluation, release qualification, simulation, data platforms, and system design.",
    logo: "how_assets_small/logos/aiInfraInterview-logo.svg",
    logoAlt: "Wolf Release and Triage interview prep logo",
    parentNavOnly: false,
    navTitle: "Interview Routes",
    pythonReaderStyle: true,
    inlineNextButton: true,
    collapsibleSidebar: true,
    sidebarDefault: "expanded",
    sidebarStorageKey: "interview-reader-sidebar:wolf-aug:v1",
    defaultTab: "Interview Router",
    transformMarkdown: prepareWolfAugMarkdown,
    tabGroups: [
      { title: "Interview Router", from: "Interview Router" },
      { title: "Role / Company / Team", from: "0. 岗位定位与使用规则" },
      { title: "AI / Release / Platform", from: "4. AI/ML/LLM QUESTIONS" },
      { title: "ML / XFN / Manager", from: "8. ML ROUND：高概率深挖" },
      { title: "AD / RCA / Evaluation", from: "13. AD/ADAS DOMAIN DEEP DIVE：平台工程师必须懂的系统语义" },
      { title: "Security / Variants / Senior", from: "16. MULTIMODAL / LLM IMPLEMENTATION + SECURITY + TESTING" },
      { title: "Round Overview", from: "19. ROUND-SPECIFIC PACKETS：四轮分别准备" },
      { title: "ML Round", from: "19A. ML ROUND — TWO TECHNICAL INTERVIEWERS" },
      { title: "Data Platform Round", from: "19B. CROSS-FUNCTIONAL — DATA PLATFORM" },
      { title: "Manager Round", from: "19C. MANAGER — SIMULATION AND EVALUATION" },
      { title: "System Design Round", from: "19D. SYSTEM DESIGN — STAFF ENGINEERING" },
      { title: "AutoTriage / Deep Dive", from: "20. IMMEDIATE INTERVIEW DEEP DIVE：WOLF AUTOTRIAGE + ML MATH + SYSTEM DETAILS" },
      { title: "Final Review", from: "21. INTERVIEWER-ROUND ROUTER" },
      { title: "Agent Memory Engineering", from: "26. AGENT MEMORY ENGINEERING：MEMORY / RETRIEVAL / ORCHESTRATION" },
    ],
  },
    {
    input: "netflix/netneo.md",
    extraInputs: ["ads.md"],
    output: "netneo.html",
    title: "neo Ads L5 Interview Prep",
    eyebrow: "neo / Ads Decisioning / Data / AI Infrastructure",
    summary: "A Chinese-first L5 interview reader for ads coding, demand modeling, frequency capping, CTV decisioning, programmatic buying, measurement, Adt data and AI infrastructure, product ownership, and culture rounds.",
    logo: "how_assets_small/logos/ads-logo.svg",
    logoAlt: "neo Ads L5 interview prep logo",
    parentNavOnly: true,
    navTitle: "Interview Routes",
    pythonReaderStyle: true,
    defaultTab: "Session Packets",
    transformMarkdown: mergeAdsReaders,
    tabGroups: [
      { title: "Interview Map", from: "0. 先看懂这次 site 到底在选什么人" },
      { title: "Resume / Calendar", from: "0.5 你的真实候选人定位：Ads systems + modern AI infrastructure" },
      { title: "Ads Domain", from: "1. 广告业务全景" },
      { title: "CTV / Programmatic", from: "A1. CTV 广告播放：CSAI、SSAI 与 DAI" },
      { title: "Adt Data / AI Bridge", from: "B1. 不要把 Adt 经验只讲成“AI platform”" },
      { title: "Frequency Cap Design", from: "5. 先把问题定义正确" },
      { title: "Data Modeling", from: "16. 这一轮的正确互动方式" },
      { title: "Decisioning / Optimization", from: "24. Real-time decision funnel" },
      { title: "Coding", from: "33. 45 分钟执行协议" },
      { title: "Product / Ownership", from: "40. Behavioral answer 的结构" },
      { title: "Culture / Role", from: "53. Culture Memo 的四个核心原则" },
      { title: "Mock Drills", from: "56. System Design 模拟题" },
      { title: "Session Packets", from: "S1. L5 Coding" },
      { title: "Final Cheat Sheet", from: "60. Ads flow 一口气说完" },
      { title: "Ads Platform Deep Dive", from: "总体理解与面试定位" },
      { title: "Serving / Measurement / ML", from: "Ad Server / Decisioning 系统设计" },
      { title: "Ads Projects / Behavioral", from: "Project Stories for Ads Interviews" },
    ],
  },
];

function promoteTopHeadingsForReader(markdown) {
  return markdown.replace(/^# (.+)$/gm, "## $1");
}

function normalizeDedupKey(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dedupeRepeatedBlocks(markdown) {
  const source = String(markdown || "").replace(/\r\n/g, "\n");
  if (!source.trim()) return source;

  const seenSectionKeys = new Set();
  const sections = source.split(/(?=^##\s+)/m);
  const keptSections = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const key = normalizeDedupKey(trimmed);
    if (trimmed.startsWith("## ") && seenSectionKeys.has(key)) continue;
    if (trimmed.startsWith("## ")) seenSectionKeys.add(key);
    keptSections.push(trimmed);
  }

  const seenBlockKeys = new Set();
  const compactedSections = keptSections.map((section) => {
    const blocks = section.split(/\n{2,}/);
    const keptBlocks = [];
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const isHeading = /^#{2,6}\s+/.test(trimmed);
      const isCodeFence = /^```/.test(trimmed);
      const key = normalizeDedupKey(trimmed);
      const shouldDedup = !isHeading && trimmed.length >= 120;
      if (shouldDedup && seenBlockKeys.has(key)) continue;
      if (shouldDedup && !isCodeFence) seenBlockKeys.add(key);
      keptBlocks.push(trimmed);
    }
    return keptBlocks.join("\n\n");
  });

  return compactedSections.filter(Boolean).join("\n\n---\n\n") + "\n";
}

function mergeAiEngWithWolfSite(markdown, extraSources = []) {
  const mergedExtras = extraSources
    .filter((value) => String(value || "").trim())
    .map((value) => promoteTopHeadingsForReader(String(value).replace(/\r\n/g, "\n").trim()));
  return dedupeRepeatedBlocks([String(markdown || "").trim(), ...mergedExtras].filter(Boolean).join("\n\n---\n\n"));
}

function mergeAvInfraReaders(markdown, extraSources = []) {
  const mergedExtras = extraSources
    .filter((value) => String(value || "").trim())
    .map((value) => promoteTopHeadingsForReader(String(value).replace(/\r\n/g, "\n").trim()));
  return dedupeRepeatedBlocks([String(markdown || "").trim(), ...mergedExtras].filter(Boolean).join("\n\n---\n\n"));
}

function mergeAdsReaders(markdown, extraSources = []) {
  const mergedExtras = extraSources
    .filter((value) => String(value || "").trim())
    .map((value) => promoteTopHeadingsForReader(String(value).replace(/\r\n/g, "\n").trim()));
  return dedupeRepeatedBlocks([String(markdown || "").trim(), ...mergedExtras].filter(Boolean).join("\n\n---\n\n"));
}

function prepareWolfAugMarkdown(markdown) {
  const router = `## Interview Router

这是 interview-time reader，不要线性从头读到尾。先根据轮次跳转，再用左侧 In This Tab 定位到具体问题。

### Four-round fast entry

| Round | Interviewer focus | Open first |
| --- | --- | --- |
| ML | multimodal evidence、retrieval/reranking、calibration、OOD、LLM evaluation | [ML round](#19a-ml-round-two-technical-interviewers) |
| Cross-Functional | canonical IDs、schema/lineage、SLO、ACL、late/partial data、ownership | [Data Platform round](#19b-cross-functional-data-platform) |
| Manager | evaluator trust、simulation fidelity、release confidence、roadmap、influence | [Manager round](#19c-manager-simulation-and-evaluation) |
| System Design | state machine、idempotency、blob/event split、workflow、versioning、degradation | [System Design round](#19d-system-design-staff-engineering) |

### Question-to-route map

| If they ask... | Jump to... | Answer spine |
| --- | --- | --- |
| Why this role / tell me about yourself | [Role / Company / Team](#0-岗位定位与使用规则) | production AI infrastructure -> evidence workflow -> release trust |
| Design LLM-based RCA | [AI / LLM](#4-aimlllm-questions) | evidence -> retrieval -> cited hypotheses -> confidence/OOD -> human confirmation |
| Explain an AD incident | [AD / RCA](#13-adadas-domain-deep-dive平台工程师必须懂的系统语义) | first credible divergence -> causal chain -> reproduce/bisect/fix |
| Discuss a public AutoTriage pattern | [AutoTriage](#20a-industry-autotriage-case几乎与本岗位同题) | high-quality evidence + temporal taxonomy + domain experts + reproducible evaluation |
| Need the last-minute summary | [Final review](#23-最后-3-分钟速查) | AI suggests; policy and qualified engineers decide |

### Core answer protocol

1. Clarify user, decision, scope, scale and safety boundary.
2. Establish immutable, time-aligned evidence before generation.
3. Separate deterministic rules, retrieval/ML and LLM responsibilities.
4. Return typed hypotheses with citations, contradictions, missing evidence and abstention.
5. Evaluate offline quality, calibration, workflow outcome and release risk.
6. Close with failure handling, auditability, rollout and human accountability.

---`;

  let source = String(markdown || "").replace(/\r\n/g, "\n").trim();

  source = source.replace(
    /^7\.5 Architecture\n[\s\S]*?^7\.6 Execution$/m,
    `7.5 Architecture

\`\`\`mermaid
flowchart TD
  A["On-Road / Simulation / CI"] --> B["Artifact Gateway"]
  B --> C["Object Storage"]
  B --> D["Event Ingestion"]
  D --> E["Kafka / Event Bus"]
  E --> F["Case Builder + Metadata DB"]
  F --> G["Normalization / Time Alignment"]
  G --> H1["Log Template + Sequence Analyzer"]
  G --> H2["Metric / Change-Point Analyzer"]
  G --> H3["Assertion Parser"]
  G --> H4["Image / Video Keyframes + Embeddings"]
  G --> H5["Candidate-vs-Baseline Comparator"]
  H1 --> I["Evidence Bundle Service"]
  H2 --> I
  H3 --> I
  H4 --> I
  H5 --> I
  I --> J1["Known Signature Rules"]
  I --> J2["Similar Incident Retrieval"]
  I --> J3["Classifier / Reranker"]
  I --> J4["LLM Hypothesis Generator"]
  J1 --> K["Citation Validator + Confidence / OOD / Abstention"]
  J2 --> K
  J3 --> K
  J4 --> K
  K --> L["Triage Case Service"]
  L --> M1["Engineer Dashboard / Issue Tracker"]
  L --> M2["CI/CD / Release Qualification"]
  L --> M3["Feedback + Evaluation Store"]
\`\`\`

7.6 Execution`,
  );

  source = source.replace(
    /^Architecture：\n\`\`\`text\nDrive\/Sim\/CI Producers[\s\S]*?^\`\`\`$/m,
    `Architecture：

\`\`\`mermaid
flowchart TD
  P["Drive / Simulation / CI Producers"] --> S["Local Durable Spool / Site NAS"]
  S --> O["Object Storage: large immutable blobs"]
  P --> K["Kafka / Event Bus: manifests + references"]
  K --> R["Run State Service"]
  R --> W["Durable Workflow Engine"]
  O --> W
  W --> A1["Log Analyzer"]
  W --> A2["Metric Analyzer"]
  W --> A3["Video Analyzer"]
  W --> A4["Assertion Analyzer"]
  A1 --> E["Evidence Bundle Store"]
  A2 --> E
  A3 --> E
  A4 --> E
  E --> X1["Search / Vector Retrieval"]
  E --> X2["LLM Analysis"]
  E --> X3["Policy Engine"]
  X1 --> T["Triage Case API"]
  X2 --> T
  X3 --> T
  T --> D["Dashboard / Audit / Release Decision"]
\`\`\``,
  );

  source = source
    .replace(/^={20,}\n([^\n]+)\n={20,}$/gm, (_, title) => `## ${title.trim()}`)
    .replace(/^-{20,}\n((?:19[A-D]|20[A-E])\.[^\n]+)\n-{20,}$/gm, (_, title) => title.startsWith("19") ? `## ${title.trim()}` : `### ${title.trim()}`)
    .replace(/^[-=]{20,}$/gm, "---")
    .replace(/^(\d+\.\d+\s+.+)$/gm, "### $1")
    .replace(/^(\[[^\]]+\]\s+(?:Q\d+|ML-\d+|CF-\d+|MGR-\d+|SD-\d+|AT-\d+|MD-\d+|EV-\d+|SX-\d+|EX-\d+)：.+)$/gm, "### $1")
    .replace(/\$\/completed run、\$\/useful triage/g, "cost/completed run、cost/useful triage");

  const mathReplacements = [
    ["`severity × occurrence probability × exposure`", "$\\mathrm{risk}=\\mathrm{severity}\\times\\mathrm{probability}\\times\\mathrm{exposure}$"],
    ["`0.6745*(x-median)/MAD`", "$z=0.6745\\,(x-\\mathrm{median})/\\mathrm{MAD}$"],
    ["`z_t=λx_t+(1-λ)z_(t-1)`", "$z_t=\\lambda x_t+(1-\\lambda)z_{t-1}$"],
    ["`RRF(d)=Σ_i 1/(k+rank_i(d))`", "$\\mathrm{RRF}(d)=\\sum_i \\frac{1}{k+\\mathrm{rank}_i(d)}$"],
    ["`precision=TP/(TP+FP)`", "$\\mathrm{precision}=\\frac{TP}{TP+FP}$"],
    ["`recall=TP/(TP+FN)`", "$\\mathrm{recall}=\\frac{TP}{TP+FN}$"],
    ["`F1=2PR/(P+R)`", "$F_1=\\frac{2PR}{P+R}$"],
    ["`L=-log exp(sim(q,p)/τ) / Σ_j exp(sim(q,d_j)/τ)`", "$\\mathcal{L}=-\\log\\frac{\\exp(\\mathrm{sim}(q,p)/\\tau)}{\\sum_j\\exp(\\mathrm{sim}(q,d_j)/\\tau)}$"],
    ["`-log σ(s_positive-s_negative)`", "$-\\log\\sigma(s_{positive}-s_{negative})$"],
    ["`Brier=mean((p-y)^2)`", "$\\mathrm{Brier}=\\frac{1}{N}\\sum_i(p_i-y_i)^2$"],
    ["`C_FN*FN(t)+C_FP*FP(t)+C_review*Review(t)`", "$C_{FN}FN(t)+C_{FP}FP(t)+C_{review}Review(t)$"],
  ];
  for (const [plain, math] of mathReplacements) source = source.split(plain).join(math);

  return `${router}\n\n${source}\n`;
}

function cleanDeployedEngMarkdown(markdown, extraSources = []) {
  const router = `## Interview Answer Router

Use this first during interview prep. Each route points to the section that best matches the interviewer question, so the page works as an answer-time navigation surface instead of a long GPT transcript.

### Route summary

| Route | Use it when... | Fast jump |
| --- | --- | --- |
| Answer Router | You need to decide where to go from the interviewer question. | [Open](#answer-router) |
| Opening & Project Stories | Self-intro, ownership, project deep dive, resume defense. | [Open](#opening-project-stories) |
| Technical Skills Q&A | Spark, Kafka, Flink, K8s, Ray, vLLM, feature store, CUDA, APIs. | [Open](#technical-skills-qa) |
| System Design & Coding | Multimodal search, model gateway, feature store, anomaly detection, coding drills. | [Open](#system-design-coding) |
| GenAI / FDE Frameworks | Deploy GenAI, product integration, RAG, agent, troubleshooting, consulting. | [Open](#genai-fde-frameworks) |
| Google Cloud Cases | GCP product mapping, enterprise RAG, support agent, multimodal solution, tradeoffs. | [Open](#google-cloud-cases) |
| RRK Production Readiness | Reliability, security, privacy, compliance, scalability, cost, app delivery. | [Open](#rrk-production-readiness) |
| Final Prep & Red Flags | Rubric, timing, demo story, last-week plan, red flags, final opening. | [Open](#final-prep-red-flags) |

### Question router

| If interviewer asks... | Jump to... | Answer spine |
| --- | --- | --- |
| "Tell me about yourself" / "What is your background?" | Opening & Project Stories | Production AI infrastructure: data -> retrieval -> serving -> orchestration -> observability -> rollout safety |
| "Walk me through a project" / "What did you own?" | Opening & Project Stories | Problem, platform abstraction, execution path, reliability, metrics, your code ownership |
| "Ask me Spark/Kafka/Flink/K8s/Ray/vLLM/feature store" | Technical Skills Q&A | When to use it, failure mode, production metric, and one implementation detail |
| "Design a search, model serving, feature store, or anomaly system" | System Design & Coding | Requirements -> architecture -> bottleneck -> tradeoff -> implementation drill |
| "How do you deploy GenAI solutions?" | GenAI / FDE Frameworks | Discovery -> architecture -> grounding -> serving -> guardrails -> eval -> rollout |
| "What Google Cloud products would you use?" | Google Cloud Cases | Vertex AI, Model Garden, Agent Builder, Vector Search, BigQuery, Cloud Run/GKE, Pub/Sub, Dataflow |
| "How do you make this reliable, secure, scalable, and compliant?" | RRK Production Readiness | SLO, fallback, IAM, PII boundary, audit, tenant isolation, autoscaling, cost controls |
| "A website or GenAI app got slow or worse. How do you debug?" | RRK Production Readiness | Clarify impact, define metrics, isolate layer, remediate, communicate rollback and prevention |
| "What should I review this week?" | Final Prep & Red Flags | Rubric, timing, demo story, red flags, 12 one-line answers, final opening |

### 60-second answer formula

1. State the product/customer problem.
2. Name the production constraint: latency, cost, privacy, reliability, scale, or quality.
3. Describe the architecture boundary you owned.
4. Give one implementation detail: schema, queue, router, index, cache, evaluation, rollout, or observability.
5. Close with impact and tradeoff.

---`;

  const normalize = (value) => String(value)
    .replace(/\r\n/g, "\n")
    .replace(/英文面试可以这么说，但你现在要中文，我给中文版本：/g, "可以作为中文 opening 使用：")
    .replace(/我给中文版本：/g, "中文版本：")
    .replace(/下面是/g, "这里是")
    .replace(/下面这个/g, "这个")
    .replace(/继续/g, "延伸")
    .trim()
    .split("\n").map((line) => {
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (!heading) return line;
      if (heading[2].trim() === "避免小文件和不均匀任务") {
        return "#### 避免小文件和不均匀任务";
      }
      const level = Math.min(6, heading[1].length + 1);
      return `${"#".repeat(level)} ${heading[2].trim()}`;
    }).join("\n");

  const preparedSources = extraSources.map((value, index) => {
    if (index === 3 && /<html[\s>]/i.test(String(value || ""))) {
      return extractRagHtmlToMarkdown(String(value));
    }
    return value;
  });

  const normalized = [markdown, ...preparedSources]
    .filter((value) => String(value || "").trim())
    .map(normalize)
    .join("\n\n---\n\n");

  return dedupeRepeatedBlocks(`${router}\n\n${normalized}\n`);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nearr;/g, "↗");
}

function stripHtmlTags(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function extractRagHtmlToMarkdown(html) {
  const source = String(html || "").replace(/\r\n/g, "\n");
  const articles = [...source.matchAll(/<article class="reader-page[\s\S]*?id="page-\d+"[\s\S]*?>([\s\S]*?)<\/article>/g)];
  if (!articles.length) return "";

  const renderChunk = (chunk) => {
    let text = String(chunk || "");

    text = text.replace(/<div class="codehilite">[\s\S]*?<code>([\s\S]*?)<\/code>[\s\S]*?<\/div>/g, (_, code) => {
      return `\n\n\`\`\`text\n${decodeHtmlEntities(code).trim()}\n\`\`\`\n\n`;
    });
    text = text.replace(/<pre[\s\S]*?><code>([\s\S]*?)<\/code><\/pre>/g, (_, code) => {
      return `\n\n\`\`\`text\n${decodeHtmlEntities(code).trim()}\n\`\`\`\n\n`;
    });
    text = text.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_, body) => {
      const lines = stripHtmlTags(body).split(/\n+/).filter(Boolean).map((line) => `> ${line}`);
      return `\n\n${lines.join("\n")}\n\n`;
    });
    text = text.replace(/<li>([\s\S]*?)<\/li>/g, (_, body) => `\n- ${stripHtmlTags(body)}`);
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, (_, body) => `\n\n### ${stripHtmlTags(body)}\n\n`);
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_, body) => `\n\n#### ${stripHtmlTags(body)}\n\n`);
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (_, body) => `\n\n##### ${stripHtmlTags(body)}\n\n`);
    text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, (_, body) => `\n\n###### ${stripHtmlTags(body)}\n\n`);
    text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_, body) => `\n\n${stripHtmlTags(body)}\n\n`);
    text = text.replace(/<br\s*\/?>/g, "\n");
    text = text.replace(/<\/?(section|div|ul|ol|table|tbody|thead|tr|td|th)[^>]*>/g, "\n");
    text = stripHtmlTags(text)
      .replace(/\n{3,}/g, "\n\n")
      .replace(/(?:\n- .+)+/g, (block) => `\n${block}\n`)
      .trim();
    return text;
  };

  const pages = articles.map((match) => {
    const body = match[1];
    const titleMatch = body.match(/<h1 class="page-title">([\s\S]*?)<\/h1>/);
    const title = stripHtmlTags(titleMatch ? titleMatch[1] : "RAG + AI Agent");
    const withoutTitle = body.replace(/<h1 class="page-title">[\s\S]*?<\/h1>/, "");
    return `## ${title}\n\n${renderChunk(withoutTitle)}`;
  });

  return pages.join("\n\n---\n\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function looksLikeMathExpression(value) {
  const text = String(value).trim();
  if (!text || text.length > 180 || /[\u4e00-\u9fff]/.test(text)) return false;
  if (/^[A-Za-z][A-Za-z0-9 _/-]*(?:\s+\+\s+[A-Za-z][A-Za-z0-9 _/-]*)+$/.test(text)) return false;
  if (/["{};]/.test(text) || /[.:]/.test(text)) return false;
  if (/^[A-Za-z][A-Za-z0-9_']*$/.test(text)) return false;
  if (/^[A-Za-z]+(?:-[A-Za-z0-9]+)+$/.test(text)) return false;
  if (/^[A-Za-z](?:\/[A-Za-z])+$/.test(text)) return false;
  if (/^[A-Za-z][A-Za-z0-9_']*(?:\/[A-Za-z][A-Za-z0-9_']*)+$/.test(text)) return false;
  if (/%/.test(text)) return false;
  if (/\b(?:http|www|npm|pip|torch|jax|np|nn|self|class|return|import|from|assert|LayerNorm|SelfAttention|MLP|token_embedding|position_embedding|final_layernorm|transpose|masked_fill|float)\b/i.test(text)) return false;
  if (/[\^_]/.test(text) && !/^[A-Za-z][A-Za-z0-9_']*$/.test(text)) return true;
  if (/[()[\]A-Za-z0-9]\s*(?:<=|>=|!=|=|\*|\+)\s*[()[\]A-Za-z0-9]/.test(text)) return true;
  if (/\b[A-Za-z]\s+-\s+[A-Za-z]\b/.test(text)) return true;
  if (/\b[A-Za-z]\([^)]*[|=][^)]*\)/.test(text)) return true;
  if (/\b(?:sqrt|softmax|sigmoid|log|exp|max|min|argmax|argmin|sum|mean|var|cov|KL|JS|ELBO|MSE|BCE)\s*\(/i.test(text)) return true;
  if (/\b[dpqQKVSROWA-Z][A-Za-z0-9_']*\s*\([^)]*\)/.test(text) && /[|,^_]/.test(text)) return true;
  return false;
}

function looksLikeMathBlock(value, lang) {
  const normalizedLang = String(lang || "").toLowerCase();
  if (normalizedLang === "math" || normalizedLang === "latex" || normalizedLang === "tex") return true;
  return false;
}

function mathHtml(value, displayMode, explicitMath = false) {
  const tag = displayMode ? "div" : "span";
  const className = displayMode ? "math-display" : "math-inline";
  const explicitAttr = explicitMath ? ' data-explicit-math="true"' : "";
  return `<${tag} class="${className}" data-tex="${escapeHtml(value)}"${explicitAttr}>${escapeHtml(value)}</${tag}>`;
}

function slugify(text, seen) {
  const base = text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "section";
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function inlineMarkdown(text) {
  const codeSpans = [];
  const mathSpans = [];
  let raw = String(text).replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@CODE_SPAN_${codeSpans.length}@@`;
    codeSpans.push(code);
    return token;
  });
  raw = raw.replace(/\\\((.+?)\\\)/g, (_, source) => {
    const token = `@@MATH_SPAN_${mathSpans.length}@@`;
    mathSpans.push(source.trim());
    return token;
  });
  raw = raw.replace(/\$([^$\n]+)\$/g, (_, source) => {
    const token = `@@MATH_SPAN_${mathSpans.length}@@`;
    mathSpans.push(source.trim());
    return token;
  });
  let value = escapeHtml(raw);
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  value = value.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = escapeHtml(href);
    const externalAttrs = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${safeHref}"${externalAttrs}>${label}</a>`;
  });
  value = value.replace(/@@CODE_SPAN_(\d+)@@/g, (_, index) => {
    const code = codeSpans[Number(index)] || "";
    return `<code>${escapeHtml(code)}</code>`;
  });
  value = value.replace(/@@MATH_SPAN_(\d+)@@/g, (_, index) => {
    const source = mathSpans[Number(index)] || "";
    return mathHtml(source, false, true);
  });
  return value;
}

function parseMarkdown(markdown) {
  const normalizedMarkdown = markdown
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\$\$[ \t]*\n([\s\S]*?)^[ \t]*\$\$[ \t]*$/gm, (_, source) => `\`\`\`math\n${source.trim()}\n\`\`\``)
    .replace(/^[ \t]*\$\$[ \t]*(.+?)[ \t]*\$\$[ \t]*$/gm, (_, source) => `\`\`\`math\n${source.trim()}\n\`\`\``)
    .replace(/^[ \t]*\\\[[ \t]*\n([\s\S]*?)^[ \t]*\\\][ \t]*$/gm, (_, source) => `\`\`\`math\n${source.trim()}\n\`\`\``);
  const lines = normalizedMarkdown.split("\n");
  const toc = [];
  const sections = [];
  const seen = new Map();
  let currentSection = null;
  let introHtml = [];
  let paragraph = [];
  let list = null;
  let inCode = false;
  let codeLang = "";
  let codeLines = [];
  let blockquote = [];

  function targetHtml() {
    return currentSection ? currentSection.html : introHtml;
  }

  function pushHtml(value) {
    targetHtml().push(value);
  }

  function flushParagraph() {
    if (!paragraph.length) return;
    pushHtml(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    const compact = list.type === "ul" && list.items.length <= 8 && list.items.every((item) => item.length <= 92 && !/[|]/.test(item));
    if (compact) {
      pushHtml(`<p class="compact-list">${list.items.map((item) => inlineMarkdown(item)).join(' <span class="dot">·</span> ')}</p>`);
    } else {
      pushHtml(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
    }
    list = null;
  }

  function flushBlockquote() {
    if (!blockquote.length) return;
    pushHtml(`<blockquote>${blockquote.map((line) => `<p>${inlineMarkdown(line)}</p>`).join("")}</blockquote>`);
    blockquote = [];
  }

  function flushCode() {
    const source = codeLines.join("\n");
    if (String(codeLang || "").toLowerCase() === "mermaid") {
      pushHtml(`<figure class="mermaid-figure"><figcaption>Architecture Diagram</figcaption><pre class="mermaid">${escapeHtml(source)}</pre><p class="mermaid-error" hidden>Diagram could not be rendered.</p></figure>`);
      codeLines = [];
      codeLang = "";
      return;
    }
    if (looksLikeMathBlock(source, codeLang)) {
      const normalizedLang = String(codeLang || "").toLowerCase();
      const explicitMath = normalizedLang === "math" || normalizedLang === "latex" || normalizedLang === "tex";
      pushHtml(mathHtml(source, true, explicitMath));
      codeLines = [];
      codeLang = "";
      return;
    }
    const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
    pushHtml(`<div class="code-shell"><div class="code-title"><span>${escapeHtml(codeLang || "code")}</span><button type="button" class="copy-btn">Copy</button></div><pre><code${langClass}>${escapeHtml(source)}</code></pre></div>`);
    codeLines = [];
    codeLang = "";
  }

  function isTableRow(line) {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 3;
  }

  function splitTableRow(line) {
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
    const cells = [];
    let cell = "";
    let inInlineCode = false;
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      if (char === "`") {
        inInlineCode = !inInlineCode;
        cell += char;
        continue;
      }
      if (char === "|" && !inInlineCode) {
        cells.push(cell.trim());
        cell = "";
        continue;
      }
      cell += char;
    }
    cells.push(cell.trim());
    return cells;
  }

  function isTableSeparator(line) {
    if (!isTableRow(line)) return false;
    const cells = splitTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
  }

  function tableAlignment(separatorCell) {
    const cell = separatorCell.replace(/\s+/g, "");
    if (/^:-+:$/.test(cell)) return "center";
    if (/^-+:$/.test(cell)) return "right";
    if (/^:-+$/.test(cell)) return "left";
    return "";
  }

  function renderTable(rows) {
    const header = rows[0];
    const separator = rows[1];
    const body = rows.slice(2);
    const alignments = header.map((_, index) => tableAlignment(separator[index] || ""));
    const attr = (index) => alignments[index] ? ` style="text-align:${alignments[index]}"` : "";
    const thead = `<thead><tr>${header.map((cell, index) => `<th${attr(index)}>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${body.map((row) => `<tr>${header.map((_, index) => `<td${attr(index)}>${inlineMarkdown(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
    return `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;
  }

  function flushAllBlocks() {
    flushParagraph();
    flushList();
    flushBlockquote();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const codeFence = line.match(/^(?:```|~~~)(.*)$/);
    if (codeFence) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushAllBlocks();
        inCode = true;
        codeLang = codeFence[1].trim();
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushAllBlocks();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text, seen);
      const headingHtml = `<h${level} id="${id}">${inlineMarkdown(text)}<a class="anchor" href="#${id}" aria-label="Link to section">#</a></h${level}>`;

      if (level === 2) {
        currentSection = { id, text, html: [headingHtml], items: [] };
        sections.push(currentSection);
      } else {
        pushHtml(headingHtml);
        if (level === 3 && currentSection) {
          currentSection.items.push({ id, text, parentId: currentSection.id });
        }
      }

      if (level === 2 || level === 3) toc.push({ level, text, id, sectionId: currentSection ? currentSection.id : id });
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushAllBlocks();
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushAllBlocks();
      pushHtml("<hr/>");
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushAllBlocks();
      const tableRows = [splitTableRow(line), splitTableRow(lines[i + 1])];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        tableRows.push(splitTableRow(lines[i]));
        i += 1;
      }
      i -= 1;
      pushHtml(renderTable(tableRows));
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blockquote.push(quote[1]);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      flushBlockquote();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushBlockquote();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    flushList();
    flushBlockquote();
    paragraph.push(line.trim());
  }

  flushAllBlocks();
  if (inCode) flushCode();

  if (introHtml.length && sections.length) {
    sections[0].html.unshift(...introHtml);
    introHtml = [];
  }

  if (!sections.length && introHtml.length) {
    sections.push({
      id: "overview",
      text: "Overview",
      html: introHtml,
      items: [],
    });
  }

  return { toc, sections };
}

function groupSections(page, parsed) {
  if (!page.tabGroups || !page.tabGroups.length) return parsed;

  const groups = [];
  let currentGroup = null;
  let groupIndex = 0;

  for (const section of parsed.sections) {
    const nextGroup = page.tabGroups[groupIndex];
    if (nextGroup && section.text === nextGroup.from) {
      currentGroup = {
        id: slugify(nextGroup.title, new Map()),
        text: nextGroup.title,
        html: [],
        items: [],
        sourceSections: [],
      };
      groups.push(currentGroup);
      groupIndex += 1;
    }

    if (!currentGroup) {
      currentGroup = {
        id: slugify(page.tabGroups[0].title, new Map()),
        text: page.tabGroups[0].title,
        html: [],
        items: [],
        sourceSections: [],
      };
      groups.push(currentGroup);
    }

    currentGroup.html.push(...section.html);
    currentGroup.items.push(...section.items);
    currentGroup.sourceSections.push({ id: section.id, text: section.text });
  }

  return { ...parsed, sections: groups };
}

function renderTabs(page, parsed) {
  const configuredIndex = page.defaultTab
    ? parsed.sections.findIndex((section) => section.text === page.defaultTab)
    : 0;
  const activeIndex = configuredIndex >= 0 ? configuredIndex : 0;
  const navItems = parsed.sections
    .map((section, index) => {
      const active = index === activeIndex ? " active" : "";
      const selected = index === activeIndex ? "true" : "false";
      const hidden = index === activeIndex ? "" : " hidden";
      const sourceSections = section.sourceSections && section.sourceSections.length
        ? section.sourceSections
        : [{ id: section.id, text: section.text }];
      const groupedItems = new Map(sourceSections.map((source) => [source.id, []]));
      for (const item of section.items || []) {
        const parentId = item.parentId && groupedItems.has(item.parentId) ? item.parentId : sourceSections[0].id;
        groupedItems.get(parentId).push(item);
      }
      const linkCount = sourceSections.length + (section.items || []).length;
      const outline = sourceSections
        .map((source) => {
          const items = groupedItems.get(source.id) || [];
          const itemLinks = items
            .map((item) => `<a class="subnav-link subnav-link-minor" href="#${item.id}">${inlineMarkdown(item.text)}</a>`)
            .join("");
          return `<div class="subnav-group"><a class="subnav-link subnav-link-major" href="#${source.id}">${inlineMarkdown(source.text)}</a>${itemLinks}</div>`;
        })
        .join("");
      const buttonContent = page.pythonReaderStyle
        ? `<span class="nav-number">${index + 1}</span><span class="nav-label">${inlineMarkdown(section.text)}</span>`
        : inlineMarkdown(section.text);
      const button = `<button type="button" class="tab-btn${active}" id="tab-${section.id}" role="tab" aria-selected="${selected}" aria-controls="panel-${section.id}" data-tab="${section.id}" title="${escapeHtml(section.text)}">${buttonContent}</button>`;
      const subnav = page.parentNavOnly
        ? ""
        : `<div class="subnav${active}" id="subnav-${section.id}" data-subnav="${section.id}"${hidden}><div class="subnav-title">In This Tab <span>${linkCount}</span></div><div class="subnav-links">${outline}</div></div>`;
      return `<div class="nav-item${active}" data-nav-item="${section.id}" role="presentation">${button}${subnav}</div>`;
    })
    .join("\n");

  const panels = parsed.sections
    .map((section, index) => {
      const active = index === activeIndex ? " active" : "";
      const hidden = index === activeIndex ? "" : " hidden";
      const nextSection = parsed.sections[index + 1];
      const inlineNext = page.inlineNextButton
        ? `<div class="page-end-nav"><button type="button" class="page-next-btn"${nextSection ? ` data-next-section="${nextSection.id}"` : " disabled"}>Next →</button></div>`
        : "";
      return `<section class="tab-panel${active}" id="panel-${section.id}" role="tabpanel" aria-labelledby="tab-${section.id}" data-section-id="${section.id}"${hidden}>${section.html.join("\n")}${inlineNext}</section>`;
    })
    .join("\n");

  return { navItems, panels };
}

function template(page, parsed) {
  const { navItems, panels } = renderTabs(page, parsed);
  const activeIndex = Math.max(0, parsed.sections.findIndex((section) => section.text === page.defaultTab));
  const activeTitle = parsed.sections[activeIndex]?.text || parsed.sections[0]?.text || page.title;
  const bodyClasses = [page.pythonReaderStyle ? "python-reader" : "", page.collapsibleSidebar ? "collapsible-sidebar" : ""].filter(Boolean);
  const readerClass = bodyClasses.length ? ` class="${bodyClasses.join(" ")}"` : "";
  const assetPrefix = page.assetPrefix || "";
  const homeHref = page.homeHref || "index.html";
  const logoHref = page.logo ? `<link rel="icon" type="image/svg+xml" href="${escapeHtml(page.logo)}"/>` : "";
  const logoMarkup = page.logo
    ? `<img src="${escapeHtml(page.logo)}" alt="${escapeHtml(page.logoAlt || page.title + " logo")}"/>`
    : "PREP";
  const readerMarkup = page.pythonReaderStyle
    ? `<div class="reader-app">
  <aside class="toc" aria-label="Chapter navigation">
    <div class="sidebar-header">
      <a class="brand" href="${escapeHtml(homeHref)}"><div class="mark">${logoMarkup}</div><div><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.eyebrow)}</p></div></a>
      <button type="button" class="collapse-btn" id="collapse-btn" aria-label="Collapse sidebar" title="Collapse sidebar">‹</button>
    </div>
    <div class="nav-heading"><h2>${escapeHtml(page.navTitle || "Chapters")}</h2><span>${parsed.sections.length}</span></div>
    <div class="tab-list" role="tablist" aria-orientation="vertical">${navItems}</div>
    <div class="sidebar-footer">
      <button type="button" class="icon-btn" id="theme-btn" aria-label="Toggle light and dark theme" title="Toggle theme">☀</button>
      <a class="icon-btn home-link" href="${escapeHtml(homeHref)}" aria-label="Back to home" title="Home">⌂</a>
    </div>
  </aside>
  <main class="reader-main">
    <header class="chapter-header">
      <div class="chapter-title-wrap">
        <span class="chapter-kicker" id="chapter-kicker">CHAPTER ${activeIndex + 1} OF ${parsed.sections.length}</span>
        <h1 class="chapter-title" id="chapter-title">${escapeHtml(activeTitle)}</h1>
      </div>
      <a class="header-home" href="${escapeHtml(homeHref)}">Home</a>
    </header>
    <section class="content" id="content-viewport">${panels}</section>
    <footer class="chapter-footer">
      <button type="button" class="chapter-btn chapter-btn-outline" id="prev-btn"${activeIndex === 0 ? " disabled" : ""}>← Previous</button>
      <button type="button" class="chapter-btn" id="next-btn"${activeIndex === parsed.sections.length - 1 ? " disabled" : ""}>Next →</button>
    </footer>
  </main>
</div>`
    : `<div class="shell">
  <header class="topbar">
    <div class="brand"><div class="mark">${logoMarkup}</div><div><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.eyebrow)}</p></div></div>
    <a class="home" href="${escapeHtml(homeHref)}">Home</a>
  </header>
  <div class="layout">
    <nav class="toc${page.collapsibleSidebar ? " collapsed" : ""}" aria-label="Section tabs"><div class="generic-nav-header"><h2>${escapeHtml(page.navTitle || "Section Tabs")}</h2>${page.collapsibleSidebar ? '<button type="button" class="collapse-btn" id="collapse-btn" aria-label="Expand sidebar" title="Expand sidebar">›</button>' : ""}</div><div class="tab-list" role="tablist" aria-orientation="vertical">${navItems}</div></nav>
    <main class="content">${panels}</main>
  </div>
</div>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(page.title)}</title>
${logoHref}
<link rel="stylesheet" href="${escapeHtml(assetPrefix)}how_assets_small/vendor/katex/katex.min.css"/>
<style>
:root{color-scheme:dark;--bg:#071018;--panel:#0e1726;--panel2:#111c2d;--text:#edf5ff;--muted:#9fb2ca;--line:rgba(148,163,184,.24);--cyan:#67e8f9;--green:#86efac;--amber:#fcd34d;--rose:#fda4af;--blue:#93c5fd;--shadow:0 24px 70px rgba(0,0,0,.34)}
.collapsible-sidebar .layout{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start}.collapsible-sidebar .toc{position:sticky;top:10px;width:250px;max-height:calc(100vh - 20px);margin-bottom:0;transition:width .22s ease}.collapsible-sidebar .generic-nav-header{display:flex;align-items:center;justify-content:space-between;gap:8px}.collapsible-sidebar .generic-nav-header h2{margin:0}.collapsible-sidebar .collapse-btn{flex:0 0 30px;width:30px;height:30px;border:1px solid var(--line);border-radius:7px;background:rgba(15,23,42,.72);color:var(--text);font-size:24px;line-height:1;cursor:pointer}.collapsible-sidebar .toc.collapsed{width:52px;padding:8px 10px}.collapsible-sidebar .toc.collapsed .generic-nav-header{justify-content:center}.collapsible-sidebar .toc.collapsed .generic-nav-header h2,.collapsible-sidebar .toc.collapsed .tab-list{display:none}.collapsible-sidebar .toc.collapsed .collapse-btn{transform:none}.collapsible-sidebar .content{min-width:0}
.page-end-nav{display:flex;justify-content:flex-end;margin:28px 0 4px;padding-top:18px;border-top:1px solid var(--line)}.page-next-btn{border:1px solid rgba(103,232,249,.5);border-radius:9px;padding:10px 20px;background:linear-gradient(135deg,rgba(103,232,249,.24),rgba(134,239,172,.18));color:#f8fafc;font:800 13px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer}.page-next-btn:hover:not(:disabled){border-color:var(--green);transform:translateY(-1px)}.page-next-btn:disabled{opacity:.35;cursor:not-allowed}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text);background:linear-gradient(135deg,#071018,#0b1020 54%,#081522);overflow-x:hidden}a{color:inherit;text-decoration:none}.shell{width:min(1520px,calc(100% - 24px));margin:0 auto;padding:10px 0 18px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.brand{display:flex;align-items:center;gap:9px}.mark{flex:0 0 36px;width:36px;height:36px;border-radius:9px;display:block;background:#07111f;border:1px solid rgba(148,163,184,.24);overflow:hidden}.mark img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:cover}.brand h1{margin:0;font-size:21px;line-height:1.1}.brand p{margin:2px 0 0;color:var(--muted);font-size:12px}.home{border:1px solid var(--line);border-radius:999px;padding:6px 9px;background:rgba(15,23,42,.74);font-size:12px;font-weight:800}.toc,.content{border:1px solid var(--line);background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(15,23,42,.72));border-radius:11px}.layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:10px}.toc{position:sticky;top:10px;max-height:calc(100vh - 20px);overflow:auto;padding:8px;box-shadow:none}.toc h2{margin:0 0 7px;font-size:12px;color:#fff}.tab-list{display:flex;flex-direction:column;gap:5px}.nav-item{display:flex;flex-direction:column;gap:3px}.tab-btn{display:block;width:100%;border:1px solid rgba(148,163,184,.16);border-radius:7px;padding:6px 7px;background:rgba(2,6,23,.18);color:#dbe7f7;text-align:left;font:750 11.5px/1.28 Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer;overflow-wrap:anywhere}.tab-btn:hover{background:#1a2740}.tab-btn.active{border-color:rgba(103,232,249,.62);background:linear-gradient(135deg,rgba(103,232,249,.18),rgba(134,239,172,.10));color:#fff}.subnav{margin:0 0 4px 0;border-left:1px solid rgba(103,232,249,.28);padding:3px 0 3px 7px}.subnav[hidden]{display:none!important}.subnav-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;color:#f8fbff;font-size:11px;font-weight:900}.subnav-title span{color:#9fb2ca;font-size:10.5px;font-weight:800}.subnav-links{display:flex;flex-direction:column;gap:2px;max-height:52vh;overflow:auto;padding-right:2px}.subnav-group{display:flex;flex-direction:column;gap:1px}.subnav-link{display:block;border-radius:6px;color:#cbd5e1;line-height:1.25;overflow-wrap:anywhere}.subnav-link:hover{background:rgba(103,232,249,.10);color:#fff}.subnav-link-major{padding:4px 6px;font-size:11px;font-weight:850;color:#e0f2fe;border-left:2px solid rgba(103,232,249,.46)}.subnav-link-minor{margin-left:6px;padding:3px 6px 3px 8px;font-size:10.5px;color:#9fb2ca;border-left:1px solid rgba(148,163,184,.18)}.subnav-link-minor.active-anchor{background:rgba(134,239,172,.10);color:#dcfce7;border-left-color:rgba(134,239,172,.75)}.content{min-width:0;padding:14px 18px;box-shadow:none}.tab-panel{content-visibility:auto;contain:layout style;contain-intrinsic-size:1200px}.tab-panel[hidden]{display:none!important}.tab-panel h1{display:none}.tab-panel h2{font-size:21px;margin:8px 0 8px;padding-bottom:5px;border-bottom:1px solid rgba(148,163,184,.25);color:#f8fbff;scroll-margin-top:10px}.tab-panel h3{font-size:16.5px;margin:14px 0 6px;color:var(--cyan);border-left:3px solid rgba(103,232,249,.78);padding:5px 0 5px 9px;background:linear-gradient(90deg,rgba(103,232,249,.09),transparent 72%);border-radius:7px;scroll-margin-top:10px}.tab-panel h4{font-size:14.5px;color:var(--green);margin:11px 0 5px;scroll-margin-top:10px}.anchor{opacity:0;margin-left:6px;color:var(--muted);font-size:.8em}.tab-panel h2:hover .anchor,.tab-panel h3:hover .anchor{opacity:1}p{line-height:1.62;margin:7px 0;color:#e8eefb;overflow-wrap:anywhere}strong{color:#fde68a}em{color:#bfdbfe;font-style:normal}code{font:12px/1.4 "JetBrains Mono","Cascadia Code",Consolas,monospace;color:#dcfce7;background:#07111d;border:1px solid rgba(148,163,184,.24);border-radius:6px;padding:1px 5px;white-space:normal;overflow-wrap:anywhere}.content a{color:#7dd3fc;border-bottom:1px solid rgba(125,211,252,.35);font-weight:750}.content a:hover{color:#bbf7d0;border-bottom-color:rgba(187,247,208,.60)}.compact-list{margin:5px 0;color:#dbe7f7;line-height:1.55}.compact-list .dot{color:var(--green);font-weight:900}ul,ol{margin:7px 0;padding:8px 13px 8px 26px;border:1px solid rgba(148,163,184,.13);border-radius:9px;background:rgba(2,6,23,.18)}li{margin:4px 0;line-height:1.55;overflow-wrap:anywhere}li::marker{color:var(--green);font-weight:900}blockquote{border-left:3px solid rgba(252,211,77,.82);margin:8px 0;padding:5px 10px;color:#fff7ed;background:linear-gradient(90deg,rgba(252,211,77,.08),rgba(103,232,249,.025));border-radius:0 8px 8px 0}hr{height:1px;border:0;margin:14px 0;background:linear-gradient(90deg,transparent,rgba(103,232,249,.34),rgba(134,239,172,.24),transparent)}.math-display{margin:9px 0;padding:11px 13px;border:1px solid rgba(125,211,252,.24);border-left:3px solid rgba(125,211,252,.78);border-radius:10px;background:linear-gradient(90deg,rgba(8,47,73,.34),rgba(2,6,23,.22));overflow:auto;color:#eef8ff}.math-inline{display:inline-block;max-width:100%;vertical-align:-.08em;color:#e0f2fe}.math-render-error{font:12px/1.45 "JetBrains Mono","Cascadia Code",Consolas,monospace;color:#fecaca}.katex{font-size:1.04em;color:inherit}.math-display .katex-display{margin:0;text-align:left}.math-display .katex{font-size:1.12em}.code-shell{margin:9px 0;border:1px solid rgba(125,211,252,.26);border-radius:10px;overflow:hidden;background:#07111d}.code-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 9px;border-bottom:1px solid rgba(148,163,184,.18);background:linear-gradient(90deg,#102033,#13261d);color:#d1fae5;font-size:11px;font-weight:800}.copy-btn{border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.8);color:#e5eefb;border-radius:999px;padding:3px 7px;cursor:pointer;font-size:10.5px}pre{margin:0;padding:11px;overflow:auto;max-width:100%;font:12px/1.5 "JetBrains Mono","Cascadia Code",Consolas,monospace;color:#dce7f8;tab-size:4}pre code{padding:0;border:0;background:transparent;color:inherit;font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}pre code.hljs{display:block;overflow:visible;background:transparent;color:#dce7f8}.hljs-keyword,.hljs-selector-tag,.hljs-literal,.pseudo-key{color:#7dd3fc;font-weight:800}.hljs-built_in,.hljs-type,.hljs-title.class_,.pseudo-fn{color:#86efac}.hljs-title,.hljs-title.function_,.hljs-function{color:#fcd34d}.hljs-string,.hljs-regexp,.hljs-symbol,.hljs-bullet{color:#bef264}.hljs-number,.pseudo-num{color:#fda4af}.hljs-comment,.hljs-quote{color:#8ea3b8;font-style:italic}.hljs-attr,.hljs-attribute,.hljs-variable,.hljs-template-variable,.pseudo-shape{color:#c4b5fd}.hljs-meta,.hljs-doctag{color:#fdba74}.hljs-tag,.hljs-name,.hljs-selector-id,.hljs-selector-class{color:#67e8f9}.hljs-operator,.hljs-punctuation,.pseudo-op{color:#93c5fd}.plain-code-highlight .pseudo-comment{color:#8ea3b8;font-style:italic}.footer{color:var(--muted);font-size:11px;text-align:center;margin-top:10px}.table-wrap{margin:10px 0;border:1px solid rgba(125,211,252,.22);border-radius:10px;overflow:auto;background:rgba(2,6,23,.24);max-width:100%}table{width:100%;border-collapse:collapse;min-width:680px;font-size:12px;line-height:1.48;color:#e8eefb}th,td{border-bottom:1px solid rgba(148,163,184,.16);border-right:1px solid rgba(148,163,184,.10);padding:8px 9px;vertical-align:top;overflow-wrap:anywhere}th:last-child,td:last-child{border-right:0}tr:last-child td{border-bottom:0}th{position:sticky;top:0;background:linear-gradient(180deg,rgba(15,35,54,.98),rgba(15,23,42,.98));color:#f8fbff;font-weight:900;text-align:left}td{background:rgba(15,23,42,.30)}tbody tr:nth-child(even) td{background:rgba(15,23,42,.48)}@media(max-width:980px){.layout{display:block}.toc{position:static;max-height:390px;margin-bottom:10px}.topbar{align-items:flex-start}.tab-list{display:flex;flex-direction:column;gap:5px}.subnav-links{max-height:220px}}@media(max-width:640px){.shell{width:min(100% - 14px,1520px)}.content{padding:11px}.brand h1{font-size:18px}.brand p{font-size:11px}.tab-panel h2{font-size:19px}.tab-panel h3{font-size:16px}table{min-width:600px;font-size:11.5px}th,td{padding:7px 8px}pre{font-size:11.5px;padding:9px}}
.python-reader{--bg:#090d16;--panel:#0f172a;--panel2:#1e293b;--text:#f8fafc;--muted:#94a3b8;--line:rgba(255,255,255,.08);--cyan:#a78bfa;--green:#ec4899;--amber:#f9a8d4;--rose:#fda4af;--blue:#c4b5fd;--accent:#8b5cf6;--accent2:#ec4899;background:var(--bg);height:100vh;overflow:hidden;color:var(--text);transition:background-color .25s,color .25s}.python-reader.light-theme{--bg:#f8fafc;--panel:#fff;--panel2:#f1f5f9;--text:#0f172a;--muted:#475569;--line:rgba(0,0,0,.08);--cyan:#7c3aed;--green:#be185d;--amber:#a16207;--rose:#be123c;--blue:#6d28d9}.reader-app{display:flex;height:100vh;overflow:hidden}.python-reader .toc{position:static;top:auto;width:248px;max-height:none;height:100%;padding:0;border:0;border-right:1px solid var(--line);border-radius:0;background:var(--panel);display:flex;flex-direction:column;overflow:hidden;flex:0 0 248px;transition:width .25s,flex-basis .25s,background-color .25s,border-color .25s}.python-reader .toc.collapsed{width:58px;flex-basis:58px}.python-reader .sidebar-header{padding:14px;min-height:68px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px}.python-reader .brand{min-width:0;overflow:hidden}.python-reader .mark{width:38px;height:38px;flex-basis:38px;border:0;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent2))}.python-reader .brand h1{font-size:13px;line-height:1.25;background:linear-gradient(135deg,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.python-reader .brand p{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:165px}.collapse-btn{flex:0 0 30px;width:30px;height:30px;border:0;border-radius:7px;background:transparent;color:var(--muted);font-size:25px;line-height:1;cursor:pointer;transition:transform .25s,background-color .15s,color .15s}.collapse-btn:hover{background:var(--panel2);color:var(--text)}.python-reader .toc.collapsed .sidebar-header{padding:20px 10px;justify-content:center}.python-reader .toc.collapsed .brand{display:none}.python-reader .toc.collapsed .collapse-btn{transform:rotate(180deg)}.nav-heading{padding:14px 14px 6px;display:flex;align-items:center;justify-content:space-between}.python-reader .toc h2{margin:0;color:var(--muted);font-size:11px;letter-spacing:.12em;text-transform:uppercase}.nav-heading span{display:grid;place-items:center;min-width:25px;height:21px;padding:0 7px;border-radius:999px;background:var(--panel2);color:var(--muted);font-size:10px;font-weight:800}.python-reader .toc.collapsed .nav-heading{padding:14px 0 6px;justify-content:center}.python-reader .toc.collapsed .nav-heading h2{display:none}.python-reader .tab-list{display:flex;flex-direction:column;gap:0;overflow-y:auto;padding:6px 0 12px;flex:1}.python-reader .nav-item{display:block}.python-reader .tab-btn{border:0;border-left:3px solid transparent;border-radius:0;padding:10px 14px;background:transparent;color:var(--muted);font:500 13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif;transition:background-color .15s,color .15s,border-color .15s}.nav-number{display:none}.nav-label{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.python-reader .toc.collapsed .tab-btn{height:46px;padding:0;border-left-width:3px;display:flex;align-items:center;justify-content:center}.python-reader .toc.collapsed .nav-label{display:none}.python-reader .toc.collapsed .nav-number{display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:var(--panel2);font-size:11px;font-weight:800}.python-reader .toc.collapsed .tab-btn.active .nav-number{background:rgba(139,92,246,.18);color:#c4b5fd}.python-reader .tab-btn:hover{background:rgba(255,255,255,.025);color:var(--text)}.python-reader.light-theme .tab-btn:hover{background:rgba(0,0,0,.025)}.python-reader .tab-btn.active{border-left-color:var(--accent);background:rgba(139,92,246,.09);color:#a78bfa;font-weight:700}.python-reader.light-theme .tab-btn.active{color:#7c3aed;background:rgba(139,92,246,.055)}.python-reader .sidebar-footer{padding:12px 14px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.python-reader .toc.collapsed .sidebar-footer{padding:12px 0;flex-direction:column;gap:8px}.icon-btn{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--muted);font-size:18px;cursor:pointer}.icon-btn:hover{background:var(--panel2);color:var(--text)}.home-link{font-size:21px}.reader-main{min-width:0;flex:1;height:100%;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;transition:background-color .25s}.chapter-header{flex:0 0 auto;padding:18px 40px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:24px;background:var(--panel)}.chapter-title-wrap{min-width:0}.chapter-kicker{display:block;margin-bottom:4px;color:var(--muted);font-size:11px;letter-spacing:.08em}.chapter-title{margin:0;font-size:21px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.header-home{padding:8px 14px;border:1px solid var(--line);border-radius:8px;font-size:12px;font-weight:700}.header-home:hover{background:var(--panel2)}.python-reader .content{flex:1;min-height:0;overflow-y:auto;padding:38px 54px;border:0;border-radius:0;background:var(--bg)}.python-reader .tab-panel{max-width:1080px;margin:0 auto;font-size:15px;line-height:1.75;content-visibility:auto;contain:layout style;contain-intrinsic-size:1200px}.python-reader .tab-panel h2{margin:1.8em 0 .75em;padding-bottom:9px;border-bottom:1px solid var(--line);color:var(--text);font-size:24px;letter-spacing:-.015em}.python-reader .tab-panel h2:first-of-type{margin-top:0}.python-reader .tab-panel h3{margin:1.55em 0 .55em;padding:0;border:0;background:none;color:var(--text);font-size:19px;letter-spacing:-.01em}.python-reader .tab-panel h4{margin:1.3em 0 .45em;color:var(--cyan);font-size:16px}.python-reader p{margin:0 0 1.05em;color:var(--text);line-height:1.75}.python-reader strong{color:var(--text)}.python-reader em{color:var(--cyan)}.python-reader ul,.python-reader ol{margin:0 0 1.15em;padding:0 0 0 24px;border:0;border-radius:0;background:transparent}.python-reader li{margin:.38em 0;line-height:1.7}.python-reader li::marker{color:var(--accent)}.python-reader blockquote{margin:20px 0;padding:12px 20px;border-left:4px solid var(--accent);border-radius:0 8px 8px 0;background:rgba(139,92,246,.05);color:var(--text)}.python-reader blockquote p:last-child{margin-bottom:0}.python-reader code{color:#f472b6;background:var(--panel2);border:0;border-radius:4px;padding:3px 6px;font-size:.86em}.python-reader.light-theme code{color:#b8226b}.python-reader .code-shell{margin:20px 0;border:1px solid var(--line);border-radius:8px;background:#0d1117;box-shadow:0 4px 15px rgba(0,0,0,.15)}.python-reader .code-title{padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#94a3b8;font-size:11px;letter-spacing:.05em}.python-reader .copy-btn{border:0;border-radius:4px;padding:4px 8px;background:transparent;color:#94a3b8}.python-reader .copy-btn:hover{background:rgba(255,255,255,.06);color:#f8fafc}.python-reader pre{padding:16px;color:#dce7f8;font-size:12.5px;line-height:1.55}.python-reader pre code,.python-reader.light-theme pre code{padding:0;color:inherit;background:transparent;border:0}.python-reader .math-display{margin:20px 0;padding:16px 18px;border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:0 8px 8px 0;background:rgba(139,92,246,.045);color:var(--text)}.python-reader .math-inline{color:var(--text)}.python-reader .table-wrap{margin:22px 0;border:1px solid var(--line);border-radius:8px;background:var(--panel);box-shadow:none}.python-reader table{color:var(--text);font-size:13px}.python-reader th,.python-reader td{padding:11px 14px;border-color:var(--line);background:transparent}.python-reader th{background:var(--panel2);color:var(--text)}.python-reader tbody tr:nth-child(even) td{background:rgba(139,92,246,.025)}.python-reader .content a{color:#a78bfa;border-bottom-color:rgba(167,139,250,.35)}.python-reader.light-theme .content a{color:#7c3aed}.chapter-footer{flex:0 0 auto;padding:16px 40px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;background:var(--panel)}.chapter-btn{border:0;border-radius:8px;padding:9px 16px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(139,92,246,.2)}.chapter-btn-outline{border:1px solid var(--line);background:transparent;color:var(--text);box-shadow:none}.chapter-btn:hover{opacity:.9}.chapter-btn:disabled{opacity:.35;cursor:not-allowed}.python-reader ::-webkit-scrollbar{width:6px;height:6px}.python-reader ::-webkit-scrollbar-track{background:transparent}.python-reader ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:4px}.python-reader.light-theme ::-webkit-scrollbar-thumb{background:rgba(0,0,0,.14)}@media(max-width:900px){.reader-app{display:block;overflow:auto}.python-reader{height:auto;min-height:100vh;overflow:auto}.python-reader .toc,.python-reader .toc.collapsed{width:100%;height:auto;max-height:340px;flex-basis:auto;border-right:0;border-bottom:1px solid var(--line)}.python-reader .toc.collapsed .sidebar-header{padding:20px;justify-content:space-between}.python-reader .toc.collapsed .brand{display:flex}.python-reader .toc.collapsed .collapse-btn{transform:none}.python-reader .toc.collapsed .nav-heading{padding:14px 14px 6px;justify-content:space-between}.python-reader .toc.collapsed .nav-heading h2{display:block}.python-reader .toc.collapsed .tab-btn{height:auto;padding:12px 20px;display:block}.python-reader .toc.collapsed .nav-label{display:block}.python-reader .toc.collapsed .nav-number{display:none}.python-reader .toc.collapsed .sidebar-footer{padding:14px 20px;flex-direction:row}.python-reader .tab-list{max-height:230px}.reader-main{height:auto;min-height:100vh;overflow:visible}.python-reader .content{overflow:visible;padding:28px 22px}.chapter-header{padding:16px 22px}.chapter-footer{padding:14px 22px}.python-reader .brand p{max-width:none}}@media(max-width:560px){.python-reader .sidebar-header,.python-reader .toc.collapsed .sidebar-header{padding:14px 16px}.nav-heading,.python-reader .toc.collapsed .nav-heading{padding:12px 16px 6px}.python-reader .tab-btn,.python-reader .toc.collapsed .tab-btn{padding:10px 16px}.chapter-header{padding:14px 16px}.chapter-title{font-size:17px}.header-home{display:none}.python-reader .content{padding:24px 15px}.chapter-footer{padding:12px 15px}.python-reader .tab-panel h2{font-size:21px}.python-reader .tab-panel h3{font-size:18px}.python-reader table{font-size:12px}.python-reader pre{font-size:11.5px}}
.mermaid-figure{margin:20px 0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}.mermaid-figure figcaption{padding:8px 14px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.mermaid-figure pre.mermaid{display:flex;justify-content:center;align-items:flex-start;min-height:180px;padding:20px;overflow:auto;background:#f8fafc;color:#0f172a;white-space:pre}.mermaid-figure pre.mermaid svg{display:block;min-width:720px;max-width:none;height:auto}.mermaid-error{margin:0;padding:12px 14px;color:#fecaca;background:rgba(127,29,29,.25)}
</style>
</head>
<body${readerClass}>
${readerMarkup}
<script src="${escapeHtml(assetPrefix)}how_assets_small/vendor/katex/katex.min.js"></script>
<script src="${escapeHtml(assetPrefix)}how_assets_small/vendor/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const subnavs = Array.from(document.querySelectorAll(".subnav"));
const subnavLinks = Array.from(document.querySelectorAll(".subnav-link"));
const contentViewport = document.getElementById("content-viewport");
const chapterKicker = document.getElementById("chapter-kicker");
const chapterTitle = document.getElementById("chapter-title");
const prevButton = document.getElementById("prev-btn");
const nextButton = document.getElementById("next-btn");
const themeButton = document.getElementById("theme-btn");
const sidebar = document.querySelector(".collapsible-sidebar .toc, .python-reader .toc");
const collapseButton = document.getElementById("collapse-btn");
const sidebarStateKey = ${JSON.stringify(page.sidebarStorageKey || "interview-reader-sidebar")};
const defaultSidebarState = ${JSON.stringify(page.sidebarDefault || "expanded")};
const sectionByAnchor = new Map();
let mermaidInitialized = false;

tabPanels.forEach((panel) => {
  panel.querySelectorAll("[id]").forEach((node) => sectionByAnchor.set(node.id, panel.dataset.sectionId));
});

function activateTab(sectionId, options = {}) {
  const target = tabPanels.find((panel) => panel.dataset.sectionId === sectionId) || tabPanels[0];
  if (!target) return;

  tabPanels.forEach((panel) => {
    const active = panel === target;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });

  tabButtons.forEach((button) => {
    const active = button.dataset.tab === target.dataset.sectionId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  subnavs.forEach((nav) => {
    const active = nav.dataset.subnav === target.dataset.sectionId;
    nav.hidden = !active;
    nav.classList.toggle("active", active);
  });

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.navItem === target.dataset.sectionId);
  });

  const activeIndex = tabPanels.indexOf(target);
  const activeButton = tabButtons.find((button) => button.dataset.tab === target.dataset.sectionId);
  if (chapterKicker) chapterKicker.textContent = "CHAPTER " + (activeIndex + 1) + " OF " + tabPanels.length;
  if (chapterTitle && activeButton) {
    const label = activeButton.querySelector(".nav-label");
    chapterTitle.textContent = (label || activeButton).textContent.trim();
  }
  if (prevButton) prevButton.disabled = activeIndex <= 0;
  if (nextButton) nextButton.disabled = activeIndex >= tabPanels.length - 1;

  if (options.updateHash) {
    history.replaceState(null, "", "#" + target.dataset.sectionId);
  }
  if (options.scrollTop) {
    if (contentViewport) contentViewport.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }
  requestAnimationFrame(() => renderMermaidDiagrams(target));
}

function updateActiveAnchor(id) {
  subnavLinks.forEach((link) => {
    const href = decodeURIComponent(link.getAttribute("href") || "");
    link.classList.toggle("active-anchor", href === "#" + id);
  });
}

function activateFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const sectionId = sectionByAnchor.get(id) || id;
  activateTab(sectionId);
  updateActiveAnchor(id);
  const anchor = document.getElementById(id);
  if (anchor) requestAnimationFrame(() => anchor.scrollIntoView({ block: "start" }));
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab, { updateHash: true, scrollTop: true }));
});

document.querySelectorAll(".page-next-btn[data-next-section]").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.nextSection, { updateHash: true, scrollTop: true }));
});

if (prevButton) {
  prevButton.addEventListener("click", () => {
    const index = tabPanels.findIndex((panel) => !panel.hidden);
    if (index > 0) activateTab(tabPanels[index - 1].dataset.sectionId, { updateHash: true, scrollTop: true });
  });
}

if (nextButton) {
  nextButton.addEventListener("click", () => {
    const index = tabPanels.findIndex((panel) => !panel.hidden);
    if (index >= 0 && index < tabPanels.length - 1) activateTab(tabPanels[index + 1].dataset.sectionId, { updateHash: true, scrollTop: true });
  });
}

if (themeButton) {
  const savedTheme = localStorage.getItem("interview-reader-theme");
  if (savedTheme === "light") document.body.classList.add("light-theme");
  const syncThemeButton = () => {
    const light = document.body.classList.contains("light-theme");
    themeButton.textContent = light ? "☾" : "☀";
    themeButton.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
  };
  syncThemeButton();
  themeButton.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    localStorage.setItem("interview-reader-theme", document.body.classList.contains("light-theme") ? "light" : "dark");
    syncThemeButton();
  });
}

if (sidebar && collapseButton) {
  const syncCollapseButton = () => {
    const collapsed = sidebar.classList.contains("collapsed");
    collapseButton.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    collapseButton.setAttribute("title", collapsed ? "Expand sidebar" : "Collapse sidebar");
    if (document.body.classList.contains("collapsible-sidebar")) collapseButton.textContent = collapsed ? "›" : "‹";
  };
  const savedSidebarState = localStorage.getItem(sidebarStateKey);
  if (savedSidebarState === "collapsed" || (!savedSidebarState && defaultSidebarState === "collapsed")) {
    sidebar.classList.add("collapsed");
  } else {
    sidebar.classList.remove("collapsed");
  }
  syncCollapseButton();
  collapseButton.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    localStorage.setItem(sidebarStateKey, sidebar.classList.contains("collapsed") ? "collapsed" : "expanded");
    syncCollapseButton();
  });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const id = decodeURIComponent(link.getAttribute("href").slice(1));
  const sectionId = sectionByAnchor.get(id);
  if (!sectionId) return;
  event.preventDefault();
  activateTab(sectionId);
  updateActiveAnchor(id);
  history.replaceState(null, "", "#" + id);
  const anchor = document.getElementById(id);
  if (anchor) requestAnimationFrame(() => anchor.scrollIntoView({ block: "start", behavior: "smooth" }));
});

window.addEventListener("hashchange", activateFromHash);
activateFromHash();

function normalizeMathLine(line) {
  const bs = String.fromCharCode(92);
  let tex = line.trim();
  tex = tex.replace(/\\s+#.*$/, "");
  tex = tex.replace(/->/g, bs + "to");
  tex = tex.replace(/≤/g, bs + "le ").replace(/≥/g, bs + "ge ").replace(/≠/g, bs + "ne ");
  tex = tex.replace(/\\bsqrt\\s*\\(([^()]+)\\)/gi, (_, inner) => bs + "sqrt{" + inner + "}");
  tex = tex.replace(/\\b(softmax|sigmoid|logits|argmax|argmin|mean|variance|covariance|max|min|exp|log|sin|cos|KL|JS|ELBO|MSE|BCE)\\s*\\(/gi, (_, name) => bs + "operatorname{" + name + "}(");
  ["alpha", "beta", "gamma", "delta", "epsilon", "lambda", "mu", "pi", "sigma", "theta"].forEach((name) => {
    tex = tex.replace(new RegExp("\\\\b" + name + "\\\\b", "gi"), bs + name);
  });
  tex = tex.replace(/\\b([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)\\b/g, (token) => {
    const parts = token.split("_");
    return parts[0] + "_{" + parts.slice(1).join(",") + "}";
  });
  tex = tex.replace(/\\^\\((-?\\d+)\\)/g, "^{$1}");
  tex = tex.replace(/\\^(-?\\d+|[A-Za-z]+)/g, "^{$1}");
  tex = tex.replace(/\\*\\*/g, bs + "cdot ");
  tex = tex.replace(/(?<![A-Za-z])\\*(?![A-Za-z])/g, bs + "cdot ");
  return tex;
}

function normalizeMathSource(source, displayMode) {
  const lines = String(source).split(/\\n+/).map((line) => line.trim()).filter(Boolean).map(normalizeMathLine);
  if (displayMode && lines.length > 1) {
    return bsBeginAligned() + lines.map((line) => line.includes("=") ? line.replace("=", "&=") : line).join(" " + String.fromCharCode(92) + String.fromCharCode(92) + " ") + bsEndAligned();
  }
  return lines.join(" " + String.fromCharCode(92) + String.fromCharCode(92) + " ");
}

function bsBeginAligned() {
  const bs = String.fromCharCode(92);
  return bs + "begin{aligned}";
}

function bsEndAligned() {
  const bs = String.fromCharCode(92);
  return bs + "end{aligned}";
}

function renderMath() {
  if (!window.katex) return;
  document.querySelectorAll(".math-inline, .math-display").forEach((node) => {
    const displayMode = node.classList.contains("math-display");
    const source = node.dataset.tex || node.textContent || "";
    const tex = node.dataset.explicitMath === "true"
      ? source.split(/\\n+/).map((line) => line.trim()).filter(Boolean).join(" ")
      : normalizeMathSource(source, displayMode);
    try {
      window.katex.render(tex, node, { throwOnError: false, displayMode, strict: "ignore", trust: false });
      node.dataset.renderedTex = tex;
    } catch (error) {
      node.classList.add("math-render-error");
      node.textContent = source;
    }
  });
}

renderMath();

async function renderMermaidDiagrams(root = document) {
  if (!window.mermaid) {
    const diagrams = Array.from(root.querySelectorAll('pre.mermaid:not([data-rendered="true"]):not([data-rendering="true"])'));
    diagrams.forEach((node) => {
      const error = node.parentElement.querySelector(".mermaid-error");
      if (error) error.hidden = false;
    });
    return;
  }
  if (!mermaidInitialized) {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "neutral",
      flowchart: { htmlLabels: false, useMaxWidth: false },
    });
    mermaidInitialized = true;
  }
  const diagrams = Array.from(root.querySelectorAll('pre.mermaid:not([data-rendered="true"]):not([data-rendering="true"])'));
  if (!diagrams.length) return;
  for (const node of diagrams) {
    node.dataset.rendering = "true";
    try {
      await window.mermaid.run({ nodes: [node] });
      node.dataset.rendered = "true";
    } catch (error) {
      node.dataset.rendered = "false";
      const message = node.parentElement.querySelector(".mermaid-error");
      if (message) message.hidden = false;
      console.error("Mermaid render failed", error);
    } finally {
      delete node.dataset.rendering;
    }
  }
}

renderMermaidDiagrams(document.querySelector(".tab-panel:not([hidden])") || document);

function escapeCodeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function colorizePlainSegment(segment) {
  const tokenPattern = /("([^"\\\\]|\\\\.)*"|'([^'\\\\]|\\\\.)*')|(\\[[^\\]\\n]+\\])|(\\b\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b)|(\\b[A-Za-z_][A-Za-z0-9_']*(?=\\s*\\())|(\\b(?:if|else|for|while|return|class|def|import|from|with|as|try|except|raise|assert|input|output|given|goal|forward|backward|update|repeat|initialize|sample|argmax|softmax|logits|loss|grad|gradient|mean|variance|covariance|theta|alpha|beta|gamma|lambda|sigma|mu|pi|KL|ELBO|SGD|Adam|AdamW|RoPE|DDPM|DDIM|SDE|ODE|Q|K|V|P|R)\\b)|([=+\\-*/@<>:(),.^|]+)/gi;
  let html = "";
  let lastIndex = 0;
  segment.replace(tokenPattern, (match, stringToken, _dq, _sq, shapeToken, numberToken, functionToken, keywordToken, operatorToken, offset) => {
    html += escapeCodeHtml(segment.slice(lastIndex, offset));
    const className = stringToken ? "hljs-string" : shapeToken ? "pseudo-shape" : numberToken ? "pseudo-num" : functionToken ? "pseudo-fn" : keywordToken ? "pseudo-key" : operatorToken ? "pseudo-op" : "";
    html += className ? '<span class="' + className + '">' + escapeCodeHtml(match) + '</span>' : escapeCodeHtml(match);
    lastIndex = offset + match.length;
    return match;
  });
  return html + escapeCodeHtml(segment.slice(lastIndex));
}

function colorizePlainCode(block) {
  const lines = block.textContent.split("\\n").map((line) => {
    const commentIndex = line.indexOf("#");
    if (commentIndex === -1) return colorizePlainSegment(line);
    const codePart = line.slice(0, commentIndex);
    const commentPart = line.slice(commentIndex);
    return colorizePlainSegment(codePart) + '<span class="pseudo-comment">' + escapeCodeHtml(commentPart) + '</span>';
  });
  block.innerHTML = lines.join("\\n");
  block.classList.add("hljs", "plain-code-highlight");
}

document.querySelectorAll("pre code").forEach((block) => {
  const languageClass = Array.from(block.classList).find((name) => name.startsWith("language-"));
  const language = languageClass ? languageClass.replace("language-", "").toLowerCase() : "";
  if (language === "text" || language === "txt" || !window.hljs || !window.hljs.getLanguage(language)) {
    colorizePlainCode(block);
    return;
  }
  window.hljs.highlightElement(block);
});

document.querySelectorAll(".copy-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const code = button.closest(".code-shell").querySelector("code").innerText;
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
      setTimeout(() => button.textContent = "Copy", 1200);
    } catch {
      button.textContent = "Copy failed";
      setTimeout(() => button.textContent = "Copy", 1200);
    }
  });
});
</script>
</body>
</html>`;
}

const requestedPage = process.argv[2] ? process.argv[2].toLowerCase() : "";
const selectedPages = requestedPage
  ? pages.filter((page) => [page.input, page.output, path.parse(page.input).name, path.parse(page.output).name]
      .some((value) => String(value).toLowerCase() === requestedPage))
  : pages;

if (requestedPage && !selectedPages.length) {
  console.error(`Unknown page: ${requestedPage}`);
  process.exitCode = 1;
}

for (const page of selectedPages) {
  const inputPath = path.resolve(page.input);
  if (!fs.existsSync(inputPath)) {
    console.warn(`Skipping missing ${page.input}`);
    continue;
  }
  const sourceMarkdown = fs.readFileSync(inputPath, "utf8");
  const extraSources = (page.extraInputs || []).map((extraInput) => {
    const extraPath = path.resolve(extraInput);
    if (!fs.existsSync(extraPath)) {
      console.warn(`Skipping missing ${extraInput}`);
      return "";
    }
    return fs.readFileSync(extraPath, "utf8");
  });
  const markdown = typeof page.transformMarkdown === "function"
    ? page.transformMarkdown(sourceMarkdown, extraSources)
    : sourceMarkdown;
  const parsed = groupSections(page, parseMarkdown(markdown));
  fs.writeFileSync(path.resolve(page.output), template(page, parsed), "utf8");
  console.log(`${page.input} -> ${page.output} (${parsed.sections.length} section tabs)`);
}

