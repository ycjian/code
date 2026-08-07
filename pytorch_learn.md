# PyTorch 练习题与答案：从张量基础到 LLM 对齐

> 来源：`TorchCode-master/TorchCode-master/templates` 与 `solutions`。本讲义覆盖全部 41 道题。答案经过静态知识审查，没有运行代码。

## 学习方法

1. 先只看 Problem 和中文题意，自己写答案。
2. 写出每一步 tensor shape，再检查边界条件。
3. 对照 Reviewed Solution，理解中文注释。
4. 最后用中文复述“为什么正确”，再回到原 notebook 实战。

通用导入：

```python
# 本讲义所有答案共用这些 PyTorch、数学与类型工具
import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch import Tensor
```

---

## 01. Implement ReLU

**Problem.** Implement `ReLU(x) = max(0, x)` without built-in activation functions. Autograd must still work.

**中文题意。** 不使用 `torch.relu`、`F.relu` 或 `clamp`，从零实现 ReLU。输入为正数时保留原值，否则输出 0，并且梯度必须能正常反向传播。

### Reviewed Solution

```python
def relu(x: torch.Tensor) -> torch.Tensor:
    # 条件成立时选择 x，否则选择与 x 同设备、同 dtype 的 0
    # 图示：[-2, 0, 3] -> [0, 0, 3]
    return torch.where(x > 0, x, torch.zeros_like(x))
```

**中文解释。** `torch.where` 只在条件选中的分支上传递梯度。`zeros_like` 保证输出不会意外改变 dtype 或 device。在 `x=0` 处数学导数不存在，这里选择梯度 0，与 PyTorch ReLU 一致。

#### 代码/API 逐项解释

- `torch.Tensor`：PyTorch 张量类型；它同时记录数值、shape、dtype、device，并可通过 `requires_grad=True` 接入 autograd 计算图。
- `torch.where`：逐元素条件选择：`torch.where(condition, a, b)` 在条件为 True 的位置取 `a`，否则取 `b`；三者需满足 broadcasting 规则。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。

#### 输入与输出示例

- **输入/调用**：输入 `x=tensor([-2.,0.,3.])`，`x>0` 得到 `[False,False,True]`；输出 `tensor([0.,0.,3.])`，shape 和 dtype 不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 02. Numerically Stable Softmax

**Problem.** Implement softmax along an arbitrary dimension without built-in softmax, and make it numerically stable.

**中文题意。** 沿指定维度实现 Softmax，不能调用内置 Softmax。必须先减去最大值，避免大 logits 在指数运算时溢出。

### Reviewed Solution

```python
def my_softmax(x: torch.Tensor, dim: int = -1) -> torch.Tensor:
    # 每一行减去自己的最大值；概率不变，但 exp 更稳定
    shifted = x - x.amax(dim=dim, keepdim=True)
    exp_x = shifted.exp()
    # keepdim=True 使分母可以广播回原 tensor
    return exp_x / exp_x.sum(dim=dim, keepdim=True)
```

**中文解释。** 同时减去常数不会改变 Softmax，因为分子与分母中的公共因子会抵消。最大元素变成 0，因此最大的指数值是 1，可避免 `exp(1000)` 产生无穷大。

#### 代码/API 逐项解释

- `torch.Tensor`：PyTorch 张量类型；它同时记录数值、shape、dtype、device，并可通过 `requires_grad=True` 接入 autograd 计算图。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：输入 `x=tensor([1000.,1001.])`；先减最大值变成 `[-1,0]`，输出约 `[0.2689,0.7311]`，总和为 1 且不会计算 `exp(1001)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 03. Simple Linear Layer

**Problem.** Implement `y = xW^T + b`. Weight shape is `(out_features, in_features)` and both tensors require gradients.

**中文题意。** 手写全连接层。权重形状为 `(输出维度, 输入维度)`，偏置为 `(输出维度,)`，两者都需要梯度。

### Reviewed Solution

```python
class SimpleLinear:
    def __init__(self, in_features: int, out_features: int):
        # 缩放初始化，避免输入维度增大时输出方差过大
        scale = 1.0 / math.sqrt(in_features)
        self.weight = (
            torch.randn(out_features, in_features) * scale
        ).requires_grad_()
        self.bias = torch.zeros(out_features, requires_grad=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # (..., Din) @ (Din, Dout) + (Dout,) -> (..., Dout)
        return x @ self.weight.T + self.bias
```

**中文解释。** `weight.T` 把权重变成 `(Din,Dout)` 以便矩阵乘法。偏置会自动广播到 batch 和其他前导维度。生产代码通常继承 `nn.Module` 并使用 `nn.Parameter`，这样优化器能自动发现参数。

#### 代码/API 逐项解释

- `torch.randn`：从标准正态分布 N(0,1) 创建指定 shape 的张量；初始化参数时还应结合 fan-in/fan-out 缩放。
- `torch.zeros`：创建指定 shape 的全 0 张量；生产代码通常显式给出 `device` 和 `dtype`，避免默认落在 CPU/float32。
- `torch.Tensor`：PyTorch 张量类型；它同时记录数值、shape、dtype、device，并可通过 `requires_grad=True` 接入 autograd 计算图。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.requires_grad_(...)`：`.requires_grad_(True)` 原地设置是否追踪梯度；只对浮点/复数张量有效。

#### 输入与输出示例

- **输入/调用**：输入 `x.shape=(2,3)`、`weight.shape=(4,3)`、`bias.shape=(4,)`；`x @ weight.T + bias` 输出 shape `(2,4)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 04. LayerNorm

**Problem.** Normalize over the last dimension, then apply learned scale `gamma` and shift `beta`.

**中文题意。** 对每个样本的最后一个维度计算均值和方差，标准化后乘以 `gamma`、加上 `beta`。

### Reviewed Solution

```python
def my_layer_norm(x, gamma, beta, eps=1e-5):
    # (B,S,D) -> 均值和方差形状都是 (B,S,1)
    mean = x.mean(dim=-1, keepdim=True)
    var = x.var(dim=-1, keepdim=True, unbiased=False)
    normalized = (x - mean) * torch.rsqrt(var + eps)
    # gamma/beta 的 (D,) 自动广播到所有 token
    return normalized * gamma + beta
```

**中文解释。** LayerNorm 对每个 token 独立归一化，不依赖 batch 中其他样本。必须使用总体方差 `unbiased=False`。`eps` 防止方差为 0 时除零。

#### 代码/API 逐项解释

- `torch.rsqrt`：计算 `1/sqrt(x)`；归一化中写成乘法 `x * rsqrt(var+eps)`，通常比先 sqrt 再除更直接。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.var(...)`：`.var(..., correction=0)` 计算总体方差；LayerNorm/BatchNorm forward 的方差约定必须核对。

#### 输入与输出示例

- **输入/调用**：输入单个 token `x=[1.,2.,3.]`、`gamma=[1,1,1]`、`beta=[0,0,0]`；输出均值约 0、方差约 1，shape 仍为 `(3,)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 05. Scaled Dot-Product Attention

**Problem.** Compute `softmax(QK^T / sqrt(Dk))V`, including cross-attention where query and key lengths differ.

**中文题意。** 实现缩放点积注意力，并支持 `Sq != Sk` 的交叉注意力。Q/K 的特征维必须相同，K/V 的序列长度必须相同。

### Reviewed Solution

```python
def scaled_dot_product_attention(Q, K, V):
    if Q.size(-1) != K.size(-1) or K.size(1) != V.size(1):
        raise ValueError("incompatible Q, K, V shapes")
    # 先计算每个 query 与所有 keys 的相似度
    # (B,Sq,Dk) @ (B,Dk,Sk) -> (B,Sq,Sk)
    scores = torch.bmm(Q, K.transpose(1, 2)) / math.sqrt(Q.size(-1))
    weights = torch.softmax(scores, dim=-1)
    # (B,Sq,Sk) @ (B,Sk,Dv) -> (B,Sq,Dv)
    return torch.bmm(weights, V)
```

**中文解释。** `QK^T` 衡量每个 query 与每个 key 的相似度。除以 `sqrt(Dk)` 可控制点积分布的方差，避免 Softmax 过早饱和。最后用注意力概率对 V 做加权求和。

#### 代码/API 逐项解释

- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：若 `Q:(2,4,8)`、`K:(2,6,8)`、`V:(2,6,16)`，scores 为 `(2,4,6)`，最终输出为 `(2,4,16)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 06. Multi-Head Attention

**Problem.** Project Q/K/V, split them into heads, run attention per head, concatenate, and apply an output projection.

**中文题意。** 实现多头注意力：先线性投影，再拆成多个 head，每个 head 独立计算注意力，最后拼接并输出投影。

### Reviewed Solution

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        if d_model % num_heads:
            raise ValueError("d_model must be divisible by num_heads")
        self.num_heads = num_heads
        self.d_head = d_model // num_heads
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def _split(self, x):
        b, s, _ = x.shape
        # (B,S,D) -> (B,S,H,Dh) -> (B,H,S,Dh)
        return x.view(b, s, self.num_heads, self.d_head).transpose(1, 2)

    def forward(self, Q, K, V):
        q = self._split(self.W_q(Q))
        k = self._split(self.W_k(K))
        v = self._split(self.W_v(V))
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.d_head)
        context = torch.softmax(scores, dim=-1) @ v
        b, _, sq, _ = context.shape
        # (B,H,Sq,Dh) -> (B,Sq,D)，contiguous 后才能安全 view
        merged = context.transpose(1, 2).contiguous().view(b, sq, -1)
        return self.W_o(merged)
```

**中文解释。** 多头机制让不同 head 学习不同的关系子空间。拆头后分数形状是 `(B,H,Sq,Sk)`。`transpose` 改变 stride，因此拼接前使用 `contiguous()`。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：输入 `x.shape=(B=2,S=5,D=16)`、`num_heads=4`；拆头后为 `(2,4,5,4)`，合头后输出回到 `(2,5,16)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 07. BatchNorm

**Problem.** Normalize `(N,D)` over the batch dimension and maintain running statistics for inference.

**中文题意。** 训练时按 batch 维度计算每个特征的均值和方差，同时更新运行统计量；推理时只使用运行统计量。

### Reviewed Solution

```python
def my_batch_norm(x, gamma, beta, running_mean, running_var,
                  eps=1e-5, momentum=0.1, training=True):
    if training:
        # 对 N 个样本统计每个特征，结果形状为 (D,)
        mean = x.mean(dim=0)
        var = x.var(dim=0, correction=0)  # forward 使用有偏总体方差
        running_var_sample = x.var(dim=0, correction=1)  # running_var 使用无偏样本方差
        with torch.no_grad():
            # running = (1-m)*running + m*batch_stat
            running_mean.lerp_(mean, momentum)
            running_var.lerp_(running_var_sample, momentum)
    else:
        mean, var = running_mean, running_var
    return gamma * (x - mean) * torch.rsqrt(var + eps) + beta
```

**中文解释。** BatchNorm 让同一特征在当前 batch 中标准化。PyTorch 的精确语义是：训练输出使用 `correction=0` 的有偏方差，但 `running_var` 更新使用 `correction=1` 的无偏方差。原 notebook 把同一个有偏方差用于两处，因此不能与 `nn.BatchNorm1d` 的状态完全对齐；这里已修正。训练时每个特征必须有多于一个统计值，否则无偏方差无定义。

#### 代码/API 逐项解释

- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- `torch.rsqrt`：计算 `1/sqrt(x)`；归一化中写成乘法 `x * rsqrt(var+eps)`，通常比先 sqrt 再除更直接。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.var(...)`：`.var(..., correction=0)` 计算总体方差；LayerNorm/BatchNorm forward 的方差约定必须核对。

- `.lerp_(...)`：`.lerp_(end,weight)` 原地线性插值；可把 moving average 更新写成稳定的一次操作。

#### 输入与输出示例

- **输入/调用**：输入训练 batch `x.shape=(8,3,32,32)`；每个 channel 在 `(B,H,W)` 上统计，输出同 shape，并更新长度 3 的 running mean/var。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 08. RMSNorm

**Problem.** Normalize by root-mean-square over the last dimension without subtracting the mean.

**中文题意。** 在最后一维计算均方根并归一化，但不像 LayerNorm 那样减均值。

### Reviewed Solution

```python
def rms_norm(x, weight, eps=1e-6):
    # RMS = sqrt(mean(x^2) + eps)，形状保留为 (...,1)
    inv_rms = torch.rsqrt(x.square().mean(dim=-1, keepdim=True) + eps)
    return x * inv_rms * weight
```

**中文解释。** RMSNorm 只控制向量尺度，不改变中心位置，计算量比 LayerNorm 小。`weight` 对最后一维逐元素缩放。

#### 代码/API 逐项解释

- `torch.rsqrt`：计算 `1/sqrt(x)`；归一化中写成乘法 `x * rsqrt(var+eps)`，通常比先 sqrt 再除更直接。
- `.square(...)`：`.square()` 逐元素平方；MSE、方差和 L2 距离常用。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：输入 `x=[3.,4.]`、`weight=[1.,1.]`；RMS=`sqrt((9+16)/2)`，输出约 `[0.8485,1.1314]`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 09. Causal Self-Attention

**Problem.** Prevent token position `i` from attending to future positions `j > i`.

**中文题意。** 实现 GPT 解码器中的因果注意力。第 `i` 个 token 只能看见自己和之前的 token，不能泄露未来信息。

### Reviewed Solution

```python
def causal_attention(Q, K, V):
    scores = torch.bmm(Q, K.transpose(1, 2)) / math.sqrt(Q.size(-1))
    s = Q.size(1)
    # 上三角 j>i 为 True：未来位置全部屏蔽
    future = torch.triu(
        torch.ones(s, s, dtype=torch.bool, device=Q.device), diagonal=1
    )
    scores = scores.masked_fill(future, float("-inf"))
    # exp(-inf)=0，所以未来 token 的注意力概率为 0
    return torch.bmm(torch.softmax(scores, dim=-1), V)
```

**中文解释。** Mask 必须在 Softmax 之前应用。第一行只有位置 0 可见，因此它的输出等于 `V[:,0]`。这是自注意力版本，默认 Q/K/V 序列长度一致。

#### 代码/API 逐项解释

- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `torch.triu`：保留矩阵上三角；`diagonal=1` 可标出严格未来位置，用于 causal mask。
- `torch.ones`：创建指定 shape 的全 1 张量，常作为 mask 的原始矩阵或正标签。
- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：输入 `Q,K,V.shape=(1,4,8)`；位置 0 的概率只能落在 key 0，位置 3 可看 key 0..3，输出 shape `(1,4,8)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 10. Grouped Query Attention

**Problem.** Use fewer key/value heads than query heads, sharing each KV head across a group of query heads.

**中文题意。** 实现 GQA：query 保留完整 head 数，而 K/V 使用更少的 head，并在一组 query heads 之间共享，以减少 KV cache。

### Reviewed Solution

```python
class GroupQueryAttention(nn.Module):
    def __init__(self, d_model, num_heads, num_kv_heads):
        super().__init__()
        if d_model % num_heads or num_heads % num_kv_heads:
            raise ValueError("invalid head configuration")
        self.h, self.h_kv = num_heads, num_kv_heads
        self.dh = d_model // num_heads
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, num_kv_heads * self.dh)
        self.W_v = nn.Linear(d_model, num_kv_heads * self.dh)
        self.W_o = nn.Linear(d_model, d_model)

    def forward(self, x):
        b, s, _ = x.shape
        q = self.W_q(x).view(b, s, self.h, self.dh).transpose(1, 2)
        k = self.W_k(x).view(b, s, self.h_kv, self.dh).transpose(1, 2)
        v = self.W_v(x).view(b, s, self.h_kv, self.dh).transpose(1, 2)
        # 例：8 个 Q heads / 2 个 KV heads -> 每个 KV head 复制 4 次
        repeats = self.h // self.h_kv
        k = k.repeat_interleave(repeats, dim=1)
        v = v.repeat_interleave(repeats, dim=1)
        attn = torch.softmax(q @ k.transpose(-2, -1) / math.sqrt(self.dh), -1) @ v
        return self.W_o(attn.transpose(1, 2).contiguous().view(b, s, -1))
```

**中文解释。** GQA 的 K/V 参数量和 cache 大约缩小为 `Hkv/H`。当 `Hkv=H` 时退化为普通 MHA；当 `Hkv=1` 时接近 Multi-Query Attention。原题未要求 causal mask，真正的 decoder 还需加 mask。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.repeat_interleave(...)`：`.repeat_interleave(r, dim)` 真正复制元素；GQA 用它把每个 KV head 对应到多个 Q heads。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。

#### 输入与输出示例

- **输入/调用**：`B=2,S=5,D=16,Hq=4,Hkv=2` 时，每个 KV head 复制服务 2 个 query heads；输出 `(2,5,16)`，cache 只保存 2 个 KV heads。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 11. Sliding Window Attention

**Problem.** Position `i` may attend only to positions satisfying `|i-j| <= window_size`.

**中文题意。** 每个 token 只能关注左右窗口内的 token；窗口为 0 时只看自己，窗口覆盖全序列时等价于完整注意力。

### Reviewed Solution

```python
def sliding_window_attention(Q, K, V, window_size):
    if window_size < 0:
        raise ValueError("window_size must be non-negative")
    scores = torch.bmm(Q, K.transpose(1, 2)) / math.sqrt(Q.size(-1))
    s = Q.size(1)
    pos = torch.arange(s, device=Q.device)
    # 距离超过 w 的格子为 True，例如 w=1 时每行最多看 3 个位置
    outside = (pos[:, None] - pos[None, :]).abs() > window_size
    weights = torch.softmax(scores.masked_fill(outside, float("-inf")), -1)
    return torch.bmm(weights, V)
```

**中文解释。** 该答案在数值上正确，但仍创建了完整的 `S x S` 分数矩阵，所以只是教学用 masking，并没有获得真正稀疏实现的 `O(Sw)` 内存优势。

#### 代码/API 逐项解释

- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.abs(...)`：`.abs()` 逐元素绝对值；Huber loss 用它判断误差落在线性还是二次区间。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：序列长度 6、窗口 2 时，位置 3 只允许关注位置 1..5（若是双向窗口）；函数输出 shape 与 Q 相同。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 12. Linear Attention

**Problem.** Use `phi(x)=ELU(x)+1` and reassociate matrix products to avoid creating an `S x S` matrix.

**中文题意。** 用非负核特征映射替代 Softmax，并先计算 `K^T V`，将序列平方复杂度改为与序列长度线性相关。

### Reviewed Solution

```python
def linear_attention(Q, K, V, eps=1e-6):
    q, k = F.elu(Q) + 1.0, F.elu(K) + 1.0
    # (B,Dk,S) @ (B,S,Dv) -> (B,Dk,Dv)，不创建 SxS
    kv = torch.bmm(k.transpose(1, 2), V)
    numerator = torch.bmm(q, kv)
    denominator = torch.bmm(q, k.sum(1, keepdim=True).transpose(1, 2))
    return numerator / denominator.clamp_min(eps)
```

**中文解释。** 通过矩阵乘法结合律先聚合 K/V，可避免完整注意力矩阵。它不是 Softmax attention 的严格等价实现，而是一种具有不同归纳偏置的核近似。

#### 代码/API 逐项解释

- `F.elu`：ELU 激活：正区间近似恒等，负区间平滑饱和；在线性 attention 中常加 1 使特征映射为正。
- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

#### 输入与输出示例

- **输入/调用**：输入 `Q,K,V.shape=(2,128,32)`；先算 `K^T V:(2,32,32)`，再与 Q 相乘，避免创建 `(2,128,128)` scores。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 13. GPT-2 Transformer Block

**Problem.** Build a pre-norm causal Transformer block with residual attention and a 4x GELU MLP.

**中文题意。** 实现简化 GPT-2 block：`x += causal_attention(LN(x))`，然后 `x += MLP(LN(x))`。

### Reviewed Solution

```python
class GPT2Block(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        if d_model % num_heads:
            raise ValueError("d_model must be divisible by num_heads")
        self.h, self.dh = num_heads, d_model // num_heads
        self.ln1, self.ln2 = nn.LayerNorm(d_model), nn.LayerNorm(d_model)
        self.q, self.k = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)
        self.v, self.o = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)
        self.mlp = nn.Sequential(
            nn.Linear(d_model, 4*d_model), nn.GELU(), nn.Linear(4*d_model, d_model)
        )

    def _attention(self, x):
        b, s, _ = x.shape
        split = lambda z: z.view(b, s, self.h, self.dh).transpose(1, 2)
        q, k, v = split(self.q(x)), split(self.k(x)), split(self.v(x))
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.dh)
        future = torch.triu(torch.ones(s, s, dtype=torch.bool, device=x.device), 1)
        ctx = torch.softmax(scores.masked_fill(future, float("-inf")), -1) @ v
        return self.o(ctx.transpose(1, 2).contiguous().view(b, s, -1))

    def forward(self, x):
        # Pre-Norm + 两条 residual 路径
        x = x + self._attention(self.ln1(x))
        return x + self.mlp(self.ln2(x))
```

**中文解释。** Pre-Norm 让 residual stream 保持直接梯度路径，深层训练通常更稳定。注意力负责 token 间信息交换，MLP 负责每个 token 内的非线性特征变换。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.LayerNorm`：对每个样本最后若干维独立归一化，训练和推理均使用当前输入统计。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.GELU`：平滑门控激活，近似用输入乘以高斯分布 CDF；Transformer MLP 常用。
- `torch.triu`：保留矩阵上三角；`diagonal=1` 可标出严格未来位置，用于 causal mask。
- `torch.ones`：创建指定 shape 的全 1 张量，常作为 mask 的原始矩阵或正标签。
- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：输入 hidden states `(B=2,S=8,D=64)`，attention 和 MLP 两条 residual 都保持 shape，block 输出仍是 `(2,8,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 14. KV Cache Attention

**Problem.** Cache projected K/V tensors so autoregressive decoding projects only new tokens.

**中文题意。** 预填充时保存所有 K/V；逐 token 解码时，把新 K/V 拼到缓存后面，避免重复投影历史 token。

### Reviewed Solution

```python
class KVCacheAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        if d_model % num_heads:
            raise ValueError("invalid head count")
        self.h, self.dh = num_heads, d_model // num_heads
        self.q, self.k = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)
        self.v, self.o = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)

    def forward(self, x, cache=None):
        b, s_new, _ = x.shape
        split = lambda z: z.view(b, s_new, self.h, self.dh).transpose(1, 2)
        q, k_new, v_new = split(self.q(x)), split(self.k(x)), split(self.v(x))
        if cache is None:
            k, v, s_past = k_new, v_new, 0
        else:
            s_past = cache[0].size(2)
            k = torch.cat((cache[0], k_new), dim=2)
            v = torch.cat((cache[1], v_new), dim=2)
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.dh)
        # query 的绝对位置从 s_past 开始，兼容单 token 和 chunk decode
        q_pos = s_past + torch.arange(s_new, device=x.device)
        k_pos = torch.arange(k.size(2), device=x.device)
        future = k_pos[None, :] > q_pos[:, None]
        ctx = torch.softmax(scores.masked_fill(future, float("-inf")), -1) @ v
        out = self.o(ctx.transpose(1, 2).contiguous().view(b, s_new, -1))
        return out, (k, v)
```

**中文解释。** Cache 形状是 `(B,H,S_cached,Dh)`。它减少的是历史 K/V 投影和历史 attention 输入准备；注意单 token 的 query 仍需与全部历史 keys 做点积，因此普通 attention 的每步计算仍随上下文长度增长。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：prefill 输入 4 个 token 后 cache 的 K/V 长度为 4；再输入 1 个 token，cache 变成长度 5，只返回新 token 的 `(B,1,D)` 输出。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 15. SwiGLU MLP

**Problem.** Implement `down(SiLU(gate(x)) * up(x))`, the gated feed-forward layer used by modern LLMs.

**中文题意。** 实现 SwiGLU：输入经过 gate 和 up 两条投影，用 SiLU 激活 gate 后逐元素相乘，再投影回模型维度。

### Reviewed Solution

```python
class SwiGLUMLP(nn.Module):
    def __init__(self, d_model, d_ff):
        super().__init__()
        self.gate_proj = nn.Linear(d_model, d_ff)
        self.up_proj = nn.Linear(d_model, d_ff)
        self.down_proj = nn.Linear(d_ff, d_model)

    def forward(self, x):
        # 两条分支都是 (...,Dff)，逐元素门控后回到 (...,Dmodel)
        gate = F.silu(self.gate_proj(x))
        content = self.up_proj(x)
        return self.down_proj(gate * content)
```

**中文解释。** `up_proj` 提供内容，`gate_proj` 决定哪些扩展特征通过。相比单一路径 GELU MLP，门控机制通常提供更强表达能力。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `F.silu`：SiLU/Swish：`x*sigmoid(x)`；SwiGLU 用它处理 gate 分支后再与 value 分支逐元素相乘。

#### 输入与输出示例

- **输入/调用**：输入 `(2,10,64)`，gate/up 投影到 hidden 维如 256；`silu(gate)*up` 仍为 `(2,10,256)`，down projection 输出 `(2,10,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 16. Cross-Entropy Loss

**Problem.** Implement mean class-index cross-entropy for logits `(B,C)` without built-in cross-entropy.

**中文题意。** 输入未归一化 logits 和每个样本的类别下标，使用稳定的 log-sum-exp 计算平均负对数似然。

### Reviewed Solution

```python
def cross_entropy_loss(logits, targets):
    # log_softmax(x) = x - logsumexp(x)
    log_probs = logits - torch.logsumexp(logits, dim=-1, keepdim=True)
    rows = torch.arange(targets.numel(), device=targets.device)
    # 取出每个样本真实类别的 log probability，再取负均值
    return -log_probs[rows, targets].mean()
```

**中文解释。** 不需要先计算 Softmax 再取 log，因为那样更容易发生下溢。`logsumexp` 将两步合并为稳定计算。`targets` 必须是整数类别索引。

#### 代码/API 逐项解释

- `torch.logsumexp`：稳定计算 `log(sum(exp(x)))`，内部等价于先减最大值；Cross-Entropy 中可避免显式 softmax。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `.numel(...)`：`.numel()` 返回总元素数；可用于按参数量归一化或恢复原 shape。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：logits `[[2.,0.,-1.]]`、target `[0]` 时，输出是类别 0 的负对数概率，约 `0.1698`，是标量 loss。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 17. Dropout

**Problem.** During training, drop elements with probability `p` and preserve expectation; during evaluation, return the input unchanged.

**中文题意。** 训练时随机将元素置零，并将保留元素放大 `1/(1-p)`；推理时不做任何变化。

### Reviewed Solution

```python
class MyDropout(nn.Module):
    def __init__(self, p=0.5):
        super().__init__()
        if not 0.0 <= p <= 1.0:
            raise ValueError("p must be in [0,1]")
        self.p = p

    def forward(self, x):
        if not self.training or self.p == 0.0:
            return x
        if self.p == 1.0:
            return torch.zeros_like(x)
        # keep 概率为 1-p；除以 1-p 后 E[output]=x
        keep = (torch.rand_like(x) >= self.p).to(x.dtype)
        return x * keep / (1.0 - self.p)
```

**中文解释。** 这是 inverted dropout。训练时已经完成期望值校正，因此 eval 阶段直接返回输入。额外处理 `p=1` 可避免除零。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `torch.rand_like`：在 `[0,1)` 上均匀采样，并继承参照张量的 shape、dtype、device，常用于 dropout mask 或接受/拒绝采样。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

#### 输入与输出示例

- **输入/调用**：输入 `[1.,1.,1.,1.]`、`p=0.5`；某次 mask 可能为 `[1,0,1,0]`，训练输出 `[2,0,2,0]`，eval 输出原向量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 18. Embedding Layer

**Problem.** Store a trainable embedding table and return rows selected by integer token IDs.

**中文题意。** 不使用 `nn.Embedding`，创建一个可训练查找表，并通过 token ID 索引对应行。

### Reviewed Solution

```python
class MyEmbedding(nn.Module):
    def __init__(self, num_embeddings, embedding_dim):
        super().__init__()
        # 每一行对应一个 token 的 D 维向量
        self.weight = nn.Parameter(torch.randn(num_embeddings, embedding_dim))

    def forward(self, indices):
        # (B,S) 索引 -> (B,S,D) embedding
        return self.weight[indices]
```

**中文解释。** 索引操作仍支持 autograd。梯度只更新本批次出现过的行；重复 token 的梯度会累加到同一行。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Parameter`：被 Module 自动注册的可训练张量；默认 `requires_grad=True`，会被优化器发现。
- `torch.randn`：从标准正态分布 N(0,1) 创建指定 shape 的张量；初始化参数时还应结合 fan-in/fan-out 缩放。

#### 输入与输出示例

- **输入/调用**：权重表 shape `(vocab=1000,D=64)`，token ids shape `(2,5)`；索引后输出 `(2,5,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 19. GELU

**Problem.** Implement exact GELU using the Gaussian error function, without built-in GELU.

**中文题意。** 按精确公式 `x * Phi(x)` 实现 GELU，使用 `torch.erf`，不能调用内置 GELU。

### Reviewed Solution

```python
def my_gelu(x):
    # Phi 是标准高斯分布的累积分布函数
    # Phi(x)=0.5*(1+erf(x/sqrt(2)))
    return 0.5 * x * (1.0 + torch.erf(x / math.sqrt(2.0)))
```

**中文解释。** GELU 根据输入在标准高斯分布下的累计概率进行平滑门控，不像 ReLU 那样硬截断负数。部分模型使用 tanh 近似以加速计算。

#### 代码/API 逐项解释

- `torch.erf`：误差函数；精确 GELU 可写成 `0.5*x*(1+erf(x/sqrt(2)))`。

- **GELU 公式拆解**：`math.sqrt(2.0)` 是 Python 标量常数；`x / sqrt(2)` 仍是张量，`erf` 后与 x 逐元素相乘，因此输入输出 shape 完全一致。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。

#### 输入与输出示例

- **输入/调用**：输入 `[-1.,0.,1.]`，精确 GELU 输出约 `[-0.1587,0,0.8413]`，负值被平滑抑制而非硬置零。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 20. Kaiming Initialization

**Problem.** Initialize weights from `N(0, 2/fan_in)` in place.

**中文题意。** 根据输入连接数计算标准差 `sqrt(2/fan_in)`，用正态分布原地初始化权重。

### Reviewed Solution

```python
def kaiming_init(weight):
    if weight.dim() < 2:
        raise ValueError("weight must have at least two dimensions")
    # 输入连接数：Linear 为 Din；卷积为 Cin*kH*kW
    fan_in = weight[0].numel()
    std = math.sqrt(2.0 / fan_in)
    with torch.no_grad():
        weight.normal_(0.0, std)
    return weight
```

**中文解释。** Kaiming 初始化针对 ReLU 类激活保持前向信号方差。仓库答案只使用 `shape[1]`，对 Linear 正确，但对卷积会漏掉 kernel 面积；这里改为更通用的 fan-in。

#### 代码/API 逐项解释

- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- `.numel(...)`：`.numel()` 返回总元素数；可用于按参数量归一化或恢复原 shape。

- `weight[0].numel()`：取第一个输出单元连接的全部权重数作为 fan-in；Linear 得到 Din，卷积核得到 `Cin*kH*kW`。
- **初始化输出**：函数原地改写传入 weight 并返回同一个张量对象；数值分布改变，但 shape/dtype/device 不变。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.normal_(...)`：`.normal_(mean,std)` 原地填充正态随机数；参数初始化应放在 `no_grad` 中。

#### 输入与输出示例

- **输入/调用**：权重 shape `(out=64,in=128)`，fan-in=128；Kaiming normal 标准差约 `sqrt(2/128)=0.125`，输出仍是同一 Parameter。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 21. Gradient Norm Clipping

**Problem.** Clip the combined L2 norm of all existing gradients to `max_norm` and return the original norm.

**中文题意。** 把所有参数梯度视作一个大向量；若总 L2 norm 超过阈值，就用同一个比例缩放全部梯度。

### Reviewed Solution

```python
def clip_grad_norm(parameters, max_norm):
    if max_norm < 0:
        raise ValueError("max_norm must be non-negative")
    grads = [p.grad for p in parameters if p.grad is not None]
    if not grads:
        return 0.0
    # 先算每个参数的 norm，再合成为全局 norm
    norms = torch.stack([torch.linalg.vector_norm(g.detach(), 2) for g in grads])
    total = torch.linalg.vector_norm(norms, 2)
    coef = (max_norm / (total + 1e-6)).clamp(max=1.0)
    with torch.no_grad():
        for grad in grads:
            grad.mul_(coef.to(grad.device))
    return total.item()
```

**中文解释。** 所有梯度乘同一系数，因此方向保持不变，只缩短长度。若没有梯度，应直接返回 0。`1e-6` 防止总 norm 为 0 时除零。

#### 代码/API 逐项解释

- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `torch.linalg.vector_norm`：计算向量 p-norm；这里先对每个梯度张量的全部元素求 L2 norm，得到若干标量，再把这些标量 stack 后再求一次 L2 norm，数学上等价于把所有参数梯度展平成一个大向量求全局范数。输出是 0 维标量张量，并保留输入 dtype/device。
- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。

- `.mul_(...)`：`.mul_` 是原地乘法；Adam 衰减 moving average 时避免分配新张量。

#### 输入与输出示例

- **输入/调用**：两个参数梯度范数分别为 3 和 4，总范数为 5；若 `max_norm=1`，所有梯度统一乘约 0.2，方向不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 22. 2D Convolution

**Problem.** Implement Conv2D with scalar stride, padding, and optional bias without using `conv2d`.

**中文题意。** 将输入切成滑动窗口，并让每个窗口与卷积核做加权求和，支持步长、零填充和偏置。

### Reviewed Solution

```python
def my_conv2d(x, weight, bias=None, stride=1, padding=0):
    if padding:
        x = F.pad(x, (padding, padding, padding, padding))
    _, _, h, w = x.shape
    _, _, kh, kw = weight.shape
    # patches: (B,Cin,Hout,Wout,kH,kW)
    patches = x.unfold(2, kh, stride).unfold(3, kw, stride)
    # 对 Cin、kH、kW 三个维度求和 -> (B,Cout,Hout,Wout)
    out = torch.einsum("bihwjk,oijk->bohw", patches, weight)
    if bias is not None:
        out = out + bias.view(1, -1, 1, 1)
    return out
```

**中文解释。** `unfold` 不直接计算卷积，而是创建窗口视图。`einsum` 明确表达卷积核与每个 patch 的 contraction。该实现清晰但不是高性能卷积内核。

#### 代码/API 逐项解释

- `F.pad`：按从最后一维向前的顺序填充张量；2D 图像的参数顺序是 `(left,right,top,bottom)`。
- `torch.einsum`：用爱因斯坦下标显式描述张量收缩；表达灵活但必须逐个核对每个字母代表的轴。
- `.unfold(...)`：在指定轴创建滑动窗口 view。对 `(B,C,H,W)` 先 `unfold(2,kH,stride)` 再 `unfold(3,kW,stride)`，得到 `(B,C,Hout,Wout,kH,kW)`；它通常共享原存储，窗口可能重叠，不能把输出误认为已复制的 patch tensor。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。

#### 输入与输出示例

- **输入/调用**：输入 `(B=2,Cin=3,H=32,W=32)`、卷积核 `(Cout=16,3,3,3)`、padding=1/stride=1，输出 `(2,16,32,32)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 23. Multi-Head Cross-Attention

**Problem.** Generate Q from decoder states and K/V from encoder states, with no causal mask over encoder positions.

**中文题意。** 在 encoder-decoder 模型中，decoder hidden states 产生 Q，encoder outputs 产生 K 和 V；每个 decoder query 可看见全部 encoder token。

### Reviewed Solution

```python
class MultiHeadCrossAttention(MultiHeadAttention):
    def forward(self, x_q, x_kv):
        # Q: (B,Sq,D)，K/V: (B,Skv,D)，输出长度跟随 Sq
        return super().forward(x_q, x_kv, x_kv)
```

**中文解释。** Cross-attention 与 self-attention 的核心计算相同，区别只在 Q 与 K/V 的来源。这里复用第 06 题经过审查的实现，可避免重复代码。

#### 代码/API 逐项解释



- `super().forward(x_q, x_kv, x_kv)`：复用父类 MHA 的投影、拆头、softmax 和合头逻辑，只把 Q 来源改为 `x_q`，K/V 都来自 `x_kv`。
- **长度语义**：输出序列长度跟随 query 的 `Sq`，attention 概率最后一维长度跟随 context 的 `Skv`。
- **继承边界**：这种写法要求父类 forward 接受三个输入且 mask 语义兼容；面试时应明确父类 contract，而不是只说“调用 super”。

#### 输入与输出示例

- **输入/调用**：query `(2,4,64)` 来自 decoder，context `(2,10,64)` 来自 encoder；attention 权重 `(2,H,4,10)`，输出 `(2,4,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 24. Rotary Position Embedding (RoPE)

**Problem.** Rotate consecutive feature pairs with position-dependent angles so Q/K dot products encode relative positions.

**中文题意。** 将最后一维按相邻两个元素分组，对每组执行二维旋转；不同位置使用不同角度，从而把位置信息写入 Q/K。

### Reviewed Solution

```python
def apply_rope(q, k):
    if q.shape != k.shape or q.size(-1) % 2:
        raise ValueError("q/k must match and D must be even")
    _, s, d = q.shape
    pos = torch.arange(s, device=q.device, dtype=torch.float32)[:, None]
    dims = torch.arange(0, d, 2, device=q.device, dtype=torch.float32)
    # 不同维度使用不同旋转频率，angles 形状为 (S,D/2)
    angles = pos * (10000.0 ** (-dims / d))
    cos, sin = angles.cos().to(q.dtype), angles.sin().to(q.dtype)

    def rotate(x):
        even, odd = x[..., 0::2], x[..., 1::2]
        # [a,b] -> [a*cos-b*sin, a*sin+b*cos]
        return torch.stack((even*cos - odd*sin, even*sin + odd*cos), -1).flatten(-2)

    return rotate(q), rotate(k)
```

**中文解释。** 对 Q/K 应用相同频率体系后，它们的点积依赖位置差而不是绝对位置。生产实现还会支持 `(B,H,S,Dh)` 和 KV-cache 的 position offset。

#### 代码/API 逐项解释

- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.float32`：32 位浮点 dtype；用于位置频率或归一化统计可减少 fp16/bf16 的数值误差。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。

#### 输入与输出示例

- **输入/调用**：`q,k.shape=(B,H,S,Dh)` 且 `Dh=8`；每两个通道作为二维向量按位置旋转，输出 shape 不变，位置 0 旋转角为 0。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 25. Tiled Flash-Attention Idea

**Problem.** Process K/V in blocks and use online softmax to match full attention without materializing its entire score matrix.

**中文题意。** 分块计算 attention，并为每一行维护当前最大值、指数和、输出累加器；最大值变化时必须重新缩放旧结果。

### Reviewed Solution

```python
def flash_attention(Q, K, V, block_size=32):
    b, sq, d = Q.shape
    dv = V.size(-1)
    output = Q.new_empty(b, sq, dv)
    for i in range(0, sq, block_size):
        qi = Q[:, i:i+block_size]
        rows = qi.size(1)
        row_max = Q.new_full((b, rows, 1), float("-inf"))
        row_sum = Q.new_zeros(b, rows, 1)
        acc = V.new_zeros(b, rows, dv)
        for j in range(0, K.size(1), block_size):
            kj, vj = K[:, j:j+block_size], V[:, j:j+block_size]
            scores = torch.bmm(qi, kj.transpose(1, 2)) / math.sqrt(d)
            new_max = torch.maximum(row_max, scores.amax(-1, keepdim=True))
            # 新最大值出现时，旧 exp 和旧 numerator 都要同比缩放
            correction = torch.exp(row_max - new_max)
            exp_scores = torch.exp(scores - new_max)
            acc = acc * correction + torch.bmm(exp_scores, vj)
            row_sum = row_sum * correction + exp_scores.sum(-1, keepdim=True)
            row_max = new_max
        output[:, i:i+block_size] = acc / row_sum
    return output
```

**中文解释。** Online Softmax 允许逐块处理时仍得到与完整 Softmax 相同的结果。此 Python 版本展示算法原理，但不是 fused GPU kernel，实际速度可能比 PyTorch 内置 attention 慢。

#### 代码/API 逐项解释

- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `torch.maximum`：逐元素取两张量较大值，并支持 broadcasting；online softmax 用它更新运行最大值。
- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.new_empty(...)`：`.new_empty(shape)` 只分配不初始化；只有随后完整写入时才安全。
- `.new_full(...)`：`.new_full(shape,value)` 以当前张量为模板创建常数张量，避免设备和精度不匹配。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：`Q,K,V.shape=(1,128,64)`、block=32；算法逐块维护行最大值和归一化和，输出 `(1,128,64)`，不保存完整 `(128,128)` 矩阵。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 26. LoRA Linear

**Problem.** Freeze a base linear layer and learn the low-rank update `(alpha/r)BA`.

**中文题意。** 基础 Linear 参数冻结，只训练两个低秩矩阵 A、B，并将低秩更新加到基础输出上。

### Reviewed Solution

```python
class LoRALinear(nn.Module):
    def __init__(self, in_features, out_features, rank, alpha=1.0):
        super().__init__()
        if rank <= 0:
            raise ValueError("rank must be positive")
        self.linear = nn.Linear(in_features, out_features)
        self.linear.requires_grad_(False)  # 冻结 W0 和 bias
        self.lora_A = nn.Parameter(torch.randn(rank, in_features) * 0.01)
        self.lora_B = nn.Parameter(torch.zeros(out_features, rank))
        self.scaling = alpha / rank

    def forward(self, x):
        # (...,Din) @ (Din,r) @ (r,Dout) -> (...,Dout)
        update = (x @ self.lora_A.T) @ self.lora_B.T
        return self.linear(x) + self.scaling * update
```

**中文解释。** B 初始化为 0，使训练开始时 LoRA 输出严格为 0，不改变预训练模型行为。低秩参数量从 `Din*Dout` 降为 `r*(Din+Dout)`。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.Parameter`：被 Module 自动注册的可训练张量；默认 `requires_grad=True`，会被优化器发现。
- `torch.randn`：从标准正态分布 N(0,1) 创建指定 shape 的张量；初始化参数时还应结合 fan-in/fan-out 缩放。
- `torch.zeros`：创建指定 shape 的全 0 张量；生产代码通常显式给出 `device` 和 `dtype`，避免默认落在 CPU/float32。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `.requires_grad_(...)`：`.requires_grad_(True)` 原地设置是否追踪梯度；只对浮点/复数张量有效。

#### 输入与输出示例

- **输入/调用**：基础 Linear 输入 `(2,5,64)`、LoRA rank=4；A 投影到 `(2,5,4)`，B 投影回 `(2,5,Dout)`，与 base 输出相加。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 27. ViT Patch Embedding

**Problem.** Split images into non-overlapping patches and project each flattened patch to an embedding.

**中文题意。** 把 `(B,C,H,W)` 图像切成不重叠的 `P x P` patch，展平每个 patch，再映射到 Transformer embedding。

### Reviewed Solution

```python
class PatchEmbedding(nn.Module):
    def __init__(self, img_size, patch_size, in_channels, embed_dim):
        super().__init__()
        if img_size % patch_size:
            raise ValueError("image size must divide patch size")
        self.p = patch_size
        self.num_patches = (img_size // patch_size) ** 2
        self.proj = nn.Linear(in_channels * patch_size**2, embed_dim)

    def forward(self, x):
        b, c, h, w = x.shape
        if h % self.p or w % self.p:
            raise ValueError("H and W must be divisible by patch size")
        nh, nw = h // self.p, w // self.p
        # 先拆出 patch 网格，再把每个 patch 展平成一个 token
        # (B,C,Nh,P,Nw,P) -> (B,Nh,Nw,C,P,P) -> (B,N,C*P*P)
        patches = x.reshape(b, c, nh, self.p, nw, self.p)
        patches = patches.permute(0, 2, 4, 1, 3, 5)
        patches = patches.reshape(b, nh*nw, c*self.p*self.p)
        return self.proj(patches)
```

**中文解释。** 最关键的是 `permute`：把 patch 网格维度移到前面、channel 和 patch 内部维度移到后面。使用 `Conv2d(kernel=P,stride=P)` 可以等价并更高效地实现。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.permute(...)`：`.permute(...)` 任意重排轴，参数必须覆盖每个维度一次；只改变 stride 视图。

#### 输入与输出示例

- **输入/调用**：输入图像 `(2,3,224,224)`、patch=16，得到 `14*14=196` 个 patch；展平并投影后输出 `(2,196,D)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 28. Mixture of Experts

**Problem.** Route each token to its top-k expert MLPs and combine outputs using normalized router weights.

**中文题意。** Router 为每个 token 选择 top-k experts，将它们的输出按门控概率加权求和。

### Reviewed Solution

```python
class MixtureOfExperts(nn.Module):
    def __init__(self, d_model, d_ff, num_experts, top_k=2):
        super().__init__()
        if not 1 <= top_k <= num_experts:
            raise ValueError("invalid top_k")
        self.top_k = top_k
        self.router = nn.Linear(d_model, num_experts)
        self.experts = nn.ModuleList([
            nn.Sequential(nn.Linear(d_model, d_ff), nn.ReLU(), nn.Linear(d_ff, d_model))
            for _ in range(num_experts)
        ])

    def forward(self, x):
        original = x.shape
        flat = x.reshape(-1, x.size(-1))  # 每行是一个 token
        top_logits, top_ids = self.router(flat).topk(self.top_k, dim=-1)
        gates = torch.softmax(top_logits, dim=-1)
        output = torch.zeros_like(flat)
        for slot in range(self.top_k):
            for expert_id, expert in enumerate(self.experts):
                selected = top_ids[:, slot] == expert_id
                if selected.any():
                    output[selected] += gates[selected, slot, None] * expert(flat[selected])
        return output.reshape(original)
```

**中文解释。** 这是功能正确的教学实现。生产 MoE 还需要 capacity、load-balancing loss、高效 token dispatch、跨设备 expert 并行和 dropped-token 策略。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.ModuleList`：注册一组子模块但不定义连接方式；forward 中仍需显式循环或路由。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。
- `.any(...)`：`.any()` 判断是否至少有一个 True；空 cluster 检查可用它决定重算还是保留旧中心。

#### 输入与输出示例

- **输入/调用**：输入 6 个 token、3 个 experts、top-1 routing；router 输出 `(6,3)` 概率，每个 token 只送到选中 expert，聚合输出与输入同 shape。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 29. Adam Optimizer

**Problem.** Implement Adam with first/second moments and bias correction.

**中文题意。** 为每个参数维护梯度一阶矩和平方梯度二阶矩，进行偏差修正后更新参数。

### Reviewed Solution

```python
class MyAdam:
    def __init__(self, params, lr=1e-3, betas=(0.9, 0.999), eps=1e-8):
        self.params = list(params)
        self.lr, self.beta1, self.beta2, self.eps = lr, betas[0], betas[1], eps
        self.steps = [0] * len(self.params)
        self.m = [torch.zeros_like(p) for p in self.params]
        self.v = [torch.zeros_like(p) for p in self.params]

    def step(self):
        with torch.no_grad():
            for i, p in enumerate(self.params):
                if p.grad is None:
                    continue
                self.steps[i] += 1
                t, g = self.steps[i], p.grad
                # m=beta1*m+(1-beta1)*g；v 同理累计 g^2
                self.m[i].lerp_(g, 1.0 - self.beta1)
                self.v[i].mul_(self.beta2).addcmul_(g, g, value=1.0-self.beta2)
                m_hat = self.m[i] / (1.0 - self.beta1**t)
                v_hat = self.v[i] / (1.0 - self.beta2**t)
                p.addcdiv_(m_hat, v_hat.sqrt().add_(self.eps), value=-self.lr)

    def zero_grad(self):
        # 设为 None 通常比填充 0 更省内存
        for p in self.params:
            p.grad = None
```

**中文解释。** 因为 m/v 从 0 开始，早期会偏小，所以必须除以 `1-beta^t`。这里为每个参数维护 step，比所有参数共享 step 更适合存在缺失梯度的情况。

#### 代码/API 逐项解释

- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.lerp_(...)`：`.lerp_(end,weight)` 原地线性插值；可把 moving average 更新写成稳定的一次操作。
- `.mul_(...)`：`.mul_` 是原地乘法；Adam 衰减 moving average 时避免分配新张量。
- `.addcmul_(...)`：`.addcmul_(a,b,value=...)` 原地执行 `self += value*a*b`；Adam 用它累计梯度平方。
- `.addcdiv_(...)`：`.addcdiv_(a,b,value=...)` 原地执行 `self += value*a/b`；Adam 用它完成归一化参数更新。
- `.sqrt(...)`：`.sqrt()` 逐元素开平方；方差、扩散系数等理论上非负，但浮点误差下仍应考虑 clamp/epsilon。
- `.add_(...)`：`.add_` 是原地加法；优化器用它更新参数或状态，结尾下划线表示会修改对象。

#### 输入与输出示例

- **输入/调用**：标量参数 1.0、梯度 0.1；第一步先更新一阶/二阶矩，再做 bias correction，输出是被原地更新的参数而不是新张量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 30. Cosine LR with Warmup

**Problem.** Linearly warm up to `max_lr`, then cosine-decay to `min_lr`.

**中文题意。** 前若干步线性增加学习率，之后沿半个余弦曲线平滑下降到最小学习率。

### Reviewed Solution

```python
def cosine_lr_schedule(step, total_steps, warmup_steps, max_lr, min_lr=0.0):
    if not 0 <= warmup_steps < total_steps:
        raise ValueError("invalid schedule lengths")
    if step < warmup_steps:
        # 0 -> max_lr 的线性预热
        return max_lr * step / max(warmup_steps, 1)
    if step >= total_steps:
        return min_lr
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    cosine = 0.5 * (1.0 + math.cos(math.pi * progress))
    return min_lr + (max_lr - min_lr) * cosine
```

**中文解释。** Warmup 防止随机初始化阶段的大更新破坏训练；Cosine decay 在后期逐渐减小更新幅度。`progress` 从 0 走到 1。

#### 代码/API 逐项解释



- **分段函数**：warmup 区间线性增长，cosine 区间平滑衰减，超过 total_steps 后固定为 min_lr；三个边界都应单测。
- `progress`：把当前衰减位置归一化到 `[0,1]`；`0.5*(1+cos(pi*progress))` 从 1 平滑降到 0。
- `max(warmup_steps, 1)`：warmup 为 0 时避免除 0；此时 step 0 会直接进入后续分支。
- `math.cos(x)`：对单个 Python 标量求余弦并返回 `float`；这里 x 是归一化训练进度乘 pi，不需要 autograd。它不同于 tensor `.cos()`，后者会对每个张量元素计算并保留梯度关系。
- `math.pi`：Python 双精度圆周率常量；`progress` 从 0 到 1 时，角度从 0 到 pi，使 cosine multiplier 从 1 平滑下降到 0。

#### 输入与输出示例

- **输入/调用**：`warmup=100,total=1000,max_lr=1e-3`：step 0 为 0，step 50 为 `5e-4`，step 100 为 `1e-3`，之后按 cosine 衰减到 min_lr。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 31. Gradient Accumulation

**Problem.** Accumulate gradients over micro-batches, take one optimizer step, and return average loss.

**中文题意。** 用多个小 batch 模拟一个大 batch：每次 backward 只累加梯度，所有 micro-batches 完成后再 step。

### Reviewed Solution

```python
def accumulated_step(model, optimizer, loss_fn, micro_batches):
    if not micro_batches:
        raise ValueError("micro_batches cannot be empty")
    optimizer.zero_grad()
    scale = 1.0 / len(micro_batches)
    average_loss = 0.0
    for x, y in micro_batches:
        raw_loss = loss_fn(model(x), y)
        # 先除以 micro-batch 数，使累积梯度成为平均梯度
        (raw_loss * scale).backward()
        average_loss += raw_loss.detach().item() * scale
    optimizer.step()  # 所有梯度累积完成后只更新一次
    return average_loss
```

**中文解释。** PyTorch 默认不会在 backward 时清空已有梯度，因此可自然累加。只有 micro-batch 大小相同时，简单除以数量才严格等价于大 batch mean；大小不同时应按样本数加权。

#### 代码/API 逐项解释

- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

#### 输入与输出示例

- **输入/调用**：4 个 micro-batch 各产生 loss；每次反传 `loss/4`，四次后参数 `.grad` 等价于大 batch 的平均梯度，再只调用一次 optimizer step。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 32. Top-k and Top-p Sampling

**Problem.** Apply temperature, top-k filtering, nucleus filtering, then sample one token.

**中文题意。** 调整 temperature 后，只保留 top-k 候选；再保留累计概率达到 top-p 的最小高概率集合，最后按过滤后的概率采样。

### Reviewed Solution

```python
def sample_top_k_top_p(logits, top_k=0, top_p=1.0, temperature=1.0):
    if temperature <= 0 or not 0.0 < top_p <= 1.0:
        raise ValueError("invalid sampling parameters")
    filtered = logits.clone() / temperature  # clone 避免修改调用者输入
    if top_k > 0:
        k = min(top_k, filtered.numel())
        threshold = filtered.topk(k).values[-1]
        filtered.masked_fill_(filtered < threshold, float("-inf"))
    if top_p < 1.0:
        sorted_logits, ids = filtered.sort(descending=True)
        probs = torch.softmax(sorted_logits, -1)
        # 保留使累计概率首次越过 p 的那个 token
        remove = probs.cumsum(-1) - probs > top_p
        sorted_logits.masked_fill_(remove, float("-inf"))
        filtered = torch.empty_like(filtered).scatter(0, ids, sorted_logits)
    return torch.multinomial(torch.softmax(filtered, -1), 1).item()
```

**中文解释。** 低 temperature 使分布更尖锐，高 temperature 增加随机性。Top-k 固定候选数量；top-p 根据当前分布动态决定候选数量。

#### 代码/API 逐项解释

- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.empty_like`：只分配与参照张量相同元数据的内存，不初始化数值；必须保证每个位置随后都会被写入，否则会读到未定义值。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.scatter(...)`：按照 `ids` 把排序空间中的 `sorted_logits` 写回原词表位置。这里 `dim=0`、index 与 source shape 相同，因此输出仍是 `(V,)`；未写位置来自 `empty_like`，所以必须保证 ids 是覆盖全部词表的完整排列。
- `.clone(...)`：`.clone()` 复制数据且保留梯度关系；若想复制并截断梯度通常用 `detach().clone()`。
- `.numel(...)`：`.numel()` 返回总元素数；可用于按参数量归一化或恢复原 shape。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。
- `.masked_fill_(...)`：`.masked_fill_` 是原地版本；若张量仍被 backward 需要，原地修改可能触发 autograd 版本错误。
- `.sort(...)`：`.sort(descending=True)` 返回排序值和原索引；top-p 需在排序空间累积后再映射回词表。
- `.cumsum(...)`：`.cumsum(dim)` 计算前缀和；nucleus sampling 用累计概率确定最小候选集合。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：logits `[4,3,2,1]`、top-k=2 时只保留前两项；若再用 top-p=0.8，则从排序后累计概率达到 0.8 的最小集合中采样一个索引。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 33. Beam Search

**Problem.** Expand the highest-scoring partial sequences and return the best completed sequence.

**中文题意。** 每一步保留累计 log-probability 最高的若干序列，遇到 EOS 后放入完成集合，最终返回最佳完成序列。

### Reviewed Solution

```python
def beam_search(log_prob_fn, start_token, max_len, beam_width, eos_token):
    active, completed = [(0.0, [start_token])], []
    while active and len(active[0][1]) < max_len:
        candidates = []
        for score, seq in active:
            log_probs = log_prob_fn(torch.tensor(seq))
            width = min(beam_width, log_probs.numel())
            values, ids = log_probs.topk(width)
            for value, token in zip(values.tolist(), ids.tolist()):
                item = (score + value, seq + [token])
                (completed if token == eos_token else candidates).append(item)
        # 只保留最好的 beam_width 个活跃序列
        active = sorted(candidates, key=lambda z: z[0], reverse=True)[:beam_width]
        completed = sorted(completed, key=lambda z: z[0], reverse=True)[:beam_width]
        if completed and (not active or completed[0][0] >= active[0][0]):
            break
    pool = completed or active
    return max(pool, key=lambda z: z[0])[1]
```

**中文解释。** 仓库原答案可能让未完成序列压过已完成序列，并把 `max_len` 当作扩展次数。这里将其定义为总长度并优先返回完成序列。实际生成常增加 length penalty，避免偏爱短句。

#### 代码/API 逐项解释

- `torch.tensor`：把 Python 标量/列表复制成张量；dtype 通常由输入推断，训练代码里应按需要显式指定。
- `.numel(...)`：`.numel()` 返回总元素数；可用于按参数量归一化或恢复原 shape。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.tolist(...)`：`.tolist()` 把张量同步复制为 Python 列表；适合控制流演示，不适合 GPU 热路径。

#### 输入与输出示例

- **输入/调用**：start=`<bos>`、beam width=2；第一步保留累计 log-prob 最好的两个序列，遇到 `<eos>` 的 beam 放入 completed，最终返回 token 序列和分数。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 34. Speculative Decoding Acceptance

**Problem.** Accept draft token `t` with probability `min(1,p(t)/q(t))`; on rejection sample from normalized `max(p-q,0)`.

**中文题意。** 小模型提出 token，大模型按概率比接受；若拒绝，则从目标分布与草稿分布的正残差中采样纠正 token。

### Reviewed Solution

```python
def speculative_decode(target_probs, draft_probs, draft_tokens):
    accepted = []
    for i, token_tensor in enumerate(draft_tokens):
        token = token_tensor.item()
        p = target_probs[i, token]
        q = draft_probs[i, token].clamp_min(1e-10)
        accept_prob = torch.minimum(p / q, p.new_tensor(1.0))
        if torch.rand((), device=p.device) < accept_prob:
            accepted.append(token)
            continue
        # 拒绝后用校正分布采样，并结束本轮 speculation
        residual = (target_probs[i] - draft_probs[i]).clamp_min(0)
        if residual.sum() <= 0:
            residual = target_probs[i]
        accepted.append(torch.multinomial(residual / residual.sum(), 1).item())
        break
    return accepted
```

**中文解释。** 该接受/纠正规则保证最终采样仍服从 target model，而不是 draft model。完整算法在所有 K 个草稿均接受后，还会从 target 多采样一个 token；原题只要求接受/拒绝部分。

#### 代码/API 逐项解释

- `torch.minimum`：逐元素取较小值；PPO clipping 或接受概率中用于选择保守目标。
- `torch.rand`：从 `[0,1)` 均匀分布创建张量；若参与概率判断，要确认随机张量与概率张量位于同一 device。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- `.new_tensor(...)`：`.new_tensor(data)` 以当前张量为模板创建常量，避免 CPU/GPU 与 dtype 不一致。

#### 输入与输出示例

- **输入/调用**：draft token 的概率 q=0.4、target 概率 p=0.2，接受率 `min(1,p/q)=0.5`；拒绝时从校正分布采样替代 token。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 35. Byte-Pair Encoding

**Problem.** Train a simple BPE tokenizer by repeatedly merging the most frequent adjacent symbol pair.

**中文题意。** 将词拆成字符加词尾标记，统计相邻 token pair 的加权频率，反复合并最高频 pair；编码时按学习顺序应用 merges。

### Reviewed Solution

```python
class SimpleBPE:
    def __init__(self):
        self.merges = []

    def train(self, corpus, num_merges):
        vocab = {}
        for word in corpus:
            symbols = tuple(word) + ("</w>",)
            vocab[symbols] = vocab.get(symbols, 0) + 1
        self.merges = []
        for _ in range(num_merges):
            counts = {}
            for symbols, freq in vocab.items():
                for pair in zip(symbols, symbols[1:]):
                    counts[pair] = counts.get(pair, 0) + freq
            if not counts:
                break
            best = max(counts, key=counts.get)
            self.merges.append(best)
            new_vocab = {}
            for symbols, freq in vocab.items():
                merged, i = [], 0
                while i < len(symbols):
                    if i+1 < len(symbols) and (symbols[i], symbols[i+1]) == best:
                        merged.append(symbols[i] + symbols[i+1]); i += 2
                    else:
                        merged.append(symbols[i]); i += 1
                key = tuple(merged)
                # 合并后相同的词形必须累加频率，不能覆盖
                new_vocab[key] = new_vocab.get(key, 0) + freq
            vocab = new_vocab

    def encode(self, text):
        result = []
        for word in text.split():
            symbols = list(word) + ["</w>"]
            for left, right in self.merges:
                merged, i = [], 0
                while i < len(symbols):
                    if i+1 < len(symbols) and symbols[i:i+2] == [left, right]:
                        merged.append(left + right); i += 2
                    else:
                        merged.append(symbols[i]); i += 1
                symbols = merged
            result.extend(symbols)
        return result
```

**中文解释。** Pair 频率必须乘词频，而非只统计不同词形。仓库答案在合并后可能覆盖相同 key 的频率；这里改为累加。真实 GPT tokenizer 通常基于 bytes，并处理空格和特殊 token。

#### 代码/API 逐项解释

- `.split(...)`：`.split(size_or_sections,dim)` 按固定长度或长度列表拆分；与 chunk 的“块数”语义不同。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

#### 输入与输出示例

- **输入/调用**：词频 `{low:5, lower:2}` 拆成字符后，若 `(l,o)` 最频繁则合并为 `lo`；输出是 merge 规则列表和更新后的词符序列。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 36. INT8 Quantized Linear

**Problem.** Quantize each output-channel weight row to INT8, store scales and quantized weights as buffers, then dequantize in forward.

**中文题意。** 对每个输出通道独立计算 scale，把浮点权重量化为 INT8；前向时反量化并执行 Linear。

### Reviewed Solution

```python
class Int8Linear(nn.Module):
    def __init__(self, weight, bias=None):
        super().__init__()
        # 每一行一个 scale，保持不同输出通道的动态范围
        scale = (weight.abs().amax(dim=1, keepdim=True) / 127.0).clamp_min(1e-10)
        quantized = (weight / scale).round().clamp(-127, 127).to(torch.int8)
        self.register_buffer("weight_int8", quantized)
        self.register_buffer("scale", scale)
        self.bias = nn.Parameter(bias.clone()) if bias is not None else None

    def forward(self, x):
        # INT8 -> 输入 dtype；(Dout,Din) 用 F.linear 自动转置
        weight = self.weight_int8.to(x.dtype) * self.scale.to(x.dtype)
        return F.linear(x, weight, self.bias)
```

**中文解释。** 对称 INT8 使用 `[-127,127]`，无需使用不对称的 `-128`。这份教学实现会完整反量化，因此展示的是存储与量化误差，不会带来真正 INT8 kernel 的计算加速。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.int8`：8 位有符号整数 dtype，范围 `[-128,127]`；量化时需配合 scale 才能近似还原浮点值。
- `nn.Parameter`：被 Module 自动注册的可训练张量；默认 `requires_grad=True`，会被优化器发现。
- `F.linear`：执行 `x @ weight.T + bias`；权重 shape 是 `(out_features,in_features)`。
- `.abs(...)`：`.abs()` 逐元素绝对值；Huber loss 用它判断误差落在线性还是二次区间。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.register_buffer(...)`：`.register_buffer(name,tensor)` 注册不训练但需随模型迁移/保存的状态，如位置编码或 running stats。
- `.clone(...)`：`.clone()` 复制数据且保留梯度关系；若想复制并截断梯度通常用 `detach().clone()`。

- `.round(...)`：`.round()` 逐元素取最近整数；浮点权重量化到 int8 前先除 scale、round、再 clamp。

#### 输入与输出示例

- **输入/调用**：浮点权重 `(32,64)` 量化成 int8 权重与 scale；输入 `(4,64)` 反量化/计算后输出 `(4,32)`，近似而非逐位等于浮点层。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 37. DPO Loss

**Problem.** Compute Direct Preference Optimization loss from policy/reference log-probabilities for chosen and rejected responses.

**中文题意。** 比较 policy 对 chosen/rejected 的偏好差值与 reference 的偏好差值，通过 logistic loss 提升 chosen 的相对概率。

### Reviewed Solution

```python
def dpo_loss(policy_chosen_logps, policy_rejected_logps,
             ref_chosen_logps, ref_rejected_logps, beta=0.1):
    # policy 希望 chosen-rejected margin 比 reference 更大
    policy_margin = policy_chosen_logps - policy_rejected_logps
    ref_margin = ref_chosen_logps.detach() - ref_rejected_logps.detach()
    logits = beta * (policy_margin - ref_margin)
    return -F.logsigmoid(logits).mean()
```

**中文解释。** DPO 不显式训练 reward model 或执行在线 RL。`beta` 控制相对 reference 的移动强度。Reference 是固定基准，因此应 detach。

#### 代码/API 逐项解释

- `F.logsigmoid`：稳定计算 `log(sigmoid(x))`，比先 sigmoid 再 log 更不容易在大负数处下溢。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：chosen/rejected policy log-prob 差为 1.2/0.3，reference 差为 0.7/0.4；margin=`0.6`，beta=0.1，loss=`-logsigmoid(0.06)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 38. Simplified GRPO Loss

**Problem.** Normalize rewards within each prompt group and compute negative advantage-weighted policy log-probability.

**中文题意。** 对同一 prompt 生成的多个回答做组内 reward 标准化，作为 advantage，再使用策略梯度目标更新回答概率。

### Reviewed Solution

```python
def grpo_loss(logps, rewards, group_ids, eps=1e-5):
    advantages = torch.empty_like(rewards)
    for group_id in group_ids.unique():
        selected = group_ids == group_id
        r = rewards[selected]
        # 每个 prompt 组独立计算 baseline 和尺度
        advantages[selected] = (r - r.mean()) / (r.std(unbiased=False) + eps)
    # reward/advantage 不参与梯度，只有 logps 回传到 policy
    return -(advantages.detach() * logps).mean()
```

**中文解释。** 组内均值充当 prompt-specific baseline，可降低梯度方差。若组内 reward 全相同，advantage 为 0。严格来说原题实现的是简化的 group-normalized REINFORCE；完整 GRPO 常包含 old-policy ratio、clipping、KL、token mask 等。

#### 代码/API 逐项解释

- `torch.empty_like`：只分配与参照张量相同元数据的内存，不初始化数值；必须保证每个位置随后都会被写入，否则会读到未定义值。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.unique(...)`：`.unique()` 返回去重元素；分组算法中可枚举实际出现的 group id。
- `.std(...)`：`.std(dim)` 计算标准差；组内 advantage 标准化时应加 epsilon，并明确 correction 约定。

#### 输入与输出示例

- **输入/调用**：同一 prompt 的 4 个 reward `[1,2,3,4]` 会在组内标准化成正负 advantage；输出为所有 token/sample surrogate 的平均标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 39. PPO Clipped Loss

**Problem.** Compute the clipped PPO surrogate objective from new/old log-probabilities and advantages.

**中文题意。** 用 `exp(new_logp-old_logp)` 得到重要性采样比率，将比率限制在 `[1-eps,1+eps]`，取更保守的目标。

### Reviewed Solution

```python
def ppo_loss(new_logps, old_logps, advantages, clip_ratio=0.2):
    if clip_ratio < 0:
        raise ValueError("clip_ratio must be non-negative")
    ratio = torch.exp(new_logps - old_logps.detach())
    advantage = advantages.detach()
    unclipped = ratio * advantage
    clipped = ratio.clamp(1.0-clip_ratio, 1.0+clip_ratio) * advantage
    # 取 minimum，再取负号转成要最小化的 loss
    return -torch.minimum(unclipped, clipped).mean()
```

**中文解释。** 对正 advantage，限制概率增加过多；对负 advantage，限制概率下降过多。这里只实现 policy loss，完整 PPO 还包括 value loss、entropy bonus、mask 和 KL/clip fraction 监控。

#### 代码/API 逐项解释

- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.minimum`：逐元素取较小值；PPO clipping 或接受概率中用于选择保守目标。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：old log-prob=-1、new=-0.7，ratio=`exp(0.3)=1.35`；clip=0.2 时正 advantage 使用上限 1.2，避免单步更新过大。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 40. Linear Regression Three Ways

**Problem.** Fit `y=Xw+b` using least squares, manual gradient descent, and `nn.Linear` with autograd.

**中文题意。** 用闭式最小二乘、手写 MSE 梯度下降、PyTorch Linear 三种方式求线性回归参数。

### Reviewed Solution

```python
class LinearRegression:
    def closed_form(self, X, y):
        n, d = X.shape
        # 添加全 1 列，把 bias 合并进 theta；new_ones 保持 device/dtype
        X_aug = torch.cat([X, X.new_ones(n, 1)], dim=1)
        theta = torch.linalg.lstsq(X_aug, y).solution
        return theta[:d].detach(), theta[d].detach()

    def gradient_descent(self, X, y, lr=0.01, steps=1000):
        n, d = X.shape
        w, b = X.new_zeros(d), X.new_zeros(())
        for _ in range(steps):
            error = X @ w + b - y
            # MSE 对 w/b 的解析梯度，不使用 autograd
            w = w - lr * (2.0/n) * (X.T @ error)
            b = b - lr * (2.0/n) * error.sum()
        return w, b

    def nn_linear(self, X, y, lr=0.01, steps=1000):
        layer = nn.Linear(X.size(1), 1, device=X.device, dtype=X.dtype)
        optimizer = torch.optim.SGD(layer.parameters(), lr=lr)
        for _ in range(steps):
            optimizer.zero_grad()
            loss = F.mse_loss(layer(X).squeeze(-1), y)
            loss.backward()
            optimizer.step()
        return (layer.weight.detach().squeeze(0).clone(),
                layer.bias.detach().squeeze(0).clone())
```

**中文解释。** `lstsq` 比显式求 `(X^TX)^-1` 更稳定，也能处理秩不足。手写梯度展示 MSE 数学；`nn.Linear` 展示 autograd 和 optimizer 工作流。仓库答案创建 CPU tensor，这里修正为跟随 X 的 device/dtype。

#### 代码/API 逐项解释

- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `torch.linalg.lstsq`：求最小二乘解 `argmin_theta ||X_aug @ theta - y||_2`，比显式计算逆矩阵更稳定，也能处理超定或秩不足系统。返回的是包含 `solution`、`residuals`、`rank`、`singular_values` 的结果对象；此处 `solution.shape=(D+1,)`，前 D 项是权重，最后一项是 bias。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.optim.SGD`：接收可训练参数迭代器并维护学习率、momentum、weight decay 等优化状态；最基础更新是 `param -= lr * grad`。`zero_grad -> backward -> step` 的顺序不能颠倒，且 optimizer 只会更新构造时传入的已注册参数。
- `F.mse_loss`：均方误差；默认对所有元素取 mean，回归时要确认 reduction 是否符合样本权重语义。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。
- `.clone(...)`：`.clone()` 复制数据且保留梯度关系；若想复制并截断梯度通常用 `detach().clone()`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `.new_ones(...)`：`.new_ones(shape)` 继承当前张量的 dtype/device 创建全 1 张量。
- `.parameters(...)`：`.parameters()` 递归迭代已注册参数；普通 Tensor 或未注册容器里的模块不会自动出现。

#### 输入与输出示例

- **输入/调用**：`X.shape=(100,3)`、`y.shape=(100,1)`；闭式解、手写梯度下降和 `nn.Linear` 都输出 `(100,1)` 预测，可比较参数和 MSE。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 41. OPD Loss

**Problem.** Compute teacher-weighted reverse KL `KL(student || teacher)` with optional token mask and temperature.

**中文题意。** 对一个或多个 teacher，计算 student 到 teacher 的反向 KL；按 teacher 权重组合，支持忽略 padding token 和温度蒸馏。

### Reviewed Solution

```python
def opd_loss(student_logits, teacher_logits, teacher_weights=None,
             mask=None, temperature=1.0):
    if temperature <= 0:
        raise ValueError("temperature must be positive")
    # 单 teacher (...,V) -> (1,...,V)，统一 teacher 维度
    if teacher_logits.dim() == student_logits.dim():
        teacher_logits = teacher_logits.unsqueeze(0)
    elif teacher_logits.dim() != student_logits.dim() + 1:
        raise ValueError("invalid teacher shape")

    t = float(temperature)
    student_logp = F.log_softmax(student_logits / t, dim=-1)
    student_prob = student_logp.exp()
    teacher_logp = F.log_softmax(teacher_logits.detach() / t, dim=-1)
    # 对 vocab 求和：sum_v p_s(v)[log p_s(v)-log p_t(v)]
    kl = (student_prob.unsqueeze(0) *
          (student_logp.unsqueeze(0) - teacher_logp)).sum(-1)

    teacher_count = kl.size(0)
    if teacher_weights is None:
        weights = kl.new_full((teacher_count,), 1.0 / teacher_count)
    else:
        weights = teacher_weights.to(device=kl.device, dtype=kl.dtype)
        if (weights.shape != (teacher_count,) or not torch.isfinite(weights).all()
                or (weights < 0).any() or weights.sum() <= 0):
            raise ValueError("teacher weights 必须有限、非负且总和为正")
        weights = weights / weights.sum()
    shape = (teacher_count,) + (1,) * (kl.dim()-1)
    per_token = (weights.view(shape) * kl).sum(0)

    if mask is None:
        loss = per_token.mean()
    else:
        mask = mask.to(device=per_token.device, dtype=per_token.dtype)
        # 只平均有效 token，clamp 防止全 mask 时除零
        loss = (per_token * mask).sum() / mask.sum().clamp_min(1.0)
    return loss * t**2
```

**中文解释。** Reverse KL 的期望由 student 分布加权，倾向于 mode-seeking：student 若把概率放在 teacher 几乎不支持的位置，会受到强惩罚。Teacher logits 必须 detach。乘 `T^2` 用于补偿温度导致的梯度缩放，是蒸馏中的常见约定。

#### 代码/API 逐项解释

- `F.log_softmax`：稳定地同时完成 softmax 和 log；NLL、DPO、蒸馏等需要 log-prob 时应优先使用。
- `torch.isfinite`：检查元素既不是 NaN 也不是正负 Inf，适合在 loss 前做数值健康检查。
- `.unsqueeze(...)`：`.unsqueeze(dim)` 插入长度为 1 的轴，不复制数据；常用于对齐 broadcasting 维度。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.new_full(...)`：`.new_full(shape,value)` 以当前张量为模板创建常数张量，避免设备和精度不匹配。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。
- `.all(...)`：`.all()` 判断是否所有元素均为 True；可用于检查整个 batch 是否有限或满足约束。
- `.any(...)`：`.any()` 判断是否至少有一个 True；空 cluster 检查可用它决定重算还是保留旧中心。

#### 输入与输出示例

- **输入/调用**：student/teacher logits 均为 `(B,S,V)`；先转为 log-prob，按 teacher 权重对 token loss 加权，输出一个有限标量 loss。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

---

## 最后复习：四类核心能力

| 类别 | 重点问题 | 你应该能口述的主线 |
|---|---|---|
| PyTorch 基础 | 01-04, 07-08, 15-22 | broadcasting、autograd、normalization、参数与梯度 |
| Transformer | 05-06, 09-14, 23-25 | Q/K/V shapes、mask、拆头、KV cache、位置编码 |
| LLM 系统 | 26-36 | PEFT、MoE、decoding、tokenization、quantization |
| Alignment | 37-39, 41 | preference margin、advantage、ratio clipping、KL distillation |

## 静态审查说明

- 41 道题均已包含，且每题只出现一次。
- 答案以原题约束为基础，但修复了 dtype/device、边界参数、BPE 频率覆盖、beam completion、dropout `p=1` 等问题。
- Sliding-window 与本题 Flash Attention 是算法教学版本，不代表生产级 sparse/fused kernel 性能。
- 第 38 题是简化 GRPO 目标，不等同于完整训练框架中的 GRPO。
- 按要求没有运行 notebook 或答案代码。

---

# TorchLeet 续篇（42-102）

> 来源：`TorchLeet-main/TorchLeet-main`。以下 61 题按实际 notebook 文件配对，而不是只依赖仓库中部分过时的路径索引。代码采用静态审查后的版本。

## 42. TorchLeet BPE

**Problem.** Build a vocabulary, count adjacent symbol pairs, merge the most frequent pair, and repeat for a fixed number of merges.

**中文题意。** 从词频表开始，把单词拆成字符和 `</w>`，反复统计并合并最高频相邻符号对。

### Reviewed Solution

```python
from collections import Counter

def byte_pair_encoding(corpus, num_merges=10):
    # 原 solution 仍是省略号；这里补全可学习的核心算法
    vocab = Counter(tuple(word) + ("</w>",) for word in corpus)
    merges = []
    for _ in range(num_merges):
        pairs = Counter()
        for symbols, freq in vocab.items():
            # 同一单词中同一个 pair 可能出现多次，不能用 dict comprehension 覆盖
            for pair in zip(symbols, symbols[1:]):
                pairs[pair] += freq
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        new_vocab = Counter()
        for symbols, freq in vocab.items():
            out, i = [], 0
            while i < len(symbols):
                if i+1 < len(symbols) and symbols[i:i+2] == best:
                    out.append(best[0] + best[1]); i += 2
                else:
                    out.append(symbols[i]); i += 1
            new_vocab[tuple(out)] += freq
        vocab = new_vocab
    return dict(vocab), merges
```

**中文解释。** 原答案 notebook 中函数体仍为 `...`，不能算完成解。修正版保留词频，并在不同词形合并到同一个 key 时累加频率。

#### 代码/API 逐项解释

- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `Counter(tuple(word) + ('</w>',) for word in corpus)`：把每个词拆成不可变 symbol tuple，并统计重复词频；`</w>` 保留词边界。
- `.most_common(1)`：返回频率最高的一个 `(pair,count)`；代码的 `[0][0]` 取其中 pair。
- **merge 输出**：每轮必须把旧 vocab 的词频累加到 new vocab，不能因多个旧词合并成同一表示而覆盖计数。

#### 输入与输出示例

- **输入/调用**：corpus=`['low','low','lower']`、`num_merges=2`；输出例如 merges `[('l','o'),('lo','w')]` 及合并后的 vocabulary。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 43. TorchLeet Grouped Query Attention

**Problem.** Implement GQA with more query heads than key/value heads.

**中文题意。** 用完整 Q heads 和较少 KV heads 实现注意力，并让每组 query heads 共享一份 K/V。

### Reviewed Solution

```python
class TorchLeetGQA(nn.Module):
    def __init__(self, d_model, q_heads, kv_heads):
        super().__init__()
        if d_model % q_heads or q_heads % kv_heads:
            raise ValueError("head 数不兼容")
        self.hq, self.hkv, self.dh = q_heads, kv_heads, d_model // q_heads
        self.q = nn.Linear(d_model, d_model, bias=False)
        self.k = nn.Linear(d_model, kv_heads*self.dh, bias=False)
        self.v = nn.Linear(d_model, kv_heads*self.dh, bias=False)
        self.o = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x):
        b, s, _ = x.shape
        q = self.q(x).view(b,s,self.hq,self.dh).transpose(1,2)
        k = self.k(x).view(b,s,self.hkv,self.dh).transpose(1,2)
        v = self.v(x).view(b,s,self.hkv,self.dh).transpose(1,2)
        # KV head 按组复制到 Q head 数量
        repeat = self.hq // self.hkv
        k, v = k.repeat_interleave(repeat,1), v.repeat_interleave(repeat,1)
        y = torch.softmax(q @ k.transpose(-2,-1) / math.sqrt(self.dh), -1) @ v
        return self.o(y.transpose(1,2).contiguous().view(b,s,-1))
```

**中文解释。** 仓库答案每次函数调用都新建随机 Linear，而且 K/V reshape 维度错误；修正版把投影注册为持久参数，并统一每个 head 的宽度为 `Dh`。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.repeat_interleave(...)`：`.repeat_interleave(r, dim)` 真正复制元素；GQA 用它把每个 KV head 对应到多个 Q heads。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。

#### 输入与输出示例

- **输入/调用**：输入 `(B=2,S=8,D=64)`、8 个 Q heads、2 个 KV heads；KV 各复制 4 次与 Q 对齐，输出 `(2,8,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 44. TorchLeet Attention from Scratch

**Problem.** Implement masked scaled dot-product attention and return both output and weights.

**中文题意。** 从矩阵乘法实现 attention，支持可广播 mask，并同时返回上下文向量和注意力概率。

### Reviewed Solution

```python
def attention_with_weights(q, k, v, mask=None):
    # 使用 Python 标量缩放，避免创建 CPU tensor 导致 GPU device mismatch
    scores = q @ k.transpose(-2, -1) / math.sqrt(q.size(-1))
    if mask is not None:
        scores = scores.masked_fill(~mask.to(torch.bool), float("-inf"))
    weights = torch.softmax(scores, dim=-1)
    return weights @ v, weights
```

**中文解释。** 原逻辑基本正确，但 `torch.tensor(d_k)` 默认在 CPU；GPU 输入时可能报 device mismatch。使用 `math.sqrt` 最简单安全。

#### 代码/API 逐项解释

- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：`q:(1,3,4), k/v:(1,5,4)`、mask `(1,3,5)`；返回 output `(1,3,4)` 与 attention weights `(1,3,5)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 45. TorchLeet Multi-Head Attention

**Problem.** Implement trainable multi-head self-attention.

**中文题意。** 将 Q/K/V 拆头计算注意力，再拼接输出；投影参数必须被模型持久保存和训练。

### Reviewed Solution

```python
class TorchLeetMHA(MultiHeadAttention):
    def forward(self, x, mask=None):
        # 复用第 06 题的持久 nn.Module 参数，而不是在 forward 内新建 Linear
        q, k, v = self._split(self.W_q(x)), self._split(self.W_k(x)), self._split(self.W_v(x))
        scores = q @ k.transpose(-2,-1) / math.sqrt(self.d_head)
        if mask is not None:
            scores = scores.masked_fill(~mask.to(torch.bool), float("-inf"))
        ctx = torch.softmax(scores, -1) @ v
        b, _, s, _ = ctx.shape
        return self.W_o(ctx.transpose(1,2).contiguous().view(b,s,-1))
```

**中文解释。** 仓库函数还依赖未定义的 `device`，并在每次 forward 随机重建四个 Linear，导致参数无法学习。这里改为标准 `nn.Module` 语义。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：输入 `(2,6,32)`、4 heads；每头维度 8，mask 广播到 `(2,4,6,6)`，合并后输出 `(2,6,32)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 46. TorchLeet RoPE

**Problem.** Cache rotary sine/cosine values and rotate Q/K features.

**中文题意。** 预计算位置旋转所需的 cos/sin，并应用到 query/key 的成对特征。

### Reviewed Solution

```python
class RotaryEmbedding(nn.Module):
    def __init__(self, dim, base=10000.0):
        super().__init__()
        if dim % 2:
            raise ValueError("RoPE 维度必须为偶数")
        self.register_buffer("inv_freq", base ** (-torch.arange(0,dim,2).float()/dim))

    def forward(self, x, offset=0):
        # x: (B,H,S,D)，offset 支持 KV-cache 解码
        pos = torch.arange(offset, offset+x.size(-2), device=x.device, dtype=self.inv_freq.dtype)
        angle = torch.outer(pos, self.inv_freq)
        angle = torch.cat((angle, angle), -1).to(x.dtype)[None,None]
        half = torch.cat((-x[..., x.size(-1)//2:], x[..., :x.size(-1)//2]), -1)
        return x*angle.cos() + half*angle.sin()
```

**中文解释。** 原实现的缓存布局依赖特定输入维度，且没有 offset。修正版明确使用 `(B,H,S,D)`，适合训练和增量解码。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.outer`：两个一维向量的外积：`(M)` 与 `(N)` 得到 `(M,N)`，位置和频率组合时很方便。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `.register_buffer(...)`：`.register_buffer(name,tensor)` 注册不训练但需随模型迁移/保存的状态，如位置编码或 running stats。
- `.float(...)`：`.float()` 转为 float32；混合精度中常对统计量临时升精度。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。

#### 输入与输出示例

- **输入/调用**：位置长度 4、head dim 8 时，频率表 shape `(4,4)`；cos/sin 扩成 `(4,8)` 后逐位置旋转 q/k，shape 不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 47. Sinusoidal Positional Embedding

**Problem.** Build fixed sine/cosine position vectors for Transformer inputs.

**中文题意。** 为每个位置生成固定的正弦/余弦向量，不参与训练，并按序列长度切片返回。

### Reviewed Solution

```python
class SinusoidalPosition(nn.Module):
    def __init__(self, max_len, d_model):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(max_len).float()[:,None]
        freq = torch.exp(torch.arange(0,d_model,2).float()*(-math.log(10000.0)/d_model))
        pe[:,0::2] = torch.sin(pos*freq)
        # odd d_model 时，cos 列比 sin 少一列
        pe[:,1::2] = torch.cos(pos*freq[:pe[:,1::2].shape[1]])
        self.register_buffer("pe", pe[None])

    def forward(self, x):
        return x + self.pe[:,:x.size(1)].to(x.dtype)
```

**中文解释。** 仓库答案对偶数 `d_model` 正确；这里额外兼容奇数维，并直接返回“输入加位置编码”的常见模块行为。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.zeros`：创建指定 shape 的全 0 张量；生产代码通常显式给出 `device` 和 `dtype`，避免默认落在 CPU/float32。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.sin`：逐元素正弦，位置编码中与 cos 配对，为不同频率提供相位信息。
- `torch.cos`：逐元素余弦，位置编码中与 sin 配对，使相对位移可由旋转关系表达。
- `.float(...)`：`.float()` 转为 float32；混合精度中常对统计量临时升精度。
- `.register_buffer(...)`：`.register_buffer(name,tensor)` 注册不训练但需随模型迁移/保存的状态，如位置编码或 running stats。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。
- `math.log(x)`：对正的 Python 标量求自然对数并返回 `float`；位置编码中 `-log(10000)/D` 是固定频率尺度，不需要梯度。若输入是 tensor 或需参与 autograd，应使用 tensor `.log()`。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。
- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。

#### 输入与输出示例

- **输入/调用**：`max_len=4,d_model=6` 产生位置表 `(4,6)`；位置 0 的 sin 通道为 0、cos 通道为 1，输入 batch 加上对应行后 shape 不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 48. SmolLM from Scratch

**Problem.** Assemble embeddings, RMSNorm, RoPE-GQA, SwiGLU blocks, causal masking, and a tied LM head.

**中文题意。** 将前面组件组装为小型 decoder-only language model，并输出每个 token 的 vocabulary logits。

### Reviewed Solution

```python
def rope_heads(x, offset=0):
    # x:(B,H,S,Dh)，相邻偶/奇维组成二维旋转对
    d = x.size(-1)
    if d % 2: raise ValueError("RoPE head_dim 必须为偶数")
    pos = torch.arange(offset, offset+x.size(-2), device=x.device, dtype=torch.float32)
    inv = 10000.0 ** (-torch.arange(0,d,2,device=x.device,dtype=torch.float32)/d)
    angle = torch.outer(pos, inv).to(x.dtype)[None,None]
    even, odd = x[...,0::2], x[...,1::2]
    return torch.stack((even*angle.cos()-odd*angle.sin(),
                        even*angle.sin()+odd*angle.cos()),-1).flatten(-2)

class SmolAttention(nn.Module):
    def __init__(self, d_model, q_heads, kv_heads):
        super().__init__()
        if d_model % q_heads or q_heads % kv_heads: raise ValueError("head 配置无效")
        self.hq, self.hkv, self.dh = q_heads, kv_heads, d_model//q_heads
        self.q = nn.Linear(d_model,d_model,bias=False)
        self.k = nn.Linear(d_model,kv_heads*self.dh,bias=False)
        self.v = nn.Linear(d_model,kv_heads*self.dh,bias=False)
        self.o = nn.Linear(d_model,d_model,bias=False)
    def forward(self,x):
        b,s,_=x.shape
        q=self.q(x).view(b,s,self.hq,self.dh).transpose(1,2)
        k=self.k(x).view(b,s,self.hkv,self.dh).transpose(1,2)
        v=self.v(x).view(b,s,self.hkv,self.dh).transpose(1,2)
        q,k=rope_heads(q),rope_heads(k)
        repeat=self.hq//self.hkv
        k,v=k.repeat_interleave(repeat,1),v.repeat_interleave(repeat,1)
        scores=q@k.transpose(-2,-1)/math.sqrt(self.dh)
        future=torch.triu(torch.ones(s,s,device=x.device,dtype=torch.bool),1)
        y=torch.softmax(scores.masked_fill(future,-torch.inf),-1)@v
        return self.o(y.transpose(1,2).contiguous().view(b,s,-1))

class SmolBlock(nn.Module):
    def __init__(self,d_model,q_heads,kv_heads,d_ff):
        super().__init__()
        self.n1,self.n2=nn.RMSNorm(d_model),nn.RMSNorm(d_model)
        self.attn=SmolAttention(d_model,q_heads,kv_heads)
        self.gate,self.up=nn.Linear(d_model,d_ff,bias=False),nn.Linear(d_model,d_ff,bias=False)
        self.down=nn.Linear(d_ff,d_model,bias=False)
    def forward(self,x):
        # Pre-Norm residual：先 attention，再 SwiGLU
        x=x+self.attn(self.n1(x))
        z=self.n2(x)
        return x+self.down(F.silu(self.gate(z))*self.up(z))

class SmolLM(nn.Module):
    def __init__(self, vocab, d_model, layers, q_heads, kv_heads, d_ff):
        super().__init__()
        self.embed = nn.Embedding(vocab, d_model)
        self.blocks = nn.ModuleList([SmolBlock(d_model,q_heads,kv_heads,d_ff)
                                     for _ in range(layers)])
        self.norm = nn.RMSNorm(d_model)
        self.lm_head = nn.Linear(d_model, vocab, bias=False)
        self.lm_head.weight = self.embed.weight

    def forward(self, ids):
        x = self.embed(ids)
        for block in self.blocks: x=block(x)
        return self.lm_head(self.norm(x))  # (B,S,V) raw logits
```

**中文解释。** 仓库完整答案存在 device buffer、`attention_mask=None`、外部权重文件和生成输入原地修改等问题，不能独立稳定运行。修正版真正包含 RMSNorm、RoPE、GQA、causal mask、SwiGLU、Pre-Norm residual 和 tied embedding/LM head。面试时要能从 `(B,S,D)` 一直追踪到 attention 的 `(B,H,S,Dh)`，并解释为什么 KV heads 少于 Q heads 能降低 cache 内存。

#### 代码/API 逐项解释

- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.float32`：32 位浮点 dtype；用于位置频率或归一化统计可减少 fp16/bf16 的数值误差。
- `torch.outer`：两个一维向量的外积：`(M)` 与 `(N)` 得到 `(M,N)`，位置和频率组合时很方便。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.triu`：保留矩阵上三角；`diagonal=1` 可标出严格未来位置，用于 causal mask。
- `torch.ones`：创建指定 shape 的全 1 张量，常作为 mask 的原始矩阵或正标签。
- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.inf`：正无穷常量；`-torch.inf` 常用于把被 mask 的 logits 在 softmax 后变成 0。
- `nn.RMSNorm`：按 root-mean-square 缩放而不减均值，常见于现代 LLM。
- `F.silu`：SiLU/Swish：`x*sigmoid(x)`；SwiGLU 用它处理 gate 分支后再与 value 分支逐元素相乘。
- `nn.Embedding`：把整数 token id `(...,)` 查表为 `(...,D)`；本质是权重矩阵的行索引。
- `nn.ModuleList`：注册一组子模块但不定义连接方式；forward 中仍需显式循环或路由。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.repeat_interleave(...)`：`.repeat_interleave(r, dim)` 真正复制元素；GQA 用它把每个 KV head 对应到多个 Q heads。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- `.norm(...)`：`.norm(dim=...)` 计算范数；embedding normalize 前要用 epsilon 防止零向量除 0。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：token ids `(2,16)` 经过 embedding、多个 block、final norm 和 lm head，输出 logits `(2,16,vocab_size)`；训练 target 通常右移一位。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 49. Custom Activation Module

**Problem.** Use `tanh(x)+x` after a linear layer.

**中文题意。** 实现无参数自定义激活，并嵌入简单回归模型。

### Reviewed Solution

```python
class CustomActivationModel(nn.Module):
    def __init__(self, in_features=1, out_features=1):
        super().__init__()
        self.linear = nn.Linear(in_features, out_features)

    def forward(self, x):
        z = self.linear(x)
        return torch.tanh(z) + z  # 平滑非线性 + residual
```

**中文解释。** 仓库答案正确。该激活没有参数，且所有操作都由 autograd 支持。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.tanh`：把数值压到 `(-1,1)`，且以 0 为中心；RNN 候选状态常用它控制幅度。

- `.tanh(...)`：`.tanh()` 把元素映射到 `(-1,1)`；输出与输入 shape 相同。

#### 输入与输出示例

- **输入/调用**：输入 `x.shape=(4,10)`；Linear 后逐元素执行自定义 `x*tanh(x)`，第二个 Linear 输出模型设定的 `(4,Dout)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 50. Custom Dataset and DataLoader

**Problem.** Read feature/target columns from CSV and expose Dataset indexing.

**中文题意。** 从 CSV 读取 X/y，正确实现 `__len__`、`__getitem__`，再交给 DataLoader 批处理。

### Reviewed Solution

```python
class CSVDataset(torch.utils.data.Dataset):
    def __init__(self, csv_file):
        frame = pd.read_csv(csv_file)
        # 预先转 tensor，避免每次 __getitem__ 重复转换
        self.x = torch.as_tensor(frame[["X"]].to_numpy(), dtype=torch.float32)
        self.y = torch.as_tensor(frame[["y"]].to_numpy(), dtype=torch.float32)
    def __len__(self): return self.x.size(0)
    def __getitem__(self, index): return self.x[index], self.y[index]

loader = DataLoader(CSVDataset("data.csv"), batch_size=32, shuffle=True)
```

**中文解释。** 仓库实现正确，但类名与题目要求不一致。核心 contract 是长度和单样本索引；DataLoader 再负责 shuffle、batch 和 worker。

#### 代码/API 逐项解释

- `torch.utils.data.Dataset`：数据集协议：实现 `__len__` 和 `__getitem__` 后，DataLoader 才能索引、打乱和批处理样本。
- `torch.as_tensor`：尽量复用 NumPy/已有数据的存储而不是无条件复制；转换数据集样本时要显式控制 dtype。
- `torch.float32`：32 位浮点 dtype；用于位置频率或归一化统计可减少 fp16/bf16 的数值误差。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。

#### 输入与输出示例

- **输入/调用**：CSV 一行含 5 个 feature 和 1 个 label；`dataset[0]` 输出 float32 feature `(5,)` 与 label，DataLoader batch 后成为 `(B,5)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 51. Custom DNN

**Problem.** Build a nonlinear regression network with a hidden layer and scalar output.

**中文题意。** 输入经过 Linear、ReLU、Linear，输出一个回归值。

### Reviewed Solution

```python
class DNNModel(nn.Module):
    def __init__(self, in_features=2, hidden=32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, hidden), nn.ReLU(), nn.Linear(hidden, 1)
        )
    def forward(self, x):
        # 两层线性映射之间加入 ReLU，才能拟合非线性关系
        return self.net(x)  # (B,2) -> (B,H) -> (B,1)
```

**中文解释。** 仓库模型正确。回归末层不加 Softmax/Sigmoid，才能输出任意实数。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。

#### 输入与输出示例

- **输入/调用**：输入 `(32,20)`，Sequential 依次变成 `(32,64)->(32,32)->(32,num_classes)`；输出是 raw logits。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 52. Huber Loss

**Problem.** Implement a loss that is quadratic for small errors and linear for outliers.

**中文题意。** 当绝对误差不超过 delta 时用平方损失，否则切换为线性增长，降低离群点影响。

### Reviewed Solution

```python
class HuberLoss(nn.Module):
    def __init__(self, delta=1.0):
        super().__init__()
        if delta <= 0: raise ValueError("delta 必须为正")
        self.delta = delta
    def forward(self, pred, target):
        e = (pred-target).abs()
        # 两段在 e=delta 处函数值和一阶导数都连续
        return torch.where(e <= self.delta, 0.5*e.square(),
                           self.delta*(e-0.5*self.delta)).mean()
```

**中文解释。** 仓库公式正确；修正版增加 delta 校验。Huber 在小误差处保留 MSE 的平滑性，在大误差处像 L1 一样稳健。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.where`：逐元素条件选择：`torch.where(condition, a, b)` 在条件为 True 的位置取 `a`，否则取 `b`；三者需满足 broadcasting 规则。
- `.abs(...)`：`.abs()` 逐元素绝对值；Huber loss 用它判断误差落在线性还是二次区间。
- `.square(...)`：`.square()` 逐元素平方；MSE、方差和 L2 距离常用。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：误差 `[0.5,2.0]`、delta=1：前者 loss=`0.5*0.5^2=0.125`，后者 loss=`1*(2-0.5)=1.5`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 53. Linear Regression Module

**Problem.** Define a trainable linear regression model in PyTorch.

**中文题意。** 用单个 Linear 将输入特征映射为连续预测值，并通过 MSE 与优化器训练。

### Reviewed Solution

```python
class LinearRegressionModel(nn.Module):
    def __init__(self, input_dim=1):
        super().__init__()
        self.linear = nn.Linear(input_dim, 1)
    def forward(self, x):
        # Linear 内部完成矩阵乘法与 bias 广播
        return self.linear(x)  # y_hat = XW^T + b
```

**中文解释。** 仓库答案正确。标准循环顺序是 `zero_grad -> forward -> loss -> backward -> step`。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。

- `self.linear = ...`：赋给 Module 属性后，weight/bias 才会注册到 state_dict 和 optimizer。
- `self.linear(x)`：会触发该子模块的 `__call__`，进而执行 forward 和 hooks；不要手动调用 `self.linear.forward(x)`。

#### 输入与输出示例

- **输入/调用**：输入 `X.shape=(16,3)`，`nn.Linear(3,1)` 输出预测 `(16,1)`；与同 shape target 计算回归 loss。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 54. Save and Load a Model

**Problem.** Save model weights and restore them into a new instance safely.

**中文题意。** 使用 `state_dict` 保存参数，并在相同架构实例中加载，用于推理或继续训练。

### Reviewed Solution

```python
# 保存参数，不序列化整个 Python 对象
torch.save(model.state_dict(), "model.pth")
loaded = SimpleModel()
state = torch.load("model.pth", map_location="cpu", weights_only=True)
loaded.load_state_dict(state)
loaded.eval()  # 关闭 Dropout，并让 BatchNorm 使用 running stats
```

**中文解释。** 仓库主流程正确。修正版增加 `map_location` 和 `weights_only=True`，更安全且能从 GPU checkpoint 加载到 CPU。

#### 代码/API 逐项解释

- `torch.save`：用 PyTorch 序列化对象；推荐保存 `state_dict` 和必要元数据，而不是依赖整个 Python 模型对象。
- `torch.load`：反序列化 checkpoint；加载不可信文件存在代码执行风险，且应使用 `map_location` 处理设备差异。
- `.state_dict(...)`：`.state_dict()` 返回参数和持久 buffer 的名称到张量映射，是推荐 checkpoint 边界。
- `.load_state_dict(...)`：`.load_state_dict(...)` 按名称恢复参数/buffer；`strict=True` 会报告缺失或多余键。

- `.eval(...)`：`.eval()` 等价于 `train(False)`；它不自动关闭梯度，推理仍应配合 inference_mode/no_grad。

#### 输入与输出示例

- **输入/调用**：保存 `model.state_dict()` 后得到参数名到 tensor 的映射；新建同结构模型并 load 后，相同输入应产生相同输出。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 55. TensorBoard Logging

**Problem.** Log training loss for every epoch and visualize it in TensorBoard.

**中文题意。** 创建 SummaryWriter，在训练过程中记录标量指标，结束后正确关闭 writer。

### Reviewed Solution

```python
from torch.utils.tensorboard import SummaryWriter

with SummaryWriter("runs/linear_regression") as writer:
    for epoch in range(epochs):
        optimizer.zero_grad()
        loss = criterion(model(X), y)
        loss.backward(); optimizer.step()
        writer.add_scalar("loss/train", loss.item(), epoch)
        # flush/close 由 with 自动处理，日志不会丢失
```

**中文解释。** 仓库答案正确。Step 应使用 epoch 或全局 batch step，tag 应保持稳定，才能形成连续曲线。

#### 代码/API 逐项解释

- `torch.utils.tensorboard.SummaryWriter`：把 scalar、histogram、image 等 summary 异步写入 event 文件；`with` 退出时会 flush/close。`log_dir` 决定 run 目录，重复实验应使用可区分目录以免曲线混杂。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。
- `.add_scalar(...)`：签名核心是 `add_scalar(tag, scalar_value, global_step)`；tag 决定曲线名称，global_step 决定横轴。这里输入 loss 标量和 epoch，不返回训练张量，而是向 event 日志追加一条记录。

#### 输入与输出示例

- **输入/调用**：训练第 7 step 调用 `add_scalar('train/loss',0.42,7)`；TensorBoard 读取 event 文件后显示 loss 曲线上的 `(7,0.42)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 56. Image Augmentation

**Problem.** Apply random horizontal flip, random crop, tensor conversion, and normalization.

**中文题意。** 训练集使用随机增强；测试集只做确定性预处理，保证评估可重复。

### Reviewed Solution

```python
train_tf = transforms.Compose([
    transforms.RandomHorizontalFlip(0.5),
    transforms.RandomCrop(32, padding=4),
    transforms.ToTensor(),
    transforms.Normalize((0.4914,0.4822,0.4465),(0.2470,0.2435,0.2616)),
])
test_tf = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.4914,0.4822,0.4465),(0.2470,0.2435,0.2616)),
])  # 测试集不能使用随机 crop/flip
```

**中文解释。** 仓库答案把随机训练增强也用于 test set，评估会随机波动；题面还写 28x28 而代码使用 CIFAR 常见的 padded 32x32 crop。修正版按 CIFAR-10 语义统一。

#### 代码/API 逐项解释



- `transforms.Compose([...])`：按列表顺序把前一个 transform 的输出传给下一个；随机空间增强应在 `ToTensor/Normalize` 前后按 API 输入类型要求放置，输出是最终处理后的单张图像而不是一个 batch。
- `transforms.RandomHorizontalFlip(p=0.5)`：每次调用独立采样，概率 p 水平翻转图像；shape 不变。若类别或坐标标签依赖左右方向，图像与标签必须同步变换或禁用该增强。
- `transforms.RandomCrop(32, padding=4)`：先四周补 4 像素，把 32x32 临时变为 40x40，再随机裁回 32x32；输出 shape 不变，但相当于引入最多 4 像素的平移扰动。
- `transforms.ToTensor()`：把 PIL/HWC uint8 图像转为 CHW float tensor，并把 `[0,255]` 缩放到 `[0,1]`；若输入本来就是特殊范围 tensor，不能假设会执行同样缩放。
- `transforms.Normalize(mean,std)`：逐 channel 执行 `(x[c]-mean[c])/std[c]`，shape 不变；mean/std 长度必须等于 channel 数，反可视化时要执行逆变换。

#### 输入与输出示例

- **输入/调用**：输入 PIL/RGB 图像 `(H,W,3)`；随机翻转/裁剪后 `ToTensor` 输出 `(3,H,W)` float，并按 channel mean/std 标准化。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 57. Autoencoder Anomaly Detection

**Problem.** Reconstruct MNIST images and use reconstruction error as anomaly score.

**中文题意。** 编码器压缩图像，解码器恢复到 28x28；训练后用每个样本的重建误差检测异常。

### Reviewed Solution

```python
class Autoencoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(nn.Conv2d(1,32,3,padding=1), nn.ReLU(),
                                     nn.MaxPool2d(2), nn.Conv2d(32,64,3,padding=1),
                                     nn.ReLU(), nn.MaxPool2d(2))
        self.decoder = nn.Sequential(nn.ConvTranspose2d(64,32,4,2,1), nn.ReLU(),
                                     nn.ConvTranspose2d(32,1,4,2,1), nn.Sigmoid())
    def forward(self, x): return self.decoder(self.encoder(x))

# 输入只用 ToTensor() 保持 [0,1]，与 Sigmoid 输出范围一致
anomaly_score = (model(images)-images).square().flatten(1).mean(1)
```

**中文解释。** 仓库将输入归一化到 `[-1,1]`，但 decoder 用 Sigmoid 限制到 `[0,1]`，目标范围不匹配。要么只 `ToTensor`，要么末层改 Tanh。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Conv2d`：二维卷积，典型输入 `(B,Cin,H,W)`，输出空间尺寸由 kernel/stride/padding/dilation 决定。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `nn.MaxPool2d`：在局部窗口取最大值并下采样空间尺寸；无可训练参数。
- `nn.ConvTranspose2d`：可学习上采样算子；输出尺寸需用 stride、padding、kernel 和 output_padding 联合计算。
- `nn.Sigmoid`：模块形式 sigmoid，把 logits 映射到 `(0,1)`；与 BCEWithLogitsLoss 联用时不要提前 sigmoid。
- `.square(...)`：`.square()` 逐元素平方；MSE、方差和 L2 距离常用。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：输入图像 `(8,1,28,28)`，encoder 得到低维 latent，decoder 重建 `(8,1,28,28)`；每样本重建误差 `(8,)` 可作为 anomaly score。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 58. Benchmark Training and Evaluation

**Problem.** Time training/evaluation accurately and report classification accuracy.

**中文题意。** 分别测量训练与测试耗时；GPU 上必须同步，否则只测到异步 kernel launch 时间。

### Reviewed Solution

```python
def timed_epoch(model, loader, train=False):
    # train=False 时同时关闭训练模式和梯度记录
    model.train(train)
    if torch.cuda.is_available(): torch.cuda.synchronize()
    start = time.perf_counter()
    with torch.set_grad_enabled(train):
        for x, y in loader:
            logits = model(x.to(device)); loss = F.cross_entropy(logits, y.to(device))
            if train:
                optimizer.zero_grad(); loss.backward(); optimizer.step()
    if torch.cuda.is_available(): torch.cuda.synchronize()
    return time.perf_counter()-start
```

**中文解释。** 仓库 CPU 计时逻辑可用，但题目要求至少两个 hidden layers，模型实际只有一个；GPU benchmark 还需同步。严谨微基准可用 `torch.utils.benchmark` 或 CUDA Events。

#### 代码/API 逐项解释

- `torch.cuda.is_available`：检查当前环境能否使用 CUDA；它不保证显存足够，也不代表某个特定 kernel 可用。
- `torch.cuda.synchronize`：等待当前 CUDA 工作完成；GPU 操作异步，精确计时前后必须同步。
- `torch.set_grad_enabled`：依据布尔值动态开启/关闭梯度；同一循环可在 train/eval 模式复用而不构建无用图。
- `F.cross_entropy`：直接接收未归一化 logits 与整数类别标签，内部融合 `log_softmax + NLLLoss`，更稳定也更高效。
- `time.perf_counter()`：返回高分辨率单调时钟秒数，适合测量 elapsed time；它不返回日期时间。CUDA kernel 异步，因此代码必须在起止点调用 `torch.cuda.synchronize()`，否则只测到 kernel launch 时间。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。

- `.train(...)`：`.train()` 切换模块到训练模式，影响 Dropout、BatchNorm 等有模式差异的层。

#### 输入与输出示例

- **输入/调用**：loader 有 100 个 batch；train=True 时执行 backward/step，返回 epoch 平均 loss 与耗时；eval 时不构建梯度图。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 59. CIFAR-10 CNN

**Problem.** Build a CNN with convolution, pooling, and fully connected classification layers.

**中文题意。** 处理 `(B,3,32,32)` 图像，逐步提取空间特征、下采样并输出 10 类 logits。

### Reviewed Solution

```python
class CIFAR10CNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3,32,3,padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32,64,3,padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.head = nn.Sequential(nn.Flatten(), nn.Linear(64*8*8,128),
                                  nn.ReLU(), nn.Linear(128,10))
    def forward(self, x): return self.head(self.features(x))
# 尺寸图示：32x32 -> 16x16 -> 8x8 -> 10 类 logits
```

**中文解释。** 仓库模型可运行，但只有第二个卷积后做一次 pooling。修正版展示更常见的两阶段下采样；末层返回 logits，交给 CrossEntropyLoss。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Conv2d`：二维卷积，典型输入 `(B,Cin,H,W)`，输出空间尺寸由 kernel/stride/padding/dilation 决定。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `nn.MaxPool2d`：在局部窗口取最大值并下采样空间尺寸；无可训练参数。
- `nn.Flatten`：把一段连续维合并；CNN 进入全连接层前通常保留 batch 维、展平其余维。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。

#### 输入与输出示例

- **输入/调用**：CIFAR 输入 `(32,3,32,32)` 经卷积池化和 flatten 后输出 `(32,10)` logits；argmax 得到 32 个类别 id。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 60. Automatic Mixed Precision

**Problem.** Use autocast and gradient scaling for stable mixed-precision training.

**中文题意。** 前向在低精度上下文运行，反向前放大 loss，step 时由 scaler 检查溢出并更新缩放系数。

### Reviewed Solution

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
scaler = torch.amp.GradScaler("cuda", enabled=device.type=="cuda")
for x, y in loader:
    x, y = x.to(device), y.to(device)
    optimizer.zero_grad(set_to_none=True)
    with torch.autocast(device_type=device.type, dtype=torch.float16,
                        enabled=device.type=="cuda"):
        loss = criterion(model(x), y)
    # 先缩放 loss 保护小梯度，再由 scaler 安全执行参数更新
    scaler.scale(loss).backward()
    scaler.step(optimizer); scaler.update()
```

**中文解释。** 仓库 CUDA 版本逻辑正确但使用旧 API，并强制 `.cuda()`，无 GPU 时无法运行。修正版可按设备启停 AMP。

#### 代码/API 逐项解释

- `torch.device`：描述计算设备，如 `cpu`、`cuda`；张量和模型参数必须位于兼容设备才能运算。
- `torch.cuda.is_available`：检查当前环境能否使用 CUDA；它不保证显存足够，也不代表某个特定 kernel 可用。
- `torch.amp.GradScaler`：缩放 loss 防止 fp16 小梯度下溢；在 `step` 前自动 unscale，并在溢出时跳过参数更新。
- `torch.autocast`：在选定设备上按算子自动选择较低或较高精度，以减少显存和提升吞吐，同时保留敏感算子的稳定性。
- `torch.float16`：IEEE 半精度浮点 dtype，指数/尾数范围都小于 float32，可减少显存和提高 Tensor Core 吞吐，但小梯度易下溢、大值易溢出；因此训练通常配合 autocast 和 GradScaler，而不是把整个模型无条件转成 fp16。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。

- `.scale(...)`：GradScaler `.scale(loss)` 放大 loss 后再 backward，使 fp16 梯度尽量落在可表示范围。
- `.update(...)`：GradScaler `.update()` 根据本轮是否溢出调整缩放因子，必须在 step 之后调用。

#### 输入与输出示例

- **输入/调用**：CUDA 输入 fp32 batch；autocast 让部分矩阵乘用 fp16，loss 仍可保持 fp32；GradScaler 完成缩放 backward 和安全 step。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 61. Dynamic Quantization of an LSTM LM

**Problem.** Quantize LSTM/Linear weights dynamically for CPU inference.

**中文题意。** 语言模型训练时输出 logits；训练完成后切到 eval/CPU，并动态量化 LSTM 和 Linear 权重。

### Reviewed Solution

```python
class LanguageModel(nn.Module):
    def __init__(self, vocab, embed, hidden):
        super().__init__()
        self.embedding = nn.Embedding(vocab, embed)
        self.lstm = nn.LSTM(embed, hidden, batch_first=True)
        self.fc = nn.Linear(hidden, vocab)
    def forward(self, ids):
        out, _ = self.lstm(self.embedding(ids))
        return self.fc(out[:,-1])  # 返回 logits，不在模型里 Softmax

model.eval().cpu()
quantized = torch.ao.quantization.quantize_dynamic(model, {nn.LSTM,nn.Linear},
                                                   dtype=torch.qint8)
```

**中文解释。** 仓库在模型中先 Softmax，再交给 `CrossEntropyLoss`，这是错误组合，因为该 loss 需要 raw logits。动态量化主要面向 CPU inference，不用于继续训练。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Embedding`：把整数 token id `(...,)` 查表为 `(...,D)`；本质是权重矩阵的行索引。
- `nn.LSTM`：带输入门、遗忘门、输出门和 cell state 的循环层；输出包括所有时间步输出及最终 `(h,c)`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.ao.quantization.quantize_dynamic`：把支持的权重密集算子动态量化；激活在运行时量化，CPU 模型通常受益更明显。
- `torch.qint8`：PyTorch 量化算子使用的有符号 8 位量化 dtype，内部同时携带量化参数。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.eval(...)`：`.eval()` 等价于 `train(False)`；它不自动关闭梯度，推理仍应配合 inference_mode/no_grad。
- `.cpu(...)`：`.cpu()` 把张量迁移到 CPU；若原张量在 GPU，会发生设备间复制和同步。

#### 输入与输出示例

- **输入/调用**：token ids `(B,S)` 经 embedding/LSTM/Linear 输出 `(B,S,V)`；动态量化后 LSTM/Linear 权重为 qint8，接口 shape 不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 62. RNN from Scratch

**Problem.** Implement the recurrent hidden-state update manually and predict from the final state.

**中文题意。** 对每个时间步执行 `h_t=tanh(x_t Wxh+h_{t-1}Whh+b)`，最后把 hidden state 映射为预测。

### Reviewed Solution

```python
class ManualRNN(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.Wx = nn.Parameter(torch.randn(input_dim,hidden_dim)*0.1)
        self.Wh = nn.Parameter(torch.randn(hidden_dim,hidden_dim)*0.1)
        self.b = nn.Parameter(torch.zeros(hidden_dim))
        self.out = nn.Linear(hidden_dim, output_dim)
    def forward(self, x):
        # 初始 hidden state 必须与输入同 device、同 dtype
        h = x.new_zeros(x.size(0), self.hidden_dim)
        for t in range(x.size(1)):
            h = torch.tanh(x[:,t] @ self.Wx + h @ self.Wh + self.b)
        return self.out(h)
```

**中文解释。** 仓库答案正确，并正确让初始 hidden state 跟随输入 device。长序列中普通 RNN 容易梯度消失，LSTM/GRU 用门控缓解。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Parameter`：被 Module 自动注册的可训练张量；默认 `requires_grad=True`，会被优化器发现。
- `torch.randn`：从标准正态分布 N(0,1) 创建指定 shape 的张量；初始化参数时还应结合 fan-in/fan-out 缩放。
- `torch.zeros`：创建指定 shape 的全 0 张量；生产代码通常显式给出 `device` 和 `dtype`，避免默认落在 CPU/float32。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.tanh`：把数值压到 `(-1,1)`，且以 0 为中心；RNN 候选状态常用它控制幅度。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.tanh(...)`：`.tanh()` 把元素映射到 `(-1,1)`；输出与输入 shape 相同。

#### 输入与输出示例

- **输入/调用**：输入序列 `(B=3,S=5,Din=4)`、hidden=8；初始 h 为 `(3,8)`，循环 5 步后输出序列 `(3,5,8)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 63. Custom Autograd Learned-SiLU

**Problem.** Implement `slope*x*sigmoid(x)` with a custom backward pass.

**中文题意。** 自定义 `autograd.Function`，同时计算输入 x 和可学习 slope 的梯度。

### Reviewed Solution

```python
class LearnedSiLU(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, slope):
        ctx.save_for_backward(x, slope)
        return slope * x * torch.sigmoid(x)
    @staticmethod
    def backward(ctx, grad_out):
        x, slope = ctx.saved_tensors
        s = torch.sigmoid(x)
        grad_x = grad_out * slope * (s + x*s*(1-s))
        # slope 可能是标量参数，必须把广播后的梯度求和回原形状
        grad_slope = (grad_out*x*s).sum_to_size(slope.shape)
        return grad_x, grad_slope
```

**中文解释。** 仓库未正确保存 slope tensor，且 `grad_slope` 形状可能与参数不符，后面还访问不存在的 `model.linear`。修正版满足 autograd 的形状 contract。

#### 代码/API 逐项解释

- `torch.autograd.Function`：自定义 autograd 的底层接口；静态 `forward` 保存 backward 所需信息，静态 `backward` 必须按输入顺序返回梯度。
- `torch.sigmoid`：把任意实数压到 `(0,1)`；大正数接近 1、大负数接近 0，可解释为二分类概率或门值。

- **自定义 backward contract**：forward 有 `(x,slope)` 两个输入，所以 backward 必须返回两个梯度；每个梯度 shape 必须能与对应输入一致。
- `ctx.saved_tensors`：只取回 forward 显式保存的 x/slope；这些值用于解析求导，不能在 forward 后原地修改。
- `.save_for_backward(...)`：`ctx.save_for_backward(...)` 保存 backward 必需张量；自定义 autograd 不应把大张量随意挂到 ctx 普通属性。
- `.sigmoid(...)`：`.sigmoid()` 把每个元素映射到 `(0,1)`；可作为概率或 gate，但极端输入会进入饱和区。
- `.sum_to_size(...)`：`.sum_to_size(shape)` 把 broadcasting 后的梯度沿扩展轴求和回原参数 shape。

#### 输入与输出示例

- **输入/调用**：输入 x `(4,)` 和可学习 beta 标量；forward 输出 `x*sigmoid(beta*x)`，backward 必须分别返回 `grad_x` 与汇总后的 `grad_beta`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 64. GAN

**Problem.** Alternate discriminator and generator updates on real and generated samples.

**中文题意。** 判别器学习区分真假，生成器学习让假样本被判为真；两个优化步骤必须隔离梯度。

### Reviewed Solution

```python
# 判别器末层返回 logits，使用更稳定的 BCEWithLogitsLoss
loss_fn = nn.BCEWithLogitsLoss()
optimizer_D.zero_grad()
d_loss = loss_fn(D(real), torch.ones_like(D(real))) + \
         loss_fn(D(G(z).detach()), torch.zeros_like(D(real)))
d_loss.backward(); optimizer_D.step()

optimizer_G.zero_grad()
fake_logits = D(G(z))  # 此处不能 detach，梯度需要回到 G
g_loss = loss_fn(fake_logits, torch.ones_like(fake_logits))
g_loss.backward(); optimizer_G.step()
```

**中文解释。** 仓库 Sigmoid+BCELoss 在数学上正确，但 logits 版本数值更稳定。训练 D 时 detach G 输出；训练 G 时保留完整图。

#### 代码/API 逐项解释

- `nn.BCEWithLogitsLoss`：稳定融合 sigmoid 与二元交叉熵，输入应是 raw logits，目标通常是 0/1 浮点张量。
- `torch.ones_like`：创建与参照张量相同 shape、dtype、device 的全 1 张量，常用于标签、mask 或默认乘法因子。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。

#### 输入与输出示例

- **输入/调用**：真实 batch `(16,...)` 标签全 1，生成 batch标签全 0；判别器返回 `(16,1)` logits，生成器目标使用全 1 欺骗判别器。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 65. Seq2Seq with Bahdanau-Style Attention

**Problem.** Encode a source sequence and decode tokens using attention over encoder outputs.

**中文题意。** Encoder LSTM 输出整段 memory；Decoder 每步根据 hidden state 对 source positions 计算权重和 context。

### Reviewed Solution

```python
class AdditiveAttention(nn.Module):
    def __init__(self, hidden):
        super().__init__()
        self.energy = nn.Linear(2*hidden, hidden)
        self.score = nn.Linear(hidden, 1, bias=False)
    def forward(self, query, memory, src_mask=None):
        # 将 decoder query 复制到每个 source 位置后逐位置打分
        # query:(B,H), memory:(B,S,H) -> scores:(B,S)
        q = query[:,None].expand(-1,memory.size(1),-1)
        scores = self.score(torch.tanh(self.energy(torch.cat((q,memory),-1)))).squeeze(-1)
        if src_mask is not None: scores = scores.masked_fill(~src_mask, float("-inf"))
        weights = torch.softmax(scores,-1)
        return torch.bmm(weights[:,None], memory).squeeze(1), weights
```

**中文解释。** 仓库实现对固定 source length 可用，但把注意力输出维度写死为 `src_seq_length`，无法自然支持变长与 padding。修正版逐位置打分并支持 mask。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.tanh`：把数值压到 `(-1,1)`，且以 0 为中心；RNN 候选状态常用它控制幅度。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `.expand(...)`：`.expand(...)` 用 stride=0 创建广播视图而不复制；不能把它当成独立存储原地写。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.tanh(...)`：`.tanh()` 把元素映射到 `(-1,1)`；输出与输入 shape 相同。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：encoder states `(B,Src,H)`、decoder hidden `(B,H)`；attention 权重 `(B,Src)` 和为 1，context 输出 `(B,H)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 66. Transformer Encoder from Scratch

**Problem.** Combine positional encoding, MHA, FFN, residuals, normalization, and padding masks.

**中文题意。** 搭建完整 encoder block，并确保 padding token 不参与 key/value attention。

### Reviewed Solution

```python
class EncoderBlock(nn.Module):
    def __init__(self, d_model, heads, d_ff):
        super().__init__()
        self.attn = nn.MultiheadAttention(d_model, heads, batch_first=True)
        self.ff = nn.Sequential(nn.Linear(d_model,d_ff),nn.ReLU(),nn.Linear(d_ff,d_model))
        self.n1, self.n2 = nn.LayerNorm(d_model), nn.LayerNorm(d_model)
    def forward(self, x, padding_mask=None):
        # key_padding_mask=True 表示该 key 不可见
        a, _ = self.attn(self.n1(x),self.n1(x),self.n1(x),
                         key_padding_mask=padding_mask, need_weights=False)
        x = x + a
        return x + self.ff(self.n2(x))
```

**中文解释。** 仓库核心 block 正确，但题面要求 padding 支持，答案却没有把 mask 传入 attention。修正版补上这一关键路径。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.MultiheadAttention`：官方多头注意力层；必须核对 `batch_first`、mask 形状和布尔 mask 语义。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `nn.LayerNorm`：对每个样本最后若干维独立归一化，训练和推理均使用当前输入统计。

#### 输入与输出示例

- **输入/调用**：输入 `(B=2,S=12,D=64)` 与 padding mask；MHA、FFN、两次 residual/norm 后输出仍为 `(2,12,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 67. Grad-CAM

**Problem.** Use target-layer activations and class gradients to produce a localization heatmap.

**中文题意。** 保存卷积激活及其梯度，按空间平均梯度作为 channel 权重，得到 ReLU 后的热力图。

### Reviewed Solution

```python
activations = gradients = None
def forward_hook(_m,_i,out):
    global activations, gradients
    activations = out
    out.register_hook(lambda g: globals().__setitem__("gradients", g))

handle = model.layer4[-1].register_forward_hook(forward_hook)
logits = model(image)
model.zero_grad(set_to_none=True)
logits[0, logits.argmax(1)].backward()
weights = gradients.mean((2,3), keepdim=True)
cam = (weights*activations).sum(1).relu()
cam = cam / cam.amax((1,2), keepdim=True).clamp_min(1e-8)
handle.remove()  # hook 用完必须移除
```

**中文解释。** 仓库使用已弃用的 module backward hook，并把已归一化 tensor 转 PIL 后再次归一化。修正版直接在 activation tensor 注册梯度 hook，并安全归一化热图。

#### 代码/API 逐项解释

- `.register_hook(...)`：张量 `.register_hook` 在其梯度生成时执行回调；可捕获中间激活梯度。
- `.register_forward_hook(...)`：`.register_forward_hook` 在模块 forward 后取得输入输出；Grad-CAM 用它保存 feature map，结束后要 remove。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.argmax(...)`：`.argmax(dim)` 返回最大值索引；分类输出是类别 id，K-Means 则是最近中心 id。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `handle.remove()`：解除 `register_forward_hook` 返回的 hook handle；若不移除，后续每次 forward 都会继续执行回调，可能重复保存激活、持有引用并造成内存泄漏。

- `.relu(...)`：`.relu()`/`torch.relu` 逐元素把负数置 0；不会改变 shape。

#### 输入与输出示例

- **输入/调用**：分类模型输入 `(1,3,H,W)`；hook 保存 feature `(1,C,h,w)` 与其梯度，通道权重平均后得到 Grad-CAM `(1,1,h,w)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 68. 3D CNN Segmentation

**Problem.** Combine slice-wise 2D features with 3D convolutions and optimize Dice loss.

**中文题意。** 对体数据保持统一 `(B,C,D,H,W)` 布局，输出同布局二值 segmentation logits。

### Reviewed Solution

```python
class Small3DSegmenter(nn.Module):
    def __init__(self, in_channels=1):
        super().__init__()
        self.net = nn.Sequential(nn.Conv3d(in_channels,16,3,padding=1),nn.ReLU(),
                                 nn.Conv3d(16,16,3,padding=1),nn.ReLU(),
                                 nn.Conv3d(16,1,1))
    def forward(self,x): return self.net(x)  # 返回 logits

def dice_loss(logits, target, eps=1e-6):
    pred = logits.sigmoid()
    dims = tuple(range(1,pred.ndim))
    dice = (2*(pred*target).sum(dims)+eps)/(pred.sum(dims)+target.sum(dims)+eps)
    return 1-dice.mean()  # 最小化 1-Dice，不是 Dice coefficient
```

**中文解释。** 仓库 mask 布局为 `(B,D,1,H,W)`、输出为 `(B,1,D,H,W)`，会错误广播；还把 Dice coefficient 当 loss 最小化，方向相反。这里修正两处严重错误。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Conv3d`：三维卷积，典型输入 `(B,Cin,D,H,W)`，用于体数据或时空局部特征。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

- `.sigmoid(...)`：`.sigmoid()` 把每个元素映射到 `(0,1)`；可作为概率或 gate，但极端输入会进入饱和区。

#### 输入与输出示例

- **输入/调用**：体数据输入 `(2,1,D=16,H=64,W=64)`；模型输出 logits `(2,num_classes,16,64,64)`，Dice loss 输出标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 69. AlexNet

**Problem.** Recreate the five-convolution, three-linear AlexNet classifier.

**中文题意。** 输入 224x224 RGB 图像，经 5 个卷积和 3 个全连接层输出类别 logits。

### Reviewed Solution

```python
class AlexNetCompact(nn.Module):
    def __init__(self, classes=10):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3,96,11,4,2),nn.ReLU(),nn.MaxPool2d(3,2),
            nn.Conv2d(96,256,5,padding=2),nn.ReLU(),nn.MaxPool2d(3,2),
            nn.Conv2d(256,384,3,padding=1),nn.ReLU(),
            nn.Conv2d(384,384,3,padding=1),nn.ReLU(),
            nn.Conv2d(384,256,3,padding=1),nn.ReLU(),nn.MaxPool2d(3,2))
        self.head = nn.Sequential(nn.Flatten(),nn.Dropout(),nn.Linear(256*6*6,4096),
                                  nn.ReLU(),nn.Dropout(),nn.Linear(4096,4096),
                                  nn.ReLU(),nn.Linear(4096,classes))
    def forward(self,x):
        # 卷积提取空间特征，展平后由三层分类头输出 logits
        return self.head(self.features(x))
```

**中文解释。** 仓库架构正确。CIFAR-10 必须先 resize 到 224；500 epochs 很昂贵，只是示例配置而非必要条件。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Conv2d`：二维卷积，典型输入 `(B,Cin,H,W)`，输出空间尺寸由 kernel/stride/padding/dilation 决定。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `nn.MaxPool2d`：在局部窗口取最大值并下采样空间尺寸；无可训练参数。
- `nn.Flatten`：把一段连续维合并；CNN 进入全连接层前通常保留 batch 维、展平其余维。
- `nn.Dropout`：训练时按概率 p 置零并除以 `1-p` 保持期望，eval 时原样返回。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。

#### 输入与输出示例

- **输入/调用**：输入 `(B,3,224,224)` 经五层卷积/池化和 classifier 后输出 `(B,num_classes)` logits。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 70. CNN Initialization Strategies

**Problem.** Compare zero, random, Xavier, and Kaiming initialization.

**中文题意。** 对 Conv/Linear 应用不同初始化，并理解对称性、信号方差和激活函数匹配。

### Reviewed Solution

```python
def init_weights(module, kind="kaiming"):
    if not isinstance(module,(nn.Conv2d,nn.Linear)): return
    if kind == "zero": nn.init.zeros_(module.weight)
    elif kind == "random": nn.init.normal_(module.weight,0,0.01)
    elif kind == "xavier": nn.init.xavier_normal_(module.weight)
    elif kind == "kaiming": nn.init.kaiming_normal_(module.weight,mode="fan_in",
                                                    nonlinearity="relu")
    else: raise ValueError("未知初始化")
    if module.bias is not None: nn.init.zeros_(module.bias)
```

**中文解释。** 仓库总体正确，但 random 默认标准差 1 往往过大，Kaiming Conv 使用 `fan_out` 与前向方差目标不一致。全零初始化让同层神经元保持对称，无法学出不同特征。

#### 代码/API 逐项解释

- `nn.Conv2d`：二维卷积，典型输入 `(B,Cin,H,W)`，输出空间尺寸由 kernel/stride/padding/dilation 决定。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.init.zeros_`：原地把参数置 0；尾层或 bias 初始化常用，结尾下划线表示原地操作。
- `nn.init.normal_`：按正态分布原地初始化；需结合层宽选择标准差。
- `nn.init.xavier_normal_`：根据 fan-in 与 fan-out 缩放正态初始化，适合近似对称激活。
- `nn.init.kaiming_normal_`：根据 fan-in/out 与非线性增益初始化，常用于 ReLU 网络。

- `.zeros_(...)`：`.zeros_()` 原地清零；会修改原存储，不能破坏 backward 所需中间值。
- `.normal_(...)`：`.normal_(mean,std)` 原地填充正态随机数；参数初始化应放在 `no_grad` 中。

#### 输入与输出示例

- **输入/调用**：对 Conv2d/Linear 遍历调用初始化；权重 shape 不变但分布改变，bias 被置 0，可打印均值/std 验证。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 71. CNN Layers from Scratch

**Problem.** Use custom convolution and max-pooling modules inside the final CNN.

**中文题意。** 不允许 `nn.Conv2d/MaxPool2d`；自定义层必须真正用于模型，而不只是定义后闲置。

### Reviewed Solution

```python
class ScratchCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = Conv2dCustom(3,32,3,padding=1)
        self.conv2 = Conv2dCustom(32,64,3,padding=1)
        self.pool = MaxPool2dCustom(2,2)
        self.head = nn.Sequential(nn.Flatten(),nn.Linear(64*16*16,128),
                                  nn.ReLU(),nn.Linear(128,10))
    def forward(self,x):
        # 修复仓库最终模型误用内置 Conv/Pool 的问题
        return self.head(self.pool(torch.relu(self.conv2(torch.relu(self.conv1(x))))))
```

**中文解释。** 仓库自定义层本身基本正确，但最后 `CNNModel` 仍使用内置层，违反题目核心约束。自定义输出还应使用 `x.new_zeros` 以保持 dtype。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Flatten`：把一段连续维合并；CNN 进入全连接层前通常保留 batch 维、展平其余维。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `torch.relu`：函数式逐元素 ReLU，计算 `max(0,x)`，输出 shape/dtype/device 与输入一致；负值梯度为 0、正值梯度为 1、零点采用梯度 0。这里用于自定义卷积层之间的激活，不会引入参数。

- `.relu(...)`：`.relu()`/`torch.relu` 逐元素把负数置 0；不会改变 shape。

#### 输入与输出示例

- **输入/调用**：输入 `(4,1,28,28)` 经自定义卷积/池化，flatten 后送 Linear，输出 `(4,num_classes)`；必须确认真正调用的是自定义层。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 72. LSTM from Scratch

**Problem.** Implement all four LSTM gates and compare with `nn.LSTM`.

**中文题意。** 手写 input/forget/output/candidate gates，更新 cell 与 hidden state，并输出每个时间步或最后一步预测。

### Reviewed Solution

```python
def lstm_step(x, h, c, Wx, Wh, b):
    # 一次算出 4H，再沿最后维拆门，效率高于四次独立 matmul
    gates = x @ Wx + h @ Wh + b
    i, f, o, g = gates.chunk(4, dim=-1)
    i, f, o, g = i.sigmoid(), f.sigmoid(), o.sigmoid(), g.tanh()
    c = f*c + i*g
    h = o*c.tanh()
    return h, c

# 初始状态必须确定且跟随输入设备
h = x.new_zeros(x.size(0), hidden_size)
c = x.new_zeros(x.size(0), hidden_size)
```

**中文解释。** 仓库 gate 公式正确，但每次 forward 随机初始化 h/c，导致相同输入输出不确定，并在 GPU 上 device mismatch。应从零初始化或显式传入状态。

#### 代码/API 逐项解释

- `.chunk(...)`：`.chunk(n,dim)` 尽量把某维分成 n 块；该维不能整除时块大小可能不完全相同。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.sigmoid(...)`：`.sigmoid()` 把每个元素映射到 `(0,1)`；可作为概率或 gate，但极端输入会进入饱和区。
- `.tanh(...)`：`.tanh()` 把元素映射到 `(-1,1)`；输出与输入 shape 相同。

#### 输入与输出示例

- **输入/调用**：单步输入 `x:(B,Din)`、旧状态 `h,c:(B,H)`；四个 gate 更新后返回新 `h,c`，两者 shape 都是 `(B,H)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 73. Full DPO Utilities

**Problem.** Compute sequence log-probabilities and DPO loss with a frozen reference.

**中文题意。** 对 shifted labels 求每条序列 token log-prob 总和，再计算 policy/reference 的 chosen-rejected margin。

### Reviewed Solution

```python
def sequence_logps(logits, labels, mask=None):
    # token t 的 logits 预测 token t+1
    logp = F.log_softmax(logits[:,:-1],-1)
    chosen = logp.gather(-1,labels[:,1:,None]).squeeze(-1)
    if mask is not None: chosen = chosen*mask[:,1:]
    return chosen.sum(-1)

def full_dpo(pc, pr, rc, rr, beta=.1):
    margin = (pc-pr) - (rc-rr).detach()
    return -F.logsigmoid(beta*margin).mean()
```

**中文解释。** v3 仓库实现符合公式。关键是 sequence shift、padding mask 和 token log-prob 求和，而不是平均。

#### 代码/API 逐项解释

- `F.log_softmax`：稳定地同时完成 softmax 和 log；NLL、DPO、蒸馏等需要 log-prob 时应优先使用。
- `F.logsigmoid`：稳定计算 `log(sigmoid(x))`，比先 sigmoid 再 log 更不容易在大负数处下溢。
- `.gather(...)`：`.gather(dim,index)` 按索引从指定轴取值；index shape 决定输出 shape。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

#### 输入与输出示例

- **输入/调用**：logits `(B,S,V)`、labels/mask `(B,S)`；gather 得每 token log-prob，再按 mask 求 sequence log-prob `(B,)`，DPO 最终输出标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 74. Gradient Checkpointing

**Problem.** Save only inputs during forward and recompute the function during backward.

**中文题意。** 用额外计算换显存：forward 不保存中间激活，backward 时重新构建带梯度的计算图。

### Reviewed Solution

```python
class CheckpointFn(torch.autograd.Function):
    @staticmethod
    def forward(ctx, fn, *args):
        # forward 不建立中间激活图，只保存重算所需输入
        ctx.fn = fn
        ctx.needs = tuple(x.requires_grad for x in args)
        ctx.save_for_backward(*args)
        with torch.no_grad(): return fn(*args)
    @staticmethod
    def backward(ctx, grad_out):
        args = tuple(x.detach().requires_grad_(need)
                     for x,need in zip(ctx.saved_tensors,ctx.needs))
        with torch.enable_grad(): out = ctx.fn(*args)
        grad_args=[x for x,need in zip(args,ctx.needs) if need]
        computed=torch.autograd.grad(out,grad_args,grad_out,allow_unused=True)
        it=iter(computed)
        grads=tuple(next(it) if need else None for need in ctx.needs)
        return (None,*grads)

def checkpoint_from_scratch(fn,*tensor_args):
    # fn 使用的所有可训练 tensor（包括 functional parameters）都必须显式传入
    return CheckpointFn.apply(fn,*tensor_args)

# 生产代码推荐官方非 reentrant 版本，它会处理参数、嵌套结构和 RNG 状态
# y = torch.utils.checkpoint.checkpoint(module, x, use_reentrant=False)
```

**中文解释。** 自定义 `Function.backward` 只能为 `forward` 的 tensor 参数返回梯度；如果 `fn` 在闭包里偷偷捕获 `module.parameters()`，这些参数不会自动得到梯度，因此从零版本必须把所有求导 tensor 显式传入并采用 functional call。仓库的简化实现还会把 `requires_grad=False` tensor 传给 `autograd.grad` 而报错。生产环境应使用官方 `torch.utils.checkpoint.checkpoint(..., use_reentrant=False)`；它还能保存/恢复 RNG state，使包含 Dropout 的重算与原 forward 一致。“bitwise identical”并非跨所有设备/kernel 的合理承诺，应使用容差和确定性配置验证。

#### 代码/API 逐项解释

- `torch.autograd.Function`：自定义 autograd 的底层接口；静态 `forward` 保存 backward 所需信息，静态 `backward` 必须按输入顺序返回梯度。
- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- `torch.enable_grad`：在外层禁用梯度时临时重新开启记录；手写 gradient checkpoint backward 会重新计算 forward。
- `torch.autograd.grad`：直接返回指定输出对指定输入的梯度，不自动累加到所有 `.grad`；手写 backward/checkpoint 常使用。
- `torch.utils.checkpoint.checkpoint`：官方 activation checkpoint：forward 不保存全部中间激活，backward 时重算以用计算换显存。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。

- `.save_for_backward(...)`：`ctx.save_for_backward(...)` 保存 backward 必需张量；自定义 autograd 不应把大张量随意挂到 ctx 普通属性。
- `.requires_grad_(...)`：`.requires_grad_(True)` 原地设置是否追踪梯度；只对浮点/复数张量有效。
- `.apply(...)`：自定义 `autograd.Function.apply(...)` 是进入其 forward/backward 的正确入口，不直接实例化 Function。

#### 输入与输出示例

- **输入/调用**：函数 `fn(x)` 的 forward 不保存中间激活；backward 收到上游梯度后重算 fn，返回与 x 同 shape 的梯度，用更多计算换更少显存。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 75. Full GRPO Objective

**Problem.** Combine group-normalized advantages, PPO-style clipping, and reference KL penalty.

**中文题意。** 每个 prompt 内标准化 rewards，再用 old/new policy ratio 的 clipped objective 更新，并限制偏离 reference。

### Reviewed Solution

```python
def full_grpo(new_logp, old_logp, ref_logp, rewards, group_size,
              clip=.2, beta=.01):
    grouped = rewards.view(-1,group_size)
    adv = ((grouped-grouped.mean(1,keepdim=True)) /
           grouped.std(1,unbiased=False,keepdim=True).clamp_min(1e-6)).reshape(-1).detach()
    ratio = torch.exp(new_logp-old_logp.detach())
    pg = -torch.minimum(ratio*adv, ratio.clamp(1-clip,1+clip)*adv).mean()
    # Schulman 非负 KL estimator：令 r=pi_ref/pi_policy，r-log(r)-1 >= 0
    log_r = ref_logp.detach()-new_logp
    kl = (torch.exp(log_r)-log_r-1).mean()
    return pg + beta*kl
```

**中文解释。** 组内 advantage 必须按 prompt 分组，不能跨 prompt 标准化。旧策略用于 PPO ratio，reference 策略用于 KL 约束，两者角色不同。简单的 `(new_logp-ref_logp).mean()` 在有限样本上可为负，不适合作为逐样本 penalty；修正版使用常见的非负 KL estimator。若有完整 vocabulary logits，直接计算 `sum p_policy(log p_policy-log p_ref)` 更清晰。

#### 代码/API 逐项解释

- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.minimum`：逐元素取较小值；PPO clipping 或接受概率中用于选择保守目标。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。

- `.std(...)`：`.std(dim)` 计算标准差；组内 advantage 标准化时应加 epsilon，并明确 correction 约定。
- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：每组 4 个 reward 先标准化；new/old ratio 经 clip，另加与 reference 的 KL penalty，最终输出 batch/token 平均标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 76. LoRA Injection and Merge

**Problem.** Wrap selected Linear layers with LoRA and merge the learned update back.

**中文题意。** 冻结基础 Linear，训练低秩 A/B；部署前把更新合并进原权重并移除 adapter。

### Reviewed Solution

```python
class MergeableLoRA(LoRALinear):
    def merged_linear(self):
        merged = nn.Linear(self.linear.in_features,self.linear.out_features,
                           bias=self.linear.bias is not None,
                           device=self.linear.weight.device,dtype=self.linear.weight.dtype)
        with torch.no_grad():
            # Linear weight 布局是 (Dout,Din)：delta_W = B @ A
            merged.weight.copy_(self.linear.weight + self.scaling*self.lora_B@self.lora_A)
            if merged.bias is not None: merged.bias.copy_(self.linear.bias)
        return merged
```

**中文解释。** v3 方案总体正确。合并前后应在 eval mode 下比较输出，尤其当外围模型含 Dropout 时；替换嵌套模块时要保留 device/dtype。

#### 代码/API 逐项解释

- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.copy_(...)`：`.copy_(source)` 原地复制数值但保留目标对象身份；加载或合并权重时常在 `no_grad` 中使用。

#### 输入与输出示例

- **输入/调用**：base weight `(Dout,Din)`、A `(r,Din)`、B `(Dout,r)`；merge 后 `W += scale*(B@A)`，同一输入的 eval 输出应与未 merge LoRA 路径接近。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 77. PPO-RLHF Core

**Problem.** Implement GAE, clipped policy loss, value loss, and reference KL control.

**中文题意。** 用 value baseline 计算时序 advantage，限制 policy ratio，联合训练 critic，并惩罚偏离 reference。

### Reviewed Solution

```python
def compute_gae(rewards, values, dones, gamma=.99, lam=.95):
    # 从最后时间步向前递推，done 位置会截断 bootstrap
    adv = torch.zeros_like(rewards); last = 0
    next_value = torch.zeros_like(values[:,0])
    for t in reversed(range(rewards.size(1))):
        alive = 1.0-dones[:,t]
        delta = rewards[:,t] + gamma*next_value*alive - values[:,t]
        last = delta + gamma*lam*alive*last
        adv[:,t] = last; next_value = values[:,t]
    return adv, adv+values

# loss = clipped policy loss + c_v*MSE(value,return) + beta*KL - c_e*entropy
```

**中文解释。** 仓库展示了完整组件。真实 RLHF 必须正确处理 EOS/padding mask、旧策略快照、token-level rewards、advantage normalization 和多 epoch minibatch 更新。

#### 代码/API 逐项解释

- `values[:, 0]`：假设 `values.shape=(B,T)`，第一个 `:` 选择全部 B 个样本，整数 `0` 选择每个样本的第 0 个时间步，因此结果 shape 从 `(B,T)` 变为 `(B,)`。例如 `values=[[0.5,0.4,0.2],[1.0,0.8,0.3]]` 时，`values[:,0] -> [0.5,1.0]`。
- `torch.zeros_like(values[:, 0])`：先得到 shape 为 `(B,)` 的首列模板，再创建同 shape、dtype、device 的 0；这里代表序列末端之后的 bootstrap value 初值。若 values 在 CUDA/bfloat16，结果也自动在 CUDA/bfloat16。
- `last = 0` 与 `next_value`：`last` 会在第一次张量运算后广播/变成每个 batch 的 advantage accumulator；写成 `torch.zeros_like(values[:,0])` 会更显式。`next_value` 始终保存时间步 `t+1` 的 value。
- `alive = 1.0 - dones[:, t]`：未终止时为 1，允许 bootstrap；终止时为 0，同时截断 TD delta 中的 next value 和 GAE 的未来 advantage。
- `delta = r_t + gamma*V_{t+1}*alive - V_t`：这是一步 TD residual；随后 `last = delta + gamma*lambda*alive*last` 从后向前累积成 GAE。
- `return adv, adv + values`：第一个输出是 advantage `(B,T)`；第二个是 value regression target，也就是 estimated return `(B,T)`。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

#### 输入与输出示例

- **输入/调用**：例如 `rewards=[[1.,1.,1.]]`、`values=[[0.5,0.4,0.2]]`、`dones=[[0.,0.,1.]]`，三者 shape 都是 `(B=1,T=3)`；函数反向递推，返回 `adv.shape=(1,3)` 与 `returns=adv+values`，终止位置不会 bootstrap 到下一状态。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 78. K-Means

**Problem.** Alternate nearest-centroid assignment and centroid recomputation until convergence.

**中文题意。** 使用 `cdist` 批量计算距离；空 cluster 不能产生 NaN，应保留旧中心或重新初始化。

### Reviewed Solution

```python
def kmeans(x,k,max_iters=100,tol=1e-4):
    if not 1 <= k <= x.size(0): raise ValueError("k 超出范围")
    centers = x[torch.randperm(x.size(0),device=x.device)[:k]].clone()
    for _ in range(max_iters):
        labels = torch.cdist(x,centers).argmin(1)
        new = torch.stack([x[labels==i].mean(0) if (labels==i).any()
                           else centers[i] for i in range(k)])
        if (new-centers).norm(dim=1).max() <= tol: break
        centers = new
    return centers, labels
```

**中文解释。** v3 解法基本正确。空 cluster 是重要边界条件；初始化质量还可用 k-means++ 改善。

#### 代码/API 逐项解释

- `torch.randperm`：生成 `0..N-1` 的随机排列；K-Means 可用前 k 个随机索引初始化中心。
- `torch.cdist`：计算两组向量的成对距离：`(N,D)` 与 `(M,D)` 得到 `(N,M)` 距离矩阵。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.clone(...)`：`.clone()` 复制数据且保留梯度关系；若想复制并截断梯度通常用 `detach().clone()`。
- `.argmin(...)`：`.argmin(dim)` 返回最小值索引；距离矩阵上使用可选出最近邻/中心。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.norm(...)`：`.norm(dim=...)` 计算范数；embedding normalize 前要用 epsilon 防止零向量除 0。
- `.max(...)`：不传 `dim` 时对全部元素求最大值并返回 0 维标量；传 `dim` 时返回 `(values, indices)`。这里 `(new-centers).norm(dim=1).max()` 对所有 cluster 的中心移动距离取单个最大值，用它与 `tol` 比较收敛。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.any(...)`：`.any()` 判断是否至少有一个 True；空 cluster 检查可用它决定重算还是保留旧中心。

#### 输入与输出示例

- **输入/调用**：输入点 `x.shape=(100,2)`、k=3；`cdist` 得 `(100,3)`，argmin 得 100 个 cluster id，更新中心后输出 centers `(3,2)` 与 labels `(100,)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 79. K-Nearest Neighbors

**Problem.** Classify batched queries by majority label among the k nearest training samples.

**中文题意。** 批量计算 test/train 欧氏距离，取最小 k 个下标，并对对应 labels 投票。

### Reviewed Solution

```python
def knn_predict(x_train,y_train,x_test,k=3):
    if not 1 <= k <= x_train.size(0): raise ValueError("k 超出范围")
    ids = torch.cdist(x_test,x_train).topk(k,largest=False).indices
    # (Ntest,k) -> 每行众数
    return y_train[ids].mode(dim=1).values
```

**中文解释。** v3 答案正确。`torch.mode` 平票时有固定但可能不符合业务需求的规则；可改用距离加权投票。

#### 代码/API 逐项解释

- `torch.cdist`：计算两组向量的成对距离：`(N,D)` 与 `(M,D)` 得到 `(N,M)` 距离矩阵。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。

#### 输入与输出示例

- **输入/调用**：训练集 `(100,4)`、测试集 `(10,4)`；距离矩阵 `(10,100)`，每行选 k 个邻居投票，输出 10 个预测类别。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 80. Manual Logistic Regression

**Problem.** Train binary logistic regression with analytical BCE gradients and no autograd.

**中文题意。** 手工计算 sigmoid、稳定 BCE、`dw/db`，并在 `no_grad` 语义下更新参数。

### Reviewed Solution

```python
def train_logistic(X,y,lr=.1,steps=1000):
    w,b = X.new_zeros(X.size(1)), X.new_zeros(())
    for _ in range(steps):
        logits = X@w+b
        p = torch.sigmoid(logits)
        error = p-y
        # BCE+sigmoid 的解析梯度
        w -= lr*(X.T@error)/X.size(0)
        b -= lr*error.mean()
    return w,b
```

**中文解释。** v3 公式正确。计算报告 loss 时优先使用稳定形式 `softplus(logits)-y*logits`，比对概率取 log 更不易溢出。

#### 代码/API 逐项解释

- `torch.sigmoid`：把任意实数压到 `(0,1)`；大正数接近 1、大负数接近 0，可解释为二分类概率或门值。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `.sigmoid(...)`：`.sigmoid()` 把每个元素映射到 `(0,1)`；可作为概率或 gate，但极端输入会进入饱和区。

#### 输入与输出示例

- **输入/调用**：`X.shape=(200,5)`、二元标签 `(200,)`；训练得到权重 `(5,)`，`sigmoid(X@w+b)` 输出 `(200,)` 概率。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 81. Stable Softmax Revisited

**Problem.** Implement vectorized, dimension-aware stable softmax.

**中文题意。** 对任意维度减最大值、指数化、归一化，并保持 broadcasting shape。

### Reviewed Solution

```python
def stable_softmax(x,dim=-1):
    shifted = x-x.amax(dim=dim,keepdim=True)
    exp_x = shifted.exp()
    return exp_x/exp_x.sum(dim=dim,keepdim=True)  # 指定维和为 1
```

**中文解释。** v3 答案正确，与第 02 题一致。若输入含整型，应先转浮点；若整行都是 `-inf`，Softmax 数学上未定义并会产生 NaN。

#### 代码/API 逐项解释

- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- **稳定性主线**：`amax(...,keepdim=True)` 让每行最大值变 0，`.exp()` 后最大元素为 1，再用保留维度的 sum 广播归一化。
- **边界条件**：若一整行都是 `-inf`，`-inf - (-inf)` 会得到 NaN；生产实现需识别全 mask 行。
- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：输入 `[1000.,1001.,1002.]` 先变为 `[-2,-1,0]` 再 exp；输出约 `[0.0900,0.2447,0.6652]`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 82. FlashAttention-2 Tiling

**Problem.** Compute exact attention in tiles with online softmax and O(N) auxiliary memory.

**中文题意。** 不创建完整 NxN attention matrix；逐块处理 Q/K/V，并维护每行最大值、归一化和与输出累加器。

### Reviewed Solution

```python
def tiled_attention(q,k,v,bq=64,bk=64):
    out = v.new_empty(q.size(0),q.size(1),v.size(-1)); scale=q.size(-1)**-0.5
    for i in range(0,q.size(1),bq):
        qi=q[:,i:i+bq]; m=qi.new_full((*qi.shape[:2],1),-torch.inf)
        l=qi.new_zeros(*qi.shape[:2],1); acc=v.new_zeros(*qi.shape[:2],v.size(-1))
        for j in range(0,k.size(1),bk):
            s=(qi@k[:,j:j+bk].transpose(-2,-1))*scale
            m_new=torch.maximum(m,s.amax(-1,keepdim=True))
            correction=(m-m_new).exp(); p=(s-m_new).exp()
            # 最大值变化时，旧分子和分母必须一起缩放
            acc=acc*correction+p@v[:,j:j+bk]; l=l*correction+p.sum(-1,keepdim=True); m=m_new
        out[:,i:i+bq]=acc/l
    return out
```

**中文解释。** v3 PyTorch 算法正确。题名包含 Triton，但 notebook 主要可靠部分是在线 Softmax 原理；真正 FlashAttention-2 还涉及并行映射、mask、反向 kernel 和数值累加精度。

#### 代码/API 逐项解释

- `torch.inf`：正无穷常量；`-torch.inf` 常用于把被 mask 的 logits 在 softmax 后变成 0。
- `torch.maximum`：逐元素取两张量较大值，并支持 broadcasting；online softmax 用它更新运行最大值。
- `.new_empty(...)`：`.new_empty(shape)` 只分配不初始化；只有随后完整写入时才安全。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.new_full(...)`：`.new_full(shape,value)` 以当前张量为模板创建常数张量，避免设备和精度不匹配。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：`q,k,v.shape=(1,128,64)`、`bq=bk=64`；每个 query tile 依次扫描两个 KV tile，输出 `(1,128,64)`，辅助状态按 query 行保存。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 83. FSDP Simulation

**Problem.** Simulate parameter sharding, all-gather before compute, and reduce-scatter after backward.

**中文题意。** 每个 rank 静止时只保存权重 shard；计算前拼成完整参数，反向后只保留本 rank 的聚合梯度 shard。

### Reviewed Solution

```python
def shard_flat(tensor,world_size):
    # 简化前提：元素数可整除；真实 FSDP 会 padding 并记录原 shape
    return tensor.flatten().chunk(world_size)

def all_gather(shards,shape):
    return torch.cat(shards).view(shape)

def reduce_scatter(rank_grads,world_size):
    # 先跨 rank 求和，再分片；训练若要平均梯度还需除 world_size
    reduced=torch.stack(rank_grads).sum(0)
    return reduced.flatten().chunk(world_size)
```

**中文解释。** 仓库 FakeDistributed 能说明通信语义，但不是真正多进程 FSDP。生产系统还需参数 flatten/padding、通信 overlap、mixed precision、optimizer state sharding 和 autograd hooks。

#### 代码/API 逐项解释

- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- `.chunk(...)`：`.chunk(n,dim)` 尽量把某维分成 n 块；该维不能整除时块大小可能不完全相同。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

#### 输入与输出示例

- **输入/调用**：长度 10 的 flat parameter、world_size=3 会分成带 padding 的 3 个 shard；all-gather 恢复原 shape，reduce-scatter 为每个 rank 返回其梯度 shard。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 84. Ring Attention

**Problem.** Rotate K/V blocks around ranks and accumulate exact attention with online softmax.

**中文题意。** 每个设备保留本地 Q，K/V block 沿 ring 传递；每收到一块就更新 Softmax 统计，遍历一圈得到全局 attention。

### Reviewed Solution

```python
def ring_update(q,k_block,v_block,m,l,acc,scale):
    scores=(q@k_block.transpose(-2,-1))*scale
    new_m=torch.maximum(m,scores.amax(-1,keepdim=True))
    old_scale=(m-new_m).exp(); p=(scores-new_m).exp()
    # 与 FlashAttention 相同的跨 block 合并公式
    return new_m, l*old_scale+p.sum(-1,keepdim=True), acc*old_scale+p@v_block

# 每个 rank 重复 world_size 次：计算本地 block -> send/recv 下一块 K/V
# 最后 output = acc / l
```

**中文解释。** v3 模拟算法抓住核心，但真实 ring 需要异步 P2P 通信与计算 overlap。Causal 模式还要根据全局 query/key offset 屏蔽未来 block，而不只是本地三角 mask。

#### 代码/API 逐项解释

- `torch.maximum`：逐元素取两张量较大值，并支持 broadcasting；online softmax 用它更新运行最大值。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：rank 0 持有本地 q block；每轮接收一个 k/v block 更新 `(m,l,acc)`，循环 world_size 次后 `acc/l` 输出本地 query 的完整 attention。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 85. Triton Fused Softmax

**Problem.** Fuse row-wise max, exponentiation, sum, and normalization into one GPU kernel.

**中文题意。** 一个 Triton program 处理一行，使用 next-power-of-two block 和边界 mask，减少全局显存读写。

### Reviewed Solution

```python
# Triton kernel 的等价数学，用于先验证正确性
def fused_softmax_reference(x):
    row_max=x.amax(-1,keepdim=True)
    numerator=torch.exp(x-row_max)
    return numerator/numerator.sum(-1,keepdim=True)

# kernel 图示：load 一行 -> tl.max -> tl.exp -> tl.sum -> tl.store
# 超过列数的 lane 用 mask=False，并以 -inf 填充
```

**中文解释。** v3 notebook 的 PyTorch reference 正确。Triton kernel 是否正确还依赖 GPU 编译与运行验证；本次按要求未运行，因此不能把硬件 kernel 声称为动态验证通过。

#### 代码/API 逐项解释

- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：输入矩阵 `(1024,4096)`；每个 Triton program 处理一行，输出同 shape，且每行概率和约为 1。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 86. Beam Search with Length Normalization

**Problem.** Maintain top beams, stop completed sequences, and normalize scores by length.

**中文题意。** 每步扩展活跃 beam，EOS 序列不再扩展；使用长度惩罚减少 raw log-prob 对短序列的偏好。

### Reviewed Solution

```python
def normalized_score(logp,length,alpha=.6):
    # Google NMT 风格长度惩罚；alpha=0 退化为原始分数
    return logp/(((5+length)/6)**alpha)

# candidates 排序键：normalized_score(total_logp, len(sequence))
# completed 与 active 分开保存，只有活跃 beam 继续调用模型
```

**中文解释。** v3 答案包含 beam 维护和早停，整体正确。严格早停需判断最佳活跃 beam 的理论上界是否仍能超过最佳完成 beam。

#### 代码/API 逐项解释



- `((5+length)/6)**alpha`：长度为 1 时惩罚因子为 1；序列越长分母越大，从而减轻累计负 log-prob 对长序列的天然惩罚。
- **排序对象**：生成过程中要保存 raw cumulative log-prob；只在比较 beam 时计算 normalized score，不能每步反复覆盖原分数。
- **active 与 completed**：未生成 EOS 的 beam 放在 active 中继续扩展；已生成 EOS 的 beam 固定到 completed，不能继续追加 token，否则长度和分数都会被错误改变。

#### 输入与输出示例

- **输入/调用**：两个 beam 的累计 log-prob 都为 -4，长度分别 4 和 8；length normalization 后较长序列不会仅因多乘了概率而被过度惩罚。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 87. Temperature Sampling

**Problem.** Divide logits by positive temperature and sample from the resulting distribution.

**中文题意。** 温度小于 1 时分布更尖锐，大于 1 时更平坦；温度必须严格为正。

### Reviewed Solution

```python
def temperature_sample(logits,temperature=1.0):
    if temperature<=0: raise ValueError("temperature 必须大于 0")
    probs=torch.softmax(logits/temperature,dim=-1)
    # multinomial 只接受 1D/2D；先把任意前导维展平成 batch
    flat=probs.reshape(-1,probs.size(-1))
    return torch.multinomial(flat,1).reshape(probs.shape[:-1])
```

**中文解释。** v3 答案正确。若想完全贪心，应显式 `argmax`，而不是传接近 0 的 temperature 造成数值极端。

#### 代码/API 逐项解释

- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：logits `[2,1,0]`：temperature=1 正常采样；temperature=0.5 分布更尖锐；temperature 趋近 0 时应改用 argmax。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 88. Top-k Sampling

**Problem.** Keep only the k largest logits, renormalize, and sample.

**中文题意。** 每行 vocabulary logits 只保留最高 k 项，其余设为负无穷，再按概率采样。

### Reviewed Solution

```python
def top_k_sample(logits,k=50,temperature=1.0):
    if temperature<=0: raise ValueError("temperature 必须为正")
    k=min(max(int(k),1),logits.size(-1))
    values,indices=(logits/temperature).topk(k,dim=-1)
    probs=torch.softmax(values,-1)
    local=torch.multinomial(probs.reshape(-1,k),1).reshape(*probs.shape[:-1],1)
    # 从 top-k 局部下标映射回原 vocabulary id
    return indices.gather(-1,local).squeeze(-1)
```

**中文解释。** v3 思路正确。直接在 top-k 子集采样比构建完整 `-inf` tensor 更节省操作。

#### 代码/API 逐项解释

- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.gather(...)`：`.gather(dim,index)` 按索引从指定轴取值；index shape 决定输出 shape。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：logits `[4,3,2,1]`、k=2；后两项被设为 `-inf`，softmax 后概率只在前两项非零，输出一个 token index。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 89. Top-p Nucleus Sampling

**Problem.** Keep the smallest high-probability prefix whose cumulative mass reaches p.

**中文题意。** 按概率降序，保留累计概率刚好覆盖 p 的动态候选集合，并保证越过阈值的第一个 token 不被删掉。

### Reviewed Solution

```python
def top_p_sample(logits,p=.9,temperature=1.0):
    if not 0<p<=1 or temperature<=0: raise ValueError("采样参数无效")
    sorted_logits,ids=(logits/temperature).sort(descending=True)
    probs=torch.softmax(sorted_logits,-1)
    remove=probs.cumsum(-1)-probs>p  # 保留 crossing token
    sorted_logits=sorted_logits.masked_fill(remove,-torch.inf)
    probs=torch.softmax(sorted_logits,-1)
    local=torch.multinomial(probs.reshape(-1,probs.size(-1)),1).reshape(*probs.shape[:-1],1)
    return ids.gather(-1,local).squeeze(-1)
```

**中文解释。** v3 解法正确。先减去当前 token 概率再比较，等价于把 remove mask 右移一位。

#### 代码/API 逐项解释

- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.inf`：正无穷常量；`-torch.inf` 常用于把被 mask 的 logits 在 softmax 后变成 0。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.sort(...)`：`.sort(descending=True)` 返回排序值和原索引；top-p 需在排序空间累积后再映射回词表。
- `.cumsum(...)`：`.cumsum(dim)` 计算前缀和；nucleus sampling 用累计概率确定最小候选集合。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.gather(...)`：`.gather(dim,index)` 按索引从指定轴取值；index shape 决定输出 shape。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：排序概率 `[0.6,0.25,0.1,0.05]`、p=0.8；保留前两项（累计 0.85），重归一化后采样并映射回原词表索引。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 90. Continuous Batching Scheduler

**Problem.** Admit new requests into freed slots while active sequences decode one token per iteration.

**中文题意。** 不等待整个静态 batch 完成；序列遇到 EOS 后立即释放 slot，并从等待队列补入新请求。

### Reviewed Solution

```python
from collections import deque

class Scheduler:
    def __init__(self,max_batch): self.max_batch=max_batch; self.waiting=deque(); self.active=[]
    def refill(self):
        while self.waiting and len(self.active)<self.max_batch:
            self.active.append(self.waiting.popleft())
    def step(self,decode_one):
        self.refill(); survivors=[]
        for req in self.active:
            token=decode_one(req); req.tokens.append(token)
            # 完成请求不进入 survivors，slot 下一轮被新请求使用
            if token!=req.eos and len(req.tokens)<req.max_tokens: survivors.append(req)
        self.active=survivors
```

**中文解释。** v3 调度概念正确。生产引擎不是逐请求 Python loop，而是将 active requests 合并成一次 batched forward，并维护每请求 KV pages、position 和采样状态。

#### 代码/API 逐项解释



- `waiting=deque()`：等待队列支持 O(1) 左端弹出；`active` 保存当前 decode step 真正组成 batch 的请求。
- `refill()`：只补到 `max_batch`，避免一个请求完成后 GPU slot 长时间空闲。
- `survivors`：每步只保留未 EOS、未达到 max length、未取消的请求；完成请求必须先写回结果再释放 KV cache。
- **状态输出**：scheduler step 的输出不是单个 tensor，而是更新后的 active/waiting 状态及本轮完成请求集合。

#### 输入与输出示例

- **输入/调用**：请求 A 已生成 3 token、请求 B 刚到达；scheduler 可组成同一 decode batch，step 后更新各自长度，完成/EOS 请求移出 active 队列。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 91. Mini Inference Engine

**Problem.** Combine tokenizer, Transformer, KV cache, batching, and sampling into generation APIs.

**中文题意。** 将模型计算与服务状态分离：请求保存 token/cache，engine 负责 prefill、decode、调度和采样。

### Reviewed Solution

```python
class GenerationState:
    def __init__(self,input_ids,layers):
        self.ids=input_ids; self.cache=[None]*layers; self.finished=False

@torch.inference_mode()
def decode_step(model,state):
    # 首次输入完整 prompt；以后只输入最后一个 token
    ids=state.ids if state.cache[0] is None else state.ids[:,-1:]
    logits,new_cache=model(ids,past_key_values=state.cache,use_cache=True)
    state.cache=new_cache
    token=top_p_sample(logits[:,-1],p=.9)
    state.ids=torch.cat((state.ids,token[:,None]),1)
    return token
```

**中文解释。** v3 mini-engine 适合教学，但“production-grade”还需 paged KV cache、动态 batching、并发安全、取消请求、显存预算、流式输出和故障处理。

#### 代码/API 逐项解释

- `torch.inference_mode`：比 `no_grad` 更强的推理模式，还关闭部分版本计数开销；只应用于纯推理路径。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

#### 输入与输出示例

- **输入/调用**：GenerationState 含 token ids `(B,L)` 和 KV cache；decode_step 输入最后 token，输出 next token `(B,1)` 并把 cache 长度从 L 增到 L+1。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 92. KV Cache Validation

**Problem.** Append new K/V and prove token-by-token output matches full causal recomputation.

**中文题意。** 每步只投影新 token 的 K/V，拼入 cache；比较同一层参数下最后 token 输出与完整序列重算。

### Reviewed Solution

```python
class KVCache:
    def __init__(self): self.k=self.v=None
    def update(self,k,v):
        self.k=k if self.k is None else torch.cat((self.k,k),dim=-2)
        self.v=v if self.v is None else torch.cat((self.v,v),dim=-2)
        return self.k,self.v
    def reset(self): self.k=self.v=None

# 验证必须复用同一 attention module 权重，并比较 full[:, -1] 与 cached token output
```

**中文解释。** v3 核心正确。Cache 的序列维应明确为 `-2`，多层模型需要每层独立 cache；训练时通常不用 cache，因为 concat 图会保留历史激活。

#### 代码/API 逐项解释

- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `dim=-2`：假设 cache layout 为 `(...,sequence,head_dim)`，倒数第二维才是 token 长度；若布局是 `(B,S,H,D)` 则必须改轴。
- `full[:, -1]`：选择所有 batch 的最后一个 token 输出，shape 从 `(B,S,D)` 变为 `(B,D)`；它应与逐 token cached decode 的最后输出比较。

#### 输入与输出示例

- **输入/调用**：同一 attention 权重下，对序列长度 5：full forward 最后 token 输出与 4-token prefill + 1-token cached decode 输出应在容差内一致。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 93. Full Speculative Decoding

**Problem.** Draft K tokens, verify them in one target pass, accept by p/q, and sample from the correction distribution on rejection.

**中文题意。** 草稿模型逐步提议，目标模型并行评分；接受规则必须保存目标分布，不能简单在拒绝后从 target 原分布采样。

### Reviewed Solution

```python
def accept_or_correct(p,q,token):
    accept=torch.minimum(p[token]/q[token].clamp_min(1e-12),p.new_tensor(1.0))
    if torch.rand((),device=p.device)<accept: return token,True
    residual=(p-q).clamp_min(0)
    # 理论拒绝事件下 residual 应有正质量；数值边界使用 p 兜底
    dist=residual if residual.sum()>0 else p
    return torch.multinomial(dist/dist.sum(),1).item(),False
```

**中文解释。** v3 目标正确。索引对齐很关键：目标在 prefix+i 位置的 logits 预测第 i 个 draft；全部接受后还应从目标的下一位置额外采样一个 token。

#### 代码/API 逐项解释

- `torch.minimum`：逐元素取较小值；PPO clipping 或接受概率中用于选择保守目标。
- `torch.rand`：从 `[0,1)` 均匀分布创建张量；若参与概率判断，要确认随机张量与概率张量位于同一 device。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。

- `.new_tensor(...)`：`.new_tensor(data)` 以当前张量为模板创建常量，避免 CPU/GPU 与 dtype 不一致。

#### 输入与输出示例

- **输入/调用**：draft 一次提出 4 个 token；target 并行验证，连续接受前 k 个，首个拒绝位置从校正分布采样，再开始下一轮。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 94. 2D Sinusoidal Position Embeddings

**Problem.** Encode row and column positions independently into two halves of each patch vector.

**中文题意。** embedding 前半表示 row，后半表示 column；每一半再交替使用 sin/cos。

### Reviewed Solution

```python
def positional_2d(height,width,d_model,device=None,dtype=torch.float32):
    if d_model%4: raise ValueError("d_model 必须能被 4 整除")
    half=d_model//2
    freq=torch.exp(torch.arange(0,half,2,device=device,dtype=torch.float32)*
                   (-math.log(10000.)/half))
    rows=torch.arange(height,device=device,dtype=torch.float32)[:,None]*freq
    cols=torch.arange(width,device=device,dtype=torch.float32)[:,None]*freq
    r=torch.stack((rows.sin(),rows.cos()),-1).flatten(1)
    c=torch.stack((cols.sin(),cols.cos()),-1).flatten(1)
    # 网格展开顺序：(row0,col0..W-1), (row1,...)
    return torch.cat((r[:,None].expand(-1,width,-1),
                      c[None].expand(height,-1,-1)),-1).reshape(height*width,d_model).to(dtype)
```

**中文解释。** 题面只说 d_model 为偶数，但每个 half 还需成对 sin/cos，因此最清晰约束是能被 4 整除。v3 公式方向正确。

#### 代码/API 逐项解释

- `torch.float32`：32 位浮点 dtype；用于位置频率或归一化统计可减少 fp16/bf16 的数值误差。
- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- `.expand(...)`：`.expand(...)` 用 stride=0 创建广播视图而不复制；不能把它当成独立存储原地写。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。
- `math.log(x)`：对正的 Python 标量求自然对数并返回 `float`；位置编码中 `-log(10000)/D` 是固定频率尺度，不需要梯度。若输入是 tensor 或需参与 autograd，应使用 tensor `.log()`。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。
- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。

#### 输入与输出示例

- **输入/调用**：height=2,width=3,d_model=8；输出位置表 shape `(6,8)`，每行对应一个 `(y,x)` patch 坐标。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 95. CLIP InfoNCE

**Problem.** Normalize image/text features and compute symmetric contrastive cross-entropy.

**中文题意。** batch 中第 i 张图与第 i 段文本是正样本；相似度矩阵对角线应最大，图到文与文到图损失取平均。

### Reviewed Solution

```python
def clip_loss(image_features,text_features,logit_scale):
    image=F.normalize(image_features,dim=-1); text=F.normalize(text_features,dim=-1)
    scale=logit_scale.exp().clamp(max=100)  # 学习 log scale，保证温度为正
    logits=scale*(image@text.T); labels=torch.arange(logits.size(0),device=logits.device)
    return (F.cross_entropy(logits,labels)+F.cross_entropy(logits.T,labels))/2
```

**中文解释。** v3 对称 InfoNCE 正确。参数最好存为 `logit_scale=log(1/T)` 而不是直接 temperature，并限制指数上界防止训练爆炸。

#### 代码/API 逐项解释

- `F.normalize`：按指定维做 Lp 归一化；CLIP 常把 embedding 归一化到单位球面，使点积等于 cosine similarity。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `F.cross_entropy`：直接接收未归一化 logits 与整数类别标签，内部融合 `log_softmax + NLLLoss`，更稳定也更高效。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：image/text features 都是 `(B=4,D=512)`；归一化后相乘得 `(4,4)` 相似度矩阵，对角线是正配对，双向 CE 输出标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 96. DDIM with Classifier-Free Guidance

**Problem.** Perform deterministic DDIM steps and combine conditional/unconditional noise predictions.

**中文题意。** 用较少时间步从噪声跳步生成；CFG 将条件预测沿远离无条件预测的方向放大。

### Reviewed Solution

```python
def cfg_eps(model,x,t,label,scale):
    eps_u=model(x,t,None); eps_c=model(x,t,label)
    return eps_u+scale*(eps_c-eps_u)

def ddim_step(x,eps,a_t,a_prev):
    # eta=0：给定初始噪声后路径确定
    x0=(x-(1-a_t).sqrt()*eps)/a_t.sqrt()
    return a_prev.sqrt()*x0+(1-a_prev).sqrt()*eps
```

**中文解释。** v3 eta=0 核心公式正确。模型训练时必须随机丢弃条件，才能学会 unconditional 分支；最后一步 `a_prev` 应按约定设为 1。

#### 代码/API 逐项解释



- `eps_u + scale*(eps_c-eps_u)`：scale=0 得 unconditional，scale=1 得 conditional，scale>1 把预测沿条件方向外推。
- `x0=(x-sqrt(1-a_t)*eps)/sqrt(a_t)`：从当前 noisy sample 与预测噪声反推出干净样本估计。
- **DDIM 输出**：`eta=0` 时不再采样额外随机噪声；固定初始噪声和模型后，每一步 `x_t -> x_{t-1}` 是确定的。
- `.sqrt(...)`：`.sqrt()` 逐元素开平方；方差、扩散系数等理论上非负，但浮点误差下仍应考虑 clamp/epsilon。

#### 输入与输出示例

- **输入/调用**：模型分别预测 conditional/unconditional epsilon `(B,C,H,W)`，CFG 组合后 DDIM step 从 `x_t` 输出同 shape 的 `x_{t-1}`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 97. DDPM

**Problem.** Implement forward noising, noise-prediction training, and stochastic reverse sampling.

**中文题意。** 训练随机时间步的噪声预测器；采样从标准高斯开始，按后验均值逐步去噪并在非最后步加入方差噪声。

### Reviewed Solution

```python
def extract(schedule,t,x):
    # 从长度 T 的 schedule 取出每个样本时间步，并扩展为 (B,1,...,1)
    return schedule.to(x.device).gather(0,t).view(t.size(0),*([1]*(x.ndim-1)))

def q_sample(x0,t,alpha_bar,noise=None):
    noise=torch.randn_like(x0) if noise is None else noise
    a=extract(alpha_bar,t,x0)
    return a.sqrt()*x0+(1-a).sqrt()*noise,noise

def p_sample(x_t,eps,t,alpha,alpha_bar,beta):
    a,ab,b=extract(alpha,t,x_t),extract(alpha_bar,t,x_t),extract(beta,t,x_t)
    mean=(x_t-b/(1-ab).sqrt()*eps)/a.sqrt()  # epsilon parameterization
    prev_t=(t-1).clamp_min(0)
    ab_prev=extract(alpha_bar,prev_t,x_t)
    ab_prev=torch.where((t==0).view(-1,*([1]*(x_t.ndim-1))),
                        torch.ones_like(ab_prev),ab_prev)
    posterior_var=b*(1-ab_prev)/(1-ab)
    noise=torch.randn_like(x_t)
    nonzero=(t>0).to(x_t.dtype).view(-1,*([1]*(x_t.ndim-1)))
    return mean+nonzero*posterior_var.clamp_min(0).sqrt()*noise
```

**中文解释。** 前向闭式公式允许直接从 `x0` 采样任意 `xt`，所以训练不必逐步加噪。反向均值来自 `epsilon` 参数化；随机项应使用后验方差 `beta_t*(1-alpha_bar_{t-1})/(1-alpha_bar_t)`，而不是直接使用 beta。`t=0` 时不再加噪。原简写只给均值且没有正确处理 batch 形式的 t；修正版补齐了完整随机采样和 broadcasting。

#### 代码/API 逐项解释

- `torch.randn_like`：按标准正态分布采样，并继承参照张量的 shape、dtype、device，常用于扩散噪声。
- `torch.where`：逐元素条件选择：`torch.where(condition, a, b)` 在条件为 True 的位置取 `a`，否则取 `b`；三者需满足 broadcasting 规则。
- `torch.ones_like`：创建与参照张量相同 shape、dtype、device 的全 1 张量，常用于标签、mask 或默认乘法因子。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.gather(...)`：`.gather(dim,index)` 按索引从指定轴取值；index shape 决定输出 shape。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。

- `.sqrt(...)`：`.sqrt()` 逐元素开平方；方差、扩散系数等理论上非负，但浮点误差下仍应考虑 clamp/epsilon。

#### 输入与输出示例

- **输入/调用**：输入干净图 `x0:(B,C,H,W)` 和时间步 `t:(B,)`；q_sample 输出同 shape 噪声图，p_sample 再预测前一时间步样本。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 98. Knowledge Distillation

**Problem.** Combine hard-label CE and temperature-softened teacher/student KL.

**中文题意。** Student 同时学习真实标签和 teacher 的软类别关系；teacher 必须冻结，KL 输入方向要正确。

### Reviewed Solution

```python
def distillation_loss(student,teacher,labels,T=4.,alpha=.7):
    # 软目标传递类别关系，硬目标保证真实标签监督
    soft=F.kl_div(F.log_softmax(student/T,-1),
                  F.softmax(teacher.detach()/T,-1),reduction="batchmean")*(T*T)
    hard=F.cross_entropy(student,labels)
    return alpha*soft+(1-alpha)*hard
```

**中文解释。** v3 答案正确。`F.kl_div` 第一个参数必须是 student log-prob，第二个是 teacher probability；`T^2` 补偿梯度缩放。

#### 代码/API 逐项解释

- `F.kl_div`：计算 KL 相关目标时，默认要求第一个参数是 log-prob；`log_target` 决定 target 是否也已取 log。
- `F.log_softmax`：稳定地同时完成 softmax 和 log；NLL、DPO、蒸馏等需要 log-prob 时应优先使用。
- `F.softmax`：`torch.softmax` 的 functional 形式；必须明确 `dim`，否则无法判断概率在哪个轴归一化。
- `F.cross_entropy`：直接接收未归一化 logits 与整数类别标签，内部融合 `log_softmax + NLLLoss`，更稳定也更高效。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：student/teacher logits `(B,K)`、labels `(B,)`；温度 T 的 KL 与普通 CE 加权后输出标量，KL 项乘 `T^2` 保持梯度尺度。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 99. Mamba Selective Scan

**Problem.** Implement input-dependent state-space parameters and linear-time recurrence.

**中文题意。** 每个 token 产生 delta/B/C，离散化稳定的负 A，然后扫描更新 hidden state 和输出。

### Reviewed Solution

```python
def selective_scan(x,delta,A,B,C,D):
    # x:(B,L,D)，A:(D,N)，B/C:(B,L,N)，以下为教学版广播
    h=x.new_zeros(x.size(0),x.size(2),A.size(1)); ys=[]
    for t in range(x.size(1)):
        dt=F.softplus(delta[:,t])[:, :, None]
        Abar=torch.exp(dt*A[None])
        Bbar=dt*B[:,t,None,:]
        h=Abar*h+Bbar*x[:,t,:,None]
        ys.append((h*C[:,t,None,:]).sum(-1)+D*x[:,t])
    return torch.stack(ys,1)
```

**中文解释。** v3 是 Mamba 思想的简化教学版，不是官方 selective-scan kernel。真实 Mamba 的 B/C 维度、并行 scan、卷积路径、门控和 discretization 更复杂；A 应参数化为负值保证稳定。

#### 代码/API 逐项解释

- `F.softplus`：平滑的正值函数 `log(1+exp(x))`；Mamba 用它确保离散步长 delta 为正。
- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：输入 `x:(B,L,D)`，scan 按 L 递推状态 `h`；每步用输入相关 delta/B/C 更新，stack 后输出 `(B,L,Dout)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 100. MoE with Load Balancing

**Problem.** Route each token to top-k experts and compute an auxiliary balancing loss.

**中文题意。** Router 选择 experts，top-k gate 在局部归一化；辅助损失同时考虑实际路由比例与平均 gate probability。

### Reviewed Solution

```python
def moe_balance(router_probs,top_ids,num_experts):
    # fraction: 实际被选择的 token 比例；prob: router 软概率均值
    one_hot=F.one_hot(top_ids,num_experts).float().sum(1)
    fraction=one_hot.mean(0)/top_ids.size(1)
    mean_prob=router_probs.mean(0)
    return num_experts*(fraction*mean_prob).sum()

# total_loss = task_loss + aux_weight * moe_balance(...)
```

**中文解释。** v3 top-k dispatch 与辅助损失方向正确。生产 MoE 还必须实现 capacity factor、溢出 token 策略、expert parallel 通信和无 Python 双重循环的 grouped GEMM。

#### 代码/API 逐项解释

- `F.one_hot`：把整数类别索引变成 one-hot；输出最后一维大小为类别数，默认 dtype 是整数。
- `.float(...)`：`.float()` 转为 float32；混合精度中常对统计量临时升精度。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。

#### 输入与输出示例

- **输入/调用**：router probabilities `(N,E)`、top expert ids `(N,K)`；one-hot 统计实际负载，与平均路由概率结合得到标量 balance loss。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 101. Sliding-Window Attention Revisited

**Problem.** Build a band mask and compare local attention with full attention.

**中文题意。** 只允许 `|i-j|<=w` 的位置参与 Softmax，并验证足够大窗口时等价于 full attention。

### Reviewed Solution

```python
def sliding_mask(seq_len,window,device=None):
    pos=torch.arange(seq_len,device=device)
    return (pos[:,None]-pos[None,:]).abs()<=window

def masked_local_attention(q,k,v,window):
    # 窗口外位置在 Softmax 前设为负无穷，概率因此变成 0
    scores=q@k.transpose(-2,-1)/math.sqrt(q.size(-1))
    mask=sliding_mask(q.size(-2),window,q.device)
    return torch.softmax(scores.masked_fill(~mask,-torch.inf),-1)@v
```

**中文解释。** v3 数值实现正确，但仍创建 NxN 分数和 mask，所以实际内存仍是 O(N²)。只有 sparse/block kernel 才真正达到题面所说 O(Nw)。

#### 代码/API 逐项解释

- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.inf`：正无穷常量；`-torch.inf` 常用于把被 mask 的 logits 在 softmax 后变成 0。
- `.abs(...)`：`.abs()` 逐元素绝对值；Huber loss 用它判断误差落在线性还是二次区间。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：序列长度 6、causal window=3；位置 4 只允许 key 2,3,4，mask 后 attention 输出与 q 相同 shape。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 102. Vision Transformer and MAE

**Problem.** Patchify images, encode visible patches, insert mask tokens, and reconstruct masked patches.

**中文题意。** MAE 随机保留少量 patch 给 encoder；decoder 按原顺序恢复 visible/mask tokens，只在 masked patches 上计算重建损失。

### Reviewed Solution

```python
def mae_loss(pred,target,mask):
    # pred/target:(B,N,patch_dim)，mask:(B,N)，1 表示被遮挡
    per_patch=(pred-target).square().mean(-1)
    return (per_patch*mask).sum()/mask.sum().clamp_min(1)

def patchify(x,p):
    b,c,h,w=x.shape
    if h%p or w%p: raise ValueError("图像尺寸必须整除 patch size")
    # (B,C,H,W) -> (B,Nh*Nw,C*P*P)
    return x.reshape(b,c,h//p,p,w//p,p).permute(0,2,4,1,3,5).reshape(b,-1,c*p*p)
```

**中文解释。** v3 整体架构合理。最容易出错的是 restore indices：decoder 输出必须回到原 patch 顺序；loss 只算 masked patches，否则模型会把容量浪费在复制可见输入。

#### 代码/API 逐项解释

- `.square(...)`：`.square()` 逐元素平方；MSE、方差和 L2 距离常用。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.permute(...)`：`.permute(...)` 任意重排轴，参数必须覆盖每个维度一次；只改变 stride 视图。

#### 输入与输出示例

- **输入/调用**：图像 `(B,3,224,224)`、patch=16 变成 `(B,196,768)` patches；mask 只选被遮 patch，MAE loss 输出标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## TorchLeet 静态审查结论

- 实际找到并配对 61 组 notebook，编号 42-102；加上原有内容后总计 102 题。
- 明确错误或不完整的仓库答案已在讲义中替换，包括 BPE 省略号、MHA/GQA 随机投影与 reshape、量化 LM 的 Softmax+CrossEntropy、3D Dice 方向/shape、custom CNN 未使用自定义层、Learned-SiLU backward、变长 attention mask 等。
- 一些系统题只能在 GPU 或多进程环境动态验证，例如 Triton、FSDP、Ring Attention；这里完成的是按要求进行的静态算法审查，没有执行 notebook。
- Flash/Sliding/Mamba/FSDP/Inference Engine 的教学实现表达核心机制，但不应被误认为生产 kernel 或完整服务框架。

---

# 逐题 PyTorch 面试深挖

回答任何实现题时，建议按四步说：先定义输入输出 shape；再写数学公式和稳定性处理；接着解释 autograd、device、dtype；最后给复杂度、边界条件和生产优化。下面是 102 题对应的口述重点与高频追问。

## A. 基础张量、层与训练（01-22）

**01 ReLU。** 核心是逐元素分段函数，时间 O(N)、额外空间取决于实现。面试要说清 `x=0` 的次梯度约定为 0；不要用 `(x>0).float()`，因为它可能把 fp16/bf16 输入提升为 fp32。追问通常是 dying ReLU、LeakyReLU，以及为什么原地 ReLU 可能破坏 backward 所需值。

**02 Softmax。** 先减 row max 是 log-sum-exp trick 的直接应用；它不改变结果，因为公共指数因子在分子分母抵消。复杂度 O(N)，但要强调归一化维度必须正确。追问包括整行 `-inf` 会产生 NaN、混合精度通常用 fp32 累加，以及 CrossEntropy 为什么不应先显式 Softmax。

**03 Linear。** `nn.Linear` 权重布局是 `(out_features,in_features)`，forward 实际计算 `x @ W.T + b`。参数必须是 `nn.Parameter` 才会出现在 `model.parameters()`、state_dict 和 device 迁移中。追问是参数量 `Din*Dout+Dout`、Kaiming/Xavier 选择，以及大 Linear 如何用 tensor parallel 切分。

**04 LayerNorm。** 对每个样本或 token 的最后 D 维独立统计，因此训练和推理行为一致，也不依赖 batch size。方差用总体估计 `correction=0`。追问常比较 LayerNorm、BatchNorm、RMSNorm：统计维度、是否减均值、是否保存 running state，以及 Transformer 为什么偏爱 LayerNorm/RMSNorm。

**05 Scaled Attention。** 必须能口述 shape 链：`Q(B,Sq,Dk) @ K^T(B,Dk,Sk) -> scores(B,Sq,Sk)`，再乘 `V(B,Sk,Dv)`。缩放 `1/sqrt(Dk)` 让点积方差不随维度线性增长，防止 Softmax 饱和。复杂度是 O(B*Sq*Sk*D)，内存 O(B*Sq*Sk)。

**06 MHA。** 多头不是把模型维度放大 H 倍，而是把 D 分成 H 个 Dh，典型总投影复杂度仍为 O(S*D²)，attention 为 O(S²D)。面试要解释 `.transpose(...).contiguous().view(...)` 的 stride 问题。追问是 head pruning、MHA/MQA/GQA 差异及 mask broadcasting。

**07 BatchNorm。** 训练 forward 用 batch 的 biased variance，更新 `running_var` 却用 unbiased variance；eval 使用 running statistics。Momentum 公式是 `new=(1-m)*old+m*batch`，与优化器 momentum 含义不同。追问是小 batch 不稳定、SyncBatchNorm、BN folding，以及为什么 Transformer 很少用 BN。

**08 RMSNorm。** 公式只除 RMS，不减均值，通常也没有 beta，因此比 LayerNorm 少一次 mean 和一组偏置参数。它控制向量尺度但保留均值信息。追问是 `eps` 放在 sqrt 内外的实现差异、低精度时用 fp32 计算方差，以及 LLaMA 为什么使用 RMSNorm。

**09 Causal Attention。** Mask 必须在 Softmax 前把未来 score 设为 `-inf`。要区分 boolean mask 的语义：不同 API 中 True 可能表示“允许”或“屏蔽”，使用前必须看 contract。追问是矩形 causal mask 在 cached decoding 的对齐方式，以及 padding mask 与 causal mask 如何组合。

**10 GQA。** Q heads 数 Hq，KV heads 数 Hkv，每个 KV head 服务 `Hq/Hkv` 个 query heads。KV cache 从 O(B*S*Hq*Dh) 降到 O(B*S*Hkv*Dh)，质量通常优于单 KV head 的 MQA。追问是为什么不能把 K/V head width 写成 `D/Hkv`：每个 head 的点积宽度必须与 Q 的 Dh 一致。

**11 Sliding Window Attention。** 数学 mask 正确不等于复杂度真的下降：若仍创建 NxN scores，内存和计算仍是 O(N²)。真正 O(Nw) 需要 block-sparse 或专用 kernel。追问是双向窗口与 causal 左窗口区别、边界 token 的有效窗口长度，以及多层窗口如何扩大 receptive field。

**12 Linear Attention。** 通过核映射把 `phi(Q)(phi(K)^T V)` 重结合，避免 S² matrix；复杂度约 O(S*Dk*Dv)。它不是 Softmax attention 的严格等价，因为 Softmax kernel 不容易有限维分解。追问是 denominator 稳定性、causal linear scan，以及为什么线性 attention 有时质量不如标准 attention。

**13 GPT Block。** Pre-Norm 顺序是 `x += Attn(Norm(x)); x += MLP(Norm(x))`，residual stream 提供稳定梯度高速路。面试要指出最小实现还缺 attention/MLP dropout、bias 选择和 KV cache。追问是 Pre-Norm vs Post-Norm、最终 norm 的必要性，以及参数量主要来自 4 个 attention 投影和扩展 MLP。

**14 KV Cache。** Cache 保存每层已经投影并拆头的 K/V，不保存 Q。Prefill 是并行处理 prompt；decode 每步只产生新 Q/K/V，但新 Q 仍需读取全部历史 K/V，所以单步 attention 随上下文线性增长。追问是 cache 内存公式、GQA、paged KV cache、prefix sharing 和 chunked prefill。

**15 SwiGLU。** 两个上投影分别产生 gate 和 content，`SiLU(gate)*up` 后下投影。相比 GELU FFN 参数更多，因此实际模型常调整 hidden size，使总参数预算相近。追问是为什么 B/门控增强条件计算、SiLU 导数，以及 tensor parallel 中 gate/up 常合并成一次矩阵乘法。

**16 CrossEntropy。** `CE = logsumexp(logits)-target_logit`，直接从 logits 计算最稳定。类别索引 target 用 gather；padding 使用 `ignore_index` 或 mask 后按有效 token 数归一化。追问是 label smoothing、class weights、序列 loss shift，以及 reduction 对梯度尺度的影响。

**17 Dropout。** Inverted dropout 训练时乘 Bernoulli mask 再除 keep probability，使期望不变；eval 直接 identity。它只在 training mode 随机，复现实验要管理 RNG。追问是 attention dropout 与 residual dropout、checkpoint 重算时 RNG、一致性，以及为什么现代大模型有时将 dropout 设为 0。

**18 Embedding。** 本质是矩阵行查找，不是 one-hot 矩阵乘法，但数学上等价。重复 token 的梯度累加到同一行；`padding_idx` 可让 padding 行不更新。追问是 sparse gradients、weight tying、位置 embedding 和词表并行。

**19 GELU。** `x*Phi(x)` 是平滑概率门控；负输入不是全清零。精确 erf 与 tanh approximation 数值略有差异，载入 checkpoint 时要匹配原模型配置。追问是 GELU/ReLU/SiLU 的导数、计算成本及 Transformer 激活演进。

**20 Kaiming Init。** 目标是在 ReLU 截断约一半信号后保持方差，normal std 为 `sqrt(2/fan_in)`。Conv 的 fan-in 是 `Cin*kH*kW`，不是只有 Cin。追问是 forward 用 fan_in、backward 用 fan_out，Xavier 适合近线性/tanh，以及 residual 分支的特殊缩放。

**21 Gradient Clipping。** Global norm clipping 把所有梯度拼成一个向量后统一缩放，保持方向不变；value clipping 则逐元素截断并改变方向。AMP 下必须先 `scaler.unscale_(optimizer)` 再 clip。追问是 exploding gradient、分布式训练中何时算 global norm，以及 clip threshold 如何监控选择。

**22 Conv2D。** PyTorch 的“卷积”实际是 cross-correlation，不翻转 kernel。输出尺寸为 `floor((H+2P-dilation*(K-1)-1)/stride+1)`；基础题若没支持 dilation/groups 要主动说明。追问是 `unfold+GEMM`、depthwise/group convolution、感受野和参数共享。

## B. Transformer、优化与对齐（23-41）

**23 Cross-Attention。** Q 来自 decoder，K/V 来自 encoder，因此输出长度跟 Sq，memory 长度是 Skv。通常不做 encoder 方向的 causal mask，但必须做 source padding mask。追问是 encoder-decoder cache：K/V 对整个生成过程固定，可预计算一次。

**24 RoPE。** 每对维度做二维旋转，Q_i 与 K_j 的内积包含位置差 `i-j`，因此自然表达相对位置。实现必须匹配 interleaved 或 half-rotation 的 checkpoint 约定。追问是 cache offset、长上下文 scaling、频率 base 和只旋转部分 head_dim。

**25 Online Softmax。** 处理新 block 时，新最大值 `m'` 变化会让旧指数基准失效，所以旧 denominator 和 numerator 都乘 `exp(m-m')`。这就是 FlashAttention 精确而非近似的关键。追问是 IO-aware、为何少写 HBM 比少 FLOPs 更重要、causal tile 跳过和 fp32 accumulator。

**26 LoRA。** 冻结 W，只学习 `deltaW=(alpha/r)BA`；B 零初始化保证初始函数不变。参数量从 `Dout*Din` 变为 `r*(Din+Dout)`。追问是 target modules、rank/alpha、LoRA dropout、merge、QLoRA，以及为什么第一步 A 梯度可能为 0 但 B 能先启动学习。

**27 ViT Patch。** Patchify 把图像从 `(B,C,H,W)` 变成 `(B,N,C*P²)`，Linear 投影后是 token sequence。`Conv2d(kernel=P,stride=P)` 与 patchify+Linear 等价。追问是 patch size 对 N 和 attention O(N²) 的影响、CLS token 与 mean pooling、2D positional encoding。

**28 MoE。** Router 每 token 选 top-k experts，局部 gate 归一化后加权输出。总参数可很大，但每 token 激活参数只约 k 个 expert。追问是 load balance、capacity factor、token drop、expert parallel all-to-all、router z-loss 和 grouped GEMM。

**29 Adam。** 一阶矩是动量，二阶矩是自适应尺度；bias correction 修复从零初始化导致的早期低估。面试必须区分 Adam 中 L2 regularization 与 AdamW decoupled weight decay。追问是 epsilon 放在 sqrt 内外、AMSGrad、状态内存约为参数的 2 倍及 8-bit optimizer。

**30 Cosine Schedule。** Warmup 处理训练初期不可靠的大梯度/统计，cosine 从 max_lr 平滑下降到 min_lr。要明确 step 是 optimizer step 而非 micro-batch step。追问是 token-based schedule、warmup ratio、restart，以及恢复 checkpoint 时 scheduler state。

**31 Gradient Accumulation。** `loss/n` 后多次 backward 再 step，等价前提是 micro-batch 同样大小、随机层/BN 行为可接受。它降低 activation peak memory，但不会降低总计算。追问是 DDP 的 `no_sync()`、AMP scaler 每个 optimizer step 更新一次、gradient clipping 时机。

**32 Top-k/Top-p。** Temperature 先作用 logits，top-k 固定候选数，top-p 动态保留概率质量。过滤后必须重新归一化并至少保留一个 token。追问是 repetition penalty、min-p、typical sampling、随机种子和 batched multinomial shape。

**33 Beam Search。** Beam score 是 token log-prob 之和；EOS beam 单独保存，未完成 beam 才扩展。Raw score 偏好短序列，所以常加 length penalty。追问是 early stopping 上界、KV cache reorder、diverse beam search，以及为什么开放式生成往往用 sampling 而非 beam。

**34 Speculative Decoding。** Draft 提案分布 q、target 分布 p；接受概率 `min(1,p/q)`，拒绝时从归一化正残差 `(p-q)_+` 采样，才能严格保持 p。追问是全部接受后额外 target token、target logits 对齐、acceptance rate 与 draft/target 速度比。

**35 BPE。** Training 依赖 corpus word frequency，逐轮全局选择最高频 pair；encoding 必须严格按 learned merge rank 应用。追问是 byte-level BPE 避免 OOV、Unicode/空格处理、special tokens，以及 BPE 与 WordPiece/Unigram 的目标差异。

**36 INT8 Linear。** 对称 per-output-channel scale 通常比 per-tensor 精度好；权重量化误差约受 scale/2 控制。教学版反量化后做 fp matmul 不会加速，真实收益依赖 packed weight 和量化 kernel。追问是 weight-only vs dynamic activation、zero point、calibration、GPTQ/AWQ。

**37 DPO。** DPO 优化的是 policy 相对 reference 的 chosen/rejected log-ratio 差。Beta 调节隐式 reward 尺度与 reference 约束强度。追问是 sequence logp sum、长度偏差、reference-free 变体、label smoothing、IPO，以及 preference 数据噪声。

**38 简化 GRPO。** 组内 reward normalization 用同 prompt completions 构造 baseline，不需要 critic；但只有 `-A logpi` 不是完整 GRPO。面试应主动补充 old-policy ratio、clip、reference KL、token mask 和多次 policy update。

**39 PPO Loss。** Ratio 在 log space 计算；正负 advantage 下 `min(unclipped,clipped)` 都选择更保守改善。Old logp 和 advantage 要 detach。追问是 value clipping、entropy、GAE、KL early stop、advantage normalization 和 on-policy 数据复用限制。

**40 Linear Regression。** Closed form 用 `lstsq` 比显式逆稳定；手写梯度验证 MSE 导数；nn.Linear 展示 autograd。追问是 rank deficiency、正则化得到 ridge、特征标准化对 GD 收敛、normal equation O(D³) 与迭代法权衡。

**41 OPD。** Reverse KL `KL(student||teacher)` 是 student 分布期望，较 mode-seeking；多个 teachers 先各算 KL 再加权。Temperature 改变软分布，`T²` 补梯度尺度。追问是 forward/reverse KL 行为、mask denominator、teacher detach 和 on-policy trajectory 的含义。

## C. TorchLeet 核心 PyTorch（42-72）

**42 TorchLeet BPE。** 这题的重点不是记代码，而是发现原 solution 仍有 `...`，以及 `Counter.update(dict)` 会丢掉同一词中重复 pair。面试要讲清训练阶段生成 merge ranks，推理阶段不能重新按文本频率选择 merge。复杂度朴素实现每轮扫描整个 corpus，可用 pair index/heap 优化。

**43 TorchLeet GQA。** 最大陷阱是 K/V projection 的输出维应为 `Hkv*Dh`，不是让 KV head 宽度变为 `D/Hkv`。Q/K 点积要求最后维相同。还要指出 Linear 不能在 forward 中临时创建，否则每次随机初始化、参数不会被 optimizer/state_dict 管理。

**44 Attention from Scratch。** 除 shape 外要解释 mask 的 dtype 与语义，float additive mask 和 boolean allow-mask 不可混用。若一整行全部屏蔽，Softmax 会得到 NaN，生产实现应保证至少一个可见 key 或显式处理空行。GPU 上缩放因子最好用 Python float 或同 device tensor。

**45 TorchLeet MHA。** 面试审查题常故意把 parameter creation 放在函数内部；你应立即指出这是无状态随机函数，不是可训练层。正确实现要继承 Module、注册四个 projections，并支持不同 Sq/Sk。进一步追问是 fused QKV projection 如何减少 kernel launch 与显存读写。

**46 TorchLeet RoPE。** Cache cos/sin 时 cache key 不应只有 seq_len，还要考虑 device、dtype、offset 和可能变化的 base/scaling。训练从 offset 0 开始，增量 decode 从 `past_length` 开始。若 checkpoint 使用 half-split rotation，不能随意换成 even/odd interleaving。

**47 Sinusoidal Position。** 固定位置编码无参数，应 `register_buffer` 才会随 `.to(device)` 和 state_dict 移动。偶数/奇数维的 sin/cos 列数要匹配。追问是为什么不同频率允许模型通过线性组合表达相对位移，以及 learned absolute embedding 的长度外推限制。

**48 SmolLM。** 一道完整模型题要从 token IDs 到 logits 逐层说明：Embedding -> N 个 Pre-Norm decoder blocks -> final RMSNorm -> tied LM head。每个 block 内是 causal RoPE-GQA 和 SwiGLU。面试追问通常要求计算参数量、KV cache 大小、训练 label shift，以及 generation 为什么只读取最后位置 logits。

**49 Custom Activation。** `tanh(x)+x` 有显式 residual，导数是 `sech²(x)+1`，始终大于等于 1，因此不会像 sigmoid 那样在大幅值处梯度完全消失，但可能放大梯度。无参数函数不一定要写成 Module；如果需要嵌入 Sequential，Module 更方便。

**50 Dataset/DataLoader。** Dataset 定义单样本访问，DataLoader 定义 batching、shuffle、workers、pin_memory 和 collate。大数据不应全部一次读入内存，可在 `__getitem__` 延迟读取或使用 IterableDataset。追问是多 worker 随机种子、Windows spawn、persistent_workers 和 variable-length collate。

**51 DNN。** 回归末层保持线性；分类二分类可输出一个 logit 配 BCEWithLogits，多分类输出 C logits 配 CrossEntropy。面试应先确认 input dimension 与 task，再决定 hidden width/depth。追问是过拟合、normalization、dropout、residual 和初始化。

**52 Huber Loss。** 在 `|e|=delta` 处函数值和一阶导数连续，小误差梯度 e，大误差梯度饱和为 `delta*sign(e)`，所以抗离群点。追问是 SmoothL1 与 Huber 的缩放定义差异，以及 delta 应根据 target scale 设置。

**53 nn.Linear Regression。** 训练循环最稳妥顺序是 `zero_grad(set_to_none=True) -> forward -> loss -> backward -> step`。`set_to_none` 可省填零并让 optimizer 区分“无梯度”与“零梯度”。追问是 `.train()`/`.eval()` 对纯 Linear 没影响，但统一写法便于模型扩展。

**54 Save/Load。** 推荐保存 state_dict，而非 pickle 整个 Module；加载时先实例化架构，再 `load_state_dict`。当前 PyTorch 对纯权重推荐 `weights_only=True`，且绝不加载不可信 checkpoint。继续训练还需保存 optimizer、scheduler、scaler、epoch、RNG state。

**55 TensorBoard。** 除 loss 外，应记录 learning rate、gradient norm、parameter histograms、throughput 和 validation metrics。Step 必须单调且语义一致。分布式训练只让 rank 0 写日志，避免重复与文件竞争。

**56 Augmentation。** 随机增强只用于 train；val/test 必须 deterministic。Normalization 参数来自训练集统计，不能用 test 数据估计。追问是增强顺序、label-preserving 假设、MixUp/CutMix、RandAugment，以及增强过强造成 distribution shift。

**57 Autoencoder Anomaly。** 训练数据最好主要是 normal samples；threshold 可在 validation normal/anomaly 上按 ROC、F1 或业务成本选择。像素 MSE 不一定捕捉语义异常，可用 feature/perceptual loss。最关键 correctness 是输入目标范围必须匹配 decoder 最后激活。

**58 Benchmark。** GPU 操作异步，wall-clock 前后要 synchronize 或用 CUDA Events；还要 warmup，避免首次编译、allocator 和 cache 污染。报告 median/quantiles，不只一次时间。训练吞吐应同时报告 samples/s、显存和精度，因为更快但数值错误没有意义。

**59 CIFAR CNN。** 每次 stride/pool 后主动写 shape，避免 Linear 输入维硬编码错误；`AdaptiveAvgPool2d` 可解除固定输入尺寸。分类 head 返回 logits。追问是 BatchNorm 位置、global average pooling、ResNet skip connection 和 receptive field。

**60 AMP。** Autocast 只包 forward 和 loss，不包 backward；GradScaler 只对 fp16 通常必要，bf16 动态范围大，常不需要 scaling。若 clip gradients，先 `scaler.unscale_`。遇到 overflow，scaler 会跳过 optimizer step 并降低 scale。

**61 Quantized LM。** CrossEntropy 接收 unnormalized logits，不能先 Softmax。旧 eager `quantize_dynamic` 仍可解释 LSTM/Linear CPU 动态量化，但当前 PyTorch quantization 发展已迁移到 TorchAO。面试要区分存储压缩、真实 kernel speedup、模型精度与硬件支持。

**62 Manual RNN。** BPTT 会把时间展开成深网络，梯度包含 Wh 的多次连乘，导致消失/爆炸。初始 hidden 用 `x.new_zeros` 保证 device/dtype。追问是 truncated BPTT、stateful inference、packed sequences 和 LSTM 门控为什么改善梯度路径。

**63 Custom Autograd。** Forward 保存 backward 真正需要的最少 tensor；backward 返回值数量必须与 forward 输入数量一致，广播参数梯度要 `sum_to_size`。可用 `torch.autograd.gradcheck` 在 double precision 小输入上验证解析梯度。不要把本可由普通 PyTorch ops 自动求导的函数无必要写成 custom Function。

**64 GAN。** 判别器更新时 fake 要 detach；生成器更新时不能 detach。`BCEWithLogitsLoss` 比 Sigmoid+BCELoss 稳定。追问是 minimax vs non-saturating generator loss、mode collapse、WGAN、gradient penalty，以及训练不平衡时 D/G 更新频率。

**65 Seq2Seq Attention。** Encoder memory 与 decoder query 的 additive score 不应把 source length 固定进 Linear 输出维；应该逐 position 共享打分网络。训练常用 teacher forcing，推理用上一步预测，形成 exposure bias。追问是 source mask、beam search、attention coverage 和 Transformer 替代。

**66 Transformer Encoder。** Padding mask 作用于 keys，避免所有 query 读取 padding；若后续 pooling，也要避免把 padding positions 纳入平均。Pre-Norm 重复调用同一个 norm 三次结果相同但浪费，可缓存 `z=norm(x)`。追问是 attention mask 与 key_padding_mask shape/语义差异。

**67 Grad-CAM。** 梯度对空间维平均得到每个 feature map 的重要性权重，再做加权和与 ReLU。它是局部解释，不证明因果；分辨率受最后卷积 feature map 限制。追问是选择哪层、guided backprop、Grad-CAM++ 和 hook 生命周期/线程安全。

**68 3D Segmentation。** 医疗体数据统一使用 `(B,C,D,H,W)`；mask 必须同布局。Dice coefficient 越大越好，因此 loss 是 `1-Dice` 或负 Dice，不能直接最小化 coefficient。实际任务常组合 BCEWithLogits+Dice，处理 class imbalance 与空 mask。

**69 AlexNet。** 经典结构重点是 5 conv + 3 FC、ReLU、overlapping max pool 和 dropout，而不是现代最佳实践。输入 224/227 的尺寸差会影响最终 6x6。面试追问是 AlexNet 的历史贡献、参数主要集中在 FC、为什么现代网络用 GAP/BatchNorm/residual。

**70 Initialization Experiment。** 比较初始化时必须控制相同数据顺序、optimizer、seed 和训练预算；否则结论不公平。全零权重造成 symmetry，所有同层单元梯度相同。Random std=1 对深网络通常过大；Xavier/Kaiming 根据 fan 自动控制方差。

**71 CNN from Scratch。** 自定义 Conv 输出要用 `x.new_zeros` 保持 dtype/device，循环内 tensor assignment 仍可建立 CopySlices autograd 图，但极慢。更向量化的教学实现是 `unfold + einsum/matmul`。最重要审查点是最终模型必须真的使用自定义层。

**72 Custom LSTM。** 四个 gate 可一次大矩阵乘法后 chunk，避免四次 kernel。初始 h/c 通常为零，不能每次随机。面试要写出 `c_t=f*c_{t-1}+i*g` 与 `h_t=o*tanh(c_t)`，并解释 cell state 的加法路径如何缓解梯度消失。

## D. 对齐、经典算法与 GPU/推理系统（73-102）

**73 Full DPO。** `get_batch_logps` 要 shift logits/labels，并对有效 completion tokens 求和。Prompt token 通常不进入 preference loss。Reference 冻结且可预计算 logps。追问是 chosen/rejected 长度不同造成的 sum 偏差、beta、DPO accuracy/reward margin 监控和 reference model 内存优化。

**74 Gradient Checkpoint。** Checkpoint 只省 activation，不省参数、梯度和 optimizer states；代价是 backward 重算 forward。分段数量影响峰值内存与重算量。生产代码显式传 `use_reentrant=False`；含 Dropout 时需保持 RNG。追问是与 CPU offload、FSDP、FlashAttention 的互补关系。

**75 Full GRPO。** 每个 prompt 必须采样 G 个 completion 后组内标准化 reward。Old policy ratio 防止一次 update 走太远，reference KL 防止长期漂移。追问是 reward hacking、格式/答案多 reward 组合、token-level advantage 广播、group std 为 0 和 importance ratio 的数值范围。

**76 LoRA Merge。** `nn.Linear.weight` 是 `(Dout,Din)`，若 forward 是 `x@A.T@B.T`，merge 就是 `W += scale*(B@A)`。Merge 前后应 eval、同 dtype 输入比较。追问是重复 merge 防护、adapter composition、多 adapter 切换和量化 base weight 上是否可直接 merge。

**77 PPO-RLHF。** GAE 从后向前递推 TD residual，并在 done/EOS 处截断 bootstrap。Policy/value/reference/reward 四类模型角色要讲清。追问是 rollout 与 update 阶段、old logps snapshot、whiten advantages、reward/kl shaping、value clipping 和 minibatch epochs。

**78 K-Means。** Assignment 用 O(NKD) 距离，update 用 cluster mean；非凸目标只保证收敛到局部最优。空 cluster 要保留旧中心或重新采样。追问是 k-means++、多次 restart、标准化特征、GPU memory 中 `cdist(N,K)` 的代价。

**79 KNN。** 训练几乎为存储，推理 O(Ntrain*D) 每 query，内存可按 query chunk。`torch.mode` 平票规则应说明。追问是距离加权、特征归一化、cosine vs Euclidean、curse of dimensionality 和 ANN index。

**80 Logistic Regression。** BCE+sigmoid 对 logits 的导数简化为 `p-y`，所以 `dw=X.T@(p-y)/N`。计算 loss 时用 `softplus(z)-y*z` 更稳定。追问是 decision boundary、L2 regularization 梯度、class imbalance、阈值与 AUC。

**81 Softmax Review。** 除数值稳定外，要知道 Softmax 对所有 logits 加同一常数不变，Jacobian 为 `diag(p)-pp^T`。与 CE 合并后对 logits 梯度是 `p-one_hot(y)`。这是面试中从公式推导到高效 fused kernel 的常见链路。

**82 FlashAttention-2。** 它减少 HBM IO 和中间矩阵存储，但数学结果仍是 exact attention。要能推导 online max/sum 合并，并说明 backward 也通过重算避免保存 NxN probabilities。追问是 tile size、occupancy、causal masking、dropout RNG 和 GQA 支持。

**83 FSDP。** ZeRO-1 shard optimizer state，ZeRO-2 再 shard gradients，ZeRO-3/FSDP 再 shard parameters。Forward 前 all-gather full params，backward 后 reduce-scatter grads。追问是 reshard_after_forward、prefetch、mixed precision、state_dict 类型和为什么通信量/峰值 full parameter 仍需管理。

**84 Ring Attention。** Sequence parallel 把长上下文 K/V 分块到设备，Q 保持本地；K/V 环传一圈并用 online Softmax 合并。总计算未减少，单卡内存下降并引入通信。Causal 场景必须基于全局位置决定某 block 全可见、部分可见或全跳过。

**85 Triton Softmax。** 每个 program 通常负责一行，block size 向上取 2 的幂，越界 lane 用 `-inf`。融合避免 max、exp、sum 的多次 HBM round trip。追问是 row 超过 SRAM/block 限制怎么办、warps 数量、fp32 reduction 和与 `torch.compile` 的基准方法。

**86 Beam Search v3。** 除算法，还要讨论模型调用如何 batch beams、父 beam 选择后如何 reorder KV cache。Length penalty 改变排名而非概率模型本身。追问是 beam_width 对质量/延迟、no-repeat ngram、coverage penalty 和 finished beam early stop。

**87 Temperature。** 温度作用在 logits 而不是已归一化概率上；`T->0` 接近 argmax，`T->infinity` 接近均匀。Multinomial 只接受 1D/2D，因此任意前导维要 flatten 后恢复。追问是 entropy 与 temperature 单调关系及 calibration temperature scaling。

**88 Top-k。** 在 top-k 子 logits 上直接 Softmax/采样，避免创建完整 mask。K 必须 clamp 到 `[1,V]`。追问是 tie、批量不同 k、top-k 与 temperature 顺序，以及 k 太小导致重复和模式退化。

**89 Top-p。** 对 sorted probabilities 做 cumulative sum，remove mask 需右移或减当前概率，确保第一个 crossing token 被保留。P 越小越保守。追问是 batch vectorization、至少保留一个 token，以及 top-k+top-p 组合的过滤顺序。

**90 Continuous Batching。** 核心指标是 throughput 和 time-to-first-token/time-per-output-token 的权衡。Prefill 计算密集，decode 内存带宽密集，混批策略会相互干扰。追问是 admission control、max tokens budget、preemption、chunked prefill、fairness 与 cancellation。

**91 Inference Engine。** 分层讲：model executor、KV memory manager、scheduler、sampler、request lifecycle。Prefill 输入整段，decode 输入一个新 token；每层 cache 独立。追问是 paged attention、tensor parallel、CUDA graphs、speculative decoding、streaming 和 observability。

**92 KV Validation。** 正确性测试必须同一权重、eval mode、dropout 关闭、相同 position IDs，并比较 cached 每步输出与 full causal 输出对应最后 token。若 RoPE offset 或 causal mask 错一位，shape 仍对但数值不对，这是高频 debug 点。

**93 Speculative Full。** 性能收益近似取决于一次 target verification 接受多少 draft tokens。Draft 太弱 acceptance 低，太大又不够快。追问是 tree speculation、多 draft heads、KV rollback、batching 下变长接受数，以及为什么 rejection correction 保证无偏。

**94 2D Position。** D 必须能被 4 整除，才能 row/col 各分一半且每半有 sin/cos pairs。Flatten 顺序必须与 patchify 顺序一致。追问是 absolute 2D、relative bias、RoPE-2D、不同图像分辨率插值。

**95 CLIP InfoNCE。** L2 normalize 后点积就是 cosine；batch 中其他样本充当 negatives。对称 CE 让图找文、文找图都学习。追问是 false negatives、大 batch/all-gather features、learnable logit scale、distributed labels offset 和 retrieval Recall@K。

**96 DDIM+CFG。** DDIM eta=0 在给定初始噪声下确定，可跳过 timesteps；CFG `eps_u+s(eps_c-eps_u)`，scale 过高会饱和或失真。追问是训练时 condition dropout、epsilon/v/x0 parameterization、scheduler timestep mapping 和 negative prompt。

**97 DDPM。** 前向 `q(xt|x0)` 有闭式，高效随机 t 训练；反向是学习高斯均值或噪声。Posterior variance 不是简单 beta。追问是 alpha_bar schedule、cosine beta、为什么预测 noise、ELBO 与 simple MSE、EMA model 和采样步数。

**98 Distillation。** Teacher 用 `eval()`、`no_grad()`；student 同时优化 soft KL 与 hard CE。T 越大概率越平，暴露 dark knowledge。追问是 feature/logit distillation、teacher calibration、alpha/T 调参、同 tokenizer/vocab 对齐和 sequence-level distillation。

**99 Mamba。** 连续 SSM 离散化后做 recurrence，Mamba 的 selectivity 来自 input-dependent delta/B/C。A 参数化为负保证稳定，parallel scan 让训练不必纯 Python 顺序循环。追问是与 attention 的状态大小、长序列复杂度、causal convolution、hardware-aware scan 和 chunking。

**100 MoE Balance。** Auxiliary loss 结合实际 dispatch fraction 与 router mean probability；只看一个不足以阻止 collapse。Top-k 离散选择使路由不可微部分依赖 selected gate 梯度。追问是 Switch top-1、Mixtral top-2、capacity overflow、shared experts 和 expert choice routing。

**101 Sliding Window v3。** Dense band mask 只验证数学，不验证 O(Nw) 资源；面试必须主动指出。多层局部 attention 的 receptive field 线性扩大，也可周期加入 global tokens。追问是 Mistral causal window、dilated window 和 block-sparse layout。

**102 ViT-MAE。** MAE encoder 只处理 visible patches，这是主要计算节省；decoder 接收恢复顺序后的 encoded visible tokens 与 learned mask tokens。Loss 只在 masked patches 上算，常先对每个 patch 像素归一化。追问是 75% 高 mask ratio 为什么可行、CLS 是否参与预训练、fine-tuning 如何丢弃 decoder。

## 面试前最终检查表

1. 每段代码先说 shape，不要直接写矩阵乘法。
2. 每个 loss 说清输入是 logits、log-prob 还是 probability，以及 reduction/mask denominator。
3. 每个 Module 说清哪些是 Parameter、哪些是 buffer、哪些是 runtime state/cache。
4. 每个训练循环说清 train/eval、zero_grad、AMP、clip、step、scheduler 的顺序。
5. 每个加速算法区分“数学正确”“复杂度正确”“真实 kernel/系统能加速”三层结论。
6. 遇到 repository reference solution 不正确时，先指出具体 tensor shape、梯度或 API contract，再给修正版。

## 当前 PyTorch API 参考

- [Automatic Mixed Precision](https://docs.pytorch.org/docs/stable/accelerator/amp.html)：当前训练组合是 `torch.autocast` 与 `torch.amp.GradScaler`。
- [torch.load](https://docs.pytorch.org/docs/stable/generated/torch.load.html)：加载纯 state_dict 时使用 `weights_only=True`，不可信 checkpoint 仍不应加载。
- [Activation Checkpointing](https://docs.pytorch.org/docs/stable/checkpoint.html)：生产代码推荐显式设置 `use_reentrant=False`，并注意重算与 RNG state。
- [BatchNorm1d](https://docs.pytorch.org/docs/stable/generated/torch.nn.BatchNorm1d.html)：训练输出使用 biased variance，running variance 使用 unbiased variance。
- [Scaled Dot-Product Attention](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html)：确认 boolean/additive mask、causal 与 GQA 的当前 API 语义。
- [PyTorch Quantization](https://docs.pytorch.org/docs/stable/quantization.html) 与 [TorchAO](https://docs.pytorch.org/ao/stable/)：现有 eager quantization API 仍可用于理解旧 notebook，但新量化开发正在迁移到 TorchAO。

## 验证边界

本文件已完成逐题数学、shape、autograd、device/dtype、API contract 和代码语法的静态审查。当前本地 Python runtime 没有安装 `torch`，因此没有执行 102 题的 tensor 数值测试；Triton、FSDP、Ring Attention、FlashAttention 等还需要对应 GPU/多进程环境做动态验证。面试学习时应把“静态正确”“数值测试通过”“生产性能验证通过”视为三个不同层级。
