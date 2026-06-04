# 深度学习导论笔记（中文可读整理版）

> 来源：用户提供的《Introductory Lecture Notes on Deep Learning》。本整理版已删除原文的 References / 参考文献章节，只保留课程主体内容，并将内容改写为更适合中文阅读和面试复习的结构化笔记。  
> 说明：原文是英文讲义，包含大量图、公式、代码和引用。本文件不是逐字直译，而是按原文结构做中文化、可读化整理，保留主要概念、公式、模型、任务、训练方法、评估指标和工程注意点。

---

## 目录

1. 深度学习概览  
2. 线性分类与多层感知机  
3. 反向传播与学习  
4. 卷积神经网络  
5. 目标检测与图像分割  
6. 序列模型  
7. 开发、调试与诊断  
8. Transformer  
9. 对比学习  
10. 深度强化学习  
11. 生成式 AI：VAE、Flow、Diffusion  
12. 公式与概念速查

---

# 1. 深度学习概览

## 1.1 课程主题

这份讲义面向一个 12 周的深度学习入门课程，覆盖理论与实践。核心内容包括：

- 多层感知机（MLP）
- 反向传播与自动微分
- 卷积神经网络（CNN）
- 循环神经网络（RNN）
- Transformer
- 对比学习
- 强化学习
- 生成式模型：VAE、Flow、Diffusion

深度学习在现代 AI 系统中非常重要，应用包括：

- 图像和视频理解
- 自然语言处理
- 生成式 AI
- 机器人
- 医疗
- 科学发现
- 药物设计
- 自动驾驶

学习前置知识：

- 编程能力
- 线性代数
- 微积分
- 概率论

---

## 1.2 深度学习的直觉：从规则到数据

原文用“三角形”作为例子：

人看到一个不完美的三角形，即使线不直、角没有完全闭合，也会认为它是三角形。传统规则系统可能会说：因为它有三条边，所以是三角形。

但深度学习更像是：

> 它是三角形，因为它“看起来像”三角形。

同理：

- 猫是猫，因为它看起来像猫。
- 狗是狗，因为它看起来像狗。

这体现了深度学习的核心思想：  
**从数据样本中学习模式，而不是依赖人工写死的规则。**

认知科学中，这更接近“类比推理”，而不是“演绎推理”。

---

## 1.3 AI、ML、DL 的关系

可以这样理解：

```text
AI  人工智能
└── ML  机器学习
    └── DL  深度学习
```

- **AI（Artificial Intelligence）**：构建表现出智能行为的机器。
- **ML（Machine Learning）**：机器通过数据或经验提升某个任务上的表现。
- **DL（Deep Learning）**：机器学习的一个子领域，通常使用神经网络，以端到端方式学习表示和任务。

深度学习依赖的基础学科包括：

- 线性代数
- 概率论
- 微积分
- 优化
- 编程
- 算法
- 数据科学

---

## 1.4 2012 年为什么重要？

深度学习研究可以追溯到 1960 年代，但真正成为主流是在 2012 年。

关键事件：

- Stanford 团队创建了 ImageNet 数据集。
- ImageNet 包含超过一百万张带标签图片，覆盖 1000 个类别。
- 2012 年，Alex Krizhevsky、Geoffrey Hinton 等人使用深度 CNN 参加 ImageNet 挑战赛。
- 他们的模型 AlexNet 显著击败其他传统方法。
- 之后几年，ImageNet 排名前列的方法几乎全部转向深度学习。

这个事件被认为是现代深度学习复兴的分水岭。

2012 年前：

- 更强调理论、特征工程、可证明算法。
- 系统需要大量手工设计特征。

2012 年后：

- 更强调数据、算力、端到端训练。
- GPU、大规模数据集、开源框架共同推动了深度学习发展。

---

## 1.5 深度学习快速发展的原因

主要原因包括：

1. **高质量开源框架**
   - PyTorch
   - TensorFlow
   - JAX

2. **大规模数据集**
   - ImageNet
   - Web-scale text/image/video data

3. **高性能计算**
   - GPU
   - TPU
   - 分布式训练

4. **研究和工程社区快速交流**
   - 论文
   - 开源代码
   - 模型复现

5. **大语言模型和生成式 AI 的成功**
   - ChatGPT
   - Gemini
   - Claude
   - DeepSeek
   - 图像和视频生成模型

---

# 1.6 应用领域概览

## 1.6.1 计算机视觉

计算机视觉研究如何让机器理解图像和视频。

典型任务：

### 图像分类

输入一张图像，输出一个标签。

例子：

```text
image -> "cat"
image -> "dog"
image -> "airplane"
```

分类任务可以是：

- 二分类：yes/no
- 多分类：从固定类别集合中选一个

模型通常还会输出置信度。

---

### 开放词表图像分类

不是从固定类别中选标签，而是允许模型给出训练中可能没见过的新类别。

例如：

```text
这是什么物体？
```

这种任务通常需要：

- 外部知识库
- 大型视觉-语言模型
- 预训练模型

---

### 目标检测

输出多个对象，每个对象包括：

```text
类别 + 边界框
```

例如：

```text
[("person", bbox1), ("dog", bbox2)]
```

---

### 姿态估计

定位人体关节点，例如：

- 手
- 肘
- 肩
- 膝盖
- 脚踝

通常用骨架模型约束关节之间的位置关系。

---

### 文本识别

目标是定位并读取图片中的文字。

应用：

- 车牌识别
- 收据识别
- 菜单翻译
- 场景文字识别

---

### 像素级标注

不是给整张图一个标签，而是给每个像素一个标签。

典型任务：

- 语义分割
- 实例分割
- 全景分割
- 深度估计

---

### 图像编辑和生成

传统任务：

- 去噪
- 上色
- 图像修复
- 视频稳定

现代深度学习任务：

- NeRF 新视角合成
- 风格迁移
- 文本生成图像
- 文本生成视频

---

## 1.6.2 自然语言处理

NLP 研究语言的结构和含义。

主要内容：

- 词法：单词如何形成，例如 run/running/ran
- 句法：词如何组成合法句子
- 语义：词、句子、文本的含义

典型任务：

- 命名实体识别
- 词义消歧
- 信息抽取
- 语音识别
- 语音合成
- 机器翻译
- 问答
- 对话
- 摘要
- 文本生成

大语言模型把很多 NLP 任务统一到生成式建模框架中。

---

## 1.6.3 多模态任务

多模态任务结合视觉和语言。

典型任务：

### 图像描述

```text
image -> "A dog is playing in the snow."
```

### 视觉问答

```text
image + question -> answer
```

例如：

```text
问题：她的眼睛是什么颜色？
答案：蓝色。
```

### 视觉语言导航

机器人根据自然语言指令和视觉环境进行导航。

例如：

```text
走出餐厅，经过桌子尽头的门，进入厨房，在冰箱前停下。
```

### 视觉 grounding

根据文字定位图像中的对象。

例如：

```text
找到浅蓝色卡车。
```

输出可以是：

- bounding box
- segmentation mask

---

## 1.6.4 机器人与序列决策

AI 长期以来用游戏作为测试平台，例如：

- Chess
- Go
- Poker

核心问题：

- 状态表示
- 搜索
- 不确定性规划
- 策略学习
- 对手建模
- 长期信用分配

强化学习是序列决策的重要方法。

典型应用：

- 游戏 AI
- 机器人控制
- 自动驾驶
- 物流调度
- 策略规划

---

## 1.6.5 科学发现与医疗

深度学习在科学和医学中应用越来越多。

重要方向：

- 蛋白质结构预测
- 蛋白质设计
- 药物发现
- 天气预测
- 医学图像分析
- 临床决策支持
- 流体力学代理模型
- 脑机接口

---

# 1.7 机器学习的高层视角

机器学习的核心是学习一个函数：

```text
f : X -> Y
```

也就是把输入空间 X 映射到输出空间 Y。

因为无法搜索所有可能函数，所以我们定义一个参数化函数族：

```text
f(x; θ)
```

其中：

- x 是输入
- y 是目标输出
- θ 是模型参数

训练数据：

```text
D = {(x(i), y(i))}_{i=1}^N
```

目标是找到参数 θ，使模型在训练集和未见过的数据上都表现好。

---

## 1.7.1 经验风险最小化 ERM

典型目标函数：

```text
minimize_θ L(θ; D) = Σ_{(x,y)∈D} ℓ(f(x; θ), y)
```

其中：

- L 是总体损失
- ℓ 是单样本损失
- f 是模型
- θ 是参数

如果加入正则化：

```text
L(θ; D) = Σ_i ℓ(f(x(i); θ), y(i)) + λR(θ)
```

这叫正则化经验风险最小化。

常见正则项：

```text
R(θ) = 1/2 ||θ||_2^2
```

它可以抑制过拟合。

---

## 1.7.2 Encoder-Decoder 范式

深度学习中常见结构：

```text
x -> Encoder Eθ -> z -> Decoder Dϕ -> y
```

- Encoder 把输入映射到潜空间 z。
- Decoder 把潜空间映射到输出 y。
- z 通常比输入更低维，相当于压缩表示。

### Auto-encoder

输入和输出空间相同：

```text
x -> z -> x_hat
```

目标是重构输入。

### Cross-encoder / Encoder-decoder

输入和输出空间不同。

应用：

- 机器翻译
- 图像分割
- 图像描述
- 多模态联合嵌入
- 图像生成

---

# 1.8 机器学习系统的组成部分

一个机器学习系统通常包括：

1. **数据**
   - 输入信号
   - 标签
   - 数据质量
   - 数据数量

2. **数据表示**
   - 字符串
   - 整数标签
   - one-hot 向量
   - 图像 tensor
   - 视频帧序列

3. **模型架构**
   - 线性模型
   - MLP
   - CNN
   - RNN
   - Transformer

4. **训练目标**
   - 损失函数
   - 正则项
   - 先验

5. **学习算法**
   - SGD
   - Adam
   - AdamW

6. **初始化**
   - Xavier
   - Kaiming
   - 任务特定初始化

7. **评估指标**
   - accuracy
   - precision
   - recall
   - F1
   - mAP
   - NDCG 等

重要观点：

> 数据、表示、架构、目标函数和评估指标都隐含了 inductive bias，会影响模型行为。

---

# 1.9 数据表示与线性代数基础

## 1.9.1 向量、矩阵、张量

- 向量：一维数组
- 矩阵：二维数组
- 张量：任意维数组

例如：

```text
vector shape: (N,)
matrix shape: (M, N)
image tensor:
  OpenCV / numpy: (H, W, 3)
  PyTorch: (3, H, W)
batch image tensor:
  (B, 3, H, W)
```

视频可以表示为四阶张量：

```text
(3, H, W, T)
```

其中 T 是帧数。

---

## 1.9.2 转置

矩阵 A 的转置：

```text
A^T
```

表示交换行和列。

性质：

```text
(A^T)^T = A
(AB)^T = B^T A^T
(A + B)^T = A^T + B^T
```

---

## 1.9.3 特殊向量和矩阵

常见特殊对象：

- 零向量：0
- 全 1 向量：1
- one-hot 向量：e_i
- 零矩阵
- 全 1 矩阵
- 对角矩阵
- 单位矩阵 I

单位矩阵类似标量乘法中的 1：

```text
Ix = x
```

---

## 1.9.4 矩阵加法与乘法

矩阵加法是逐元素相加：

```text
C_ij = A_ij + B_ij
```

矩阵-向量乘法：

```text
y = Ax
y_i = Σ_j A_ij x_j
```

矩阵乘法：

```text
C = AB
C_ij = Σ_k A_ik B_kj
```

注意：

- 矩阵乘法一般不满足交换律。
- AB 通常不等于 BA。
- 但满足结合律和分配律。

---

## 1.9.5 内积与范数

内积：

```text
<x, y> = x^T y = Σ_i x_i y_i
```

欧几里得范数：

```text
||x||_2 = sqrt(x^T x)
```

常见范数：

```text
L1: ||x||_1 = Σ_i |x_i|
L2: ||x||_2 = sqrt(Σ_i x_i^2)
L∞: ||x||_∞ = max_i |x_i|
```

---

## 1.9.6 Batch 和 Broadcasting

深度学习框架通常按 batch 处理数据。

例如：

```text
batch of vectors: (B, N)
batch of images:  (B, 3, H, W)
```

Broadcasting 指当某些维度是 1 时，框架自动复制数据以匹配操作维度。

---

## 1.9.7 PyTorch Tensor 基本属性

PyTorch tensor 常见属性：

- shape
- dtype
- device
- requires_grad
- grad

常见操作：

```python
A = torch.tensor([[8, 5], [3, 6]])
B = A.reshape([3, 2])
C = A.transpose(0, 1)
D = A.flatten()
```

注意：

- `reshape` 改变形状。
- `transpose` 交换维度。
- `flatten` 拉平成一维。
- 数学中常从 1 开始索引，代码中常从 0 开始索引。

---

# 2. 线性分类与多层感知机

## 2.1 二分类

二分类任务中，每个样本属于两个类别之一。

训练数据：

```text
D = {(x(i), y(i))}
x(i) ∈ R^n
y(i) ∈ {0, 1}
```

正类：y = 1  
负类：y = 0

可以从两个角度理解：

1. **回归概率**
   ```text
   P(y | x)
   ```

2. **分类函数**
   ```text
   f(x) >= 0 -> positive
   f(x) < 0  -> negative
   ```

常见线性分类函数：

```text
f(x) = a^T x + b
```

其中：

- a 是权重向量
- b 是偏置
- a^T x + b = 0 是决策边界

---

## 2.2 Logistic Regression

Logistic regression 把线性函数转换成概率：

```text
P(y = 1 | x) = σ(a^T x + b)
```

Sigmoid 函数：

```text
σ(z) = 1 / (1 + exp(-z))
```

性质：

```text
σ(z) ∈ (0, 1)
σ(z) >= 0.5 当且仅当 z >= 0
```

所以分类规则：

```text
a^T x + b >= 0
```

等价于：

```text
P(y = 1 | x) >= 0.5
```

---

## 2.3 最大似然与负对数似然

训练 logistic regression 通常使用最大似然：

```text
maximize P(D)
```

实践中等价于最小化负对数似然：

```text
minimize -log P(D)
```

对于二分类，这就是 binary cross entropy。

---

## 2.4 正则化与 Weight Decay

为了减少过拟合，可以加入 L2 正则：

```text
minimize ℓ(a, b; D) + λ/2 ||a||^2
```

梯度中会出现：

```text
∇a ℓ + λa
```

更新时权重会被往 0 推，所以也叫 weight decay。

直觉：

- 正则化会让模型不那么自信。
- 决策边界附近的概率曲线会更平滑。
- 泛化通常更好。

---

## 2.5 Temperature Scaling

Temperature scaling 改变 sigmoid 的 sharpness：

```text
y = σ(z / τ)
```

- τ > 1：曲线更平缓，模型更不自信。
- τ < 1：曲线更陡，模型更自信。

这常用于校准概率输出。

---

## 2.6 Logistic Regression 作为单个神经元

一个神经元可以看成：

```text
x -> weighted sum z = a^T x + b -> activation σ(z) -> y
```

经典视角：

```text
y = σ(Σ_i a_i x_i + b)
```

现代深度学习视角：

```text
y = σ(a^T x + b)
```

---

## 2.7 XOR 问题与 MLP 动机

Logistic regression 只能处理线性可分数据。

XOR 是经典非线性问题：

```text
(0,0) -> 0
(0,1) -> 1
(1,0) -> 1
(1,1) -> 0
```

没有一条直线能分开正负样本。

但两层网络可以解决 XOR：

第一层学习中间特征：

- NAND
- OR

第二层组合它们：

- AND

这说明：

> 隐藏层可以学习新的表示，使原本线性不可分的问题在新空间中可分。

---

## 2.8 多层感知机 MLP

两层感知机：

```text
y = σ(c^T σ(Ax + b) + d)
```

其中：

- 第一层：z = σ(Ax + b)
- 第二层：y = σ(c^T z + d)

图形结构：

```text
x -> Linear(A,b) -> activation -> Linear(c,d) -> activation -> y
```

MLP 的核心是：

```text
线性变换 + 非线性激活
```

重复堆叠。

---

## 2.9 激活函数

常见激活函数：

### Sigmoid

```text
σ(z) = 1 / (1 + exp(-z))
```

输出范围：

```text
(0, 1)
```

缺点：

- 饱和区梯度很小
- 容易梯度消失

---

### Tanh

```text
tanh(z) = (exp(2z) - 1) / (exp(2z) + 1)
```

输出范围：

```text
(-1, 1)
```

比 sigmoid 更居中，但仍可能饱和。

---

### ReLU

```text
ReLU(z) = max(0, z)
```

优点：

- 简单
- 计算快
- 缓解梯度消失

缺点：

- 可能出现 dead ReLU

---

### 其他激活函数

- Leaky ReLU
- GLU
- GELU
- SELU
- sinusoidal activation

---

## 2.10 通用逼近定理

通用逼近定理说明：

> 对任意连续函数 f，在一定条件下，一个足够宽的两层网络可以任意精度逼近它。

形式：

```text
f_hat(x) = c^T σ(Ax + b) + d
```

可以逼近任意连续函数。

但这个定理有两个实践缺陷：

1. 不告诉我们需要多少参数。
2. 不告诉我们如何高效找到参数。

实践中：

- 深层网络通常比超宽浅层网络更有效。
- ReLU 虽不完全满足一些理论条件，但实际表现很好。

---

## 2.11 参数不可识别性

神经网络参数不唯一。

即：

> 不同参数组合可能产生完全相同的输入输出映射。

例如隐藏层神经元顺序可以交换，输出不变。

这说明训练出的参数本身不一定有唯一解释，重要的是函数行为。

---

## 2.12 多分类与多标签分类

### 多分类

每个样本只能属于一个类别。

```text
y ∈ {1, ..., K}
```

使用 softmax：

```text
P(y = k | x) = exp(z_k) / Σ_j exp(z_j)
```

预测类别：

```text
argmax_k z_k
```

---

### 多标签分类

每个样本可以同时属于多个类别。

```text
y ∈ {0,1}^K
```

使用 K 个 sigmoid：

```text
P(y_k = 1 | x) = sigmoid(z_k)
```

多分类和多标签区别：

```text
multi-class: softmax，类别互斥
multi-label: sigmoid，各标签独立
```

---

## 2.13 常见损失函数

### 0-1 Loss

统计分类错误：

```text
ℓ = 0 if correct
ℓ = 1 otherwise
```

不可微，不适合梯度下降。

---

### MSE

回归常用：

```text
ℓ = 1/2 ||f(x;θ) - y||^2
```

---

### NLL / Cross Entropy

分类常用：

```text
ℓ = -log P(y | x; θ)
```

对于 softmax 多分类，就是 cross entropy。

---

### Binary Cross Entropy

多标签任务中对每个标签做二分类：

```text
-Σ_k [y_k log p_k + (1-y_k) log(1-p_k)]
```

---

## 2.14 梯度下降

梯度下降更新：

```text
θ(t+1) = θ(t) - η ∇ℓ(θ(t))
```

其中：

- η 是学习率
- 梯度方向是函数上升最快方向
- 负梯度方向是下降方向

学习率影响很大：

- 太小：收敛慢
- 太大：震荡甚至发散

---

## 2.15 PyTorch 训练循环

典型训练循环：

```python
criterion = torch.nn.CrossEntropyLoss(reduction="mean")
optimizer = torch.optim.SGD(model.parameters(), lr=0.01)

for epoch in range(max_epochs):
    for inputs, labels in dataloader:
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
```

步骤：

1. 清空梯度
2. 前向传播
3. 计算损失
4. 反向传播
5. 参数更新

---

# 3. 反向传播与学习

## 3.1 深度模型作为函数复合

MLP 可以写成多个函数复合：

```text
y = (f_n ◦ ... ◦ f_2 ◦ f_1)(x)
```

每层：

```text
z_j = f_j(z_{j-1}) = σ_j(A_j z_{j-1} + b_j)
```

更一般地，深度学习模型是一个计算图：

```text
input -> node1 -> node2 -> ... -> output
```

每个节点可以是：

- 加法
- 乘法
- 矩阵乘法
- convolution
- normalization
- attention
- 任意可微操作

---

## 3.2 反向传播

反向传播就是沿着计算图反向应用链式法则。

如果：

```text
x -> f1 -> z1 -> f2 -> z2 -> f3 -> y -> L
```

那么：

```text
dL/dθ1 = dL/dy * dy/dz2 * dz2/dz1 * dz1/dθ1
```

核心思想：

> 前向计算输出，反向计算梯度。

---

## 3.3 Jacobian 与链式法则

对于向量函数：

```text
f : R^n -> R^m
```

导数是 Jacobian 矩阵：

```text
df/dx ∈ R^{m x n}
```

链式法则可以写成矩阵乘法。

在深度学习中，最终 loss 通常是标量，所以反向传播常计算：

```text
vector-Jacobian product
```

这比显式构造完整 Jacobian 更高效。

---

## 3.4 自动微分

自动微分是现代深度学习的核心。

它不是数值差分，而是基于计算图和链式法则精确计算导数。

两种模式：

### Forward Mode AD

固定一个输入变量，向前传播它对所有中间变量的导数。

适合：

- 输入维度少
- 输出维度多

### Reverse Mode AD

固定一个输出变量，从后向前计算它对所有输入/参数的导数。

适合深度学习，因为：

- loss 是标量
- 参数数量巨大

所以深度学习主要使用 reverse mode AD。

---

## 3.5 Back-propagation 的本质

Backpropagation 可以理解为：

```text
reverse-mode automatic differentiation + 缓存前向中间结果
```

每个节点需要：

### Forward

```text
y = f(x, θ)
```

### Backward

给定：

```text
dL/dy
```

计算：

```text
dL/dx
dL/dθ
```

PyTorch 中：

```python
y = f(x, theta)
L = loss(y, y_true)
L.backward()
```

---

## 3.6 为什么需要缓存中间结果？

有些梯度公式可以复用前向结果。

例如：

```text
y = 1 / sqrt(x)
dy/dx = -1/2 y^3
```

反向时如果保存了 y，就不用重新算 sqrt。

这体现了深度学习中的 memory vs compute tradeoff：

- 存中间结果：省计算，费内存
- 重算中间结果：省内存，费计算

---

## 3.7 Batch 反向传播

batch 中每个样本都有独立的输入梯度：

```text
dL/dx(i)
```

但参数梯度要对 batch 求和或平均：

```text
dL/dθ = Σ_i dL_i/dθ
```

这也是 batch training 的基本逻辑。

---

## 3.8 梯度消失与梯度爆炸

深层网络需要反复乘 Jacobian：

```text
dL/dθ = dL/dy * dy/dz2 * dz2/dz1 * dz1/dθ
```

如果连续乘很多小数，梯度趋近 0：

```text
vanishing gradient
```

如果连续乘很多大数，梯度爆炸：

```text
exploding gradient
```

容易出现在：

- 深层网络
- RNN
- sigmoid/tanh 饱和区

缓解方法：

- ReLU
- 残差连接
- BatchNorm / LayerNorm
- 合理初始化
- 梯度裁剪
- LSTM / GRU
- Transformer

---

## 3.9 训练与测试的内存差异

训练时需要：

- 前向激活
- 参数
- 梯度
- optimizer state

测试时只需要：

- 参数
- 当前前向激活

所以训练比推理消耗更多内存。

---

## 3.10 PyTorch 自定义 Autograd Function

如果 PyTorch 没有现成操作，或者为了性能/内存优化，可以实现自定义 autograd。

结构：

```python
class MyFunction(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x):
        y = ...
        ctx.save_for_backward(y)
        return y

    @staticmethod
    def backward(ctx, dLdy):
        y, = ctx.saved_tensors
        dLdx = ...
        return dLdx
```

---

## 3.11 clone 与 detach

### clone

```python
y_hat = y.clone()
```

复制 tensor 和计算图，梯度仍会回传。

### detach

```python
y_hat = y.detach()
```

共享数据，但切断计算图，不回传梯度。

### detach + clone

```python
y_hat = y.detach().clone()
```

复制数据，并切断计算图。

---

## 3.12 Iris MLP 示例

Iris 数据集：

- 150 个样本
- 3 类花
- 每个样本 4 个特征：
  - sepal length
  - sepal width
  - petal length
  - petal width

模型：

```text
4 inputs -> 8 hidden ReLU -> 3 logits
```

PyTorch Sequential 实现：

```python
model = nn.Sequential(
    nn.Linear(4, 8, bias=True),
    nn.ReLU(True),
    nn.Linear(8, 3, bias=True)
)
```

自定义 Module：

```python
class IrisMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.layer1 = nn.Linear(4, 8)
        self.layer2 = nn.ReLU(True)
        self.layer3 = nn.Linear(8, 3)

    def forward(self, x):
        z1 = self.layer1(x)
        z2 = self.layer2(z1)
        y_hat = self.layer3(z2)
        return y_hat
```

注意：CrossEntropyLoss 内部已经包含 softmax，所以模型输出 logits 即可。

---

## 3.13 参数初始化

初始化影响训练稳定性。

简单方法：

- 小方差高斯
- 小范围均匀分布
- bias 设为 0

更好的方法：

### Xavier / Glorot

适合 tanh/sigmoid：

```text
σ = sqrt(2 / (n_i + n_o))
```

### Kaiming / He

适合 ReLU：

```text
σ = sqrt(2 / n_i)
```

目标：

> 控制信号方差，避免前向激活和反向梯度爆炸/消失。

---

## 3.14 Learning Curve

训练中常画：

- training loss
- validation loss
- error rate
- accuracy

学习曲线可以帮助诊断：

- 是否收敛
- 是否过拟合
- 学习率是否合理
- 模型容量是否不足
- 数据是否有问题

---

## 3.15 SGD 与 Mini-batch

全量梯度：

```text
∇L = 1/N Σ_i ∇ℓ_i
```

Mini-batch 梯度：

```text
g = 1/|I| Σ_{i∈I} ∇ℓ_i
```

SGD 用 mini-batch 估计梯度，速度更快，但有噪声。

术语：

- iteration：一次参数更新
- epoch：完整扫过一次训练集
- batch size：每次更新使用的样本数

---

## 3.16 Train / Validation / Test

标准划分：

1. **Training set**
   - 用来更新参数

2. **Validation set**
   - 用来选择模型、调超参、early stopping

3. **Test set**
   - 最终评估泛化能力

重要原则：

> Test set 不应该参与模型选择，否则评估会偏乐观。

---

## 3.17 过拟合

当模型在训练集表现越来越好，但验证集表现变差，就是过拟合。

缓解方法：

- 正则化
- 数据增强
- early stopping
- 更多训练数据
- 预训练 + fine-tuning
- dropout
- batch normalization
- 降低模型容量

---

## 3.18 数据归一化

归一化可以改善训练收敛。

常见做法：

```text
x_j <- (x_j - μ_j) / σ_j
```

也叫 standardization。

BatchNorm 是在网络内部对特征做类似归一化。

---

## 3.19 学习率与学习率计划

学习率太小：

- 收敛慢

学习率太大：

- 震荡
- 不稳定
- 甚至发散

常见学习率计划：

### Linear schedule

```text
η(t) = η_init + t/t_max * (η_final - η_init)
```

### Step schedule

每隔一定 epoch 乘一个衰减因子。

### Cosine schedule

```text
η(t) = η_min + 1/2(η_max - η_min)(1 + cos(πt/t_period))
```

常见组合：

```text
linear warmup + cosine decay
```

---

## 3.20 Momentum

Momentum 更新：

```text
g(t) = ∇L(θ(t)) + μg(t-1)
θ(t+1) = θ(t) - ηg(t)
```

直觉：

- 平滑梯度噪声
- 沿稳定方向加速
- 像重球沿斜坡滚动

---

## 3.21 AdaGrad

AdaGrad 为不同参数自适应学习率。

特点：

- 罕见但重要的特征可以获得更大影响。
- 缺点是累积平方梯度不断增大，学习率会越来越小。

---

## 3.22 Adam 与 AdamW

Adam 维护一阶矩和二阶矩：

```text
m(t) = β1 m(t-1) + (1-β1) g(t)
v(t) = β2 v(t-1) + (1-β2) g(t)^2
```

更新时用 bias correction：

```text
m_hat = m / (1 - β1^t)
v_hat = v / (1 - β2^t)
```

AdamW 在 Adam 中更合理地加入 weight decay，是当前深度学习常用默认优化器之一。

---

# 4. 卷积神经网络 CNN

## 4.1 为什么不直接用 MLP 处理图像？

假设输入图像大小：

```text
224 x 224 x 3 = 150,528
```

如果 MLP 第一层有 1000 个 hidden units，则参数量约：

```text
1000 x 150,528 = 150M
```

仅第一层就非常大。

问题：

- 参数太多
- 训练困难
- 需要大量数据
- 不利用图像局部结构
- 对平移不鲁棒

CNN 通过局部连接和参数共享解决这些问题。

---

## 4.2 一维卷积

输入信号：

```text
x ∈ R^n
```

卷积核：

```text
a ∈ R^p
```

输出：

```text
y_i = Σ_{j=1}^p a_j x_{i+j-1}
```

卷积可以看成矩阵乘法，其中矩阵具有 Toeplitz 结构。

重要直觉：

> 卷积是带参数共享的线性算子。

---

## 4.3 二维卷积

二维输入：

```text
X ∈ R^{n x m}
```

二维卷积核：

```text
A ∈ R^{p x q}
```

输出：

```text
Y_ij = Σ_k Σ_l A_kl X_{i+k-1, j+l-1}
```

卷积核在平面上滑动。

---

## 4.4 多通道卷积

RGB 图像有 3 个通道：

```text
X_R, X_G, X_B
```

卷积输出：

```text
Y = A_R * X_R + A_G * X_G + A_B * X_B
```

更一般地：

```text
input shape:  (C_in, H, W)
kernel shape: (C_in, P, Q)
output:       one channel
```

如果有 K 个卷积核，则输出 K 个通道：

```text
output shape: (K, H_out, W_out)
```

---

## 4.5 Padding、Stride、Dilation、Bias

### Padding

在输入边界补 0，使输出尺寸不至于变小。

### Stride

卷积核每次移动的步长。

- stride 大，输出更小，计算更少。

### Dilation

卷积核内部跳过输入点，扩大感受野。

### Bias

卷积后加偏置：

```text
y = a * x + b
```

和线性层中的：

```text
y = Ax + b
```

非常类似。

---

## 4.6 卷积的反向传播

卷积层的参数可学习，需要计算 loss 对卷积核的梯度。

一维卷积：

```text
y_i = Σ_j a_j x_{i+j-1}
```

对卷积核的梯度也是一个卷积形式：

```text
dL/da = dL/dy * x
```

对输入的梯度是和翻转卷积核的卷积：

```text
dL/dx = dL/dy * rev(a)
```

重要结论：

> 卷积层反向传播本身也可以用卷积计算。

---

## 4.7 Pooling

Pooling 用于降低特征图尺寸并增强局部鲁棒性。

常见 pooling：

### Average Pooling

取窗口平均值。

### Max Pooling

取窗口最大值。

例如 2x2 pooling stride=2 会把空间大小缩小 4 倍。

Max pooling 是非线性操作。

反向传播：

- average pooling：梯度平均分配
- max pooling：梯度传给最大值位置

---

## 4.8 CNN 架构

典型 CNN：

```text
image
 -> conv
 -> activation
 -> pooling
 -> conv
 -> activation
 -> pooling
 -> flatten
 -> fully connected
 -> softmax
```

CNN 的关键优势：

- 局部连接
- 参数共享
- 平移鲁棒性
- 感受野逐层扩大
- 参数远少于 MLP

---

## 4.9 感受野

深层卷积网络中，后面层的一个特征点对应原图中更大的区域。

例如经过多层 pooling 后，一个小卷积核也可以看到原图中很大的区域。

这叫 receptive field。

---

## 4.10 图像分类评估

常用指标：

- top-1 accuracy
- top-5 accuracy
- error rate
- confusion matrix
- precision
- recall
- F1
- mAP

---

## 4.11 Confusion Matrix

二分类 confusion matrix：

```text
              predicted
              0     1
actual 0      TN    FP
actual 1      FN    TP
```

定义：

- TP：真正例
- TN：真反例
- FP：假正例
- FN：假反例

---

## 4.12 Precision、Recall、F1

Recall：

```text
recall = TP / (TP + FN)
```

Precision：

```text
precision = TP / (TP + FP)
```

Specificity：

```text
specificity = TN / (TN + FP)
```

Accuracy：

```text
accuracy = (TP + TN) / (TP + TN + FP + FN)
```

F1：

```text
F1 = 2 * precision * recall / (precision + recall)
```

---

## 4.13 PR Curve 与 AP

改变分类阈值 t，会得到不同 precision/recall。

PR curve 展示不同阈值下的 precision-recall tradeoff。

AP：

```text
Average Precision = PR curve 下的面积
```

多类别任务常用：

```text
mAP = mean Average Precision
```

---

## 4.14 为什么 CNN 参数更少？

CNN 通过卷积核参数共享减少参数。

MLP 对每个像素和 hidden unit 都有独立参数。  
CNN 一个卷积核在所有空间位置共享参数。

这提升了：

- 泛化
- 参数效率
- 训练效率

---

## 4.15 Data Augmentation

数据增强通过对已有样本做随机变换生成新样本：

```text
(x, y) -> (T(x), y)
```

视觉任务常见增强：

- rotation
- flipping
- cropping
- brightness
- contrast
- saturation
- Gaussian noise
- salt & pepper noise
- random erasing

作用：

- 减少过拟合
- 提升鲁棒性
- 模拟测试时可能出现的变化

---

## 4.16 Batch Normalization

BatchNorm 在 batch 内对特征做标准化：

```text
z_hat = γ * (z - μ_B) / σ_B + β
```

其中：

- μ_B：batch 均值
- σ_B：batch 标准差
- γ、β 是可学习参数

训练时使用 batch 统计。  
测试时使用 running average。

作用：

- 稳定训练
- 加速收敛
- 允许更大学习率

---

## 4.17 ResNet 残差连接

残差块：

```text
z = f(x) + x
```

再接激活：

```text
y = σ(z)
```

梯度：

```text
dL/dx = dL/dz * (df/dx + I)
```

即使 df/dx 很小，I 也能提供梯度通路。

作用：

- 缓解梯度消失
- 支持训练非常深的网络

典型模型：

- ResNet18
- ResNet34
- ResNet50
- ResNet101

---

# 5. 目标检测与图像分割

## 5.1 从分类到检测

### 图像分类

输出一个类别：

```text
image -> "cat"
```

### 目标定位

输出类别 + 一个 bounding box：

```text
image -> ("cat", x, y, w, h)
```

### 目标检测

输出多个类别 + 多个 bounding boxes：

```text
image -> [("cat", box1), ("dog", box2), ...]
```

### 实例分割

输出每个对象的像素级 mask。

---

## 5.2 Bounding Box 表示

常见表示：

```text
(x, y, w, h)
```

其中：

- (x, y)：左上角坐标
- w：宽度
- h：高度

也可表示为：

```text
(x1, y1, x2, y2)
```

坐标通常归一化到 0 到 1。

---

## 5.3 IoU

Intersection over Union：

```text
IoU(A, B) = |A ∩ B| / |A ∪ B|
```

性质：

- 完全重合：IoU = 1
- 完全不相交：IoU = 0

检测中常用阈值：

- IoU 0.3：宽松
- IoU 0.5：常用
- IoU 0.7：严格

---

## 5.4 Sliding Window

最朴素的检测方法：

1. 用一个窗口裁剪图像。
2. 对窗口内容做分类。
3. 滑动窗口遍历所有位置。
4. 改变窗口大小遍历不同尺度。

缺点：

- 计算极其昂贵。
- 对一张图像可能有数十亿候选框。

---

## 5.5 Non-Maximal Suppression

NMS 用于去除重复检测。

步骤：

1. 按置信度排序。
2. 选最高置信度框。
3. 删除与它重叠过高的同类框。
4. 重复。

NMS 可以去掉重复框，但不能去掉高置信度 false positive。

---

## 5.6 Selective Search

Selective Search 用传统图像分割和聚类生成候选区域。

优点：

- 从所有可能 box 降到约 2000 个 proposal。

缺点：

- 不是端到端训练。
- 仍然是瓶颈。

---

## 5.7 R-CNN 系列

### R-CNN

流程：

```text
image
 -> selective search proposals
 -> crop each proposal
 -> CNN backbone
 -> classifier + bbox regressor
```

缺点：

- 每个 proposal 都跑一次 CNN，计算浪费严重。

---

### Fast R-CNN

改进：

```text
whole image -> CNN feature map
proposals -> RoI Pooling on feature map
-> classifier + bbox regressor
```

避免对每个 proposal 重复 CNN。

---

### Faster R-CNN

进一步改进：

```text
whole image -> CNN feature map
-> Region Proposal Network
-> RoIAlign
-> classifier + bbox regressor
```

RPN 替代 Selective Search，实现更接近端到端。

---

## 5.8 RoIPool 与 RoIAlign

RoIPool / RoIAlign 的作用：

> 从整图特征图中，为任意 proposal 区域提取固定尺寸特征。

区别：

- RoIPool：将坐标量化到 feature grid。
- RoIAlign：保留浮点坐标，用双线性插值，更精确。

Mask R-CNN 中 RoIAlign 很重要。

---

## 5.9 Region Proposal Network

RPN 在 feature map 每个位置放置多个 anchor boxes。

对每个 anchor 预测：

1. 是否包含对象。
2. bbox 调整量。

RPN 输出 top-k proposals，再送入后续分类和回归分支。

---

## 5.10 Single-stage Detector

Single-stage detector 直接预测：

```text
bounding boxes + class probabilities
```

不显式分两阶段 proposal + classification。

代表：

- YOLO
- SSD

YOLO 把图像分成网格，每个网格预测若干 box 和类别概率。

优点：

- 快
- 适合实时检测

缺点：

- 早期版本精度通常弱于 two-stage detector，但后续发展很快。

---

## 5.11 检测评估

目标检测需要同时评估：

- 类别是否正确
- 框位置是否准确
- 是否重复检测
- 是否漏检

常用指标：

- AP
- mAP
- mAP@IoU=0.5
- COCO mAP

检测模型比较需要同时看：

- 精度
- 速度
- backbone
- 输入分辨率
- 训练数据
- NMS 设置
- 阈值设置

---

## 5.12 图像分割

分割是像素级预测。

类型：

### 无监督过分割

把图像切成 superpixels。

### 语义分割

每个像素一个语义类别。

例如：

```text
sky, road, car, person
```

### 实例分割

区分同类不同实例。

例如：

```text
person_1, person_2, person_3
```

### 全景分割

结合语义分割和实例分割。

---

## 5.13 Superpixel

Superpixel 把图像切成颜色/纹理相近的小区域。

传统方法：

- graph-based segmentation
- SLIC

Superpixel 常作为下游任务的预处理。

---

## 5.14 Semantic Segmentation

语义分割输出和输入图像同尺寸的类别图：

```text
input:  image tensor
output: H x W class labels
```

常用架构：

- Fully Convolutional Network
- U-Net
- DeepLab
- SegNet

关键技术：

- 上采样
- transposed convolution
- skip connections
- multi-scale features

---

## 5.15 Instance Segmentation

实例分割输出每个对象的 mask。

代表模型：

- Mask R-CNN
- Segment Anything Model

Mask R-CNN 在 Faster R-CNN 基础上增加 mask branch。

---

## 5.16 Segment Anything

SAM 是一个可 prompt 的分割 foundation model。

输入 prompt 可以是：

- point
- box
- mask
- text-like cue（某些扩展模型）

输出 segmentation mask。

它体现了 foundation model 在视觉任务中的趋势：

> 一个大模型支持多种下游分割任务。

---

# 6. 序列模型

## 6.1 序列数据

序列数据包括：

- 文本
- 语音
- 时间序列
- 视频帧
- 机器人轨迹
- 用户行为日志

序列模型需要处理时间依赖。

---

## 6.2 RNN

RNN 递推公式：

```text
h_t = φ(W_x x_t + W_h h_{t-1} + b)
```

输出可以基于 h_t。

特点：

- 参数在时间上共享
- 能处理变长序列
- 但难以并行
- 长依赖困难

---

## 6.3 Back-propagation Through Time

RNN 训练时把时间展开成深层网络，然后反向传播。

问题：

- 时间越长，梯度链越长。
- 容易梯度消失/爆炸。

---

## 6.4 LSTM

LSTM 通过门控机制缓解长依赖问题。

核心状态：

- hidden state h_t
- cell state c_t

主要门：

- forget gate
- input gate
- output gate

直觉：

> LSTM 允许信息沿 cell state 更稳定地传播。

---

## 6.5 Sequence-to-sequence Encoder-decoder

Seq2Seq 结构：

```text
input sequence -> encoder -> latent representation -> decoder -> output sequence
```

应用：

- 机器翻译
- 摘要
- 对话
- 图像描述

早期 Seq2Seq 常用 RNN/LSTM。  
后续被 Transformer 大量替代。

---

## 6.6 语言模型

语言模型估计：

```text
P(w_1, w_2, ..., w_T)
```

通常分解为：

```text
P(w_1:T) = Π_t P(w_t | w_1:t-1)
```

这就是 autoregressive language modeling。

---

## 6.7 词向量

文字需要编码成向量。

早期方法：

- one-hot
- word2vec
- GloVe

现代方法：

- contextual embedding
- BERT embedding
- GPT hidden states
- sentence embedding

---

## 6.8 Autoregressive Generation

自回归生成：

```text
生成 token 1
生成 token 2，条件是前面 token
生成 token 3，条件是前面所有 token
...
```

解码策略：

- greedy decoding
- beam search
- sampling
- top-k sampling
- nucleus sampling

---

## 6.9 Beam Search

Beam search 保留多个候选序列。

参数：

```text
beam width
```

优点：

- 比 greedy 更全局

缺点：

- 更慢
- 可能生成过于保守的句子

---

## 6.10 应用

### 图像描述

```text
image -> CNN encoder -> RNN/Transformer decoder -> caption
```

### 视觉问答

```text
image + question -> answer
```

### 视觉语言导航

```text
instruction + visual observation -> action
```

---

## 6.11 视觉语言联合嵌入

目标：

> 把图像和文本映射到同一个语义空间。

例如：

```text
image embedding close to matching text embedding
```

应用：

- text-to-image search
- image-to-text retrieval
- CLIP-style zero-shot classification
- multimodal search

---

# 7. 开发、调试与诊断

## 7.1 数值问题

深度学习常见数值问题：

- overflow
- underflow
- NaN
- Inf
- 梯度爆炸
- softmax 不稳定
- log(0)
- 除以 0

常见解决：

- 使用 log-sum-exp
- gradient clipping
- loss scaling
- 合理初始化
- normalization
- 检查输入范围

---

## 7.2 算法问题

模型不工作不一定是代码错，也可能是：

- 目标函数不合适
- 模型容量不足
- 数据质量差
- 标签噪声
- 学习率不对
- 归一化缺失
- 训练/验证 split 错误
- 指标与目标不一致

---

## 7.3 机器学习代码常见 bug

常见问题：

- 标签错位
- train/test 数据泄漏
- loss 没有正确平均
- 忘记 `model.train()` / `model.eval()`
- 忘记 `optimizer.zero_grad()`
- softmax 和 CrossEntropyLoss 重复使用
- 维度顺序错误，如 HWC vs CHW
- 数据归一化不一致
- augmentation 应用到 validation/test
- mask 方向错误
- detach 误用导致梯度断开

---

## 7.4 实现建议

调试模型时可以：

1. 先在小数据集上 overfit。
2. 检查 loss 是否下降。
3. 检查梯度是否为 NaN/Inf。
4. 可视化输入和标签。
5. 可视化模型输出。
6. 打印 tensor shape。
7. 固定 random seed。
8. 逐步增加复杂度。
9. 写单元测试。
10. 做 ablation study。

---

## 7.5 数据集问题

数据问题通常比模型问题更常见。

需要检查：

- 标签是否准确
- 类别是否平衡
- 是否有重复样本
- train/test 是否泄漏
- 是否有 distribution shift
- 是否有 corrupted data
- 是否有异常值
- 是否有数据预处理不一致

---

## 7.6 诊断方法

### Overfitting vs Poor Features

如果训练集好、验证集差：

```text
过拟合
```

如果训练集和验证集都差：

```text
模型容量不足 / 特征差 / 优化失败
```

### Objective vs Optimization

如果目标函数本身不对，优化再好也没用。  
如果目标函数对但优化不到位，需要改优化器、学习率、初始化等。

### Search vs Score

在检测、检索、搜索类问题中，需要区分：

- 候选生成是否找到正确结果
- 打分/排序是否把正确结果排上去

这对 debug retrieval/ranking 很重要。

---

## 7.7 Error Analysis 与 Ablation

### Error Analysis

手动检查错误样本，找模式：

- 某类总错
- 某种场景总错
- 某些输入质量差
- 某些标签歧义

### Ablation

逐个去掉模块，看性能变化。

例如：

```text
full model
- no augmentation
- no batchnorm
- no residual
- no reranker
```

Ablation 能回答：

> 哪个模块真的有用？

---

## 7.8 实验工具

好的实验系统需要记录：

- 代码版本
- 数据版本
- 模型配置
- 超参数
- random seed
- 指标
- checkpoint
- 日志
- 可视化结果

常用工具：

- TensorBoard
- Weights & Biases
- MLflow
- 自研 dashboard

---

# 8. Transformer

## 8.1 Tokenization

Transformer 处理的是 token 序列。

Tokenization 把文本切成 token：

```text
text -> tokens -> token IDs
```

常见 tokenization：

- word-level
- character-level
- subword-level
- BPE
- WordPiece
- SentencePiece

Subword 方法能处理：

- rare words
- unknown words
- 多语言
- 词形变化

---

## 8.2 位置编码

Self-attention 本身不包含顺序信息，所以需要 positional encoding。

常见方法：

- sinusoidal positional encoding
- learned positional embedding
- relative positional encoding
- RoPE
- ALiBi

位置编码的作用：

> 告诉模型 token 在序列中的位置。

---

## 8.3 Key-Value Store 直觉

Attention 可以类比为 key-value memory：

- Query：我要找什么
- Key：每个位置的索引
- Value：每个位置的内容

通过 query 和 key 的相似度决定读取哪些 value。

---

## 8.4 Scaled Dot-product Attention

公式：

```text
Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V
```

步骤：

1. 输入映射到 Q、K、V。
2. 计算 QK^T 得到相关性分数。
3. 除以 sqrt(d_k) 稳定数值。
4. softmax 得到 attention weights。
5. 加权求和 V。

---

## 8.5 为什么除以 sqrt(d_k)

如果 d_k 很大，点积方差变大，softmax 容易饱和，梯度变小。

除以：

```text
sqrt(d_k)
```

可以稳定 softmax。

---

## 8.6 Masking

Masking 用于禁止某些位置被关注。

常见 mask：

### Padding mask

忽略 padding token。

### Causal mask

生成任务中，当前位置只能看过去，不能看未来。

例如 GPT 使用 causal self-attention。

---

## 8.7 Multi-head Attention

多头注意力把表示分成多个子空间。

每个 head 学不同关系：

- 句法关系
- 长距离依赖
- 共指
- 局部模式
- 语义相关性

最后 concat 多个 head，再线性投影。

---

## 8.8 Self-attention vs Cross-attention

### Self-attention

Q、K、V 来自同一序列。

```text
text attends to itself
```

### Cross-attention

Q 来自 decoder，K/V 来自 encoder。

```text
decoder attends to encoder output
```

用于 encoder-decoder 模型，例如翻译。

---

## 8.9 Transformer 架构

一个 Transformer block 通常包含：

```text
Multi-head attention
+ residual connection
+ layer normalization
+ feed-forward network
+ residual connection
+ layer normalization
```

FFN 通常是两层 MLP：

```text
Linear -> activation -> Linear
```

常见激活：

- ReLU
- GELU
- SwiGLU

---

## 8.10 Encoder、Decoder、Decoder-only

### Encoder-only

代表：

- BERT

适合：

- 分类
- 检索
- 表示学习
- NER

### Encoder-decoder

代表：

- T5
- 原始 Transformer

适合：

- 翻译
- 摘要
- seq2seq

### Decoder-only

代表：

- GPT
- LLaMA
- Qwen

适合：

- 自回归生成
- 对话
- 代码生成
- 指令跟随

---

## 8.11 Training and Inference

训练时：

- 输入完整序列
- 并行计算 token loss
- teacher forcing

推理时：

- 一个 token 一个 token 生成
- 每一步依赖之前生成的 token
- 可使用 KV cache 加速

---

## 8.12 Prompt Engineering

Prompt engineering 通过指令、上下文、示例和格式约束影响模型行为。

常见组成：

- role / system instruction
- task instruction
- retrieved context
- examples
- output schema
- constraints

生产中 prompt 应该：

- 版本化
- 可评估
- 可回滚
- 可 A/B test

---

## 8.13 表格数据处理

表格数据对 LLM 来说有挑战：

- 行列关系重要
- 表头语义重要
- 数字精度重要
- 单元格跨度复杂

常用表示：

- markdown table
- JSON
- CSV-like text
- schema + rows
- 结构化 tool/query

---

## 8.14 Vision Transformer

ViT 把图像切成 patch：

```text
image -> patches -> patch embeddings -> transformer
```

每个 patch 类似一个 token。

ViT 特点：

- 依赖大数据预训练
- 可扩展性强
- 与文本 Transformer 结构统一

---

## 8.15 Transformer 在视觉中的应用

应用包括：

- 图像分类
- 目标检测
- 语义分割
- 多模态理解
- 自监督视觉表示学习
- 图像生成
- 视频理解

---

## 8.16 KV Cache

自回归生成时，每步都需要过去 token 的 K/V。

KV cache 保存过去 token 的 K/V，避免重复计算。

优点：

- 大幅加速生成
- 降低重复计算

代价：

- 占用显存
- 长上下文时内存压力大

---

## 8.17 Flash Attention

标准 attention 需要显式存储：

```text
QK^T
```

其空间复杂度与序列长度平方相关。

Flash Attention 通过 IO-aware 算法减少显存读写，提高速度并降低内存占用。

适合长序列训练和推理。

---

# 9. 对比学习

## 9.1 自监督学习

自监督学习从数据本身构造监督信号。

例如：

- 预测缺失 token
- 判断图像增强前后是否同一图
- 图文是否匹配
- 下一句预测
- masked language modeling

优点：

- 不需要人工标签
- 可利用大规模未标注数据

---

## 9.2 对比学习核心思想

对比学习希望：

```text
similar pairs -> embedding closer
dissimilar pairs -> embedding farther
```

例如：

- 同一图片的两种增强视图是 positive pair。
- 不同图片是 negative pair。
- 图像和对应文本是 positive pair。
- 图像和不相关文本是 negative pair。

---

## 9.3 常见损失

### Triplet Loss

```text
max(0, d(anchor, positive) - d(anchor, negative) + margin)
```

目标：

```text
anchor closer to positive than negative
```

### InfoNCE / Contrastive Loss

常用于 CLIP / SimCLR。

核心思想：

> 在一个 batch 中，把正确 pair 从很多 negative 中识别出来。

---

## 9.4 获取相似样本

Positive pair 来源：

- 数据增强
- 同一图像不同 crop
- 图像和 caption
- 同一视频不同帧
- 同一用户行为序列
- 语义相同的文本 pair

Negative pair 来源：

- batch 内其他样本
- memory bank
- hard negative mining

---

## 9.5 Collapse 问题

如果所有样本 embedding 都变成一样，模型就 collapse。

避免方法：

- negative samples
- stop-gradient
- predictor head
- variance/covariance regularization
- batch normalization
- momentum encoder

---

## 9.6 Word2Vec

Skip-gram 目标：

```text
center word -> predict context words
```

学习词向量，使语义相近词距离更近。

---

## 9.7 BERT

BERT 是双向 encoder 模型。

训练目标：

- masked language modeling
- next sentence prediction（早期 BERT 使用）

适合：

- 表示学习
- 分类
- NER
- 检索
- reranking

---

## 9.8 CLIP

CLIP 学习图像和文本的共享 embedding space。

训练：

```text
image encoder -> image embedding
text encoder  -> text embedding
contrastive loss
```

应用：

- zero-shot image classification
- text-to-image retrieval
- image-to-text retrieval
- multimodal search
- image-text alignment

---

# 10. 深度强化学习

## 10.1 强化学习基础

强化学习研究智能体在环境中采取动作以最大化长期奖励。

基本元素：

- state s
- action a
- reward r
- policy π
- value function V
- action-value function Q
- transition dynamics

---

## 10.2 MDP

Markov Decision Process 包括：

```text
(S, A, P, R, γ)
```

其中：

- S：状态空间
- A：动作空间
- P：状态转移概率
- R：奖励函数
- γ：折扣因子

目标：

```text
maximize expected cumulative reward
```

---

## 10.3 Policy、Reward、Value

Policy：

```text
π(a | s)
```

表示在状态 s 下选择动作 a 的概率。

Return：

```text
G_t = r_t + γr_{t+1} + γ^2 r_{t+2} + ...
```

Value：

```text
Vπ(s) = Eπ[G_t | s_t = s]
```

Q-value：

```text
Qπ(s,a) = Eπ[G_t | s_t=s, a_t=a]
```

---

## 10.4 Bellman Equation

价值函数满足递归关系：

```text
V(s) = E[r + γV(s')]
```

Q 函数：

```text
Q(s,a) = E[r + γ max_a' Q(s',a')]
```

---

## 10.5 Value Iteration

如果知道环境转移和奖励，可以迭代更新 value，直到收敛。

---

## 10.6 Temporal Difference Learning

TD learning 不需要完整 episode 结束即可更新。

典型 TD target：

```text
r + γV(s')
```

TD error：

```text
δ = r + γV(s') - V(s)
```

---

## 10.7 Exploration vs Exploitation

强化学习需要平衡：

- exploration：尝试新动作
- exploitation：利用当前认为最好的动作

常见策略：

- ε-greedy
- entropy regularization
- optimistic initialization
- UCB

---

## 10.8 Deep Q-Learning

DQN 用神经网络近似 Q 函数：

```text
Q(s, a; θ)
```

关键技术：

- experience replay
- target network
- ε-greedy
- TD loss

---

## 10.9 Policy Gradient

直接优化策略参数：

```text
∇θ J(θ)
```

代表算法：

- REINFORCE
- Actor-Critic
- PPO

---

## 10.10 Actor-Critic

Actor：

```text
policy π(a|s)
```

Critic：

```text
value V(s) or Q(s,a)
```

Actor 负责选择动作，Critic 负责评估动作好坏。

---

## 10.11 PPO

Proximal Policy Optimization 是常用策略优化方法。

核心思想：

> 限制新旧策略变化不要太大，提升训练稳定性。

PPO 在 RLHF 中也很重要。

---

# 11. 生成式 AI：VAE、Flow、Diffusion

## 11.1 生成模型目标

生成模型学习数据分布：

```text
p_data(x)
```

训练后可以生成新样本：

```text
x ~ p_model(x)
```

应用：

- 图像生成
- 视频生成
- 音频生成
- 文本生成
- 分子生成
- 数据增强

---

## 11.2 Gaussian 分布

多元高斯：

```text
N(μ, Σ)
```

其中：

- μ 是均值
- Σ 是协方差

很多生成模型使用高斯作为潜变量先验。

---

## 11.3 Jensen 不等式

对于凹函数 log：

```text
log E[X] >= E[log X]
```

Jensen 不等式是变分推断和 ELBO 推导的关键。

---

## 11.4 Variational Lower Bound

对于无法直接最大化的 log likelihood，可以最大化其下界：

```text
ELBO
```

VAE 使用 ELBO 训练。

---

## 11.5 Variational Auto-Encoder

VAE 包含：

### Encoder

```text
qϕ(z | x)
```

把输入映射到潜变量分布。

### Decoder

```text
pθ(x | z)
```

从潜变量重构数据。

### Prior

```text
p(z) = N(0, I)
```

VAE loss 通常包括：

```text
reconstruction loss + KL divergence
```

也可写成最大化 ELBO。

直觉：

- reconstruction loss 保证重构质量。
- KL divergence 让潜变量分布接近先验，便于采样生成。

---

## 11.6 Flow Models

Normalizing Flow 使用可逆变换把简单分布映射到复杂数据分布。

核心：

```text
z ~ simple distribution
x = f(z)
```

要求 f 可逆：

```text
z = f^{-1}(x)
```

优势：

- 可以精确计算 likelihood。

挑战：

- 可逆结构设计受限
- 计算 Jacobian determinant

---

## 11.7 Diffusion Models

Diffusion model 包含两个过程：

### Forward process

逐步往数据中加噪声：

```text
x_0 -> x_1 -> ... -> x_T
```

最终接近高斯噪声。

### Reverse process

学习从噪声逐步去噪生成数据：

```text
x_T -> x_{T-1} -> ... -> x_0
```

模型通常学习预测：

- noise
- denoised image
- score

Diffusion 成为图像、视频、音频生成的重要方法。

---

# 12. 公式与概念速查

## 12.1 Sigmoid

```text
σ(z) = 1 / (1 + exp(-z))
```

导数：

```text
σ'(z) = σ(z)(1 - σ(z))
```

---

## 12.2 Softmax

```text
softmax(z)_k = exp(z_k) / Σ_j exp(z_j)
```

---

## 12.3 Cross Entropy

```text
CE = -Σ_k y_k log p_k
```

one-hot 时：

```text
CE = -log p_y
```

---

## 12.4 Gradient Descent

```text
θ <- θ - η∇L(θ)
```

---

## 12.5 SGD Mini-batch Gradient

```text
g = 1/B Σ_{i=1}^B ∇ℓ_i
```

---

## 12.6 Momentum

```text
g_t = ∇L(θ_t) + μg_{t-1}
θ_{t+1} = θ_t - ηg_t
```

---

## 12.7 Adam

```text
m_t = β1m_{t-1} + (1-β1)g_t
v_t = β2v_{t-1} + (1-β2)g_t^2
θ <- θ - η m_hat / (sqrt(v_hat) + ε)
```

---

## 12.8 Attention

```text
Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V
```

---

## 12.9 IoU

```text
IoU(A,B) = |A ∩ B| / |A ∪ B|
```

---

## 12.10 Precision / Recall / F1

```text
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2PR / (P + R)
```

---

## 12.11 Bellman Equation

```text
V(s) = E[r + γV(s')]
```

---

## 12.12 VAE Loss

```text
Loss = reconstruction loss + KL(q(z|x) || p(z))
```

---

# 13. 面试复习重点

## 13.1 必须会讲的主线

如果面试官让你总结深度学习，可以按这个顺序讲：

```text
1. Deep learning learns functions from data.
2. Neural networks compose linear transforms and nonlinear activations.
3. Training minimizes loss with gradient-based optimization.
4. Backpropagation efficiently computes gradients through computation graphs.
5. CNNs exploit local structure and parameter sharing for images.
6. RNN/LSTM handle sequences but suffer from long dependency and parallelism issues.
7. Transformers use attention to model long-range relationships and scale well.
8. Contrastive learning builds useful representations from self-supervised pairs.
9. Reinforcement learning learns policies through reward feedback.
10. Generative models learn data distributions and generate new samples.
```

中文口径：

深度学习本质是用可微计算图表示一个参数化函数，通过 loss 定义学习目标，用反向传播和优化器更新参数。不同架构的差异在于 inductive bias：CNN 利用图像局部性和参数共享，RNN/LSTM 处理时间序列，Transformer 用 attention 建模全局依赖，对比学习学习 representation，生成模型学习数据分布。

---

## 13.2 容易被问的 trade-off

### MLP vs CNN

- MLP 参数多，不利用空间结构。
- CNN 参数共享、局部连接、适合图像。

### Sigmoid vs ReLU

- Sigmoid 输出有界但容易饱和。
- ReLU 简单高效，但可能 dead ReLU。

### GD vs SGD

- GD 梯度准确但慢。
- SGD 有噪声但快，通常泛化更好。

### Adam vs SGD

- Adam 收敛快，适合大模型默认选择。
- SGD 有时泛化更好，需调学习率。

### RNN vs Transformer

- RNN 顺序计算，难并行。
- Transformer attention 可并行，建模长依赖更强，但 attention 复杂度高。

### Two-stage vs Single-stage Detection

- Two-stage 精度高但慢。
- Single-stage 快，适合实时。

### VAE vs Diffusion

- VAE 生成快，但样本可能模糊。
- Diffusion 样本质量高，但采样慢。

---

## 13.3 Debug 模型不收敛时怎么说

可以这样回答：

```text
First I would separate data, objective, optimization, and implementation issues.
I would overfit a tiny dataset, check loss decrease, inspect gradients, verify labels,
visualize inputs and predictions, check learning rate, confirm model train/eval mode,
and compare against a simple baseline.
```

中文：

我会先拆分问题：是数据错、目标函数错、优化问题、还是实现 bug。先让模型 overfit 一个很小的数据集；如果连小数据都过拟合不了，大概率是代码、loss、label 或优化设置有问题。然后检查梯度、学习率、输入归一化、train/eval 模式、数据增强、标签对齐和 baseline。

---

## 13.4 一句话总结

> 深度学习不是某一个模型，而是一套用数据、可微计算图、损失函数、反向传播、优化器和大规模算力来学习复杂函数的工程与数学体系。

